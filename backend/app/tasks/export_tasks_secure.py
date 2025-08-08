"""
Celery tasks for report exports - SECURE VERSION
Only stores filenames, not full paths
"""
import os
import csv
import json
import tempfile
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from pathlib import Path
import uuid

import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils.dataframe import dataframe_to_rows
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from celery import Task
from celery.utils.log import get_task_logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.celery_app import celery_app
from app.core.database import async_session_maker
from app.models.report import Report, ReportExecution
from app.models.user import User
from app.services.query_builder import QueryBuilder
from app.services.report_service import ReportService
from app.core.config import settings

logger = get_task_logger(__name__)

# Secure export directory
EXPORT_DIR = Path(settings.EXPORT_STORAGE_PATH if hasattr(settings, 'EXPORT_STORAGE_PATH') else "/tmp/exports")
EXPORT_DIR.mkdir(parents=True, exist_ok=True)


class ExportTask(Task):
    """Base class for export tasks with common functionality."""
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Handle task failure."""
        logger.error(f"Export task {task_id} failed: {exc}")
        # Update execution status in database
        execution_id = kwargs.get("execution_id")
        if execution_id:
            # This would need to be implemented with proper async handling
            pass
    
    def on_success(self, retval, task_id, args, kwargs):
        """Handle task success."""
        logger.info(f"Export task {task_id} completed successfully")


def execute_report_query_sync(report_id: str, parameters: Optional[Dict] = None) -> List[Dict]:
    """
    Execute report query synchronously (simplified for this implementation)
    In production, this would use async database operations
    """
    # Mock data for demonstration - replace with actual query execution
    return [
        {"fund_name": "Growth Fund A", "return_1y": 12.5, "aum": 1500000000},
        {"fund_name": "Value Fund B", "return_1y": 8.3, "aum": 2300000000},
        {"fund_name": "Tech Fund C", "return_1y": 18.7, "aum": 890000000},
    ]


@celery_app.task(base=ExportTask, bind=True, name="export.csv.secure")
def generate_csv_export(
    self,
    export_id: str,
    report_id: str,
    filename: str,  # Secure filename passed from router
    filters: Optional[Dict[str, Any]] = None,
    options: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Export report data to CSV format - SECURE VERSION
    
    Args:
        export_id: ID of the export record
        report_id: ID of the report to export
        filename: Secure filename to use (no path, just filename)
        filters: Report filters
        options: Export options (delimiter, encoding, etc.)
    
    Returns:
        Dict with export status and filename (not full path)
    """
    try:
        logger.info(f"Starting CSV export for report {report_id}")
        
        # Validate filename doesn't contain path traversal characters
        if '/' in filename or '\\' in filename or '..' in filename:
            raise ValueError("Invalid filename - security violation")
        
        # Default options
        options = options or {}
        delimiter = options.get("delimiter", ",")
        encoding = options.get("encoding", "utf-8")
        include_headers = options.get("include_headers", True)
        
        # Construct secure file path
        filepath = EXPORT_DIR / filename
        
        # Ensure we're still within EXPORT_DIR
        try:
            filepath.resolve().relative_to(EXPORT_DIR.resolve())
        except ValueError:
            raise ValueError("Security violation - path traversal attempt")
        
        # Execute report query
        data = execute_report_query_sync(report_id, filters)
        
        # Write CSV file
        with open(filepath, 'w', newline='', encoding=encoding) as csvfile:
            if not data:
                # Empty result
                csvfile.write("No data available\n")
            else:
                # Get column names from first row
                columns = list(data[0].keys()) if data else []
                
                writer = csv.DictWriter(
                    csvfile,
                    fieldnames=columns,
                    delimiter=delimiter
                )
                
                if include_headers:
                    writer.writeheader()
                
                writer.writerows(data)
        
        # Get file size
        file_size = os.path.getsize(filepath)
        
        # Update task progress
        self.update_state(
            state='SUCCESS',
            meta={
                'current': 100,
                'total': 100,
                'status': 'Export completed',
                'filename': filename  # Only return filename, not path
            }
        )
        
        logger.info(f"CSV export completed: {filename}")
        
        return {
            "status": "success",
            "filename": filename,  # Only filename, not full path
            "file_size": file_size,
            "rows": len(data)
        }
        
    except Exception as e:
        logger.error(f"CSV export failed: {str(e)}")
        raise


@celery_app.task(base=ExportTask, bind=True, name="export.excel.secure")
def generate_excel_export(
    self,
    export_id: str,
    report_id: str,
    filename: str,  # Secure filename passed from router
    filters: Optional[Dict[str, Any]] = None,
    options: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Export report data to Excel format - SECURE VERSION
    """
    try:
        logger.info(f"Starting Excel export for report {report_id}")
        
        # Validate filename
        if '/' in filename or '\\' in filename or '..' in filename:
            raise ValueError("Invalid filename - security violation")
        
        # Default options
        options = options or {}
        include_formatting = options.get("include_formatting", True)
        freeze_headers = options.get("freeze_headers", True)
        auto_filter = options.get("auto_filter", True)
        
        # Construct secure file path
        filepath = EXPORT_DIR / filename
        
        # Security check
        try:
            filepath.resolve().relative_to(EXPORT_DIR.resolve())
        except ValueError:
            raise ValueError("Security violation - path traversal attempt")
        
        # Execute report query
        data = execute_report_query_sync(report_id, filters)
        
        # Create DataFrame
        df = pd.DataFrame(data) if data else pd.DataFrame()
        
        # Create Excel writer
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            # Write main data
            df.to_excel(writer, sheet_name='Report Data', index=False)
            
            # Get the workbook and worksheet
            workbook = writer.book
            worksheet = writer.sheets['Report Data']
            
            if include_formatting and not df.empty:
                # Format headers
                header_font = Font(bold=True, color="FFFFFF")
                header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
                header_alignment = Alignment(horizontal="center", vertical="center")
                
                for cell in worksheet[1]:
                    cell.font = header_font
                    cell.fill = header_fill
                    cell.alignment = header_alignment
                
                # Auto-adjust column widths
                for column in worksheet.columns:
                    max_length = 0
                    column_letter = column[0].column_letter
                    for cell in column:
                        try:
                            if len(str(cell.value)) > max_length:
                                max_length = len(str(cell.value))
                        except:
                            pass
                    adjusted_width = min(max_length + 2, 50)
                    worksheet.column_dimensions[column_letter].width = adjusted_width
                
                # Freeze headers
                if freeze_headers:
                    worksheet.freeze_panes = 'A2'
                
                # Add auto-filter
                if auto_filter and len(df) > 0:
                    worksheet.auto_filter.ref = worksheet.dimensions
            
            # Add metadata sheet
            metadata = {
                "Report ID": report_id,
                "Export Date": datetime.utcnow().isoformat(),
                "Total Rows": len(df),
                "Total Columns": len(df.columns) if not df.empty else 0,
                "Filters Applied": json.dumps(filters) if filters else "None"
            }
            
            metadata_df = pd.DataFrame(list(metadata.items()), columns=['Property', 'Value'])
            metadata_df.to_excel(writer, sheet_name='Metadata', index=False)
            
            # Format metadata sheet
            meta_worksheet = writer.sheets['Metadata']
            for cell in meta_worksheet[1]:
                cell.font = Font(bold=True)
        
        # Get file size
        file_size = os.path.getsize(filepath)
        
        logger.info(f"Excel export completed: {filename}")
        
        return {
            "status": "success",
            "filename": filename,  # Only filename
            "file_size": file_size,
            "rows": len(data)
        }
        
    except Exception as e:
        logger.error(f"Excel export failed: {str(e)}")
        raise


@celery_app.task(base=ExportTask, bind=True, name="export.pdf.secure")
def generate_pdf_export(
    self,
    export_id: str,
    report_id: str,
    filename: str,  # Secure filename passed from router
    filters: Optional[Dict[str, Any]] = None,
    options: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Export report data to PDF format - SECURE VERSION
    """
    try:
        logger.info(f"Starting PDF export for report {report_id}")
        
        # Validate filename
        if '/' in filename or '\\' in filename or '..' in filename:
            raise ValueError("Invalid filename - security violation")
        
        # Default options
        options = options or {}
        page_size = A4 if options.get("page_size") == "A4" else letter
        include_header = options.get("include_header", True)
        include_footer = options.get("include_footer", True)
        
        # Construct secure file path
        filepath = EXPORT_DIR / filename
        
        # Security check
        try:
            filepath.resolve().relative_to(EXPORT_DIR.resolve())
        except ValueError:
            raise ValueError("Security violation - path traversal attempt")
        
        # Execute report query
        data = execute_report_query_sync(report_id, filters)
        
        # Create PDF document
        doc = SimpleDocTemplate(
            str(filepath),
            pagesize=page_size,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=18,
        )
        
        # Container for the 'Flowable' objects
        elements = []
        
        # Define styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1a1f2e'),
            spaceAfter=30,
            alignment=TA_CENTER
        )
        
        # Add title
        if include_header:
            title = Paragraph(f"Report Export - {report_id}", title_style)
            elements.append(title)
            elements.append(Spacer(1, 12))
            
            # Add export info
            export_info = Paragraph(
                f"Generated on: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}",
                styles['Normal']
            )
            elements.append(export_info)
            elements.append(Spacer(1, 12))
        
        # Create table from data
        if data:
            # Prepare table data
            table_data = []
            
            # Headers
            headers = list(data[0].keys())
            table_data.append(headers)
            
            # Data rows
            for row in data:
                table_data.append([str(row.get(h, '')) for h in headers])
            
            # Create table
            table = Table(table_data)
            
            # Add style to table
            table.setStyle(TableStyle([
                # Header style
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#366092')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 14),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                
                # Data style
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 10),
                ('ALIGN', (0, 1), (-1, -1), 'LEFT'),
                
                # Alternating row colors
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey])
            ]))
            
            elements.append(table)
        else:
            # No data message
            no_data = Paragraph("No data available for export", styles['Normal'])
            elements.append(no_data)
        
        # Add footer
        if include_footer:
            elements.append(Spacer(1, 24))
            footer = Paragraph(
                f"Total Records: {len(data) if data else 0}",
                styles['Normal']
            )
            elements.append(footer)
        
        # Build PDF
        doc.build(elements)
        
        # Get file size
        file_size = os.path.getsize(filepath)
        
        logger.info(f"PDF export completed: {filename}")
        
        return {
            "status": "success",
            "filename": filename,  # Only filename
            "file_size": file_size,
            "rows": len(data) if data else 0
        }
        
    except Exception as e:
        logger.error(f"PDF export failed: {str(e)}")
        raise


# Cleanup task for expired exports
@celery_app.task(name="cleanup.expired.exports")
def cleanup_expired_exports_task():
    """
    Clean up expired export files
    This should be scheduled to run hourly
    """
    import asyncio
    
    async def cleanup():
        async with async_session_maker() as db:
            from app.models import Export
            from sqlalchemy import select, and_
            
            # Find expired exports
            result = await db.execute(
                select(Export).where(
                    and_(
                        Export.expires_at != None,
                        Export.expires_at < datetime.utcnow()
                    )
                )
            )
            expired_exports = result.scalars().all()
            
            deleted_count = 0
            for export in expired_exports:
                if export.file_path:
                    try:
                        # Only use filename, not full path
                        filename = os.path.basename(export.file_path)
                        if '/' not in filename and '\\' not in filename and '..' not in filename:
                            filepath = EXPORT_DIR / filename
                            # Verify path is within EXPORT_DIR
                            filepath.resolve().relative_to(EXPORT_DIR.resolve())
                            
                            if filepath.exists():
                                filepath.unlink()
                                deleted_count += 1
                    except Exception as e:
                        logger.error(f"Failed to delete expired file: {e}")
                
                # Delete database record
                await db.delete(export)
            
            await db.commit()
            logger.info(f"Cleaned up {deleted_count} expired exports")
            return deleted_count
    
    # Run async cleanup
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(cleanup())
        return {"deleted_count": result}
    finally:
        loop.close()