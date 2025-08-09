"""
Common dependencies for FastAPI endpoints
"""

from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from jose import JWTError, jwt

from app.core.config import settings
from app.core.database import get_db
from app.models import User
from app.services.user_service import UserService
from app.services.rbac_service import RBACService

# OAuth2 scheme for token authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_PREFIX}/auth/token")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Get the current authenticated user from JWT token
    
    Args:
        token: JWT access token
        db: Database session
        
    Returns:
        Current authenticated User
        
    Raises:
        HTTPException: If token is invalid or user not found
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Decode JWT token
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # Get user from database
    user_service = UserService(db)
    user = await user_service.get_user(user_id)
    
    if user is None:
        raise credentials_exception
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get current user and ensure they are active
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        Active User
        
    Raises:
        HTTPException: If user is not active
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


async def get_admin_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Get current user and ensure they are an admin
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        Admin User
        
    Raises:
        HTTPException: If user is not an admin
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


# Optional user dependency for endpoints that work with or without auth
async def get_optional_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """
    Get current user if authenticated, None otherwise
    
    Args:
        token: Optional JWT token
        db: Database session
        
    Returns:
        User if authenticated, None otherwise
    """
    if not token:
        return None
    
    try:
        return await get_current_user(token, db)
    except HTTPException:
        return None


def get_rbac_service(db: AsyncSession = Depends(get_db)) -> RBACService:
    """
    Get an RBAC service instance.
    The service instance is scoped to the request through the database session.
    
    Args:
        db: Database session
        
    Returns:
        RBACService instance for the current request
    """
    return RBACService(db)