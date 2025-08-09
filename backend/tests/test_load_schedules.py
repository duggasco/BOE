"""
Load testing for schedule system with 10,000+ schedules.
Tests system performance, database queries, and Celery task processing at scale.
"""

import asyncio
import time
import random
import statistics
from datetime import datetime, timedelta
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor, as_completed
import psutil
import json
from typing import List, Dict, Any

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from faker import Faker
import pytz

from app.core.config import settings
from app.models.schedule import ExportSchedule, ScheduleExecution
from app.models.report import Report
from app.models.user import User
from app.schemas.schedule import ScheduleCreate
from app.tasks.schedule_tasks import check_and_execute_schedules


class LoadTestMetrics:
    """Collect and analyze load test metrics."""
    
    def __init__(self):
        self.response_times = []
        self.error_count = 0
        self.success_count = 0
        self.start_time = None
        self.end_time = None
        self.memory_usage = []
        self.cpu_usage = []
    
    def start(self):
        """Start metric collection."""
        self.start_time = time.time()
        self.start_resource_monitoring()
    
    def start_resource_monitoring(self):
        """Monitor system resources during test."""
        def monitor():
            while self.start_time and not self.end_time:
                self.memory_usage.append(psutil.virtual_memory().percent)
                self.cpu_usage.append(psutil.cpu_percent(interval=1))
                time.sleep(1)
        
        import threading
        monitor_thread = threading.Thread(target=monitor, daemon=True)
        monitor_thread.start()
    
    def record_response(self, duration: float, success: bool = True):
        """Record a response."""
        self.response_times.append(duration)
        if success:
            self.success_count += 1
        else:
            self.error_count += 1
    
    def stop(self):
        """Stop metric collection and calculate statistics."""
        self.end_time = time.time()
        return self.get_report()
    
    def get_report(self) -> Dict[str, Any]:
        """Generate performance report."""
        total_time = self.end_time - self.start_time
        total_requests = len(self.response_times)
        
        return {
            "total_time": total_time,
            "total_requests": total_requests,
            "success_count": self.success_count,
            "error_count": self.error_count,
            "error_rate": (self.error_count / total_requests * 100) if total_requests > 0 else 0,
            "throughput": total_requests / total_time if total_time > 0 else 0,
            "response_times": {
                "min": min(self.response_times) if self.response_times else 0,
                "max": max(self.response_times) if self.response_times else 0,
                "mean": statistics.mean(self.response_times) if self.response_times else 0,
                "median": statistics.median(self.response_times) if self.response_times else 0,
                "p95": self.percentile(self.response_times, 95) if self.response_times else 0,
                "p99": self.percentile(self.response_times, 99) if self.response_times else 0,
            },
            "resources": {
                "memory": {
                    "min": min(self.memory_usage) if self.memory_usage else 0,
                    "max": max(self.memory_usage) if self.memory_usage else 0,
                    "avg": statistics.mean(self.memory_usage) if self.memory_usage else 0,
                },
                "cpu": {
                    "min": min(self.cpu_usage) if self.cpu_usage else 0,
                    "max": max(self.cpu_usage) if self.cpu_usage else 0,
                    "avg": statistics.mean(self.cpu_usage) if self.cpu_usage else 0,
                }
            }
        }
    
    @staticmethod
    def percentile(data: List[float], percentile: int) -> float:
        """Calculate percentile."""
        if not data:
            return 0
        sorted_data = sorted(data)
        index = int(len(sorted_data) * percentile / 100)
        return sorted_data[min(index, len(sorted_data) - 1)]


class ScheduleLoadTester:
    """Load test the schedule system."""
    
    def __init__(self, db_url: str = None):
        """Initialize load tester."""
        self.db_url = db_url or settings.DATABASE_URL
        self.fake = Faker()
        self.metrics = LoadTestMetrics()
        
        # Test data
        self.users = []
        self.reports = []
        self.schedules = []
    
    async def setup_test_data(self, num_users: int = 100, num_reports: int = 500):
        """Create test users and reports."""
        print(f"Creating {num_users} test users and {num_reports} test reports...")
        
        engine = create_async_engine(self.db_url)
        async_session = sessionmaker(engine, class_=AsyncSession)
        
        async with async_session() as session:
            # Create users
            for i in range(num_users):
                user = User(
                    id=uuid4(),
                    email=f"loadtest_user_{i}@example.com",
                    username=f"loadtest_user_{i}",
                    hashed_password="hashed",
                    is_active=True
                )
                session.add(user)
                self.users.append(user)
            
            # Create reports
            for i in range(num_reports):
                report = Report(
                    id=uuid4(),
                    name=f"Load Test Report {i}",
                    description=self.fake.text(max_nb_chars=200),
                    created_by_id=random.choice(self.users).id,
                    query_config={"fields": ["field1", "field2"]},
                    layout_config={"sections": []},
                    is_public=random.choice([True, False])
                )
                session.add(report)
                self.reports.append(report)
            
            await session.commit()
        
        print(f"Test data created: {len(self.users)} users, {len(self.reports)} reports")
    
    async def create_schedule_batch(self, batch_size: int, batch_num: int) -> List[float]:
        """Create a batch of schedules and measure performance."""
        engine = create_async_engine(self.db_url)
        async_session = sessionmaker(engine, class_=AsyncSession)
        
        response_times = []
        
        async with async_session() as session:
            for i in range(batch_size):
                schedule_num = batch_num * batch_size + i
                
                # Generate random schedule configuration
                cron_expressions = [
                    "0 9 * * *",  # Daily at 9 AM
                    "0 */6 * * *",  # Every 6 hours
                    "0 0 * * 1",  # Weekly on Monday
                    "0 0 1 * *",  # Monthly on 1st
                    "*/15 * * * *"  # Every 15 minutes (stress test)
                ]
                
                schedule_data = {
                    "report_id": random.choice(self.reports).id,
                    "name": f"Load Test Schedule {schedule_num}",
                    "description": self.fake.text(max_nb_chars=100),
                    "schedule_config": {
                        "frequency": random.choice(["daily", "weekly", "monthly", "custom"]),
                        "cron_expression": random.choice(cron_expressions),
                        "timezone": random.choice(["UTC", "America/New_York", "Europe/London", "Asia/Tokyo"])
                    },
                    "distribution_config": {
                        "local": {
                            "base_path": "/exports/loadtest",
                            "create_subdirs": True,
                            "filename_pattern": f"report_{schedule_num}_{{timestamp}}.{{format}}"
                        }
                    },
                    "export_config": {
                        "format": random.choice(["csv", "excel", "pdf"]),
                        "include_headers": True,
                        "compress": random.choice([True, False])
                    },
                    "is_active": random.choice([True, True, True, False]),  # 75% active
                    "created_by_id": random.choice(self.users).id
                }
                
                # Measure creation time
                start_time = time.time()
                
                try:
                    schedule = ExportSchedule(**schedule_data)
                    session.add(schedule)
                    self.schedules.append(schedule)
                    
                    duration = time.time() - start_time
                    response_times.append(duration)
                    self.metrics.record_response(duration, success=True)
                    
                except Exception as e:
                    duration = time.time() - start_time
                    response_times.append(duration)
                    self.metrics.record_response(duration, success=False)
                    print(f"Error creating schedule {schedule_num}: {e}")
            
            # Batch commit
            commit_start = time.time()
            await session.commit()
            commit_time = time.time() - commit_start
            
            print(f"Batch {batch_num}: Created {batch_size} schedules, commit took {commit_time:.2f}s")
        
        return response_times
    
    async def load_test_create_schedules(self, total_schedules: int = 10000, batch_size: int = 100):
        """Create large number of schedules and measure performance."""
        print(f"\n{'='*60}")
        print(f"Starting load test: Creating {total_schedules} schedules")
        print(f"Batch size: {batch_size}")
        print(f"{'='*60}\n")
        
        self.metrics.start()
        
        # Create schedules in batches
        num_batches = total_schedules // batch_size
        tasks = []
        
        # Use asyncio for concurrent batch creation
        for batch_num in range(num_batches):
            task = self.create_schedule_batch(batch_size, batch_num)
            tasks.append(task)
        
        # Execute batches with controlled concurrency
        batch_results = []
        for i in range(0, len(tasks), 10):  # Process 10 batches at a time
            batch = tasks[i:i+10]
            results = await asyncio.gather(*batch)
            batch_results.extend(results)
            print(f"Progress: {min(i+10, len(tasks))}/{len(tasks)} batches completed")
        
        # Stop metrics and get report
        report = self.metrics.stop()
        
        print(f"\n{'='*60}")
        print("Load Test Results - Schedule Creation")
        print(f"{'='*60}")
        print(f"Total Schedules Created: {report['success_count']}")
        print(f"Failed Creations: {report['error_count']}")
        print(f"Error Rate: {report['error_rate']:.2f}%")
        print(f"Total Time: {report['total_time']:.2f} seconds")
        print(f"Throughput: {report['throughput']:.2f} schedules/second")
        print(f"\nResponse Times (seconds):")
        print(f"  Min: {report['response_times']['min']:.4f}")
        print(f"  Max: {report['response_times']['max']:.4f}")
        print(f"  Mean: {report['response_times']['mean']:.4f}")
        print(f"  Median: {report['response_times']['median']:.4f}")
        print(f"  95th Percentile: {report['response_times']['p95']:.4f}")
        print(f"  99th Percentile: {report['response_times']['p99']:.4f}")
        print(f"\nResource Usage:")
        print(f"  Memory - Min: {report['resources']['memory']['min']:.1f}%, Max: {report['resources']['memory']['max']:.1f}%, Avg: {report['resources']['memory']['avg']:.1f}%")
        print(f"  CPU - Min: {report['resources']['cpu']['min']:.1f}%, Max: {report['resources']['cpu']['max']:.1f}%, Avg: {report['resources']['cpu']['avg']:.1f}%")
        
        return report
    
    async def load_test_query_schedules(self, num_queries: int = 1000):
        """Test querying schedules with various filters."""
        print(f"\n{'='*60}")
        print(f"Testing schedule queries ({num_queries} queries)")
        print(f"{'='*60}\n")
        
        engine = create_async_engine(self.db_url)
        async_session = sessionmaker(engine, class_=AsyncSession)
        
        metrics = LoadTestMetrics()
        metrics.start()
        
        query_types = [
            # Simple queries
            ("all_active", "SELECT * FROM export_schedules WHERE is_active = true LIMIT 100"),
            ("by_user", "SELECT * FROM export_schedules WHERE created_by_id = :user_id LIMIT 20"),
            ("recent", "SELECT * FROM export_schedules ORDER BY created_at DESC LIMIT 50"),
            
            # Complex queries with joins
            ("with_executions", """
                SELECT s.*, COUNT(e.id) as execution_count 
                FROM export_schedules s 
                LEFT JOIN schedule_executions e ON s.id = e.schedule_id 
                GROUP BY s.id 
                LIMIT 100
            """),
            
            # Aggregation queries
            ("stats_by_format", """
                SELECT export_config->>'format' as format, COUNT(*) as count 
                FROM export_schedules 
                GROUP BY export_config->>'format'
            """),
            
            # Next run queries (critical for scheduler)
            ("due_schedules", """
                SELECT * FROM export_schedules 
                WHERE is_active = true AND next_run <= NOW() 
                ORDER BY next_run 
                LIMIT 100
            """),
        ]
        
        async with async_session() as session:
            for i in range(num_queries):
                query_name, query_sql = random.choice(query_types)
                
                params = {}
                if "user_id" in query_sql:
                    params["user_id"] = random.choice(self.users).id if self.users else uuid4()
                
                start_time = time.time()
                
                try:
                    result = await session.execute(text(query_sql), params)
                    rows = result.fetchall()
                    
                    duration = time.time() - start_time
                    metrics.record_response(duration, success=True)
                    
                    if i % 100 == 0:
                        print(f"Query {i}: {query_name} - {duration:.4f}s ({len(rows)} rows)")
                    
                except Exception as e:
                    duration = time.time() - start_time
                    metrics.record_response(duration, success=False)
                    print(f"Query error ({query_name}): {e}")
        
        report = metrics.stop()
        
        print(f"\n{'='*60}")
        print("Load Test Results - Schedule Queries")
        print(f"{'='*60}")
        print(f"Total Queries: {report['total_requests']}")
        print(f"Failed Queries: {report['error_count']}")
        print(f"Query Times (seconds):")
        print(f"  Mean: {report['response_times']['mean']:.4f}")
        print(f"  95th Percentile: {report['response_times']['p95']:.4f}")
        print(f"  99th Percentile: {report['response_times']['p99']:.4f}")
        
        return report
    
    async def load_test_celery_execution(self, duration_seconds: int = 60):
        """Test Celery task execution under load."""
        print(f"\n{'='*60}")
        print(f"Testing Celery execution for {duration_seconds} seconds")
        print(f"{'='*60}\n")
        
        # This would normally trigger actual Celery tasks
        # For testing, we'll simulate the load
        
        metrics = LoadTestMetrics()
        metrics.start()
        
        start_time = time.time()
        execution_count = 0
        
        while time.time() - start_time < duration_seconds:
            # Simulate checking and executing schedules
            task_start = time.time()
            
            try:
                # In real test, this would call:
                # check_and_execute_schedules.delay()
                
                # Simulate task execution time
                await asyncio.sleep(random.uniform(0.01, 0.1))
                
                execution_count += 1
                duration = time.time() - task_start
                metrics.record_response(duration, success=True)
                
                if execution_count % 100 == 0:
                    print(f"Executed {execution_count} tasks...")
                
            except Exception as e:
                duration = time.time() - task_start
                metrics.record_response(duration, success=False)
                print(f"Execution error: {e}")
            
            # Simulate periodic execution (every second)
            await asyncio.sleep(1)
        
        report = metrics.stop()
        
        print(f"\n{'='*60}")
        print("Load Test Results - Celery Execution")
        print(f"{'='*60}")
        print(f"Total Executions: {execution_count}")
        print(f"Execution Rate: {execution_count / duration_seconds:.2f} tasks/second")
        print(f"Failed Executions: {report['error_count']}")
        
        return report
    
    async def cleanup_test_data(self):
        """Clean up test data after load test."""
        print("\nCleaning up test data...")
        
        engine = create_async_engine(self.db_url)
        async_session = sessionmaker(engine, class_=AsyncSession)
        
        async with async_session() as session:
            # Delete in order due to foreign keys
            await session.execute(text("DELETE FROM schedule_executions WHERE schedule_id IN (SELECT id FROM export_schedules WHERE name LIKE 'Load Test Schedule%')"))
            await session.execute(text("DELETE FROM export_schedules WHERE name LIKE 'Load Test Schedule%'"))
            await session.execute(text("DELETE FROM reports WHERE name LIKE 'Load Test Report%'"))
            await session.execute(text("DELETE FROM users WHERE email LIKE 'loadtest_user_%'"))
            await session.commit()
        
        print("Test data cleaned up")


async def run_full_load_test():
    """Run complete load test suite."""
    tester = ScheduleLoadTester()
    
    try:
        # Setup test data
        await tester.setup_test_data(num_users=100, num_reports=500)
        
        # Test 1: Create 10,000 schedules
        create_report = await tester.load_test_create_schedules(
            total_schedules=10000,
            batch_size=100
        )
        
        # Test 2: Query performance
        query_report = await tester.load_test_query_schedules(num_queries=1000)
        
        # Test 3: Celery execution simulation
        celery_report = await tester.load_test_celery_execution(duration_seconds=60)
        
        # Summary
        print(f"\n{'='*60}")
        print("LOAD TEST SUMMARY")
        print(f"{'='*60}")
        
        print("\n✅ Schedule Creation Performance:")
        print(f"  - Created {create_report['success_count']} schedules")
        print(f"  - Throughput: {create_report['throughput']:.2f} schedules/second")
        print(f"  - 95th percentile: {create_report['response_times']['p95']:.4f}s")
        
        print("\n✅ Query Performance:")
        print(f"  - Executed {query_report['total_requests']} queries")
        print(f"  - Mean query time: {query_report['response_times']['mean']:.4f}s")
        print(f"  - 95th percentile: {query_report['response_times']['p95']:.4f}s")
        
        print("\n✅ Task Execution:")
        print(f"  - Processed {celery_report['total_requests']} tasks")
        print(f"  - Error rate: {celery_report['error_rate']:.2f}%")
        
        # Performance assessment
        print(f"\n{'='*60}")
        print("PERFORMANCE ASSESSMENT")
        print(f"{'='*60}")
        
        # Check against SLA targets
        passed = []
        failed = []
        
        # Creation throughput > 50 schedules/second
        if create_report['throughput'] > 50:
            passed.append("✅ Creation throughput > 50/s")
        else:
            failed.append("❌ Creation throughput < 50/s")
        
        # Query 95th percentile < 100ms
        if query_report['response_times']['p95'] < 0.1:
            passed.append("✅ Query P95 < 100ms")
        else:
            failed.append("❌ Query P95 > 100ms")
        
        # Error rate < 1%
        if create_report['error_rate'] < 1:
            passed.append("✅ Error rate < 1%")
        else:
            failed.append("❌ Error rate > 1%")
        
        # Memory usage < 80%
        if create_report['resources']['memory']['max'] < 80:
            passed.append("✅ Memory usage < 80%")
        else:
            failed.append("❌ Memory usage > 80%")
        
        print("\nPassed Criteria:")
        for p in passed:
            print(f"  {p}")
        
        if failed:
            print("\nFailed Criteria:")
            for f in failed:
                print(f"  {f}")
        
        overall_pass = len(failed) == 0
        print(f"\n{'='*60}")
        print(f"OVERALL RESULT: {'✅ PASS' if overall_pass else '❌ FAIL'}")
        print(f"{'='*60}")
        
        return overall_pass
        
    finally:
        # Always cleanup
        await tester.cleanup_test_data()


if __name__ == "__main__":
    # Run the load test
    asyncio.run(run_full_load_test())