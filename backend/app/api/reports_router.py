"""
Complete Report management API endpoints
"""

from typing import List, Optional, Annotated
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, update, delete
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.report import Report, ReportVersion, Folder, ReportExecution, ReportType
from app.models.user import User
from app.schemas.report import (
    ReportCreate, ReportUpdate, Report as ReportSchema,
    ReportWithDetails, FolderCreate, FolderUpdate,
    Folder as FolderSchema, FolderWithReports,
    ReportVersion as ReportVersionSchema
)
from app.api.auth import get_current_user
from app.services.report_service import ReportService
from app.services.audit_service import AuditService
from app.core.rate_limit import rate_limit

router = APIRouter(prefix="/api/v1/reports", tags=["Reports"])


@router.get("/", response_model=List[ReportWithDetails])
@rate_limit()
async def list_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    folder_id: Optional[UUID] = None,
    search: Optional[str] = None,
    is_template: Optional[bool] = None,
    report_type: Optional[ReportType] = None
):
    """
    List reports accessible to the current user
    
    - **skip**: Number of records to skip (pagination)
    - **limit**: Maximum number of records to return
    - **folder_id**: Filter by folder
    - **search**: Search in name and description
    - **is_template**: Filter template reports
    - **report_type**: Filter by report type
    """
    service = ReportService(db)
    
    # Check read permission
    if not await service.check_permission(current_user, 'reports', 'read'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to read reports"
        )
    
    query = select(Report).options(
        selectinload(Report.owner),
        selectinload(Report.folder),
        selectinload(Report.versions)
    )
    
    # Filter by user access
    if not current_user.is_superuser:
        # Get reports user has access to through groups/roles
        accessible_reports = await service.get_accessible_reports(current_user)
        query = query.where(Report.id.in_(accessible_reports))
    
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
    
    if report_type:
        filters.append(Report.report_type == report_type)
    
    if filters:
        query = query.where(and_(*filters))
    
    # Apply sorting and pagination
    query = query.order_by(Report.updated_at.desc())
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    reports = result.scalars().all()
    
    # Add additional metadata
    report_list = []
    for report in reports:
        report_dict = report.__dict__.copy()
        
        # Get execution count
        exec_count = await db.execute(
            select(func.count(ReportExecution.id)).where(
                ReportExecution.report_id == report.id
            )
        )
        report_dict['execution_count'] = exec_count.scalar() or 0
        
        # Get last execution status
        last_exec = await db.execute(
            select(ReportExecution).where(
                ReportExecution.report_id == report.id
            ).order_by(ReportExecution.started_at.desc()).limit(1)
        )
        last_exec_result = last_exec.scalar_one_or_none()
        if last_exec_result:
            report_dict['last_execution'] = {
                'status': last_exec_result.status,
                'started_at': last_exec_result.started_at,
                'completed_at': last_exec_result.completed_at
            }
        
        report_list.append(report_dict)
    
    # Log audit
    await AuditService.log(
        db, current_user, 'list_reports', 'reports',
        details={'count': len(reports), 'filters': {'folder_id': folder_id, 'search': search}}
    )
    
    return report_list


@router.get("/{report_id}", response_model=ReportWithDetails)
@rate_limit()
async def get_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific report by ID"""
    service = ReportService(db)
    
    # Get report with related data
    query = select(Report).options(
        selectinload(Report.owner),
        selectinload(Report.folder),
        selectinload(Report.versions),
        selectinload(Report.schedules)
    ).where(Report.id == report_id)
    
    result = await db.execute(query)
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    # Check access permission
    if not await service.can_access_report(current_user, report):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to access this report"
        )
    
    # Log audit
    await AuditService.log(
        db, current_user, 'view_report', 'reports',
        resource_id=report_id,
        details={'report_name': report.name}
    )
    
    return report


@router.post("/", response_model=ReportSchema)
@rate_limit()
async def create_report(
    report_in: ReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new report"""
    service = ReportService(db)
    
    # Check create permission
    if not await service.check_permission(current_user, 'reports', 'create'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to create reports"
        )
    
    # Validate report definition
    validation_errors = await service.validate_report_definition(report_in.definition)
    if validation_errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid report definition: {', '.join(validation_errors)}"
        )
    
    # Validate folder exists if provided
    if report_in.folder_id:
        folder = await db.get(Folder, report_in.folder_id)
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Folder not found"
            )
    
    # Create report
    report = Report(
        **report_in.dict(exclude={'owner_id'}),
        owner_id=current_user.id,
        version=1,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(report)
    
    # Create initial version
    initial_version = ReportVersion(
        report_id=report.id,
        version_number=1,
        definition=report_in.definition,
        created_by_id=current_user.id,
        comment="Initial version"
    )
    
    db.add(initial_version)
    await db.commit()
    await db.refresh(report)
    
    # Log audit
    await AuditService.log(
        db, current_user, 'create_report', 'reports',
        resource_id=report.id,
        details={'report_name': report.name}
    )
    
    return report


@router.put("/{report_id}", response_model=ReportSchema)
@rate_limit()
async def update_report(
    report_id: UUID,
    report_in: ReportUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an existing report"""
    service = ReportService(db)
    
    # Get existing report
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    # Check update permission
    if not await service.can_update_report(current_user, report):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to update this report"
        )
    
    # Validate definition if provided
    if report_in.definition:
        validation_errors = await service.validate_report_definition(report_in.definition)
        if validation_errors:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid report definition: {', '.join(validation_errors)}"
            )
    
    # Track if definition changed
    definition_changed = False
    if report_in.definition and report_in.definition != report.definition:
        definition_changed = True
        report.version += 1
    
    # Update report fields
    update_data = report_in.dict(exclude_unset=True, exclude={'owner_id'})
    for field, value in update_data.items():
        setattr(report, field, value)
    
    report.updated_at = datetime.utcnow()
    
    # Create new version if definition changed
    if definition_changed:
        new_version = ReportVersion(
            report_id=report.id,
            version_number=report.version,
            definition=report.definition,
            created_by_id=current_user.id,
            comment=f"Updated by {current_user.username}"
        )
        db.add(new_version)
    
    await db.commit()
    await db.refresh(report)
    
    # Log audit
    await AuditService.log(
        db, current_user, 'update_report', 'reports',
        resource_id=report_id,
        details={'report_name': report.name, 'definition_changed': definition_changed}
    )
    
    return report


@router.delete("/{report_id}")
@rate_limit()
async def delete_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a report"""
    service = ReportService(db)
    
    # Get report
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    # Check delete permission
    if not await service.can_delete_report(current_user, report):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to delete this report"
        )
    
    # Store report name for audit
    report_name = report.name
    
    # Delete report (cascade will handle related records)
    await db.delete(report)
    await db.commit()
    
    # Log audit
    await AuditService.log(
        db, current_user, 'delete_report', 'reports',
        resource_id=report_id,
        details={'report_name': report_name}
    )
    
    return {"message": "Report deleted successfully"}


@router.post("/{report_id}/execute")
@rate_limit()
async def execute_report(
    report_id: UUID,
    parameters: dict = Body(default={}),
    output_format: str = Query("json", regex="^(json|csv|xlsx|pdf)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Execute a report and return results"""
    service = ReportService(db)
    
    # Get report
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    # Check execute permission
    if not await service.check_permission(current_user, 'reports', 'execute'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to execute reports"
        )
    
    # Create execution record
    execution = ReportExecution(
        report_id=report_id,
        executed_by_id=current_user.id,
        status='running',
        started_at=datetime.utcnow(),
        output_format=output_format,
        parameters=parameters
    )
    
    db.add(execution)
    await db.commit()
    
    try:
        # Execute report (this would normally be async with Celery)
        results = await service.execute_report(report, parameters)
        
        # Update execution record
        execution.status = 'completed'
        execution.completed_at = datetime.utcnow()
        execution.duration_ms = int((execution.completed_at - execution.started_at).total_seconds() * 1000)
        execution.row_count = len(results) if isinstance(results, list) else 0
        
        await db.commit()
        
        # Log audit
        await AuditService.log(
            db, current_user, 'execute_report', 'reports',
            resource_id=report_id,
            details={'report_name': report.name, 'execution_id': str(execution.id)}
        )
        
        return {
            'execution_id': execution.id,
            'status': 'completed',
            'data': results,
            'row_count': execution.row_count,
            'duration_ms': execution.duration_ms
        }
        
    except Exception as e:
        # Update execution with error
        execution.status = 'failed'
        execution.completed_at = datetime.utcnow()
        execution.error_message = str(e)
        await db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Report execution failed: {str(e)}"
        )


@router.get("/{report_id}/versions", response_model=List[ReportVersionSchema])
@rate_limit()
async def get_report_versions(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all versions of a report"""
    service = ReportService(db)
    
    # Get report
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    # Check access permission
    if not await service.can_access_report(current_user, report):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to access this report"
        )
    
    # Get versions
    query = select(ReportVersion).where(
        ReportVersion.report_id == report_id
    ).order_by(ReportVersion.version_number.desc())
    
    result = await db.execute(query)
    versions = result.scalars().all()
    
    return versions


@router.post("/{report_id}/clone", response_model=ReportSchema)
@rate_limit()
async def clone_report(
    report_id: UUID,
    new_name: str = Body(...),
    folder_id: Optional[UUID] = Body(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clone an existing report"""
    service = ReportService(db)
    
    # Get source report
    source_report = await db.get(Report, report_id)
    if not source_report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    # Check read permission on source
    if not await service.can_access_report(current_user, source_report):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to access source report"
        )
    
    # Check create permission
    if not await service.check_permission(current_user, 'reports', 'create'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to create reports"
        )
    
    # Create cloned report
    cloned_report = Report(
        name=new_name,
        description=f"Cloned from {source_report.name}",
        report_type=source_report.report_type,
        owner_id=current_user.id,
        folder_id=folder_id or source_report.folder_id,
        definition=source_report.definition,
        version=1,
        is_published=False,
        is_template=source_report.is_template,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(cloned_report)
    
    # Create initial version
    initial_version = ReportVersion(
        report_id=cloned_report.id,
        version_number=1,
        definition=cloned_report.definition,
        created_by_id=current_user.id,
        comment=f"Cloned from {source_report.name}"
    )
    
    db.add(initial_version)
    await db.commit()
    await db.refresh(cloned_report)
    
    # Log audit
    await AuditService.log(
        db, current_user, 'clone_report', 'reports',
        resource_id=cloned_report.id,
        details={'source_report_id': str(report_id), 'new_name': new_name}
    )
    
    return cloned_report