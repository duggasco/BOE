"""
User Service
Handles user authentication and management
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from passlib.context import CryptContext

from app.models.user import User
from app.schemas.auth import UserCreate

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class UserService:
    """Service for user management operations"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()
    
    async def get_user_by_username(self, username: str) -> Optional[User]:
        """Get user by username"""
        result = await self.db.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()
    
    async def get_user(self, user_id: str) -> Optional[User]:
        """Get user by ID"""
        return await self.db.get(User, user_id)
    
    async def create_user(self, user_in: UserCreate) -> User:
        """Create a new user"""
        hashed_password = pwd_context.hash(user_in.password)
        
        user = User(
            email=user_in.email,
            username=user_in.username,
            full_name=user_in.full_name,
            hashed_password=hashed_password,
            is_active=True,
            is_superuser=False
        )
        
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user
    
    async def authenticate_user(self, username: str, password: str) -> Optional[User]:
        """Authenticate a user"""
        # Try to find user by email or username
        user = await self.get_user_by_email(username)
        if not user:
            user = await self.get_user_by_username(username)
        
        if not user:
            return None
        
        if not pwd_context.verify(password, user.hashed_password):
            return None
        
        return user
    
    async def update_last_login(self, user_id: str) -> None:
        """Update user's last login timestamp"""
        from datetime import datetime
        
        user = await self.get_user(user_id)
        if user:
            user.last_login = datetime.utcnow()
            await self.db.commit()