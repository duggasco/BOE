"""
Report schemas for API validation
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Generic, TypeVar
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from app.models.report import ReportType

# Generic type for paginated responses
T = TypeVar('T')


class ReportSection(BaseModel):
    """Schema for a report section"""
    id: str
    type: str  # table, chart, text, container
    title: Optional[str] = None
    fields: List[str] = []
    config: Dict[str, Any] = {}
    layout: Dict[str, Any] = {}  # Position, size, etc.


class ReportDefinition(BaseModel):
    """Complete report definition"""
    sections: List[ReportSection] = []
    filters: List[Dict[str, Any]] = []
    parameters: Dict[str, Any] = {}
    settings: Dict[str, Any] = {}


class ReportBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    report_type: ReportType = ReportType.STANDARD
    folder_id: Optional[UUID] = None
    definition: ReportDefinition
    is_published: bool = False
    is_template: bool = False


class ReportCreate(ReportBase):
    pass


class ReportUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    report_type: Optional[ReportType] = None
    folder_id: Optional[UUID] = None
    definition: Optional[ReportDefinition] = None
    is_published: Optional[bool] = None
    is_template: Optional[bool] = None


class Report(ReportBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    owner_id: Optional[UUID] = None
    version: int
    created_at: datetime
    updated_at: datetime
    last_executed: Optional[datetime] = None


class ReportWithDetails(Report):
    owner: Optional['UserBase'] = None
    folder: Optional['Folder'] = None
    execution_count: int = 0
    schedule_count: int = 0


class FolderBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    parent_id: Optional[UUID] = None


class FolderCreate(FolderBase):
    pass


class FolderUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    parent_id: Optional[UUID] = None


class Folder(FolderBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    owner_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class FolderWithReports(Folder):
    reports: List[ReportBase] = []
    children: List[Folder] = []


class ReportExecutionBase(BaseModel):
    report_id: UUID
    schedule_id: Optional[UUID] = None
    output_format: str = Field(..., pattern="^(csv|xlsx|pdf|json)$")
    parameters: Optional[Dict[str, Any]] = None


class ReportExecutionCreate(ReportExecutionBase):
    pass


class ReportExecution(ReportExecutionBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    executed_by_id: Optional[UUID] = None
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    row_count: Optional[int] = None
    output_path: Optional[str] = None
    error_message: Optional[str] = None


class ReportExecutionWithDetails(ReportExecution):
    report: Optional[ReportBase] = None


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response"""
    items: List[T]
    total: int
    skip: int
    limit: int
    
    class Config:
        arbitrary_types_allowed = True


class ReportVersionBase(BaseModel):
    comment: Optional[str] = None


class ReportVersionCreate(ReportVersionBase):
    definition: ReportDefinition


class ReportVersion(ReportVersionBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    report_id: UUID
    version_number: int
    definition: ReportDefinition
    created_by_id: Optional[UUID] = None
    created_at: datetime


class QueryRequest(BaseModel):
    """Request for executing a query"""
    fields: List[str]
    filters: List[Dict[str, Any]] = []
    group_by: List[str] = []
    order_by: List[Dict[str, str]] = []  # [{"field": "name", "direction": "asc"}]
    limit: Optional[int] = Field(None, ge=1, le=10000)
    offset: Optional[int] = Field(None, ge=0)


class QueryResponse(BaseModel):
    """Response from query execution"""
    data: List[Dict[str, Any]]
    total_rows: int
    executed_at: datetime
    duration_ms: int
    query: Optional[str] = None  # SQL for debugging


# Avoid circular imports by using strings for forward references
from app.schemas.user import UserBase
ReportWithDetails.model_rebuild()
FolderWithReports.model_rebuild()
ReportExecutionWithDetails.model_rebuild()