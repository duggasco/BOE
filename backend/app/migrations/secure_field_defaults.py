"""
Migration to make field access secure by default
"""

from alembic import op
import sqlalchemy as sa

def upgrade():
    """Make is_restricted default to True for secure-by-default"""
    # Change the default value in the database
    op.alter_column('fields', 'is_restricted',
                    existing_type=sa.Boolean(),
                    server_default=sa.text('true'),
                    nullable=False)
    
    # Update existing NULL values to False (to preserve current behavior)
    op.execute("UPDATE fields SET is_restricted = false WHERE is_restricted IS NULL")

def downgrade():
    """Revert to insecure defaults"""
    op.alter_column('fields', 'is_restricted',
                    existing_type=sa.Boolean(),
                    server_default=sa.text('false'),
                    nullable=True)