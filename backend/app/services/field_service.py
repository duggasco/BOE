"""
Field service with RBAC support
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload
import logging

from app.models.field import Field, DataTable, DataSource, FieldRelationship
from app.models.user import User, Role, Permission, role_permissions
from app.services.security_service import SecurityService

logger = logging.getLogger(__name__)


class FieldService:
    """Service for managing fields with role-based access control"""
    
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
        Get fields accessible to the user based on their role and permissions
        """
        # Build base query
        query = select(Field).options(
            selectinload(Field.table)
        )
        
        # Apply table filter if provided
        if table_id:
            query = query.where(Field.table_id == table_id)
        
        # Apply search filter if provided
        if search:
            query = query.where(
                or_(
                    Field.display_name.ilike(f"%{search}%"),
                    Field.description.ilike(f"%{search}%")
                )
            )
        
        # Apply field-level RBAC
        if not user.is_superuser:
            # Get user's roles and permissions
            user_roles = await FieldService._get_user_roles(db, user)
            user_permissions = await FieldService._get_user_permissions(db, user)
            
            # Filter fields based on security settings
            rbac_conditions = []
            
            # Include unrestricted fields (handle NULL as unrestricted)
            rbac_conditions.append(
                or_(
                    Field.is_restricted.is_(False),
                    Field.is_restricted.is_(None)
                )
            )
            
            # Include fields where user has required role
            if user_roles:
                for role in user_roles:
                    rbac_conditions.append(Field.required_role == role.name)
            
            # Apply RBAC filter
            query = query.where(or_(*rbac_conditions))
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        
        # Execute query
        result = await db.execute(query)
        fields = result.scalars().all()
        
        # Additional permission filtering for complex permissions
        if not user.is_superuser:
            fields = await FieldService._filter_by_permissions(
                fields, user_permissions
            )
        
        logger.info(f"User {user.email} retrieved {len(fields)} accessible fields")
        return fields
    
    @staticmethod
    async def can_access_field(
        db: AsyncSession,
        user: User,
        field: Field
    ) -> bool:
        """
        Check if user can access a specific field
        """
        # Superusers can access all fields
        if user.is_superuser:
            return True
        
        # Check if field is unrestricted (NULL or False means unrestricted)
        if field.is_restricted is None or field.is_restricted is False:
            return True
        
        # Check if user has required role
        if field.required_role:
            user_roles = await FieldService._get_user_roles(db, user)
            role_names = [role.name for role in user_roles]
            if field.required_role not in role_names:
                logger.warning(
                    f"User {user.email} denied access to field {field.id} "
                    f"(requires role: {field.required_role})"
                )
                return False
        
        # Check if user has required permissions
        if field.required_permissions:
            user_permissions = await FieldService._get_user_permissions(db, user)
            permission_names = [p.name for p in user_permissions]
            
            for required_permission in field.required_permissions:
                if required_permission not in permission_names:
                    logger.warning(
                        f"User {user.email} denied access to field {field.id} "
                        f"(missing permission: {required_permission})"
                    )
                    return False
        
        return True
    
    @staticmethod
    async def get_field_by_id(
        db: AsyncSession,
        user: User,
        field_id: UUID
    ) -> Optional[Field]:
        """
        Get a specific field if user has access
        """
        # Get the field
        field = await db.get(Field, field_id)
        
        if not field:
            return None
        
        # Check access
        if not await FieldService.can_access_field(db, user, field):
            logger.warning(
                f"User {user.email} attempted to access restricted field {field_id}"
            )
            return None
        
        return field
    
    @staticmethod
    async def get_table_fields(
        db: AsyncSession,
        user: User,
        table_id: UUID
    ) -> List[Field]:
        """
        Get all accessible fields for a specific table
        """
        return await FieldService.get_accessible_fields(
            db=db,
            user=user,
            table_id=table_id,
            limit=1000  # Get all fields for the table
        )
    
    @staticmethod
    async def get_field_relationships(
        db: AsyncSession,
        user: User
    ) -> List[FieldRelationship]:
        """
        Get field relationships, filtering out fields the user cannot access
        """
        # Get all relationships
        query = select(FieldRelationship).options(
            selectinload(FieldRelationship.source_field),
            selectinload(FieldRelationship.target_field)
        )
        
        result = await db.execute(query)
        relationships = result.scalars().all()
        
        # Filter relationships based on field access
        accessible_relationships = []
        for rel in relationships:
            # Check if user can access both source and target fields
            can_access_source = await FieldService.can_access_field(
                db, user, rel.source_field
            )
            can_access_target = await FieldService.can_access_field(
                db, user, rel.target_field
            )
            
            if can_access_source and can_access_target:
                accessible_relationships.append(rel)
        
        logger.info(
            f"User {user.email} retrieved {len(accessible_relationships)} "
            f"accessible field relationships"
        )
        return accessible_relationships
    
    @staticmethod
    async def update_field_security(
        db: AsyncSession,
        user: User,
        field_id: UUID,
        required_role: Optional[str] = None,
        required_permissions: Optional[List[str]] = None,
        is_restricted: bool = False
    ) -> Optional[Field]:
        """
        Update field security settings (admin only)
        """
        # Only superusers can update field security
        if not user.is_superuser:
            logger.warning(
                f"Non-admin user {user.email} attempted to update field security"
            )
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
            f"Admin {user.email} updated security settings for field {field_id}"
        )
        return field
    
    @staticmethod
    async def _get_user_roles(db: AsyncSession, user: User) -> List[Role]:
        """
        Get all roles for a user
        """
        # Get user with roles loaded
        query = select(User).options(
            selectinload(User.roles)
        ).where(User.id == user.id)
        
        result = await db.execute(query)
        user_with_roles = result.scalar_one_or_none()
        
        if user_with_roles:
            return user_with_roles.roles
        return []
    
    @staticmethod
    async def _get_user_permissions(db: AsyncSession, user: User) -> List[Permission]:
        """
        Get all permissions for a user (through roles)
        """
        # Get user's roles
        user_roles = await FieldService._get_user_roles(db, user)
        
        if not user_roles:
            return []
        
        # Get permissions for all roles
        role_ids = [role.id for role in user_roles]
        
        query = (
            select(Permission)
            .join(role_permissions)
            .where(role_permissions.c.role_id.in_(role_ids))
        )
        
        result = await db.execute(query)
        permissions = result.scalars().all()
        
        return permissions
    
    @staticmethod
    async def _filter_by_permissions(
        fields: List[Field],
        user_permissions: List[Permission]
    ) -> List[Field]:
        """
        Filter fields based on complex permission requirements
        """
        permission_names = [p.name for p in user_permissions]
        filtered_fields = []
        
        for field in fields:
            # If field has no permission requirements, include it
            if not field.required_permissions:
                filtered_fields.append(field)
                continue
            
            # Check if user has all required permissions
            has_all_permissions = all(
                perm in permission_names 
                for perm in field.required_permissions
            )
            
            if has_all_permissions:
                filtered_fields.append(field)
        
        return filtered_fields
    
    @staticmethod
    async def get_field_statistics(
        db: AsyncSession,
        user: User
    ) -> Dict[str, Any]:
        """
        Get statistics about fields and access
        """
        # Get total field count
        total_query = select(Field)
        total_result = await db.execute(total_query)
        total_fields = len(total_result.scalars().all())
        
        # Get accessible fields for user
        accessible_fields = await FieldService.get_accessible_fields(
            db=db,
            user=user,
            limit=10000  # Get all accessible fields
        )
        accessible_count = len(accessible_fields)
        
        # Get restricted field count
        restricted_query = select(Field).where(Field.is_restricted == True)
        restricted_result = await db.execute(restricted_query)
        restricted_count = len(restricted_result.scalars().all())
        
        return {
            "total_fields": total_fields,
            "accessible_fields": accessible_count,
            "restricted_fields": restricted_count,
            "access_percentage": (
                (accessible_count / total_fields * 100) if total_fields > 0 else 0
            )
        }