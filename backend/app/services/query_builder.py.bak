"""
SQL Query Builder Service
Dynamically builds SQL queries from report definitions
"""

from typing import List, Dict, Any, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import Field, DataTable, FieldRelationship
from app.schemas.report import QueryRequest


class QueryBuilder:
    """Build SQL queries from report definitions"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def build_query(self, request: QueryRequest) -> str:
        """Build SQL query from request"""
        # Get field information
        field_ids = [UUID(f) for f in request.fields]
        fields = await self._get_fields(field_ids)
        
        if not fields:
            raise ValueError("No valid fields specified")
        
        # Determine tables and joins needed
        tables = await self._get_tables_and_joins(fields)
        
        # Build SELECT clause
        select_clause = self._build_select_clause(fields, request.group_by)
        
        # Build FROM clause
        from_clause = self._build_from_clause(tables)
        
        # Build WHERE clause
        where_clause = self._build_where_clause(request.filters)
        
        # Build GROUP BY clause
        group_by_clause = self._build_group_by_clause(request.group_by, fields)
        
        # Build ORDER BY clause
        order_by_clause = self._build_order_by_clause(request.order_by, fields)
        
        # Build LIMIT clause
        limit_clause = self._build_limit_clause(request.limit, request.offset)
        
        # Combine all parts
        query_parts = [
            f"SELECT {select_clause}",
            f"FROM {from_clause}"
        ]
        
        if where_clause:
            query_parts.append(f"WHERE {where_clause}")
        
        if group_by_clause:
            query_parts.append(f"GROUP BY {group_by_clause}")
        
        if order_by_clause:
            query_parts.append(f"ORDER BY {order_by_clause}")
        
        if limit_clause:
            query_parts.append(limit_clause)
        
        return "\n".join(query_parts)
    
    async def build_count_query(self, request: QueryRequest) -> str:
        """Build count query (without limit)"""
        # Get field information
        field_ids = [UUID(f) for f in request.fields]
        fields = await self._get_fields(field_ids)
        
        if not fields:
            raise ValueError("No valid fields specified")
        
        # Determine tables and joins needed
        tables = await self._get_tables_and_joins(fields)
        
        # Build FROM clause
        from_clause = self._build_from_clause(tables)
        
        # Build WHERE clause
        where_clause = self._build_where_clause(request.filters)
        
        # Build query
        query_parts = [
            "SELECT COUNT(*) as total",
            f"FROM {from_clause}"
        ]
        
        if where_clause:
            query_parts.append(f"WHERE {where_clause}")
        
        return "\n".join(query_parts)
    
    async def _get_fields(self, field_ids: List[UUID]) -> List[Field]:
        """Get field objects from IDs"""
        result = await self.db.execute(
            select(Field).where(Field.id.in_(field_ids))
        )
        return result.scalars().all()
    
    async def _get_tables_and_joins(self, fields: List[Field]) -> Dict[UUID, DataTable]:
        """Determine tables needed and how to join them"""
        tables = {}
        
        for field in fields:
            if field.table_id not in tables:
                result = await self.db.execute(
                    select(DataTable).where(DataTable.id == field.table_id)
                )
                table = result.scalar_one()
                tables[field.table_id] = table
        
        # TODO: Implement join logic based on FieldRelationship
        # For now, we'll assume single table queries
        
        return tables
    
    def _build_select_clause(self, fields: List[Field], group_by: List[str]) -> str:
        """Build SELECT clause"""
        select_parts = []
        
        for field in fields:
            table_result = self.db.execute(
                select(DataTable).where(DataTable.id == field.table_id)
            )
            # Note: In async context, this needs to be awaited properly
            # This is a simplified version
            
            if field.is_calculated:
                # Use calculation formula
                select_parts.append(
                    f"{field.calculation_formula} AS {field.display_name}"
                )
            elif not field.is_dimension and str(field.id) not in group_by:
                # Apply aggregation for measures
                agg = field.default_aggregation.value.upper()
                if agg != "NONE":
                    select_parts.append(
                        f"{agg}({field.column_name}) AS {field.display_name}"
                    )
                else:
                    select_parts.append(
                        f"{field.column_name} AS {field.display_name}"
                    )
            else:
                # Regular field
                select_parts.append(
                    f"{field.column_name} AS {field.display_name}"
                )
        
        return ", ".join(select_parts)
    
    def _build_from_clause(self, tables: Dict[UUID, DataTable]) -> str:
        """Build FROM clause"""
        # For now, single table only
        # TODO: Implement joins
        table = list(tables.values())[0]
        
        from_parts = []
        if table.schema_name:
            from_parts.append(f"{table.schema_name}.{table.table_name}")
        else:
            from_parts.append(table.table_name)
        
        if table.alias:
            from_parts.append(f"AS {table.alias}")
        
        return " ".join(from_parts)
    
    def _build_where_clause(self, filters: List[Dict[str, Any]]) -> str:
        """Build WHERE clause from filters"""
        if not filters:
            return ""
        
        conditions = []
        
        for filter_def in filters:
            field_id = filter_def.get("field")
            operator = filter_def.get("operator", "=")
            value = filter_def.get("value")
            
            if not field_id or value is None:
                continue
            
            # TODO: Get field info and build proper condition
            # This is simplified
            if operator == "in":
                values_str = ", ".join([f"'{v}'" for v in value])
                conditions.append(f"field_{field_id} IN ({values_str})")
            elif operator == "between":
                conditions.append(
                    f"field_{field_id} BETWEEN '{value[0]}' AND '{value[1]}'"
                )
            elif operator == "like":
                conditions.append(f"field_{field_id} LIKE '%{value}%'")
            else:
                conditions.append(f"field_{field_id} {operator} '{value}'")
        
        return " AND ".join(conditions)
    
    def _build_group_by_clause(
        self,
        group_by: List[str],
        fields: List[Field]
    ) -> str:
        """Build GROUP BY clause"""
        if not group_by:
            return ""
        
        group_fields = []
        for field_id in group_by:
            field = next((f for f in fields if str(f.id) == field_id), None)
            if field:
                group_fields.append(field.column_name)
        
        return ", ".join(group_fields)
    
    def _build_order_by_clause(
        self,
        order_by: List[Dict[str, str]],
        fields: List[Field]
    ) -> str:
        """Build ORDER BY clause"""
        if not order_by:
            return ""
        
        order_parts = []
        for order_def in order_by:
            field_id = order_def.get("field")
            direction = order_def.get("direction", "ASC").upper()
            
            field = next((f for f in fields if str(f.id) == field_id), None)
            if field:
                order_parts.append(f"{field.column_name} {direction}")
        
        return ", ".join(order_parts)
    
    def _build_limit_clause(
        self,
        limit: Optional[int],
        offset: Optional[int]
    ) -> str:
        """Build LIMIT clause"""
        parts = []
        
        if limit:
            parts.append(f"LIMIT {limit}")
        
        if offset:
            parts.append(f"OFFSET {offset}")
        
        return " ".join(parts)