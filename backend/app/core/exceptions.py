"""
Custom exception classes for the application
"""

from typing import Optional, Dict, Any
from fastapi import HTTPException, status


class BaseAPIException(HTTPException):
    """Base exception class for API errors"""
    
    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.error_code = error_code or self.__class__.__name__
        self.details = details or {}
        
        super().__init__(
            status_code=status_code,
            detail={
                "error": self.error_code,
                "message": message,
                "details": self.details
            }
        )


class NotFoundException(BaseAPIException):
    """Resource not found exception"""
    
    def __init__(self, message: str = "Resource not found", **kwargs):
        super().__init__(
            message=message,
            status_code=status.HTTP_404_NOT_FOUND,
            **kwargs
        )


class ValidationException(BaseAPIException):
    """Validation error exception"""
    
    def __init__(self, message: str = "Validation failed", **kwargs):
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            **kwargs
        )


class PermissionDeniedException(BaseAPIException):
    """Permission denied exception"""
    
    def __init__(self, message: str = "Permission denied", **kwargs):
        super().__init__(
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
            **kwargs
        )


class AuthenticationException(BaseAPIException):
    """Authentication failed exception"""
    
    def __init__(self, message: str = "Authentication failed", **kwargs):
        super().__init__(
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            **kwargs
        )


class BusinessLogicException(BaseAPIException):
    """Business logic violation exception"""
    
    def __init__(self, message: str = "Business rule violated", **kwargs):
        super().__init__(
            message=message,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            **kwargs
        )


class ConflictException(BaseAPIException):
    """Resource conflict exception"""
    
    def __init__(self, message: str = "Resource conflict", **kwargs):
        super().__init__(
            message=message,
            status_code=status.HTTP_409_CONFLICT,
            **kwargs
        )


class RateLimitException(BaseAPIException):
    """Rate limit exceeded exception"""
    
    def __init__(
        self,
        message: str = "Rate limit exceeded",
        retry_after: Optional[int] = None,
        **kwargs
    ):
        details = kwargs.get("details", {})
        if retry_after:
            details["retry_after"] = retry_after
            
        super().__init__(
            message=message,
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            details=details,
            **kwargs
        )


class ServiceUnavailableException(BaseAPIException):
    """Service unavailable exception"""
    
    def __init__(self, message: str = "Service temporarily unavailable", **kwargs):
        super().__init__(
            message=message,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            **kwargs
        )


class DatabaseException(BaseAPIException):
    """Database operation failed exception"""
    
    def __init__(self, message: str = "Database operation failed", **kwargs):
        super().__init__(
            message=message,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="DATABASE_ERROR",
            **kwargs
        )