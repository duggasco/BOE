"""
Distribution service for handling export delivery to various channels
"""

import os
import shutil
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.export import Export
from app.core.config import settings

logger = logging.getLogger(__name__)


class DistributionService:
    """Service for distributing exports to various channels"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        
    async def distribute(
        self,
        export_id: str,
        config: Dict[str, Any],
        schedule_name: str = "",
        report_name: str = ""
    ) -> Dict[str, Any]:
        """
        Distribute an export according to the configuration.
        Returns results for each distribution channel.
        """
        results = {}
        
        # Get the export
        export = await self.db.get(Export, export_id)
        if not export or not export.file_path:
            return {"error": "Export not found or file not available"}
        
        # Construct source file path
        source_path = Path(settings.EXPORT_DIR) / export.file_path
        if not source_path.exists():
            return {"error": f"Export file not found: {source_path}"}
        
        # Process each distribution channel
        if "local" in config:
            results["local"] = await self._distribute_local(
                source_path, 
                config["local"],
                export,
                schedule_name,
                report_name
            )
        
        if "email" in config:
            results["email"] = await self._distribute_email(
                source_path,
                config["email"],
                export,
                schedule_name,
                report_name
            )
        
        if "webhook" in config:
            results["webhook"] = await self._distribute_webhook(
                source_path,
                config["webhook"],
                export,
                schedule_name,
                report_name
            )
        
        # Note: SFTP and Cloud storage will be implemented later
        
        return results
    
    async def _distribute_local(
        self,
        source_path: Path,
        config: Dict[str, Any],
        export: Export,
        schedule_name: str,
        report_name: str
    ) -> Dict[str, Any]:
        """
        Distribute export to local file system.
        Organizes files in a structured directory hierarchy.
        """
        try:
            # Get configuration
            base_path = config.get("base_path", "/exports/scheduled")
            create_subdirs = config.get("create_subdirs", True)
            filename_pattern = config.get("filename_pattern", "{report_name}_{timestamp}.{format}")
            overwrite = config.get("overwrite", False)
            
            # Create base directory if it doesn't exist
            base_dir = Path(base_path)
            base_dir.mkdir(parents=True, exist_ok=True)
            
            # Create subdirectories if requested
            if create_subdirs:
                # Organize by year/month/day
                now = datetime.now()
                subdir = base_dir / str(now.year) / f"{now.month:02d}" / f"{now.day:02d}"
                subdir.mkdir(parents=True, exist_ok=True)
                target_dir = subdir
            else:
                target_dir = base_dir
            
            # Generate filename from pattern
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = filename_pattern.format(
                report_name=report_name.replace(" ", "_"),
                schedule_name=schedule_name.replace(" ", "_"),
                timestamp=timestamp,
                format=export.format,
                date=datetime.now().strftime("%Y-%m-%d")
            )
            
            # Ensure filename is safe
            filename = "".join(c for c in filename if c.isalnum() or c in "._-")
            
            # Construct target path
            target_path = target_dir / filename
            
            # Check if file exists and handle accordingly
            if target_path.exists() and not overwrite:
                # Add counter to filename
                counter = 1
                base_name = target_path.stem
                extension = target_path.suffix
                while target_path.exists():
                    new_name = f"{base_name}_{counter}{extension}"
                    target_path = target_dir / new_name
                    counter += 1
            
            # Copy file to target location
            shutil.copy2(source_path, target_path)
            
            # Set appropriate permissions
            os.chmod(target_path, 0o644)
            
            logger.info(f"Successfully distributed export to local storage: {target_path}")
            
            return {
                "status": "success",
                "path": str(target_path),
                "size": target_path.stat().st_size,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error distributing to local storage: {str(e)}")
            return {
                "status": "failed",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    async def _distribute_email(
        self,
        source_path: Path,
        config: Dict[str, Any],
        export: Export,
        schedule_name: str,
        report_name: str
    ) -> Dict[str, Any]:
        """
        Distribute export via email.
        This is a placeholder for email distribution implementation.
        """
        try:
            # Email implementation will be added in Phase 5.2
            recipients = config.get("recipients", [])
            subject = config.get("subject", "Scheduled Report").format(
                report_name=report_name,
                schedule_name=schedule_name,
                date=datetime.now().strftime("%Y-%m-%d")
            )
            
            logger.info(f"Email distribution placeholder: Would send to {recipients} with subject '{subject}'")
            
            return {
                "status": "pending",
                "message": "Email distribution not yet implemented",
                "recipients": recipients,
                "subject": subject,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error in email distribution: {str(e)}")
            return {
                "status": "failed",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    async def _distribute_webhook(
        self,
        source_path: Path,
        config: Dict[str, Any],
        export: Export,
        schedule_name: str,
        report_name: str
    ) -> Dict[str, Any]:
        """
        Distribute export via webhook.
        This is a placeholder for webhook distribution implementation.
        """
        try:
            # Webhook implementation will be added later
            url = config.get("url")
            method = config.get("method", "POST")
            
            logger.info(f"Webhook distribution placeholder: Would {method} to {url}")
            
            return {
                "status": "pending",
                "message": "Webhook distribution not yet implemented",
                "url": url,
                "method": method,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error in webhook distribution: {str(e)}")
            return {
                "status": "failed",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    async def test_distribution_channel(
        self,
        channel_type: str,
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Test a distribution channel configuration.
        Returns validation results without actually distributing anything.
        """
        if channel_type == "local":
            return await self._test_local_distribution(config)
        elif channel_type == "email":
            return await self._test_email_distribution(config)
        elif channel_type == "webhook":
            return await self._test_webhook_distribution(config)
        else:
            return {
                "valid": False,
                "error": f"Unknown distribution channel: {channel_type}"
            }
    
    async def _test_local_distribution(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test local file system distribution configuration"""
        try:
            base_path = config.get("base_path", "/exports/scheduled")
            base_dir = Path(base_path)
            
            # Check if directory exists and is writable
            if base_dir.exists():
                if os.access(base_dir, os.W_OK):
                    return {
                        "valid": True,
                        "writable": True,
                        "path": str(base_dir),
                        "message": "Directory exists and is writable"
                    }
                else:
                    return {
                        "valid": False,
                        "writable": False,
                        "path": str(base_dir),
                        "error": "Directory exists but is not writable"
                    }
            else:
                # Try to create the directory
                try:
                    base_dir.mkdir(parents=True, exist_ok=True)
                    return {
                        "valid": True,
                        "writable": True,
                        "path": str(base_dir),
                        "message": "Directory created successfully"
                    }
                except Exception as e:
                    return {
                        "valid": False,
                        "writable": False,
                        "path": str(base_dir),
                        "error": f"Cannot create directory: {str(e)}"
                    }
                    
        except Exception as e:
            return {
                "valid": False,
                "error": str(e)
            }
    
    async def _test_email_distribution(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test email distribution configuration"""
        recipients = config.get("recipients", [])
        
        if not recipients:
            return {
                "valid": False,
                "error": "No recipients specified"
            }
        
        # Basic email validation
        import re
        email_pattern = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
        
        invalid_emails = [email for email in recipients if not email_pattern.match(email)]
        
        if invalid_emails:
            return {
                "valid": False,
                "error": f"Invalid email addresses: {', '.join(invalid_emails)}"
            }
        
        return {
            "valid": True,
            "message": f"Configuration valid for {len(recipients)} recipients"
        }
    
    async def _test_webhook_distribution(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test webhook distribution configuration"""
        url = config.get("url")
        
        if not url:
            return {
                "valid": False,
                "error": "No webhook URL specified"
            }
        
        # Basic URL validation
        import re
        url_pattern = re.compile(
            r'^https?://'  # http:// or https://
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
            r'localhost|'  # localhost...
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
            r'(?::\d+)?'  # optional port
            r'(?:/?|[/?]\S+)$', re.IGNORECASE)
        
        if not url_pattern.match(url):
            return {
                "valid": False,
                "error": "Invalid webhook URL format"
            }
        
        return {
            "valid": True,
            "url": url,
            "message": "Webhook configuration valid"
        }