"""
Schedule API module
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.schedule import Schedule, ScheduleLog
from app.models.user import User
from app.api.auth import get_current_user

router = APIRouter(prefix="/schedule", tags=["Schedule"])


@router.get("/")
async def list_schedules(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    active_only: bool = True
):
    """List all schedules"""
    query = select(Schedule).options(
        selectinload(Schedule.report),
        selectinload(Schedule.created_by)
    )
    
    if active_only:
        query = query.where(Schedule.is_active == True)
    
    # Filter by user access
    if not current_user.is_superuser:
        query = query.where(Schedule.created_by_id == current_user.id)
    
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    schedules = result.scalars().all()
    
    return schedules


@router.post("/")
async def create_schedule(
    schedule_data: dict,  # TODO: Create proper schema
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new schedule"""
    schedule = Schedule(
        report_id=schedule_data["report_id"],
        name=schedule_data["name"],
        cron_expression=schedule_data.get("cron_expression", "0 9 * * 1"),  # Default: Monday 9am
        is_active=True,
        created_by_id=current_user.id,
        parameters=schedule_data.get("parameters", {}),
        output_format=schedule_data.get("output_format", "xlsx"),
        next_run=datetime.utcnow() + timedelta(days=1)  # TODO: Calculate from cron
    )
    
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    
    return schedule


@router.get("/{schedule_id}")
async def get_schedule(
    schedule_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific schedule"""
    schedule = await db.get(Schedule, schedule_id)
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found"
        )
    
    # Check access
    if not current_user.is_superuser and schedule.created_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to view this schedule"
        )
    
    return schedule


@router.put("/{schedule_id}/toggle")
async def toggle_schedule(
    schedule_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Enable or disable a schedule"""
    schedule = await db.get(Schedule, schedule_id)
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found"
        )
    
    # Check access
    if not current_user.is_superuser and schedule.created_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to modify this schedule"
        )
    
    schedule.is_active = not schedule.is_active
    await db.commit()
    
    return {"message": f"Schedule {'enabled' if schedule.is_active else 'disabled'}"}


@router.delete("/{schedule_id}")
async def delete_schedule(
    schedule_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a schedule"""
    schedule = await db.get(Schedule, schedule_id)
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found"
        )
    
    # Check access
    if not current_user.is_superuser and schedule.created_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to delete this schedule"
        )
    
    await db.delete(schedule)
    await db.commit()
    
    return {"message": "Schedule deleted successfully"}


@router.get("/{schedule_id}/logs")
async def get_schedule_logs(
    schedule_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(10, ge=1, le=100)
):
    """Get execution logs for a schedule"""
    schedule = await db.get(Schedule, schedule_id)
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found"
        )
    
    # Check access
    if not current_user.is_superuser and schedule.created_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to view this schedule"
        )
    
    query = select(ScheduleLog).where(
        ScheduleLog.schedule_id == schedule_id
    ).order_by(ScheduleLog.timestamp.desc()).limit(limit)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return logs