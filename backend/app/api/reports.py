"""
Report management API endpoints
"""

from typing import List, Optional, Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models import Report, ReportVersion, Folder, User, ReportExecution, ExportSchedule
from app.schemas.report import (
    ReportCreate, ReportUpdate, Report as ReportSchema,
    ReportWithDetails, FolderCreate, FolderUpdate,
    Folder as FolderSchema, FolderWithReports,
    ReportVersion as ReportVersionSchema,
    PaginatedResponse
)
from app.api.auth import get_current_user

router = APIRouter()


@router.get("/", response_model=PaginatedResponse[ReportWithDetails])
async def list_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    folder_id: Optional[UUID] = None,
    search: Optional[str] = None,
    is_template: Optional[bool] = None
):
    """List reports accessible to the current user"""
    base_query = select(Report).options(
        selectinload(Report.owner),
        selectinload(Report.folder)
    )
    
    # Filter by user (in production, also check permissions)
    if not current_user.is_superuser:
        base_query = base_query.where(Report.owner_id == current_user.id)
    
    # Apply filters
    if folder_id:
        base_query = base_query.where(Report.folder_id == folder_id)
    
    if search:
        base_query = base_query.where(
            Report.name.ilike(f"%{search}%") |
            Report.description.ilike(f"%{search}%")
        )
    
    if is_template is not None:
        base_query = base_query.where(Report.is_template == is_template)
    
    # Get total count
    count_query = select(func.count()).select_from(Report)
    if not current_user.is_superuser:
        count_query = count_query.where(Report.owner_id == current_user.id)
    if folder_id:
        count_query = count_query.where(Report.folder_id == folder_id)
    if search:
        count_query = count_query.where(
            Report.name.ilike(f"%{search}%") |
            Report.description.ilike(f"%{search}%")
        )
    if is_template is not None:
        count_query = count_query.where(Report.is_template == is_template)
    
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Apply pagination
    query = base_query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    reports = result.scalars().all()
    
    # Add execution and schedule counts
    for report in reports:
        exec_count = await db.execute(
            select(func.count()).select_from(ReportExecution).where(
                ReportExecution.report_id == report.id
            )
        )
        report.execution_count = exec_count.scalar() or 0
        
        sched_count = await db.execute(
            select(func.count()).select_from(ExportSchedule).where(
                ExportSchedule.report_id == report.id
            )
        )
        report.schedule_count = sched_count.scalar() or 0
    
    return PaginatedResponse(
        items=reports,
        total=total,
        skip=skip,
        limit=limit
    )


@router.post("/", response_model=ReportSchema)
async def create_report(
    report_in: ReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new report"""
    # Validate folder exists if provided
    if report_in.folder_id:
        folder = await db.get(Folder, report_in.folder_id)
        if not folder:
            raise HTTPException(
                status_code=404,
                detail="Folder not found"
            )
    
    # Create report
    report = Report(
        **report_in.model_dump(),
        owner_id=current_user.id,
        version=1
    )
    db.add(report)
    
    # Flush to get the report.id before creating version
    await db.flush()
    
    # Create initial version
    version = ReportVersion(
        report_id=report.id,
        version_number=1,
        definition=report_in.definition.model_dump(),
        created_by_id=current_user.id,
        comment="Initial version"
    )
    db.add(version)
    
    await db.commit()
    await db.refresh(report)
    
    return report


@router.get("/{report_id}", response_model=ReportWithDetails)
async def get_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific report"""
    query = select(Report).options(
        selectinload(Report.owner),
        selectinload(Report.folder)
    ).where(Report.id == report_id)
    
    # Check permissions
    if not current_user.is_superuser:
        query = query.where(Report.owner_id == current_user.id)
    
    result = await db.execute(query)
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(
            status_code=404,
            detail="Report not found"
        )
    
    return report


@router.put("/{report_id}", response_model=ReportSchema)
async def update_report(
    report_id: UUID,
    report_in: ReportUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a report"""
    # Get existing report
    query = select(Report).where(Report.id == report_id)
    
    if not current_user.is_superuser:
        query = query.where(Report.owner_id == current_user.id)
    
    result = await db.execute(query)
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(
            status_code=404,
            detail="Report not found"
        )
    
    # Update fields
    update_data = report_in.model_dump(exclude_unset=True)
    
    # If definition is updated, increment version
    if "definition" in update_data:
        report.version += 1
        
        # Create new version record
        version = ReportVersion(
            report_id=report.id,
            version_number=report.version,
            definition=update_data["definition"],
            created_by_id=current_user.id,
            comment=f"Updated by {current_user.username}"
        )
        db.add(version)
    
    for field, value in update_data.items():
        setattr(report, field, value)
    
    await db.commit()
    await db.refresh(report)
    
    return report


@router.delete("/{report_id}")
async def delete_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a report"""
    query = select(Report).where(Report.id == report_id)
    
    if not current_user.is_superuser:
        query = query.where(Report.owner_id == current_user.id)
    
    result = await db.execute(query)
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(
            status_code=404,
            detail="Report not found"
        )
    
    await db.delete(report)
    await db.commit()
    
    return {"message": "Report deleted successfully"}


@router.post("/{report_id}/duplicate", response_model=ReportSchema)
async def duplicate_report(
    report_id: UUID,
    new_name: str = Query(..., min_length=1, max_length=255),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Duplicate an existing report"""
    # Get original report
    query = select(Report).where(Report.id == report_id)
    
    if not current_user.is_superuser:
        query = query.where(Report.owner_id == current_user.id)
    
    result = await db.execute(query)
    original = result.scalar_one_or_none()
    
    if not original:
        raise HTTPException(
            status_code=404,
            detail="Report not found"
        )
    
    # Create duplicate
    duplicate = Report(
        name=new_name,
        description=f"Copy of {original.description}" if original.description else None,
        report_type=original.report_type,
        folder_id=original.folder_id,
        definition=original.definition,
        owner_id=current_user.id,
        version=1,
        is_template=original.is_template
    )
    db.add(duplicate)
    
    # Create initial version
    version = ReportVersion(
        report_id=duplicate.id,
        version_number=1,
        definition=original.definition,
        created_by_id=current_user.id,
        comment=f"Duplicated from {original.name}"
    )
    db.add(version)
    
    await db.commit()
    await db.refresh(duplicate)
    
    return duplicate


@router.get("/{report_id}/versions", response_model=List[ReportVersionSchema])
async def list_report_versions(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all versions of a report"""
    # Check report exists and user has access
    report_query = select(Report).where(Report.id == report_id)
    
    if not current_user.is_superuser:
        report_query = report_query.where(Report.owner_id == current_user.id)
    
    result = await db.execute(report_query)
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(
            status_code=404,
            detail="Report not found"
        )
    
    # Get versions
    query = select(ReportVersion).where(
        ReportVersion.report_id == report_id
    ).order_by(ReportVersion.version_number.desc())
    
    result = await db.execute(query)
    versions = result.scalars().all()
    
    return versions


# Folder endpoints
@router.get("/folders/", response_model=List[FolderWithReports])
async def list_folders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    parent_id: Optional[UUID] = None
):
    """List folders"""
    query = select(Folder).options(
        selectinload(Folder.reports),
        selectinload(Folder.children)
    )
    
    if parent_id:
        query = query.where(Folder.parent_id == parent_id)
    else:
        query = query.where(Folder.parent_id.is_(None))
    
    if not current_user.is_superuser:
        query = query.where(Folder.owner_id == current_user.id)
    
    result = await db.execute(query)
    folders = result.scalars().all()
    
    return folders


@router.post("/folders/", response_model=FolderSchema)
async def create_folder(
    folder_in: FolderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new folder"""
    folder = Folder(
        **folder_in.model_dump(),
        owner_id=current_user.id
    )
    db.add(folder)
    await db.commit()
    await db.refresh(folder)
    
    return folder