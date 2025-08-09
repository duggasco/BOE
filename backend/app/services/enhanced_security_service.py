"""
Enhanced Security Service for Phase 5.5 Production Readiness
Implements Gemini's recommendations for critical security fixes
"""

import os
import base64
import hashlib
import secrets
from typing import Optional, Dict, Any
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
from cryptography.hazmat.backends import default_backend
from datetime import datetime, timedelta
import redis
from functools import wraps
import json
from email_validator import validate_email, EmailNotValidError
from croniter import croniter

from app.core.config import settings


class EnhancedSecurityService:
    """
    Production-ready security service addressing critical vulnerabilities:
    - Proper credential encryption with unique salts
    - Comprehensive input validation
    - Secure session management
    - Rate limiting with Redis
    """
    
    def __init__(self):
        self.redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        # Master key from environment - NEVER store in code
        self.master_key = settings.SECRET_KEY.encode()
    
    def encrypt_credentials(self, credentials: Dict[str, Any]) -> Dict[str, Any]:
        """
        Encrypt sensitive credentials with unique salt per credential
        Following Gemini's recommendation for unique salt generation
        """
        if not credentials:
            return {}
        
        # Generate unique salt for this encryption
        salt = secrets.token_bytes(16)
        
        # Derive key from master key and unique salt
        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
            backend=default_backend()
        )
        key = base64.urlsafe_b64encode(kdf.derive(self.master_key))
        cipher = Fernet(key)
        
        # Serialize and encrypt
        data_bytes = json.dumps(credentials).encode()
        encrypted = cipher.encrypt(data_bytes)
        
        return {
            "encrypted_data": base64.b64encode(encrypted).decode(),
            "salt": base64.b64encode(salt).decode(),
            "encrypted_at": datetime.utcnow().isoformat(),
            "version": "1.0"  # For future migration support
        }
    
    def decrypt_credentials(self, encrypted_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Decrypt credentials using provided salt
        Handles errors gracefully without exposing sensitive info
        """
        if not encrypted_data or "encrypted_data" not in encrypted_data:
            return {}
        
        try:
            # Restore salt and recreate cipher with same parameters
            salt = base64.b64decode(encrypted_data["salt"])
            kdf = PBKDF2(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,
                backend=default_backend()
            )
            key = base64.urlsafe_b64encode(kdf.derive(self.master_key))
            cipher = Fernet(key)
            
            # Decrypt data
            encrypted_bytes = base64.b64decode(encrypted_data["encrypted_data"])
            decrypted = cipher.decrypt(encrypted_bytes)
            
            return json.loads(decrypted.decode())
        except Exception as e:
            # Log error type only, never log sensitive data
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Decryption failed: {type(e).__name__}")
            return {}
    
    def sanitize_for_frontend(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Remove ALL sensitive data before sending to frontend
        Per Gemini: NEVER store credentials in browser storage
        """
        sensitive_patterns = [
            "password", "secret", "token", "key", "credential",
            "smtp_password", "api_key", "private_key", "auth",
            "salt", "encrypted", "hash"
        ]
        
        def _sanitize(obj):
            if isinstance(obj, dict):
                sanitized = {}
                for key, value in obj.items():
                    # Check if key contains sensitive patterns
                    if any(pattern in key.lower() for pattern in sensitive_patterns):
                        # Don't include sensitive fields at all for frontend
                        continue
                    else:
                        sanitized[key] = _sanitize(value)
                return sanitized
            elif isinstance(obj, list):
                return [_sanitize(item) for item in obj]
            else:
                return obj
        
        return _sanitize(data)
    
    def validate_email(self, email: str) -> tuple[bool, Optional[str]]:
        """
        Validate email using email_validator library
        Per Gemini: Use robust library for email validation
        """
        try:
            # This will check DNS and deliverability if configured
            validation = validate_email(email, check_deliverability=False)
            return True, validation.email
        except EmailNotValidError as e:
            return False, str(e)
    
    def validate_cron_expression(self, cron: str) -> tuple[bool, Optional[str]]:
        """
        Validate cron expression using croniter
        Per Gemini: Use dedicated library for cron validation
        """
        try:
            # Validate by attempting to parse
            croniter(cron)
            # Also check for reasonable intervals (not too frequent)
            cron_obj = croniter(cron, datetime.now())
            next_run = cron_obj.get_next(datetime)
            next_next_run = cron_obj.get_next(datetime)
            
            # Ensure at least 1 minute between runs
            if (next_next_run - next_run).total_seconds() < 60:
                return False, "Cron expression runs too frequently (minimum 1 minute interval)"
            
            return True, None
        except Exception as e:
            return False, f"Invalid cron expression: {str(e)}"
    
    def validate_path(self, path: str, base_dir: str) -> tuple[bool, Optional[str]]:
        """
        Validate file path to prevent directory traversal
        Ensures path stays within base_dir
        """
        try:
            # Resolve to absolute path
            full_path = os.path.abspath(os.path.join(base_dir, path))
            base_dir_abs = os.path.abspath(base_dir)
            
            # Check if resolved path is within base directory
            if not full_path.startswith(base_dir_abs):
                return False, "Path traversal detected"
            
            return True, full_path
        except Exception as e:
            return False, f"Invalid path: {str(e)}"
    
    def validate_url(self, url: str) -> tuple[bool, Optional[str]]:
        """
        Validate URL format and protocol
        """
        from urllib.parse import urlparse
        
        try:
            result = urlparse(url)
            
            # Check basic structure
            if not all([result.scheme, result.netloc]):
                return False, "Invalid URL format"
            
            # Only allow specific protocols
            if result.scheme not in ['http', 'https', 'ftps', 'sftp']:
                return False, f"Unsupported protocol: {result.scheme}"
            
            # Prevent local file access
            if result.netloc in ['localhost', '127.0.0.1', '0.0.0.0']:
                return False, "Local URLs not allowed"
            
            return True, None
        except Exception as e:
            return False, f"Invalid URL: {str(e)}"
    
    def rate_limit_check(self, key: str, limit: int, window: int) -> tuple[bool, Dict[str, Any]]:
        """
        Enhanced rate limiting with Redis
        Returns (allowed, metadata)
        Per Gemini: Fail closed if Redis unavailable
        """
        try:
            pipe = self.redis_client.pipeline()
            now = datetime.now()
            window_start = now - timedelta(seconds=window)
            
            # Use sorted set for sliding window
            score = now.timestamp()
            member = f"{score}:{secrets.token_hex(8)}"
            
            # Remove old entries and add new one
            pipe.zremrangebyscore(key, 0, window_start.timestamp())
            pipe.zadd(key, {member: score})
            pipe.zcount(key, window_start.timestamp(), now.timestamp())
            pipe.expire(key, window + 60)  # Extra buffer for cleanup
            
            results = pipe.execute()
            count = results[2]
            
            return count <= limit, {
                "count": count,
                "limit": limit,
                "remaining": max(0, limit - count),
                "reset_at": (now + timedelta(seconds=window)).isoformat()
            }
        except redis.RedisError as e:
            # Fail closed - deny if Redis is unavailable
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Rate limit check failed: {e}")
            return False, {"error": "Rate limiting unavailable"}
    
    def generate_secure_token(self, length: int = 32) -> str:
        """Generate cryptographically secure token"""
        return secrets.token_urlsafe(length)
    
    def hash_password(self, password: str) -> str:
        """
        Hash password with bcrypt (via passlib)
        """
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        return pwd_context.hash(password)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """
        Verify password against hash
        """
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        return pwd_context.verify(plain_password, hashed_password)
    
    def create_secure_session(self, user_id: str, ttl: int = 3600) -> str:
        """
        Create secure session with unique token
        Store minimal data in Redis, never in frontend storage
        """
        session_token = self.generate_secure_token(48)
        session_data = {
            "user_id": user_id,
            "created_at": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(seconds=ttl)).isoformat()
        }
        
        # Store in Redis with TTL
        self.redis_client.setex(
            f"session:{session_token}",
            ttl,
            json.dumps(session_data)
        )
        
        return session_token
    
    def validate_session(self, session_token: str) -> Optional[Dict[str, Any]]:
        """
        Validate and retrieve session data
        """
        try:
            data = self.redis_client.get(f"session:{session_token}")
            if data:
                session_data = json.loads(data)
                # Check expiration
                expires_at = datetime.fromisoformat(session_data["expires_at"])
                if datetime.utcnow() < expires_at:
                    return session_data
            return None
        except Exception:
            return None


# Global instance
enhanced_security_service = EnhancedSecurityService()


def secure_endpoint(rate_limit: int = 100, window: int = 60):
    """
    Decorator for securing API endpoints with rate limiting
    """
    def decorator(f):
        @wraps(f)
        async def decorated_function(*args, **kwargs):
            from fastapi import Request, HTTPException
            
            # Find request object
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if request:
                # Rate limiting
                client_id = request.client.host
                allowed, metadata = enhanced_security_service.rate_limit_check(
                    f"rate_limit:{client_id}:{f.__name__}",
                    rate_limit,
                    window
                )
                
                if not allowed:
                    raise HTTPException(
                        status_code=429,
                        detail="Rate limit exceeded",
                        headers={
                            "X-RateLimit-Limit": str(metadata.get("limit", rate_limit)),
                            "X-RateLimit-Remaining": "0",
                            "X-RateLimit-Reset": metadata.get("reset_at", "")
                        }
                    )
            
            return await f(*args, **kwargs)
        return decorated_function
    return decorator