"""
Scheduling and distribution models
"""

from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer, JSON, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class ScheduleStatus(enum.Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    DISABLED = "disabled"
    COMPLETED = "completed"


class DistributionType(enum.Enum):
    EMAIL = "email"
    FILE_SYSTEM = "file_system"
    SFTP = "sftp"
    S3 = "s3"
    API_WEBHOOK = "api_webhook"


class Schedule(Base):
    __tablename__ = 'schedules'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    report_id = Column(UUID(as_uuid=True), ForeignKey('reports.id', ondelete='CASCADE'), nullable=False)
    owner_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'))
    
    # Schedule configuration
    cron_expression = Column(String(100))  # Standard cron format
    timezone = Column(String(50), default='UTC')
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    
    # Execution settings
    status = Column(Enum(ScheduleStatus), default=ScheduleStatus.ACTIVE)
    max_retries = Column(Integer, default=3)
    retry_delay_seconds = Column(Integer, default=300)  # 5 minutes
    timeout_seconds = Column(Integer, default=3600)  # 1 hour
    
    # Output settings
    output_formats = Column(JSON, nullable=False)  # List of formats: ['csv', 'xlsx', 'pdf']
    parameters = Column(JSON)  # Default parameters for report execution
    
    # Tracking
    last_run = Column(DateTime)
    next_run = Column(DateTime)
    run_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    report = relationship('Report', back_populates='schedules')
    distributions = relationship('Distribution', back_populates='schedule', cascade='all, delete-orphan')
    executions = relationship('ReportExecution', back_populates='schedule')


class Distribution(Base):
    __tablename__ = 'distributions'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    schedule_id = Column(UUID(as_uuid=True), ForeignKey('schedules.id', ondelete='CASCADE'), nullable=False)
    distribution_type = Column(Enum(DistributionType), nullable=False)
    
    # Configuration (stored as JSON for flexibility)
    config = Column(JSON, nullable=False)
    """
    Example configs:
    Email: {
        "recipients": ["user@example.com"],
        "cc": [],
        "bcc": [],
        "subject": "Report: {{report_name}}",
        "body": "Please find attached the report.",
        "attach_report": true
    }
    File System: {
        "path": "/reports/{{date}}/{{report_name}}.{{format}}",
        "create_directories": true,
        "overwrite": false
    }
    SFTP: {
        "host": "sftp.example.com",
        "port": 22,
        "username": "user",
        "password": "encrypted",
        "remote_path": "/uploads/",
        "filename_pattern": "{{report_name}}_{{timestamp}}.{{format}}"
    }
    """
    
    # Bursting configuration
    is_bursting = Column(Boolean, default=False)
    burst_field_id = Column(UUID(as_uuid=True), ForeignKey('fields.id', ondelete='SET NULL'))
    burst_config = Column(JSON)  # Additional bursting rules
    
    # Status tracking
    is_active = Column(Boolean, default=True)
    last_success = Column(DateTime)
    last_failure = Column(DateTime)
    failure_message = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    schedule = relationship('Schedule', back_populates='distributions')


class ScheduleLog(Base):
    __tablename__ = 'schedule_logs'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    schedule_id = Column(UUID(as_uuid=True), ForeignKey('schedules.id', ondelete='CASCADE'), nullable=False)
    execution_id = Column(UUID(as_uuid=True), ForeignKey('report_executions.id', ondelete='CASCADE'))
    
    # Log details
    event_type = Column(String(50), nullable=False)  # started, completed, failed, retry, etc.
    message = Column(Text)
    details = Column(JSON)  # Additional structured data
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)