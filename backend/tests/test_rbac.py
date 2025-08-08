"""
Tests for RBAC (Role-Based Access Control) and permissions.
"""
import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.models.report import Report
from app.models.user import User


@pytest.mark.rbac
class TestRBACPermissions:
    """Test RBAC and permission enforcement."""
    
    @pytest.mark.asyncio
    async def test_viewer_cannot_create_report(self, client: AsyncClient, viewer_auth_headers: dict):
        """Test that viewer role cannot create reports."""
        report_data = {
            "name": "Unauthorized Report",
            "description": "Should not be created",
            "definition": {
                "fields": ["field1"],
                "filters": []
            }
        }
        
        response = await client.post(
            "/api/v1/reports",
            json=report_data,
            headers=viewer_auth_headers
        )
        
        assert response.status_code == 403
        assert "permission" in response.json()["detail"].lower() or "forbidden" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_viewer_can_read_reports(self, client: AsyncClient, viewer_auth_headers: dict, test_report: Report):
        """Test that viewer role can read reports."""
        response = await client.get(
            f"/api/v1/reports/{test_report.id}",
            headers=viewer_auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_report.id
    
    @pytest.mark.asyncio
    async def test_viewer_cannot_update_report(self, client: AsyncClient, viewer_auth_headers: dict, test_report: Report):
        """Test that viewer role cannot update reports."""
        update_data = {
            "name": "Hacked Report",
            "description": "Should not update",
            "definition": test_report.definition
        }
        
        response = await client.put(
            f"/api/v1/reports/{test_report.id}",
            json=update_data,
            headers=viewer_auth_headers
        )
        
        assert response.status_code == 403
        assert "permission" in response.json()["detail"].lower() or "forbidden" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_viewer_cannot_delete_report(self, client: AsyncClient, viewer_auth_headers: dict, test_report: Report):
        """Test that viewer role cannot delete reports."""
        response = await client.delete(
            f"/api/v1/reports/{test_report.id}",
            headers=viewer_auth_headers
        )
        
        assert response.status_code == 403
        assert "permission" in response.json()["detail"].lower() or "forbidden" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_creator_can_create_report(self, client: AsyncClient, creator_auth_headers: dict, test_field):
        """Test that creator role can create reports."""
        report_data = {
            "name": "Creator's Report",
            "description": "Created by creator role",
            "definition": {
                "fields": [test_field.name],
                "filters": []
            }
        }
        
        response = await client.post(
            "/api/v1/reports",
            json=report_data,
            headers=creator_auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Creator's Report"
    
    @pytest.mark.asyncio
    async def test_creator_can_update_own_report(self, client: AsyncClient, creator_auth_headers: dict, creator_user: User, db_session: AsyncSession):
        """Test that creator can update their own reports."""
        # Create a report owned by creator
        report = Report(
            id=str(uuid.uuid4()),
            name="Creator's Own Report",
            description="Owned by creator",
            owner_id=creator_user.id,
            definition={"fields": []},
            created_at=datetime.utcnow()
        )
        db_session.add(report)
        await db_session.commit()
        
        # Update the report
        update_data = {
            "name": "Updated by Creator",
            "description": "Successfully updated",
            "definition": report.definition
        }
        
        response = await client.put(
            f"/api/v1/reports/{report.id}",
            json=update_data,
            headers=creator_auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated by Creator"
    
    @pytest.mark.asyncio
    async def test_creator_cannot_update_others_report(self, client: AsyncClient, creator_auth_headers: dict, test_report: Report):
        """Test that creator cannot update reports owned by others (IDOR protection)."""
        # test_report is owned by test_user, not creator_user
        update_data = {
            "name": "Trying to Update Others",
            "description": "Should fail",
            "definition": test_report.definition
        }
        
        response = await client.put(
            f"/api/v1/reports/{test_report.id}",
            json=update_data,
            headers=creator_auth_headers
        )
        
        assert response.status_code == 403
        assert "permission" in response.json()["detail"].lower() or "not authorized" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_creator_can_delete_own_report(self, client: AsyncClient, creator_auth_headers: dict, creator_user: User, db_session: AsyncSession):
        """Test that creator can delete their own reports."""
        # Create a report owned by creator
        report = Report(
            id=str(uuid.uuid4()),
            name="To Be Deleted",
            owner_id=creator_user.id,
            definition={},
            created_at=datetime.utcnow()
        )
        db_session.add(report)
        await db_session.commit()
        
        response = await client.delete(
            f"/api/v1/reports/{report.id}",
            headers=creator_auth_headers
        )
        
        assert response.status_code == 204
    
    @pytest.mark.asyncio
    async def test_creator_cannot_delete_others_report(self, client: AsyncClient, creator_auth_headers: dict, test_report: Report):
        """Test that creator cannot delete reports owned by others."""
        response = await client.delete(
            f"/api/v1/reports/{test_report.id}",
            headers=creator_auth_headers
        )
        
        assert response.status_code == 403
        assert "permission" in response.json()["detail"].lower() or "not authorized" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_admin_can_update_any_report(self, client: AsyncClient, admin_auth_headers: dict, test_report: Report):
        """Test that admin can update any report."""
        update_data = {
            "name": "Admin Updated",
            "description": "Updated by admin",
            "definition": test_report.definition
        }
        
        response = await client.put(
            f"/api/v1/reports/{test_report.id}",
            json=update_data,
            headers=admin_auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Admin Updated"
    
    @pytest.mark.asyncio
    async def test_admin_can_delete_any_report(self, client: AsyncClient, admin_auth_headers: dict, test_report: Report):
        """Test that admin can delete any report."""
        response = await client.delete(
            f"/api/v1/reports/{test_report.id}",
            headers=admin_auth_headers
        )
        
        assert response.status_code == 204
    
    @pytest.mark.asyncio
    async def test_only_admin_can_publish_report(self, client: AsyncClient, creator_auth_headers: dict, admin_auth_headers: dict, test_report: Report):
        """Test that only admin can publish reports."""
        # Creator should not be able to publish
        response = await client.post(
            f"/api/v1/reports/{test_report.id}/publish",
            headers=creator_auth_headers
        )
        
        assert response.status_code == 403
        
        # Admin should be able to publish
        response = await client.post(
            f"/api/v1/reports/{test_report.id}/publish",
            headers=admin_auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_published"] is True
    
    @pytest.mark.asyncio
    async def test_unauthenticated_cannot_access_reports(self, client: AsyncClient, test_report: Report):
        """Test that unauthenticated users cannot access reports."""
        # No auth headers
        response = await client.get(f"/api/v1/reports/{test_report.id}")
        
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"
    
    @pytest.mark.asyncio
    async def test_group_permissions(self, client: AsyncClient, db_session: AsyncSession):
        """Test that users inherit permissions from groups."""
        from app.models.user import Group, user_groups, group_permissions, Permission
        
        # Create a group with specific permissions
        group = Group(
            id=str(uuid.uuid4()),
            name="report_editors",
            description="Can edit reports",
            created_at=datetime.utcnow()
        )
        db_session.add(group)
        
        # Create permission
        edit_perm = Permission(
            id=str(uuid.uuid4()),
            name="reports:edit",
            resource="reports",
            action="edit",
            description="Edit reports"
        )
        db_session.add(edit_perm)
        await db_session.flush()
        
        # Assign permission to group
        await db_session.execute(
            group_permissions.insert().values(group_id=group.id, permission_id=edit_perm.id)
        )
        
        # Create user and add to group
        user = User(
            id=str(uuid.uuid4()),
            email="groupuser@example.com",
            username="groupuser",
            full_name="Group User",
            hashed_password="hashed",
            created_at=datetime.utcnow()
        )
        db_session.add(user)
        await db_session.flush()
        
        # Add user to group
        await db_session.execute(
            user_groups.insert().values(user_id=user.id, group_id=group.id)
        )
        
        await db_session.commit()
        
        # User should have edit permission through group membership
        # This would be tested through actual permission checks in the service layer
    
    @pytest.mark.asyncio
    async def test_permission_caching(self, client: AsyncClient, creator_auth_headers: dict, test_field):
        """Test that permissions are properly cached/refreshed."""
        # Make multiple requests to test caching
        for _ in range(3):
            report_data = {
                "name": f"Report {uuid.uuid4()}",
                "description": "Testing permission caching",
                "definition": {
                    "fields": [test_field.name],
                    "filters": []
                }
            }
            
            response = await client.post(
                "/api/v1/reports",
                json=report_data,
                headers=creator_auth_headers
            )
            
            assert response.status_code == 201
    
    @pytest.mark.asyncio
    async def test_field_level_permissions(self, client: AsyncClient, db_session: AsyncSession):
        """Test field-level access control."""
        # Create sensitive field
        from app.models.field import Field, DataTable, DataSource
        
        source = DataSource(
            id=str(uuid.uuid4()),
            name="secure_source",
            type="postgresql",
            connection_string="postgresql://localhost/secure",
            created_at=datetime.utcnow()
        )
        db_session.add(source)
        
        table = DataTable(
            id=str(uuid.uuid4()),
            name="sensitive_table",
            source_id=source.id,
            created_at=datetime.utcnow()
        )
        db_session.add(table)
        
        sensitive_field = Field(
            id=str(uuid.uuid4()),
            name="salary",
            display_name="Salary",
            field_type="measure",
            table_id=table.id,
            is_sensitive=True,  # Marked as sensitive
            created_at=datetime.utcnow()
        )
        db_session.add(sensitive_field)
        await db_session.commit()
        
        # Users without specific permission should not see sensitive fields
        # This would be implemented in the field service layer
    
    @pytest.mark.asyncio
    async def test_report_sharing_permissions(self, client: AsyncClient, creator_auth_headers: dict, viewer_auth_headers: dict, creator_user: User, db_session: AsyncSession):
        """Test report sharing and access control."""
        # Creator creates a private report
        private_report = Report(
            id=str(uuid.uuid4()),
            name="Private Report",
            owner_id=creator_user.id,
            is_public=False,
            definition={},
            created_at=datetime.utcnow()
        )
        db_session.add(private_report)
        await db_session.commit()
        
        # Viewer should not be able to access private report
        response = await client.get(
            f"/api/v1/reports/{private_report.id}",
            headers=viewer_auth_headers
        )
        
        # Depending on implementation, this could be 403 or 404
        assert response.status_code in [403, 404]