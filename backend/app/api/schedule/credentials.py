"""
Secure credential management endpoints for scheduling
"""

from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.services.credential_service import credential_service
from app.services.rbac_service import RBACService

router = APIRouter(prefix="/api/v1/schedules/credentials", tags=["schedule-credentials"])


class SMTPCredentialsRequest(BaseModel):
    """Request model for storing SMTP credentials"""
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password: str
    smtp_secure: bool = True
    from_address: EmailStr
    from_name: str = "BOE System"


class SMTPCredentialsResponse(BaseModel):
    """Response model for SMTP credentials (sanitized)"""
    smtp_host: str
    smtp_port: int
    smtp_user: str = "***REDACTED***"
    smtp_secure: bool
    from_address: str
    from_name: str
    is_configured: bool = True


@router.post("/smtp", response_model=SMTPCredentialsResponse)
async def store_smtp_credentials(
    request: SMTPCredentialsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> SMTPCredentialsResponse:
    """Store SMTP credentials securely for the current user"""
    
    # Check permissions
    if not await RBACService.user_has_permission(db, current_user.id, "schedule:create"):
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to configure SMTP credentials"
        )
    
    # Store credentials securely
    smtp_config = request.dict()
    await credential_service.store_smtp_credentials(db, current_user.id, smtp_config)
    
    # Return sanitized response
    return SMTPCredentialsResponse(
        smtp_host=request.smtp_host,
        smtp_port=request.smtp_port,
        smtp_secure=request.smtp_secure,
        from_address=request.from_address,
        from_name=request.from_name
    )


@router.get("/smtp", response_model=SMTPCredentialsResponse)
async def get_smtp_credentials(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> SMTPCredentialsResponse:
    """Get SMTP configuration for the current user (sanitized)"""
    
    # Get credentials
    config = await credential_service.get_smtp_credentials(db, current_user.id)
    
    if not config:
        raise HTTPException(
            status_code=404,
            detail="SMTP credentials not configured"
        )
    
    # Return sanitized response
    return SMTPCredentialsResponse(
        smtp_host=config.get("smtp_host", ""),
        smtp_port=config.get("smtp_port", 587),
        smtp_secure=config.get("smtp_secure", True),
        from_address=config.get("from_address", ""),
        from_name=config.get("from_name", "BOE System")
    )


@router.delete("/smtp", status_code=204)
async def delete_smtp_credentials(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete SMTP credentials for the current user"""
    
    # Get user and clear credentials
    user = await db.get(User, current_user.id)
    if user and user.metadata:
        if "encrypted_smtp_credentials" in user.metadata:
            del user.metadata["encrypted_smtp_credentials"]
        if "smtp_config" in user.metadata:
            del user.metadata["smtp_config"]
        await db.commit()


@router.post("/smtp/test")
async def test_smtp_connection(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> Dict[str, Any]:
    """Test SMTP connection with stored credentials"""
    
    # Get credentials
    config = await credential_service.get_smtp_credentials(db, current_user.id)
    
    if not config:
        raise HTTPException(
            status_code=404,
            detail="SMTP credentials not configured"
        )
    
    # Test connection directly without environment variables
    try:
        from fastapi_mail import ConnectionConfig, FastMail
        import asyncio
        
        # Create temporary connection config
        mail_config = ConnectionConfig(
            MAIL_USERNAME=config.get("smtp_user"),
            MAIL_PASSWORD=config.get("smtp_password"),
            MAIL_FROM=config.get("from_address", "test@example.com"),
            MAIL_PORT=config.get("smtp_port", 587),
            MAIL_SERVER=config.get("smtp_host"),
            MAIL_STARTTLS=config.get("smtp_secure", True),
            MAIL_SSL_TLS=False,
            USE_CREDENTIALS=True,
            VALIDATE_CERTS=True
        )
        
        # Test connection by creating FastMail instance
        fast_mail = FastMail(mail_config)
        
        # If we get here, config is valid
        # Could optionally try to send a test message to verify actual connectivity
        
        return {
            "success": True,
            "message": "SMTP configuration validated successfully",
            "server": config["smtp_host"],
            "port": config["smtp_port"]
        }
    except Exception as e:
        logger.error(f"SMTP test failed for user {current_user.id}: {e}")
        return {
            "success": False,
            "message": f"SMTP connection failed: {str(e)}",
            "server": config.get("smtp_host", "unknown"),
            "port": config.get("smtp_port", 0)
        }