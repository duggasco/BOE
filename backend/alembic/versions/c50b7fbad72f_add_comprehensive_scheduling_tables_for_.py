"""Add comprehensive scheduling tables for Phase 5

Revision ID: c50b7fbad72f
Revises: b6ba69b48173
Create Date: 2025-08-08 19:39:07.952658

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c50b7fbad72f'
down_revision: Union[str, None] = 'b6ba69b48173'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create export_schedules table
    op.create_table('export_schedules',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('report_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        
        # Schedule configuration
        sa.Column('schedule_config', sa.JSON(), nullable=False),  # Contains cron expression, timezone
        sa.Column('distribution_config', sa.JSON(), nullable=False),  # Distribution channels and settings
        sa.Column('filter_config', sa.JSON(), nullable=True),  # Report filters/parameters
        sa.Column('export_config', sa.JSON(), nullable=True),  # Format, options
        
        # Status fields
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_paused', sa.Boolean(), server_default='false', nullable=False),
        
        # Execution tracking
        sa.Column('last_run', sa.DateTime(timezone=True), nullable=True),
        sa.Column('next_run', sa.DateTime(timezone=True), nullable=True),
        sa.Column('run_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('success_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('failure_count', sa.Integer(), server_default='0', nullable=False),
        
        # Metadata
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=False),
        
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['report_id'], ['reports.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_export_schedules_is_active'), 'export_schedules', ['is_active'])
    op.create_index(op.f('ix_export_schedules_next_run'), 'export_schedules', ['next_run'])
    op.create_index(op.f('ix_export_schedules_user_id'), 'export_schedules', ['user_id'])
    
    # Create schedule_executions table
    op.create_table('schedule_executions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('schedule_id', sa.UUID(), nullable=False),
        sa.Column('export_id', sa.UUID(), nullable=True),  # Links to exports table if successful
        
        # Execution details
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(50), nullable=False),  # pending, running, success, failed, cancelled
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('retry_count', sa.Integer(), server_default='0', nullable=False),
        
        # Distribution results (JSON for flexibility)
        sa.Column('distribution_results', sa.JSON(), nullable=True),  # Track each channel's result
        
        # Celery task tracking
        sa.Column('task_id', sa.String(), nullable=True),  # Celery task ID for monitoring
        
        sa.ForeignKeyConstraint(['export_id'], ['exports.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['schedule_id'], ['export_schedules.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_schedule_executions_schedule_id'), 'schedule_executions', ['schedule_id'])
    op.create_index(op.f('ix_schedule_executions_started_at'), 'schedule_executions', ['started_at'])
    op.create_index(op.f('ix_schedule_executions_status'), 'schedule_executions', ['status'])
    
    # Create distribution_templates table for reusable distribution configs
    op.create_table('distribution_templates',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),  # email, sftp, webhook, cloud, local
        sa.Column('config', sa.JSON(), nullable=False),  # Type-specific configuration
        sa.Column('is_default', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_distribution_templates_user_id'), 'distribution_templates', ['user_id'])
    op.create_index(op.f('ix_distribution_templates_type'), 'distribution_templates', ['type'])


def downgrade() -> None:
    op.drop_index(op.f('ix_distribution_templates_type'), table_name='distribution_templates')
    op.drop_index(op.f('ix_distribution_templates_user_id'), table_name='distribution_templates')
    op.drop_table('distribution_templates')
    
    op.drop_index(op.f('ix_schedule_executions_status'), table_name='schedule_executions')
    op.drop_index(op.f('ix_schedule_executions_started_at'), table_name='schedule_executions')
    op.drop_index(op.f('ix_schedule_executions_schedule_id'), table_name='schedule_executions')
    op.drop_table('schedule_executions')
    
    op.drop_index(op.f('ix_export_schedules_user_id'), table_name='export_schedules')
    op.drop_index(op.f('ix_export_schedules_next_run'), table_name='export_schedules')
    op.drop_index(op.f('ix_export_schedules_is_active'), table_name='export_schedules')
    op.drop_table('export_schedules')
