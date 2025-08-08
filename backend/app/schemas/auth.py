"""
Pydantic schemas for authentication
These define the structure and validation rules for API requests/responses
"""

from typing import Optional
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator


class Token(BaseModel):
    """JWT token response"""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Data stored in JWT token"""
    username: Optional[str] = None


class UserBase(BaseModel):
    """Base user schema"""
    username: str = Field(..., min_length=3, max_length=50)
    email: str  # Changed from EmailStr to allow .local domains
    full_name: Optional[str] = None
    is_active: bool = True
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        """Basic email validation that allows .local domains"""
        if '@' not in v or len(v.split('@')) != 2:
            raise ValueError('Invalid email format')
        return v


class UserCreate(UserBase):
    """Schema for creating a new user"""
    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    """Schema for updating user information"""
    email: Optional[str] = None
    full_name: Optional[str] = None
    password: Optional[str] = Field(None, min_length=8)
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        """Basic email validation that allows .local domains"""
        if v is not None and ('@' not in v or len(v.split('@')) != 2):
            raise ValueError('Invalid email format')
        return v


class User(UserBase):
    """User response schema"""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID  # Changed from int to UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_login: Optional[datetime] = None


class UserInDB(User):
    """User schema with hashed password (for internal use)"""
    hashed_password: str