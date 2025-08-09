"""
Comprehensive unit tests for Phase 5 scheduling functionality.
Tests cover schedule CRUD, distribution, and execution logic.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock, AsyncMock
from uuid import UUID, uuid4
import json
import pytz
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from fastapi import HTTPException
from pydantic import ValidationError

from app.models.schedule import ExportSchedule, ScheduleExecution, DistributionTemplate
from app.models.report import Report
from app.models.user import User
from app.schemas.schedule import (
    ScheduleCreate, ScheduleUpdate, ScheduleResponse,
    DistributionConfig, ScheduleConfig, ExportConfig,
    EmailDistributionConfig, LocalDistributionConfig
)
from app.api.schedule.schedule import (
    create_schedule, get_schedules, update_schedule,
    delete_schedule, pause_schedule, resume_schedule,
    test_schedule, get_schedule_history
)
from app.services.distribution_service import DistributionService
from app.tasks.schedule_tasks import check_and_execute_schedules, execute_scheduled_report


class TestScheduleAPI:
    """Test schedule CRUD API endpoints."""
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database session."""
        db = AsyncMock(spec=AsyncSession)
        return db
    
    @pytest.fixture
    def mock_user(self):
        """Create mock authenticated user."""
        user = Mock(spec=User)
        user.id = uuid4()
        user.email = "test@example.com"
        user.is_active = True
        return user
    
    @pytest.fixture
    def mock_report(self):
        """Create mock report."""
        report = Mock(spec=Report)
        report.id = uuid4()
        report.name = "Test Report"
        report.created_by_id = uuid4()
        return report
    
    @pytest.fixture
    def valid_schedule_data(self):
        """Valid schedule creation data."""
        return {
            "report_id": str(uuid4()),
            "name": "Daily Sales Report",
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
    
    @pytest.mark.asyncio
    async def test_create_schedule_success(self, mock_db, mock_user, mock_report, valid_schedule_data):
        """Test successful schedule creation."""
        # Setup mocks
        mock_db.execute.return_value.scalar_one_or_none.return_value = mock_report
        mock_db.execute.return_value.scalars.return_value.all.return_value = []  # No existing schedules
        mock_db.add = Mock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()
        
        schedule_create = ScheduleCreate(**valid_schedule_data)
        
        # Execute
        with patch('app.api.schedule.schedule.calculate_next_run') as mock_calc:
            mock_calc.return_value = datetime.now(pytz.UTC) + timedelta(days=1)
            
            result = await create_schedule(
                schedule=schedule_create,
                db=mock_db,
                current_user=mock_user
            )
        
        # Verify
        assert mock_db.add.called
        assert mock_db.commit.called
        mock_calc.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_create_schedule_limit_exceeded(self, mock_db, mock_user, valid_schedule_data):
        """Test schedule creation when user limit is exceeded."""
        # Setup - user already has 10 schedules
        existing_schedules = [Mock(spec=ExportSchedule) for _ in range(10)]
        mock_db.execute.return_value.scalars.return_value.all.return_value = existing_schedules
        
        schedule_create = ScheduleCreate(**valid_schedule_data)
        
        # Execute and verify
        with pytest.raises(HTTPException) as exc_info:
            await create_schedule(
                schedule=schedule_create,
                db=mock_db,
                current_user=mock_user
            )
        
        assert exc_info.value.status_code == 400
        assert "limit" in str(exc_info.value.detail).lower()
    
    @pytest.mark.asyncio
    async def test_create_schedule_invalid_cron(self, mock_db, mock_user, mock_report, valid_schedule_data):
        """Test schedule creation with invalid cron expression."""
        # Modify data with invalid cron
        valid_schedule_data["schedule_config"]["cron_expression"] = "invalid cron"
        mock_db.execute.return_value.scalar_one_or_none.return_value = mock_report
        mock_db.execute.return_value.scalars.return_value.all.return_value = []
        
        schedule_create = ScheduleCreate(**valid_schedule_data)
        
        # Execute and verify
        with pytest.raises(HTTPException) as exc_info:
            await create_schedule(
                schedule=schedule_create,
                db=mock_db,
                current_user=mock_user
            )
        
        assert exc_info.value.status_code == 400
        assert "cron" in str(exc_info.value.detail).lower()
    
    @pytest.mark.asyncio
    async def test_update_schedule_success(self, mock_db, mock_user):
        """Test successful schedule update."""
        # Setup
        schedule_id = uuid4()
        existing_schedule = Mock(spec=ExportSchedule)
        existing_schedule.id = schedule_id
        existing_schedule.created_by_id = mock_user.id
        existing_schedule.is_active = True
        
        mock_db.execute.return_value.scalar_one_or_none.return_value = existing_schedule
        mock_db.commit = AsyncMock()
        
        update_data = ScheduleUpdate(
            name="Updated Schedule",
            is_active=False
        )
        
        # Execute
        result = await update_schedule(
            schedule_id=schedule_id,
            schedule=update_data,
            db=mock_db,
            current_user=mock_user
        )
        
        # Verify
        assert existing_schedule.name == "Updated Schedule"
        assert existing_schedule.is_active == False
        assert mock_db.commit.called
    
    @pytest.mark.asyncio
    async def test_delete_schedule_cascade(self, mock_db, mock_user):
        """Test schedule deletion with cascade to executions."""
        # Setup
        schedule_id = uuid4()
        schedule = Mock(spec=ExportSchedule)
        schedule.id = schedule_id
        schedule.created_by_id = mock_user.id
        
        executions = [Mock(spec=ScheduleExecution) for _ in range(3)]
        
        mock_db.execute.return_value.scalar_one_or_none.return_value = schedule
        mock_db.execute.return_value.scalars.return_value.all.return_value = executions
        mock_db.delete = Mock()
        mock_db.commit = AsyncMock()
        
        # Execute
        await delete_schedule(
            schedule_id=schedule_id,
            db=mock_db,
            current_user=mock_user
        )
        
        # Verify
        assert mock_db.delete.call_count == 4  # 1 schedule + 3 executions
        assert mock_db.commit.called
    
    @pytest.mark.asyncio
    async def test_pause_resume_schedule(self, mock_db, mock_user):
        """Test pausing and resuming a schedule."""
        # Setup
        schedule_id = uuid4()
        schedule = Mock(spec=ExportSchedule)
        schedule.id = schedule_id
        schedule.created_by_id = mock_user.id
        schedule.is_active = True
        
        mock_db.execute.return_value.scalar_one_or_none.return_value = schedule
        mock_db.commit = AsyncMock()
        
        # Test pause
        await pause_schedule(schedule_id, mock_db, mock_user)
        assert schedule.is_active == False
        assert mock_db.commit.called
        
        # Test resume
        schedule.is_active = False
        with patch('app.api.schedule.schedule.calculate_next_run') as mock_calc:
            mock_calc.return_value = datetime.now(pytz.UTC) + timedelta(hours=1)
            await resume_schedule(schedule_id, mock_db, mock_user)
        
        assert schedule.is_active == True
        assert schedule.next_run is not None


class TestDistributionService:
    """Test distribution service functionality."""
    
    @pytest.fixture
    def distribution_service(self):
        """Create distribution service instance."""
        return DistributionService()
    
    @pytest.fixture
    def mock_export(self):
        """Create mock export."""
        export = Mock()
        export.id = uuid4()
        export.file_path = "/exports/test_report.xlsx"
        export.format = "excel"
        export.created_at = datetime.now()
        return export
    
    @pytest.mark.asyncio
    async def test_distribute_local_success(self, distribution_service, mock_export, tmp_path):
        """Test successful local file distribution."""
        # Setup
        config = LocalDistributionConfig(
            base_path=str(tmp_path),
            create_subdirs=True,
            filename_pattern="{report_name}_{timestamp}.{format}"
        )
        
        # Create mock file
        source_file = tmp_path / "source.xlsx"
        source_file.write_text("test content")
        mock_export.file_path = str(source_file)
        
        # Execute
        with patch('shutil.copy2') as mock_copy:
            result = await distribution_service.distribute_local(
                export=mock_export,
                config=config,
                report_name="TestReport"
            )
        
        # Verify
        assert result["status"] == "success"
        assert "file_path" in result
        mock_copy.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_distribute_local_path_traversal_prevention(self, distribution_service, mock_export):
        """Test that path traversal attempts are prevented."""
        # Setup with malicious path
        config = LocalDistributionConfig(
            base_path="/exports",
            create_subdirs=False,
            filename_pattern="../../../etc/passwd"
        )
        
        # Execute and verify
        with pytest.raises(ValueError) as exc_info:
            await distribution_service.distribute_local(
                export=mock_export,
                config=config,
                report_name="TestReport"
            )
        
        assert "Invalid path" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_distribute_email_with_attachments(self, distribution_service, mock_export):
        """Test email distribution with attachments."""
        # Setup
        config = EmailDistributionConfig(
            recipients=["user1@example.com", "user2@example.com"],
            subject="Daily Report",
            body="Please find attached the daily report.",
            attach_report=True,
            smtp_config={
                "host": "smtp.example.com",
                "port": 587,
                "username": "sender@example.com",
                "password": "encrypted_password"
            }
        )
        
        # Mock email service
        with patch('app.services.distribution_service.EmailService') as MockEmailService:
            mock_email_service = MockEmailService.return_value
            mock_email_service.send_with_attachment = AsyncMock(return_value={"status": "sent"})
            
            # Execute
            result = await distribution_service.distribute_email(
                export=mock_export,
                config=config,
                report_name="TestReport"
            )
        
        # Verify
        assert result["status"] == "success"
        assert result["recipients_count"] == 2
        mock_email_service.send_with_attachment.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_distribute_with_retry_on_failure(self, distribution_service, mock_export):
        """Test distribution retry logic on failure."""
        # Setup
        config = LocalDistributionConfig(
            base_path="/exports",
            create_subdirs=True,
            filename_pattern="report.xlsx"
        )
        
        # Mock copy to fail twice then succeed
        with patch('shutil.copy2') as mock_copy:
            mock_copy.side_effect = [OSError("Disk full"), OSError("Disk full"), None]
            
            with patch('asyncio.sleep') as mock_sleep:
                result = await distribution_service.distribute_with_retry(
                    export=mock_export,
                    config={"local": config.dict()},
                    report_name="TestReport",
                    max_retries=3
                )
        
        # Verify
        assert mock_copy.call_count == 3
        assert mock_sleep.call_count == 2  # Sleep between retries


class TestScheduleTasks:
    """Test Celery schedule tasks."""
    
    @pytest.fixture
    def mock_session(self):
        """Create mock database session."""
        session = Mock(spec=Session)
        return session
    
    @patch('app.tasks.schedule_tasks.SessionLocal')
    @patch('app.tasks.schedule_tasks.execute_scheduled_report.delay')
    def test_check_and_execute_schedules(self, mock_execute, mock_session_local):
        """Test schedule checking and execution task."""
        # Setup
        mock_session = Mock()
        mock_session_local.return_value.__enter__.return_value = mock_session
        
        # Create mock schedules
        schedule1 = Mock(spec=ExportSchedule)
        schedule1.id = uuid4()
        schedule1.is_active = True
        schedule1.next_run = datetime.now(pytz.UTC) - timedelta(minutes=5)  # Past due
        
        schedule2 = Mock(spec=ExportSchedule)
        schedule2.id = uuid4()
        schedule2.is_active = True
        schedule2.next_run = datetime.now(pytz.UTC) + timedelta(hours=1)  # Future
        
        mock_session.query.return_value.filter.return_value.all.return_value = [schedule1, schedule2]
        
        # Execute
        check_and_execute_schedules()
        
        # Verify - only schedule1 should be executed
        mock_execute.assert_called_once_with(str(schedule1.id))
    
    @patch('app.tasks.schedule_tasks.SessionLocal')
    @patch('app.tasks.schedule_tasks.ReportService')
    @patch('app.tasks.schedule_tasks.DistributionService')
    def test_execute_scheduled_report_success(self, mock_dist_service, mock_report_service, mock_session_local):
        """Test successful scheduled report execution."""
        # Setup
        mock_session = Mock()
        mock_session_local.return_value.__enter__.return_value = mock_session
        
        schedule_id = uuid4()
        schedule = Mock(spec=ExportSchedule)
        schedule.id = schedule_id
        schedule.report_id = uuid4()
        schedule.export_config = {"format": "pdf", "include_headers": True}
        schedule.distribution_config = {"local": {"base_path": "/exports"}}
        schedule.schedule_config = {"cron_expression": "0 9 * * *", "timezone": "UTC"}
        
        mock_session.query.return_value.filter.return_value.first.return_value = schedule
        
        # Mock report service
        mock_export = Mock()
        mock_export.id = uuid4()
        mock_report_service.return_value.generate_export = AsyncMock(return_value=mock_export)
        
        # Mock distribution
        mock_dist_service.return_value.distribute = AsyncMock(return_value={"status": "success"})
        
        # Execute
        with patch('app.tasks.schedule_tasks.calculate_next_run') as mock_calc:
            mock_calc.return_value = datetime.now(pytz.UTC) + timedelta(days=1)
            execute_scheduled_report(str(schedule_id))
        
        # Verify
        mock_report_service.return_value.generate_export.assert_called_once()
        mock_dist_service.return_value.distribute.assert_called_once()
        assert schedule.last_run is not None
        assert schedule.next_run is not None
        mock_session.commit.assert_called()
    
    @patch('app.tasks.schedule_tasks.SessionLocal')
    def test_execute_scheduled_report_failure_tracking(self, mock_session_local):
        """Test that failures are properly tracked in executions."""
        # Setup
        mock_session = Mock()
        mock_session_local.return_value.__enter__.return_value = mock_session
        
        schedule_id = uuid4()
        schedule = Mock(spec=ExportSchedule)
        schedule.id = schedule_id
        
        mock_session.query.return_value.filter.return_value.first.return_value = schedule
        mock_session.add = Mock()
        
        # Mock report service to fail
        with patch('app.tasks.schedule_tasks.ReportService') as mock_report_service:
            mock_report_service.return_value.generate_export = AsyncMock(
                side_effect=Exception("Export failed")
            )
            
            # Execute - should not raise
            execute_scheduled_report(str(schedule_id))
        
        # Verify execution was tracked
        add_calls = mock_session.add.call_args_list
        assert len(add_calls) > 0
        execution = add_calls[0][0][0]
        assert isinstance(execution, ScheduleExecution)
        assert execution.status == "failed"
        assert "Export failed" in execution.error_message


class TestEnhancedSecurity:
    """Test enhanced security service."""
    
    @pytest.fixture
    def security_service(self):
        """Create security service instance."""
        from app.services.enhanced_security_service import EnhancedSecurityService
        return EnhancedSecurityService()
    
    def test_encrypt_decrypt_credentials(self, security_service):
        """Test credential encryption and decryption."""
        # Test data
        original = "sensitive_password_123"
        
        # Encrypt
        encrypted = security_service.encrypt_credential(original)
        assert encrypted != original
        assert ":" in encrypted  # Should contain salt separator
        
        # Decrypt
        decrypted = security_service.decrypt_credential(encrypted)
        assert decrypted == original
    
    def test_encrypt_with_different_salts(self, security_service):
        """Test that each encryption uses a unique salt."""
        original = "test_password"
        
        # Encrypt same value twice
        encrypted1 = security_service.encrypt_credential(original)
        encrypted2 = security_service.encrypt_credential(original)
        
        # Should produce different encrypted values due to different salts
        assert encrypted1 != encrypted2
        
        # But both should decrypt to original
        assert security_service.decrypt_credential(encrypted1) == original
        assert security_service.decrypt_credential(encrypted2) == original
    
    def test_sanitize_config_for_frontend(self, security_service):
        """Test that sensitive data is properly sanitized for frontend."""
        # Test config with sensitive data
        config = {
            "smtp_config": {
                "host": "smtp.example.com",
                "port": 587,
                "username": "user@example.com",
                "password": "secret_password",
                "api_key": "secret_api_key"
            },
            "other_data": "non-sensitive"
        }
        
        # Sanitize
        sanitized = security_service.sanitize_for_frontend(config)
        
        # Verify
        assert sanitized["smtp_config"]["host"] == "smtp.example.com"
        assert sanitized["smtp_config"]["password"] == "***"
        assert sanitized["smtp_config"]["api_key"] == "***"
        assert sanitized["other_data"] == "non-sensitive"
    
    def test_validate_email_addresses(self, security_service):
        """Test email validation."""
        # Valid emails
        assert security_service.validate_email("user@example.com") == True
        assert security_service.validate_email("user.name+tag@example.co.uk") == True
        
        # Invalid emails
        assert security_service.validate_email("invalid") == False
        assert security_service.validate_email("@example.com") == False
        assert security_service.validate_email("user@") == False
    
    def test_validate_cron_expression(self, security_service):
        """Test cron expression validation."""
        # Valid cron expressions
        assert security_service.validate_cron("0 9 * * *") == True
        assert security_service.validate_cron("*/15 * * * *") == True
        assert security_service.validate_cron("0 0 * * MON-FRI") == True
        
        # Invalid cron expressions
        assert security_service.validate_cron("invalid") == False
        assert security_service.validate_cron("60 * * * *") == False  # Invalid minute
        assert security_service.validate_cron("* * * *") == False  # Too few fields


class TestCacheService:
    """Test enhanced cache service."""
    
    @pytest.fixture
    def cache_service(self):
        """Create cache service instance."""
        from app.services.enhanced_cache_service import EnhancedCacheService
        with patch('redis.Redis'):
            return EnhancedCacheService()
    
    @pytest.mark.asyncio
    async def test_cache_key_generation(self, cache_service):
        """Test cache key generation with parameters."""
        # Generate key
        key = cache_service.generate_key(
            prefix="schedules",
            user_id="user123",
            page=1,
            limit=20,
            filters={"status": "active"}
        )
        
        # Verify key structure
        assert key.startswith("schedules:")
        assert "user123" in key
        assert "page:1" in key
        assert "limit:20" in key
        assert "status:active" in key
    
    @pytest.mark.asyncio
    async def test_cache_aside_pattern(self, cache_service):
        """Test cache-aside pattern implementation."""
        # Mock Redis
        cache_service.redis.get.return_value = None  # Cache miss
        cache_service.redis.setex = Mock()
        
        # Mock data fetcher
        async def fetch_data():
            return {"data": "test_value"}
        
        # Execute
        result = await cache_service.get_or_set(
            key="test_key",
            fetcher=fetch_data,
            ttl=300
        )
        
        # Verify
        assert result == {"data": "test_value"}
        cache_service.redis.setex.assert_called_once_with(
            "test_key",
            300,
            '{"data": "test_value"}'
        )
    
    @pytest.mark.asyncio
    async def test_cache_invalidation_pattern(self, cache_service):
        """Test cache invalidation with pattern matching."""
        # Mock Redis SCAN
        cache_service.redis.scan_iter.return_value = [
            "schedules:user123:page:1",
            "schedules:user123:page:2",
            "schedules:user456:page:1"
        ]
        cache_service.redis.delete = Mock()
        
        # Invalidate user's schedules
        await cache_service.invalidate_pattern("schedules:user123:*")
        
        # Verify only user123's keys were deleted
        assert cache_service.redis.delete.call_count == 1
        deleted_keys = cache_service.redis.delete.call_args[0]
        assert len(deleted_keys) == 2
        assert all("user123" in key for key in deleted_keys)


class TestReliableTasks:
    """Test reliable task execution with retries and DLQ."""
    
    @patch('app.tasks.enhanced_tasks.redis_client')
    def test_task_with_exponential_backoff(self, mock_redis):
        """Test task retry with exponential backoff."""
        from app.tasks.enhanced_tasks import ReliableTask
        
        # Create task instance
        task = ReliableTask()
        task.request = Mock()
        task.request.retries = 2
        
        # Calculate backoff
        backoff = task.calculate_backoff()
        
        # Verify exponential backoff with jitter
        # For retry 2: base is 2^2 = 4 seconds, with jitter should be 3.6-4.4
        assert 3.6 <= backoff <= 4.4
    
    @patch('app.tasks.enhanced_tasks.redis_client')
    def test_dead_letter_queue_on_final_failure(self, mock_redis):
        """Test that failed tasks are sent to DLQ."""
        from app.tasks.enhanced_tasks import ReliableTask
        
        # Create task
        task = ReliableTask()
        task.name = "test_task"
        task.request = Mock()
        task.request.id = "task123"
        task.request.retries = 3  # Max retries reached
        
        # Send to DLQ
        task.send_to_dlq(
            task_id="task123",
            error="Test error",
            args=["arg1"],
            kwargs={"key": "value"}
        )
        
        # Verify Redis calls
        mock_redis.hset.assert_called_once()
        call_args = mock_redis.hset.call_args[0]
        assert call_args[0] == "dlq:test_task"
        assert call_args[1] == "task123"
        
        # Verify DLQ data structure
        dlq_data = json.loads(call_args[2])
        assert dlq_data["error"] == "Test error"
        assert dlq_data["args"] == ["arg1"]
        assert dlq_data["kwargs"] == {"key": "value"}
        assert dlq_data["retries"] == 3
    
    def test_circuit_breaker_opens_on_failures(self):
        """Test circuit breaker opens after threshold failures."""
        from app.tasks.enhanced_tasks import CircuitBreaker
        
        # Create circuit breaker
        breaker = CircuitBreaker(
            name="test_service",
            failure_threshold=3,
            recovery_timeout=60
        )
        
        # Record failures
        for _ in range(3):
            breaker.record_failure()
        
        # Verify circuit is open
        assert breaker.is_open() == True
        
        # Test that calls are rejected when open
        with pytest.raises(Exception) as exc_info:
            breaker.call(lambda: "test")
        assert "Circuit breaker is open" in str(exc_info.value)
    
    def test_circuit_breaker_recovery(self):
        """Test circuit breaker recovery after timeout."""
        from app.tasks.enhanced_tasks import CircuitBreaker
        from datetime import datetime, timedelta
        
        # Create circuit breaker with short recovery
        breaker = CircuitBreaker(
            name="test_service",
            failure_threshold=2,
            recovery_timeout=1  # 1 second
        )
        
        # Open the circuit
        breaker.record_failure()
        breaker.record_failure()
        assert breaker.is_open() == True
        
        # Mock time passage
        with patch('app.tasks.enhanced_tasks.datetime') as mock_datetime:
            mock_datetime.now.return_value = datetime.now() + timedelta(seconds=2)
            
            # Circuit should allow retry
            assert breaker.is_open() == False
            
            # Successful call should reset
            result = breaker.call(lambda: "success")
            assert result == "success"
            assert breaker.failure_count == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--cov=app", "--cov-report=term-missing"])