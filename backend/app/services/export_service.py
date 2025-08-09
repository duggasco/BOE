"""
Export Service - Handles all export-related business logic
Provides secure file handling, rate limiting, and cleanup
"""

import os
import uuid
import secrets
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from pathlib import Path
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from celery.result import AsyncResult

from app.models import User, Report, Export
from app.schemas.export import ExportStatus, ExportFormat
from app.services.report_service import ReportService
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class ExportService:
    """
    Service class for handling export operations
    Encapsulates all business logic for exports
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.export_dir = Path(settings.EXPORT_STORAGE_PATH)
        self.export_dir.mkdir(parents=True, exist_ok=True)
        
    def generate_secure_filename(self, format: ExportFormat) -> str:
        """
        Generate a cryptographically secure filename
        
        Args:
            format: Export format to determine file extension
            
        Returns:
            Secure filename with no path traversal characters
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
        
        # Ensure no path traversal characters (defense in depth)
        filename = filename.replace('/', '_').replace('\\', '_').replace('..', '_')
        
        return filename
    
    def validate_file_path(self, filename: str) -> Path:
        """
        Validate that a filename creates a path within EXPORT_DIR
        
        Args:
            filename: Filename to validate
            
        Returns:
            Full secure path if valid
            
        Raises:
            ValueError: If path traversal is detected
        """
        # Ensure filename doesn't contain path separators
        if '/' in filename or '\\' in filename or '..' in filename:
            raise ValueError("Invalid filename - path traversal attempt detected")
        
        # Construct the full path
        full_path = self.export_dir / filename
        
        # Resolve any symbolic links and relative paths
        try:
            resolved_path = full_path.resolve()
            export_dir_resolved = self.export_dir.resolve()
        except Exception:
            raise ValueError("Invalid file path")
        
        # Check that the resolved path is within EXPORT_DIR
        try:
            resolved_path.relative_to(export_dir_resolved)
        except ValueError:
            raise ValueError("Path traversal attempt detected - file outside export directory")
        
        return resolved_path
    
    async def check_user_rate_limit(self, user_id: UUID) -> bool:
        """
        Check if user has exceeded export rate limit
        
        Args:
            user_id: ID of the user to check
            
        Returns:
            True if within limit, False if exceeded
        """
        one_hour_ago = datetime.utcnow() - timedelta(hours=1)
        
        # Count recent exports
        result = await self.db.execute(
            select(func.count(Export.id)).where(
                and_(
                    Export.user_id == user_id,
                    Export.created_at >= one_hour_ago
                )
            )
        )
        recent_export_count = result.scalar() or 0
        
        return recent_export_count < settings.EXPORT_MAX_RATE_PER_HOUR
    
    async def create_export(
        self,
        report_id: UUID,
        format: ExportFormat,
        user: User,
        filters: Optional[List[Dict[str, Any]]] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> Export:
        """
        Create a new export job
        
        Args:
            report_id: ID of the report to export
            format: Export format
            user: User requesting the export
            filters: Optional filters to apply
            options: Format-specific options
            
        Returns:
            Created Export record
            
        Raises:
            ValueError: If rate limit exceeded or report not found
        """
        # Check rate limit
        if not await self.check_user_rate_limit(user.id):
            raise ValueError(
                f"Export rate limit exceeded. Maximum {settings.EXPORT_MAX_RATE_PER_HOUR} exports per hour."
            )
        
        # Verify user has access to the report
        report_service = ReportService(self.db)
        report = await report_service.get_report(report_id, user)
        
        if not report:
            raise ValueError("Report not found or access denied")
        
        # Generate secure export ID and filename
        export_id = uuid.uuid4()
        secure_filename = self.generate_secure_filename(format)
        
        # Calculate expiry time
        expires_at = datetime.utcnow() + timedelta(hours=settings.EXPORT_EXPIRY_HOURS)
        
        # Create export record - STORE ONLY FILENAME
        export_record = Export(
            id=export_id,
            report_id=report_id,
            user_id=user.id,
            format=format,
            status=ExportStatus.PENDING,
            created_at=datetime.utcnow(),
            expires_at=expires_at,
            file_path=secure_filename,  # Store only filename, not full path
            parameters={
                "filters": filters,
                "options": options
            }
        )
        
        self.db.add(export_record)
        await self.db.commit()
        
        # Queue the export task based on format
        task = self._queue_export_task(
            export_id=str(export_id),
            report_id=str(report_id),
            filename=secure_filename,
            format=format,
            filters=filters,
            options=options
        )
        
        # Update export record with task ID
        export_record.task_id = task.id
        await self.db.commit()
        await self.db.refresh(export_record)
        
        return export_record
    
    def _queue_export_task(
        self,
        export_id: str,
        report_id: str,
        filename: str,
        format: ExportFormat,
        filters: Optional[List[Dict[str, Any]]] = None,
        options: Optional[Dict[str, Any]] = None
    ):
        """
        Queue the appropriate export task based on format
        
        Args:
            export_id: Export record ID
            report_id: Report ID
            filename: Secure filename for the export
            format: Export format
            filters: Optional filters
            options: Format-specific options
            
        Returns:
            Celery task result
        """
        # Import tasks here to avoid circular imports
        from app.tasks.export_tasks import (
            generate_csv_export,
            generate_excel_export,
            generate_pdf_export
        )
        
        task_map = {
            ExportFormat.CSV: generate_csv_export,
            ExportFormat.EXCEL: generate_excel_export,
            ExportFormat.PDF: generate_pdf_export
        }
        
        task_func = task_map.get(format)
        if not task_func:
            raise ValueError(f"Unsupported format: {format}")
        
        return task_func.delay(
            export_id=export_id,
            report_id=report_id,
            filename=filename,
            filters=filters,
            options=options
        )
    
    async def get_export_status(self, export_id: UUID, user: User) -> Optional[Export]:
        """
        Get the status of an export job
        
        Args:
            export_id: ID of the export
            user: User requesting the status
            
        Returns:
            Export record if found and authorized, None otherwise
        """
        # Get export record
        result = await self.db.execute(
            select(Export).where(
                and_(
                    Export.id == export_id,
                    Export.user_id == user.id
                )
            )
        )
        export_record = result.scalar_one_or_none()
        
        if not export_record:
            return None
        
        # Check if export has expired
        if export_record.expires_at and datetime.utcnow() > export_record.expires_at:
            export_record.status = ExportStatus.CANCELLED
            return export_record
        
        # Update status from Celery if task exists
        if export_record.task_id:
            await self._update_export_from_task(export_record)
        
        return export_record
    
    async def _update_export_from_task(self, export_record: Export):
        """
        Update export status from Celery task
        
        Args:
            export_record: Export record to update
        """
        task_result = AsyncResult(export_record.task_id)
        
        if task_result.state == 'PENDING':
            export_record.status = ExportStatus.PENDING
        elif task_result.state == 'STARTED':
            export_record.status = ExportStatus.PROCESSING
        elif task_result.state == 'SUCCESS':
            export_record.status = ExportStatus.COMPLETED
            export_record.completed_at = datetime.utcnow()
            if task_result.result:
                export_record.file_size = task_result.result.get('file_size')
            await self.db.commit()
        elif task_result.state == 'FAILURE':
            export_record.status = ExportStatus.FAILED
            export_record.error_message = str(task_result.info)
            await self.db.commit()
        else:
            export_record.status = ExportStatus.PROCESSING
    
    async def get_export_file_path(self, export_id: UUID, user: User) -> Optional[Path]:
        """
        Get the secure file path for an export
        
        Args:
            export_id: ID of the export
            user: User requesting the file
            
        Returns:
            Secure file path if valid, None otherwise
        """
        # Get export record
        result = await self.db.execute(
            select(Export).where(
                and_(
                    Export.id == export_id,
                    Export.user_id == user.id
                )
            )
        )
        export_record = result.scalar_one_or_none()
        
        if not export_record:
            return None
        
        # Check if export has expired
        if export_record.expires_at and datetime.utcnow() > export_record.expires_at:
            return None
        
        # Check if export is completed
        if export_record.status != ExportStatus.COMPLETED:
            return None
        
        if not export_record.file_path:
            return None
        
        # Validate and get secure path
        try:
            filename = os.path.basename(export_record.file_path)
            secure_file_path = self.validate_file_path(filename)
            
            if not secure_file_path.exists():
                return None
            
            # Check file size doesn't exceed maximum
            file_size = secure_file_path.stat().st_size
            if file_size > settings.EXPORT_MAX_FILE_SIZE:
                logger.warning(f"Export {export_id} exceeds max file size: {file_size}")
                return None
            
            return secure_file_path
            
        except ValueError as e:
            logger.error(f"Path traversal attempt detected for export {export_id}: {e}")
            return None
    
    async def list_user_exports(
        self,
        user: User,
        skip: int = 0,
        limit: int = 20
    ) -> List[Export]:
        """
        List all exports for a user
        
        Args:
            user: User to list exports for
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            List of Export records
        """
        # Validate pagination parameters
        skip = max(0, skip)
        limit = min(max(1, limit), 100)
        
        result = await self.db.execute(
            select(Export)
            .where(Export.user_id == user.id)
            .order_by(Export.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        exports = result.scalars().all()
        
        # Update expired status
        for export in exports:
            if export.expires_at and datetime.utcnow() > export.expires_at:
                export.status = ExportStatus.CANCELLED
        
        return exports
    
    async def delete_export(self, export_id: UUID, user: User) -> bool:
        """
        Delete an export and its associated file
        
        Args:
            export_id: ID of the export to delete
            user: User requesting the deletion
            
        Returns:
            True if deleted, False if not found or unauthorized
        """
        # Get export record
        result = await self.db.execute(
            select(Export).where(
                and_(
                    Export.id == export_id,
                    Export.user_id == user.id
                )
            )
        )
        export_record = result.scalar_one_or_none()
        
        if not export_record:
            return False
        
        # Delete file if it exists
        if export_record.file_path:
            try:
                filename = os.path.basename(export_record.file_path)
                secure_file_path = self.validate_file_path(filename)
                
                if secure_file_path.exists():
                    secure_file_path.unlink()
                    logger.info(f"Deleted export file: {filename}")
            except Exception as e:
                logger.error(f"Failed to delete export file: {e}")
        
        # Delete database record
        await self.db.delete(export_record)
        await self.db.commit()
        
        return True
    
    async def cleanup_expired_exports(self) -> int:
        """
        Clean up all expired exports
        
        Returns:
            Number of exports cleaned up
        """
        try:
            # Find all expired exports
            result = await self.db.execute(
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
                        secure_file_path = self.validate_file_path(filename)
                        
                        if secure_file_path.exists():
                            secure_file_path.unlink()
                            deleted_count += 1
                    except Exception as e:
                        logger.error(f"Failed to delete expired export file: {e}")
                
                # Delete database record
                await self.db.delete(export)
            
            await self.db.commit()
            logger.info(f"Cleaned up {deleted_count} expired export files")
            
            return deleted_count
            
        except Exception as e:
            logger.error(f"Export cleanup failed: {e}")
            await self.db.rollback()
            raise
    
    def get_mime_type(self, file_ext: str) -> str:
        """
        Get MIME type for a file extension
        
        Args:
            file_ext: File extension (with or without dot)
            
        Returns:
            MIME type string
        """
        ext_to_mime = {
            '.csv': 'text/csv',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.pdf': 'application/pdf',
            '.json': 'application/json'
        }
        
        if not file_ext.startswith('.'):
            file_ext = '.' + file_ext
            
        return ext_to_mime.get(file_ext.lower(), 'application/octet-stream')
    
    def sanitize_filename(self, filename: str, max_length: int = 50) -> str:
        """
        Sanitize a filename for safe download
        
        Args:
            filename: Original filename
            max_length: Maximum length for the filename
            
        Returns:
            Sanitized filename
        """
        # Remove any characters that could cause issues
        safe_name = "".join(c for c in filename if c.isalnum() or c in (' ', '-', '_')).rstrip()
        
        # Limit length
        if len(safe_name) > max_length:
            safe_name = safe_name[:max_length]
        
        # Fallback if empty
        if not safe_name:
            safe_name = "export"
        
        return safe_name