"""
Integration tests for Schedule API with real database.
Tests actual database operations, authorization, and edge cases.
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from uuid import uuid4
import pytz
from typing import AsyncGenerator

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.main import app
from app.core.config import settings
from app.models.user import User
from app.models.report import Report
from app.models.schedule import ExportSchedule, ScheduleExecution
from app.core.security import get_password_hash
from app.core.auth import create_access_token


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def test_db() -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session with real database."""
    # Use a test database URL
    test_db_url = settings.DATABASE_URL.replace("/boe_db", "/boe_test_db")
    
    # Create engine with NullPool to avoid connection issues in tests
    engine = create_async_engine(
        test_db_url,
        poolclass=NullPool,
        echo=False
    )
    
    # Create all tables
    from app.models import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Create session
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        yield session
        # Rollback any uncommitted changes
        await session.rollback()
    
    # Clean up tables after test
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()


@pytest.fixture
async def test_users(test_db: AsyncSession):
    """Create test users with different roles."""
    users = {
        "owner": User(
            id=uuid4(),
            email="owner@test.com",
            username="owner",
            hashed_password=get_password_hash("testpass"),
            is_active=True,
            is_superuser=False
        ),
        "other": User(
            id=uuid4(),
            email="other@test.com",
            username="other",
            hashed_password=get_password_hash("testpass"),
            is_active=True,
            is_superuser=False
        ),
        "admin": User(
            id=uuid4(),
            email="admin@test.com",
            username="admin",
            hashed_password=get_password_hash("testpass"),
            is_active=True,
            is_superuser=True
        ),
        "inactive": User(
            id=uuid4(),
            email="inactive@test.com",
            username="inactive",
            hashed_password=get_password_hash("testpass"),
            is_active=False,
            is_superuser=False
        )
    }
    
    for user in users.values():
        test_db.add(user)
    await test_db.commit()
    
    # Create tokens
    for key, user in users.items():
        user.token = create_access_token(subject=str(user.id))
    
    return users


@pytest.fixture
async def test_report(test_db: AsyncSession, test_users):
    """Create a test report."""
    report = Report(
        id=uuid4(),
        name="Test Report",
        description="Test report for scheduling",
        created_by_id=test_users["owner"].id,
        query_config={"fields": ["field1", "field2"]},
        layout_config={"sections": []},
        is_public=False
    )
    test_db.add(report)
    await test_db.commit()
    await test_db.refresh(report)
    return report


@pytest.fixture
async def test_client():
    """Create async test client."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


class TestScheduleAPIAuthorization:
    """Test authorization and security for schedule endpoints."""
    
    async def test_create_schedule_requires_auth(self, test_client: AsyncClient, test_report):
        """Test that creating a schedule requires authentication."""
        schedule_data = {
            "report_id": str(test_report.id),
            "name": "Unauthorized Schedule",
            "schedule_config": {
                "frequency": "daily",
                "cron_expression": "0 9 * * *",
                "timezone": "UTC"
            },
            "distribution_config": {
                "local": {
                    "base_path": "/exports",
                    "create_subdirs": True,
                    "filename_pattern": "report.csv"
                }
            },
            "export_config": {
                "format": "csv",
                "include_headers": True
            }
        }
        
        # No auth header
        response = await test_client.post("/api/v1/schedules/", json=schedule_data)
        assert response.status_code == 401
    
    async def test_user_cannot_update_others_schedule(
        self, test_client: AsyncClient, test_db: AsyncSession, test_users, test_report
    ):
        """Test that users cannot update schedules they don't own."""
        # Create schedule as owner
        schedule = ExportSchedule(
            id=uuid4(),
            report_id=test_report.id,
            name="Owner's Schedule",
            created_by_id=test_users["owner"].id,
            schedule_config={"frequency": "daily", "cron_expression": "0 9 * * *", "timezone": "UTC"},
            distribution_config={"local": {"base_path": "/exports"}},
            export_config={"format": "csv"},
            is_active=True,
            next_run=datetime.now(pytz.UTC) + timedelta(days=1)
        )
        test_db.add(schedule)
        await test_db.commit()
        
        # Try to update as different user
        update_data = {"name": "Hacked Schedule"}
        response = await test_client.put(
            f"/api/v1/schedules/{schedule.id}",
            json=update_data,
            headers={"Authorization": f"Bearer {test_users['other'].token}"}
        )
        
        assert response.status_code == 403
        assert "not authorized" in response.json()["detail"].lower()
    
    async def test_admin_can_update_any_schedule(
        self, test_client: AsyncClient, test_db: AsyncSession, test_users, test_report
    ):
        """Test that admins can update any schedule."""
        # Create schedule as regular user
        schedule = ExportSchedule(
            id=uuid4(),
            report_id=test_report.id,
            name="User's Schedule",
            created_by_id=test_users["owner"].id,
            schedule_config={"frequency": "daily", "cron_expression": "0 9 * * *", "timezone": "UTC"},
            distribution_config={"local": {"base_path": "/exports"}},
            export_config={"format": "csv"},
            is_active=True,
            next_run=datetime.now(pytz.UTC) + timedelta(days=1)
        )
        test_db.add(schedule)
        await test_db.commit()
        
        # Update as admin
        update_data = {"name": "Admin Updated Schedule"}
        response = await test_client.put(
            f"/api/v1/schedules/{schedule.id}",
            json=update_data,
            headers={"Authorization": f"Bearer {test_users['admin'].token}"}
        )
        
        assert response.status_code == 200
        assert response.json()["name"] == "Admin Updated Schedule"
    
    async def test_user_cannot_delete_others_schedule(
        self, test_client: AsyncClient, test_db: AsyncSession, test_users, test_report
    ):
        """Test that users cannot delete schedules they don't own."""
        # Create schedule as owner
        schedule = ExportSchedule(
            id=uuid4(),
            report_id=test_report.id,
            name="Owner's Schedule",
            created_by_id=test_users["owner"].id,
            schedule_config={"frequency": "daily", "cron_expression": "0 9 * * *", "timezone": "UTC"},
            distribution_config={"local": {"base_path": "/exports"}},
            export_config={"format": "csv"},
            is_active=True,
            next_run=datetime.now(pytz.UTC) + timedelta(days=1)
        )
        test_db.add(schedule)
        await test_db.commit()
        
        # Try to delete as different user
        response = await test_client.delete(
            f"/api/v1/schedules/{schedule.id}",
            headers={"Authorization": f"Bearer {test_users['other'].token}"}
        )
        
        assert response.status_code == 403
        
        # Verify schedule still exists
        result = await test_db.get(ExportSchedule, schedule.id)
        assert result is not None
    
    async def test_inactive_user_cannot_create_schedule(
        self, test_client: AsyncClient, test_report, test_users
    ):
        """Test that inactive users cannot create schedules."""
        schedule_data = {
            "report_id": str(test_report.id),
            "name": "Inactive User Schedule",
            "schedule_config": {
                "frequency": "daily",
                "cron_expression": "0 9 * * *",
                "timezone": "UTC"
            },
            "distribution_config": {"local": {"base_path": "/exports"}},
            "export_config": {"format": "csv"}
        }
        
        response = await test_client.post(
            "/api/v1/schedules/",
            json=schedule_data,
            headers={"Authorization": f"Bearer {test_users['inactive'].token}"}
        )
        
        assert response.status_code == 401
    
    async def test_user_cannot_read_others_schedule(
        self, test_client: AsyncClient, test_db: AsyncSession, test_users, test_report
    ):
        """Test that users cannot read schedules they don't own."""
        # Create schedule as owner
        schedule = ExportSchedule(
            id=uuid4(),
            report_id=test_report.id,
            name="Private Schedule",
            created_by_id=test_users["owner"].id,
            schedule_config={"frequency": "daily", "cron_expression": "0 9 * * *", "timezone": "UTC"},
            distribution_config={"local": {"base_path": "/exports"}},
            export_config={"format": "csv"},
            is_active=True,
            next_run=datetime.now(pytz.UTC) + timedelta(days=1)
        )
        test_db.add(schedule)
        await test_db.commit()
        
        # Try to read as different user
        response = await test_client.get(
            f"/api/v1/schedules/{schedule.id}",
            headers={"Authorization": f"Bearer {test_users['other'].token}"}
        )
        
        assert response.status_code in [403, 404]  # Either forbidden or not found is acceptable
    
    async def test_list_only_shows_users_own_schedules(
        self, test_client: AsyncClient, test_db: AsyncSession, test_users, test_report
    ):
        """Test that list endpoint only returns user's own schedules."""
        # Create schedules for different users
        owner_schedule = ExportSchedule(
            id=uuid4(),
            report_id=test_report.id,
            name="Owner's Schedule",
            created_by_id=test_users["owner"].id,
            schedule_config={"frequency": "daily", "cron_expression": "0 9 * * *", "timezone": "UTC"},
            distribution_config={"local": {"base_path": "/exports"}},
            export_config={"format": "csv"},
            is_active=True,
            next_run=datetime.now(pytz.UTC) + timedelta(days=1)
        )
        
        other_schedule = ExportSchedule(
            id=uuid4(),
            report_id=test_report.id,
            name="Other's Schedule",
            created_by_id=test_users["other"].id,
            schedule_config={"frequency": "daily", "cron_expression": "0 9 * * *", "timezone": "UTC"},
            distribution_config={"local": {"base_path": "/exports"}},
            export_config={"format": "csv"},
            is_active=True,
            next_run=datetime.now(pytz.UTC) + timedelta(days=1)
        )
        
        test_db.add(owner_schedule)
        test_db.add(other_schedule)
        await test_db.commit()
        
        # Get schedules as owner
        response = await test_client.get(
            "/api/v1/schedules/",
            headers={"Authorization": f"Bearer {test_users['owner'].token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should only see own schedule
        schedule_ids = [item["id"] for item in data["items"]]
        assert str(owner_schedule.id) in schedule_ids
        assert str(other_schedule.id) not in schedule_ids
    
    async def test_admin_can_see_all_schedules(
        self, test_client: AsyncClient, test_db: AsyncSession, test_users, test_report
    ):
        """Test that admin users can see all schedules."""
        # Create schedules for different users
        user_schedules = []
        for user_key in ["owner", "other"]:
            schedule = ExportSchedule(
                id=uuid4(),
                report_id=test_report.id,
                name=f"{user_key}'s Schedule",
                created_by_id=test_users[user_key].id,
                schedule_config={"frequency": "daily", "cron_expression": "0 9 * * *", "timezone": "UTC"},
                distribution_config={"local": {"base_path": "/exports"}},
                export_config={"format": "csv"},
                is_active=True,
                next_run=datetime.now(pytz.UTC) + timedelta(days=1)
            )
            test_db.add(schedule)
            user_schedules.append(schedule)
        
        await test_db.commit()
        
        # Get schedules as admin
        response = await test_client.get(
            "/api/v1/schedules/",
            headers={"Authorization": f"Bearer {test_users['admin'].token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Admin should see all schedules
        schedule_ids = [item["id"] for item in data["items"]]
        for schedule in user_schedules:
            assert str(schedule.id) in schedule_ids
    
    async def test_get_single_schedule_by_id(
        self, test_client: AsyncClient, test_db: AsyncSession, test_users, test_report
    ):
        """Test retrieving a single schedule by ID."""
        # Create schedule
        schedule = ExportSchedule(
            id=uuid4(),
            report_id=test_report.id,
            name="Test Schedule",
            description="Test description",
            created_by_id=test_users["owner"].id,
            schedule_config={"frequency": "daily", "cron_expression": "0 9 * * *", "timezone": "UTC"},
            distribution_config={"local": {"base_path": "/exports"}},
            export_config={"format": "csv", "include_headers": True},
            is_active=True,
            next_run=datetime.now(pytz.UTC) + timedelta(days=1)
        )
        test_db.add(schedule)
        await test_db.commit()
        
        # Get schedule by ID as owner
        response = await test_client.get(
            f"/api/v1/schedules/{schedule.id}",
            headers={"Authorization": f"Bearer {test_users['owner'].token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(schedule.id)
        assert data["name"] == "Test Schedule"
        assert data["description"] == "Test description"
        assert data["export_config"]["format"] == "csv"
        assert data["export_config"]["include_headers"] == True


class TestScheduleAPIFunctionality:
    """Test schedule API functionality with real database."""
    
    async def test_create_schedule_with_valid_data(
        self, test_client: AsyncClient, test_db: AsyncSession, test_users, test_report
    ):
        """Test creating a schedule with valid data."""
        schedule_data = {
            "report_id": str(test_report.id),
            "name": "Daily Report",
            "description": "Automated daily report",
            "schedule_config": {
                "frequency": "daily",
                "cron_expression": "0 9 * * *",
                "timezone": "America/New_York"
            },
            "distribution_config": {
                "local": {
                    "base_path": "/exports/scheduled",
                    "create_subdirs": True,
                    "filename_pattern": "{report_name}_{date}.{format}"
                }
            },
            "export_config": {
                "format": "excel",
                "include_headers": True,
                "compress": False
            },
            "is_active": True
        }
        
        response = await test_client.post(
            "/api/v1/schedules/",
            json=schedule_data,
            headers={"Authorization": f"Bearer {test_users['owner'].token}"}
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Daily Report"
        assert data["next_run"] is not None
        assert data["created_by_id"] == str(test_users["owner"].id)
        
        # Verify in database
        schedule = await test_db.get(ExportSchedule, data["id"])
        assert schedule is not None
        assert schedule.name == "Daily Report"
    
    async def test_create_schedule_with_invalid_cron(
        self, test_client: AsyncClient, test_users, test_report
    ):
        """Test that invalid cron expressions are rejected."""
        schedule_data = {
            "report_id": str(test_report.id),
            "name": "Invalid Cron Schedule",
            "schedule_config": {
                "frequency": "custom",
                "cron_expression": "invalid cron expression",
                "timezone": "UTC"
            },
            "distribution_config": {"local": {"base_path": "/exports"}},
            "export_config": {"format": "csv"}
        }
        
        response = await test_client.post(
            "/api/v1/schedules/",
            json=schedule_data,
            headers={"Authorization": f"Bearer {test_users['owner'].token}"}
        )
        
        assert response.status_code == 400
        assert "invalid cron" in response.json()["detail"].lower()
    
    async def test_user_schedule_limit_enforcement(
        self, test_client: AsyncClient, test_db: AsyncSession, test_users, test_report
    ):
        """Test that user schedule limits are enforced."""
        # Create maximum allowed schedules (assume limit is 10)
        for i in range(10):
            schedule = ExportSchedule(
                id=uuid4(),
                report_id=test_report.id,
                name=f"Schedule {i}",
                created_by_id=test_users["owner"].id,
                schedule_config={"frequency": "daily", "cron_expression": "0 9 * * *", "timezone": "UTC"},
                distribution_config={"local": {"base_path": "/exports"}},
                export_config={"format": "csv"},
                is_active=True,
                next_run=datetime.now(pytz.UTC) + timedelta(days=1)
            )
            test_db.add(schedule)
        await test_db.commit()
        
        # Try to create one more
        schedule_data = {
            "report_id": str(test_report.id),
            "name": "Exceeding Limit",
            "schedule_config": {
                "frequency": "daily",
                "cron_expression": "0 9 * * *",
                "timezone": "UTC"
            },
            "distribution_config": {"local": {"base_path": "/exports"}},
            "export_config": {"format": "csv"}
        }
        
        response = await test_client.post(
            "/api/v1/schedules/",
            json=schedule_data,
            headers={"Authorization": f"Bearer {test_users['owner'].token}"}
        )
        
        assert response.status_code == 400
        assert "limit" in response.json()["detail"].lower()
    
    async def test_get_schedules_pagination(
        self, test_client: AsyncClient, test_db: AsyncSession, test_users, test_report
    ):
        """Test schedule listing with pagination."""
        # Create 15 schedules
        for i in range(15):
            schedule = ExportSchedule(
                id=uuid4(),
                report_id=test_report.id,
                name=f"Schedule {i:02d}",
                created_by_id=test_users["owner"].id,
                schedule_config={"frequency": "daily", "cron_expression": "0 9 * * *", "timezone": "UTC"},
                distribution_config={"local": {"base_path": "/exports"}},
                export_config={"format": "csv"},
                is_active=True,
                next_run=datetime.now(pytz.UTC) + timedelta(days=1)
            )
            test_db.add(schedule)
        await test_db.commit()
        
        # Get first page
        response = await test_client.get(
            "/api/v1/schedules/?skip=0&limit=10",
            headers={"Authorization": f"Bearer {test_users['owner'].token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 10
        assert data["total"] == 15
        
        # Get second page
        response = await test_client.get(
            "/api/v1/schedules/?skip=10&limit=10",
            headers={"Authorization": f"Bearer {test_users['owner'].token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 5
        assert data["total"] == 15
    
    async def test_get_schedule_history(
        self, test_client: AsyncClient, test_db: AsyncSession, test_users, test_report
    ):
        """Test retrieving schedule execution history."""
        # Create schedule
        schedule = ExportSchedule(
            id=uuid4(),
            report_id=test_report.id,
            name="Schedule with History",
            created_by_id=test_users["owner"].id,
            schedule_config={"frequency": "daily", "cron_expression": "0 9 * * *", "timezone": "UTC"},
            distribution_config={"local": {"base_path": "/exports"}},
            export_config={"format": "csv"},
            is_active=True,
            next_run=datetime.now(pytz.UTC) + timedelta(days=1)
        )
        test_db.add(schedule)
        
        # Create execution history
        for i in range(5):
            execution = ScheduleExecution(
                id=uuid4(),
                schedule_id=schedule.id,
                started_at=datetime.now(pytz.UTC) - timedelta(days=i),
                completed_at=datetime.now(pytz.UTC) - timedelta(days=i, hours=-1),
                status="success" if i % 2 == 0 else "failed",
                error_message=None if i % 2 == 0 else f"Error {i}",
                export_id=uuid4() if i % 2 == 0 else None
            )
            test_db.add(execution)
        
        await test_db.commit()
        
        # Get history
        response = await test_client.get(
            f"/api/v1/schedules/{schedule.id}/history",
            headers={"Authorization": f"Bearer {test_users['owner'].token}"}
        )
        
        assert response.status_code == 200
        history = response.json()
        assert len(history) == 5
        assert sum(1 for h in history if h["status"] == "success") == 3
        assert sum(1 for h in history if h["status"] == "failed") == 2


class TestScheduleAPIEdgeCases:
    """Test edge cases and error conditions."""
    
    async def test_create_schedule_with_xss_payload(
        self, test_client: AsyncClient, test_users, test_report
    ):
        """Test that XSS payloads in text fields are properly handled."""
        xss_payloads = [
            "<script>alert('XSS')</script>",
            "javascript:alert('XSS')",
            "<img src=x onerror=alert('XSS')>",
            "<svg onload=alert('XSS')>"
        ]
        
        for payload in xss_payloads:
            schedule_data = {
                "report_id": str(test_report.id),
                "name": payload,
                "description": payload,
                "schedule_config": {
                    "frequency": "daily",
                    "cron_expression": "0 9 * * *",
                    "timezone": "UTC"
                },
                "distribution_config": {"local": {"base_path": "/exports"}},
                "export_config": {"format": "csv"}
            }
            
            response = await test_client.post(
                "/api/v1/schedules/",
                json=schedule_data,
                headers={"Authorization": f"Bearer {test_users['owner'].token}"}
            )
            
            # Should either sanitize or reject
            if response.status_code == 201:
                # If accepted, verify it was sanitized
                data = response.json()
                assert "<script>" not in data["name"]
                assert "javascript:" not in data["name"]
    
    async def test_concurrent_schedule_updates(
        self, test_client: AsyncClient, test_db: AsyncSession, test_users, test_report
    ):
        """Test handling of concurrent updates to the same schedule."""
        # Create schedule
        schedule = ExportSchedule(
            id=uuid4(),
            report_id=test_report.id,
            name="Concurrent Test",
            created_by_id=test_users["owner"].id,
            schedule_config={"frequency": "daily", "cron_expression": "0 9 * * *", "timezone": "UTC"},
            distribution_config={"local": {"base_path": "/exports"}},
            export_config={"format": "csv"},
            is_active=True,
            next_run=datetime.now(pytz.UTC) + timedelta(days=1)
        )
        test_db.add(schedule)
        await test_db.commit()
        
        # Attempt concurrent updates
        async def update_schedule(name: str):
            return await test_client.put(
                f"/api/v1/schedules/{schedule.id}",
                json={"name": name},
                headers={"Authorization": f"Bearer {test_users['owner'].token}"}
            )
        
        # Run updates concurrently
        results = await asyncio.gather(
            update_schedule("Update 1"),
            update_schedule("Update 2"),
            update_schedule("Update 3"),
            return_exceptions=True
        )
        
        # At least one should succeed
        success_count = sum(1 for r in results if not isinstance(r, Exception) and r.status_code == 200)
        assert success_count >= 1
    
    async def test_schedule_with_invalid_timezone(
        self, test_client: AsyncClient, test_users, test_report
    ):
        """Test that invalid timezones are rejected."""
        schedule_data = {
            "report_id": str(test_report.id),
            "name": "Invalid Timezone",
            "schedule_config": {
                "frequency": "daily",
                "cron_expression": "0 9 * * *",
                "timezone": "Invalid/Timezone"
            },
            "distribution_config": {"local": {"base_path": "/exports"}},
            "export_config": {"format": "csv"}
        }
        
        response = await test_client.post(
            "/api/v1/schedules/",
            json=schedule_data,
            headers={"Authorization": f"Bearer {test_users['owner'].token}"}
        )
        
        assert response.status_code == 400
        assert "timezone" in response.json()["detail"].lower()