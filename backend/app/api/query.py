"""
Query execution API endpoints
"""

from typing import List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select
import json
import asyncio

from app.core.database import get_db
from app.models import Field, DataTable, DataSource, FieldRelationship, User
from app.schemas.report import QueryRequest, QueryResponse
from app.api.auth import get_current_user
from app.services.query_builder import QueryBuilder

router = APIRouter()


class QueryExecutor:
    """Service for executing queries against data sources"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.query_builder = QueryBuilder(db)
    
    async def execute_query(
        self,
        request: QueryRequest,
        user: User
    ) -> QueryResponse:
        """Execute a query and return results"""
        start_time = datetime.utcnow()
        
        try:
            # Build SQL query from request
            sql_query = await self.query_builder.build_query(request)
            
            # Execute query (sql_query is already a Select object)
            result = await self.db.execute(sql_query)
            rows = result.fetchall()
            
            # Convert rows to dict format
            data = []
            if rows:
                columns = result.keys()
                for row in rows:
                    data.append(dict(zip(columns, row)))
            
            # Calculate execution time
            duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            
            # Get total count (without limit)
            count_query = await self.query_builder.build_count_query(request)
            count_result = await self.db.execute(count_query)
            total_rows = count_result.scalar() or 0
            
            return QueryResponse(
                data=data,
                total_rows=total_rows,
                executed_at=start_time,
                duration_ms=duration_ms,
                query=str(sql_query) if user.is_superuser else None
            )
            
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Query execution failed: {str(e)}"
            )


@router.post("/execute", response_model=QueryResponse)
async def execute_query(
    request: QueryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Execute a query and return results"""
    executor = QueryExecutor(db)
    return await executor.execute_query(request, current_user)


@router.post("/preview", response_model=QueryResponse)
async def preview_query(
    request: QueryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Preview query results (limited to 100 rows)"""
    # Force limit for preview
    request.limit = min(request.limit or 100, 100)
    
    executor = QueryExecutor(db)
    return await executor.execute_query(request, current_user)


@router.post("/validate")
async def validate_query(
    request: QueryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Validate a query without executing it"""
    try:
        query_builder = QueryBuilder(db)
        sql_query = await query_builder.build_query(request)
        
        # Try to prepare the query without executing
        await db.execute(text(f"EXPLAIN {sql_query}"))
        
        return {
            "valid": True,
            "message": "Query is valid",
            "sql": sql_query if current_user.is_superuser else None
        }
    except Exception as e:
        return {
            "valid": False,
            "message": str(e),
            "sql": None
        }


@router.websocket("/stream")
async def stream_query(
    websocket: WebSocket,
    db: AsyncSession = Depends(get_db)
):
    """Stream query results via WebSocket"""
    await websocket.accept()
    
    try:
        while True:
            # Receive query request
            data = await websocket.receive_json()
            
            # TODO: Authenticate WebSocket connection
            # For now, we'll skip auth in WebSocket
            
            request = QueryRequest(**data)
            query_builder = QueryBuilder(db)
            
            # Build and execute query
            sql_query = await query_builder.build_query(request)
            result = await db.execute(text(sql_query))
            
            # Stream results in chunks
            chunk_size = 100
            chunk = []
            columns = result.keys()
            
            async for row in result:
                chunk.append(dict(zip(columns, row)))
                
                if len(chunk) >= chunk_size:
                    await websocket.send_json({
                        "type": "data",
                        "data": chunk
                    })
                    chunk = []
                    await asyncio.sleep(0.01)  # Small delay to prevent overwhelming
            
            # Send remaining data
            if chunk:
                await websocket.send_json({
                    "type": "data",
                    "data": chunk
                })
            
            # Send completion message
            await websocket.send_json({
                "type": "complete",
                "message": "Query completed"
            })
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_json({
            "type": "error",
            "message": str(e)
        })
        await websocket.close()


@router.get("/fields/hierarchy")
async def get_fields_hierarchy(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get hierarchical structure of fields for UI"""
    # Get all data sources with tables and fields
    query = select(DataSource).where(DataSource.is_active == True)
    result = await db.execute(query)
    data_sources = result.scalars().all()
    
    hierarchy = []
    
    for ds in data_sources:
        # Get tables for this data source
        tables_query = select(DataTable).where(
            DataTable.data_source_id == ds.id,
            DataTable.is_active == True
        )
        tables_result = await db.execute(tables_query)
        tables = tables_result.scalars().all()
        
        ds_node = {
            "id": str(ds.id),
            "name": ds.name,
            "type": "datasource",
            "children": []
        }
        
        for table in tables:
            # Get fields for this table
            fields_query = select(Field).where(
                Field.table_id == table.id,
                Field.is_visible == True
            )
            fields_result = await db.execute(fields_query)
            fields = fields_result.scalars().all()
            
            table_node = {
                "id": str(table.id),
                "name": table.alias or table.table_name,
                "type": "table",
                "children": []
            }
            
            for field in fields:
                field_node = {
                    "id": str(field.id),
                    "name": field.display_name,
                    "type": "field",
                    "fieldType": field.field_type.value,
                    "isDimension": field.is_dimension,
                    "isCalculated": field.is_calculated,
                    "aggregation": field.default_aggregation.value
                }
                table_node["children"].append(field_node)
            
            if table_node["children"]:
                ds_node["children"].append(table_node)
        
        if ds_node["children"]:
            hierarchy.append(ds_node)
    
    return {"hierarchy": hierarchy}