"""
Secure Field Service with fixed RBAC implementation
Addresses all critical security issues identified by Gemini
"""

from typing import List, Optional, Dict, Any, Set
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, exists, func, cast
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import selectinload, joinedload
import logging
from functools import lru_cache

from app.models.field import Field, DataTable, DataSource, FieldRelationship
from app.models.user import User, Role, Permission, role_permissions, user_roles
from app.services.security_service import SecurityService

logger = logging.getLogger(__name__)


class SecureFieldService:
    """Secure service for managing fields with proper role-based access control"""
    
    @staticmethod
    async def get_accessible_fields(
        db: AsyncSession,
        user: User,
        table_id: Optional[UUID] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Field]:
        """
        Get fields accessible to the user based on their role and permissions.
        ALL filtering happens at the database level for security.
        """
        # Build base query with eager loading
        query = select(Field).options(
            selectinload(Field.table)
        )
        
        # Apply table filter if provided
        if table_id:
            query = query.where(Field.table_id == table_id)
        
        # Apply search filter if provided
        if search:
            # Validate search input to prevent injection
            sql_errors = SecurityService.validate_sql_safe(search, "search")
            if sql_errors:
                logger.warning(f"SQL injection attempt detected in search: {search} - {sql_errors}")
                return []
            
            query = query.where(
                or_(
                    Field.display_name.ilike(f"%{search}%"),
                    Field.description.ilike(f"%{search}%")
                )
            )
        
        # Apply field-level RBAC at database level
        if not user.is_superuser:
            # Pre-fetch user's roles and permissions once
            user_role_names, user_permission_names = await SecureFieldService._get_user_access_info(db, user)
            
            # Build secure access conditions using AND logic
            access_conditions = SecureFieldService._build_field_access_conditions(
                user_role_names, 
                user_permission_names
            )
            
            query = query.where(access_conditions)
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        
        # Execute query - all filtering has been done at DB level
        result = await db.execute(query)
        fields = result.scalars().all()
        
        logger.info(f"User {user.email} retrieved {len(fields)} accessible fields (secure query)")
        return fields
    
    @staticmethod
    def _build_field_access_conditions(
        user_role_names: Set[str], 
        user_permission_names: Set[str]
    ):
        """
        Build secure access conditions using proper AND logic.
        A field is accessible if:
        1. It's explicitly unrestricted (is_restricted = False), OR
        2. It's restricted AND user meets ALL requirements (role AND permissions)
        """
        # Condition 1: Field is explicitly unrestricted
        # Note: We do NOT treat NULL as unrestricted (secure by default)
        unrestricted_condition = Field.is_restricted == False
        
        # Condition 2: Field is restricted but user meets ALL requirements
        restricted_access_conditions = []
        
        # If field has required_role, user must have that role
        if user_role_names:
            # User must have the required role (if specified)
            role_condition = or_(
                Field.required_role.is_(None),  # No role required
                Field.required_role.in_(user_role_names)  # User has required role
            )
            restricted_access_conditions.append(role_condition)
        else:
            # User has no roles, can only access fields without role requirements
            restricted_access_conditions.append(Field.required_role.is_(None))
        
        # For permissions, check if user has ALL required permissions (not just ANY)
        # CRITICAL: This must be an ALL check to be secure
        if user_permission_names:
            # Cast user's permissions to JSONB array for comparison
            user_perms_as_jsonb = cast(list(user_permission_names), JSONB)
            
            # Field is accessible if:
            # 1. It requires no permissions (NULL or empty array), OR
            # 2. User's permissions contain ALL of the field's required permissions
            permission_condition = or_(
                Field.required_permissions.is_(None),
                func.jsonb_array_length(cast(Field.required_permissions, JSONB)) == 0,
                # This checks if user has ALL required permissions (superset check)
                user_perms_as_jsonb.contains(cast(Field.required_permissions, JSONB))
            )
        else:
            # User has no permissions, can only access fields with no permission requirements
            permission_condition = or_(
                Field.required_permissions.is_(None),
                func.jsonb_array_length(cast(Field.required_permissions, JSONB)) == 0
            )
        
        restricted_access_conditions.append(permission_condition)
        
        # Combine conditions: unrestricted OR (restricted AND meets requirements)
        return or_(
            unrestricted_condition,
            and_(
                Field.is_restricted == True,
                and_(*restricted_access_conditions)
            )
        )
    
    @staticmethod
    async def can_access_field(
        db: AsyncSession,
        user: User,
        field: Field
    ) -> bool:
        """
        Check if user can access a specific field.
        Uses secure logic: restricted by default, explicit access required.
        """
        # Superusers can access all fields
        if user.is_superuser:
            return True
        
        # Check if field is explicitly unrestricted
        # NULL or missing is_restricted means RESTRICTED (secure by default)
        if field.is_restricted is False:
            return True
        
        # Field is restricted - check requirements using AND logic
        # User must meet ALL requirements (role AND permissions)
        
        # Pre-fetch user's access info
        user_role_names, user_permission_names = await SecureFieldService._get_user_access_info(db, user)
        
        # Check role requirement
        if field.required_role:
            if field.required_role not in user_role_names:
                logger.warning(
                    f"User {user.email} denied access to field {field.id} "
                    f"(missing required role: {field.required_role})"
                )
                return False
        
        # Check permission requirements (ALL required)
        if field.required_permissions:
            missing_permissions = []
            for required_permission in field.required_permissions:
                if required_permission not in user_permission_names:
                    missing_permissions.append(required_permission)
            
            if missing_permissions:
                logger.warning(
                    f"User {user.email} denied access to field {field.id} "
                    f"(missing permissions: {', '.join(missing_permissions)})"
                )
                return False
        
        # User meets all requirements
        return True
    
    @staticmethod
    async def get_field_by_id(
        db: AsyncSession,
        user: User,
        field_id: UUID
    ) -> Optional[Field]:
        """
        Get a specific field if user has access.
        Uses database-level filtering for security.
        """
        if user.is_superuser:
            # Superuser can access any field
            field = await db.get(Field, field_id)
            return field
        
        # For non-superusers, use secure query with access conditions
        user_role_names, user_permission_names = await SecureFieldService._get_user_access_info(db, user)
        access_conditions = SecureFieldService._build_field_access_conditions(
            user_role_names, 
            user_permission_names
        )
        
        query = select(Field).where(
            and_(
                Field.id == field_id,
                access_conditions
            )
        )
        
        result = await db.execute(query)
        field = result.scalar_one_or_none()
        
        if not field:
            logger.warning(
                f"User {user.email} attempted to access field {field_id} - access denied or not found"
            )
        
        return field
    
    @staticmethod
    async def get_field_relationships(
        db: AsyncSession,
        user: User
    ) -> List[FieldRelationship]:
        """
        Get field relationships with efficient access checking.
        Pre-fetches accessible fields to avoid N+1 queries.
        """
        # First, get all accessible field IDs for the user
        accessible_fields = await SecureFieldService.get_accessible_fields(
            db=db,
            user=user,
            limit=10000  # Get all accessible fields
        )
        accessible_field_ids = {field.id for field in accessible_fields}
        
        # Query relationships where both source and target are accessible
        query = select(FieldRelationship).options(
            selectinload(FieldRelationship.source_field),
            selectinload(FieldRelationship.target_field)
        ).where(
            and_(
                FieldRelationship.source_field_id.in_(accessible_field_ids),
                FieldRelationship.target_field_id.in_(accessible_field_ids)
            )
        )
        
        result = await db.execute(query)
        relationships = result.scalars().all()
        
        logger.info(
            f"User {user.email} retrieved {len(relationships)} accessible field relationships"
        )
        return relationships
    
    @staticmethod
    async def update_field_security(
        db: AsyncSession,
        user: User,
        field_id: UUID,
        required_role: Optional[str] = None,
        required_permissions: Optional[List[str]] = None,
        is_restricted: bool = True  # Default to restricted (secure by default)
    ) -> Optional[Field]:
        """
        Update field security settings (admin only).
        Defaults to restricted for security.
        """
        # Only superusers can update field security
        if not user.is_superuser:
            logger.warning(
                f"Non-admin user {user.email} attempted to update field security"
            )
            return None
        
        # Validate role if provided
        if required_role:
            role_exists = await db.execute(
                select(exists().where(Role.name == required_role))
            )
            if not role_exists.scalar():
                logger.error(f"Invalid role specified: {required_role}")
                return None
        
        # Get the field
        field = await db.get(Field, field_id)
        if not field:
            return None
        
        # Update security settings
        field.required_role = required_role
        field.required_permissions = required_permissions
        field.is_restricted = is_restricted
        
        # Save changes
        db.add(field)
        await db.commit()
        await db.refresh(field)
        
        logger.info(
            f"Admin {user.email} updated security settings for field {field_id} "
            f"(restricted: {is_restricted}, role: {required_role}, perms: {required_permissions})"
        )
        return field
    
    @staticmethod
    async def _get_user_access_info(
        db: AsyncSession, 
        user: User
    ) -> tuple[Set[str], Set[str]]:
        """
        Get user's roles and permissions using centralized RBAC service.
        Returns (role_names, permission_names) as sets for fast lookup.
        """
        from app.services.rbac_service import RBACService
        
        rbac_service = RBACService(db)
        return await rbac_service.get_user_access_info(user.id)
    
    @staticmethod
    async def get_field_statistics(
        db: AsyncSession,
        user: User
    ) -> Dict[str, Any]:
        """
        Get statistics about fields and access using efficient queries.
        """
        # Get total field count
        total_count_query = select(func.count(Field.id))
        total_result = await db.execute(total_count_query)
        total_fields = total_result.scalar() or 0
        
        # Get restricted field count
        restricted_count_query = select(func.count(Field.id)).where(
            Field.is_restricted == True
        )
        restricted_result = await db.execute(restricted_count_query)
        restricted_count = restricted_result.scalar() or 0
        
        # Get accessible fields count for user
        accessible_fields = await SecureFieldService.get_accessible_fields(
            db=db,
            user=user,
            limit=10000  # Get all accessible fields
        )
        accessible_count = len(accessible_fields)
        
        return {
            "total_fields": total_fields,
            "accessible_fields": accessible_count,
            "restricted_fields": restricted_count,
            "unrestricted_fields": total_fields - restricted_count,
            "access_percentage": (
                (accessible_count / total_fields * 100) if total_fields > 0 else 0
            ),
            "is_superuser": user.is_superuser
        }
    
    @staticmethod
    async def validate_field_permissions(
        db: AsyncSession,
        user: User,
        field_ids: List[UUID]
    ) -> Dict[UUID, bool]:
        """
        Batch validate access to multiple fields efficiently.
        Returns a dictionary mapping field_id to access status.
        """
        if not field_ids:
            return {}
        
        if user.is_superuser:
            # Superuser has access to all fields
            return {field_id: True for field_id in field_ids}
        
        # Get user's access info once
        user_role_names, user_permission_names = await SecureFieldService._get_user_access_info(db, user)
        
        # Build access conditions
        access_conditions = SecureFieldService._build_field_access_conditions(
            user_role_names, 
            user_permission_names
        )
        
        # Query accessible fields from the provided list
        query = select(Field.id).where(
            and_(
                Field.id.in_(field_ids),
                access_conditions
            )
        )
        
        result = await db.execute(query)
        accessible_ids = {row[0] for row in result}
        
        # Build result dictionary
        return {
            field_id: field_id in accessible_ids 
            for field_id in field_ids
        }