"""
Report and query related models
"""

from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer, JSON, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class ReportType(enum.Enum):
    STANDARD = "standard"
    DASHBOARD = "dashboard"
    TEMPLATE = "template"


class Report(Base):
    __tablename__ = 'reports'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    report_type = Column(Enum(ReportType), default=ReportType.STANDARD)
    owner_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'))
    folder_id = Column(UUID(as_uuid=True), ForeignKey('folders.id', ondelete='SET NULL'))
    
    # Report definition stored as JSON
    definition = Column(JSON, nullable=False)  # Contains sections, fields, filters, etc.
    
    # Versioning
    version = Column(Integer, default=1, nullable=False)
    is_published = Column(Boolean, default=False)
    is_template = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_executed = Column(DateTime)
    
    # Relationships
    owner = relationship('User', back_populates='reports')
    folder = relationship('Folder', back_populates='reports')
    versions = relationship('ReportVersion', back_populates='report', cascade='all, delete-orphan')
    schedules = relationship('Schedule', back_populates='report', cascade='all, delete-orphan')
    executions = relationship('ReportExecution', back_populates='report', cascade='all, delete-orphan')


class ReportVersion(Base):
    __tablename__ = 'report_versions'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    report_id = Column(UUID(as_uuid=True), ForeignKey('reports.id', ondelete='CASCADE'), nullable=False)
    version_number = Column(Integer, nullable=False)
    definition = Column(JSON, nullable=False)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'))
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    comment = Column(Text)
    
    # Relationships
    report = relationship('Report', back_populates='versions')


class Folder(Base):
    __tablename__ = 'folders'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey('folders.id', ondelete='CASCADE'))
    owner_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'))
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    reports = relationship('Report', back_populates='folder')
    children = relationship('Folder')


class ReportExecution(Base):
    __tablename__ = 'report_executions'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    report_id = Column(UUID(as_uuid=True), ForeignKey('reports.id', ondelete='CASCADE'), nullable=False)
    schedule_id = Column(UUID(as_uuid=True), ForeignKey('schedules.id', ondelete='SET NULL'))
    executed_by_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'))
    
    # Execution details
    status = Column(String(50), nullable=False)  # pending, running, completed, failed
    started_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime)
    duration_ms = Column(Integer)
    
    # Results
    row_count = Column(Integer)
    output_format = Column(String(20))  # csv, xlsx, pdf, json
    output_path = Column(Text)  # File storage location
    error_message = Column(Text)
    
    # Query details
    query_text = Column(Text)  # The actual SQL executed
    parameters = Column(JSON)  # Query parameters used
    
    # Relationships
    report = relationship('Report', back_populates='executions')
    schedule = relationship('Schedule', back_populates='executions')