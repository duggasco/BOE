"""
Field metadata and data source models
"""

from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer, JSON, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class FieldType(enum.Enum):
    STRING = "string"
    NUMBER = "number"
    DATE = "date"
    DATETIME = "datetime"
    BOOLEAN = "boolean"
    CURRENCY = "currency"
    PERCENTAGE = "percentage"


class AggregationType(enum.Enum):
    NONE = "none"
    SUM = "sum"
    AVG = "avg"
    COUNT = "count"
    MIN = "min"
    MAX = "max"
    COUNT_DISTINCT = "count_distinct"


class DataSource(Base):
    __tablename__ = 'data_sources'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    connection_type = Column(String(50), nullable=False)  # postgresql, mysql, oracle, etc.
    connection_string = Column(Text, nullable=False)  # Encrypted in production
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    tables = relationship('DataTable', back_populates='data_source', cascade='all, delete-orphan')


class DataTable(Base):
    __tablename__ = 'data_tables'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    data_source_id = Column(UUID(as_uuid=True), ForeignKey('data_sources.id', ondelete='CASCADE'), nullable=False)
    schema_name = Column(String(100))
    table_name = Column(String(100), nullable=False)
    alias = Column(String(100))  # User-friendly name
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    row_count = Column(Integer)  # Cached row count
    last_refreshed = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    data_source = relationship('DataSource', back_populates='tables')
    fields = relationship('Field', back_populates='table', cascade='all, delete-orphan')


class Field(Base):
    __tablename__ = 'fields'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    table_id = Column(UUID(as_uuid=True), ForeignKey('data_tables.id', ondelete='CASCADE'), nullable=False)
    column_name = Column(String(100), nullable=False)
    display_name = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Field properties
    field_type = Column(Enum(FieldType), nullable=False)
    is_dimension = Column(Boolean, default=True)  # True for dimensions, False for measures
    is_calculated = Column(Boolean, default=False)
    calculation_formula = Column(Text)  # SQL expression for calculated fields
    
    # Aggregation settings
    default_aggregation = Column(Enum(AggregationType), default=AggregationType.NONE)
    allow_aggregations = Column(JSON)  # List of allowed aggregation types
    
    # Display settings
    format_string = Column(String(100))  # e.g., "#,##0.00", "MM/DD/YYYY"
    is_visible = Column(Boolean, default=True)
    is_searchable = Column(Boolean, default=True)
    is_sortable = Column(Boolean, default=True)
    
    # Security settings
    required_role = Column(String(50))  # Minimum role required to access this field
    required_permissions = Column(JSON)  # List of permissions required to access this field
    is_restricted = Column(Boolean, default=True, nullable=False)  # Secure by default - must explicitly mark as unrestricted
    
    # Metadata
    tags = Column(JSON)  # List of tags for categorization
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    table = relationship('DataTable', back_populates='fields')
    relationships = relationship('FieldRelationship', 
                               foreign_keys='FieldRelationship.source_field_id',
                               back_populates='source_field',
                               cascade='all, delete-orphan')


class FieldRelationship(Base):
    __tablename__ = 'field_relationships'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    source_field_id = Column(UUID(as_uuid=True), ForeignKey('fields.id', ondelete='CASCADE'), nullable=False)
    target_field_id = Column(UUID(as_uuid=True), ForeignKey('fields.id', ondelete='CASCADE'), nullable=False)
    relationship_type = Column(String(50), nullable=False)  # one-to-one, one-to-many, many-to-many
    join_type = Column(String(20), default='INNER')  # INNER, LEFT, RIGHT, FULL
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    source_field = relationship('Field', foreign_keys=[source_field_id], back_populates='relationships')
    target_field = relationship('Field', foreign_keys=[target_field_id])


class DecodeTable(Base):
    __tablename__ = 'decode_tables'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    field_id = Column(UUID(as_uuid=True), ForeignKey('fields.id', ondelete='CASCADE'))
    decode_values = Column(JSON, nullable=False)  # Key-value pairs for decoding
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)