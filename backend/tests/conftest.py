"""
Pytest configuration and fixtures for backend tests.
"""
import os
import asyncio
import uuid
from typing import AsyncGenerator, Generator
from datetime import datetime, timedelta

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.core.database import Base, get_db
from app.core.config import settings
from app.main import app
from app.models.user import User, Role, Permission, Group, user_roles, user_groups, role_permissions
from app.models.report import Report, ReportVersion, Folder
from app.models.field import Field, DataTable, DataSource
from app.services.user_service import UserService
from app.services.token_service import TokenService
from passlib.context import CryptContext

# Override database URL for testing
TEST_DATABASE_URL = settings.DATABASE_URL.replace("boe_db", "boe_test_db")
if TEST_DATABASE_URL.startswith("postgresql://"):
    TEST_DATABASE_URL = TEST_DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

# Create async engine for tests
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    poolclass=NullPool,  # Disable connection pooling for tests
    echo=False
)

# Create async session factory
TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session."""
    # Create tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    # Create session
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()
    
    # Clean up tables after test
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create a test client with database override."""
    async def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(app=app, base_url="http://test") as test_client:
        yield test_client
    
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create a test user."""
    user = User(
        id=str(uuid.uuid4()),
        email="test@example.com",
        username="testuser",
        full_name="Test User",
        hashed_password=pwd_context.hash("testpassword"),
        is_active=True,
        is_superuser=False,
        created_at=datetime.utcnow()
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    """Create an admin user."""
    user = User(
        id=str(uuid.uuid4()),
        email="admin@example.com",
        username="admin",
        full_name="Admin User",
        hashed_password=pwd_context.hash("adminpassword"),
        is_active=True,
        is_superuser=True,
        created_at=datetime.utcnow()
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def viewer_user(db_session: AsyncSession, viewer_role: Role) -> User:
    """Create a viewer user with limited permissions."""
    user = User(
        id=str(uuid.uuid4()),
        email="viewer@example.com",
        username="viewer",
        full_name="Viewer User",
        hashed_password=pwd_context.hash("viewerpassword"),
        is_active=True,
        is_superuser=False,
        created_at=datetime.utcnow()
    )
    db_session.add(user)
    await db_session.flush()
    
    # Assign viewer role
    await db_session.execute(
        user_roles.insert().values(user_id=user.id, role_id=viewer_role.id)
    )
    
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def creator_user(db_session: AsyncSession, creator_role: Role) -> User:
    """Create a creator user with create/edit permissions."""
    user = User(
        id=str(uuid.uuid4()),
        email="creator@example.com",
        username="creator",
        full_name="Creator User",
        hashed_password=pwd_context.hash("creatorpassword"),
        is_active=True,
        is_superuser=False,
        created_at=datetime.utcnow()
    )
    db_session.add(user)
    await db_session.flush()
    
    # Assign creator role
    await db_session.execute(
        user_roles.insert().values(user_id=user.id, role_id=creator_role.id)
    )
    
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def viewer_role(db_session: AsyncSession) -> Role:
    """Create viewer role with view permissions."""
    role = Role(
        id=str(uuid.uuid4()),
        name="viewer",
        description="Can view reports",
        is_system=True,
        created_at=datetime.utcnow()
    )
    db_session.add(role)
    await db_session.flush()
    
    # Create view permission
    view_perm = Permission(
        id=str(uuid.uuid4()),
        name="reports:view",
        resource="reports",
        action="view",
        description="View reports"
    )
    db_session.add(view_perm)
    await db_session.flush()
    
    # Assign permission to role
    await db_session.execute(
        role_permissions.insert().values(role_id=role.id, permission_id=view_perm.id)
    )
    
    await db_session.commit()
    await db_session.refresh(role)
    return role


@pytest_asyncio.fixture
async def creator_role(db_session: AsyncSession) -> Role:
    """Create creator role with create/edit permissions."""
    role = Role(
        id=str(uuid.uuid4()),
        name="creator",
        description="Can create and edit reports",
        is_system=True,
        created_at=datetime.utcnow()
    )
    db_session.add(role)
    await db_session.flush()
    
    # Create permissions
    permissions = [
        Permission(
            id=str(uuid.uuid4()),
            name="reports:view",
            resource="reports",
            action="view",
            description="View reports"
        ),
        Permission(
            id=str(uuid.uuid4()),
            name="reports:create",
            resource="reports",
            action="create",
            description="Create reports"
        ),
        Permission(
            id=str(uuid.uuid4()),
            name="reports:update",
            resource="reports",
            action="update",
            description="Update reports"
        )
    ]
    
    for perm in permissions:
        db_session.add(perm)
        await db_session.flush()
        # Assign permission to role
        await db_session.execute(
            role_permissions.insert().values(role_id=role.id, permission_id=perm.id)
        )
    
    await db_session.commit()
    await db_session.refresh(role)
    return role


@pytest_asyncio.fixture
async def auth_headers(test_user: User) -> dict:
    """Generate authentication headers for test user."""
    token_service = TokenService()
    access_token = await token_service.create_access_token(
        data={"sub": test_user.email}
    )
    return {"Authorization": f"Bearer {access_token}"}


@pytest_asyncio.fixture
async def admin_auth_headers(admin_user: User) -> dict:
    """Generate authentication headers for admin user."""
    token_service = TokenService()
    access_token = await token_service.create_access_token(
        data={"sub": admin_user.email}
    )
    return {"Authorization": f"Bearer {access_token}"}


@pytest_asyncio.fixture
async def viewer_auth_headers(viewer_user: User) -> dict:
    """Generate authentication headers for viewer user."""
    token_service = TokenService()
    access_token = await token_service.create_access_token(
        data={"sub": viewer_user.email}
    )
    return {"Authorization": f"Bearer {access_token}"}


@pytest_asyncio.fixture
async def creator_auth_headers(creator_user: User) -> dict:
    """Generate authentication headers for creator user."""
    token_service = TokenService()
    access_token = await token_service.create_access_token(
        data={"sub": creator_user.email}
    )
    return {"Authorization": f"Bearer {access_token}"}


@pytest_asyncio.fixture
async def test_report(db_session: AsyncSession, test_user: User) -> Report:
    """Create a test report."""
    report = Report(
        id=str(uuid.uuid4()),
        name="Test Report",
        description="A test report",
        owner_id=test_user.id,
        is_published=False,
        definition={
            "fields": ["field1", "field2"],
            "filters": [],
            "aggregations": []
        },
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db_session.add(report)
    await db_session.commit()
    await db_session.refresh(report)
    return report


@pytest_asyncio.fixture
async def test_field(db_session: AsyncSession, test_data_table: DataTable) -> Field:
    """Create a test field."""
    field = Field(
        id=str(uuid.uuid4()),
        name="test_field",
        display_name="Test Field",
        field_type="measure",
        data_type="number",
        table_id=test_data_table.id,
        is_active=True,
        created_at=datetime.utcnow()
    )
    db_session.add(field)
    await db_session.commit()
    await db_session.refresh(field)
    return field


@pytest_asyncio.fixture
async def test_data_table(db_session: AsyncSession, test_data_source: DataSource) -> DataTable:
    """Create a test data table."""
    table = DataTable(
        id=str(uuid.uuid4()),
        name="test_table",
        display_name="Test Table",
        source_id=test_data_source.id,
        schema_name="public",
        created_at=datetime.utcnow()
    )
    db_session.add(table)
    await db_session.commit()
    await db_session.refresh(table)
    return table


@pytest_asyncio.fixture
async def test_data_source(db_session: AsyncSession) -> DataSource:
    """Create a test data source."""
    source = DataSource(
        id=str(uuid.uuid4()),
        name="test_source",
        type="postgresql",
        connection_string="postgresql://test:test@localhost/test",
        is_active=True,
        created_at=datetime.utcnow()
    )
    db_session.add(source)
    await db_session.commit()
    await db_session.refresh(source)
    return source


@pytest.fixture
def mock_redis(monkeypatch):
    """Mock Redis for rate limiting tests."""
    class MockRedis:
        def __init__(self):
            self.data = {}
            self.ttls = {}
        
        async def get(self, key):
            return self.data.get(key)
        
        async def setex(self, key, ttl, value):
            self.data[key] = value
            self.ttls[key] = ttl
            return True
        
        async def incr(self, key):
            if key not in self.data:
                self.data[key] = 0
            self.data[key] = int(self.data.get(key, 0)) + 1
            return self.data[key]
        
        async def expire(self, key, ttl):
            self.ttls[key] = ttl
            return True
        
        async def ttl(self, key):
            return self.ttls.get(key, -1)
        
        async def scan(self, cursor, match=None, count=100):
            # Simple mock implementation
            matching_keys = []
            if match:
                pattern = match.replace("*", "")
                matching_keys = [k for k in self.data.keys() if pattern in k]
            else:
                matching_keys = list(self.data.keys())
            
            # Return cursor=0 to indicate end of scan
            return (0, matching_keys[:count])
    
    return MockRedis()