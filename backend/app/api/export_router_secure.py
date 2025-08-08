"""
Export API Router - SECURE VERSION
Fixes critical path traversal vulnerability and adds rate limiting and cleanup
"""

import os
import uuid
import secrets
from typing import List, Optional
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, delete
from slowapi import Limiter
from slowapi.util import get_remote_address

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
import asyncio

logger = logging.getLogger(__name__)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/export", tags=["export"])

# Export storage directory - SECURE CONFIGURATION
EXPORT_DIR = Path(settings.EXPORT_STORAGE_PATH if hasattr(settings, 'EXPORT_STORAGE_PATH') else "/tmp/exports")
EXPORT_DIR.mkdir(parents=True, exist_ok=True)

# Maximum exports per user per hour
MAX_EXPORTS_PER_HOUR = 10
# Maximum file size (100MB)
MAX_FILE_SIZE = 100 * 1024 * 1024
# Export expiry time (24 hours)
EXPORT_EXPIRY_HOURS = 24


def generate_secure_filename(format: ExportFormat) -> str:
    """
    Generate a secure filename that cannot be used for path traversal
    """
    # Use secrets for cryptographically secure random string
    random_part = secrets.token_urlsafe(16)
    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    
    # Map format to extension
    ext_map = {
        ExportFormat.CSV: 'csv',
        ExportFormat.EXCEL: 'xlsx',
        ExportFormat.PDF: 'pdf',
        ExportFormat.JSON: 'json'
    }
    
    extension = ext_map.get(format, 'dat')
    
    # Secure filename with no directory separators
    filename = f"export_{timestamp}_{random_part}.{extension}"
    
    # Ensure no path traversal characters
    filename = filename.replace('/', '_').replace('\\', '_').replace('..', '_')
    
    return filename


def validate_file_path(filename: str) -> Path:
    """
    Validate that a filename creates a path within EXPORT_DIR
    Returns the full path if valid, raises exception if not
    """
    # Ensure filename doesn't contain path separators
    if '/' in filename or '\\' in filename or '..' in filename:
        raise ValueError("Invalid filename - path traversal attempt detected")
    
    # Construct the full path
    full_path = EXPORT_DIR / filename
    
    # Resolve any symbolic links and relative paths
    try:
        resolved_path = full_path.resolve()
        export_dir_resolved = EXPORT_DIR.resolve()
    except Exception:
        raise ValueError("Invalid file path")
    
    # Check that the resolved path is within EXPORT_DIR
    try:
        resolved_path.relative_to(export_dir_resolved)
    except ValueError:
        raise ValueError("Path traversal attempt detected - file outside export directory")
    
    return resolved_path


async def check_user_export_rate(user_id: uuid.UUID, db: AsyncSession) -> bool:
    """
    Check if user has exceeded export rate limit
    """
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    
    result = await db.execute(
        select(Export).where(
            and_(
                Export.user_id == user_id,
                Export.created_at >= one_hour_ago
            )
        )
    )
    
    recent_exports = result.scalars().all()
    return len(recent_exports) < MAX_EXPORTS_PER_HOUR


@router.post("/", response_model=ExportResponse)
@limiter.limit("10/hour")  # Rate limiting decorator
async def create_export(
    request: Request,  # Required for rate limiting
    export_request: ExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new export job with rate limiting and security checks
    """
    # Check user-specific rate limit
    if not await check_user_export_rate(current_user.id, db):
        raise HTTPException(
            status_code=429, 
            detail=f"Export rate limit exceeded. Maximum {MAX_EXPORTS_PER_HOUR} exports per hour."
        )
    
    # Verify user has access to the report
    report_service = ReportService(db)
    report = await report_service.get_report(export_request.report_id, current_user)
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Generate secure export ID and filename
    export_id = str(uuid.uuid4())
    secure_filename = generate_secure_filename(export_request.format)
    
    # Calculate expiry time
    expires_at = datetime.utcnow() + timedelta(hours=EXPORT_EXPIRY_HOURS)
    
    # Create export record in database - STORE ONLY FILENAME
    export_record = Export(
        id=uuid.UUID(export_id),
        report_id=export_request.report_id,
        user_id=current_user.id,
        format=export_request.format,
        status=ExportStatus.PENDING,
        created_at=datetime.utcnow(),
        expires_at=expires_at,
        file_path=secure_filename,  # Store only filename, not full path
        parameters=export_request.dict()
    )
    
    db.add(export_record)
    await db.commit()
    
    # Queue the export task based on format
    if export_request.format == ExportFormat.CSV:
        task = generate_csv_export.delay(
            export_id=export_id,
            report_id=str(export_request.report_id),
            filename=secure_filename,  # Pass filename to task
            filters=export_request.filters,
            options=export_request.options
        )
    elif export_request.format == ExportFormat.EXCEL:
        task = generate_excel_export.delay(
            export_id=export_id,
            report_id=str(export_request.report_id),
            filename=secure_filename,
            filters=export_request.filters,
            options=export_request.options
        )
    elif export_request.format == ExportFormat.PDF:
        task = generate_pdf_export.delay(
            export_id=export_id,
            report_id=str(export_request.report_id),
            filename=secure_filename,
            filters=export_request.filters,
            options=export_request.options
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {export_request.format}")
    
    # Update export record with task ID
    export_record.task_id = task.id
    await db.commit()
    
    return ExportResponse(
        export_id=export_id,
        status=ExportStatus.PENDING,
        format=export_request.format,
        created_at=export_record.created_at,
        expires_at=expires_at,
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
    
    # Check if export has expired
    if export_record.expires_at and datetime.utcnow() > export_record.expires_at:
        raise HTTPException(status_code=410, detail="Export has expired")
    
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
                # Only store filename, not full path
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
        expires_at=export_record.expires_at,
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
    Download an exported file - SECURE VERSION
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
    
    # Check if export has expired
    if export_record.expires_at and datetime.utcnow() > export_record.expires_at:
        raise HTTPException(status_code=410, detail="Export has expired")
    
    if export_record.status != ExportStatus.COMPLETED:
        raise HTTPException(status_code=400, detail=f"Export is not ready. Status: {export_record.status}")
    
    if not export_record.file_path:
        raise HTTPException(status_code=404, detail="Export file not found")
    
    # SECURE PATH VALIDATION
    try:
        # Get only the filename from database
        filename = os.path.basename(export_record.file_path)
        # Validate and get secure path
        secure_file_path = validate_file_path(filename)
    except ValueError as e:
        logger.error(f"Path traversal attempt detected for export {export_id}: {e}")
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not secure_file_path.exists():
        raise HTTPException(status_code=404, detail="Export file no longer exists")
    
    # Check file size doesn't exceed maximum
    file_size = secure_file_path.stat().st_size
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum size: {MAX_FILE_SIZE} bytes")
    
    # Get file extension and MIME type
    ext_to_mime = {
        '.csv': 'text/csv',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.pdf': 'application/pdf',
        '.json': 'application/json'
    }
    
    file_ext = secure_file_path.suffix.lower()
    mime_type = ext_to_mime.get(file_ext, 'application/octet-stream')
    
    # Generate download filename
    report_result = await db.execute(
        select(Report).where(Report.id == export_record.report_id)
    )
    report = report_result.scalar_one_or_none()
    
    # Sanitize report name for filename
    safe_report_name = "export"
    if report and report.name:
        # Remove any characters that could cause issues in filenames
        safe_report_name = "".join(c for c in report.name if c.isalnum() or c in (' ', '-', '_')).rstrip()
        safe_report_name = safe_report_name[:50]  # Limit length
    
    download_filename = f"{safe_report_name}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}{file_ext}"
    
    # Stream large files (> 10MB)
    if file_size > 10 * 1024 * 1024:  # 10MB
        return StreamingResponse(
            stream_file(secure_file_path),
            media_type=mime_type,
            headers={
                "Content-Disposition": f"attachment; filename={download_filename}",
                "Content-Length": str(file_size),
                "X-Content-Type-Options": "nosniff",  # Security header
                "Cache-Control": "no-cache, no-store, must-revalidate"  # Prevent caching
            }
        )
    else:
        # Small files can be sent directly
        return FileResponse(
            path=str(secure_file_path),
            media_type=mime_type,
            filename=download_filename,
            headers={
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "no-cache, no-store, must-revalidate"
            }
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
    # Validate pagination parameters
    if skip < 0:
        skip = 0
    if limit < 1 or limit > 100:
        limit = 20
    
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
        # Check if export has expired
        is_expired = export.expires_at and datetime.utcnow() > export.expires_at
        
        responses.append(ExportResponse(
            export_id=str(export.id),
            status=ExportStatus.CANCELLED if is_expired else export.status,
            format=export.format,
            created_at=export.created_at,
            completed_at=export.completed_at,
            expires_at=export.expires_at,
            download_url=f"/api/v1/export/download/{export.id}" if export.status == ExportStatus.COMPLETED and not is_expired else None,
            error_message=export.error_message if not is_expired else "Export has expired",
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
    
    # Delete file if it exists - SECURE VERSION
    if export_record.file_path:
        try:
            filename = os.path.basename(export_record.file_path)
            secure_file_path = validate_file_path(filename)
            
            if secure_file_path.exists():
                secure_file_path.unlink()
                logger.info(f"Deleted export file: {filename}")
        except Exception as e:
            logger.error(f"Failed to delete export file: {e}")
    
    # Delete database record
    await db.delete(export_record)
    await db.commit()
    
    return {"message": "Export deleted successfully"}


# AUTOMATIC CLEANUP BACKGROUND TASK
async def cleanup_expired_exports(db: AsyncSession):
    """
    Automatically clean up expired exports
    This should be called periodically by a scheduler
    """
    try:
        # Find all expired exports
        result = await db.execute(
            select(Export).where(
                and_(
                    Export.expires_at != None,
                    Export.expires_at < datetime.utcnow()
                )
            )
        )
        expired_exports = result.scalars().all()
        
        deleted_count = 0
        for export in expired_exports:
            # Delete file if it exists
            if export.file_path:
                try:
                    filename = os.path.basename(export.file_path)
                    secure_file_path = validate_file_path(filename)
                    
                    if secure_file_path.exists():
                        secure_file_path.unlink()
                        deleted_count += 1
                except Exception as e:
                    logger.error(f"Failed to delete expired export file: {e}")
            
            # Delete database record
            await db.delete(export)
        
        await db.commit()
        logger.info(f"Cleaned up {deleted_count} expired export files")
        
        return deleted_count
        
    except Exception as e:
        logger.error(f"Export cleanup failed: {e}")
        await db.rollback()
        raise


@router.post("/cleanup")
async def trigger_cleanup(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Manually trigger cleanup of expired exports (admin only)
    """
    # Check if user is admin
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Run cleanup immediately
    deleted_count = await cleanup_expired_exports(db)
    
    return {"message": f"Cleanup completed. Deleted {deleted_count} expired exports"}


# Scheduled cleanup task for Celery
@celery_app.task(name="cleanup_expired_exports")
def cleanup_expired_exports_task():
    """
    Celery task to clean up expired exports
    This should be scheduled to run hourly
    """
    async def run_cleanup():
        async with async_session_maker() as db:
            return await cleanup_expired_exports(db)
    
    # Run the async function
    import asyncio
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(run_cleanup())
        return {"deleted_count": result}
    finally:
        loop.close()