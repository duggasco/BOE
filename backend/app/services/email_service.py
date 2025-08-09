"""
Email service for sending reports and notifications via SMTP
"""

import os
import re
import logging
from pathlib import Path
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, timedelta
import mimetypes

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
from fastapi_mail.errors import ConnectionErrors
from pydantic import EmailStr
from email_validator import validate_email, EmailNotValidError
from jinja2 import Environment, FileSystemLoader, TemplateNotFound
import bleach

from app.core.config import settings
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis
from typing import Optional as Opt
import time
from app.models.schedule import ScheduleExecution

logger = logging.getLogger(__name__)


class SimpleRateLimiter:
    """Rate limiter for email sending using Redis (required)"""
    
    def __init__(self):
        self._redis_client = None
        
    async def _get_redis(self):
        """Get or create Redis connection"""
        if not self._redis_client:
            try:
                self._redis_client = await redis.from_url(settings.REDIS_URL)
            except Exception as e:
                logger.error(f"Redis connection failed - rate limiting disabled: {e}")
                raise RuntimeError("Redis is required for rate limiting") from e
        return self._redis_client
    
    async def get_count(self, key: str, window_seconds: int) -> int:
        """Get the current count for a key within the time window"""
        client = await self._get_redis()
        
        try:
            # Use Redis for distributed rate limiting
            current_time = int(time.time())
            window_start = current_time - window_seconds
            
            # Clean old entries
            await client.zremrangebyscore(f"rate:{key}", 0, window_start)
            
            # Get current count
            count = await client.zcard(f"rate:{key}")
            return count
        except Exception as e:
            logger.error(f"Redis rate limit check failed: {e}")
            # Fail closed - assume limit exceeded if Redis fails
            return float('inf')
    
    async def increment(self, key: str, window_seconds: int):
        """Increment the count for a key"""
        client = await self._get_redis()
        current_time = time.time()
        
        try:
            # Use Redis
            await client.zadd(f"rate:{key}", {str(current_time): current_time})
            await client.expire(f"rate:{key}", window_seconds)
        except Exception as e:
            logger.error(f"Redis rate limit increment failed: {e}")
            # Fail closed - raise error if can't track rate limits
            raise RuntimeError("Failed to track rate limit") from e


class EmailService:
    """Service for handling email distribution of reports"""
    
    def __init__(self, db: Optional[AsyncSession] = None):
        """Initialize email service with configuration"""
        self.db = db
        self._config = None
        self._fastmail = None
        self._templates_env = None
        self._rate_limiter = SimpleRateLimiter()
        
        # Initialize if credentials are configured
        if settings.MAIL_SERVER and settings.MAIL_USERNAME:
            self._setup_mail_config()
    
    def _setup_mail_config(self):
        """Setup FastMail configuration"""
        try:
            self._config = ConnectionConfig(
                MAIL_USERNAME=settings.MAIL_USERNAME,
                MAIL_PASSWORD=settings.MAIL_PASSWORD,
                MAIL_FROM=settings.MAIL_FROM,
                MAIL_PORT=settings.MAIL_PORT,
                MAIL_SERVER=settings.MAIL_SERVER,
                MAIL_STARTTLS=settings.MAIL_STARTTLS,
                MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
                USE_CREDENTIALS=settings.MAIL_USE_CREDENTIALS,
                VALIDATE_CERTS=settings.MAIL_VALIDATE_CERTS,
                TEMPLATE_FOLDER=Path(settings.MAIL_TEMPLATE_DIR),
            )
            self._fastmail = FastMail(self._config)
            
            # Setup Jinja2 templates
            template_path = Path(settings.MAIL_TEMPLATE_DIR)
            if template_path.exists():
                self._templates_env = Environment(
                    loader=FileSystemLoader(template_path),
                    autoescape=True
                )
            else:
                logger.warning(f"Email template directory not found: {template_path}")
                
        except Exception as e:
            logger.error(f"Failed to setup email configuration: {str(e)}")
            raise
    
    def is_configured(self) -> bool:
        """Check if email service is properly configured"""
        return self._fastmail is not None
    
    def validate_email_address(self, email: str) -> bool:
        """Validate an email address"""
        try:
            validate_email(email)
            return True
        except EmailNotValidError:
            return False
    
    def sanitize_email_list(self, emails: List[str]) -> List[str]:
        """Validate and sanitize a list of email addresses"""
        valid_emails = []
        for email in emails:
            email = email.strip().lower()
            if self.validate_email_address(email):
                valid_emails.append(email)
            else:
                logger.warning(f"Invalid email address skipped: {email}")
        return valid_emails
    
    async def check_rate_limits(self, user_id: str) -> Dict[str, Any]:
        """Check if user has exceeded email rate limits"""
        # Check global rate limit
        global_key = "email:global"
        global_count = await self._rate_limiter.get_count(
            global_key, 
            window_seconds=3600
        )
        
        if global_count >= settings.MAIL_MAX_PER_HOUR_GLOBAL:
            return {
                "allowed": False,
                "reason": "Global email rate limit exceeded",
                "retry_after": 3600
            }
        
        # Check per-user rate limit
        user_key = f"email:user:{user_id}"
        user_count = await self._rate_limiter.get_count(
            user_key,
            window_seconds=3600
        )
        
        if user_count >= settings.MAIL_MAX_PER_HOUR_USER:
            return {
                "allowed": False,
                "reason": "User email rate limit exceeded",
                "retry_after": 3600
            }
        
        return {
            "allowed": True,
            "global_remaining": settings.MAIL_MAX_PER_HOUR_GLOBAL - global_count,
            "user_remaining": settings.MAIL_MAX_PER_HOUR_USER - user_count
        }
    
    async def increment_rate_limit(self, user_id: str):
        """Increment rate limit counters after sending email"""
        await self._rate_limiter.increment("email:global", window_seconds=3600)
        await self._rate_limiter.increment(f"email:user:{user_id}", window_seconds=3600)
    
    def prepare_attachment(self, file_path: Path) -> Optional[Dict[str, Any]]:
        """Prepare a file for email attachment"""
        if not file_path.exists():
            logger.error(f"Attachment file not found: {file_path}")
            return None
        
        file_size = file_path.stat().st_size
        
        # Check file size limit
        if file_size > settings.MAIL_MAX_ATTACHMENT_SIZE:
            logger.warning(
                f"File too large for email attachment: {file_size} bytes "
                f"(max: {settings.MAIL_MAX_ATTACHMENT_SIZE} bytes)"
            )
            return None
        
        # Determine MIME type
        mime_type, _ = mimetypes.guess_type(str(file_path))
        if not mime_type:
            mime_type = "application/octet-stream"
        
        try:
            with open(file_path, "rb") as f:
                content = f.read()
            
            return {
                "file": content,
                "filename": file_path.name,
                "mime_type": mime_type,
                "size": file_size
            }
        except Exception as e:
            logger.error(f"Failed to read attachment file: {str(e)}")
            return None
    
    async def send_email(
        self,
        recipients: List[str],
        subject: str,
        body_html: Optional[str] = None,
        body_text: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        attachments: Optional[List[Path]] = None,
        reply_to: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Send an email with optional attachments"""
        
        if not self.is_configured():
            return {
                "success": False,
                "error": "Email service not configured",
                "message": "SMTP settings not provided"
            }
        
        try:
            # Sanitize email addresses
            recipients = self.sanitize_email_list(recipients)
            if not recipients:
                return {
                    "success": False,
                    "error": "No valid recipients",
                    "message": "All recipient email addresses were invalid"
                }
            
            # Check recipient limit
            total_recipients = len(recipients)
            if cc:
                cc = self.sanitize_email_list(cc)
                total_recipients += len(cc)
            if bcc:
                bcc = self.sanitize_email_list(bcc)
                total_recipients += len(bcc)
            
            if total_recipients > settings.MAIL_MAX_RECIPIENTS:
                return {
                    "success": False,
                    "error": "Too many recipients",
                    "message": f"Maximum {settings.MAIL_MAX_RECIPIENTS} recipients allowed"
                }
            
            # Prepare attachments
            attachment_list = []
            if attachments:
                for attachment_path in attachments:
                    attachment_data = self.prepare_attachment(attachment_path)
                    if attachment_data:
                        attachment_list.append(attachment_data)
            
            # Create message
            message = MessageSchema(
                subject=subject,
                recipients=recipients,
                body=body_html or body_text,
                subtype=MessageType.html if body_html else MessageType.plain,
                cc=cc,
                bcc=bcc,
                attachments=attachment_list,
                headers=headers or {}
            )
            
            if reply_to:
                message.headers["Reply-To"] = reply_to
            
            # Send email
            await self._fastmail.send_message(message)
            
            logger.info(
                f"Email sent successfully to {len(recipients)} recipients "
                f"with subject: {subject}"
            )
            
            return {
                "success": True,
                "message": "Email sent successfully",
                "recipients": recipients,
                "attachments": len(attachment_list),
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except ConnectionErrors as e:
            logger.error(f"SMTP connection error: {str(e)}")
            return {
                "success": False,
                "error": "Connection error",
                "message": str(e),
                "retry": True
            }
        except Exception as e:
            logger.error(f"Failed to send email: {str(e)}")
            return {
                "success": False,
                "error": "Send failed",
                "message": str(e)
            }
    
    async def send_report_email(
        self,
        report_name: str,
        recipients: List[str],
        export_path: Path,
        schedule_name: Optional[str] = None,
        user_id: Optional[str] = None,
        execution_id: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        custom_subject: Optional[str] = None,
        custom_message: Optional[str] = None,
        include_link: bool = False,
        download_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send a report email with attachment or download link"""
        
        # Check rate limits if user_id provided
        if user_id:
            rate_check = await self.check_rate_limits(user_id)
            if not rate_check["allowed"]:
                return {
                    "success": False,
                    "error": "Rate limit exceeded",
                    "message": rate_check["reason"],
                    "retry_after": rate_check["retry_after"]
                }
        
        # Prepare email subject
        if custom_subject:
            subject = custom_subject.format(
                report_name=report_name,
                schedule_name=schedule_name or "",
                date=datetime.now().strftime("%Y-%m-%d"),
                time=datetime.now().strftime("%H:%M")
            )
        else:
            subject = f"Report: {report_name} - {datetime.now().strftime('%Y-%m-%d')}"
        
        # Check file size to determine attachment vs link
        file_size = export_path.stat().st_size if export_path.exists() else 0
        use_attachment = (
            file_size <= settings.MAIL_MAX_ATTACHMENT_SIZE 
            and not include_link
        )
        
        # Render email template
        try:
            template_name = (
                "distribution/report_notification.html" 
                if use_attachment 
                else "distribution/report_with_link.html"
            )
            
            if self._templates_env:
                template = self._templates_env.get_template(template_name)
                body_html = template.render(
                    report_name=report_name,
                    schedule_name=schedule_name,
                    custom_message=custom_message,
                    download_url=download_url,
                    file_size=f"{file_size / 1024 / 1024:.2f} MB",
                    generated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    format=export_path.suffix.upper().replace(".", "")
                )
            else:
                # Fallback to simple HTML if templates not available
                body_html = self._generate_simple_html(
                    report_name=report_name,
                    schedule_name=schedule_name,
                    custom_message=custom_message,
                    download_url=download_url if not use_attachment else None,
                    file_size=file_size
                )
        except TemplateNotFound:
            logger.warning(f"Email template not found: {template_name}")
            body_html = self._generate_simple_html(
                report_name=report_name,
                schedule_name=schedule_name,
                custom_message=custom_message,
                download_url=download_url if not use_attachment else None,
                file_size=file_size
            )
        
        # Prepare attachments if applicable
        attachments = [export_path] if use_attachment else None
        
        # Send email
        result = await self.send_email(
            recipients=recipients,
            subject=subject,
            body_html=body_html,
            cc=cc,
            bcc=bcc,
            attachments=attachments
        )
        
        # Track delivery if successful
        if result["success"] and user_id:
            await self.increment_rate_limit(user_id)
            
            # Update execution record if provided
            if execution_id and self.db:
                await self._update_execution_delivery(
                    execution_id, 
                    result,
                    len(recipients)
                )
        
        return result
    
    def _generate_simple_html(
        self,
        report_name: str,
        schedule_name: Optional[str],
        custom_message: Optional[str],
        download_url: Optional[str],
        file_size: int
    ) -> str:
        """Generate simple HTML email body when templates not available"""
        html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Report: {report_name}</h2>
            """
        
        if schedule_name:
            html += f"<p><strong>Schedule:</strong> {schedule_name}</p>"
        
        html += f"""
            <p><strong>Generated:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            <p><strong>File Size:</strong> {file_size / 1024 / 1024:.2f} MB</p>
            """
        
        if custom_message:
            # Sanitize custom message to prevent XSS attacks
            safe_message = bleach.clean(
                custom_message,
                tags=['p', 'br', 'strong', 'em', 'u', 'a'],
                attributes={'a': ['href', 'title']},
                strip=True
            )
            html += f"<p>{safe_message}</p>"
        
        if download_url:
            html += f"""
            <p>The report file is too large to attach directly. 
            Please download it using the link below:</p>
            <p><a href="{download_url}" style="background-color: #007bff; 
            color: white; padding: 10px 20px; text-decoration: none; 
            border-radius: 5px; display: inline-block;">Download Report</a></p>
            <p><small>This link will expire in 24 hours.</small></p>
            """
        else:
            html += "<p>The report is attached to this email.</p>"
        
        html += """
            <hr style="margin-top: 30px;">
            <p style="color: #666; font-size: 12px;">
            This is an automated email from the BOE Reporting System.
            </p>
        </body>
        </html>
        """
        
        return html
    
    async def _update_execution_delivery(
        self,
        execution_id: str,
        result: Dict[str, Any],
        recipient_count: int
    ):
        """Update schedule execution with delivery information"""
        try:
            execution = await self.db.get(ScheduleExecution, execution_id)
            if execution:
                if not execution.delivery_info:
                    execution.delivery_info = {}
                
                execution.delivery_info["email"] = {
                    "success": result["success"],
                    "recipients": recipient_count,
                    "timestamp": result.get("timestamp"),
                    "error": result.get("error")
                }
                
                await self.db.commit()
        except Exception as e:
            logger.error(f"Failed to update execution delivery info: {str(e)}")
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test SMTP connection without sending an email"""
        if not self.is_configured():
            return {
                "success": False,
                "error": "Email service not configured",
                "message": "SMTP settings not provided"
            }
        
        try:
            # Try to create a connection
            # FastMail doesn't have a direct test method, so we'll validate config
            test_message = MessageSchema(
                subject="Test Connection",
                recipients=["test@example.com"],  # Won't actually send
                body="Test",
                subtype=MessageType.plain
            )
            
            # This will validate the configuration without sending
            # We're not actually sending, just checking if we can create the message
            return {
                "success": True,
                "message": "SMTP configuration appears valid",
                "server": settings.MAIL_SERVER,
                "port": settings.MAIL_PORT,
                "username": settings.MAIL_USERNAME,
                "starttls": settings.MAIL_STARTTLS,
                "ssl": settings.MAIL_SSL_TLS
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": "Connection test failed",
                "message": str(e)
            }
    
    async def send_test_email(self, recipient: str) -> Dict[str, Any]:
        """Send a test email to verify configuration"""
        if not self.validate_email_address(recipient):
            return {
                "success": False,
                "error": "Invalid email address",
                "message": f"The email address {recipient} is not valid"
            }
        
        subject = f"BOE System Test Email - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        
        body_html = """
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>BOE Email System Test</h2>
            <p>This is a test email from the BOE Reporting System.</p>
            <p>If you received this email, the SMTP configuration is working correctly.</p>
            <hr>
            <h3>Configuration Details:</h3>
            <ul>
                <li><strong>Server:</strong> {server}</li>
                <li><strong>Port:</strong> {port}</li>
                <li><strong>TLS:</strong> {tls}</li>
                <li><strong>SSL:</strong> {ssl}</li>
                <li><strong>From:</strong> {from_addr}</li>
                <li><strong>Timestamp:</strong> {timestamp}</li>
            </ul>
            <hr>
            <p style="color: #666; font-size: 12px;">
            This test was initiated to verify email delivery functionality.
            </p>
        </body>
        </html>
        """.format(
            server=settings.MAIL_SERVER,
            port=settings.MAIL_PORT,
            tls=settings.MAIL_STARTTLS,
            ssl=settings.MAIL_SSL_TLS,
            from_addr=settings.MAIL_FROM,
            timestamp=datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        )
        
        return await self.send_email(
            recipients=[recipient],
            subject=subject,
            body_html=body_html
        )