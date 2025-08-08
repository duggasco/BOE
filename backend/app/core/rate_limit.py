"""
Rate Limiting Configuration
Uses slowapi for application-level rate limiting
"""

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from typing import Optional, Callable
import redis.asyncio as redis
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


# Custom key function that can use user ID for authenticated endpoints
async def get_rate_limit_key(request: Request) -> str:
    """
    Generate rate limit key based on authentication status
    
    For authenticated users: user_id
    For anonymous users: IP address
    """
    # Try to get user from request state (set by auth middleware)
    if hasattr(request.state, "user") and request.state.user:
        return f"user:{request.state.user.id}"
    
    # Fall back to IP address
    return get_remote_address(request)


# Create limiter with Redis storage for distributed rate limiting
def create_limiter() -> Limiter:
    """
    Create a limiter instance with Redis backend
    """
    # Redis URL from settings
    storage_uri = settings.REDIS_URL.replace("redis://", "redis+async://")
    
    limiter = Limiter(
        key_func=get_rate_limit_key,
        default_limits=["1000 per hour", "100 per minute"],  # Global defaults
        storage_uri=storage_uri,
        strategy="fixed-window",  # or "moving-window" for more accuracy
        swallow_errors=False,  # Fail closed for security - we have fallback
    )
    
    return limiter


# Create global limiter instance
limiter = create_limiter()


# Custom error handler for rate limit exceeded
async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> Response:
    """
    Custom handler for rate limit exceeded errors
    """
    response = JSONResponse(
        status_code=429,
        content={
            "error": "rate_limit_exceeded",
            "message": f"Rate limit exceeded: {exc.detail}",
            "retry_after": exc.retry_after if hasattr(exc, 'retry_after') else 60
        }
    )
    
    # Add rate limit headers
    response.headers["Retry-After"] = str(exc.retry_after if hasattr(exc, 'retry_after') else 60)
    response.headers["X-RateLimit-Limit"] = str(exc.limit)
    response.headers["X-RateLimit-Remaining"] = "0"
    response.headers["X-RateLimit-Reset"] = str(exc.reset)
    
    return response


# Rate limit decorators for different endpoint types
class RateLimits:
    """
    Predefined rate limits for different endpoint types
    """
    
    # Authentication endpoints - strict limits to prevent brute force
    AUTH_LOGIN = "5 per minute, 20 per hour"
    AUTH_REGISTER = "3 per minute, 10 per hour"
    AUTH_PASSWORD_RESET = "3 per minute, 10 per hour"
    
    # API endpoints - moderate limits
    API_STANDARD = "60 per minute, 1000 per hour"
    API_SEARCH = "30 per minute, 500 per hour"
    
    # Resource-intensive endpoints - strict limits
    EXPORT = "5 per minute, 50 per hour"
    REPORT_EXECUTION = "10 per minute, 100 per hour"
    BULK_OPERATION = "5 per minute, 20 per hour"
    
    # Admin endpoints - relaxed limits
    ADMIN = "100 per minute, 2000 per hour"
    
    # Public endpoints - very strict limits
    PUBLIC = "10 per minute, 100 per hour"


# Utility functions for dynamic rate limiting
class DynamicRateLimiter:
    """
    Dynamic rate limiting based on user roles and subscription tiers
    """
    
    @staticmethod
    def get_user_rate_limit(user) -> str:
        """
        Get rate limit based on user role/subscription
        """
        if not user:
            return RateLimits.PUBLIC
        
        if user.is_superuser:
            return "1000 per minute"  # Essentially unlimited
        
        # Check user subscription/role
        # This is a placeholder - implement based on your business logic
        if hasattr(user, 'subscription_tier'):
            tier_limits = {
                'free': "30 per minute, 500 per hour",
                'basic': "60 per minute, 1000 per hour",
                'premium': "120 per minute, 2000 per hour",
                'enterprise': "500 per minute, 10000 per hour"
            }
            return tier_limits.get(user.subscription_tier, RateLimits.API_STANDARD)
        
        return RateLimits.API_STANDARD
    
    @staticmethod
    async def check_user_quota(user, resource_type: str) -> bool:
        """
        Check if user has quota remaining for specific resource
        
        Args:
            user: User object
            resource_type: Type of resource (e.g., 'exports', 'reports')
            
        Returns:
            True if user has quota, False otherwise
        """
        # This would check against a database or Redis for user-specific quotas
        # Placeholder implementation
        return True


# IP-based rate limiting for additional security
class IPRateLimiter:
    """
    IP-based rate limiting to prevent abuse
    """
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.prefix = "ip_rate:"
    
    async def check_ip_limit(
        self, 
        ip_address: str, 
        limit: int = 100, 
        window: int = 60
    ) -> tuple[bool, int]:
        """
        Check if IP has exceeded rate limit
        
        Args:
            ip_address: IP address to check
            limit: Maximum requests allowed
            window: Time window in seconds
            
        Returns:
            Tuple of (is_allowed, remaining_requests)
        """
        key = f"{self.prefix}{ip_address}"
        
        try:
            # Increment counter
            current = await self.redis.incr(key)
            
            # Set expiration on first request
            if current == 1:
                await self.redis.expire(key, window)
            
            # Check limit
            is_allowed = current <= limit
            remaining = max(0, limit - current)
            
            return is_allowed, remaining
            
        except Exception as e:
            logger.error(f"Error checking IP rate limit: {e}")
            # On error, allow the request but log it
            return True, limit
    
    async def block_ip(self, ip_address: str, duration: int = 3600):
        """
        Temporarily block an IP address
        
        Args:
            ip_address: IP to block
            duration: Block duration in seconds
        """
        key = f"blocked_ip:{ip_address}"
        await self.redis.setex(key, duration, "blocked")
    
    async def is_ip_blocked(self, ip_address: str) -> bool:
        """
        Check if IP is blocked
        """
        key = f"blocked_ip:{ip_address}"
        return await self.redis.exists(key) > 0


# Middleware for advanced rate limiting
class AdvancedRateLimitMiddleware:
    """
    Advanced rate limiting middleware with multiple strategies
    Includes fallback to in-memory limiting when Redis is unavailable
    """
    
    def __init__(self, redis_client: redis.Redis = None):
        self.redis_client = redis_client
        self.ip_limiter = IPRateLimiter(redis_client) if redis_client else None
        self.redis_available = redis_client is not None
        # Import fallback limiter
        from app.core.memory_rate_limit import get_fallback_limiter
        self.fallback_limiter = get_fallback_limiter()
    
    async def __call__(self, request: Request, call_next):
        """
        Process request through rate limiting with fallback
        """
        # Get client IP
        client_ip = get_remote_address(request)
        
        # Try Redis-based rate limiting first
        if self.redis_available and self.ip_limiter:
            try:
                # Check if IP is blocked
                if await self.ip_limiter.is_ip_blocked(client_ip):
                    return JSONResponse(
                        status_code=403,
                        content={"error": "ip_blocked", "message": "Your IP has been temporarily blocked"}
                    )
                
                # Check IP rate limit
                is_allowed, remaining = await self.ip_limiter.check_ip_limit(client_ip)
                
                if not is_allowed:
                    # Block IP if it exceeds limits repeatedly
                    await self.ip_limiter.block_ip(client_ip, duration=300)  # 5 minutes
                    
                    return JSONResponse(
                        status_code=429,
                        content={
                            "error": "rate_limit_exceeded",
                            "message": "Too many requests from this IP"
                        },
                        headers={"Retry-After": "300"}
                    )
            except Exception as e:
                logger.error(f"Redis rate limiting failed, using fallback: {e}")
                self.redis_available = False  # Mark Redis as unavailable
        
        # Fallback to in-memory rate limiting if Redis fails
        if not self.redis_available:
            is_allowed, remaining = self.fallback_limiter.check_rate_limit(
                client_ip,
                limit=100,  # Stricter limit for fallback
                window=60
            )
            
            if not is_allowed:
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": "rate_limit_exceeded",
                        "message": "Too many requests (fallback mode)"
                    },
                    headers={"Retry-After": "60"}
                )
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        if not self.redis_available:
            response.headers["X-RateLimit-Mode"] = "fallback"
        
        return response


# Example usage in endpoints
"""
from app.core.rate_limit import limiter, RateLimits

@router.post("/login")
@limiter.limit(RateLimits.AUTH_LOGIN)
async def login(request: Request, ...):
    ...

@router.get("/reports")
@limiter.limit(RateLimits.API_STANDARD)
async def list_reports(request: Request, ...):
    ...

@router.post("/export")
@limiter.limit(RateLimits.EXPORT)
async def export_report(request: Request, ...):
    ...
"""