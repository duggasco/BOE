"""
Email tasks for sending reports and notifications via email.
"""
from celery import Task, shared_task
from typing import Dict, Any, List, Optional
import logging
from pathlib import Path

from app.services.email_service import EmailService

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    name="app.tasks.email_tasks.send_report_email",
    max_retries=3,
    default_retry_delay=60
)
def send_report_email(
    self: Task,
    recipients: List[str],
    subject: str,
    body: str,
    attachment_path: Optional[str] = None,
    smtp_config: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Send a report via email with optional attachment.
    
    Args:
        recipients: List of email addresses
        subject: Email subject
        body: Email body (HTML supported)
        attachment_path: Optional path to file to attach
        smtp_config: SMTP configuration dict
        
    Returns:
        Result dictionary with status and details
    """
    try:
        logger.info(f"Sending email to {len(recipients)} recipients")
        
        # Initialize email service
        email_service = EmailService(smtp_config)
        
        # Prepare attachments if provided
        attachments = []
        if attachment_path and Path(attachment_path).exists():
            attachments.append(attachment_path)
            logger.info(f"Attaching file: {attachment_path}")
        
        # Send email
        result = email_service.send_email(
            recipients=recipients,
            subject=subject,
            body=body,
            attachments=attachments
        )
        
        logger.info(f"Email sent successfully to {recipients}")
        return {
            "status": "success",
            "recipients": recipients,
            "message_id": result.get("message_id")
        }
        
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        # Retry the task
        raise self.retry(exc=e)


@shared_task(
    bind=True,
    name="app.tasks.email_tasks.send_notification",
    max_retries=1,
    default_retry_delay=30
)
def send_notification(
    self: Task,
    recipient: str,
    subject: str,
    message: str
) -> Dict[str, Any]:
    """
    Send a simple notification email.
    
    Args:
        recipient: Email address
        subject: Email subject
        message: Plain text message
        
    Returns:
        Result dictionary
    """
    try:
        logger.info(f"Sending notification to {recipient}")
        
        # Use default SMTP config from settings
        email_service = EmailService()
        
        result = email_service.send_email(
            recipients=[recipient],
            subject=subject,
            body=message,
            is_html=False
        )
        
        return {
            "status": "success",
            "recipient": recipient
        }
        
    except Exception as e:
        logger.error(f"Failed to send notification: {str(e)}")
        raise self.retry(exc=e)


@shared_task(
    name="app.tasks.email_tasks.test_smtp_connection"
)
def test_smtp_connection(smtp_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Test SMTP connection with provided configuration.
    
    Args:
        smtp_config: SMTP configuration to test
        
    Returns:
        Test result dictionary
    """
    try:
        email_service = EmailService(smtp_config)
        
        # Test connection
        if email_service.test_connection():
            return {
                "status": "success",
                "message": "SMTP connection successful"
            }
        else:
            return {
                "status": "error",
                "message": "SMTP connection failed"
            }
            
    except Exception as e:
        logger.error(f"SMTP connection test failed: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }