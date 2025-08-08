"""
Audit Service for logging user actions
Supports both database and external logging (ElasticSearch)
"""

from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
import json
import logging
from app.models import AuditLog, User
from app.core.config import settings

logger = logging.getLogger(__name__)


class AuditService:
    """
    Service for audit logging
    Can log to database and/or external services like ElasticSearch
    """
    
    def __init__(
        self,
        db: AsyncSession,
        elasticsearch_client=None  # Optional ES client
    ):
        """
        Initialize audit service
        
        Args:
            db: Database session for DB logging
            elasticsearch_client: Optional ElasticSearch client
        """
        self.db = db
        self.es_client = elasticsearch_client
        self.enable_db_logging = True  # Can be configured
        self.enable_es_logging = elasticsearch_client is not None
    
    async def log_action(
        self,
        user: User,
        action: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[UUID] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Optional[AuditLog]:
        """
        Log a user action
        
        Args:
            user: User performing the action
            action: Action performed (e.g., 'create_report', 'login')
            resource_type: Type of resource affected
            resource_id: ID of resource affected
            details: Additional details about the action
            ip_address: Client IP address
            user_agent: Client user agent
            
        Returns:
            Created audit log entry (if DB logging enabled)
        """
        audit_entry = None
        
        # Prepare log data
        log_data = {
            "user_id": str(user.id),
            "username": user.username,
            "action": action,
            "resource_type": resource_type,
            "resource_id": str(resource_id) if resource_id else None,
            "details": details or {},
            "ip_address": ip_address,
            "user_agent": user_agent,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Log to database
        if self.enable_db_logging:
            try:
                audit_entry = AuditLog(
                    user_id=user.id,
                    action=action,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    details=json.dumps(details) if details else None,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    timestamp=datetime.utcnow()
                )
                self.db.add(audit_entry)
                # Note: Don't commit here, let the calling service handle transaction
                await self.db.flush()
                
            except Exception as e:
                logger.error(f"Failed to log audit to database: {e}")
        
        # Log to ElasticSearch
        if self.enable_es_logging and self.es_client:
            try:
                await self._log_to_elasticsearch(log_data)
            except Exception as e:
                logger.error(f"Failed to log audit to ElasticSearch: {e}")
        
        # Also log to application logger for debugging
        logger.info(f"Audit: User {user.username} performed {action} on {resource_type}:{resource_id}")
        
        return audit_entry
    
    async def _log_to_elasticsearch(self, log_data: Dict[str, Any]):
        """
        Log audit data to ElasticSearch
        
        Args:
            log_data: Audit log data
        """
        if not self.es_client:
            return
        
        try:
            # Index name with date for automatic rotation
            index_name = f"boe-audit-{datetime.utcnow().strftime('%Y.%m')}"
            
            # Add metadata
            log_data["@timestamp"] = datetime.utcnow().isoformat()
            log_data["environment"] = settings.ENVIRONMENT  # dev/staging/prod
            log_data["application"] = "boe-backend"
            
            # Index document
            await self.es_client.index(
                index=index_name,
                body=log_data
            )
            
        except Exception as e:
            logger.error(f"ElasticSearch indexing failed: {e}")
    
    async def query_audit_logs(
        self,
        user_id: Optional[UUID] = None,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[UUID] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100
    ) -> list:
        """
        Query audit logs with filters
        
        Args:
            user_id: Filter by user
            action: Filter by action
            resource_type: Filter by resource type
            resource_id: Filter by resource ID
            start_date: Start date filter
            end_date: End date filter
            limit: Maximum results
            
        Returns:
            List of audit log entries
        """
        from sqlalchemy import select, and_
        
        query = select(AuditLog)
        filters = []
        
        if user_id:
            filters.append(AuditLog.user_id == user_id)
        
        if action:
            filters.append(AuditLog.action == action)
        
        if resource_type:
            filters.append(AuditLog.resource_type == resource_type)
        
        if resource_id:
            filters.append(AuditLog.resource_id == resource_id)
        
        if start_date:
            filters.append(AuditLog.timestamp >= start_date)
        
        if end_date:
            filters.append(AuditLog.timestamp <= end_date)
        
        if filters:
            query = query.where(and_(*filters))
        
        query = query.order_by(AuditLog.timestamp.desc()).limit(limit)
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def get_user_activity_summary(
        self,
        user_id: UUID,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Get summary of user activity
        
        Args:
            user_id: User ID
            days: Number of days to look back
            
        Returns:
            Activity summary
        """
        from sqlalchemy import select, func
        from datetime import timedelta
        
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Count actions by type
        query = (
            select(
                AuditLog.action,
                func.count(AuditLog.id).label("count")
            )
            .where(and_(
                AuditLog.user_id == user_id,
                AuditLog.timestamp >= start_date
            ))
            .group_by(AuditLog.action)
        )
        
        result = await self.db.execute(query)
        action_counts = {row.action: row.count for row in result}
        
        # Get total actions
        total_query = (
            select(func.count(AuditLog.id))
            .where(and_(
                AuditLog.user_id == user_id,
                AuditLog.timestamp >= start_date
            ))
        )
        
        total_actions = await self.db.scalar(total_query)
        
        return {
            "user_id": str(user_id),
            "period_days": days,
            "total_actions": total_actions or 0,
            "actions_by_type": action_counts,
            "start_date": start_date.isoformat(),
            "end_date": datetime.utcnow().isoformat()
        }
    
    async def cleanup_old_logs(
        self,
        retention_days: int = 90
    ) -> int:
        """
        Clean up old audit logs
        
        Args:
            retention_days: Number of days to retain logs
            
        Returns:
            Number of deleted entries
        """
        from sqlalchemy import delete
        
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
        
        stmt = delete(AuditLog).where(AuditLog.timestamp < cutoff_date)
        result = await self.db.execute(stmt)
        await self.db.commit()
        
        deleted_count = result.rowcount
        logger.info(f"Cleaned up {deleted_count} audit logs older than {retention_days} days")
        
        return deleted_count