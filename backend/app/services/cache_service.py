"""
Caching service for improving performance of frequently accessed data
"""

import json
import logging
from typing import Optional, Any, Dict, List, Callable
from datetime import datetime, timedelta
import hashlib
import redis.asyncio as redis
from functools import wraps

from app.core.config import settings

logger = logging.getLogger(__name__)


class CacheService:
    """Service for caching frequently accessed data with Redis"""
    
    def __init__(self):
        self._redis_client = None
        self._local_cache = {}  # Fallback in-memory cache
        self._cache_stats = {
            'hits': 0,
            'misses': 0,
            'errors': 0
        }
    
    async def _get_redis(self):
        """Get or create Redis connection"""
        if not self._redis_client:
            try:
                self._redis_client = await redis.from_url(
                    settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=True
                )
            except Exception as e:
                logger.error(f"Redis connection failed for cache: {e}")
                return None
        return self._redis_client
    
    def _generate_cache_key(self, prefix: str, params: Dict[str, Any]) -> str:
        """Generate a cache key from prefix and parameters"""
        # Sort params for consistent key generation
        sorted_params = sorted(params.items())
        param_str = json.dumps(sorted_params, sort_keys=True, default=str)
        
        # Create hash for long parameter strings
        if len(param_str) > 200:
            param_hash = hashlib.md5(param_str.encode()).hexdigest()
            return f"{prefix}:{param_hash}"
        
        return f"{prefix}:{param_str}"
    
    async def get(
        self, 
        key: str, 
        default: Any = None,
        deserialize: bool = True
    ) -> Any:
        """Get value from cache"""
        client = await self._get_redis()
        
        try:
            if client:
                value = await client.get(key)
                if value is not None:
                    self._cache_stats['hits'] += 1
                    return json.loads(value) if deserialize else value
            else:
                # Fallback to local cache
                if key in self._local_cache:
                    entry = self._local_cache[key]
                    if entry['expires'] > datetime.utcnow():
                        self._cache_stats['hits'] += 1
                        return entry['value']
                    else:
                        del self._local_cache[key]
            
            self._cache_stats['misses'] += 1
            return default
            
        except Exception as e:
            logger.error(f"Cache get error for key {key}: {e}")
            self._cache_stats['errors'] += 1
            return default
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl: int = 300,  # Default 5 minutes
        serialize: bool = True
    ) -> bool:
        """Set value in cache with TTL"""
        client = await self._get_redis()
        
        try:
            value_str = json.dumps(value, default=str) if serialize else value
            
            if client:
                await client.setex(key, ttl, value_str)
            else:
                # Fallback to local cache
                self._local_cache[key] = {
                    'value': value,
                    'expires': datetime.utcnow() + timedelta(seconds=ttl)
                }
                
                # Limit local cache size
                if len(self._local_cache) > 1000:
                    # Remove expired entries
                    now = datetime.utcnow()
                    expired_keys = [
                        k for k, v in self._local_cache.items()
                        if v['expires'] < now
                    ]
                    for k in expired_keys:
                        del self._local_cache[k]
            
            return True
            
        except Exception as e:
            logger.error(f"Cache set error for key {key}: {e}")
            self._cache_stats['errors'] += 1
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete value from cache"""
        client = await self._get_redis()
        
        try:
            if client:
                await client.delete(key)
            
            if key in self._local_cache:
                del self._local_cache[key]
            
            return True
            
        except Exception as e:
            logger.error(f"Cache delete error for key {key}: {e}")
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern"""
        client = await self._get_redis()
        deleted = 0
        
        try:
            if client:
                # Use SCAN instead of KEYS for production safety
                cursor = 0
                while True:
                    cursor, keys = await client.scan(
                        cursor, 
                        match=pattern,
                        count=100
                    )
                    if keys:
                        deleted += await client.delete(*keys)
                    if cursor == 0:
                        break
            
            # Also clear from local cache
            pattern_prefix = pattern.replace('*', '')
            local_deleted = [
                k for k in self._local_cache.keys()
                if k.startswith(pattern_prefix)
            ]
            for k in local_deleted:
                del self._local_cache[k]
                deleted += 1
            
            return deleted
            
        except Exception as e:
            logger.error(f"Cache delete pattern error for {pattern}: {e}")
            return 0
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total = self._cache_stats['hits'] + self._cache_stats['misses']
        hit_rate = (
            (self._cache_stats['hits'] / total * 100) if total > 0 else 0
        )
        
        return {
            'hits': self._cache_stats['hits'],
            'misses': self._cache_stats['misses'],
            'errors': self._cache_stats['errors'],
            'hit_rate': round(hit_rate, 2),
            'local_cache_size': len(self._local_cache)
        }
    
    def cache_result(
        self,
        prefix: str,
        ttl: int = 300,
        key_params: Optional[List[str]] = None
    ):
        """Decorator for caching function results"""
        def decorator(func: Callable):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                # Generate cache key
                cache_params = {}
                if key_params:
                    for param in key_params:
                        if param in kwargs:
                            cache_params[param] = kwargs[param]
                
                cache_key = self._generate_cache_key(prefix, cache_params)
                
                # Try to get from cache
                cached_value = await self.get(cache_key)
                if cached_value is not None:
                    return cached_value
                
                # Execute function
                result = await func(*args, **kwargs)
                
                # Cache result
                await self.set(cache_key, result, ttl)
                
                return result
            
            return wrapper
        return decorator


# Specific cache services for different domains
class ScheduleCacheService(CacheService):
    """Specialized cache service for schedule data"""
    
    async def cache_schedule_list(
        self,
        user_id: str,
        skip: int,
        limit: int,
        schedules: List[Dict[str, Any]],
        total: int
    ):
        """Cache paginated schedule list"""
        cache_key = f"schedules:list:{user_id}:{skip}:{limit}"
        await self.set(
            cache_key,
            {'schedules': schedules, 'total': total},
            ttl=60  # 1 minute cache for list views
        )
    
    async def get_cached_schedule_list(
        self,
        user_id: str,
        skip: int,
        limit: int
    ) -> Optional[Dict[str, Any]]:
        """Get cached schedule list"""
        cache_key = f"schedules:list:{user_id}:{skip}:{limit}"
        return await self.get(cache_key)
    
    async def invalidate_user_schedules(self, user_id: str):
        """Invalidate all cached data for a user's schedules"""
        await self.delete_pattern(f"schedules:*:{user_id}:*")
    
    async def cache_schedule_stats(
        self,
        user_id: str,
        stats: Dict[str, Any]
    ):
        """Cache schedule statistics"""
        cache_key = f"schedules:stats:{user_id}"
        await self.set(cache_key, stats, ttl=120)  # 2 minute cache
    
    async def get_cached_schedule_stats(
        self,
        user_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get cached schedule statistics"""
        cache_key = f"schedules:stats:{user_id}"
        return await self.get(cache_key)


class MonitoringCacheService(CacheService):
    """Specialized cache service for monitoring data"""
    
    async def cache_metrics(
        self,
        metric_type: str,
        time_range: str,
        data: Dict[str, Any]
    ):
        """Cache monitoring metrics"""
        cache_key = f"monitoring:{metric_type}:{time_range}"
        
        # Different TTL based on time range
        ttl_map = {
            'realtime': 10,  # 10 seconds for real-time
            'hour': 60,      # 1 minute for hourly
            'day': 300,      # 5 minutes for daily
            'week': 600,     # 10 minutes for weekly
            'month': 1800    # 30 minutes for monthly
        }
        
        ttl = ttl_map.get(time_range, 60)
        await self.set(cache_key, data, ttl=ttl)
    
    async def get_cached_metrics(
        self,
        metric_type: str,
        time_range: str
    ) -> Optional[Dict[str, Any]]:
        """Get cached monitoring metrics"""
        cache_key = f"monitoring:{metric_type}:{time_range}"
        return await self.get(cache_key)


# Global instances
cache_service = CacheService()
schedule_cache = ScheduleCacheService()
monitoring_cache = MonitoringCacheService()