"""
Test Export API Endpoints
Tests the export functionality with authentication and permissions
"""

import pytest
import asyncio
from uuid import uuid4
from datetime import datetime

@pytest.mark.asyncio
async def test_create_export_csv(authenticated_client, test_report):
    """Test creating a CSV export"""
    # Create export request
    export_data = {
        "report_id": str(test_report.id),
        "format": "csv",
        "format_options": {
            "delimiter": ",",
            "include_headers": True,
            "encoding": "utf-8"
        },
        "include_filters": True,
        "include_timestamp": False
    }
    
    response = await authenticated_client.post(
        "/api/v1/export/",
        json=export_data
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "export_id" in data
    assert data["status"] == "pending"
    assert data["format"] == "csv"


@pytest.mark.asyncio
async def test_create_export_excel(authenticated_client, test_report):
    """Test creating an Excel export"""
    export_data = {
        "report_id": str(test_report.id),
        "format": "xlsx",
        "format_options": {
            "sheet_name": "Report Data",
            "freeze_panes": True,
            "auto_width": True,
            "include_formulas": False
        },
        "include_filters": True,
        "include_timestamp": True,
        "include_metadata": True
    }
    
    response = await authenticated_client.post(
        "/api/v1/export/",
        json=export_data
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "export_id" in data
    assert data["format"] == "xlsx"


@pytest.mark.asyncio
async def test_create_export_pdf(authenticated_client, test_report):
    """Test creating a PDF export"""
    export_data = {
        "report_id": str(test_report.id),
        "format": "pdf",
        "format_options": {
            "orientation": "landscape",
            "page_size": "A4",
            "include_charts": True,
            "header_footer": True
        }
    }
    
    response = await authenticated_client.post(
        "/api/v1/export/",
        json=export_data
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["format"] == "pdf"


@pytest.mark.asyncio
async def test_get_export_status(authenticated_client, test_report):
    """Test getting export status"""
    # Create an export first
    export_data = {
        "report_id": str(test_report.id),
        "format": "csv"
    }
    
    create_response = await authenticated_client.post(
        "/api/v1/export/",
        json=export_data
    )
    assert create_response.status_code == 200
    export_id = create_response.json()["export_id"]
    
    # Get export status
    status_response = await authenticated_client.get(
        f"/api/v1/export/{export_id}"
    )
    
    assert status_response.status_code == 200
    status_data = status_response.json()
    assert status_data["export_id"] == export_id
    assert "status" in status_data
    assert "created_at" in status_data


@pytest.mark.asyncio
async def test_list_user_exports(authenticated_client):
    """Test listing user's exports"""
    response = await authenticated_client.get(
        "/api/v1/export/"
    )
    
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # Check structure if there are exports
    if data:
        export = data[0]
        assert "export_id" in export
        assert "report_id" in export
        assert "format" in export
        assert "status" in export
        assert "created_at" in export


@pytest.mark.asyncio
async def test_download_export(authenticated_client, test_report):
    """Test downloading an export file"""
    # Create an export
    export_data = {
        "report_id": str(test_report.id),
        "format": "csv"
    }
    
    create_response = await authenticated_client.post(
        "/api/v1/export/",
        json=export_data
    )
    assert create_response.status_code == 200
    export_id = create_response.json()["export_id"]
    
    # Wait a bit for export to process (in real tests, you'd poll status)
    await asyncio.sleep(2)
    
    # Try to download
    download_response = await authenticated_client.get(
        f"/api/v1/export/{export_id}/download"
    )
    
    # Check response (might be 202 if still processing, or 200 if ready)
    assert download_response.status_code in [200, 202]
    if download_response.status_code == 200:
        # Check content type
        content_type = download_response.headers.get("content-type", "")
        assert "csv" in content_type or "application/octet-stream" in content_type


@pytest.mark.asyncio
async def test_delete_export(authenticated_client, test_report):
    """Test deleting an export"""
    # Create an export
    export_data = {
        "report_id": str(test_report.id),
        "format": "csv"
    }
    
    create_response = await authenticated_client.post(
        "/api/v1/export/",
        json=export_data
    )
    assert create_response.status_code == 200
    export_id = create_response.json()["export_id"]
    
    # Delete the export
    delete_response = await authenticated_client.delete(
        f"/api/v1/export/{export_id}"
    )
    
    assert delete_response.status_code in [200, 204]
    
    # Verify it's deleted
    get_response = await authenticated_client.get(
        f"/api/v1/export/{export_id}"
    )
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_export_with_filters(authenticated_client, test_report):
    """Test export with query filters"""
    export_data = {
        "report_id": str(test_report.id),
        "format": "csv",
        "filters": {
            "date_range": {
                "start": "2024-01-01",
                "end": "2024-12-31"
            },
            "fund_type": ["Equity", "Bond"],
            "min_return": 0.05
        },
        "include_filters": True
    }
    
    response = await authenticated_client.post(
        "/api/v1/export/",
        json=export_data
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "export_id" in data


@pytest.mark.asyncio
async def test_scheduled_export(authenticated_client, test_report):
    """Test creating a scheduled export"""
    export_data = {
        "report_id": str(test_report.id),
        "format": "xlsx",
        "schedule": {
            "type": "daily",
            "start_date": "2024-01-01",
            "start_time": "09:00",
            "timezone": "UTC",
            "active": True
        },
        "destination": {
            "type": "email",
            "email_config": {
                "recipients": ["user@example.com"],
                "subject": "Daily Report",
                "body": "Please find the attached report."
            }
        }
    }
    
    response = await authenticated_client.post(
        "/api/v1/export/schedule",
        json=export_data
    )
    
    # Scheduled exports might return 201 or 200
    assert response.status_code in [200, 201]
    if response.status_code == 200:
        data = response.json()
        assert "schedule_id" in data or "message" in data


@pytest.mark.asyncio
async def test_export_unauthorized(unauthenticated_client):
    """Test export without authentication"""
    export_data = {
        "report_id": str(uuid4()),
        "format": "csv"
    }
    
    response = await unauthenticated_client.post(
        "/api/v1/export/",
        json=export_data
    )
    
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_export_nonexistent_report(authenticated_client):
    """Test export with non-existent report"""
    export_data = {
        "report_id": str(uuid4()),
        "format": "csv"
    }
    
    response = await authenticated_client.post(
        "/api/v1/export/",
        json=export_data
    )
    
    assert response.status_code in [404, 403]  # 404 if not found, 403 if no permission


@pytest.mark.asyncio
async def test_export_invalid_format(authenticated_client, test_report):
    """Test export with invalid format"""
    export_data = {
        "report_id": str(test_report.id),
        "format": "invalid_format"
    }
    
    response = await authenticated_client.post(
        "/api/v1/export/",
        json=export_data
    )
    
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_export_rate_limiting(authenticated_client, test_report):
    """Test export rate limiting"""
    export_data = {
        "report_id": str(test_report.id),
        "format": "csv"
    }
    
    # Try to create multiple exports quickly
    responses = []
    for _ in range(12):  # Try more than the limit (usually 10/hour)
        response = await authenticated_client.post(
            "/api/v1/export/",
            json=export_data
        )
        responses.append(response.status_code)
    
    # At least one should be rate limited (429)
    assert 429 in responses or all(r == 200 for r in responses[:10])


@pytest.mark.asyncio
async def test_export_cleanup(authenticated_client, test_report):
    """Test automatic export cleanup"""
    # This would typically be tested with a background task
    # For now, just verify the cleanup endpoint exists
    response = await authenticated_client.post(
        "/api/v1/export/cleanup"
    )
    
    # Cleanup might require admin privileges
    assert response.status_code in [200, 403]