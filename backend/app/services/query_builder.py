"""
SQL Query Builder Service V2 - Production Ready
Uses SQLAlchemy Core expression language for safe, efficient query building
"""

from typing import List, Dict, Any, Optional, Set, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, Table, Column, MetaData
from sqlalchemy.sql import Select, Join
from sqlalchemy.sql.expression import BinaryExpression
import asyncio
import logging
from collections import defaultdict

from app.models import Field, DataTable, FieldRelationship
from app.schemas.report import QueryRequest
from app.services.security_service import SecurityService
from app.core.database import engine

logger = logging.getLogger(__name__)


class QueryBuilder:
    """
    Production-ready query builder using SQLAlchemy Core expression language
    - Prevents SQL injection by using SQLAlchemy's parameterized queries
    - Efficient metadata fetching with batch queries
    - Proper JOIN path calculation
    - Support for complex aggregations and filters
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.security_service = SecurityService()
        self.metadata = MetaData()
        
    async def build_query(self, request: QueryRequest) -> Select:
        """
        Build SQLAlchemy Select object from request
        Returns a Select object that can be executed with proper parameter binding
        """
        # Validate request for security
        security_errors = self.security_service.validate_json_safe(request.dict())
        if security_errors:
            raise ValueError(f"Security validation failed: {security_errors}")
        
        # Batch fetch all metadata
        metadata = await self._fetch_metadata(request)
        
        # Build SQLAlchemy table objects
        sa_tables = self._build_sqlalchemy_tables(metadata)
        
        # Start building the query
        query = self._build_select_clause(metadata, sa_tables, request.group_by)
        
        # Add FROM clause with JOINs
        query = self._add_from_and_joins(query, metadata, sa_tables)
        
        # Add WHERE clause
        query = self._add_where_clause(query, metadata, sa_tables, request.filters)
        
        # Add GROUP BY clause
        query = self._add_group_by_clause(query, metadata, sa_tables, request.group_by)
        
        # Add HAVING clause if needed
        if hasattr(request, 'having') and request.having:
            query = self._add_having_clause(query, metadata, sa_tables, request.having)
        
        # Add ORDER BY clause
        query = self._add_order_by_clause(query, metadata, sa_tables, request.order_by)
        
        # Add LIMIT/OFFSET
        if request.limit:
            query = query.limit(min(request.limit, 10000))  # Cap at 10k for safety
        if request.offset:
            query = query.offset(max(request.offset, 0))
        
        return query
    
    async def build_count_query(self, request: QueryRequest) -> Select:
        """
        Build count query using SQLAlchemy Core
        """
        # Batch fetch all metadata
        metadata = await self._fetch_metadata(request)
        
        # Build SQLAlchemy table objects
        sa_tables = self._build_sqlalchemy_tables(metadata)
        
        # Build count query
        query = select(func.count().label('total'))
        
        # Add FROM clause with JOINs
        query = self._add_from_and_joins(query, metadata, sa_tables)
        
        # Add WHERE clause
        query = self._add_where_clause(query, metadata, sa_tables, request.filters)
        
        return query
    
    async def _fetch_metadata(self, request: QueryRequest) -> Dict[str, Any]:
        """
        Efficiently fetch all required metadata in batch queries
        """
        field_ids = [UUID(f) for f in request.fields]
        
        # Prepare all queries
        fields_query = select(Field).where(Field.id.in_(field_ids))
        
        # Execute first query to get fields
        fields_result = await self.db.execute(fields_query)
        fields = fields_result.scalars().all()
        
        if not fields:
            raise ValueError("No valid fields specified")
        
        # Get unique table IDs
        table_ids = list(set(field.table_id for field in fields))
        
        # Prepare queries for tables and relationships
        tables_query = select(DataTable).where(DataTable.id.in_(table_ids))
        relationships_query = select(FieldRelationship).where(
            FieldRelationship.source_field_id.in_(field_ids) |
            FieldRelationship.target_field_id.in_(field_ids)
        )
        
        # Execute queries concurrently
        tables_result, relationships_result = await asyncio.gather(
            self.db.execute(tables_query),
            self.db.execute(relationships_query)
        )
        
        tables = tables_result.scalars().all()
        relationships = relationships_result.scalars().all()
        
        # If relationships reference fields not in our initial set, fetch those too
        all_field_ids = set(field_ids)
        for rel in relationships:
            all_field_ids.add(rel.source_field_id)
            all_field_ids.add(rel.target_field_id)
        
        # Fetch any additional fields needed for relationships
        if len(all_field_ids) > len(field_ids):
            additional_field_ids = all_field_ids - set(field_ids)
            additional_fields_result = await self.db.execute(
                select(Field).where(Field.id.in_(list(additional_field_ids)))
            )
            additional_fields = additional_fields_result.scalars().all()
            fields.extend(additional_fields)
        
        # Create lookup dictionaries
        fields_by_id = {field.id: field for field in fields}
        tables_by_id = {table.id: table for table in tables}
        
        return {
            'fields': fields,
            'fields_by_id': fields_by_id,
            'tables': tables,
            'tables_by_id': tables_by_id,
            'relationships': relationships,
            'requested_field_ids': field_ids
        }
    
    def _build_sqlalchemy_tables(self, metadata: Dict[str, Any]) -> Dict[UUID, Table]:
        """
        Build SQLAlchemy Table objects from our metadata
        """
        sa_tables = {}
        
        for table in metadata['tables']:
            # Create Table object with columns for fields we're using
            columns = []
            for field in metadata['fields']:
                if field.table_id == table.id:
                    # Create Column object
                    col = Column(field.column_name, nullable=True)
                    columns.append(col)
            
            # Create Table object  
            # Use actual table name from database, not the alias
            table_name = table.table_name
            if table.schema_name and table.schema_name != 'public':
                # Only prepend schema if it's not public (default)
                table_name = f"{table.schema_name}.{table_name}"
            
            sa_table = Table(
                table_name,  # Use actual table name, not alias
                self.metadata,
                *columns,
                extend_existing=True
            )
            sa_tables[table.id] = sa_table
        
        return sa_tables
    
    def _build_select_clause(
        self, 
        metadata: Dict[str, Any], 
        sa_tables: Dict[UUID, Table],
        group_by: List[str]
    ) -> Select:
        """
        Build SELECT clause using SQLAlchemy Core
        """
        select_columns = []
        
        for field_id in metadata['requested_field_ids']:
            field = metadata['fields_by_id'].get(field_id)
            if not field:
                continue
            
            table = sa_tables.get(field.table_id)
            if table is None:
                continue
            
            column = table.c[field.column_name]
            
            if field.is_calculated:
                # For calculated fields, we need a safe parser
                # For now, skip or use a placeholder
                logger.warning(f"Calculated field {field.display_name} not yet supported")
                continue
            
            elif not field.is_dimension and str(field.id) not in group_by:
                # Apply aggregation for measures
                # Handle both enum and string types for default_aggregation
                try:
                    if hasattr(field.default_aggregation, 'value'):
                        agg = field.default_aggregation.value.upper()
                    elif field.default_aggregation:
                        agg = str(field.default_aggregation).upper()
                    else:
                        agg = "SUM"
                except Exception as e:
                    logger.error(f"Error processing aggregation for field {field.display_name}: {e}")
                    logger.error(f"field.default_aggregation type: {type(field.default_aggregation)}")
                    logger.error(f"field.default_aggregation value: {field.default_aggregation}")
                    raise
                
                if agg == "SUM":
                    expr = func.sum(column)
                elif agg == "AVG":
                    expr = func.avg(column)
                elif agg == "COUNT":
                    expr = func.count(column)
                elif agg == "MIN":
                    expr = func.min(column)
                elif agg == "MAX":
                    expr = func.max(column)
                else:
                    expr = column
                
                select_columns.append(expr.label(field.display_name))
            else:
                # Regular dimension field
                select_columns.append(column.label(field.display_name))
        
        return select(*select_columns)
    
    def _add_from_and_joins(
        self,
        query: Select,
        metadata: Dict[str, Any],
        sa_tables: Dict[UUID, Table]
    ) -> Select:
        """
        Add FROM clause and JOINs using proper graph traversal
        """
        tables = metadata['tables']
        
        # If only one table, simple FROM
        if len(tables) == 1:
            table = sa_tables[tables[0].id]
            return query.select_from(table)
        
        # Build join path using relationships
        join_path = self._calculate_join_path(metadata)
        
        if not join_path:
            # No joins found, use first table
            table = sa_tables[tables[0].id]
            return query.select_from(table)
        
        # Apply joins
        base_table_id = join_path[0]['base_table']
        base_table = sa_tables[base_table_id]
        query = query.select_from(base_table)
        
        for join_info in join_path:
            if 'join_table' not in join_info:
                continue
            
            join_table = sa_tables[join_info['join_table']]
            left_col = sa_tables[join_info['left_table']].c[join_info['left_column']]
            right_col = join_table.c[join_info['right_column']]
            
            join_type = join_info.get('join_type', 'inner').lower()
            
            if join_type == 'left':
                query = query.outerjoin(join_table, left_col == right_col)
            elif join_type == 'right':
                query = query.outerjoin(join_table, left_col == right_col, isouter=True, full=False)
            else:  # inner join
                query = query.join(join_table, left_col == right_col)
        
        return query
    
    def _calculate_join_path(self, metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Calculate optimal join path using BFS
        """
        relationships = metadata['relationships']
        tables = metadata['tables']
        fields_by_id = metadata['fields_by_id']
        
        if not relationships or len(tables) <= 1:
            return []
        
        # Build adjacency list for table relationships
        table_graph = defaultdict(list)
        
        for rel in relationships:
            source_field = fields_by_id.get(rel.source_field_id)
            target_field = fields_by_id.get(rel.target_field_id)
            
            if source_field and target_field:
                table_graph[source_field.table_id].append({
                    'target_table': target_field.table_id,
                    'source_column': source_field.column_name,
                    'target_column': target_field.column_name,
                    'join_type': rel.join_type.lower() if rel.join_type else 'inner',
                    'relationship': rel
                })
        
        # Find shortest path to connect all required tables
        required_tables = set(table.id for table in tables)
        base_table_id = tables[0].id
        
        join_path = []
        joined_tables = {base_table_id}
        
        # BFS to find tables to join
        queue = [(base_table_id, [])]
        
        while queue and joined_tables < required_tables:
            current_table, path = queue.pop(0)
            
            for edge in table_graph[current_table]:
                target_table = edge['target_table']
                
                if target_table not in joined_tables and target_table in required_tables:
                    join_info = {
                        'base_table': base_table_id,
                        'left_table': current_table,
                        'join_table': target_table,
                        'left_column': edge['source_column'],
                        'right_column': edge['target_column'],
                        'join_type': edge['join_type']
                    }
                    join_path.append(join_info)
                    joined_tables.add(target_table)
                    queue.append((target_table, path + [join_info]))
        
        return join_path
    
    def _add_where_clause(
        self,
        query: Select,
        metadata: Dict[str, Any],
        sa_tables: Dict[UUID, Table],
        filters: List[Dict[str, Any]]
    ) -> Select:
        """
        Add WHERE clause using SQLAlchemy expressions
        """
        if not filters:
            return query
        
        conditions = []
        fields_by_id = metadata['fields_by_id']
        
        for filter_def in filters:
            field_id = filter_def.get("field")
            operator = filter_def.get("operator", "=").lower()
            value = filter_def.get("value")
            
            if not field_id or value is None:
                continue
            
            field = fields_by_id.get(UUID(field_id))
            if not field:
                continue
            
            table = sa_tables.get(field.table_id)
            if table is None:
                continue
            
            column = table.c[field.column_name]
            
            # Build condition based on operator
            if operator == "=":
                conditions.append(column == value)
            elif operator in ["!=", "<>"]:
                conditions.append(column != value)
            elif operator == "<":
                conditions.append(column < value)
            elif operator == ">":
                conditions.append(column > value)
            elif operator == "<=":
                conditions.append(column <= value)
            elif operator == ">=":
                conditions.append(column >= value)
            elif operator == "in":
                if not isinstance(value, list):
                    value = [value]
                # Limit to 100 values for DoS protection
                if len(value) > 100:
                    raise ValueError("IN operator limited to 100 values")
                conditions.append(column.in_(value))
            elif operator == "not in":
                if not isinstance(value, list):
                    value = [value]
                if len(value) > 100:
                    raise ValueError("NOT IN operator limited to 100 values")
                conditions.append(~column.in_(value))
            elif operator == "between":
                if isinstance(value, list) and len(value) == 2:
                    conditions.append(column.between(value[0], value[1]))
            elif operator == "like":
                conditions.append(column.like(f"%{value}%"))
            elif operator == "not like":
                conditions.append(~column.like(f"%{value}%"))
            elif operator == "is null":
                conditions.append(column.is_(None))
            elif operator == "is not null":
                conditions.append(column.isnot(None))
        
        if conditions:
            # For now, AND all conditions. Could extend to support OR logic
            query = query.where(and_(*conditions))
        
        return query
    
    def _add_group_by_clause(
        self,
        query: Select,
        metadata: Dict[str, Any],
        sa_tables: Dict[UUID, Table],
        group_by: List[str]
    ) -> Select:
        """
        Add GROUP BY clause
        """
        if not group_by:
            return query
        
        group_columns = []
        fields_by_id = metadata['fields_by_id']
        
        for field_id in group_by:
            field = fields_by_id.get(UUID(field_id))
            if not field:
                continue
            
            table = sa_tables.get(field.table_id)
            if table is None:
                continue
            
            column = table.c[field.column_name]
            group_columns.append(column)
        
        if group_columns:
            query = query.group_by(*group_columns)
        
        return query
    
    def _add_having_clause(
        self,
        query: Select,
        metadata: Dict[str, Any],
        sa_tables: Dict[UUID, Table],
        having_conditions: List[Dict[str, Any]]
    ) -> Select:
        """
        Add HAVING clause for filtering on aggregates
        """
        if not having_conditions:
            return query
        
        conditions = []
        fields_by_id = metadata['fields_by_id']
        
        for condition_def in having_conditions:
            field_id = condition_def.get("field")
            aggregation = condition_def.get("aggregation", "sum").lower()
            operator = condition_def.get("operator", "=").lower()
            value = condition_def.get("value")
            
            if not field_id or value is None:
                continue
            
            field = fields_by_id.get(UUID(field_id))
            if not field:
                continue
            
            table = sa_tables.get(field.table_id)
            if table is None:
                continue
            
            column = table.c[field.column_name]
            
            # Build aggregate expression
            if aggregation == "sum":
                agg_expr = func.sum(column)
            elif aggregation == "avg":
                agg_expr = func.avg(column)
            elif aggregation == "count":
                agg_expr = func.count(column)
            elif aggregation == "min":
                agg_expr = func.min(column)
            elif aggregation == "max":
                agg_expr = func.max(column)
            else:
                continue
            
            # Build condition
            if operator == "=":
                conditions.append(agg_expr == value)
            elif operator in ["!=", "<>"]:
                conditions.append(agg_expr != value)
            elif operator == "<":
                conditions.append(agg_expr < value)
            elif operator == ">":
                conditions.append(agg_expr > value)
            elif operator == "<=":
                conditions.append(agg_expr <= value)
            elif operator == ">=":
                conditions.append(agg_expr >= value)
        
        if conditions:
            query = query.having(and_(*conditions))
        
        return query
    
    def _add_order_by_clause(
        self,
        query: Select,
        metadata: Dict[str, Any],
        sa_tables: Dict[UUID, Table],
        order_by: List[Dict[str, str]]
    ) -> Select:
        """
        Add ORDER BY clause
        """
        if not order_by:
            return query
        
        order_columns = []
        fields_by_id = metadata['fields_by_id']
        
        for order_def in order_by:
            field_id = order_def.get("field")
            direction = order_def.get("direction", "ASC").upper()
            
            if direction not in ["ASC", "DESC"]:
                direction = "ASC"
            
            field = fields_by_id.get(UUID(field_id))
            if not field:
                continue
            
            table = sa_tables.get(field.table_id)
            if table is None:
                continue
            
            column = table.c[field.column_name]
            
            if direction == "DESC":
                order_columns.append(column.desc())
            else:
                order_columns.append(column.asc())
        
        if order_columns:
            query = query.order_by(*order_columns)
        
        return query