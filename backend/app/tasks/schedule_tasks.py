"""
Celery tasks for schedule management and execution
"""

import asyncio
import os
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import uuid
import logging
from pathlib import Path

from celery import shared_task
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
import pytz

from app.core.config import settings
from app.models.schedule import ExportSchedule, ScheduleExecution
from app.models.export import Export
from app.models.report import Report
from app.services.export_service import ExportService
from app.services.distribution_service import DistributionService
from app.tasks.task_config import get_task_retry_delay

logger = logging.getLogger(__name__)

# Create async engine for Celery tasks
engine = create_async_engine(str(settings.DATABASE_URL), echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db_session():
    """Get database session for Celery tasks"""
    async with AsyncSessionLocal() as session:
        yield session


@shared_task(name="app.tasks.schedule_tasks.check_and_execute_schedules")
def check_and_execute_schedules():
    """
    Check all active schedules and execute those that are due.
    This task runs every minute via Celery Beat.
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    result = loop.run_until_complete(_check_and_execute_schedules())
    loop.close()
    return result


async def _check_and_execute_schedules():
    """Async implementation of schedule checking"""
    async with AsyncSessionLocal() as db:
        try:
            # Find all active schedules that should run now
            now = datetime.now(pytz.UTC)
            
            # Query for schedules that are due
            query = select(ExportSchedule).where(
                and_(
                    ExportSchedule.is_active == True,
                    ExportSchedule.is_paused == False,
                    or_(
                        ExportSchedule.next_run <= now,
                        ExportSchedule.next_run.is_(None)  # Never run before
                    )
                )
            )
            
            result = await db.execute(query)
            schedules = result.scalars().all()
            
            executed_count = 0
            for schedule in schedules:
                # Calculate next run if not set
                if not schedule.next_run:
                    schedule.next_run = schedule.calculate_next_run()
                    await db.commit()
                    
                # Check if it's time to run
                if schedule.should_run_now():
                    # Queue the execution task
                    execute_scheduled_export.delay(str(schedule.id))
                    executed_count += 1
                    
                    # Update next run time
                    schedule.next_run = schedule.calculate_next_run(from_time=now)
                    await db.commit()
            
            logger.info(f"Checked {len(schedules)} schedules, executed {executed_count}")
            return {"checked": len(schedules), "executed": executed_count}
            
        except Exception as e:
            logger.error(f"Error checking schedules: {str(e)}")
            return {"error": str(e)}


@shared_task(name="app.tasks.schedule_tasks.execute_scheduled_export", bind=True)
def execute_scheduled_export(self, schedule_id: str):
    """
    Execute a scheduled export job.
    This creates an export and distributes it according to the schedule configuration.
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        result = loop.run_until_complete(_execute_scheduled_export(schedule_id, self.request.id))
        return result
    except Exception as e:
        logger.error(f"Error executing scheduled export {schedule_id}: {str(e)}")
        # Retry with exponential backoff and jitter
        retry_delay = get_task_retry_delay(self.request.retries)
        raise self.retry(exc=e, countdown=retry_delay)
    finally:
        loop.close()


async def _execute_scheduled_export(schedule_id: str, task_id: str) -> Dict[str, Any]:
    """Async implementation of scheduled export execution"""
    async with AsyncSessionLocal() as db:
        execution = None
        try:
            # Get the schedule
            schedule = await db.get(ExportSchedule, schedule_id)
            if not schedule:
                raise ValueError(f"Schedule {schedule_id} not found")
            
            # Create execution record
            execution = ScheduleExecution(
                schedule_id=schedule_id,
                started_at=datetime.now(pytz.UTC),
                status="running",
                task_id=task_id
            )
            db.add(execution)
            await db.commit()
            
            # Get the report
            report = await db.get(Report, schedule.report_id)
            if not report:
                raise ValueError(f"Report {schedule.report_id} not found")
            
            # Create export configuration
            export_config = schedule.export_config or {}
            export_format = export_config.get("format", "excel")
            
            # Create export record
            export_id = str(uuid.uuid4())
            export = Export(
                id=export_id,
                report_id=schedule.report_id,
                user_id=schedule.user_id,
                format=export_format,
                status="processing",
                options=export_config.get("options", {}),
                filters=schedule.filter_config or {},
                created_at=datetime.utcnow(),
                expires_at=datetime.utcnow() + timedelta(days=30),  # Longer retention for scheduled exports
                is_scheduled=True,
                schedule_id=schedule_id
            )
            db.add(export)
            await db.commit()
            
            # Execute the export
            export_service = ExportService(db)
            export_result = await export_service.process_export(export_id, schedule.user_id)
            
            if not export_result.get("success"):
                raise Exception(export_result.get("error", "Export failed"))
            
            # Distribute the export
            distribution_service = DistributionService(db)
            distribution_results = await distribution_service.distribute(
                export_id=export_id,
                config=schedule.distribution_config,
                schedule_name=schedule.name,
                report_name=report.name
            )
            
            # Update execution record
            execution.mark_success(
                export_id=export_id,
                distribution_results=distribution_results
            )
            
            # Update schedule statistics
            schedule.update_after_execution(success=True)
            
            await db.commit()
            
            logger.info(f"Successfully executed schedule {schedule_id}, export {export_id}")
            return {
                "success": True,
                "export_id": export_id,
                "distribution_results": distribution_results
            }
            
        except Exception as e:
            logger.error(f"Error in scheduled export execution: {str(e)}")
            
            if execution:
                execution.mark_failed(
                    error_message=str(e),
                    distribution_results={"error": str(e)}
                )
            
            if schedule:
                schedule.update_after_execution(success=False)
            
            await db.commit()
            
            return {
                "success": False,
                "error": str(e)
            }


@shared_task(name="app.tasks.schedule_tasks.update_next_run_times")
def update_next_run_times():
    """
    Update next run times for all active schedules.
    This ensures schedules stay in sync even if the system was down.
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    result = loop.run_until_complete(_update_next_run_times())
    loop.close()
    return result


async def _update_next_run_times():
    """Async implementation of updating next run times"""
    async with AsyncSessionLocal() as db:
        try:
            # Get all active schedules
            query = select(ExportSchedule).where(
                and_(
                    ExportSchedule.is_active == True,
                    ExportSchedule.is_paused == False
                )
            )
            
            result = await db.execute(query)
            schedules = result.scalars().all()
            
            updated_count = 0
            for schedule in schedules:
                old_next_run = schedule.next_run
                new_next_run = schedule.calculate_next_run()
                
                if old_next_run != new_next_run:
                    schedule.next_run = new_next_run
                    updated_count += 1
            
            await db.commit()
            
            logger.info(f"Updated {updated_count} schedule next run times")
            return {"updated": updated_count, "total": len(schedules)}
            
        except Exception as e:
            logger.error(f"Error updating next run times: {str(e)}")
            return {"error": str(e)}


@shared_task(name="app.tasks.schedule_tasks.test_schedule_configuration")
def test_schedule_configuration(schedule_config: Dict[str, Any], distribution_config: Dict[str, Any]):
    """
    Test a schedule configuration to verify it's valid.
    Returns next 5 run times and distribution channel test results.
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    result = loop.run_until_complete(_test_schedule_configuration(schedule_config, distribution_config))
    loop.close()
    return result


async def _test_schedule_configuration(schedule_config: Dict[str, Any], distribution_config: Dict[str, Any]):
    """Async implementation of schedule configuration testing"""
    try:
        from croniter import croniter
        
        # Test cron expression
        cron_expr = schedule_config.get("cron")
        timezone_str = schedule_config.get("timezone", "UTC")
        
        if not cron_expr:
            return {
                "valid": False,
                "errors": ["No cron expression provided"]
            }
        
        # Calculate next 5 runs
        tz = pytz.timezone(timezone_str)
        base_time = datetime.now(tz)
        cron = croniter(cron_expr, base_time)
        
        next_runs = []
        for _ in range(5):
            next_run = cron.get_next(datetime)
            next_runs.append(next_run)
        
        # Test distribution channels
        distribution_results = {}
        
        if "local" in distribution_config:
            # Test local storage
            local_config = distribution_config["local"]
            base_path = local_config.get("base_path", "/exports/scheduled")
            path = Path(base_path)
            
            distribution_results["local"] = {
                "valid": True,
                "writable": path.exists() and os.access(path, os.W_OK),
                "path": str(path)
            }
        
        # Add tests for other distribution channels as they're implemented
        
        return {
            "valid": True,
            "next_runs": [dt.isoformat() for dt in next_runs],
            "distribution_test": distribution_results,
            "warnings": [],
            "errors": []
        }
        
    except Exception as e:
        return {
            "valid": False,
            "next_runs": [],
            "distribution_test": {},
            "warnings": [],
            "errors": [str(e)]
        }