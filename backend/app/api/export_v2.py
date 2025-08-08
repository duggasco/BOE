"""
Enhanced Export API Endpoints
Comprehensive export functionality with multiple formats and destinations
"""

import os
import uuid
import asyncio
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Response
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.models.export import Export, ExportSchedule
from app.models.report import Report
from app.schemas.export import (
    ExportRequest, 
    ExportResponse, 
    ExportListResponse,
    ExportStatus,
    ExportFormat
)
from app.services.export_service import ExportService
from app.services.security_service import SecurityService
from app.core.config import settings

router = APIRouter()


@router.post("/", response_model=ExportResponse)
async def create_export(
    export_request: ExportRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> ExportResponse:
    """
    Create a new export job for a report.
    The export will be processed asynchronously.
    """
    # Check if user has access to the report
    report = await db.get(Report, export_request.report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Check permissions
    if report.owner_id != current_user.id and not current_user.is_superuser:
        # Check if report is shared with user or user's groups
        has_access = await SecurityService.user_has_report_access(
            db, current_user.id, report.id
        )
        if not has_access:
            raise HTTPException(
                status_code=403, 
                detail="You don't have access to export this report"
            )
    
    # Rate limiting check (10 exports per hour per user)
    recent_exports = await db.execute(
        select(Export).where(
            and_(
                Export.user_id == current_user.id,
                Export.created_at > datetime.utcnow() - timedelta(hours=1)
            )
        )
    )
    if len(recent_exports.scalars().all()) >= 10:
        raise HTTPException(
            status_code=429,
            detail="Export rate limit exceeded. Maximum 10 exports per hour."
        )
    
    # Create export record
    export_id = str(uuid.uuid4())
    export = Export(
        id=export_id,
        report_id=export_request.report_id,
        user_id=current_user.id,
        format=export_request.format.value,
        status=ExportStatus.PENDING.value,
        options=export_request.options.dict() if export_request.options else {},
        filters=export_request.filters or [],
        created_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(days=7)  # Exports expire after 7 days
    )
    
    db.add(export)
    await db.commit()
    
    # Queue background task for processing
    export_service = ExportService(db)
    background_tasks.add_task(
        export_service.process_export,
        export_id,
        current_user.id
    )
    
    return ExportResponse(
        export_id=export_id,
        status=ExportStatus.PENDING,
        format=export_request.format,
        created_at=export.created_at,
        expires_at=export.expires_at
    )


@router.get("/", response_model=ExportListResponse)
async def list_exports(
    skip: int = 0,
    limit: int = 20,
    status: Optional[ExportStatus] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> ExportListResponse:
    """
    List all exports for the current user.
    """
    query = select(Export).where(Export.user_id == current_user.id)
    
    if status:
        query = query.where(Export.status == status.value)
    
    # Get total count
    total_result = await db.execute(query)
    total = len(total_result.scalars().all())
    
    # Get paginated results
    query = query.offset(skip).limit(limit).order_by(Export.created_at.desc())
    result = await db.execute(query)
    exports = result.scalars().all()
    
    export_responses = []
    for export in exports:
        export_responses.append(ExportResponse(
            export_id=export.id,
            status=ExportStatus(export.status),
            format=ExportFormat(export.format),
            created_at=export.created_at,
            started_at=export.started_at,
            completed_at=export.completed_at,
            expires_at=export.expires_at,
            download_url=f"/api/v1/export/{export.id}/download" if export.status == "completed" else None,
            file_size=export.file_size,
            error_message=export.error_message,
            progress=export.progress
        ))
    
    return ExportListResponse(
        exports=export_responses,
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/{export_id}", response_model=ExportResponse)
async def get_export_status(
    export_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> ExportResponse:
    """
    Get the status of a specific export job.
    """
    export = await db.get(Export, export_id)
    
    if not export:
        raise HTTPException(status_code=404, detail="Export not found")
    
    if export.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return ExportResponse(
        export_id=export.id,
        status=ExportStatus(export.status),
        format=ExportFormat(export.format),
        created_at=export.created_at,
        started_at=export.started_at,
        completed_at=export.completed_at,
        expires_at=export.expires_at,
        download_url=f"/api/v1/export/{export.id}/download" if export.status == "completed" else None,
        file_size=export.file_size,
        error_message=export.error_message,
        progress=export.progress
    )


@router.get("/{export_id}/download")
async def download_export(
    export_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Download the exported file.
    """
    export = await db.get(Export, export_id)
    
    if not export:
        raise HTTPException(status_code=404, detail="Export not found")
    
    if export.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if export.status != "completed":
        return Response(
            status_code=202,
            content=f"Export is {export.status}. Please check back later."
        )
    
    if not export.file_path:
        raise HTTPException(status_code=404, detail="Export file not found")
    
    # Security: Ensure file path is within export directory
    export_path = Path(settings.EXPORT_DIR) / export.file_path
    if not export_path.exists():
        raise HTTPException(status_code=404, detail="Export file not found")
    
    # Validate path traversal
    try:
        export_path = export_path.resolve()
        export_dir = Path(settings.EXPORT_DIR).resolve()
        if not str(export_path).startswith(str(export_dir)):
            raise HTTPException(status_code=403, detail="Invalid file path")
    except Exception:
        raise HTTPException(status_code=500, detail="Error accessing export file")
    
    # Determine content type
    content_type = "application/octet-stream"
    if export.format == "csv":
        content_type = "text/csv"
    elif export.format == "excel":
        content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    elif export.format == "pdf":
        content_type = "application/pdf"
    elif export.format == "json":
        content_type = "application/json"
    
    # Get report name for filename
    report = await db.get(Report, export.report_id)
    filename = f"{report.name if report else 'report'}_{export.created_at.strftime('%Y%m%d_%H%M%S')}.{export.format}"
    
    return FileResponse(
        path=export_path,
        media_type=content_type,
        filename=filename,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.delete("/{export_id}", status_code=204)
async def delete_export(
    export_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete an export and its associated file.
    """
    export = await db.get(Export, export_id)
    
    if not export:
        raise HTTPException(status_code=404, detail="Export not found")
    
    if export.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Delete file if it exists
    if export.file_path:
        export_path = Path(settings.EXPORT_DIR) / export.file_path
        if export_path.exists():
            try:
                export_path.unlink()
            except Exception:
                pass  # Log error but don't fail the deletion
    
    # Delete database record
    await db.delete(export)
    await db.commit()
    
    return Response(status_code=204)


@router.post("/schedule", response_model=Dict[str, Any])
async def create_scheduled_export(
    schedule_request: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> Dict[str, Any]:
    """
    Create a scheduled export job.
    """
    # Validate report access
    report_id = schedule_request.get("report_id")
    if not report_id:
        raise HTTPException(status_code=422, detail="report_id is required")
    
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    if report.owner_id != current_user.id and not current_user.is_superuser:
        has_access = await SecurityService.user_has_report_access(
            db, current_user.id, report.id
        )
        if not has_access:
            raise HTTPException(
                status_code=403,
                detail="You don't have access to schedule exports for this report"
            )
    
    # Create schedule record
    schedule = ExportSchedule(
        id=str(uuid.uuid4()),
        report_id=report_id,
        user_id=current_user.id,
        format=schedule_request.get("format", "excel"),
        schedule_config=schedule_request.get("schedule", {}),
        destination_config=schedule_request.get("destination", {}),
        options=schedule_request.get("options", {}),
        filters=schedule_request.get("filters", []),
        is_active=True,
        created_at=datetime.utcnow()
    )
    
    db.add(schedule)
    await db.commit()
    
    return {
        "schedule_id": schedule.id,
        "message": "Scheduled export created successfully",
        "next_run": schedule.get_next_run_time()
    }


@router.post("/cleanup", response_model=Dict[str, Any])
async def cleanup_expired_exports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> Dict[str, Any]:
    """
    Clean up expired exports (admin only).
    """
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Find expired exports
    expired_exports = await db.execute(
        select(Export).where(
            Export.expires_at < datetime.utcnow()
        )
    )
    exports_to_delete = expired_exports.scalars().all()
    
    deleted_count = 0
    for export in exports_to_delete:
        # Delete file if it exists
        if export.file_path:
            export_path = Path(settings.EXPORT_DIR) / export.file_path
            if export_path.exists():
                try:
                    export_path.unlink()
                except Exception:
                    pass
        
        # Delete database record
        await db.delete(export)
        deleted_count += 1
    
    await db.commit()
    
    return {
        "message": f"Cleaned up {deleted_count} expired exports",
        "deleted_count": deleted_count
    }