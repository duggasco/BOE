"""
Field and metadata schemas
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from app.models.field import FieldType, AggregationType


class DataSourceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    connection_type: str = Field(..., pattern="^(postgresql|mysql|oracle|mssql|sqlite)$")
    connection_string: str
    is_active: bool = True


class DataSourceCreate(DataSourceBase):
    pass


class DataSourceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    connection_string: Optional[str] = None
    is_active: Optional[bool] = None


class DataSource(DataSourceBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    created_at: datetime
    updated_at: datetime


class DataSourceWithTables(DataSource):
    tables: List['DataTable'] = []


class DataTableBase(BaseModel):
    data_source_id: UUID
    schema_name: Optional[str] = None
    table_name: str = Field(..., min_length=1, max_length=100)
    alias: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True


class DataTableCreate(DataTableBase):
    pass


class DataTableUpdate(BaseModel):
    alias: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class DataTable(DataTableBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    row_count: Optional[int] = None
    last_refreshed: Optional[datetime] = None
    created_at: datetime


class DataTableWithFields(DataTable):
    fields: List['Field'] = []
    data_source: Optional[DataSourceBase] = None


class FieldBase(BaseModel):
    table_id: UUID
    column_name: str = Field(..., min_length=1, max_length=100)
    display_name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    field_type: FieldType
    is_dimension: bool = True
    is_calculated: bool = False
    calculation_formula: Optional[str] = None
    default_aggregation: AggregationType = AggregationType.NONE
    allow_aggregations: Optional[List[AggregationType]] = None
    format_string: Optional[str] = None
    is_visible: bool = True
    is_searchable: bool = True
    is_sortable: bool = True
    tags: Optional[List[str]] = None


class FieldCreate(FieldBase):
    pass


class FieldUpdate(BaseModel):
    display_name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    field_type: Optional[FieldType] = None
    is_dimension: Optional[bool] = None
    is_calculated: Optional[bool] = None
    calculation_formula: Optional[str] = None
    default_aggregation: Optional[AggregationType] = None
    allow_aggregations: Optional[List[AggregationType]] = None
    format_string: Optional[str] = None
    is_visible: Optional[bool] = None
    is_searchable: Optional[bool] = None
    is_sortable: Optional[bool] = None
    tags: Optional[List[str]] = None


class Field(FieldBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    created_at: datetime
    updated_at: datetime


class FieldWithRelationships(Field):
    table: Optional[DataTableBase] = None
    relationships: List['FieldRelationship'] = []


class FieldRelationshipBase(BaseModel):
    source_field_id: UUID
    target_field_id: UUID
    relationship_type: str = Field(..., pattern="^(one-to-one|one-to-many|many-to-many)$")
    join_type: str = Field(default="INNER", pattern="^(INNER|LEFT|RIGHT|FULL)$")
    is_active: bool = True


class FieldRelationshipCreate(FieldRelationshipBase):
    pass


class FieldRelationshipUpdate(BaseModel):
    relationship_type: Optional[str] = Field(None, pattern="^(one-to-one|one-to-many|many-to-many)$")
    join_type: Optional[str] = Field(None, pattern="^(INNER|LEFT|RIGHT|FULL)$")
    is_active: Optional[bool] = None


class FieldRelationship(FieldRelationshipBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    created_at: datetime


class FieldRelationshipWithFields(FieldRelationship):
    source_field: Optional[FieldBase] = None
    target_field: Optional[FieldBase] = None


class DecodeTableBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    field_id: Optional[UUID] = None
    decode_values: Dict[str, str]


class DecodeTableCreate(DecodeTableBase):
    pass


class DecodeTableUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    decode_values: Optional[Dict[str, str]] = None


class DecodeTable(DecodeTableBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    created_at: datetime
    updated_at: datetime


class FieldHierarchy(BaseModel):
    """Hierarchical representation of fields for UI"""
    data_sources: List[Dict[str, Any]]


# Rebuild models to resolve forward references
DataSourceWithTables.model_rebuild()
DataTableWithFields.model_rebuild()
FieldWithRelationships.model_rebuild()
FieldRelationshipWithFields.model_rebuild()