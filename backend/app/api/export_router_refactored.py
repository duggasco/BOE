"""
Export API Router - REFACTORED VERSION
Uses ExportService for business logic separation
"""

from typing import List
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address
import aiofiles

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.config import settings
from app.models import User, Report
from app.schemas.export import (
    ExportRequest,
    ExportResponse,
    ExportStatus
)
from app.services.export_service import ExportService
import logging

logger = logging.getLogger(__name__)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/export", tags=["export"])


def get_download_url(export_id: str, request: Request) -> str:
    """
    Generate the download URL for an export
    
    Args:
        export_id: ID of the export
        request: FastAPI request object for URL building
        
    Returns:
        Full download URL
    """
    # Use request.url_for for proper URL generation
    return str(request.url_for("download_export", export_id=export_id))


@router.post("/", response_model=ExportResponse)
@limiter.limit(f"{settings.EXPORT_MAX_RATE_PER_HOUR}/hour")
async def create_export(
    request: Request,
    export_request: ExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new export job with rate limiting and security checks
    
    Returns:
        ExportResponse with job details and download URL
    """
    export_service = ExportService(db)
    
    try:
        # Create export using service
        export_record = await export_service.create_export(
            report_id=export_request.report_id,
            format=export_request.format,
            user=current_user,
            filters=export_request.filters,
            options=export_request.options.dict() if export_request.options else None
        )
        
        # Build response
        return ExportResponse(
            export_id=str(export_record.id),
            status=export_record.status,
            format=export_record.format,
            created_at=export_record.created_at,
            expires_at=export_record.expires_at,
            download_url=get_download_url(str(export_record.id), request)
        )
        
    except ValueError as e:
        # Handle business logic errors
        if "rate limit" in str(e).lower():
            raise HTTPException(status_code=429, detail=str(e))
        elif "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        else:
            raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Export creation failed: {e}")
        raise HTTPException(status_code=500, detail="Export creation failed")


@router.get("/status/{export_id}", response_model=ExportResponse)
async def get_export_status(
    export_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the status of an export job
    
    Returns:
        ExportResponse with current job status
    """
    export_service = ExportService(db)
    
    try:
        # Get export status
        export_record = await export_service.get_export_status(
            export_id=export_id,
            user=current_user
        )
        
        if not export_record:
            raise HTTPException(status_code=404, detail="Export not found")
        
        # Check if expired
        if export_record.expires_at and datetime.utcnow() > export_record.expires_at:
            raise HTTPException(status_code=410, detail="Export has expired")
        
        # Build response
        return ExportResponse(
            export_id=str(export_record.id),
            status=export_record.status,
            format=export_record.format,
            created_at=export_record.created_at,
            completed_at=export_record.completed_at,
            expires_at=export_record.expires_at,
            download_url=get_download_url(str(export_record.id), request) if export_record.status == ExportStatus.COMPLETED else None,
            error_message=export_record.error_message,
            file_size=export_record.file_size
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get export status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get export status")


@router.get("/download/{export_id}", name="download_export")
async def download_export(
    export_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Download an exported file - SECURE VERSION
    
    Returns:
        FileResponse or StreamingResponse with the export file
    """
    export_service = ExportService(db)
    
    try:
        # Get secure file path
        secure_file_path = await export_service.get_export_file_path(
            export_id=export_id,
            user=current_user
        )
        
        if not secure_file_path:
            raise HTTPException(status_code=404, detail="Export not found or expired")
        
        # Get file details
        file_size = secure_file_path.stat().st_size
        file_ext = secure_file_path.suffix.lower()
        mime_type = export_service.get_mime_type(file_ext)
        
        # Get report name for filename
        from sqlalchemy import select
        from uuid import UUID
        
        result = await db.execute(
            select(Export, Report)
            .join(Report)
            .where(Export.id == UUID(export_id))
        )
        export_record, report = result.first() or (None, None)
        
        # Generate download filename
        if report and report.name:
            safe_name = export_service.sanitize_filename(report.name)
        else:
            safe_name = "export"
        
        download_filename = f"{safe_name}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}{file_ext}"
        
        # Build security headers
        headers = {
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-cache, no-store, must-revalidate"
        }
        
        if settings.EXPORT_SECURE_HEADERS:
            headers.update({
                "X-Frame-Options": "DENY",
                "Content-Security-Policy": "default-src 'none'"
            })
        
        # Stream large files (> 10MB)
        if file_size > 10 * 1024 * 1024:
            headers.update({
                "Content-Disposition": f"attachment; filename={download_filename}",
                "Content-Length": str(file_size)
            })
            
            return StreamingResponse(
                stream_file(secure_file_path),
                media_type=mime_type,
                headers=headers
            )
        else:
            # Small files can be sent directly
            return FileResponse(
                path=str(secure_file_path),
                media_type=mime_type,
                filename=download_filename,
                headers=headers
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Export download failed: {e}")
        raise HTTPException(status_code=500, detail="Export download failed")


async def stream_file(file_path: Path, chunk_size: int = 1024 * 1024):
    """
    Stream a file in chunks for large file downloads
    
    Args:
        file_path: Path to the file
        chunk_size: Size of each chunk to stream
        
    Yields:
        File chunks
    """
    async with aiofiles.open(file_path, 'rb') as file:
        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            yield chunk


@router.get("/list", response_model=List[ExportResponse])
async def list_exports(
    request: Request,
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all exports for the current user
    
    Returns:
        List of ExportResponse objects
    """
    export_service = ExportService(db)
    
    try:
        # Get exports
        exports = await export_service.list_user_exports(
            user=current_user,
            skip=skip,
            limit=limit
        )
        
        # Build responses
        responses = []
        for export in exports:
            is_expired = export.expires_at and datetime.utcnow() > export.expires_at
            
            responses.append(ExportResponse(
                export_id=str(export.id),
                status=ExportStatus.CANCELLED if is_expired else export.status,
                format=export.format,
                created_at=export.created_at,
                completed_at=export.completed_at,
                expires_at=export.expires_at,
                download_url=get_download_url(str(export.id), request) if export.status == ExportStatus.COMPLETED and not is_expired else None,
                error_message=export.error_message if not is_expired else "Export has expired",
                file_size=export.file_size
            ))
        
        return responses
        
    except Exception as e:
        logger.error(f"Failed to list exports: {e}")
        raise HTTPException(status_code=500, detail="Failed to list exports")


@router.delete("/{export_id}")
async def delete_export(
    export_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete an export and its associated file
    
    Returns:
        Success message
    """
    export_service = ExportService(db)
    
    try:
        # Delete export
        deleted = await export_service.delete_export(
            export_id=export_id,
            user=current_user
        )
        
        if not deleted:
            raise HTTPException(status_code=404, detail="Export not found")
        
        return {"message": "Export deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete export: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete export")


@router.post("/cleanup")
async def trigger_cleanup(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Manually trigger cleanup of expired exports (admin only)
    
    Returns:
        Cleanup status message
    """
    # Check if user is admin
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    export_service = ExportService(db)
    
    try:
        # Run cleanup immediately
        deleted_count = await export_service.cleanup_expired_exports()
        
        return {"message": f"Cleanup completed. Deleted {deleted_count} expired exports"}
        
    except Exception as e:
        logger.error(f"Export cleanup failed: {e}")
        raise HTTPException(status_code=500, detail="Export cleanup failed")


# Import for missing Export model
from app.models import Export