"""
Real Celery load testing with actual task execution.
Tests worker performance, queue throughput, and failure handling.
"""

import pytest
import asyncio
import time
import random
import statistics
from datetime import datetime, timedelta
from uuid import uuid4
from typing import List, Dict, Any
import redis
import json

from celery import Celery, group
from celery.result import AsyncResult
from kombu import Queue
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.celery_app import celery_app
from app.tasks.schedule_tasks import execute_scheduled_report
from app.tasks.export_tasks import generate_export
from app.models.schedule import ExportSchedule
from app.models.report import Report
from app.models.user import User


class CeleryLoadTester:
    """Test Celery workers under real load conditions."""
    
    def __init__(self):
        """Initialize Celery load tester."""
        self.redis_client = redis.Redis.from_url(settings.REDIS_URL)
        self.db_engine = create_engine(settings.DATABASE_URL.replace("+asyncpg", ""))
        self.Session = sessionmaker(bind=self.db_engine)
        
        # Metrics storage
        self.task_results = []
        self.queue_depths = []
        self.worker_stats = []
        
    def setup_test_data(self, num_schedules: int = 100) -> List[str]:
        """Create test schedules in database."""
        schedule_ids = []
        
        with self.Session() as session:
            # Create test user
            user = User(
                id=uuid4(),
                email="celery_test@example.com",
                username="celery_test",
                hashed_password="hashed",
                is_active=True
            )
            session.add(user)
            
            # Create test report
            report = Report(
                id=uuid4(),
                name="Celery Test Report",
                created_by_id=user.id,
                query_config={"fields": ["field1", "field2"]},
                layout_config={"sections": []},
                is_public=True
            )
            session.add(report)
            
            # Create schedules
            for i in range(num_schedules):
                schedule = ExportSchedule(
                    id=uuid4(),
                    report_id=report.id,
                    name=f"Celery Test Schedule {i}",
                    created_by_id=user.id,
                    schedule_config={
                        "frequency": "custom",
                        "cron_expression": "*/5 * * * *",
                        "timezone": "UTC"
                    },
                    distribution_config={
                        "local": {
                            "base_path": "/tmp/celery_test",
                            "create_subdirs": True,
                            "filename_pattern": f"test_{i}_{{timestamp}}.csv"
                        }
                    },
                    export_config={
                        "format": "csv",
                        "include_headers": True
                    },
                    is_active=True,
                    next_run=datetime.utcnow()
                )
                session.add(schedule)
                schedule_ids.append(str(schedule.id))
            
            session.commit()
        
        return schedule_ids
    
    def monitor_queue_depth(self, duration: int = 60):
        """Monitor Redis queue depths during test."""
        start_time = time.time()
        
        while time.time() - start_time < duration:
            depths = {}
            for queue_name in ["schedules", "exports", "distribution"]:
                queue_key = f"celery:{queue_name}"
                depth = self.redis_client.llen(queue_key)
                depths[queue_name] = depth
            
            self.queue_depths.append({
                "timestamp": time.time(),
                "depths": depths
            })
            
            time.sleep(1)
    
    def submit_tasks_burst(self, schedule_ids: List[str], burst_size: int = 100) -> List[AsyncResult]:
        """Submit a burst of tasks to Celery."""
        tasks = []
        
        for i in range(burst_size):
            schedule_id = random.choice(schedule_ids)
            # Submit task with priority
            priority = random.randint(0, 9)
            result = execute_scheduled_report.apply_async(
                args=[schedule_id],
                queue="schedules",
                priority=priority
            )
            tasks.append(result)
        
        return tasks
    
    def submit_tasks_sustained(self, schedule_ids: List[str], rate: int = 10, duration: int = 60) -> List[AsyncResult]:
        """Submit tasks at a sustained rate."""
        tasks = []
        start_time = time.time()
        interval = 1.0 / rate  # Time between task submissions
        
        while time.time() - start_time < duration:
            schedule_id = random.choice(schedule_ids)
            result = execute_scheduled_report.apply_async(
                args=[schedule_id],
                queue="schedules"
            )
            tasks.append(result)
            time.sleep(interval)
        
        return tasks
    
    def wait_for_tasks(self, tasks: List[AsyncResult], timeout: int = 300) -> Dict[str, Any]:
        """Wait for tasks to complete and collect metrics."""
        start_time = time.time()
        completed = []
        failed = []
        timed_out = []
        
        # Track task completion times
        completion_times = []
        
        while tasks and time.time() - start_time < timeout:
            remaining = []
            
            for task in tasks:
                if task.ready():
                    end_time = time.time()
                    
                    # Calculate task duration (approximate)
                    task_duration = end_time - start_time
                    
                    if task.successful():
                        completed.append(task.id)
                        completion_times.append(task_duration)
                    else:
                        failed.append({
                            "id": task.id,
                            "error": str(task.info)
                        })
                else:
                    remaining.append(task)
            
            tasks = remaining
            
            if tasks:
                time.sleep(0.5)
        
        # Tasks that didn't complete in time
        for task in tasks:
            timed_out.append(task.id)
        
        return {
            "completed": len(completed),
            "failed": len(failed),
            "timed_out": len(timed_out),
            "completion_times": completion_times,
            "failed_tasks": failed[:10]  # Sample of failures
        }
    
    def test_burst_load(self, num_schedules: int = 100, burst_size: int = 500):
        """Test system under burst load."""
        print(f"\n{'='*60}")
        print(f"Celery Burst Load Test")
        print(f"Schedules: {num_schedules}, Burst Size: {burst_size}")
        print(f"{'='*60}\n")
        
        # Setup test data
        schedule_ids = self.setup_test_data(num_schedules)
        
        # Start queue monitoring in background
        import threading
        monitor_thread = threading.Thread(
            target=self.monitor_queue_depth,
            args=(120,),  # Monitor for 2 minutes
            daemon=True
        )
        monitor_thread.start()
        
        # Submit burst of tasks
        print(f"Submitting {burst_size} tasks...")
        start_time = time.time()
        tasks = self.submit_tasks_burst(schedule_ids, burst_size)
        submit_time = time.time() - start_time
        print(f"Submitted {len(tasks)} tasks in {submit_time:.2f} seconds")
        
        # Wait for completion
        print("Waiting for task completion...")
        results = self.wait_for_tasks(tasks, timeout=300)
        
        # Analyze results
        total_time = time.time() - start_time
        
        print(f"\n{'='*60}")
        print("Burst Load Test Results")
        print(f"{'='*60}")
        print(f"Total Time: {total_time:.2f} seconds")
        print(f"Tasks Completed: {results['completed']}/{burst_size}")
        print(f"Tasks Failed: {results['failed']}")
        print(f"Tasks Timed Out: {results['timed_out']}")
        
        if results['completion_times']:
            print(f"\nCompletion Times:")
            print(f"  Min: {min(results['completion_times']):.2f}s")
            print(f"  Max: {max(results['completion_times']):.2f}s")
            print(f"  Mean: {statistics.mean(results['completion_times']):.2f}s")
            print(f"  Median: {statistics.median(results['completion_times']):.2f}s")
        
        if results['failed_tasks']:
            print(f"\nSample of Failed Tasks:")
            for task in results['failed_tasks'][:5]:
                print(f"  - {task['id']}: {task['error']}")
        
        # Analyze queue depths
        if self.queue_depths:
            max_depths = {}
            for metric in self.queue_depths:
                for queue, depth in metric['depths'].items():
                    if queue not in max_depths or depth > max_depths[queue]:
                        max_depths[queue] = depth
            
            print(f"\nMax Queue Depths:")
            for queue, depth in max_depths.items():
                print(f"  {queue}: {depth}")
        
        return results
    
    def test_sustained_load(self, num_schedules: int = 100, rate: int = 10, duration: int = 60):
        """Test system under sustained load."""
        print(f"\n{'='*60}")
        print(f"Celery Sustained Load Test")
        print(f"Rate: {rate} tasks/second for {duration} seconds")
        print(f"{'='*60}\n")
        
        # Setup test data
        schedule_ids = self.setup_test_data(num_schedules)
        
        # Start queue monitoring
        import threading
        monitor_thread = threading.Thread(
            target=self.monitor_queue_depth,
            args=(duration + 60,),  # Monitor for test duration + buffer
            daemon=True
        )
        monitor_thread.start()
        
        # Submit tasks at sustained rate
        print(f"Submitting tasks at {rate}/second...")
        tasks = self.submit_tasks_sustained(schedule_ids, rate, duration)
        print(f"Submitted {len(tasks)} tasks")
        
        # Wait for completion
        results = self.wait_for_tasks(tasks, timeout=duration + 120)
        
        # Calculate throughput
        actual_rate = results['completed'] / duration if duration > 0 else 0
        
        print(f"\n{'='*60}")
        print("Sustained Load Test Results")
        print(f"{'='*60}")
        print(f"Target Rate: {rate} tasks/second")
        print(f"Actual Throughput: {actual_rate:.2f} tasks/second")
        print(f"Tasks Completed: {results['completed']}/{len(tasks)}")
        print(f"Tasks Failed: {results['failed']}")
        print(f"Success Rate: {(results['completed'] / len(tasks) * 100):.1f}%")
        
        return results
    
    def test_failure_recovery(self, num_failures: int = 50):
        """Test Celery's handling of task failures and retries."""
        print(f"\n{'='*60}")
        print(f"Celery Failure Recovery Test")
        print(f"Inducing {num_failures} failures")
        print(f"{'='*60}\n")
        
        # Create tasks that will fail
        tasks = []
        for i in range(num_failures):
            # Submit task with invalid schedule ID (will fail)
            result = execute_scheduled_report.apply_async(
                args=[str(uuid4())],  # Non-existent schedule
                queue="schedules",
                retry=True,
                retry_policy={
                    'max_retries': 3,
                    'interval_start': 1,
                    'interval_step': 2,
                    'interval_max': 10,
                }
            )
            tasks.append(result)
        
        # Wait and collect results
        results = self.wait_for_tasks(tasks, timeout=120)
        
        # Check Dead Letter Queue
        dlq_count = self.redis_client.hlen("dlq:schedule_tasks")
        
        print(f"\n{'='*60}")
        print("Failure Recovery Test Results")
        print(f"{'='*60}")
        print(f"Tasks Submitted: {num_failures}")
        print(f"Tasks Failed (after retries): {results['failed']}")
        print(f"Tasks in Dead Letter Queue: {dlq_count}")
        
        # Verify all failures were handled
        assert results['failed'] == num_failures, "Not all failures were properly handled"
        
        return results
    
    def test_worker_scaling(self):
        """Test system behavior when workers scale up/down."""
        print(f"\n{'='*60}")
        print(f"Worker Scaling Test")
        print(f"{'='*60}\n")
        
        # This test would normally interact with worker management
        # For demonstration, we'll monitor existing workers
        
        # Get worker stats
        inspect = celery_app.control.inspect()
        
        # Get active workers
        active_workers = inspect.active()
        if active_workers:
            print(f"Active Workers: {len(active_workers)}")
            for worker, tasks in active_workers.items():
                print(f"  {worker}: {len(tasks)} active tasks")
        
        # Get registered tasks
        registered = inspect.registered()
        if registered:
            print(f"\nRegistered Tasks:")
            for worker, tasks in registered.items():
                print(f"  {worker}: {len(tasks)} tasks")
        
        # Get worker stats
        stats = inspect.stats()
        if stats:
            print(f"\nWorker Statistics:")
            for worker, stat in stats.items():
                print(f"  {worker}:")
                print(f"    Total tasks: {stat.get('total', {})}")
                if 'pool' in stat:
                    print(f"    Pool size: {stat['pool'].get('max-concurrency', 'N/A')}")
        
        return {
            "workers": len(active_workers) if active_workers else 0,
            "stats": stats
        }
    
    def cleanup(self):
        """Clean up test data."""
        with self.Session() as session:
            session.execute(text("DELETE FROM schedule_executions WHERE schedule_id IN (SELECT id FROM export_schedules WHERE name LIKE 'Celery Test%')"))
            session.execute(text("DELETE FROM export_schedules WHERE name LIKE 'Celery Test%'"))
            session.execute(text("DELETE FROM reports WHERE name = 'Celery Test Report'"))
            session.execute(text("DELETE FROM users WHERE email = 'celery_test@example.com'"))
            session.commit()
        
        # Clear DLQ
        self.redis_client.delete("dlq:schedule_tasks")


def run_celery_load_tests():
    """Run complete Celery load test suite."""
    tester = CeleryLoadTester()
    
    try:
        # Test 1: Burst load
        burst_results = tester.test_burst_load(
            num_schedules=50,
            burst_size=500
        )
        
        # Test 2: Sustained load
        sustained_results = tester.test_sustained_load(
            num_schedules=50,
            rate=20,  # 20 tasks/second
            duration=60
        )
        
        # Test 3: Failure recovery
        failure_results = tester.test_failure_recovery(num_failures=50)
        
        # Test 4: Worker information
        worker_info = tester.test_worker_scaling()
        
        # Summary
        print(f"\n{'='*60}")
        print("CELERY LOAD TEST SUMMARY")
        print(f"{'='*60}")
        
        print("\n✅ Burst Load Test:")
        print(f"  - Handled {burst_results['completed']} tasks")
        print(f"  - Failure rate: {(burst_results['failed'] / (burst_results['completed'] + burst_results['failed']) * 100):.1f}%")
        
        print("\n✅ Sustained Load Test:")
        print(f"  - Sustained throughput: {sustained_results['completed'] / 60:.1f} tasks/second")
        
        print("\n✅ Failure Recovery:")
        print(f"  - All {failure_results['failed']} failures handled properly")
        
        print("\n✅ Worker Status:")
        print(f"  - {worker_info['workers']} workers active")
        
        # Performance assessment
        print(f"\n{'='*60}")
        print("PERFORMANCE ASSESSMENT")
        print(f"{'='*60}")
        
        if burst_results['completed'] >= 450:  # 90% success
            print("✅ Burst handling: PASS")
        else:
            print("❌ Burst handling: FAIL")
        
        if sustained_results['completed'] / 60 >= 18:  # 90% of target
            print("✅ Sustained throughput: PASS")
        else:
            print("❌ Sustained throughput: FAIL")
        
        print("✅ Failure recovery: PASS")
        
    finally:
        # Cleanup
        tester.cleanup()
        print("\n✅ Test data cleaned up")


if __name__ == "__main__":
    # Ensure Celery workers are running before starting test
    print("Ensure Celery workers are running:")
    print("  celery -A app.core.celery_app worker --loglevel=info --queues=schedules,exports,distribution")
    print("\nStarting tests in 5 seconds...")
    time.sleep(5)
    
    run_celery_load_tests()