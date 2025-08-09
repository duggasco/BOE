"""
Enhanced Celery task configuration with error handling and dead letter queue
"""

import logging
from typing import Any, Dict
from celery import Task
from celery.exceptions import MaxRetriesExceededError
import redis.asyncio as redis
from datetime import datetime
import json

from app.core.config import settings

logger = logging.getLogger(__name__)


class ReliableTask(Task):
    """Base task class with enhanced error handling and dead letter queue"""
    
    autoretry_for = (Exception,)
    retry_kwargs = {
        'max_retries': 5,
        'countdown': 60,  # Initial retry delay
    }
    retry_backoff = True  # Exponential backoff
    retry_backoff_max = 600  # Max 10 minutes between retries
    retry_jitter = True  # Add randomness to prevent thundering herd
    
    async def _send_to_dlq(self, task_id: str, args: tuple, kwargs: dict, exc: Exception):
        """Send failed task to dead letter queue with sanitized data"""
        try:
            client = await redis.from_url(settings.REDIS_URL)
            
            # Sanitize sensitive data from args and kwargs
            sanitized_args = self._sanitize_task_data(args)
            sanitized_kwargs = self._sanitize_task_data(kwargs)
            
            dlq_entry = {
                'task_id': task_id,
                'task_name': self.name,
                'args': sanitized_args,  # Sanitized
                'kwargs': sanitized_kwargs,  # Sanitized
                'error': str(exc)[:500],  # Limit error message length
                'failed_at': datetime.utcnow().isoformat(),
                'retries': self.request.retries if self.request else 0
            }
            
            # Store in hash for efficient access
            dlq_key = f'celery:dlq:task:{task_id}'
            await client.hset(dlq_key, mapping=dlq_entry)
            await client.expire(dlq_key, 86400 * 30)  # 30 day TTL
            
            # Add to sorted set for time-based queries
            await client.zadd(
                'celery:dlq:by_time',
                {task_id: datetime.utcnow().timestamp()}
            )
            
            # Add to set by task name for filtering
            await client.sadd(f'celery:dlq:by_name:{self.name}', task_id)
            
            # Keep only last 10000 entries in sorted set
            total = await client.zcard('celery:dlq:by_time')
            if total > 10000:
                # Remove oldest entries
                to_remove = await client.zrange('celery:dlq:by_time', 0, total - 10001)
                if to_remove:
                    await client.zrem('celery:dlq:by_time', *to_remove)
                    # Also remove from hash
                    for tid in to_remove:
                        await client.delete(f'celery:dlq:task:{tid.decode() if isinstance(tid, bytes) else tid}')
            
            logger.error(f"Task {task_id} sent to dead letter queue: {exc}")
            
        except Exception as dlq_error:
            logger.error(f"Failed to send task to DLQ: {dlq_error}")
    
    def _sanitize_task_data(self, data):
        """Recursively sanitize sensitive data from task arguments"""
        sensitive_keys = {'password', 'secret', 'token', 'key', 'credential', 'auth'}
        
        if isinstance(data, dict):
            sanitized = {}
            for key, value in data.items():
                if any(s in key.lower() for s in sensitive_keys):
                    sanitized[key] = '***REDACTED***'
                else:
                    sanitized[key] = self._sanitize_task_data(value)
            return sanitized
        elif isinstance(data, (list, tuple)):
            return [self._sanitize_task_data(item) for item in data]
        elif isinstance(data, str) and len(data) > 100:
            return data[:100] + '...TRUNCATED'
        else:
            return data
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Called when task fails after all retries"""
        super().on_failure(exc, task_id, args, kwargs, einfo)
        
        # Send to dead letter queue using async_to_sync for efficiency
        from asgiref.sync import async_to_sync
        async_to_sync(self._send_to_dlq)(task_id, args, kwargs, exc)
        
        # Send alert for critical tasks
        if hasattr(self, 'critical') and self.critical:
            self._send_alert(task_id, exc)
    
    def _send_alert(self, task_id: str, exc: Exception):
        """Send alert for critical task failures"""
        # In production, this would send to monitoring system
        logger.critical(f"CRITICAL TASK FAILURE: {task_id} - {exc}")


class ScheduleTask(ReliableTask):
    """Task class for schedule-related operations"""
    
    # Schedule tasks are critical
    critical = True
    
    # More aggressive retry for schedules
    retry_kwargs = {
        'max_retries': 10,
        'countdown': 30,  # Start with 30 second retry
    }
    
    def before_start(self, task_id, args, kwargs):
        """Log task start"""
        logger.info(f"Starting schedule task {self.name}[{task_id}] with args={args}")
        super().before_start(task_id, args, kwargs)
    
    def on_success(self, retval, task_id, args, kwargs):
        """Log task success"""
        logger.info(f"Schedule task {self.name}[{task_id}] completed successfully")
        super().on_success(retval, task_id, args, kwargs)


class EmailTask(ReliableTask):
    """Task class for email operations with specific error handling"""
    
    # Email-specific retry configuration
    autoretry_for = (ConnectionError, TimeoutError)
    retry_kwargs = {
        'max_retries': 3,
        'countdown': 120,  # 2 minute initial delay for email
    }
    
    def on_retry(self, exc, task_id, args, kwargs, einfo):
        """Log retry attempts"""
        logger.warning(f"Email task {task_id} retry {self.request.retries}: {exc}")
        super().on_retry(exc, task_id, args, kwargs, einfo)


class ExportTask(ReliableTask):
    """Task class for export operations"""
    
    # Export tasks can be resource intensive
    time_limit = 3600  # 1 hour hard limit
    soft_time_limit = 3000  # 50 minute soft limit
    
    retry_kwargs = {
        'max_retries': 3,
        'countdown': 300,  # 5 minute retry delay
    }
    
    def on_soft_time_limit(self, task_id, args, kwargs):
        """Handle soft time limit exceeded"""
        logger.warning(f"Export task {task_id} approaching time limit")
        # Could implement graceful shutdown here


def get_task_retry_delay(retries: int, base_delay: int = 60) -> int:
    """Calculate exponential backoff delay with jitter"""
    import random
    
    # Exponential backoff: base * 2^retries
    delay = base_delay * (2 ** retries)
    
    # Cap at 10 minutes
    delay = min(delay, 600)
    
    # Add jitter (±20%)
    jitter = random.uniform(0.8, 1.2)
    
    return int(delay * jitter)


class CircuitBreaker:
    """Circuit breaker for external service calls"""
    
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = 'closed'  # closed, open, half-open
    
    def call(self, func, *args, **kwargs):
        """Execute function with circuit breaker protection"""
        if self.state == 'open':
            if self._should_attempt_reset():
                self.state = 'half-open'
            else:
                raise Exception("Circuit breaker is open")
        
        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise e
    
    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to retry"""
        if not self.last_failure_time:
            return True
        
        from datetime import datetime, timedelta
        return datetime.now() - self.last_failure_time > timedelta(seconds=self.recovery_timeout)
    
    def _on_success(self):
        """Reset circuit breaker on success"""
        self.failure_count = 0
        self.state = 'closed'
    
    def _on_failure(self):
        """Handle failure"""
        from datetime import datetime
        
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        
        if self.failure_count >= self.failure_threshold:
            self.state = 'open'
            logger.error(f"Circuit breaker opened after {self.failure_count} failures")


# Global circuit breakers for external services
email_circuit_breaker = CircuitBreaker(failure_threshold=3, recovery_timeout=300)
s3_circuit_breaker = CircuitBreaker(failure_threshold=5, recovery_timeout=180)