"""
Schedule models for the export scheduling system
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Integer, JSON, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from croniter import croniter
import pytz

from app.core.database import Base


class ExportSchedule(Base):
    """Model for scheduled export configurations"""
    __tablename__ = "export_schedules"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id = Column(UUID(as_uuid=True), ForeignKey("reports.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Basic information
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    
    # Schedule configuration
    schedule_config = Column(JSON, nullable=False)  # {cron: "0 0 * * *", timezone: "UTC"}
    distribution_config = Column(JSON, nullable=False)  # {local: {path: "/exports"}, email: {...}}
    filter_config = Column(JSON, nullable=True)  # Report filters/parameters
    export_config = Column(JSON, nullable=True)  # {format: "excel", options: {...}}
    
    # Status fields
    is_active = Column(Boolean, default=True, nullable=False)
    is_paused = Column(Boolean, default=False, nullable=False)
    
    # Execution tracking
    last_run = Column(DateTime(timezone=True), nullable=True)
    next_run = Column(DateTime(timezone=True), nullable=True)
    run_count = Column(Integer, default=0, nullable=False)
    success_count = Column(Integer, default=0, nullable=False)
    failure_count = Column(Integer, default=0, nullable=False)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=True, onupdate=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Relationships
    report = relationship("Report", foreign_keys=[report_id])
    user = relationship("User", foreign_keys=[user_id])
    creator = relationship("User", foreign_keys=[created_by])
    executions = relationship("ScheduleExecution", back_populates="schedule", cascade="all, delete-orphan")
    
    def calculate_next_run(self, from_time: Optional[datetime] = None) -> Optional[datetime]:
        """Calculate the next run time based on cron expression"""
        if not self.is_active or self.is_paused:
            return None
            
        cron_expr = self.schedule_config.get("cron")
        timezone_str = self.schedule_config.get("timezone", "UTC")
        
        if not cron_expr:
            return None
            
        try:
            tz = pytz.timezone(timezone_str)
            base_time = from_time or datetime.now(tz)
            
            # Convert to timezone-aware if needed
            if base_time.tzinfo is None:
                base_time = tz.localize(base_time)
            
            cron = croniter(cron_expr, base_time)
            next_time = cron.get_next(datetime)
            
            return next_time
        except Exception:
            return None
    
    def should_run_now(self) -> bool:
        """Check if the schedule should run now"""
        if not self.is_active or self.is_paused:
            return False
            
        if not self.next_run:
            return False
            
        # Add a small buffer (1 minute) to handle timing discrepancies
        return datetime.now(pytz.UTC) >= self.next_run - timedelta(minutes=1)
    
    def update_after_execution(self, success: bool):
        """Update schedule statistics after execution"""
        self.last_run = datetime.now(pytz.UTC)
        self.run_count += 1
        
        if success:
            self.success_count += 1
        else:
            self.failure_count += 1
        
        # Calculate next run
        self.next_run = self.calculate_next_run(from_time=self.last_run)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses"""
        return {
            "id": str(self.id),
            "report_id": str(self.report_id),
            "user_id": str(self.user_id),
            "name": self.name,
            "description": self.description,
            "schedule_config": self.schedule_config,
            "distribution_config": self.distribution_config,
            "filter_config": self.filter_config,
            "export_config": self.export_config,
            "is_active": self.is_active,
            "is_paused": self.is_paused,
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "next_run": self.next_run.isoformat() if self.next_run else None,
            "run_count": self.run_count,
            "success_count": self.success_count,
            "failure_count": self.failure_count,
            "success_rate": (self.success_count / self.run_count * 100) if self.run_count > 0 else 0,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class ScheduleExecution(Base):
    """Model for tracking schedule execution history"""
    __tablename__ = "schedule_executions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    schedule_id = Column(UUID(as_uuid=True), ForeignKey("export_schedules.id", ondelete="CASCADE"), nullable=False)
    export_id = Column(UUID(as_uuid=True), ForeignKey("exports.id", ondelete="SET NULL"), nullable=True)
    
    # Execution details
    started_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), nullable=False, default="pending")  # pending, running, success, failed, cancelled
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    
    # Distribution results
    distribution_results = Column(JSON, nullable=True)  # {channel: {status, message, details}}
    
    # Celery task tracking
    task_id = Column(String, nullable=True)
    
    # Relationships
    schedule = relationship("ExportSchedule", back_populates="executions")
    export = relationship("Export", foreign_keys=[export_id])
    
    def mark_running(self, task_id: Optional[str] = None):
        """Mark execution as running"""
        self.status = "running"
        self.task_id = task_id
    
    def mark_success(self, export_id: Optional[str] = None, distribution_results: Optional[Dict] = None):
        """Mark execution as successful"""
        self.status = "success"
        self.completed_at = datetime.utcnow()
        if export_id:
            self.export_id = export_id
        if distribution_results:
            self.distribution_results = distribution_results
    
    def mark_failed(self, error_message: str, distribution_results: Optional[Dict] = None):
        """Mark execution as failed"""
        self.status = "failed"
        self.completed_at = datetime.utcnow()
        self.error_message = error_message
        if distribution_results:
            self.distribution_results = distribution_results
    
    @property
    def duration(self) -> Optional[timedelta]:
        """Calculate execution duration"""
        if self.completed_at and self.started_at:
            return self.completed_at - self.started_at
        return None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses"""
        return {
            "id": str(self.id),
            "schedule_id": str(self.schedule_id),
            "export_id": str(self.export_id) if self.export_id else None,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "status": self.status,
            "error_message": self.error_message,
            "retry_count": self.retry_count,
            "distribution_results": self.distribution_results,
            "task_id": self.task_id,
            "duration_seconds": self.duration.total_seconds() if self.duration else None
        }


class DistributionTemplate(Base):
    """Model for reusable distribution configurations"""
    __tablename__ = "distribution_templates"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    type = Column(String(50), nullable=False)  # email, sftp, webhook, cloud, local
    config = Column(JSON, nullable=False)  # Type-specific configuration
    is_default = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=True, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses"""
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "name": self.name,
            "type": self.type,
            "config": self.config,
            "is_default": self.is_default,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }