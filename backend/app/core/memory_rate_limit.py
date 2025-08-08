"""
In-memory rate limiter as fallback when Redis is unavailable
Uses a simple token bucket algorithm
"""

import time
from typing import Dict, Tuple
from collections import defaultdict, deque
from threading import Lock
import logging

logger = logging.getLogger(__name__)


class InMemoryRateLimiter:
    """
    Simple in-memory rate limiter as fallback when Redis is unavailable
    Uses a sliding window approach with token bucket
    """
    
    def __init__(self, default_limit: int = 60, window_seconds: int = 60):
        """
        Initialize in-memory rate limiter
        
        Args:
            default_limit: Default number of requests allowed per window
            window_seconds: Time window in seconds
        """
        self.default_limit = default_limit
        self.window_seconds = window_seconds
        self.requests = defaultdict(deque)  # key -> deque of timestamps
        self.lock = Lock()
        self.last_cleanup = time.time()
        
    def check_rate_limit(
        self, 
        key: str, 
        limit: int = None, 
        window: int = None
    ) -> Tuple[bool, int]:
        """
        Check if request is within rate limit
        
        Args:
            key: Identifier (IP, user ID, etc.)
            limit: Maximum requests (uses default if None)
            window: Time window in seconds (uses default if None)
            
        Returns:
            Tuple of (is_allowed, remaining_requests)
        """
        limit = limit or self.default_limit
        window = window or self.window_seconds
        current_time = time.time()
        
        with self.lock:
            # Clean up old entries periodically
            if current_time - self.last_cleanup > 60:
                self._cleanup()
                self.last_cleanup = current_time
            
            # Get request history for this key
            request_times = self.requests[key]
            
            # Remove old requests outside the window
            cutoff = current_time - window
            while request_times and request_times[0] < cutoff:
                request_times.popleft()
            
            # Check if under limit
            current_count = len(request_times)
            is_allowed = current_count < limit
            
            if is_allowed:
                # Add current request
                request_times.append(current_time)
                remaining = limit - current_count - 1
            else:
                remaining = 0
            
            return is_allowed, remaining
    
    def _cleanup(self):
        """
        Clean up old entries to prevent memory leak
        Should be called periodically
        """
        current_time = time.time()
        max_window = max(60, self.window_seconds)  # Keep at least 60 seconds
        cutoff = current_time - max_window
        
        # Remove keys with no recent requests
        keys_to_remove = []
        for key, times in self.requests.items():
            # Remove old timestamps
            while times and times[0] < cutoff:
                times.popleft()
            
            # Mark empty keys for removal
            if not times:
                keys_to_remove.append(key)
        
        # Remove empty keys
        for key in keys_to_remove:
            del self.requests[key]
        
        logger.debug(f"Cleaned up {len(keys_to_remove)} expired rate limit keys")
    
    def reset(self, key: str = None):
        """
        Reset rate limit for a specific key or all keys
        
        Args:
            key: Specific key to reset, or None to reset all
        """
        with self.lock:
            if key:
                self.requests[key].clear()
            else:
                self.requests.clear()
    
    def get_stats(self) -> Dict:
        """
        Get statistics about current rate limiting state
        
        Returns:
            Dictionary with statistics
        """
        with self.lock:
            total_keys = len(self.requests)
            total_requests = sum(len(times) for times in self.requests.values())
            
            return {
                "total_keys": total_keys,
                "total_requests": total_requests,
                "memory_usage_estimate": total_keys * 100 + total_requests * 8  # Rough bytes estimate
            }


# Global instance for fallback
_fallback_limiter = None


def get_fallback_limiter() -> InMemoryRateLimiter:
    """
    Get or create the global fallback rate limiter
    
    Returns:
        InMemoryRateLimiter instance
    """
    global _fallback_limiter
    if _fallback_limiter is None:
        _fallback_limiter = InMemoryRateLimiter()
    return _fallback_limiter