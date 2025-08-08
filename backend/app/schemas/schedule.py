"""
Pydantic schemas for scheduling system
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, validator
from enum import Enum
from croniter import croniter
import pytz


class ExportFormat(str, Enum):
    CSV = "csv"
    EXCEL = "excel"
    PDF = "pdf"
    JSON = "json"


class DistributionType(str, Enum):
    LOCAL = "local"
    EMAIL = "email"
    SFTP = "sftp"
    WEBHOOK = "webhook"
    CLOUD = "cloud"  # S3, Azure, GCS - day 2


class ScheduleFrequency(str, Enum):
    IMMEDIATE = "immediate"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    CUSTOM = "custom"


class ExecutionStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"


# Schedule Configuration Schemas
class ScheduleConfig(BaseModel):
    """Configuration for schedule timing"""
    frequency: ScheduleFrequency
    cron: Optional[str] = Field(None, description="Cron expression for custom schedules")
    timezone: str = Field("UTC", description="Timezone for schedule execution")
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    
    @validator('cron')
    def validate_cron(cls, v, values):
        if values.get('frequency') == ScheduleFrequency.CUSTOM and not v:
            raise ValueError("Cron expression required for custom frequency")
        if v:
            try:
                croniter(v)
            except Exception:
                raise ValueError("Invalid cron expression")
        return v
    
    @validator('timezone')
    def validate_timezone(cls, v):
        try:
            pytz.timezone(v)
        except Exception:
            raise ValueError(f"Invalid timezone: {v}")
        return v
    
    def to_cron_expression(self) -> str:
        """Convert frequency to cron expression"""
        if self.frequency == ScheduleFrequency.CUSTOM:
            return self.cron
        elif self.frequency == ScheduleFrequency.DAILY:
            return "0 0 * * *"  # Daily at midnight
        elif self.frequency == ScheduleFrequency.WEEKLY:
            return "0 0 * * 0"  # Weekly on Sunday
        elif self.frequency == ScheduleFrequency.MONTHLY:
            return "0 0 1 * *"  # Monthly on the 1st
        else:
            return None


# Distribution Configuration Schemas
class LocalDistributionConfig(BaseModel):
    """Configuration for local file system distribution"""
    base_path: str = Field("/exports/scheduled", description="Base directory for exports")
    create_subdirs: bool = Field(True, description="Create date-based subdirectories")
    filename_pattern: str = Field("{report_name}_{timestamp}.{format}", description="Filename pattern")
    overwrite: bool = Field(False, description="Overwrite existing files")


class EmailDistributionConfig(BaseModel):
    """Configuration for email distribution"""
    recipients: List[str] = Field(..., description="Email recipients")
    cc: Optional[List[str]] = []
    bcc: Optional[List[str]] = []
    subject: str = Field("Scheduled Report: {report_name}", description="Email subject")
    body: str = Field("Please find the attached report.", description="Email body")
    attach_report: bool = Field(True, description="Attach report to email")


class WebhookDistributionConfig(BaseModel):
    """Configuration for webhook distribution"""
    url: str = Field(..., description="Webhook URL")
    method: str = Field("POST", description="HTTP method")
    headers: Optional[Dict[str, str]] = {}
    auth_type: Optional[str] = None  # bearer, basic, api_key
    auth_value: Optional[str] = None
    include_file: bool = Field(True, description="Include file in request")
    retry_count: int = Field(3, description="Number of retries")


class DistributionConfig(BaseModel):
    """Distribution configuration wrapper"""
    local: Optional[LocalDistributionConfig] = None
    email: Optional[EmailDistributionConfig] = None
    webhook: Optional[WebhookDistributionConfig] = None
    
    @validator('*', pre=True)
    def at_least_one_channel(cls, v, values):
        if not any([values.get('local'), values.get('email'), values.get('webhook')]):
            # Default to local storage
            values['local'] = LocalDistributionConfig()
        return v


# Export Configuration
class ExportConfig(BaseModel):
    """Configuration for export generation"""
    format: ExportFormat = ExportFormat.EXCEL
    include_headers: bool = True
    include_totals: bool = False
    compress: bool = False
    password_protect: bool = False
    password: Optional[str] = None


# Schedule CRUD Schemas
class ScheduleCreateRequest(BaseModel):
    """Request to create a new schedule"""
    report_id: str
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    schedule_config: ScheduleConfig
    distribution_config: DistributionConfig
    filter_config: Optional[Dict[str, Any]] = None
    export_config: ExportConfig = Field(default_factory=ExportConfig)
    is_active: bool = True


class ScheduleUpdateRequest(BaseModel):
    """Request to update an existing schedule"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    schedule_config: Optional[ScheduleConfig] = None
    distribution_config: Optional[DistributionConfig] = None
    filter_config: Optional[Dict[str, Any]] = None
    export_config: Optional[ExportConfig] = None
    is_active: Optional[bool] = None
    is_paused: Optional[bool] = None


class ScheduleResponse(BaseModel):
    """Response for schedule operations"""
    id: str
    report_id: str
    user_id: str
    name: str
    description: Optional[str]
    schedule_config: Dict[str, Any]
    distribution_config: Dict[str, Any]
    filter_config: Optional[Dict[str, Any]]
    export_config: Optional[Dict[str, Any]]
    is_active: bool
    is_paused: bool
    last_run: Optional[datetime]
    next_run: Optional[datetime]
    run_count: int
    success_count: int
    failure_count: int
    success_rate: float
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        orm_mode = True


class ScheduleListResponse(BaseModel):
    """Response for listing schedules"""
    schedules: List[ScheduleResponse]
    total: int
    skip: int
    limit: int


# Execution History Schemas
class ExecutionResponse(BaseModel):
    """Response for execution history"""
    id: str
    schedule_id: str
    export_id: Optional[str]
    started_at: datetime
    completed_at: Optional[datetime]
    status: ExecutionStatus
    error_message: Optional[str]
    retry_count: int
    distribution_results: Optional[Dict[str, Any]]
    task_id: Optional[str]
    duration_seconds: Optional[float]
    
    class Config:
        orm_mode = True


class ExecutionListResponse(BaseModel):
    """Response for listing executions"""
    executions: List[ExecutionResponse]
    total: int
    skip: int
    limit: int


# Distribution Template Schemas
class DistributionTemplateCreateRequest(BaseModel):
    """Request to create a distribution template"""
    name: str = Field(..., min_length=1, max_length=255)
    type: DistributionType
    config: Dict[str, Any]
    is_default: bool = False


class DistributionTemplateResponse(BaseModel):
    """Response for distribution template operations"""
    id: str
    user_id: str
    name: str
    type: DistributionType
    config: Dict[str, Any]
    is_default: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        orm_mode = True


# Test/Preview Schemas
class ScheduleTestRequest(BaseModel):
    """Request to test a schedule configuration"""
    schedule_config: ScheduleConfig
    distribution_config: DistributionConfig
    
    
class ScheduleTestResponse(BaseModel):
    """Response for schedule test"""
    valid: bool
    next_runs: List[datetime] = Field(..., description="Next 5 scheduled runs")
    distribution_test: Dict[str, Dict[str, Any]] = Field(..., description="Test results for each channel")
    warnings: List[str] = []
    errors: List[str] = []