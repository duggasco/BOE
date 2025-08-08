"""
Celery application configuration for async tasks.
"""
from celery import Celery
from app.core.config import settings

# Create Celery instance
celery_app = Celery(
    "boe_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.export_tasks",
        "app.tasks.schedule_tasks",
        "app.tasks.email_tasks"
    ]
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes
    task_soft_time_limit=25 * 60,  # 25 minutes
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
    result_expires=3600,  # 1 hour
    beat_schedule={
        # Scheduled tasks can be defined here
        "cleanup-old-exports": {
            "task": "app.tasks.export_tasks.cleanup_old_exports",
            "schedule": 3600.0,  # Every hour
        },
    },
    # Task routing
    task_routes={
        "app.tasks.export_tasks.*": {"queue": "exports"},
        "app.tasks.schedule_tasks.*": {"queue": "schedules"},
        "app.tasks.email_tasks.*": {"queue": "emails"},
    },
    # Task priority
    task_default_priority=5,
    task_inherit_parent_priority=True,
    # Worker configuration
    worker_send_task_events=True,
    task_send_sent_event=True,
)