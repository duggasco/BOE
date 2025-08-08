"""
Schedule API endpoints for Phase 5
"""

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.models.schedule import ExportSchedule, ScheduleExecution, DistributionTemplate
from app.models.report import Report
from app.schemas.schedule import (
    ScheduleCreateRequest,
    ScheduleUpdateRequest,
    ScheduleResponse,
    ScheduleListResponse,
    ExecutionResponse,
    ExecutionListResponse,
    DistributionTemplateCreateRequest,
    DistributionTemplateResponse,
    ScheduleTestRequest,
    ScheduleTestResponse
)
from app.services.rbac_service import RBACService
from app.tasks.schedule_tasks import test_schedule_configuration

router = APIRouter(prefix="/api/v1/schedules", tags=["schedules"])


@router.post("/", response_model=ScheduleResponse)
async def create_schedule(
    request: ScheduleCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> ScheduleResponse:
    """Create a new export schedule"""
    
    # Check if user has access to the report
    report = await db.get(Report, request.report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Check permissions
    if not await RBACService.user_has_permission(db, current_user.id, "schedule:create"):
        if report.owner_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to create schedules for this report"
            )
    
    # Check user's schedule limit (10 per user by default)
    user_schedules = await db.execute(
        select(func.count(ExportSchedule.id)).where(
            ExportSchedule.user_id == current_user.id
        )
    )
    schedule_count = user_schedules.scalar()
    
    if schedule_count >= 10 and not current_user.is_superuser:
        raise HTTPException(
            status_code=429,
            detail="Schedule limit reached. Maximum 10 schedules per user."
        )
    
    # Create schedule
    schedule = ExportSchedule(
        report_id=request.report_id,
        user_id=current_user.id,
        created_by=current_user.id,
        name=request.name,
        description=request.description,
        schedule_config={
            "frequency": request.schedule_config.frequency,
            "cron": request.schedule_config.to_cron_expression(),
            "timezone": request.schedule_config.timezone,
            "start_date": request.schedule_config.start_date.isoformat() if request.schedule_config.start_date else None,
            "end_date": request.schedule_config.end_date.isoformat() if request.schedule_config.end_date else None
        },
        distribution_config=request.distribution_config.dict(),
        filter_config=request.filter_config,
        export_config=request.export_config.dict(),
        is_active=request.is_active,
        is_paused=False
    )
    
    # Calculate initial next run time
    schedule.next_run = schedule.calculate_next_run()
    
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    
    return ScheduleResponse(**schedule.to_dict())


@router.get("/", response_model=ScheduleListResponse)
async def list_schedules(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> ScheduleListResponse:
    """List schedules for the current user"""
    
    query = select(ExportSchedule)
    
    # Filter by user unless admin
    if not current_user.is_superuser:
        query = query.where(ExportSchedule.user_id == current_user.id)
    
    # Filter by active status if specified
    if is_active is not None:
        query = query.where(ExportSchedule.is_active == is_active)
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Get paginated results
    query = query.order_by(ExportSchedule.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    schedules = result.scalars().all()
    
    return ScheduleListResponse(
        schedules=[ScheduleResponse(**schedule.to_dict()) for schedule in schedules],
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(
    schedule_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> ScheduleResponse:
    """Get a specific schedule"""
    
    schedule = await db.get(ExportSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Check permissions
    if schedule.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return ScheduleResponse(**schedule.to_dict())


@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: str,
    request: ScheduleUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> ScheduleResponse:
    """Update an existing schedule"""
    
    schedule = await db.get(ExportSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Check permissions
    if schedule.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Update fields if provided
    if request.name is not None:
        schedule.name = request.name
    if request.description is not None:
        schedule.description = request.description
    if request.schedule_config is not None:
        schedule.schedule_config = {
            "frequency": request.schedule_config.frequency,
            "cron": request.schedule_config.to_cron_expression(),
            "timezone": request.schedule_config.timezone,
            "start_date": request.schedule_config.start_date.isoformat() if request.schedule_config.start_date else None,
            "end_date": request.schedule_config.end_date.isoformat() if request.schedule_config.end_date else None
        }
        # Recalculate next run
        schedule.next_run = schedule.calculate_next_run()
    if request.distribution_config is not None:
        schedule.distribution_config = request.distribution_config.dict()
    if request.filter_config is not None:
        schedule.filter_config = request.filter_config
    if request.export_config is not None:
        schedule.export_config = request.export_config.dict()
    if request.is_active is not None:
        schedule.is_active = request.is_active
    if request.is_paused is not None:
        schedule.is_paused = request.is_paused
    
    schedule.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(schedule)
    
    return ScheduleResponse(**schedule.to_dict())


@router.delete("/{schedule_id}", status_code=204)
async def delete_schedule(
    schedule_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a schedule"""
    
    schedule = await db.get(ExportSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Check permissions
    if schedule.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.delete(schedule)
    await db.commit()


@router.post("/{schedule_id}/pause", response_model=ScheduleResponse)
async def pause_schedule(
    schedule_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> ScheduleResponse:
    """Pause a schedule"""
    
    schedule = await db.get(ExportSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Check permissions
    if schedule.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Access denied")
    
    schedule.is_paused = True
    schedule.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(schedule)
    
    return ScheduleResponse(**schedule.to_dict())


@router.post("/{schedule_id}/resume", response_model=ScheduleResponse)
async def resume_schedule(
    schedule_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> ScheduleResponse:
    """Resume a paused schedule"""
    
    schedule = await db.get(ExportSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Check permissions
    if schedule.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Access denied")
    
    schedule.is_paused = False
    schedule.updated_at = datetime.utcnow()
    
    # Recalculate next run time
    schedule.next_run = schedule.calculate_next_run()
    
    await db.commit()
    await db.refresh(schedule)
    
    return ScheduleResponse(**schedule.to_dict())


@router.post("/{schedule_id}/test")
async def test_schedule(
    schedule_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Test run a schedule immediately"""
    
    schedule = await db.get(ExportSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Check permissions
    if schedule.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Queue the test execution
    from app.tasks.schedule_tasks import execute_scheduled_export
    task = execute_scheduled_export.delay(schedule_id)
    
    return {
        "message": "Test execution queued",
        "task_id": task.id,
        "schedule_id": schedule_id
    }


@router.get("/{schedule_id}/history", response_model=ExecutionListResponse)
async def get_execution_history(
    schedule_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> ExecutionListResponse:
    """Get execution history for a schedule"""
    
    schedule = await db.get(ExportSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Check permissions
    if schedule.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get executions
    query = select(ScheduleExecution).where(
        ScheduleExecution.schedule_id == schedule_id
    )
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Get paginated results
    query = query.order_by(ScheduleExecution.started_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    executions = result.scalars().all()
    
    return ExecutionListResponse(
        executions=[ExecutionResponse(**execution.to_dict()) for execution in executions],
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/executions", response_model=ExecutionListResponse)
async def list_all_executions(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> ExecutionListResponse:
    """List all executions for the current user's schedules"""
    
    # First get user's schedules
    schedule_query = select(ExportSchedule.id).where(
        ExportSchedule.user_id == current_user.id
    )
    
    if current_user.is_superuser:
        # Admin can see all
        query = select(ScheduleExecution)
    else:
        # Regular users see only their schedules' executions
        query = select(ScheduleExecution).where(
            ScheduleExecution.schedule_id.in_(schedule_query)
        )
    
    # Filter by status if specified
    if status:
        query = query.where(ScheduleExecution.status == status)
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Get paginated results
    query = query.order_by(ScheduleExecution.started_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    executions = result.scalars().all()
    
    return ExecutionListResponse(
        executions=[ExecutionResponse(**execution.to_dict()) for execution in executions],
        total=total,
        skip=skip,
        limit=limit
    )


@router.post("/test", response_model=ScheduleTestResponse)
async def test_schedule_config(
    request: ScheduleTestRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user)
) -> ScheduleTestResponse:
    """Test a schedule configuration without creating it"""
    
    # Run the test asynchronously
    result = test_schedule_configuration(
        request.schedule_config.dict(),
        request.distribution_config.dict()
    )
    
    return ScheduleTestResponse(**result)


# Distribution Template endpoints

@router.post("/templates", response_model=DistributionTemplateResponse)
async def create_distribution_template(
    request: DistributionTemplateCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> DistributionTemplateResponse:
    """Create a reusable distribution template"""
    
    template = DistributionTemplate(
        user_id=current_user.id,
        name=request.name,
        type=request.type,
        config=request.config,
        is_default=request.is_default
    )
    
    # If setting as default, unset other defaults
    if request.is_default:
        await db.execute(
            select(DistributionTemplate).where(
                and_(
                    DistributionTemplate.user_id == current_user.id,
                    DistributionTemplate.type == request.type,
                    DistributionTemplate.is_default == True
                )
            ).update({"is_default": False})
        )
    
    db.add(template)
    await db.commit()
    await db.refresh(template)
    
    return DistributionTemplateResponse(**template.to_dict())


@router.get("/templates", response_model=List[DistributionTemplateResponse])
async def list_distribution_templates(
    type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> List[DistributionTemplateResponse]:
    """List user's distribution templates"""
    
    query = select(DistributionTemplate).where(
        DistributionTemplate.user_id == current_user.id
    )
    
    if type:
        query = query.where(DistributionTemplate.type == type)
    
    query = query.order_by(DistributionTemplate.is_default.desc(), DistributionTemplate.name)
    
    result = await db.execute(query)
    templates = result.scalars().all()
    
    return [DistributionTemplateResponse(**template.to_dict()) for template in templates]


@router.delete("/templates/{template_id}", status_code=204)
async def delete_distribution_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a distribution template"""
    
    template = await db.get(DistributionTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Check permissions
    if template.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.delete(template)
    await db.commit()