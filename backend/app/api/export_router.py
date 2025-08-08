"""
Export API Router
Handles export generation, download, and status tracking
"""

import os
import uuid
from typing import List, Optional
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models import User, Report, Export
from app.schemas.export import (
    ExportRequest,
    ExportResponse,
    ExportStatus,
    ExportFormat
)
from app.services.report_service import ReportService
from app.tasks.export_tasks import (
    generate_csv_export,
    generate_excel_export,
    generate_pdf_export
)
from app.core.config import settings
import logging
import aiofiles
from celery.result import AsyncResult

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/export", tags=["export"])

# Export storage directory
EXPORT_DIR = Path(settings.EXPORT_STORAGE_PATH if hasattr(settings, 'EXPORT_STORAGE_PATH') else "/tmp/exports")
EXPORT_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/", response_model=ExportResponse)
async def create_export(
    request: ExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new export job
    
    This endpoint queues an export job using Celery and returns immediately
    with a job ID that can be used to track progress and download the result.
    """
    # Verify user has access to the report
    report_service = ReportService(db)
    report = await report_service.get_report(request.report_id, current_user)
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Generate unique export ID
    export_id = str(uuid.uuid4())
    
    # Create export record in database
    export_record = Export(
        id=uuid.UUID(export_id),
        report_id=request.report_id,
        user_id=current_user.id,
        format=request.format,
        status=ExportStatus.PENDING,
        created_at=datetime.utcnow(),
        parameters=request.dict()
    )
    
    db.add(export_record)
    await db.commit()
    
    # Queue the export task based on format
    if request.format == ExportFormat.CSV:
        task = generate_csv_export.delay(
            export_id=export_id,
            report_id=str(request.report_id),
            filters=request.filters,
            options=request.options
        )
    elif request.format == ExportFormat.EXCEL:
        task = generate_excel_export.delay(
            export_id=export_id,
            report_id=str(request.report_id),
            filters=request.filters,
            options=request.options
        )
    elif request.format == ExportFormat.PDF:
        task = generate_pdf_export.delay(
            export_id=export_id,
            report_id=str(request.report_id),
            filters=request.filters,
            options=request.options
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {request.format}")
    
    # Update export record with task ID
    export_record.task_id = task.id
    await db.commit()
    
    return ExportResponse(
        export_id=export_id,
        status=ExportStatus.PENDING,
        format=request.format,
        created_at=export_record.created_at,
        download_url=f"/api/v1/export/download/{export_id}"
    )


@router.get("/status/{export_id}", response_model=ExportResponse)
async def get_export_status(
    export_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the status of an export job
    """
    # Get export record from database
    result = await db.execute(
        select(Export).where(
            and_(
                Export.id == uuid.UUID(export_id),
                Export.user_id == current_user.id
            )
        )
    )
    export_record = result.scalar_one_or_none()
    
    if not export_record:
        raise HTTPException(status_code=404, detail="Export not found")
    
    # Check Celery task status if task_id exists
    if export_record.task_id:
        task_result = AsyncResult(export_record.task_id)
        
        if task_result.state == 'PENDING':
            status = ExportStatus.PENDING
        elif task_result.state == 'STARTED':
            status = ExportStatus.PROCESSING
        elif task_result.state == 'SUCCESS':
            status = ExportStatus.COMPLETED
            # Update database status
            export_record.status = status
            export_record.completed_at = datetime.utcnow()
            if task_result.result:
                export_record.file_path = task_result.result.get('file_path')
                export_record.file_size = task_result.result.get('file_size')
            await db.commit()
        elif task_result.state == 'FAILURE':
            status = ExportStatus.FAILED
            export_record.status = status
            export_record.error_message = str(task_result.info)
            await db.commit()
        else:
            status = ExportStatus.PROCESSING
    else:
        status = export_record.status
    
    response = ExportResponse(
        export_id=export_id,
        status=status,
        format=export_record.format,
        created_at=export_record.created_at,
        completed_at=export_record.completed_at,
        download_url=f"/api/v1/export/download/{export_id}" if status == ExportStatus.COMPLETED else None,
        error_message=export_record.error_message,
        file_size=export_record.file_size
    )
    
    return response


@router.get("/download/{export_id}")
async def download_export(
    export_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Download an exported file
    
    Supports both small file downloads (FileResponse) and
    large file streaming (StreamingResponse)
    """
    # Get export record
    result = await db.execute(
        select(Export).where(
            and_(
                Export.id == uuid.UUID(export_id),
                Export.user_id == current_user.id
            )
        )
    )
    export_record = result.scalar_one_or_none()
    
    if not export_record:
        raise HTTPException(status_code=404, detail="Export not found")
    
    if export_record.status != ExportStatus.COMPLETED:
        raise HTTPException(status_code=400, detail=f"Export is not ready. Status: {export_record.status}")
    
    if not export_record.file_path:
        raise HTTPException(status_code=404, detail="Export file not found")
    
    file_path = Path(export_record.file_path)
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Export file no longer exists")
    
    # Get file extension and MIME type
    ext_to_mime = {
        '.csv': 'text/csv',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.pdf': 'application/pdf'
    }
    
    file_ext = file_path.suffix.lower()
    mime_type = ext_to_mime.get(file_ext, 'application/octet-stream')
    
    # Generate filename
    report_result = await db.execute(
        select(Report).where(Report.id == export_record.report_id)
    )
    report = report_result.scalar_one_or_none()
    
    filename = f"{report.name if report else 'export'}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}{file_ext}"
    
    # Stream large files (> 10MB)
    file_size = file_path.stat().st_size
    if file_size > 10 * 1024 * 1024:  # 10MB
        return StreamingResponse(
            stream_file(file_path),
            media_type=mime_type,
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Length": str(file_size)
            }
        )
    else:
        # Small files can be sent directly
        return FileResponse(
            path=str(file_path),
            media_type=mime_type,
            filename=filename
        )


async def stream_file(file_path: Path, chunk_size: int = 1024 * 1024):
    """
    Stream a file in chunks for large file downloads
    """
    async with aiofiles.open(file_path, 'rb') as file:
        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            yield chunk


@router.get("/list", response_model=List[ExportResponse])
async def list_exports(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all exports for the current user
    """
    result = await db.execute(
        select(Export)
        .where(Export.user_id == current_user.id)
        .order_by(Export.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    exports = result.scalars().all()
    
    responses = []
    for export in exports:
        responses.append(ExportResponse(
            export_id=str(export.id),
            status=export.status,
            format=export.format,
            created_at=export.created_at,
            completed_at=export.completed_at,
            download_url=f"/api/v1/export/download/{export.id}" if export.status == ExportStatus.COMPLETED else None,
            error_message=export.error_message,
            file_size=export.file_size
        ))
    
    return responses


@router.delete("/{export_id}")
async def delete_export(
    export_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete an export and its associated file
    """
    result = await db.execute(
        select(Export).where(
            and_(
                Export.id == uuid.UUID(export_id),
                Export.user_id == current_user.id
            )
        )
    )
    export_record = result.scalar_one_or_none()
    
    if not export_record:
        raise HTTPException(status_code=404, detail="Export not found")
    
    # Delete file if it exists
    if export_record.file_path:
        file_path = Path(export_record.file_path)
        if file_path.exists():
            try:
                file_path.unlink()
                logger.info(f"Deleted export file: {file_path}")
            except Exception as e:
                logger.error(f"Failed to delete export file: {e}")
    
    # Delete database record
    await db.delete(export_record)
    await db.commit()
    
    return {"message": "Export deleted successfully"}


@router.post("/cleanup")
async def cleanup_old_exports(
    days: int = 7,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Clean up old export files (admin only)
    """
    # Check if user is admin
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Add cleanup task to background
    background_tasks.add_task(cleanup_exports_task, db, days)
    
    return {"message": f"Cleanup task queued for exports older than {days} days"}


async def cleanup_exports_task(db: AsyncSession, days: int):
    """
    Background task to clean up old exports
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    result = await db.execute(
        select(Export).where(Export.created_at < cutoff_date)
    )
    old_exports = result.scalars().all()
    
    deleted_count = 0
    for export in old_exports:
        # Delete file if it exists
        if export.file_path:
            file_path = Path(export.file_path)
            if file_path.exists():
                try:
                    file_path.unlink()
                    deleted_count += 1
                except Exception as e:
                    logger.error(f"Failed to delete export file {file_path}: {e}")
        
        # Delete database record
        await db.delete(export)
    
    await db.commit()
    logger.info(f"Cleaned up {deleted_count} old export files")