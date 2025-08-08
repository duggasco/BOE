"""
Token Blacklist Service
Manages revoked tokens in Redis for secure logout and token invalidation
"""

import redis.asyncio as redis
from datetime import datetime, timedelta
from typing import Optional, Set
import json
import logging
from jose import jwt, JWTError
from app.core.config import settings

logger = logging.getLogger(__name__)


class TokenBlacklistService:
    """
    Service for managing blacklisted tokens in Redis
    Supports both individual token blacklisting and user-wide invalidation
    """
    
    def __init__(self, redis_client: redis.Redis):
        """
        Initialize the token blacklist service
        
        Args:
            redis_client: Async Redis client instance
        """
        self.redis = redis_client
        self.token_prefix = "token:blacklist:"
        self.user_prefix = "user:blacklist:"
        self.refresh_prefix = "refresh:blacklist:"
        
    async def blacklist_access_token(
        self, 
        token: str, 
        exp_timestamp: Optional[int] = None
    ) -> bool:
        """
        Add an access token to the blacklist
        
        Args:
            token: The JWT token to blacklist
            exp_timestamp: Expiration timestamp (if not provided, extracted from token)
            
        Returns:
            True if successfully blacklisted, False otherwise
        """
        try:
            # Extract expiration if not provided - MUST verify signature
            if exp_timestamp is None:
                try:
                    payload = jwt.decode(
                        token, 
                        settings.SECRET_KEY, 
                        algorithms=[settings.ALGORITHM]
                    )
                    exp_timestamp = payload.get("exp")
                except JWTError as e:
                    logger.error(f"Invalid token for blacklisting: {e}")
                    return False
                
            if not exp_timestamp:
                logger.error("Token has no expiration timestamp")
                return False
            
            # Calculate TTL (time to live) for the blacklist entry
            ttl = exp_timestamp - int(datetime.utcnow().timestamp())
            
            if ttl <= 0:
                # Token already expired, no need to blacklist
                logger.info("Token already expired, skipping blacklist")
                return True
            
            # Store in Redis with expiration
            key = f"{self.token_prefix}{token}"
            await self.redis.setex(
                key, 
                ttl, 
                json.dumps({
                    "blacklisted_at": datetime.utcnow().isoformat(),
                    "reason": "manual_logout"
                })
            )
            
            logger.info(f"Token blacklisted with TTL: {ttl} seconds")
            return True
            
        except Exception as e:
            logger.error(f"Failed to blacklist token: {e}")
            return False
    
    async def blacklist_refresh_token(
        self, 
        refresh_token: str,
        exp_timestamp: Optional[int] = None
    ) -> bool:
        """
        Add a refresh token to the blacklist
        Refresh tokens typically have longer expiration times
        
        Args:
            refresh_token: The refresh token to blacklist
            exp_timestamp: Expiration timestamp
            
        Returns:
            True if successfully blacklisted, False otherwise
        """
        try:
            if exp_timestamp is None:
                try:
                    payload = jwt.decode(
                        refresh_token,
                        settings.SECRET_KEY,
                        algorithms=[settings.ALGORITHM]
                    )
                    exp_timestamp = payload.get("exp")
                except JWTError as e:
                    logger.error(f"Invalid refresh token for blacklisting: {e}")
                    return False
            
            if not exp_timestamp:
                # If no expiration, use a default TTL for refresh tokens
                ttl = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600
            else:
                ttl = exp_timestamp - int(datetime.utcnow().timestamp())
            
            if ttl <= 0:
                return True
            
            key = f"{self.refresh_prefix}{refresh_token}"
            await self.redis.setex(
                key,
                ttl,
                json.dumps({
                    "blacklisted_at": datetime.utcnow().isoformat(),
                    "reason": "refresh_token_revoked"
                })
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to blacklist refresh token: {e}")
            return False
    
    async def is_token_blacklisted(self, token: str) -> bool:
        """
        Check if a token is blacklisted
        
        Args:
            token: The token to check
            
        Returns:
            True if blacklisted, False otherwise
        """
        try:
            # Check access token blacklist
            access_key = f"{self.token_prefix}{token}"
            if await self.redis.exists(access_key):
                return True
            
            # Check refresh token blacklist
            refresh_key = f"{self.refresh_prefix}{token}"
            if await self.redis.exists(refresh_key):
                return True
            
            # Extract user ID and check user-wide blacklist
            try:
                payload = jwt.decode(
                    token,
                    settings.SECRET_KEY,
                    algorithms=[settings.ALGORITHM]
                )
                user_id = payload.get("sub")
                
                if user_id:
                    user_key = f"{self.user_prefix}{user_id}"
                    user_blacklist = await self.redis.get(user_key)
                    
                    if user_blacklist:
                        # Check if token was issued before blacklist time
                        blacklist_data = json.loads(user_blacklist)
                        blacklist_time = datetime.fromisoformat(blacklist_data["blacklisted_at"])
                        token_issued = datetime.fromtimestamp(payload.get("iat", 0))
                        
                        if token_issued < blacklist_time:
                            return True
            except:
                pass  # If we can't decode the token, just check direct blacklist
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking token blacklist: {e}")
            # In case of error, err on the side of security
            return True
    
    async def blacklist_user_tokens(
        self, 
        user_id: str,
        reason: str = "password_changed",
        duration_days: int = 7
    ) -> bool:
        """
        Blacklist all tokens for a specific user
        This is useful when a user changes their password or is deactivated
        
        Args:
            user_id: The user ID whose tokens should be invalidated
            reason: Reason for blacklisting
            duration_days: How long to maintain the blacklist
            
        Returns:
            True if successfully blacklisted, False otherwise
        """
        try:
            key = f"{self.user_prefix}{user_id}"
            ttl = duration_days * 24 * 3600
            
            await self.redis.setex(
                key,
                ttl,
                json.dumps({
                    "blacklisted_at": datetime.utcnow().isoformat(),
                    "reason": reason
                })
            )
            
            logger.info(f"All tokens for user {user_id} blacklisted for {duration_days} days")
            return True
            
        except Exception as e:
            logger.error(f"Failed to blacklist user tokens: {e}")
            return False
    
    async def remove_from_blacklist(self, token: str) -> bool:
        """
        Remove a token from the blacklist
        This might be needed for administrative purposes
        
        Args:
            token: The token to remove from blacklist
            
        Returns:
            True if removed, False otherwise
        """
        try:
            access_key = f"{self.token_prefix}{token}"
            refresh_key = f"{self.refresh_prefix}{token}"
            
            # Remove both possible keys
            result1 = await self.redis.delete(access_key)
            result2 = await self.redis.delete(refresh_key)
            
            return (result1 > 0) or (result2 > 0)
            
        except Exception as e:
            logger.error(f"Failed to remove token from blacklist: {e}")
            return False
    
    async def get_blacklist_info(self, token: str) -> Optional[dict]:
        """
        Get information about why a token was blacklisted
        
        Args:
            token: The token to check
            
        Returns:
            Blacklist information if found, None otherwise
        """
        try:
            # Check access token
            access_key = f"{self.token_prefix}{token}"
            data = await self.redis.get(access_key)
            if data:
                return json.loads(data)
            
            # Check refresh token
            refresh_key = f"{self.refresh_prefix}{token}"
            data = await self.redis.get(refresh_key)
            if data:
                return json.loads(data)
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get blacklist info: {e}")
            return None
    
    async def cleanup_expired(self) -> int:
        """
        Clean up expired blacklist entries
        This is handled automatically by Redis TTL, but this method
        can be used for manual cleanup if needed
        
        Returns:
            Number of entries cleaned up
        """
        # Redis automatically handles expiration with TTL
        # This method is here for completeness
        return 0
    
    async def get_blacklist_stats(self) -> dict:
        """
        Get statistics about the blacklist
        
        Returns:
            Dictionary with blacklist statistics
        """
        try:
            # Count different types of blacklisted entries using SCAN (not KEYS)
            # SCAN is non-blocking and production-safe
            async def count_keys_with_pattern(pattern: str) -> int:
                """Count keys matching pattern using SCAN"""
                count = 0
                cursor = 0
                while True:
                    cursor, keys = await self.redis.scan(cursor, match=pattern, count=100)
                    count += len(keys)
                    if cursor == 0:
                        break
                return count
            
            access_count = await count_keys_with_pattern(f"{self.token_prefix}*")
            refresh_count = await count_keys_with_pattern(f"{self.refresh_prefix}*")
            user_count = await count_keys_with_pattern(f"{self.user_prefix}*")
            
            return {
                "access_tokens_blacklisted": access_count,
                "refresh_tokens_blacklisted": refresh_count,
                "users_blacklisted": user_count,
                "total_entries": access_count + refresh_count + user_count
            }
            
        except Exception as e:
            logger.error(f"Failed to get blacklist stats: {e}")
            return {
                "error": str(e),
                "access_tokens_blacklisted": 0,
                "refresh_tokens_blacklisted": 0,
                "users_blacklisted": 0,
                "total_entries": 0
            }


# Dependency injection helper
async def get_token_blacklist_service() -> TokenBlacklistService:
    """
    Get token blacklist service instance for dependency injection
    """
    from app.core.redis import get_redis_client
    redis_client = await get_redis_client()
    return TokenBlacklistService(redis_client)