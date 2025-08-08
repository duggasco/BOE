"""
Export schemas for request/response validation
"""

from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum

from pydantic import BaseModel, Field


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


class ExportOptions(BaseModel):
    """Export format-specific options"""
    # CSV options
    delimiter: str = ","
    include_headers: bool = True
    encoding: str = "utf-8"
    
    # Excel options
    sheet_name: str = "Data"
    include_formatting: bool = True
    freeze_panes: bool = True
    
    # PDF options
    page_size: str = "A4"
    orientation: str = "portrait"
    include_charts: bool = False
    include_summary: bool = True
    
    # Common options
    max_rows: Optional[int] = None
    compress: bool = False


class ExportRequest(BaseModel):
    """Request to create an export"""
    report_id: UUID = Field(..., description="ID of the report to export")
    format: ExportFormat = Field(..., description="Export format")
    filters: Optional[List[Dict[str, Any]]] = Field(None, description="Optional filters to apply")
    options: Optional[ExportOptions] = Field(None, description="Format-specific options")
    
    class Config:
        schema_extra = {
            "example": {
                "report_id": "123e4567-e89b-12d3-a456-426614174000",
                "format": "excel",
                "filters": [
                    {"field": "date", "operator": ">=", "value": "2024-01-01"}
                ],
                "options": {
                    "sheet_name": "Monthly Report",
                    "include_formatting": True
                }
            }
        }


class ExportResponse(BaseModel):
    """Export job response"""
    export_id: str = Field(..., description="Unique export job ID")
    status: ExportStatus = Field(..., description="Current status of the export")
    format: ExportFormat = Field(..., description="Export format")
    created_at: datetime = Field(..., description="When the export was created")
    started_at: Optional[datetime] = Field(None, description="When processing started")
    completed_at: Optional[datetime] = Field(None, description="When export completed")
    expires_at: Optional[datetime] = Field(None, description="When the export will expire and be deleted")
    download_url: Optional[str] = Field(None, description="URL to download the file when ready")
    file_size: Optional[int] = Field(None, description="File size in bytes")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    progress: Optional[int] = Field(None, description="Progress percentage (0-100)")
    
    class Config:
        schema_extra = {
            "example": {
                "export_id": "550e8400-e29b-41d4-a716-446655440000",
                "status": "completed",
                "format": "excel",
                "created_at": "2024-01-15T10:30:00Z",
                "completed_at": "2024-01-15T10:31:30Z",
                "download_url": "/api/v1/export/download/550e8400-e29b-41d4-a716-446655440000",
                "file_size": 2048576
            }
        }


class ExportListResponse(BaseModel):
    """List of exports"""
    exports: List[ExportResponse]
    total: int
    skip: int
    limit: int


class ExportProgress(BaseModel):
    """WebSocket message for export progress"""
    export_id: str
    status: ExportStatus
    progress: int  # 0-100
    message: Optional[str] = None
    estimated_time_remaining: Optional[int] = None  # seconds