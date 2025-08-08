"""
Fields API module
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.field import Field, DataTable, DataSource, FieldRelationship
from app.models.user import User
from app.api.auth import get_current_user

router = APIRouter(prefix="/fields", tags=["Fields"])


@router.get("/")
async def list_fields(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    table_id: Optional[UUID] = None,
    search: Optional[str] = None
):
    """List all available fields"""
    query = select(Field).options(
        selectinload(Field.table)
    )
    
    if table_id:
        query = query.where(Field.table_id == table_id)
    
    if search:
        query = query.where(
            Field.display_name.ilike(f"%{search}%") |
            Field.description.ilike(f"%{search}%")
        )
    
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    fields = result.scalars().all()
    
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


@router.get("/{field_id}")
async def get_field(
    field_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific field by ID"""
    field = await db.get(Field, field_id)
    
    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Field not found"
        )
    
    return field


@router.get("/relationships")
async def get_field_relationships(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all field relationships for joins"""
    query = select(FieldRelationship).options(
        selectinload(FieldRelationship.source_field),
        selectinload(FieldRelationship.target_field)
    )
    
    result = await db.execute(query)
    relationships = result.scalars().all()
    
    return relationships