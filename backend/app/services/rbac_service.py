"""
Centralized RBAC Service
Provides consistent role and permission resolution across the application
"""

from typing import Set, Dict, Any, Optional, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import logging

from app.models.user import User, Role, Group

logger = logging.getLogger(__name__)


class RBACService:
    """Centralized RBAC service for consistent permission resolution"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self._cache: Dict[UUID, User] = {}
    
    async def get_user_with_rbac(self, user_id: UUID) -> Optional[User]:
        """
        Load user with all RBAC relationships in a single optimized query.
        Uses in-memory cache to avoid repeated queries within the same request.
        """
        # Check cache first
        if user_id in self._cache:
            return self._cache[user_id]
        
        # Single optimized query with eager loading
        query = (
            select(User)
            .options(
                selectinload(User.roles).selectinload(Role.permissions),
                selectinload(User.groups).selectinload(Group.roles).selectinload(Role.permissions)
            )
            .where(User.id == user_id)
        )
        
        result = await self.db.execute(query)
        user = result.scalar_one_or_none()
        
        # Cache the result (even if None to avoid repeated misses)
        if user:
            self._cache[user_id] = user
            logger.debug(f"Loaded RBAC data for user {user.email} (cached)")
        
        return user
    
    @staticmethod
    def extract_rbac_info(user: User) -> Tuple[Set[str], Set[str], Set[str]]:
        """
        Extract roles, groups, and permissions from a loaded user.
        Handles both direct role assignments and group-based roles.
        """
        roles = set()
        groups = set()
        permissions = set()
        
        # Process direct role assignments (if any)
        if user.roles:
            for role in user.roles:
                roles.add(role.name)
                if role.permissions:
                    for perm in role.permissions:
                        permissions.add(f"{perm.resource}.{perm.action}")
        
        # Process group-based role assignments (primary method in this system)
        if user.groups:
            for group in user.groups:
                groups.add(group.name)
                if group.roles:
                    for role in group.roles:
                        roles.add(role.name)
                        if role.permissions:
                            for perm in role.permissions:
                                permissions.add(f"{perm.resource}.{perm.action}")
        
        logger.debug(
            f"Extracted RBAC for {user.email}: "
            f"{len(roles)} roles, {len(groups)} groups, {len(permissions)} permissions"
        )
        
        return roles, groups, permissions
    
    async def get_user_access_info(
        self, 
        user_id: UUID
    ) -> Tuple[Set[str], Set[str]]:
        """
        Get roles and permissions for field access checks.
        Returns (role_names, permission_names) as sets for fast lookup.
        Used by field_service_secure for RBAC filtering.
        """
        user = await self.get_user_with_rbac(user_id)
        if not user:
            logger.warning(f"User {user_id} not found for access info")
            return set(), set()
        
        roles, _, permissions = self.extract_rbac_info(user)
        return roles, permissions
    
    async def get_user_full_info(
        self, 
        user_id: UUID
    ) -> Dict[str, Any]:
        """
        Get complete user info for API responses.
        Used by /auth/me endpoint and similar user info endpoints.
        """
        user = await self.get_user_with_rbac(user_id)
        if not user:
            logger.warning(f"User {user_id} not found for full info")
            return {}
        
        roles, groups, permissions = self.extract_rbac_info(user)
        
        return {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
            "full_name": user.full_name,
            "is_active": user.is_active,
            "is_superuser": user.is_superuser,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
            "last_login": user.last_login,
            "roles": sorted(list(roles)),  # Sort for consistent output
            "groups": sorted(list(groups)),
            "permissions": sorted(list(permissions))
        }
    
    async def user_has_permission(
        self, 
        user_id: UUID, 
        resource: str, 
        action: str
    ) -> bool:
        """
        Check if a user has a specific permission.
        Convenience method for simple permission checks.
        """
        user = await self.get_user_with_rbac(user_id)
        if not user:
            return False
        
        # Superusers have all permissions
        if user.is_superuser:
            return True
        
        _, _, permissions = self.extract_rbac_info(user)
        required_permission = f"{resource}.{action}"
        
        return required_permission in permissions
    
    async def user_has_role(
        self, 
        user_id: UUID, 
        role_name: str
    ) -> bool:
        """
        Check if a user has a specific role.
        Convenience method for simple role checks.
        """
        user = await self.get_user_with_rbac(user_id)
        if not user:
            return False
        
        # Superusers effectively have all roles
        if user.is_superuser:
            return True
        
        roles, _, _ = self.extract_rbac_info(user)
        return role_name in roles
    
    async def user_has_all_permissions(
        self, 
        user_id: UUID, 
        required_permissions: Set[str]
    ) -> bool:
        """
        Check if a user has ALL of the required permissions.
        Used for field access control with multiple permission requirements.
        """
        if not required_permissions:
            return True
        
        user = await self.get_user_with_rbac(user_id)
        if not user:
            return False
        
        # Superusers have all permissions
        if user.is_superuser:
            return True
        
        _, _, user_permissions = self.extract_rbac_info(user)
        
        # User must have ALL required permissions (superset check)
        return required_permissions.issubset(user_permissions)
    
    def clear_cache(self):
        """Clear the in-memory cache. Useful for testing or manual cache invalidation."""
        self._cache.clear()
        logger.debug("RBAC cache cleared")