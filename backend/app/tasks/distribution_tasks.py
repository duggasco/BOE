"""
Celery tasks for report distribution via various channels
"""

import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from smtplib import SMTPException

from celery import shared_task
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from asgiref.sync import async_to_sync

from app.core.config import settings
from app.services.email_service import EmailService
from app.services.distribution_service import DistributionService
from app.models.schedule import ScheduleExecution
from app.models.export import Export

logger = logging.getLogger(__name__)

# Create async engine for Celery tasks
engine = create_async_engine(str(settings.DATABASE_URL))
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60
)
def send_distribution_email(
    self,
    export_id: str,
    recipients: List[str],
    subject: str,
    report_name: str,
    schedule_name: Optional[str] = None,
    user_id: Optional[str] = None,
    execution_id: Optional[str] = None,
    cc: Optional[List[str]] = None,
    bcc: Optional[List[str]] = None,
    custom_message: Optional[str] = None,
    config: Optional[Dict[str, Any]] = None
):
    """
    Send report email with attachment or download link.
    Uses exponential backoff for retries on failure.
    """
    
    async def _send_email():
        async with AsyncSessionLocal() as db:
            try:
                # Get the export
                export = await db.get(Export, export_id)
                if not export or not export.file_path:
                    logger.error(f"Export {export_id} not found or has no file")
                    return {
                        "success": False,
                        "error": "Export not found"
                    }
                
                # Construct file path
                export_path = Path(settings.EXPORT_DIR) / export.file_path
                if not export_path.exists():
                    logger.error(f"Export file not found: {export_path}")
                    return {
                        "success": False,
                        "error": "Export file not found"
                    }
                
                # Initialize email service
                email_service = EmailService(db)
                
                # Check if email service is configured
                if not email_service.is_configured():
                    logger.error("Email service not configured")
                    return {
                        "success": False,
                        "error": "Email service not configured",
                        "retry": False  # Don't retry configuration issues
                    }
                
                # Determine if we need a download link (large file)
                file_size = export_path.stat().st_size
                use_download_link = file_size > settings.MAIL_MAX_ATTACHMENT_SIZE
                
                # Generate download URL if needed
                download_url = None
                if use_download_link:
                    # This would be the actual download URL in production
                    # For now, we'll use a placeholder
                    base_url = config.get("base_url", "http://localhost:8001") if config else "http://localhost:8001"
                    download_url = f"{base_url}/api/v1/exports/{export_id}/download"
                
                # Send the email
                result = await email_service.send_report_email(
                    report_name=report_name,
                    recipients=recipients,
                    export_path=export_path,
                    schedule_name=schedule_name,
                    user_id=user_id,
                    execution_id=execution_id,
                    cc=cc,
                    bcc=bcc,
                    custom_subject=subject,
                    custom_message=custom_message,
                    include_link=use_download_link,
                    download_url=download_url
                )
                
                # Update execution status if provided
                if execution_id and result["success"]:
                    execution = await db.get(ScheduleExecution, execution_id)
                    if execution:
                        if not execution.delivery_info:
                            execution.delivery_info = {}
                        execution.delivery_info["email"] = {
                            "success": True,
                            "recipients": len(recipients),
                            "timestamp": datetime.utcnow().isoformat(),
                            "file_size": file_size,
                            "used_download_link": use_download_link
                        }
                        await db.commit()
                
                return result
                
            except Exception as e:
                logger.error(f"Error in email distribution task: {str(e)}")
                return {
                    "success": False,
                    "error": str(e),
                    "retry": True
                }
    
    # Run the async function using asgiref for proper sync/async bridge
    result = async_to_sync(_send_email)()
    
    # Handle retries for transient failures
    if not result["success"] and result.get("retry", True):
        try:
            # Exponential backoff: 10s, 20s, 40s, 80s, 160s
            countdown = settings.MAIL_RETRY_BACKOFF_BASE * (2 ** self.request.retries)
            logger.info(
                f"Email send failed, retrying in {countdown} seconds "
                f"(attempt {self.request.retries + 1}/{settings.MAIL_MAX_RETRIES})"
            )
            raise self.retry(countdown=countdown)
        except self.MaxRetriesExceededError:
            logger.error(
                f"Max retries exceeded for email to {recipients}. "
                f"Final error: {result.get('error')}"
            )
            # Send failure notification if configured
            async_to_sync(_send_failure_notification)(
                export_id, recipients, report_name, 
                schedule_name, result.get("error")
            )
            return result
    
    return result


async def _send_failure_notification(
    export_id: str,
    recipients: List[str],
    report_name: str,
    schedule_name: Optional[str],
    error_message: str
):
    """Send a failure notification email to administrators"""
    async with AsyncSessionLocal() as db:
        try:
            email_service = EmailService(db)
            
            # Get admin email from settings or use default
            admin_email = settings.MAIL_FROM  # Or have a specific ADMIN_EMAIL setting
            
            # Render failure template
            from jinja2 import Environment, FileSystemLoader
            template_env = Environment(
                loader=FileSystemLoader(Path(settings.MAIL_TEMPLATE_DIR)),
                autoescape=True
            )
            
            template = template_env.get_template("monitoring/delivery_failure.html")
            body_html = template.render(
                report_name=report_name,
                schedule_name=schedule_name,
                scheduled_time=datetime.utcnow().isoformat(),
                failed_at=datetime.utcnow().isoformat(),
                failure_type="Email Delivery",
                error_message=error_message,
                retry_count=settings.MAIL_MAX_RETRIES,
                will_retry=False,
                max_retries=settings.MAIL_MAX_RETRIES
            )
            
            await email_service.send_email(
                recipients=[admin_email],
                subject=f"[FAILURE] Report Delivery Failed: {report_name}",
                body_html=body_html
            )
            
        except Exception as e:
            logger.error(f"Failed to send failure notification: {str(e)}")


@shared_task(bind=True, max_retries=3)
def send_batch_distribution_emails(
    self,
    export_id: str,
    recipient_groups: Dict[str, List[str]],  # {"to": [...], "cc": [...], "bcc": [...]}
    subject: str,
    report_name: str,
    batch_size: int = 10,
    **kwargs
):
    """
    Send emails to multiple recipients in batches to avoid overwhelming the SMTP server.
    """
    
    to_recipients = recipient_groups.get("to", [])
    cc_recipients = recipient_groups.get("cc", [])
    bcc_recipients = recipient_groups.get("bcc", [])
    
    # Split TO recipients into batches
    results = []
    for i in range(0, len(to_recipients), batch_size):
        batch = to_recipients[i:i + batch_size]
        
        # Queue individual email task for this batch
        task = send_distribution_email.apply_async(
            args=[
                export_id,
                batch,
                subject,
                report_name
            ],
            kwargs={
                **kwargs,
                "cc": cc_recipients if i == 0 else None,  # Only include CC/BCC in first batch
                "bcc": bcc_recipients if i == 0 else None
            },
            countdown=i * 2  # Stagger sends by 2 seconds per batch
        )
        
        results.append({
            "batch": i // batch_size + 1,
            "recipients": batch,
            "task_id": task.id
        })
    
    logger.info(
        f"Queued {len(results)} email batches for {len(to_recipients)} recipients"
    )
    
    return {
        "success": True,
        "batches": results,
        "total_recipients": len(to_recipients)
    }


@shared_task
def test_email_configuration():
    """
    Test email configuration by attempting to connect to SMTP server.
    """
    
    async def _test():
        async with AsyncSessionLocal() as db:
            email_service = EmailService(db)
            return await email_service.test_connection()
    
    return async_to_sync(_test)()


@shared_task
def send_test_email(recipient: str):
    """
    Send a test email to verify the email system is working.
    """
    
    async def _send_test():
        async with AsyncSessionLocal() as db:
            email_service = EmailService(db)
            return await email_service.send_test_email(recipient)
    
    return async_to_sync(_send_test)()


@shared_task(bind=True, max_retries=3)
def distribute_report(
    self,
    export_id: str,
    distribution_config: Dict[str, Any],
    schedule_name: str = "",
    report_name: str = "",
    user_id: Optional[str] = None,
    execution_id: Optional[str] = None
):
    """
    Main distribution task that handles all distribution channels.
    """
    
    async def _distribute():
        async with AsyncSessionLocal() as db:
            try:
                distribution_service = DistributionService(db)
                
                results = {}
                
                # Process each distribution channel
                for channel, config in distribution_config.items():
                    if channel == "email":
                        # Use the email distribution task
                        recipients = config.get("recipients", [])
                        subject = config.get("subject", f"Report: {report_name}")
                        
                        email_result = send_distribution_email.apply_async(
                            args=[
                                export_id,
                                recipients,
                                subject,
                                report_name
                            ],
                            kwargs={
                                "schedule_name": schedule_name,
                                "user_id": user_id,
                                "execution_id": execution_id,
                                "custom_message": config.get("message"),
                                "cc": config.get("cc"),
                                "bcc": config.get("bcc"),
                                "config": config
                            }
                        )
                        
                        results["email"] = {
                            "task_id": email_result.id,
                            "status": "queued"
                        }
                    
                    elif channel == "local":
                        # Use the existing local distribution
                        result = await distribution_service.distribute(
                            export_id=export_id,
                            config={"local": config},
                            schedule_name=schedule_name,
                            report_name=report_name
                        )
                        results["local"] = result.get("local")
                    
                    else:
                        # Other channels (webhook, sftp, etc.) to be implemented
                        results[channel] = {
                            "status": "not_implemented",
                            "message": f"Distribution channel '{channel}' not yet implemented"
                        }
                
                return {
                    "success": True,
                    "results": results,
                    "export_id": export_id,
                    "timestamp": datetime.utcnow().isoformat()
                }
                
            except Exception as e:
                logger.error(f"Distribution task failed: {str(e)}")
                
                if self.request.retries < self.max_retries:
                    raise self.retry(countdown=60)
                
                return {
                    "success": False,
                    "error": str(e),
                    "export_id": export_id
                }
    
    return async_to_sync(_distribute)()