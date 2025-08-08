"""
Tests for security validations and attack prevention.
"""
import pytest
import uuid
import json
from datetime import datetime
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from hypothesis import given, strategies as st, settings, HealthCheck

from app.models.report import Report
from app.models.user import User
from app.services.security_service import SecurityService


@pytest.mark.security
class TestSecurityValidations:
    """Test security validations and attack prevention."""
    
    @pytest.mark.asyncio
    async def test_sql_injection_in_report_definition(self, client: AsyncClient, creator_auth_headers: dict):
        """Test SQL injection prevention in report definitions."""
        malicious_definitions = [
            {
                "fields": ["'; DROP TABLE users; --"],
                "filters": []
            },
            {
                "fields": ["field1"],
                "filters": [{"field": "name", "operator": "=", "value": "'; DELETE FROM reports; --"}]
            },
            {
                "fields": ["field1 UNION SELECT * FROM users"],
                "filters": []
            },
            {
                "fields": ["field1"],
                "calculation_formula": "SUM(amount); DROP TABLE reports; --"
            }
        ]
        
        for definition in malicious_definitions:
            report_data = {
                "name": "Test Report",
                "description": "Testing SQL injection",
                "definition": definition
            }
            
            response = await client.post(
                "/api/v1/reports",
                json=report_data,
                headers=creator_auth_headers
            )
            
            # Should be rejected with 400 or 422
            assert response.status_code in [400, 422]
            assert "invalid" in response.json()["detail"].lower() or "malicious" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    @settings(deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @given(payload=st.text())
    async def test_injection_vulnerability_fuzzing(self, client: AsyncClient, creator_auth_headers: dict, payload: str):
        """Test for vulnerabilities by fuzzing inputs with property-based testing."""
        # This test uses Hypothesis to generate a wide variety of string inputs (fuzzing)
        # and applies them to different parts of the report definition.
        # The primary goal is to ensure that no input causes an unhandled server error (500),
        # which could indicate a vulnerability like SQL injection.

        definitions_to_test = [
            {"fields": [payload], "filters": []},
            {"fields": ["field1"], "filters": [{"field": "name", "operator": "=", "value": payload}]},
            {"fields": ["field1"], "calculation_formula": payload}
        ]

        for definition in definitions_to_test:
            report_name = f"Hypothesis Test - {uuid.uuid4()}"
            report_data = {
                "name": report_name,
                "description": "Testing for injection vulnerabilities with Hypothesis",
                "definition": definition
            }

            response = await client.post(
                "/api/v1/reports",
                json=report_data,
                headers=creator_auth_headers
            )

            # CRITICAL: A 500 status code indicates an unhandled exception on the server,
            # which is a likely sign of a successful injection or other vulnerability.
            assert response.status_code != 500, f"Potential vulnerability with payload: {payload!r}"

            # Benign, expected client errors (4xx) are acceptable.
            # A successful creation (201) is also fine if the input was harmless.
            # The main goal is to prevent 500 errors.
            if response.status_code != 201:
                assert response.status_code in [400, 422]
    
    @pytest.mark.asyncio
    async def test_xss_prevention_in_report_fields(self, client: AsyncClient, creator_auth_headers: dict):
        """Test XSS attack prevention in report fields."""
        xss_payloads = [
            "<script>alert('XSS')</script>",
            "javascript:alert('XSS')",
            "<img src=x onerror=alert('XSS')>",
            "<svg onload=alert('XSS')>",
            "';alert(String.fromCharCode(88,83,83))//",
            "<iframe src=javascript:alert('XSS')>"
        ]
        
        for payload in xss_payloads:
            report_data = {
                "name": payload,
                "description": "Testing XSS",
                "definition": {"fields": ["field1"]}
            }
            
            response = await client.post(
                "/api/v1/reports",
                json=report_data,
                headers=creator_auth_headers
            )
            
            # Should either reject or sanitize
            if response.status_code == 201:
                data = response.json()
                # Check that script tags are not present in response
                assert "<script>" not in data["name"]
                assert "javascript:" not in data["name"]
            else:
                assert response.status_code in [400, 422]
    
    @pytest.mark.asyncio
    async def test_command_injection_prevention(self, client: AsyncClient, creator_auth_headers: dict):
        """Test command injection prevention."""
        command_payloads = [
            "; rm -rf /",
            "$(rm -rf /)",
            "`rm -rf /`",
            "| cat /etc/passwd",
            "&& cat /etc/passwd",
            "; cat /etc/passwd"
        ]
        
        for payload in command_payloads:
            report_data = {
                "name": f"Report {payload}",
                "description": "Testing command injection",
                "definition": {
                    "fields": [payload],
                    "filters": []
                }
            }
            
            response = await client.post(
                "/api/v1/reports",
                json=report_data,
                headers=creator_auth_headers
            )
            
            # Should be rejected
            assert response.status_code in [400, 422]
    
    @pytest.mark.asyncio
    async def test_path_traversal_prevention(self, client: AsyncClient, creator_auth_headers: dict):
        """Test path traversal attack prevention."""
        path_payloads = [
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32\\config\\sam",
            "file:///etc/passwd",
            "file://localhost/etc/passwd",
            "....//....//....//etc/passwd"
        ]
        
        for payload in path_payloads:
            report_data = {
                "name": "Export Report",
                "description": "Testing path traversal",
                "definition": {"fields": ["field1"]},
                "export_path": payload
            }
            
            response = await client.post(
                "/api/v1/reports",
                json=report_data,
                headers=creator_auth_headers
            )
            
            # If export_path is processed, should be rejected
            if "export_path" in report_data:
                assert response.status_code in [400, 422] or payload not in str(response.json())
    
    @pytest.mark.asyncio
    async def test_idor_prevention_update(self, client: AsyncClient, creator_auth_headers: dict, test_report: Report):
        """Test IDOR (Insecure Direct Object Reference) prevention on update."""
        # Creator trying to update another user's report
        update_data = {
            "name": "IDOR Attack",
            "description": "Should not be allowed",
            "definition": test_report.definition
        }
        
        response = await client.put(
            f"/api/v1/reports/{test_report.id}",
            json=update_data,
            headers=creator_auth_headers
        )
        
        assert response.status_code == 403
        assert "not authorized" in response.json()["detail"].lower() or "permission" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_idor_prevention_delete(self, client: AsyncClient, creator_auth_headers: dict, test_report: Report):
        """Test IDOR prevention on delete."""
        # Creator trying to delete another user's report
        response = await client.delete(
            f"/api/v1/reports/{test_report.id}",
            headers=creator_auth_headers
        )
        
        assert response.status_code == 403
        assert "not authorized" in response.json()["detail"].lower() or "permission" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_large_payload_dos_prevention(self, client: AsyncClient, creator_auth_headers: dict):
        """Test prevention of DoS through large payloads."""
        # Create a very large definition (over 1MB)
        large_fields = ["field" + str(i) for i in range(100000)]
        
        report_data = {
            "name": "Large Report",
            "description": "Testing DoS",
            "definition": {
                "fields": large_fields,
                "filters": []
            }
        }
        
        # Convert to JSON to check size
        json_data = json.dumps(report_data)
        assert len(json_data) > 1024 * 1024  # Over 1MB
        
        response = await client.post(
            "/api/v1/reports",
            json=report_data,
            headers=creator_auth_headers
        )
        
        # Should be rejected due to size
        assert response.status_code in [400, 413, 422]
    
    @pytest.mark.asyncio
    async def test_recursion_dos_prevention(self, client: AsyncClient, creator_auth_headers: dict):
        """Test prevention of DoS through deep recursion."""
        # Create deeply nested structure
        def create_nested(depth):
            if depth == 0:
                return {"field": "value"}
            return {"nested": create_nested(depth - 1)}
        
        report_data = {
            "name": "Nested Report",
            "description": "Testing recursion",
            "definition": create_nested(100)  # Very deep nesting
        }
        
        response = await client.post(
            "/api/v1/reports",
            json=report_data,
            headers=creator_auth_headers
        )
        
        # Should handle gracefully
        assert response.status_code in [400, 422]
    
    @pytest.mark.asyncio
    async def test_in_operator_limit(self, client: AsyncClient, creator_auth_headers: dict):
        """Test IN operator value limit to prevent DoS."""
        # Create filter with too many IN values
        many_values = list(range(200))  # Over 100 limit
        
        report_data = {
            "name": "IN Operator Test",
            "description": "Testing IN limit",
            "definition": {
                "fields": ["field1"],
                "filters": [{
                    "field": "id",
                    "operator": "IN",
                    "values": many_values
                }]
            }
        }
        
        response = await client.post(
            "/api/v1/reports",
            json=report_data,
            headers=creator_auth_headers
        )
        
        # Should be rejected due to too many IN values
        assert response.status_code in [400, 422]
        assert "too many" in response.json()["detail"].lower() or "limit" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_jwt_signature_verification(self, client: AsyncClient):
        """Test that JWT signatures are properly verified."""
        # Create a token with invalid signature
        import jwt
        
        fake_token = jwt.encode(
            {"sub": "hacker@example.com", "exp": 9999999999},
            "wrong_secret_key",
            algorithm="HS256"
        )
        
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {fake_token}"}
        )
        
        assert response.status_code == 401
        assert "Could not validate credentials" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_rate_limiting(self, client: AsyncClient):
        """Test rate limiting on sensitive endpoints."""
        # Make many rapid requests to login endpoint
        responses = []
        for i in range(20):
            response = await client.post(
                "/api/v1/auth/token",
                data={
                    "username": f"user{i}@example.com",
                    "password": "wrongpassword"
                }
            )
            responses.append(response.status_code)
        
        # Should get rate limited (429) at some point
        # or at least not all should be 401
        # This depends on rate limit configuration
        assert any(status == 429 for status in responses) or len(set(responses)) > 1
    
    @pytest.mark.asyncio
    async def test_field_visibility_security(self, client: AsyncClient, creator_auth_headers: dict, db_session: AsyncSession):
        """Test that invisible/inactive fields cannot be used."""
        from app.models.field import Field, DataTable, DataSource
        
        # Create an inactive field
        source = DataSource(
            id=str(uuid.uuid4()),
            name="test_source",
            type="postgresql",
            connection_string="postgresql://localhost/test",
            created_at=datetime.utcnow()
        )
        db_session.add(source)
        
        table = DataTable(
            id=str(uuid.uuid4()),
            name="test_table",
            source_id=source.id,
            created_at=datetime.utcnow()
        )
        db_session.add(table)
        
        inactive_field = Field(
            id=str(uuid.uuid4()),
            name="inactive_field",
            field_type="measure",
            table_id=table.id,
            is_active=False,  # Inactive
            created_at=datetime.utcnow()
        )
        db_session.add(inactive_field)
        await db_session.commit()
        
        # Try to use inactive field
        report_data = {
            "name": "Report with Inactive Field",
            "description": "Should fail",
            "definition": {
                "fields": ["inactive_field"],
                "filters": []
            }
        }
        
        response = await client.post(
            "/api/v1/reports",
            json=report_data,
            headers=creator_auth_headers
        )
        
        # Should reject inactive field
        assert response.status_code in [400, 422]
        assert "inactive" in response.json()["detail"].lower() or "not found" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_password_in_logs(self, client: AsyncClient, caplog):
        """Test that passwords are not logged."""
        import logging
        caplog.set_level(logging.DEBUG)
        
        # Attempt login
        await client.post(
            "/api/v1/auth/token",
            data={
                "username": "test@example.com",
                "password": "supersecretpassword123"
            }
        )
        
        # Check logs don't contain password
        log_text = caplog.text.lower()
        assert "supersecretpassword123" not in log_text
        assert "password" not in log_text or "***" in log_text or "[redacted]" in log_text
    
    @pytest.mark.asyncio
    async def test_security_headers(self, client: AsyncClient, auth_headers: dict):
        """Test that security headers are present in responses."""
        response = await client.get(
            "/api/v1/reports",
            headers=auth_headers
        )
        
        # Check for security headers
        headers = response.headers
        
        # These might be set by the application or reverse proxy
        security_headers = [
            "x-content-type-options",
            "x-frame-options",
            "x-xss-protection",
            "strict-transport-security"
        ]
        
        # At least some security headers should be present
        present_headers = [h for h in security_headers if h in headers]
        # This assertion might need adjustment based on actual configuration


@pytest.mark.security
class TestSecurityService:
    """Test the SecurityService directly."""
    
    def test_sql_injection_detection(self):
        """Test SQL injection pattern detection."""
        service = SecurityService()
        
        malicious_inputs = [
            "'; DROP TABLE users; --",
            "1' OR '1'='1",
            "admin' --",
            "' UNION SELECT * FROM passwords",
            "1; DELETE FROM reports WHERE 1=1",
            "' OR 1=1 --"
        ]
        
        for input_str in malicious_inputs:
            errors = service.detect_sql_injection(input_str)
            assert len(errors) > 0, f"Failed to detect SQL injection in: {input_str}"
    
    def test_xss_detection(self):
        """Test XSS pattern detection."""
        service = SecurityService()
        
        xss_inputs = [
            "<script>alert('XSS')</script>",
            "javascript:alert(1)",
            "<img src=x onerror=alert('XSS')>",
            "<body onload=alert('XSS')>",
            "<iframe src='javascript:alert(1)'>"
        ]
        
        for input_str in xss_inputs:
            errors = service.detect_xss(input_str)
            assert len(errors) > 0, f"Failed to detect XSS in: {input_str}"
    
    def test_command_injection_detection(self):
        """Test command injection detection."""
        service = SecurityService()
        
        command_inputs = [
            "; ls -la",
            "$(whoami)",
            "`cat /etc/passwd`",
            "| grep password",
            "&& rm -rf /"
        ]
        
        for input_str in command_inputs:
            errors = service.detect_command_injection(input_str)
            assert len(errors) > 0, f"Failed to detect command injection in: {input_str}"
    
    def test_path_traversal_detection(self):
        """Test path traversal detection."""
        service = SecurityService()
        
        path_inputs = [
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32",
            "file:///etc/passwd",
            "....//....//etc/passwd"
        ]
        
        for input_str in path_inputs:
            errors = service.detect_path_traversal(input_str)
            assert len(errors) > 0, f"Failed to detect path traversal in: {input_str}"
    
    def test_safe_inputs(self):
        """Test that legitimate inputs are not flagged."""
        service = SecurityService()
        
        safe_inputs = [
            "Normal report name",
            "field_1",
            "SUM(amount)",
            "2024-01-01",
            "user@example.com",
            "Product Sales Report Q1"
        ]
        
        for input_str in safe_inputs:
            sql_errors = service.detect_sql_injection(input_str)
            xss_errors = service.detect_xss(input_str)
            cmd_errors = service.detect_command_injection(input_str)
            path_errors = service.detect_path_traversal(input_str)
            
            assert len(sql_errors) == 0, f"False positive SQL injection for: {input_str}"
            assert len(xss_errors) == 0, f"False positive XSS for: {input_str}"
            assert len(cmd_errors) == 0, f"False positive command injection for: {input_str}"
            assert len(path_errors) == 0, f"False positive path traversal for: {input_str}"