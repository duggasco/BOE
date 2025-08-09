"""
Enhanced Cache Service with Proper Key Design
Implements Gemini's caching recommendations
"""

import json
import hashlib
from typing import Any, Dict, Optional, List
from datetime import datetime, timedelta
import redis
from functools import wraps
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class EnhancedCacheService:
    """
    Production-ready caching service with:
    - Proper cache key design including pagination
    - Cache-aside pattern implementation
    - Graceful Redis failure handling
    - Comprehensive cache invalidation
    """
    
    def __init__(self):
        try:
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            # Test connection
            self.redis_client.ping()
            self.available = True
            logger.info("Cache service initialized successfully")
        except redis.RedisError as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self.redis_client = None
            self.available = False
    
    def _generate_cache_key(self, prefix: str, **params) -> str:
        """
        Generate consistent cache key from parameters
        Per Gemini: Include ALL relevant parameters in cache key
        """
        # Sort params for consistent key generation
        sorted_params = sorted(params.items())
        param_str = ":".join([f"{k}:{v}" for k, v in sorted_params if v is not None])
        return f"{prefix}:{param_str}"
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache with graceful failure
        """
        if not self.available:
            return None
        
        try:
            value = self.redis_client.get(key)
            if value:
                return json.loads(value)
            return None
        except (redis.RedisError, json.JSONDecodeError) as e:
            logger.error(f"Cache get failed for {key}: {e}")
            return None
    
    def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """
        Set value in cache with TTL
        """
        if not self.available:
            return False
        
        try:
            serialized = json.dumps(value, default=str)
            self.redis_client.setex(key, ttl, serialized)
            return True
        except (redis.RedisError, json.JSONEncodeError) as e:
            logger.error(f"Cache set failed for {key}: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """
        Delete specific cache key
        """
        if not self.available:
            return False
        
        try:
            self.redis_client.delete(key)
            return True
        except redis.RedisError as e:
            logger.error(f"Cache delete failed for {key}: {e}")
            return False
    
    def delete_pattern(self, pattern: str) -> int:
        """
        Delete all keys matching pattern
        Per Gemini: Use SCAN instead of KEYS for production
        """
        if not self.available:
            return 0
        
        try:
            deleted = 0
            # Use SCAN for production-safe pattern deletion
            cursor = 0
            while True:
                cursor, keys = self.redis_client.scan(
                    cursor, match=pattern, count=100
                )
                if keys:
                    deleted += self.redis_client.delete(*keys)
                if cursor == 0:
                    break
            return deleted
        except redis.RedisError as e:
            logger.error(f"Cache delete pattern failed for {pattern}: {e}")
            return 0
    
    # Schedule-specific cache methods
    
    def get_schedules_list(
        self,
        user_id: str,
        is_active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 10
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached schedule list with proper pagination
        Per Gemini: Include skip and limit in cache key
        """
        key = self._generate_cache_key(
            "schedules:list",
            user_id=user_id,
            is_active=is_active,
            skip=skip,
            limit=limit
        )
        return self.get(key)
    
    def set_schedules_list(
        self,
        user_id: str,
        is_active: Optional[bool],
        skip: int,
        limit: int,
        data: Dict[str, Any],
        ttl: int = 60  # Short TTL for list views
    ) -> bool:
        """
        Cache schedule list with pagination
        """
        key = self._generate_cache_key(
            "schedules:list",
            user_id=user_id,
            is_active=is_active,
            skip=skip,
            limit=limit
        )
        return self.set(key, data, ttl)
    
    def get_schedule(self, schedule_id: str) -> Optional[Dict[str, Any]]:
        """
        Get cached individual schedule
        """
        key = f"schedule:id:{schedule_id}"
        return self.get(key)
    
    def set_schedule(
        self,
        schedule_id: str,
        data: Dict[str, Any],
        ttl: int = 300  # 5 minutes for individual objects
    ) -> bool:
        """
        Cache individual schedule
        """
        key = f"schedule:id:{schedule_id}"
        return self.set(key, data, ttl)
    
    def get_execution_history(
        self,
        schedule_id: str,
        skip: int,
        limit: int,
        status: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached execution history with pagination
        """
        key = self._generate_cache_key(
            "executions:schedule",
            schedule_id=schedule_id,
            status=status,
            skip=skip,
            limit=limit
        )
        return self.get(key)
    
    def set_execution_history(
        self,
        schedule_id: str,
        skip: int,
        limit: int,
        status: Optional[str],
        data: Dict[str, Any],
        ttl: int = 30  # Very short TTL for real-time monitoring
    ) -> bool:
        """
        Cache execution history
        Per Gemini: Short TTL for real-time monitoring data
        """
        key = self._generate_cache_key(
            "executions:schedule",
            schedule_id=schedule_id,
            status=status,
            skip=skip,
            limit=limit
        )
        return self.set(key, data, ttl)
    
    def invalidate_schedule_caches(self, schedule_id: str, user_id: str):
        """
        Invalidate all caches related to a schedule
        Per Gemini: Comprehensive cache invalidation on data change
        """
        # Delete specific schedule cache
        self.delete(f"schedule:id:{schedule_id}")
        
        # Delete all list caches for the user
        self.delete_pattern(f"schedules:list:user_id:{user_id}:*")
        
        # Delete execution history for this schedule
        self.delete_pattern(f"executions:schedule:schedule_id:{schedule_id}:*")
        
        logger.info(f"Invalidated caches for schedule {schedule_id}")
    
    def invalidate_user_schedule_caches(self, user_id: str):
        """
        Invalidate all schedule-related caches for a user
        """
        # Delete all list caches for the user
        self.delete_pattern(f"schedules:list:user_id:{user_id}:*")
        
        # Note: Individual schedule caches remain as they might be accessed by ID
        logger.info(f"Invalidated schedule list caches for user {user_id}")
    
    def get_monitoring_metrics(self, metric_type: str, window: str) -> Optional[Dict[str, Any]]:
        """
        Get cached monitoring metrics
        """
        key = f"metrics:{metric_type}:{window}"
        return self.get(key)
    
    def set_monitoring_metrics(
        self,
        metric_type: str,
        window: str,
        data: Dict[str, Any],
        ttl: int = 60  # 1 minute for monitoring metrics
    ) -> bool:
        """
        Cache monitoring metrics with short TTL
        """
        key = f"metrics:{metric_type}:{window}"
        return self.set(key, data, ttl)
    
    def increment_counter(self, key: str, amount: int = 1) -> Optional[int]:
        """
        Atomic counter increment for metrics
        """
        if not self.available:
            return None
        
        try:
            return self.redis_client.incrby(key, amount)
        except redis.RedisError as e:
            logger.error(f"Counter increment failed for {key}: {e}")
            return None
    
    def get_counter(self, key: str) -> Optional[int]:
        """
        Get counter value
        """
        if not self.available:
            return None
        
        try:
            value = self.redis_client.get(key)
            return int(value) if value else 0
        except (redis.RedisError, ValueError) as e:
            logger.error(f"Get counter failed for {key}: {e}")
            return None


# Global instance
enhanced_cache = EnhancedCacheService()


def cache_aside(
    prefix: str,
    ttl: int = 300,
    include_params: List[str] = None
):
    """
    Decorator implementing cache-aside pattern
    Per Gemini: Check cache first, fetch from source if miss
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Build cache key from specified parameters
            cache_params = {}
            if include_params:
                for param in include_params:
                    if param in kwargs:
                        cache_params[param] = kwargs[param]
            
            cache_key = enhanced_cache._generate_cache_key(prefix, **cache_params)
            
            # Try cache first
            cached = enhanced_cache.get(cache_key)
            if cached is not None:
                logger.debug(f"Cache hit for {cache_key}")
                return cached
            
            # Cache miss, fetch from source
            logger.debug(f"Cache miss for {cache_key}")
            result = await func(*args, **kwargs)
            
            # Store in cache
            enhanced_cache.set(cache_key, result, ttl)
            
            return result
        return wrapper
    return decorator


def invalidate_on_change(*cache_patterns: str):
    """
    Decorator to invalidate cache patterns after successful operation
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            result = await func(*args, **kwargs)
            
            # Invalidate specified cache patterns
            for pattern in cache_patterns:
                deleted = enhanced_cache.delete_pattern(pattern)
                logger.debug(f"Invalidated {deleted} cache entries matching {pattern}")
            
            return result
        return wrapper
    return decorator