"""
Pydantic schemas for authentication
These define the structure and validation rules for API requests/responses
"""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict


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
    email: EmailStr
    full_name: Optional[str] = None
    is_active: bool = True


class UserCreate(UserBase):
    """Schema for creating a new user"""
    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    """Schema for updating user information"""
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = Field(None, min_length=8)


class User(UserBase):
    """User response schema"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_login: Optional[datetime] = None


class UserInDB(User):
    """User schema with hashed password (for internal use)"""
    hashed_password: str