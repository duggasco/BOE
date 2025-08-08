#!/usr/bin/env python3
"""
Security Test Script for BOE Backend
Tests RBAC, IDOR prevention, and SQL injection protection
"""

import requests
import json
from typing import Dict, Optional
import sys

BASE_URL = "http://localhost:8000"
API_PREFIX = "/api/v1"

def print_result(test_name: str, passed: bool, details: str = ""):
    """Print test result with formatting"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {test_name}")
    if details:
        print(f"  Details: {details}")

def get_token(email: str, password: str) -> Optional[str]:
    """Authenticate and get access token"""
    response = requests.post(
        f"{BASE_URL}{API_PREFIX}/auth/token",
        data={"username": email, "password": password}
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    return None

def test_viewer_cannot_create_report():
    """Test that viewer role cannot create reports"""
    # Login as viewer
    viewer_token = get_token("viewer@boe-system.local", "viewer123")
    if not viewer_token:
        print_result("Viewer Cannot Create Report", False, "Failed to authenticate as viewer")
        return False
    
    # Try to create a report
    headers = {"Authorization": f"Bearer {viewer_token}"}
    report_data = {
        "name": "Viewer Test Report",
        "description": "This should fail",
        "report_type": "standard",
        "definition": {
            "sections": [
                {
                    "id": "section1",
                    "type": "table",
                    "fields": [],
                    "config": {}
                }
            ],
            "filters": []
        }
    }
    
    response = requests.post(
        f"{BASE_URL}{API_PREFIX}/reports/",
        json=report_data,
        headers=headers
    )
    
    # Viewer should get 403 Forbidden
    if response.status_code == 403:
        print_result("Viewer Cannot Create Report", True, "Correctly denied (403)")
        return True
    else:
        print_result("Viewer Cannot Create Report", False, 
                    f"Status: {response.status_code}, Expected: 403")
        return False

def test_creator_can_create_report():
    """Test that creator role can create reports"""
    # Login as creator
    creator_token = get_token("creator@boe-system.local", "creator123")
    if not creator_token:
        print_result("Creator Can Create Report", False, "Failed to authenticate as creator")
        return False
    
    # Create a report
    headers = {"Authorization": f"Bearer {creator_token}"}
    report_data = {
        "name": "Creator Test Report",
        "description": "This should succeed",
        "report_type": "standard",
        "definition": {
            "sections": [
                {
                    "id": "section1",
                    "type": "table",
                    "fields": [],
                    "config": {}
                }
            ],
            "filters": []
        }
    }
    
    response = requests.post(
        f"{BASE_URL}{API_PREFIX}/reports/",
        json=report_data,
        headers=headers
    )
    
    if response.status_code == 200:
        print_result("Creator Can Create Report", True)
        return response.json()["id"]
    else:
        print_result("Creator Can Create Report", False, 
                    f"Status: {response.status_code}, Response: {response.text[:100]}")
        return None

def test_idor_prevention(report_id: str):
    """Test that users cannot modify other users' reports"""
    if not report_id:
        print_result("IDOR Prevention", False, "No report ID to test")
        return False
    
    # Login as viewer
    viewer_token = get_token("viewer@boe-system.local", "viewer123")
    if not viewer_token:
        print_result("IDOR Prevention", False, "Failed to authenticate as viewer")
        return False
    
    # Try to update creator's report
    headers = {"Authorization": f"Bearer {viewer_token}"}
    update_data = {
        "name": "Hacked Report",
        "description": "This should fail - IDOR attempt"
    }
    
    response = requests.put(
        f"{BASE_URL}{API_PREFIX}/reports/{report_id}",
        json=update_data,
        headers=headers
    )
    
    # Should get 403 Forbidden
    if response.status_code == 403:
        print_result("IDOR Prevention (Update)", True, "Correctly denied (403)")
    else:
        print_result("IDOR Prevention (Update)", False,
                    f"Status: {response.status_code}, Expected: 403")
        return False
    
    # Try to delete creator's report
    response = requests.delete(
        f"{BASE_URL}{API_PREFIX}/reports/{report_id}",
        headers=headers
    )
    
    if response.status_code == 403:
        print_result("IDOR Prevention (Delete)", True, "Correctly denied (403)")
        return True
    else:
        print_result("IDOR Prevention (Delete)", False,
                    f"Status: {response.status_code}, Expected: 403")
        return False

def test_sql_injection_prevention():
    """Test SQL injection prevention in report definitions"""
    # Login as creator
    creator_token = get_token("creator@boe-system.local", "creator123")
    if not creator_token:
        print_result("SQL Injection Prevention", False, "Failed to authenticate")
        return False
    
    headers = {"Authorization": f"Bearer {creator_token}"}
    
    # Test 1: SQL injection in filter
    malicious_report = {
        "name": "SQL Test Report",
        "description": "Testing SQL injection",
        "report_type": "standard",
        "definition": {
            "sections": [
                {
                    "id": "section1",
                    "type": "table",
                    "fields": [],
                    "config": {}
                }
            ],
            "filters": [
                {
                    "field": "id",
                    "operator": "=",
                    "value": "1 OR 1=1; DROP TABLE users;--"
                }
            ]
        }
    }
    
    response = requests.post(
        f"{BASE_URL}{API_PREFIX}/reports/",
        json=malicious_report,
        headers=headers
    )
    
    # Should reject malicious content
    if response.status_code == 400:
        print_result("SQL Injection Prevention (Filter)", True, "Malicious content rejected")
    else:
        print_result("SQL Injection Prevention (Filter)", False,
                    f"Status: {response.status_code}, Expected: 400")
        return False
    
    # Test 2: XSS in config
    xss_report = {
        "name": "XSS Test Report",
        "description": "Testing XSS prevention",
        "report_type": "standard",
        "definition": {
            "sections": [
                {
                    "id": "section1",
                    "type": "table",
                    "fields": [],
                    "config": {
                        "title": "<script>alert('XSS')</script>"
                    }
                }
            ],
            "filters": []
        }
    }
    
    response = requests.post(
        f"{BASE_URL}{API_PREFIX}/reports/",
        json=xss_report,
        headers=headers
    )
    
    if response.status_code == 400:
        print_result("XSS Prevention", True, "Script tag rejected")
        return True
    else:
        print_result("XSS Prevention", False,
                    f"Status: {response.status_code}, Expected: 400")
        return False

def test_owner_can_modify_own_report():
    """Test that report owners can modify their own reports"""
    # Login as creator
    creator_token = get_token("creator@boe-system.local", "creator123")
    if not creator_token:
        print_result("Owner Can Modify Own Report", False, "Failed to authenticate")
        return False
    
    headers = {"Authorization": f"Bearer {creator_token}"}
    
    # Create a report
    report_data = {
        "name": "My Report",
        "description": "Original description",
        "report_type": "standard",
        "definition": {
            "sections": [
                {
                    "id": "section1",
                    "type": "table",
                    "fields": [],
                    "config": {}
                }
            ],
            "filters": []
        }
    }
    
    response = requests.post(
        f"{BASE_URL}{API_PREFIX}/reports/",
        json=report_data,
        headers=headers
    )
    
    if response.status_code != 200:
        print_result("Owner Can Modify Own Report", False, "Failed to create report")
        return False
    
    report_id = response.json()["id"]
    
    # Update own report
    update_data = {
        "description": "Updated description"
    }
    
    response = requests.put(
        f"{BASE_URL}{API_PREFIX}/reports/{report_id}",
        json=update_data,
        headers=headers
    )
    
    if response.status_code == 200:
        print_result("Owner Can Modify Own Report", True)
        
        # Clean up - delete the report
        requests.delete(
            f"{BASE_URL}{API_PREFIX}/reports/{report_id}",
            headers=headers
        )
        return True
    else:
        print_result("Owner Can Modify Own Report", False,
                    f"Status: {response.status_code}")
        return False

def main():
    """Run all security tests"""
    print("=" * 60)
    print("BOE Backend Security Test Suite")
    print("=" * 60)
    print()
    
    print("--- RBAC Tests ---")
    test_viewer_cannot_create_report()
    report_id = test_creator_can_create_report()
    
    print("\n--- IDOR Prevention Tests ---")
    if report_id:
        test_idor_prevention(report_id)
    
    print("\n--- Injection Prevention Tests ---")
    test_sql_injection_prevention()
    
    print("\n--- Ownership Tests ---")
    test_owner_can_modify_own_report()
    
    print("\n" + "=" * 60)
    print("Security testing complete")

if __name__ == "__main__":
    main()