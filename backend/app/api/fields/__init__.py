"""
Fields API module
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.database import get_db
from app.models.field import Field, DataTable, DataSource, FieldRelationship
from app.models.user import User
from app.api.auth import get_current_user
from app.services.field_service_secure import SecureFieldService as FieldService


class FieldSecurityUpdate(BaseModel):
    """Request model for updating field security settings"""
    required_role: Optional[str] = None
    required_permissions: Optional[List[str]] = None
    is_restricted: bool = True  # Secure by default

router = APIRouter(tags=["Fields"])


@router.get("/")
async def list_fields(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    table_id: Optional[UUID] = None,
    search: Optional[str] = None
):
    """List all fields accessible to the current user"""
    fields = await FieldService.get_accessible_fields(
        db=db,
        user=current_user,
        table_id=table_id,
        search=search,
        skip=skip,
        limit=limit
    )
    
    return fields


@router.get("/tables")
async def list_tables(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all data tables"""
    query = select(DataTable).options(
        selectinload(DataTable.data_source),
        selectinload(DataTable.fields)
    )
    
    result = await db.execute(query)
    tables = result.scalars().all()
    
    return tables


@router.get("/datasources")
async def list_datasources(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all data sources"""
    query = select(DataSource).options(
        selectinload(DataSource.tables)
    )
    
    result = await db.execute(query)
    sources = result.scalars().all()
    
    return sources


@router.get("/statistics")
async def get_field_statistics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get field access statistics for the current user"""
    stats = await FieldService.get_field_statistics(db, current_user)
    return stats


@router.get("/{field_id}")
async def get_field(
    field_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific field by ID if user has access"""
    field = await FieldService.get_field_by_id(db, current_user, field_id)
    
    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Field not found or access denied"
        )
    
    return field


@router.get("/relationships")
async def get_field_relationships(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get field relationships for fields the user can access"""
    relationships = await FieldService.get_field_relationships(db, current_user)
    return relationships


@router.put("/{field_id}/security")
async def update_field_security(
    field_id: UUID,
    security_update: FieldSecurityUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update field security settings (admin only)
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update field security"
        )
    
    field = await FieldService.update_field_security(
        db=db,
        user=current_user,
        field_id=field_id,
        required_role=security_update.required_role,
        required_permissions=security_update.required_permissions,
        is_restricted=security_update.is_restricted
    )
    
    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Field not found"
        )
    
    return field