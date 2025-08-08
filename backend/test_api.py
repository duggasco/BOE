"""
Comprehensive API testing script for BOE Backend
Tests authentication, reports, fields, and query endpoints
"""

import asyncio
import httpx
import json
from typing import Dict, Any, Optional
from datetime import datetime
import sys

BASE_URL = "http://localhost:8000/api/v1"

class APITester:
    def __init__(self):
        self.client = httpx.AsyncClient(base_url=BASE_URL, timeout=30.0)
        self.token: Optional[str] = None
        self.headers: Dict[str, str] = {}
        self.test_results = []
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
    
    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        # Print immediate feedback
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details and not success:
            print(f"  Details: {details}")
    
    async def test_health_check(self):
        """Test health check endpoint"""
        try:
            response = await self.client.get("/health")
            if response.status_code == 200:
                data = response.json()
                self.log_result("Health Check", True, f"Status: {data.get('status')}")
                return True
            else:
                self.log_result("Health Check", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Health Check", False, str(e))
            return False
    
    async def test_login(self, username: str, password: str):
        """Test authentication endpoint"""
        try:
            # OAuth2 requires form data, not JSON
            form_data = {
                "username": username,
                "password": password,
                "grant_type": "password"
            }
            
            response = await self.client.post(
                "/auth/token",
                data=form_data
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                self.headers = {"Authorization": f"Bearer {self.token}"}
                self.log_result("Authentication", True, f"Token obtained for {username}")
                return True
            else:
                self.log_result("Authentication", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Authentication", False, str(e))
            return False
    
    async def test_get_current_user(self):
        """Test getting current user info"""
        try:
            response = await self.client.get("/auth/me", headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Get Current User", True, f"User: {data.get('username', 'unknown')}")
                return data
            else:
                self.log_result("Get Current User", False, f"Status: {response.status_code}")
                return None
                
        except Exception as e:
            self.log_result("Get Current User", False, str(e))
            return None
    
    async def test_list_reports(self):
        """Test listing reports"""
        try:
            response = await self.client.get("/reports/", headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                count = len(data) if isinstance(data, list) else 0
                self.log_result("List Reports", True, f"Found {count} reports")
                return data
            else:
                self.log_result("List Reports", False, f"Status: {response.status_code}")
                return None
                
        except Exception as e:
            self.log_result("List Reports", False, str(e))
            return None
    
    async def test_list_fields(self):
        """Test listing fields"""
        try:
            response = await self.client.get("/fields/fields/", headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                count = len(data) if isinstance(data, list) else 0
                self.log_result("List Fields", True, f"Found {count} fields")
                return data
            else:
                self.log_result("List Fields", False, f"Status: {response.status_code}")
                return None
                
        except Exception as e:
            self.log_result("List Fields", False, str(e))
            return None
    
    async def test_list_tables(self):
        """Test listing data tables"""
        try:
            response = await self.client.get("/fields/fields/tables", headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                count = len(data) if isinstance(data, list) else 0
                self.log_result("List Tables", True, f"Found {count} tables")
                return data
            else:
                self.log_result("List Tables", False, f"Status: {response.status_code}")
                return None
                
        except Exception as e:
            self.log_result("List Tables", False, str(e))
            return None
    
    async def test_create_report(self):
        """Test creating a new report"""
        try:
            report_data = {
                "name": f"Test Report {datetime.now().strftime('%Y%m%d_%H%M%S')}",
                "description": "Automated test report",
                "report_type": "standard",
                "definition": {
                    "sections": [
                        {
                            "id": "test_section",
                            "type": "table",
                            "title": "Test Table",
                            "fields": ["fund_name", "return_ytd"],
                            "filters": []
                        }
                    ]
                }
            }
            
            response = await self.client.post(
                "/reports/",
                json=report_data,
                headers=self.headers
            )
            
            if response.status_code == 200:
                data = response.json()
                report_id = data.get("id", "unknown")
                self.log_result("Create Report", True, f"Created report ID: {report_id}")
                return data
            else:
                self.log_result("Create Report", False, f"Status: {response.status_code}, Response: {response.text}")
                return None
                
        except Exception as e:
            self.log_result("Create Report", False, str(e))
            return None
    
    async def test_unauthorized_access(self):
        """Test that endpoints require authentication"""
        try:
            # Try to access reports without token
            response = await self.client.get("/reports/")
            
            if response.status_code == 401:
                self.log_result("Unauthorized Access Test", True, "Properly rejected unauthorized request")
                return True
            else:
                self.log_result("Unauthorized Access Test", False, f"Expected 401, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Unauthorized Access Test", False, str(e))
            return False
    
    async def test_invalid_login(self):
        """Test login with invalid credentials"""
        try:
            form_data = {
                "username": "invalid_user",
                "password": "wrong_password",
                "grant_type": "password"
            }
            
            response = await self.client.post("/auth/token", data=form_data)
            
            if response.status_code == 401:
                self.log_result("Invalid Login Test", True, "Properly rejected invalid credentials")
                return True
            else:
                self.log_result("Invalid Login Test", False, f"Expected 401, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Invalid Login Test", False, str(e))
            return False
    
    async def run_all_tests(self):
        """Run all API tests"""
        print("\n" + "="*60)
        print("BOE Backend API Test Suite")
        print("="*60 + "\n")
        
        # 1. Health check
        print("\n--- Basic Connectivity ---")
        await self.test_health_check()
        
        # 2. Security tests
        print("\n--- Security Tests ---")
        await self.test_unauthorized_access()
        await self.test_invalid_login()
        
        # 3. Authentication with valid credentials
        print("\n--- Authentication Tests ---")
        success = await self.test_login("admin@boe-system.local", "admin123")
        
        if not success:
            print("\n⚠️  Cannot proceed without authentication")
            return
        
        # 4. User info
        user_info = await self.test_get_current_user()
        
        # 5. Read operations
        print("\n--- Read Operations ---")
        reports = await self.test_list_reports()
        fields = await self.test_list_fields()
        tables = await self.test_list_tables()
        
        # 6. Write operations
        print("\n--- Write Operations ---")
        new_report = await self.test_create_report()
        
        # 7. Test with different user roles
        print("\n--- Role-Based Access Tests ---")
        
        # Test as viewer (limited permissions)
        await self.test_login("viewer@boe-system.local", "viewer123")
        await self.test_get_current_user()
        await self.test_list_reports()
        
        # Try to create report as viewer (should work based on our current implementation)
        await self.test_create_report()
        
        # Summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        
        passed = sum(1 for r in self.test_results if r["success"])
        failed = sum(1 for r in self.test_results if not r["success"])
        total = len(self.test_results)
        
        print(f"\nTotal Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        
        if failed > 0:
            print("\nFailed Tests:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        success_rate = (passed / total * 100) if total > 0 else 0
        print(f"\nSuccess Rate: {success_rate:.1f}%")
        
        if success_rate == 100:
            print("\n🎉 All tests passed!")
        elif success_rate >= 80:
            print("\n⚠️  Most tests passed, but some issues need attention")
        else:
            print("\n❌ Multiple test failures detected")


async def main():
    """Main test runner"""
    async with APITester() as tester:
        await tester.run_all_tests()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nTest suite interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nTest suite failed with error: {e}")
        sys.exit(1)