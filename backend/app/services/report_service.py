"""
Report Service Layer
Encapsulates business logic for report operations
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
import logging

from app.models import (
    Report, ReportVersion, Folder, User, 
    ReportExecution, Schedule, ReportType
)
from app.schemas.report import (
    ReportCreate, ReportUpdate, ReportDefinition,
    FolderCreate, FolderUpdate
)
from app.services.audit_service import AuditService
from app.core.exceptions import (
    NotFoundException, PermissionDeniedException,
    ValidationException, BusinessLogicException
)

logger = logging.getLogger(__name__)


class ReportService:
    """
    Service layer for report operations
    Handles business logic, validation, and data access
    """
    
    def __init__(self, db: AsyncSession, audit_service: Optional[AuditService] = None):
        """
        Initialize report service
        
        Args:
            db: Database session
            audit_service: Optional audit service for logging operations
        """
        self.db = db
        self.audit_service = audit_service or AuditService(db)
    
    async def create_report(
        self,
        user: User,
        report_data: ReportCreate
    ) -> Report:
        """
        Create a new report with proper validation and versioning
        
        Args:
            user: Current user creating the report
            report_data: Report creation data
            
        Returns:
            Created report instance
            
        Raises:
            ValidationException: If validation fails
            PermissionDeniedException: If user lacks permissions
        """
        # Validate user permissions
        if not await self._can_create_report(user, report_data.folder_id):
            raise PermissionDeniedException("You don't have permission to create reports in this folder")
        
        # Validate folder exists if specified
        if report_data.folder_id:
            folder = await self.db.get(Folder, report_data.folder_id)
            if not folder:
                raise NotFoundException(f"Folder {report_data.folder_id} not found")
            
            # Check folder permissions
            if not await self._can_access_folder(user, folder):
                raise PermissionDeniedException("You don't have access to this folder")
        
        # Validate report definition
        await self._validate_report_definition(report_data.definition)
        
        # Begin transaction
        async with self.db.begin_nested():
            # Create report
            report = Report(
                name=report_data.name,
                description=report_data.description,
                report_type=report_data.report_type,
                folder_id=report_data.folder_id,
                definition=report_data.definition.dict(),
                owner_id=user.id,
                version=1,
                is_published=report_data.is_published,
                is_template=report_data.is_template
            )
            self.db.add(report)
            
            # Create initial version
            version = ReportVersion(
                report=report,
                version_number=1,
                definition=report_data.definition.dict(),
                created_by_id=user.id,
                comment="Initial version"
            )
            self.db.add(version)
            
            # Audit log
            await self.audit_service.log_action(
                user=user,
                action="create_report",
                resource_type="report",
                resource_id=report.id,
                details={"report_name": report.name}
            )
            
            await self.db.flush()
        
        await self.db.commit()
        await self.db.refresh(report)
        
        logger.info(f"Report {report.id} created by user {user.id}")
        return report
    
    async def update_report(
        self,
        user: User,
        report_id: UUID,
        update_data: ReportUpdate
    ) -> Report:
        """
        Update an existing report with versioning
        
        Args:
            user: Current user
            report_id: Report ID to update
            update_data: Update data
            
        Returns:
            Updated report
            
        Raises:
            NotFoundException: If report not found
            PermissionDeniedException: If user lacks permissions
        """
        # Get report with lock for update
        query = select(Report).where(Report.id == report_id).with_for_update()
        result = await self.db.execute(query)
        report = result.scalar_one_or_none()
        
        if not report:
            raise NotFoundException(f"Report {report_id} not found")
        
        # Check permissions
        if not await self._can_edit_report(user, report):
            raise PermissionDeniedException("You don't have permission to edit this report")
        
        # Track if definition changed for versioning
        definition_changed = False
        
        async with self.db.begin_nested():
            # Update fields
            update_dict = update_data.dict(exclude_unset=True)
            
            # Handle definition update with versioning
            if "definition" in update_dict:
                definition_changed = True
                report.version += 1
                
                # Create new version record
                version = ReportVersion(
                    report_id=report.id,
                    version_number=report.version,
                    definition=update_dict["definition"],
                    created_by_id=user.id,
                    comment=f"Updated by {user.username}"
                )
                self.db.add(version)
            
            # Update report fields
            for field, value in update_dict.items():
                setattr(report, field, value)
            
            report.updated_at = datetime.utcnow()
            
            # Audit log
            await self.audit_service.log_action(
                user=user,
                action="update_report",
                resource_type="report",
                resource_id=report.id,
                details={
                    "fields_updated": list(update_dict.keys()),
                    "version": report.version if definition_changed else None
                }
            )
            
            await self.db.flush()
        
        await self.db.commit()
        await self.db.refresh(report)
        
        logger.info(f"Report {report_id} updated by user {user.id}")
        return report
    
    async def delete_report(
        self,
        user: User,
        report_id: UUID,
        soft_delete: bool = True
    ) -> bool:
        """
        Delete a report (soft or hard delete)
        
        Args:
            user: Current user
            report_id: Report to delete
            soft_delete: If True, mark as deleted; if False, permanently delete
            
        Returns:
            True if deleted successfully
            
        Raises:
            NotFoundException: If report not found
            PermissionDeniedException: If user lacks permissions
        """
        # Get report
        report = await self.db.get(Report, report_id)
        
        if not report:
            raise NotFoundException(f"Report {report_id} not found")
        
        # Check permissions
        if not await self._can_delete_report(user, report):
            raise PermissionDeniedException("You don't have permission to delete this report")
        
        # Check if report has active schedules
        schedule_count = await self.db.scalar(
            select(func.count()).select_from(Schedule)
            .where(and_(
                Schedule.report_id == report_id,
                Schedule.status == 'active'
            ))
        )
        
        if schedule_count > 0:
            raise BusinessLogicException(
                "Cannot delete report with active schedules. Please deactivate schedules first."
            )
        
        async with self.db.begin_nested():
            if soft_delete:
                # Soft delete - mark as deleted
                report.is_deleted = True
                report.deleted_at = datetime.utcnow()
                report.deleted_by_id = user.id
            else:
                # Hard delete
                await self.db.delete(report)
            
            # Audit log
            await self.audit_service.log_action(
                user=user,
                action="delete_report",
                resource_type="report",
                resource_id=report_id,
                details={"soft_delete": soft_delete}
            )
            
            await self.db.flush()
        
        await self.db.commit()
        
        logger.info(f"Report {report_id} deleted by user {user.id} (soft={soft_delete})")
        return True
    
    async def duplicate_report(
        self,
        user: User,
        report_id: UUID,
        new_name: str,
        target_folder_id: Optional[UUID] = None
    ) -> Report:
        """
        Duplicate an existing report
        
        Args:
            user: Current user
            report_id: Report to duplicate
            new_name: Name for the duplicate
            target_folder_id: Optional target folder
            
        Returns:
            Duplicated report
        """
        # Get original report
        original = await self.get_report(user, report_id)
        
        if not original:
            raise NotFoundException(f"Report {report_id} not found")
        
        # Check read permissions on original
        if not await self._can_read_report(user, original):
            raise PermissionDeniedException("You don't have permission to duplicate this report")
        
        # Check create permissions in target folder
        if target_folder_id and not await self._can_create_report(user, target_folder_id):
            raise PermissionDeniedException("You don't have permission to create reports in the target folder")
        
        async with self.db.begin_nested():
            # Create duplicate
            duplicate = Report(
                name=new_name,
                description=f"Copy of {original.description}" if original.description else None,
                report_type=original.report_type,
                folder_id=target_folder_id or original.folder_id,
                definition=original.definition,
                owner_id=user.id,
                version=1,
                is_template=original.is_template,
                is_published=False  # Duplicates start unpublished
            )
            self.db.add(duplicate)
            
            # Create initial version
            version = ReportVersion(
                report=duplicate,
                version_number=1,
                definition=original.definition,
                created_by_id=user.id,
                comment=f"Duplicated from {original.name}"
            )
            self.db.add(version)
            
            # Audit log
            await self.audit_service.log_action(
                user=user,
                action="duplicate_report",
                resource_type="report",
                resource_id=duplicate.id,
                details={
                    "original_report_id": str(report_id),
                    "new_name": new_name
                }
            )
            
            await self.db.flush()
        
        await self.db.commit()
        await self.db.refresh(duplicate)
        
        logger.info(f"Report {report_id} duplicated as {duplicate.id} by user {user.id}")
        return duplicate
    
    async def get_report(
        self,
        user: User,
        report_id: UUID,
        include_versions: bool = False
    ) -> Optional[Report]:
        """
        Get a single report with permission checking
        
        Args:
            user: Current user
            report_id: Report ID
            include_versions: Whether to include version history
            
        Returns:
            Report if found and accessible, None otherwise
        """
        query = select(Report).where(Report.id == report_id)
        
        # Eager load relationships to prevent N+1
        query = query.options(
            selectinload(Report.owner),
            selectinload(Report.folder)
        )
        
        if include_versions:
            query = query.options(selectinload(Report.versions))
        
        result = await self.db.execute(query)
        report = result.scalar_one_or_none()
        
        if not report:
            return None
        
        # Check permissions
        if not await self._can_read_report(user, report):
            return None
        
        return report
    
    async def list_reports(
        self,
        user: User,
        folder_id: Optional[UUID] = None,
        search: Optional[str] = None,
        is_template: Optional[bool] = None,
        is_published: Optional[bool] = None,
        skip: int = 0,
        limit: int = 20,
        sort_by: str = "updated_at",
        sort_desc: bool = True
    ) -> tuple[List[Report], int]:
        """
        List reports with filtering and pagination
        
        Args:
            user: Current user
            folder_id: Filter by folder
            search: Search in name and description
            is_template: Filter templates
            is_published: Filter published reports
            skip: Pagination offset
            limit: Pagination limit
            sort_by: Sort field
            sort_desc: Sort descending
            
        Returns:
            Tuple of (reports, total_count)
        """
        # Base query with eager loading
        query = select(Report).options(
            selectinload(Report.owner),
            selectinload(Report.folder)
        )
        
        # Apply permission filter
        if not user.is_superuser:
            # User can see: own reports, published reports, reports in accessible folders
            query = query.where(
                or_(
                    Report.owner_id == user.id,
                    Report.is_published == True,
                    # Add folder permission check here
                )
            )
        
        # Apply filters
        filters = []
        
        if folder_id:
            filters.append(Report.folder_id == folder_id)
        
        if search:
            filters.append(
                or_(
                    Report.name.ilike(f"%{search}%"),
                    Report.description.ilike(f"%{search}%")
                )
            )
        
        if is_template is not None:
            filters.append(Report.is_template == is_template)
        
        if is_published is not None:
            filters.append(Report.is_published == is_published)
        
        # Exclude soft-deleted reports
        filters.append(or_(
            Report.is_deleted == False,
            Report.is_deleted.is_(None)
        ))
        
        if filters:
            query = query.where(and_(*filters))
        
        # Get total count
        count_query = select(func.count()).select_from(Report).where(and_(*filters)) if filters else select(func.count()).select_from(Report)
        total_count = await self.db.scalar(count_query)
        
        # Apply sorting
        sort_column = getattr(Report, sort_by, Report.updated_at)
        if sort_desc:
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column)
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        
        # Execute query
        result = await self.db.execute(query)
        reports = result.scalars().all()
        
        return reports, total_count
    
    async def get_report_versions(
        self,
        user: User,
        report_id: UUID,
        limit: int = 10
    ) -> List[ReportVersion]:
        """
        Get version history for a report
        
        Args:
            user: Current user
            report_id: Report ID
            limit: Maximum versions to return
            
        Returns:
            List of report versions
        """
        # Check report access
        report = await self.get_report(user, report_id)
        if not report:
            raise NotFoundException(f"Report {report_id} not found or not accessible")
        
        # Get versions
        query = (
            select(ReportVersion)
            .where(ReportVersion.report_id == report_id)
            .order_by(ReportVersion.version_number.desc())
            .limit(limit)
        )
        
        result = await self.db.execute(query)
        versions = result.scalars().all()
        
        return versions
    
    async def restore_version(
        self,
        user: User,
        report_id: UUID,
        version_number: int
    ) -> Report:
        """
        Restore a report to a specific version
        
        Args:
            user: Current user
            report_id: Report ID
            version_number: Version to restore
            
        Returns:
            Updated report
        """
        # Get report
        report = await self.get_report(user, report_id)
        if not report:
            raise NotFoundException(f"Report {report_id} not found")
        
        # Check edit permissions
        if not await self._can_edit_report(user, report):
            raise PermissionDeniedException("You don't have permission to edit this report")
        
        # Get target version
        query = select(ReportVersion).where(
            and_(
                ReportVersion.report_id == report_id,
                ReportVersion.version_number == version_number
            )
        )
        result = await self.db.execute(query)
        target_version = result.scalar_one_or_none()
        
        if not target_version:
            raise NotFoundException(f"Version {version_number} not found for report {report_id}")
        
        async with self.db.begin_nested():
            # Create new version with restored content
            report.version += 1
            report.definition = target_version.definition
            report.updated_at = datetime.utcnow()
            
            new_version = ReportVersion(
                report_id=report.id,
                version_number=report.version,
                definition=target_version.definition,
                created_by_id=user.id,
                comment=f"Restored from version {version_number}"
            )
            self.db.add(new_version)
            
            # Audit log
            await self.audit_service.log_action(
                user=user,
                action="restore_report_version",
                resource_type="report",
                resource_id=report_id,
                details={
                    "restored_from_version": version_number,
                    "new_version": report.version
                }
            )
            
            await self.db.flush()
        
        await self.db.commit()
        await self.db.refresh(report)
        
        logger.info(f"Report {report_id} restored to version {version_number} by user {user.id}")
        return report
    
    # Public permission checking methods
    async def check_permission(self, user: User, resource: str, action: str) -> bool:
        """
        Check if user has specific permission
        
        Args:
            user: Current user
            resource: Resource type (e.g., 'reports', 'folders')
            action: Action type (e.g., 'create', 'read', 'update', 'delete')
            
        Returns:
            True if user has permission
        """
        logger.info(f"Checking permission for user {user.username} ({user.id}): {resource}:{action}")
        
        if user.is_superuser:
            logger.info(f"User {user.username} is superuser - permission granted")
            return True
        
        from sqlalchemy import select, and_
        from app.models import Permission, Role, user_roles, role_permissions, user_groups, group_roles
        
        # Check direct role permissions
        query = (
            select(Permission)
            .join(role_permissions)
            .join(Role)
            .join(user_roles)
            .where(and_(
                user_roles.c.user_id == user.id,
                Permission.resource == resource,
                Permission.action == action
            ))
        )
        
        result = await self.db.execute(query)
        perm = result.scalar_one_or_none()
        if perm:
            logger.info(f"User {user.username} has direct role permission for {resource}:{action}")
            return True
        
        # Check group-based permissions
        query = (
            select(Permission)
            .join(role_permissions)
            .join(Role)
            .join(group_roles)
            .join(user_groups)
            .where(and_(
                user_groups.c.user_id == user.id,
                Permission.resource == resource,
                Permission.action == action
            ))
        )
        
        result = await self.db.execute(query)
        perm = result.scalar_one_or_none()
        if perm:
            logger.info(f"User {user.username} has group-based permission for {resource}:{action}")
            return True
        
        logger.warning(f"User {user.username} DENIED permission for {resource}:{action}")
        return False
    
    async def can_access_report(self, user: User, report: Report) -> bool:
        """Public wrapper for checking if user can access/read a report"""
        return await self._can_read_report(user, report)
    
    async def can_update_report(self, user: User, report: Report) -> bool:
        """Public wrapper for checking if user can update a report"""
        # First check if user owns the report
        if report.owner_id == user.id:
            return True
        
        # Superuser can update any report
        if user.is_superuser:
            return True
        
        # Check if user has explicit update permission AND report is shared/public
        if report.is_published and await self.check_permission(user, 'reports', 'update'):
            # Only allow update of published reports if user has admin role
            return await self._user_has_admin_role(user)
        
        return False
    
    async def can_delete_report(self, user: User, report: Report) -> bool:
        """Public wrapper for checking if user can delete a report"""
        # Only owner or superuser can delete
        if report.owner_id == user.id:
            return True
        
        if user.is_superuser:
            return True
        
        # Even with delete permission, users cannot delete others' reports
        return False
    
    async def get_accessible_reports(self, user: User) -> List[UUID]:
        """
        Get list of report IDs that user can access
        
        Args:
            user: Current user
            
        Returns:
            List of accessible report IDs
        """
        from sqlalchemy import select, or_
        
        if user.is_superuser:
            # Superuser can access all reports
            query = select(Report.id)
            result = await self.db.execute(query)
            return list(result.scalars().all())
        
        # Regular user can access:
        # 1. Their own reports
        # 2. Published reports
        # 3. Reports they have explicit permissions for
        
        query = select(Report.id).where(
            or_(
                Report.owner_id == user.id,
                Report.is_published == True,
                # TODO: Add check for reports shared with user's groups
            )
        )
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def validate_report_definition(self, definition: dict) -> List[str]:
        """
        Public wrapper for validating report definition
        
        Args:
            definition: Report definition dictionary
            
        Returns:
            List of validation errors (empty if valid)
        """
        from app.schemas.report import ReportDefinition
        from app.services.security_service import SecurityService
        
        errors = []
        
        # First, validate the entire definition for injection attacks
        security_errors = SecurityService.validate_json_safe(definition, "definition")
        if security_errors:
            errors.extend(security_errors)
            return errors  # Don't proceed if security issues found
        
        try:
            # Convert dict to ReportDefinition for structural validation
            report_def = ReportDefinition(**definition) if isinstance(definition, dict) else definition
            await self._validate_report_definition(report_def)
            return []
        except ValidationException as e:
            return e.details.get('errors', [str(e)])
        except Exception as e:
            return [str(e)]
    
    async def execute_report(self, report: Report, parameters: dict = None) -> List[dict]:
        """
        Execute a report and return results
        
        Args:
            report: Report to execute
            parameters: Optional execution parameters
            
        Returns:
            List of result rows
        """
        # TODO: Implement actual report execution with query building
        # This is a placeholder that returns mock data
        logger.warning(f"Report execution not fully implemented for report {report.id}")
        
        # For now, return mock data to prevent failures
        return [
            {"id": 1, "name": "Sample Row 1", "value": 100},
            {"id": 2, "name": "Sample Row 2", "value": 200},
            {"id": 3, "name": "Sample Row 3", "value": 300}
        ]
    
    # Private permission checking methods
    async def _can_create_report(self, user: User, folder_id: Optional[UUID]) -> bool:
        """Check if user can create reports in folder"""
        if user.is_superuser:
            return True
        
        # Check if user has CREATE permission
        from sqlalchemy import select, and_
        from app.models import Permission, Role, user_roles, role_permissions
        
        # Check if user has explicit create permission
        query = (
            select(Permission)
            .join(role_permissions)
            .join(Role)
            .join(user_roles)
            .where(and_(
                user_roles.c.user_id == user.id,
                Permission.resource == 'reports',
                Permission.action == 'create'
            ))
        )
        
        result = await self.db.execute(query)
        if result.scalar_one_or_none():
            # User has create permission, now check folder access
            if folder_id:
                folder = await self.db.get(Folder, folder_id)
                return await self._can_access_folder(user, folder) if folder else False
            return True
        
        return False
    
    async def _can_read_report(self, user: User, report: Report) -> bool:
        """Check if user can read report"""
        if user.is_superuser:
            return True
        
        if report.owner_id == user.id:
            return True
        
        if report.is_published:
            return True
        
        # Check if user has READ permission through roles
        from sqlalchemy import select, and_
        from app.models import Permission, Role, user_roles, role_permissions, user_groups, group_roles
        
        # Check direct role permissions
        query = (
            select(Permission)
            .join(role_permissions)
            .join(Role)
            .join(user_roles)
            .where(and_(
                user_roles.c.user_id == user.id,
                Permission.resource == 'reports',
                Permission.action == 'read'
            ))
        )
        
        result = await self.db.execute(query)
        if result.scalar_one_or_none():
            return True
        
        # Check group-based permissions
        query = (
            select(Permission)
            .join(role_permissions)
            .join(Role)
            .join(group_roles)
            .join(user_groups)
            .where(and_(
                user_groups.c.user_id == user.id,
                Permission.resource == 'reports',
                Permission.action == 'read'
            ))
        )
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None
    
    async def _can_edit_report(self, user: User, report: Report) -> bool:
        """Check if user can edit report - INTERNAL USE ONLY"""
        # This is now only used internally
        # Public methods should use can_update_report() which has proper ownership checks
        if user.is_superuser:
            return True
        
        if report.owner_id == user.id:
            return True
        
        return False
    
    async def _can_delete_report(self, user: User, report: Report) -> bool:
        """Check if user can delete report - INTERNAL USE ONLY"""
        # This is now only used internally
        # Public methods should use can_delete_report() which has proper ownership checks
        if user.is_superuser:
            return True
        
        if report.owner_id == user.id:
            return True
        
        return False
    
    async def _user_has_admin_role(self, user: User) -> bool:
        """Check if user has admin role"""
        from sqlalchemy import select, and_
        from app.models import Role, user_roles
        
        query = (
            select(Role)
            .join(user_roles)
            .where(and_(
                user_roles.c.user_id == user.id,
                Role.name == 'Administrator'
            ))
        )
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None
    
    async def _can_access_folder(self, user: User, folder: Folder) -> bool:
        """Check if user can access folder"""
        if user.is_superuser:
            return True
        
        if folder.owner_id == user.id:
            return True
        
        # Check if user has folder access permission
        from sqlalchemy import select, and_
        from app.models import Permission, Role, user_roles, role_permissions
        
        query = (
            select(Permission)
            .join(role_permissions)
            .join(Role)
            .join(user_roles)
            .where(and_(
                user_roles.c.user_id == user.id,
                Permission.resource == 'folders',
                Permission.action == 'read'
            ))
        )
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None
    
    async def _validate_report_definition(self, definition: ReportDefinition):
        """Validate report definition with comprehensive security checks"""
        from sqlalchemy import select
        from app.models import Field
        from app.services.formula_parser import SecureFormulaParser, FormulaDefinition
        import re
        
        errors = []
        
        # Validate sections
        if not definition.sections:
            errors.append("Report must have at least one section")
        
        for section in definition.sections:
            # Validate section type
            if section.type not in ['table', 'chart', 'text', 'container']:
                errors.append(f"Invalid section type: {section.type}")
            
            # Validate field references
            for field_id in section.fields:
                try:
                    # Check if field exists in database
                    uuid_field = UUID(field_id)
                    result = await self.db.execute(
                        select(Field).where(Field.id == uuid_field)
                    )
                    field = result.scalar_one_or_none()
                    if not field:
                        errors.append(f"Field {field_id} does not exist")
                    elif not field.is_visible:
                        errors.append(f"Field {field_id} is not visible")
                except ValueError:
                    errors.append(f"Invalid field ID format: {field_id}")
            
            # Validate section config
            if section.config:
                # Check for potentially dangerous config
                if isinstance(section.config, dict):
                    # Check for script injection attempts
                    def check_for_scripts(obj, path=""):
                        if isinstance(obj, str):
                            # Enhanced dangerous pattern detection
                            dangerous_patterns = [
                                # XSS patterns
                                r'<script[^>]*>', r'javascript:', r'on\w+\s*=', 
                                r'eval\s*\(', r'Function\s*\(', r'__proto__', r'constructor',
                                # SQL injection patterns
                                r'\bUNION\b.*\bSELECT\b', r'\bDROP\b.*\b(TABLE|DATABASE)\b',
                                r'\bINSERT\b.*\bINTO\b', r'\bDELETE\b.*\bFROM\b',
                                r'\bUPDATE\b.*\bSET\b', r'\bEXEC(UTE)?\b', r'\bCREATE\b.*\b(TABLE|DATABASE)\b',
                                r'--\s*$', r'/\*.*\*/', r'\bOR\b.*=.*', r"\bOR\b.*'.*'.*=.*'.*'",
                                r'\b(CHAR|CONCAT|CHR)\s*\(', r'\bCAST\s*\(', r'\bCONVERT\s*\(',
                                # Command injection patterns
                                r'\$\(.*\)', r'`.*`', r'\|\|', r'&&', r';\s*\w+',
                                # Path traversal
                                r'\.\./\.\./'
                            ]
                            for pattern in dangerous_patterns:
                                if re.search(pattern, obj, re.IGNORECASE):
                                    errors.append(f"Potential injection attack in {path}: pattern '{pattern}' detected")
                        elif isinstance(obj, dict):
                            for key, value in obj.items():
                                check_for_scripts(value, f"{path}.{key}" if path else key)
                        elif isinstance(obj, list):
                            for i, item in enumerate(obj):
                                check_for_scripts(item, f"{path}[{i}]")
                    
                    check_for_scripts(section.config, f"section[{section.id}].config")
        
        # Validate filters
        for filter_def in definition.filters:
            if 'field' not in filter_def:
                errors.append("Filter missing field reference")
            if 'operator' not in filter_def:
                errors.append("Filter missing operator")
            
            # Validate operator
            valid_operators = ['=', '!=', '>', '<', '>=', '<=', 'in', 'not_in', 'like', 'between']
            operator = filter_def.get('operator')
            if operator not in valid_operators:
                errors.append(f"Invalid filter operator: {operator}")
            
            # Validate filter values
            if 'value' in filter_def:
                value = filter_def['value']
                # Check for SQL injection in filter values
                if isinstance(value, str):
                    # Validate string values for injection attempts
                    sql_keywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'EXEC', 'UNION']
                    for keyword in sql_keywords:
                        if keyword in value.upper():
                            errors.append(f"Potential SQL injection in filter value: {keyword} detected")
                    # Check for comment markers
                    if '--' in value or '/*' in value or '*/' in value:
                        errors.append("SQL comment markers not allowed in filter values")
                elif isinstance(value, list) and operator == 'in':
                    # Limit IN operator values to prevent DoS
                    if len(value) > 100:
                        errors.append(f"IN operator limited to 100 values, got {len(value)}")
                    # Check each value in the list
                    for v in value:
                        if isinstance(v, str) and any(kw in v.upper() for kw in sql_keywords):
                            errors.append(f"Potential SQL injection in IN filter value")
        
        # Validate any formula definitions
        if hasattr(definition, 'formulas') and definition.formulas:
            for formula in definition.formulas:
                try:
                    # Parse formula to validate structure
                    formula_def = FormulaDefinition.from_dict(formula)
                    # Additional validation could be done here
                except Exception as e:
                    errors.append(f"Invalid formula definition: {str(e)}")
        
        # Check total size to prevent DoS
        import json
        definition_json = json.dumps(definition.dict())
        if len(definition_json) > 1024 * 1024:  # 1MB limit
            errors.append("Report definition exceeds maximum size (1MB)")
        
        if errors:
            raise ValidationException(
                message="Report definition validation failed",
                details={"errors": errors}
            )