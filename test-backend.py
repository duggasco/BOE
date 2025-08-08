#!/usr/bin/env python3
"""
Test script for BOE Backend API
"""

import asyncio
import httpx
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"
API_PREFIX = "/api/v1"

async def test_backend():
    """Test backend API endpoints"""
    async with httpx.AsyncClient() as client:
        # Test root endpoint
        print("Testing root endpoint...")
        response = await client.get(f"{BASE_URL}/")
        if response.status_code == 200:
            print(f"✓ Root endpoint: {response.json()}")
        else:
            print(f"✗ Root endpoint failed: {response.status_code}")
        
        # Test health endpoint
        print("\nTesting health endpoint...")
        response = await client.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print(f"✓ Health check: {response.json()}")
        else:
            print(f"✗ Health check failed: {response.status_code}")
        
        # Test API docs
        print("\nTesting API documentation...")
        response = await client.get(f"{BASE_URL}{API_PREFIX}/docs")
        if response.status_code == 200:
            print(f"✓ API docs available at {BASE_URL}{API_PREFIX}/docs")
        else:
            print(f"✗ API docs not available: {response.status_code}")
        
        # Test registration endpoint
        print("\nTesting user registration...")
        user_data = {
            "email": f"test_{datetime.now().timestamp()}@example.com",
            "username": f"testuser_{int(datetime.now().timestamp())}",
            "password": "SecurePass123!",
            "full_name": "Test User"
        }
        
        response = await client.post(
            f"{BASE_URL}{API_PREFIX}/auth/register",
            json=user_data
        )
        
        if response.status_code == 200:
            user = response.json()
            print(f"✓ User registered: {user['username']}")
            
            # Test login
            print("\nTesting login...")
            login_data = {
                "username": user_data["username"],
                "password": user_data["password"]
            }
            
            response = await client.post(
                f"{BASE_URL}{API_PREFIX}/auth/token",
                data=login_data  # OAuth2 uses form data
            )
            
            if response.status_code == 200:
                tokens = response.json()
                print(f"✓ Login successful, got access token")
                
                # Test authenticated endpoint
                print("\nTesting authenticated endpoint...")
                headers = {"Authorization": f"Bearer {tokens['access_token']}"}
                response = await client.get(
                    f"{BASE_URL}{API_PREFIX}/auth/me",
                    headers=headers
                )
                
                if response.status_code == 200:
                    print(f"✓ Authenticated user: {response.json()['username']}")
                else:
                    print(f"✗ Authentication failed: {response.status_code}")
            else:
                print(f"✗ Login failed: {response.status_code}")
        else:
            print(f"✗ Registration failed: {response.status_code}")
            print(f"  Error: {response.text}")

if __name__ == "__main__":
    print("BOE Backend API Test")
    print("=" * 50)
    asyncio.run(test_backend())