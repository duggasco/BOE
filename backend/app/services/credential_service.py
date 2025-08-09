"""
Secure credential storage service for sensitive data
"""

import os
import base64
import logging
import secrets
from typing import Optional, Dict, Any, Tuple
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
import json

from app.core.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)


class CredentialService:
    """Service for secure storage and retrieval of sensitive credentials"""
    
    def __init__(self):
        """Initialize the credential service with encryption key"""
        self._cipher_suite = self._get_cipher_suite()
    
    def _get_cipher_suite(self, salt: Optional[bytes] = None) -> Tuple[Fernet, bytes]:
        """Generate encryption key with unique salt for each encryption"""
        # Generate new salt if not provided
        if salt is None:
            salt = secrets.token_bytes(16)  # 128-bit salt
        
        # Use environment variable or derive from secret key
        master_key = os.getenv("CREDENTIAL_ENCRYPTION_KEY", settings.SECRET_KEY)
        
        # Derive key from master key with unique salt
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
            backend=default_backend()
        )
        key = base64.urlsafe_b64encode(kdf.derive(master_key.encode()))
        return Fernet(key), salt
    
    def encrypt_credentials(self, credentials: Dict[str, Any]) -> str:
        """Encrypt sensitive credentials for storage with unique salt"""
        try:
            # Get cipher with new salt
            cipher, salt = self._get_cipher_suite()
            
            # Convert to JSON string
            json_str = json.dumps(credentials)
            
            # Encrypt
            encrypted = cipher.encrypt(json_str.encode())
            
            # Combine salt and encrypted data
            combined = salt + encrypted
            
            # Return base64 encoded string
            return base64.urlsafe_b64encode(combined).decode()
        except Exception as e:
            logger.error(f"Failed to encrypt credentials: {e}")
            raise ValueError("Failed to encrypt credentials")
    
    def decrypt_credentials(self, encrypted_data: str) -> Dict[str, Any]:
        """Decrypt stored credentials using embedded salt"""
        try:
            # Decode from base64
            combined = base64.urlsafe_b64decode(encrypted_data.encode())
            
            # Extract salt (first 16 bytes) and encrypted data
            salt = combined[:16]
            encrypted = combined[16:]
            
            # Get cipher with extracted salt
            cipher, _ = self._get_cipher_suite(salt)
            
            # Decrypt
            decrypted = cipher.decrypt(encrypted)
            
            # Parse JSON
            return json.loads(decrypted.decode())
        except Exception as e:
            logger.error(f"Failed to decrypt credentials: {e}")
            raise ValueError("Failed to decrypt credentials")
    
    async def store_smtp_credentials(
        self,
        db: AsyncSession,
        user_id: str,
        smtp_config: Dict[str, Any]
    ) -> None:
        """Store SMTP credentials securely for a user"""
        # Extract sensitive fields
        sensitive_fields = ["smtp_password", "smtp_user"]
        credentials = {}
        
        for field in sensitive_fields:
            if field in smtp_config:
                credentials[field] = smtp_config.pop(field)
        
        # Encrypt credentials
        if credentials:
            encrypted = self.encrypt_credentials(credentials)
            
            # Store encrypted credentials in user preferences or separate table
            # For now, we'll use user metadata (in production, use separate table)
            user = await db.get(User, user_id)
            if not user:
                raise ValueError(f"User {user_id} not found")
                
            if not user.metadata:
                user.metadata = {}
            user.metadata["encrypted_smtp_credentials"] = encrypted
            user.metadata["smtp_config"] = smtp_config  # Non-sensitive config
            await db.commit()
    
    async def get_smtp_credentials(
        self,
        db: AsyncSession,
        user_id: str
    ) -> Optional[Dict[str, Any]]:
        """Retrieve and decrypt SMTP credentials for a user"""
        user = await db.get(User, user_id)
        if not user or not user.metadata:
            return None
        
        encrypted = user.metadata.get("encrypted_smtp_credentials")
        if not encrypted:
            return None
        
        try:
            credentials = self.decrypt_credentials(encrypted)
            # Merge with non-sensitive config
            config = user.metadata.get("smtp_config", {})
            config.update(credentials)
            return config
        except Exception as e:
            logger.error(f"Failed to retrieve SMTP credentials for user {user_id}: {e}")
            return None
    
    def sanitize_distribution_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Remove sensitive data from distribution config before sending to frontend"""
        if not config:
            return config
        
        sanitized = config.copy()
        
        # Remove sensitive email fields
        if "email" in sanitized:
            email_config = sanitized["email"].copy() if isinstance(sanitized["email"], dict) else {}
            sensitive_fields = ["smtp_password", "smtp_user", "auth_token", "api_key"]
            for field in sensitive_fields:
                if field in email_config:
                    # Replace with placeholder
                    email_config[field] = "***REDACTED***"
            sanitized["email"] = email_config
        
        # Remove sensitive cloud storage fields
        if "cloud" in sanitized:
            cloud_config = sanitized["cloud"].copy() if isinstance(sanitized["cloud"], dict) else {}
            sensitive_fields = ["access_key", "secret_key", "password", "token"]
            for field in sensitive_fields:
                if field in cloud_config:
                    cloud_config[field] = "***REDACTED***"
            sanitized["cloud"] = cloud_config
        
        return sanitized


# Global instance
credential_service = CredentialService()