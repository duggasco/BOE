"""
Dead Letter Queue service for managing failed tasks
"""

import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import redis.asyncio as redis

from app.core.config import settings
from app.core.celery_app import celery_app

logger = logging.getLogger(__name__)


class DeadLetterQueueService:
    """Service for managing dead letter queue tasks"""
    
    def __init__(self):
        self._redis_client = None
    
    async def _get_redis(self):
        """Get or create Redis connection"""
        if not self._redis_client:
            self._redis_client = await redis.from_url(settings.REDIS_URL)
        return self._redis_client
    
    async def get_failed_tasks(
        self,
        limit: int = 100,
        offset: int = 0,
        task_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get failed tasks from the dead letter queue"""
        client = await self._get_redis()
        
        # Get task IDs from sorted set
        if task_name:
            # Get task IDs for specific task name
            task_ids = await client.smembers(f'celery:dlq:by_name:{task_name}')
            task_ids = list(task_ids)[:limit]
        else:
            # Get most recent task IDs
            task_ids = await client.zrevrange('celery:dlq:by_time', offset, offset + limit - 1)
        
        failed_tasks = []
        for task_id in task_ids:
            task_id_str = task_id.decode() if isinstance(task_id, bytes) else task_id
            task_data = await client.hgetall(f'celery:dlq:task:{task_id_str}')
            
            if task_data:
                # Convert bytes to strings
                task = {k.decode() if isinstance(k, bytes) else k: 
                       v.decode() if isinstance(v, bytes) else v 
                       for k, v in task_data.items()}
                
                # Parse JSON fields
                for field in ['args', 'kwargs']:
                    if field in task:
                        try:
                            task[field] = json.loads(task[field])
                        except:
                            pass
                
                failed_tasks.append(task)
        
        return failed_tasks
    
    async def get_failed_task_count(self) -> int:
        """Get total count of failed tasks"""
        client = await self._get_redis()
        return await client.zcard('celery:dlq:by_time')
    
    async def requeue_task(self, task_id: str) -> bool:
        """Requeue a failed task for retry"""
        client = await self._get_redis()
        
        # Get task data from hash
        task_data = await client.hgetall(f'celery:dlq:task:{task_id}')
        
        if not task_data:
            logger.error(f"Task {task_id} not found in DLQ")
            return False
        
        try:
            # Convert bytes to strings and parse
            task = {k.decode() if isinstance(k, bytes) else k: 
                   v.decode() if isinstance(v, bytes) else v 
                   for k, v in task_data.items()}
            
            # Parse JSON fields
            args = json.loads(task.get('args', '[]'))
            kwargs = json.loads(task.get('kwargs', '{}'))
            
            # Requeue the task
            task_func = celery_app.tasks.get(task['task_name'])
            if task_func:
                task_func.apply_async(
                    args=args,
                    kwargs=kwargs,
                    task_id=task_id
                )
                
                # Remove from DLQ
                await client.delete(f'celery:dlq:task:{task_id}')
                await client.zrem('celery:dlq:by_time', task_id)
                await client.srem(f'celery:dlq:by_name:{task["task_name"]}', task_id)
                
                logger.info(f"Requeued task {task_id} from DLQ")
                return True
            else:
                logger.error(f"Task {task['task_name']} not found in Celery registry")
                return False
                
        except Exception as e:
            logger.error(f"Error requeuing task {task_id}: {e}")
            return False
    
    async def requeue_all_tasks(self, task_name: Optional[str] = None) -> int:
        """Requeue all failed tasks, optionally filtered by task name"""
        tasks = await self.get_failed_tasks(limit=1000, task_name=task_name)
        
        requeued_count = 0
        for task in tasks:
            if await self.requeue_task(task['task_id']):
                requeued_count += 1
        
        return requeued_count
    
    async def clear_old_tasks(self, days: int = 30) -> int:
        """Clear tasks older than specified days from DLQ"""
        client = await self._get_redis()
        
        cutoff_time = datetime.utcnow() - timedelta(days=days)
        cutoff_timestamp = cutoff_time.timestamp()
        
        # Get old task IDs from sorted set
        old_task_ids = await client.zrangebyscore(
            'celery:dlq:by_time',
            0,
            cutoff_timestamp
        )
        
        if not old_task_ids:
            return 0
        
        # Remove from sorted set
        await client.zremrangebyscore('celery:dlq:by_time', 0, cutoff_timestamp)
        
        # Delete task data and remove from name sets
        for task_id in old_task_ids:
            task_id_str = task_id.decode() if isinstance(task_id, bytes) else task_id
            
            # Get task name before deleting
            task_data = await client.hget(f'celery:dlq:task:{task_id_str}', 'task_name')
            if task_data:
                task_name = task_data.decode() if isinstance(task_data, bytes) else task_data
                await client.srem(f'celery:dlq:by_name:{task_name}', task_id_str)
            
            # Delete task hash
            await client.delete(f'celery:dlq:task:{task_id_str}')
        
        logger.info(f"Cleared {len(old_task_ids)} old tasks from DLQ")
        return len(old_task_ids)
    
    async def get_task_details(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get details of a specific failed task"""
        client = await self._get_redis()
        
        tasks = await client.lrange('celery:dlq', 0, -1)
        
        for task_data in tasks:
            try:
                task = json.loads(task_data)
                if task.get('task_id') == task_id:
                    return task
            except json.JSONDecodeError:
                continue
        
        return None
    
    async def get_failure_statistics(self) -> Dict[str, Any]:
        """Get statistics about failed tasks"""
        client = await self._get_redis()
        
        tasks = await self.get_failed_tasks(limit=1000)
        
        # Aggregate statistics
        stats = {
            'total_failed': len(tasks),
            'by_task_name': {},
            'by_hour': {},
            'recent_failures': []
        }
        
        for task in tasks:
            # Count by task name
            task_name = task.get('task_name', 'unknown')
            stats['by_task_name'][task_name] = stats['by_task_name'].get(task_name, 0) + 1
            
            # Count by hour
            try:
                failed_at = datetime.fromisoformat(task.get('failed_at', ''))
                hour_key = failed_at.strftime('%Y-%m-%d %H:00')
                stats['by_hour'][hour_key] = stats['by_hour'].get(hour_key, 0) + 1
            except:
                pass
            
            # Add to recent failures
            if len(stats['recent_failures']) < 10:
                stats['recent_failures'].append({
                    'task_id': task.get('task_id'),
                    'task_name': task.get('task_name'),
                    'error': task.get('error'),
                    'failed_at': task.get('failed_at')
                })
        
        return stats


# Global instance
dlq_service = DeadLetterQueueService()