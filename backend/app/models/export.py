"""
Export model for tracking export jobs
"""

from uuid import UUID
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any

from sqlalchemy import (
    Column, String, ForeignKey, DateTime, 
    Enum as SQLEnum, Text, BigInteger, JSON
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class ExportStatus(str, Enum):
    """Export job status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ExportFormat(str, Enum):
    """Supported export formats"""
    CSV = "csv"
    EXCEL = "excel"
    PDF = "pdf"
    JSON = "json"


class Export(Base):
    """Export job tracking model"""
    __tablename__ = "exports"
    
    id = Column(PGUUID(as_uuid=True), primary_key=True)
    report_id = Column(PGUUID(as_uuid=True), ForeignKey("reports.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Export configuration
    format = Column(SQLEnum(ExportFormat), nullable=False)
    parameters = Column(JSON, nullable=True)  # Stores filters, options, etc.
    
    # Status tracking
    status = Column(SQLEnum(ExportStatus), default=ExportStatus.PENDING, nullable=False)
    task_id = Column(String(255), nullable=True)  # Celery task ID
    
    # File information
    file_path = Column(Text, nullable=True)
    file_size = Column(BigInteger, nullable=True)  # Size in bytes
    
    # Error tracking
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)  # When the file will be deleted
    
    # Relationships
    report = relationship("Report", back_populates="exports")
    user = relationship("User", back_populates="exports")