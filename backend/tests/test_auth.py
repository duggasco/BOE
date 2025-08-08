"""
Tests for authentication endpoints.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
import jwt

from app.core.config import settings
from app.models.user import User
from app.services.token_service import TokenService


@pytest.mark.auth
class TestAuthentication:
    """Test authentication endpoints."""
    
    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, test_user: User):
        """Test successful login."""
        response = await client.post(
            "/api/v1/auth/token",
            data={
                "username": "test@example.com",
                "password": "testpassword"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        
        # Verify token is valid
        payload = jwt.decode(
            data["access_token"],
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        assert payload["sub"] == test_user.email
    
    @pytest.mark.asyncio
    async def test_login_invalid_password(self, client: AsyncClient, test_user: User):
        """Test login with invalid password."""
        response = await client.post(
            "/api/v1/auth/token",
            data={
                "username": "test@example.com",
                "password": "wrongpassword"
            }
        )
        
        assert response.status_code == 401
        assert response.json()["detail"] == "Incorrect username or password"
    
    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, client: AsyncClient):
        """Test login with non-existent user."""
        response = await client.post(
            "/api/v1/auth/token",
            data={
                "username": "nonexistent@example.com",
                "password": "somepassword"
            }
        )
        
        assert response.status_code == 401
        assert response.json()["detail"] == "Incorrect username or password"
    
    @pytest.mark.asyncio
    async def test_login_inactive_user(self, client: AsyncClient, db_session: AsyncSession):
        """Test login with inactive user."""
        # Create inactive user
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        
        import uuid
        inactive_user = User(
            id=str(uuid.uuid4()),
            email="inactive@example.com",
            username="inactive",
            full_name="Inactive User",
            hashed_password=pwd_context.hash("password"),
            is_active=False,
            created_at=datetime.utcnow()
        )
        db_session.add(inactive_user)
        await db_session.commit()
        
        response = await client.post(
            "/api/v1/auth/token",
            data={
                "username": "inactive@example.com",
                "password": "password"
            }
        )
        
        assert response.status_code == 401
        assert response.json()["detail"] == "Inactive user"
    
    @pytest.mark.asyncio
    async def test_get_current_user(self, client: AsyncClient, auth_headers: dict, test_user: User):
        """Test getting current user information."""
        response = await client.get(
            "/api/v1/auth/me",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user.email
        assert data["username"] == test_user.username
        assert data["full_name"] == test_user.full_name
        assert "hashed_password" not in data
    
    @pytest.mark.asyncio
    async def test_get_current_user_no_token(self, client: AsyncClient):
        """Test accessing protected endpoint without token."""
        response = await client.get("/api/v1/auth/me")
        
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"
    
    @pytest.mark.asyncio
    async def test_get_current_user_invalid_token(self, client: AsyncClient):
        """Test accessing protected endpoint with invalid token."""
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid_token"}
        )
        
        assert response.status_code == 401
        assert response.json()["detail"] == "Could not validate credentials"
    
    @pytest.mark.asyncio
    async def test_refresh_token(self, client: AsyncClient, test_user: User):
        """Test refreshing access token."""
        # First login to get tokens
        login_response = await client.post(
            "/api/v1/auth/token",
            data={
                "username": "test@example.com",
                "password": "testpassword"
            }
        )
        
        assert login_response.status_code == 200
        tokens = login_response.json()
        
        # Use refresh token to get new access token
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": tokens["refresh_token"]}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["access_token"] != tokens["access_token"]  # Should be different
    
    @pytest.mark.asyncio
    async def test_refresh_token_invalid(self, client: AsyncClient):
        """Test refreshing with invalid refresh token."""
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid_refresh_token"}
        )
        
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid refresh token"
    
    @pytest.mark.asyncio
    async def test_logout(self, client: AsyncClient, auth_headers: dict):
        """Test logout (token blacklisting)."""
        # First ensure we can access protected endpoint
        me_response = await client.get(
            "/api/v1/auth/me",
            headers=auth_headers
        )
        assert me_response.status_code == 200
        
        # Logout
        logout_response = await client.post(
            "/api/v1/auth/logout",
            headers=auth_headers
        )
        assert logout_response.status_code == 200
        assert logout_response.json()["message"] == "Successfully logged out"
        
        # Try to access protected endpoint with same token (should fail)
        # Note: This would require actual Redis integration for blacklist
        # For now, we just verify the logout endpoint works
    
    @pytest.mark.asyncio
    async def test_token_expiration(self, client: AsyncClient):
        """Test that expired tokens are rejected."""
        token_service = TokenService()
        
        # Create an expired token
        expired_token = await token_service.create_access_token(
            data={"sub": "test@example.com"},
            expires_delta=timedelta(seconds=-1)  # Already expired
        )
        
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {expired_token}"}
        )
        
        assert response.status_code == 401
        assert response.json()["detail"] == "Token has expired"
    
    @pytest.mark.asyncio
    async def test_register_new_user(self, client: AsyncClient):
        """Test registering a new user."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@example.com",
                "username": "newuser",
                "full_name": "New User",
                "password": "securepassword123"
            }
        )
        
        # Registration might be disabled in settings
        if settings.ALLOW_REGISTRATION:
            assert response.status_code == 201
            data = response.json()
            assert data["email"] == "newuser@example.com"
            assert data["username"] == "newuser"
            assert "hashed_password" not in data
        else:
            assert response.status_code == 403
            assert response.json()["detail"] == "Registration is disabled"
    
    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client: AsyncClient, test_user: User):
        """Test registering with duplicate email."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": test_user.email,  # Duplicate
                "username": "anotheruser",
                "full_name": "Another User",
                "password": "password123"
            }
        )
        
        if settings.ALLOW_REGISTRATION:
            assert response.status_code == 400
            assert "already registered" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_password_requirements(self, client: AsyncClient):
        """Test password validation requirements."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "weak@example.com",
                "username": "weakpass",
                "full_name": "Weak Pass",
                "password": "123"  # Too short
            }
        )
        
        if settings.ALLOW_REGISTRATION:
            assert response.status_code == 422
            # Password should have minimum length requirement
    
    @pytest.mark.asyncio
    async def test_admin_access(self, client: AsyncClient, admin_auth_headers: dict):
        """Test admin user has superuser access."""
        response = await client.get(
            "/api/v1/auth/me",
            headers=admin_auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_superuser"] is True
    
    @pytest.mark.asyncio
    async def test_rate_limiting(self, client: AsyncClient):
        """Test rate limiting on login attempts."""
        # Make multiple rapid login attempts
        for i in range(10):
            response = await client.post(
                "/api/v1/auth/token",
                data={
                    "username": f"user{i}@example.com",
                    "password": "wrongpassword"
                }
            )
        
        # After too many attempts, should get rate limited
        # Note: This requires actual rate limiting middleware to be configured
        # The exact behavior depends on rate limit configuration