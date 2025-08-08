"""
Tests for report CRUD operations.
"""
import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.models.report import Report
from app.models.user import User


@pytest.mark.report
class TestReportCRUD:
    """Test report CRUD operations."""
    
    @pytest.mark.asyncio
    async def test_create_report(self, client: AsyncClient, creator_auth_headers: dict, test_field):
        """Test creating a new report."""
        report_data = {
            "name": "New Test Report",
            "description": "A new test report",
            "definition": {
                "fields": [test_field.name],
                "filters": [],
                "aggregations": [],
                "groupBy": []
            },
            "is_published": False
        }
        
        response = await client.post(
            "/api/v1/reports",
            json=report_data,
            headers=creator_auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "New Test Report"
        assert data["description"] == "A new test report"
        assert data["definition"]["fields"] == [test_field.name]
        assert "id" in data
        assert "created_at" in data
    
    @pytest.mark.asyncio
    async def test_get_report(self, client: AsyncClient, auth_headers: dict, test_report: Report):
        """Test getting a report by ID."""
        response = await client.get(
            f"/api/v1/reports/{test_report.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_report.id
        assert data["name"] == test_report.name
        assert data["description"] == test_report.description
    
    @pytest.mark.asyncio
    async def test_get_nonexistent_report(self, client: AsyncClient, auth_headers: dict):
        """Test getting a non-existent report."""
        fake_id = str(uuid.uuid4())
        response = await client.get(
            f"/api/v1/reports/{fake_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 404
        assert response.json()["detail"] == "Report not found"
    
    @pytest.mark.asyncio
    async def test_list_reports(self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession, test_user: User):
        """Test listing reports."""
        # Create multiple reports
        for i in range(5):
            report = Report(
                id=str(uuid.uuid4()),
                name=f"Report {i}",
                description=f"Description {i}",
                owner_id=test_user.id,
                definition={"fields": [], "filters": []},
                created_at=datetime.utcnow()
            )
            db_session.add(report)
        await db_session.commit()
        
        response = await client.get(
            "/api/v1/reports",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 5
        # Verify reports are sorted by creation date (newest first)
        dates = [r["created_at"] for r in data]
        assert dates == sorted(dates, reverse=True)
    
    @pytest.mark.asyncio
    async def test_list_reports_pagination(self, client: AsyncClient, auth_headers: dict):
        """Test report listing with pagination."""
        response = await client.get(
            "/api/v1/reports?skip=0&limit=2",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 2
    
    @pytest.mark.asyncio
    async def test_update_report(self, client: AsyncClient, auth_headers: dict, test_report: Report):
        """Test updating a report."""
        update_data = {
            "name": "Updated Report Name",
            "description": "Updated description",
            "definition": test_report.definition
        }
        
        response = await client.put(
            f"/api/v1/reports/{test_report.id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Report Name"
        assert data["description"] == "Updated description"
        assert data["id"] == test_report.id
    
    @pytest.mark.asyncio
    async def test_update_nonexistent_report(self, client: AsyncClient, auth_headers: dict):
        """Test updating a non-existent report."""
        fake_id = str(uuid.uuid4())
        update_data = {
            "name": "Updated Name",
            "description": "Updated",
            "definition": {}
        }
        
        response = await client.put(
            f"/api/v1/reports/{fake_id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 404
        assert response.json()["detail"] == "Report not found"
    
    @pytest.mark.asyncio
    async def test_delete_report(self, client: AsyncClient, auth_headers: dict, test_report: Report):
        """Test deleting a report."""
        response = await client.delete(
            f"/api/v1/reports/{test_report.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 204
        
        # Verify report is deleted
        get_response = await client.get(
            f"/api/v1/reports/{test_report.id}",
            headers=auth_headers
        )
        assert get_response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_delete_nonexistent_report(self, client: AsyncClient, auth_headers: dict):
        """Test deleting a non-existent report."""
        fake_id = str(uuid.uuid4())
        response = await client.delete(
            f"/api/v1/reports/{fake_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 404
        assert response.json()["detail"] == "Report not found"
    
    @pytest.mark.asyncio
    async def test_clone_report(self, client: AsyncClient, creator_auth_headers: dict, test_report: Report):
        """Test cloning a report."""
        response = await client.post(
            f"/api/v1/reports/{test_report.id}/clone",
            headers=creator_auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == f"{test_report.name} (Copy)"
        assert data["description"] == test_report.description
        assert data["definition"] == test_report.definition
        assert data["id"] != test_report.id  # Should be a new ID
    
    @pytest.mark.asyncio
    async def test_execute_report(self, client: AsyncClient, auth_headers: dict, test_report: Report):
        """Test executing a report."""
        response = await client.post(
            f"/api/v1/reports/{test_report.id}/execute",
            json={"parameters": {}},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "execution_id" in data
        assert "status" in data
        assert data["status"] in ["pending", "running", "completed", "failed"]
    
    @pytest.mark.asyncio
    async def test_report_versions(self, client: AsyncClient, auth_headers: dict, test_report: Report):
        """Test getting report version history."""
        # First update the report to create a version
        update_data = {
            "name": test_report.name,
            "description": "Version 2",
            "definition": test_report.definition
        }
        
        await client.put(
            f"/api/v1/reports/{test_report.id}",
            json=update_data,
            headers=auth_headers
        )
        
        # Get versions
        response = await client.get(
            f"/api/v1/reports/{test_report.id}/versions",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
    
    @pytest.mark.asyncio
    async def test_publish_report(self, client: AsyncClient, admin_auth_headers: dict, test_report: Report):
        """Test publishing a report (admin only)."""
        response = await client.post(
            f"/api/v1/reports/{test_report.id}/publish",
            headers=admin_auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_published"] is True
    
    @pytest.mark.asyncio
    async def test_unpublish_report(self, client: AsyncClient, admin_auth_headers: dict, test_report: Report):
        """Test unpublishing a report (admin only)."""
        # First publish it
        test_report.is_published = True
        
        response = await client.post(
            f"/api/v1/reports/{test_report.id}/unpublish",
            headers=admin_auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_published"] is False
    
    @pytest.mark.asyncio
    async def test_export_report_json(self, client: AsyncClient, auth_headers: dict, test_report: Report):
        """Test exporting report as JSON."""
        response = await client.get(
            f"/api/v1/reports/{test_report.id}/export?format=json",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"
        data = response.json()
        assert "metadata" in data
        assert "data" in data
    
    @pytest.mark.asyncio
    async def test_export_report_csv(self, client: AsyncClient, auth_headers: dict, test_report: Report):
        """Test exporting report as CSV."""
        response = await client.get(
            f"/api/v1/reports/{test_report.id}/export?format=csv",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]
        assert "attachment" in response.headers.get("content-disposition", "")
    
    @pytest.mark.asyncio
    async def test_search_reports(self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession, test_user: User):
        """Test searching reports by name."""
        # Create reports with specific names
        report1 = Report(
            id=str(uuid.uuid4()),
            name="Financial Report Q1",
            description="Q1 finances",
            owner_id=test_user.id,
            definition={},
            created_at=datetime.utcnow()
        )
        report2 = Report(
            id=str(uuid.uuid4()),
            name="Sales Dashboard",
            description="Sales metrics",
            owner_id=test_user.id,
            definition={},
            created_at=datetime.utcnow()
        )
        db_session.add_all([report1, report2])
        await db_session.commit()
        
        # Search for "Financial"
        response = await client.get(
            "/api/v1/reports?search=Financial",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert all("financial" in r["name"].lower() for r in data)
    
    @pytest.mark.asyncio
    async def test_filter_reports_by_owner(self, client: AsyncClient, auth_headers: dict, test_report: Report):
        """Test filtering reports by owner."""
        response = await client.get(
            f"/api/v1/reports?owner_id={test_report.owner_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert all(r["owner_id"] == test_report.owner_id for r in data)
    
    @pytest.mark.asyncio
    async def test_filter_published_reports(self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession, test_user: User):
        """Test filtering published reports only."""
        # Create published and unpublished reports
        published = Report(
            id=str(uuid.uuid4()),
            name="Published Report",
            owner_id=test_user.id,
            is_published=True,
            definition={},
            created_at=datetime.utcnow()
        )
        unpublished = Report(
            id=str(uuid.uuid4()),
            name="Unpublished Report",
            owner_id=test_user.id,
            is_published=False,
            definition={},
            created_at=datetime.utcnow()
        )
        db_session.add_all([published, unpublished])
        await db_session.commit()
        
        response = await client.get(
            "/api/v1/reports?is_published=true",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert all(r["is_published"] is True for r in data)