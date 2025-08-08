"""
Seed data script for populating the database with test data
"""

import asyncio
import json
from datetime import datetime, timedelta
from uuid import uuid4
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, engine
from app.models.user import User, Group, Role, Permission
from app.models.field import DataSource, DataTable, Field, FieldRelationship, FieldType, AggregationType
from app.models.report import Report, ReportType, Folder

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def create_permissions(db: AsyncSession):
    """Create standard permissions"""
    resources = ['reports', 'users', 'fields', 'schedules', 'admin']
    actions = ['create', 'read', 'update', 'delete', 'execute']
    
    permissions = []
    for resource in resources:
        for action in actions:
            permission = Permission(
                resource=resource,
                action=action,
                description=f"Can {action} {resource}"
            )
            permissions.append(permission)
    
    db.add_all(permissions)
    await db.commit()
    return permissions


async def create_roles(db: AsyncSession, permissions):
    """Create standard roles with permissions"""
    
    # Admin role - all permissions
    admin_role = Role(
        name="Administrator",
        description="Full system access",
        is_system=True
    )
    admin_role.permissions = permissions
    
    # Report Creator role
    report_creator_role = Role(
        name="Report Creator",
        description="Can create and manage reports",
        is_system=True
    )
    report_creator_perms = [p for p in permissions if p.resource in ['reports', 'fields'] and p.action in ['create', 'read', 'update', 'execute']]
    report_creator_role.permissions = report_creator_perms
    
    # Report Viewer role
    viewer_role = Role(
        name="Report Viewer",
        description="Can view and execute reports",
        is_system=True
    )
    viewer_perms = [p for p in permissions if p.resource in ['reports', 'fields'] and p.action in ['read', 'execute']]
    viewer_role.permissions = viewer_perms
    
    roles = [admin_role, report_creator_role, viewer_role]
    db.add_all(roles)
    await db.commit()
    return roles


async def create_groups(db: AsyncSession, roles):
    """Create standard groups"""
    
    # Admin group
    admin_group = Group(
        name="Administrators",
        description="System administrators"
    )
    admin_group.roles = [roles[0]]  # Admin role
    
    # Report Creators group
    creators_group = Group(
        name="Report Creators",
        description="Users who can create reports"
    )
    creators_group.roles = [roles[1]]  # Report Creator role
    
    # Report Viewers group
    viewers_group = Group(
        name="Report Viewers",
        description="Users who can view reports"
    )
    viewers_group.roles = [roles[2]]  # Viewer role
    
    groups = [admin_group, creators_group, viewers_group]
    db.add_all(groups)
    await db.commit()
    return groups


async def create_users(db: AsyncSession, groups):
    """Create test users"""
    
    users = []
    
    # Admin user
    admin_user = User(
        email="admin@boe-system.local",
        username="admin",
        full_name="System Administrator",
        hashed_password=pwd_context.hash("admin123"),
        is_active=True,
        is_superuser=True
    )
    admin_user.groups = [groups[0]]  # Admin group
    users.append(admin_user)
    
    # Report creator user
    creator_user = User(
        email="creator@boe-system.local",
        username="creator",
        full_name="Report Creator",
        hashed_password=pwd_context.hash("creator123"),
        is_active=True,
        is_superuser=False
    )
    creator_user.groups = [groups[1]]  # Creators group
    users.append(creator_user)
    
    # Report viewer user
    viewer_user = User(
        email="viewer@boe-system.local",
        username="viewer",
        full_name="Report Viewer",
        hashed_password=pwd_context.hash("viewer123"),
        is_active=True,
        is_superuser=False
    )
    viewer_user.groups = [groups[2]]  # Viewers group
    users.append(viewer_user)
    
    # Additional test users
    for i in range(1, 6):
        user = User(
            email=f"user{i}@boe-system.local",
            username=f"user{i}",
            full_name=f"Test User {i}",
            hashed_password=pwd_context.hash(f"password{i}"),
            is_active=True,
            is_superuser=False
        )
        user.groups = [groups[2]]  # Default to viewers group
        users.append(user)
    
    db.add_all(users)
    await db.commit()
    return users


async def create_data_sources(db: AsyncSession):
    """Create test data sources"""
    
    # Main data source
    main_ds = DataSource(
        name="Main Database",
        description="Primary business data warehouse",
        connection_type="postgresql",
        connection_string="postgresql://boe_user:boe_password@localhost:5432/boe_data",
        is_active=True
    )
    
    # Analytics data source
    analytics_ds = DataSource(
        name="Analytics Database",
        description="Analytics and reporting database",
        connection_type="postgresql",
        connection_string="postgresql://analytics_user:analytics_password@localhost:5432/analytics",
        is_active=True
    )
    
    data_sources = [main_ds, analytics_ds]
    db.add_all(data_sources)
    await db.commit()
    return data_sources


async def create_data_tables(db: AsyncSession, data_sources):
    """Create test data tables"""
    
    tables = []
    
    # Fund tables
    fund_table = DataTable(
        table_name="funds",
        schema_name="public",
        data_source_id=data_sources[0].id,
        alias="Funds",
        description="Fund master data"
    )
    tables.append(fund_table)
    
    # Time series table
    ts_table = DataTable(
        table_name="fund_time_series",
        schema_name="public",
        data_source_id=data_sources[0].id,
        alias="Fund Time Series",
        description="Fund performance time series"
    )
    tables.append(ts_table)
    
    # Benchmark table
    benchmark_table = DataTable(
        table_name="benchmarks",
        schema_name="public",
        data_source_id=data_sources[0].id,
        alias="Benchmarks",
        description="Benchmark indices"
    )
    tables.append(benchmark_table)
    
    # Transaction table
    transaction_table = DataTable(
        table_name="transactions",
        schema_name="public",
        data_source_id=data_sources[0].id,
        alias="Transactions",
        description="Transaction history"
    )
    tables.append(transaction_table)
    
    db.add_all(tables)
    await db.commit()
    return tables


async def create_fields(db: AsyncSession, tables):
    """Create test fields"""
    
    fields = []
    
    # Fund fields
    fund_fields = [
        Field(
            column_name="fund_id",
            display_name="Fund ID",
            table_id=tables[0].id,
            field_type=FieldType.STRING,
            is_dimension=True,
            description="Unique fund identifier"
        ),
        Field(
            column_name="fund_name",
            display_name="Fund Name",
            table_id=tables[0].id,
            field_type=FieldType.STRING,
            is_dimension=True,
            description="Fund display name"
        ),
        Field(
            column_name="fund_type",
            display_name="Fund Type",
            table_id=tables[0].id,
            field_type=FieldType.STRING,
            is_dimension=True,
            description="Type of fund (Equity, Bond, Mixed)"
        ),
        Field(
            column_name="inception_date",
            display_name="Inception Date",
            table_id=tables[0].id,
            field_type=FieldType.DATE,
            is_dimension=True,
            description="Fund inception date"
        ),
        Field(
            column_name="aum",
            display_name="AUM",
            table_id=tables[0].id,
            field_type=FieldType.CURRENCY,
            is_dimension=False,
            default_aggregation=AggregationType.SUM,
            description="Assets under management",
            is_restricted=True,
            required_role="Administrator",
            required_permissions=["reports.read", "reports.execute"]
        ),
    ]
    fields.extend(fund_fields)
    
    # Time series fields
    ts_fields = [
        Field(
            column_name="fund_id",
            display_name="Fund ID",
            table_id=tables[1].id,
            field_type=FieldType.STRING,
            is_dimension=True,
            description="Fund identifier"
        ),
        Field(
            column_name="date",
            display_name="Date",
            table_id=tables[1].id,
            field_type=FieldType.DATE,
            is_dimension=True,
            description="Value date"
        ),
        Field(
            column_name="nav",
            display_name="NAV",
            table_id=tables[1].id,
            field_type=FieldType.CURRENCY,
            is_dimension=False,
            description="Net asset value",
            is_restricted=True,
            required_role="Report Creator"
        ),
        Field(
            column_name="return_1d",
            display_name="1 Day Return",
            table_id=tables[1].id,
            field_type=FieldType.PERCENTAGE,
            is_dimension=False,
            default_aggregation=AggregationType.AVG,
            description="1-day return percentage"
        ),
        Field(
            column_name="return_mtd",
            display_name="MTD Return",
            table_id=tables[1].id,
            field_type=FieldType.PERCENTAGE,
            is_dimension=False,
            default_aggregation=AggregationType.AVG,
            description="Month-to-date return"
        ),
        Field(
            column_name="return_ytd",
            display_name="YTD Return",
            table_id=tables[1].id,
            field_type=FieldType.PERCENTAGE,
            is_dimension=False,
            default_aggregation=AggregationType.AVG,
            description="Year-to-date return"
        ),
    ]
    fields.extend(ts_fields)
    
    db.add_all(fields)
    await db.commit()
    return fields


async def create_field_relationships(db: AsyncSession, fields):
    """Create relationships between fields"""
    
    # Find fund_id fields from different tables
    fund_id_fields = [f for f in fields if f.column_name == "fund_id"]
    
    if len(fund_id_fields) >= 2:
        relationship = FieldRelationship(
            source_field_id=fund_id_fields[0].id,
            target_field_id=fund_id_fields[1].id,
            relationship_type="foreign_key",
            join_type="inner"
        )
        db.add(relationship)
        await db.commit()


async def create_folders(db: AsyncSession, users):
    """Create report folders"""
    
    folders = []
    
    # Root folders
    public_folder = Folder(
        name="Public Reports",
        owner_id=users[0].id  # Admin owns public folder
    )
    folders.append(public_folder)
    
    finance_folder = Folder(
        name="Finance Reports",
        owner_id=users[1].id  # Creator owns finance folder
    )
    folders.append(finance_folder)
    
    operations_folder = Folder(
        name="Operations Reports",
        owner_id=users[1].id
    )
    folders.append(operations_folder)
    
    db.add_all(folders)
    await db.commit()
    
    # Create subfolders
    monthly_folder = Folder(
        name="Monthly Reports",
        parent_id=finance_folder.id,
        owner_id=users[1].id
    )
    
    quarterly_folder = Folder(
        name="Quarterly Reports",
        parent_id=finance_folder.id,
        owner_id=users[1].id
    )
    
    db.add_all([monthly_folder, quarterly_folder])
    await db.commit()
    
    folders.extend([monthly_folder, quarterly_folder])
    return folders


async def create_reports(db: AsyncSession, users, folders, fields):
    """Create sample reports"""
    
    reports = []
    
    # Fund Performance Dashboard
    dashboard_def = {
        "sections": [
            {
                "id": "header",
                "type": "text",
                "title": "Fund Performance Dashboard",
                "content": "Monthly performance overview of all funds"
            },
            {
                "id": "table1",
                "type": "table",
                "title": "Fund Performance Table",
                "fields": ["fund_name", "fund_type", "aum", "return_1d", "return_mtd", "return_ytd"],
                "filters": [
                    {"field": "fund_type", "operator": "IN", "value": ["Equity", "Bond"]}
                ],
                "sort": [{"field": "return_ytd", "direction": "DESC"}]
            }
        ],
        "parameters": [
            {"name": "date", "type": "date", "default": "today", "required": True}
        ]
    }
    
    dashboard = Report(
        name="Fund Performance Dashboard",
        description="Comprehensive fund performance overview",
        report_type=ReportType.DASHBOARD,
        owner_id=users[1].id,  # Creator user
        folder_id=folders[1].id,  # Finance folder
        definition=dashboard_def,
        version=1,
        is_published=True
    )
    reports.append(dashboard)
    
    # Top Performers Report
    top_performers_def = {
        "sections": [
            {
                "id": "table1",
                "type": "table",
                "title": "Top 10 Performers",
                "fields": ["fund_name", "fund_type", "return_ytd", "aum"],
                "filters": [
                    {"field": "return_ytd", "operator": ">", "value": 0}
                ],
                "sort": [{"field": "return_ytd", "direction": "DESC"}],
                "limit": 10
            }
        ]
    }
    
    top_performers = Report(
        name="Top Performers Report",
        description="Top 10 performing funds by YTD return",
        report_type=ReportType.STANDARD,
        owner_id=users[1].id,
        folder_id=folders[3].id,  # Monthly folder
        definition=top_performers_def,
        version=1,
        is_published=True
    )
    reports.append(top_performers)
    
    # Fund Detail Template
    detail_template_def = {
        "sections": [
            {
                "id": "params",
                "type": "parameters",
                "parameters": [
                    {"name": "fund_id", "type": "string", "required": True}
                ]
            },
            {
                "id": "detail",
                "type": "detail",
                "title": "Fund Details",
                "fields": ["fund_name", "fund_type", "inception_date", "aum"],
                "filters": [
                    {"field": "fund_id", "operator": "=", "value": "${fund_id}"}
                ]
            },
            {
                "id": "performance",
                "type": "table",
                "title": "Historical Performance",
                "fields": ["date", "nav", "return_1d", "return_mtd", "return_ytd"],
                "filters": [
                    {"field": "fund_id", "operator": "=", "value": "${fund_id}"}
                ],
                "sort": [{"field": "date", "direction": "DESC"}],
                "limit": 30
            }
        ]
    }
    
    detail_template = Report(
        name="Fund Detail Template",
        description="Template for detailed fund analysis",
        report_type=ReportType.TEMPLATE,
        owner_id=users[0].id,  # Admin user
        folder_id=folders[0].id,  # Public folder
        definition=detail_template_def,
        version=1,
        is_published=True,
        is_template=True
    )
    reports.append(detail_template)
    
    db.add_all(reports)
    await db.commit()
    return reports


async def create_actual_data_tables(db: AsyncSession):
    """Create actual data tables with sample data for testing"""
    from sqlalchemy import text
    import random
    from datetime import date, timedelta
    
    # Create funds table
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS funds (
            fund_id VARCHAR PRIMARY KEY,
            fund_name VARCHAR,
            fund_type VARCHAR,
            inception_date DATE,
            manager VARCHAR
        )
    """))
    
    # Create fund_time_series table
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS fund_time_series (
            fund_id VARCHAR,
            date DATE,
            nav DECIMAL(10,2),
            return_1d DECIMAL(10,4),
            aum DECIMAL(15,2),
            PRIMARY KEY (fund_id, date)
        )
    """))
    
    # Create benchmarks table
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS benchmarks (
            benchmark_id VARCHAR PRIMARY KEY,
            benchmark_name VARCHAR,
            asset_class VARCHAR
        )
    """))
    
    # Create transactions table
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS transactions (
            transaction_id SERIAL PRIMARY KEY,
            fund_id VARCHAR,
            transaction_date DATE,
            transaction_type VARCHAR,
            amount DECIMAL(15,2)
        )
    """))
    
    # Insert sample funds
    fund_types = ['Equity', 'Fixed Income', 'Balanced', 'Money Market', 'Alternative']
    managers = ['Alpha Investments', 'Beta Capital', 'Gamma Partners', 'Delta Advisors']
    
    for i in range(1, 21):  # Create 20 funds
        fund_id = f'FUND{i:03d}'
        await db.execute(text("""
            INSERT INTO funds (fund_id, fund_name, fund_type, inception_date, manager)
            VALUES (:fund_id, :fund_name, :fund_type, :inception_date, :manager)
            ON CONFLICT (fund_id) DO NOTHING
        """), {
            'fund_id': fund_id,
            'fund_name': f'Fund {i}',
            'fund_type': random.choice(fund_types),
            'inception_date': date(2020, 1, 1) + timedelta(days=random.randint(0, 365)),
            'manager': random.choice(managers)
        })
        
        # Insert time series data for each fund (last 30 days)
        base_nav = 100.0 + random.uniform(-20, 50)
        for days_ago in range(30):
            trade_date = date.today() - timedelta(days=days_ago)
            nav = base_nav * (1 + random.uniform(-0.02, 0.02))  # Daily fluctuation
            return_1d = random.uniform(-0.02, 0.02)
            aum = nav * random.uniform(1000000, 10000000)
            
            await db.execute(text("""
                INSERT INTO fund_time_series (fund_id, date, nav, return_1d, aum)
                VALUES (:fund_id, :date, :nav, :return_1d, :aum)
                ON CONFLICT (fund_id, date) DO NOTHING
            """), {
                'fund_id': fund_id,
                'date': trade_date,
                'nav': nav,
                'return_1d': return_1d,
                'aum': aum
            })
            base_nav = nav  # Use previous NAV as base for next day
    
    # Insert sample benchmarks
    benchmarks = [
        ('SP500', 'S&P 500 Index', 'Equity'),
        ('AGG', 'Bloomberg Aggregate Bond Index', 'Fixed Income'),
        ('MSCI', 'MSCI World Index', 'Equity')
    ]
    
    for bench_id, bench_name, asset_class in benchmarks:
        await db.execute(text("""
            INSERT INTO benchmarks (benchmark_id, benchmark_name, asset_class)
            VALUES (:benchmark_id, :benchmark_name, :asset_class)
            ON CONFLICT (benchmark_id) DO NOTHING
        """), {
            'benchmark_id': bench_id,
            'benchmark_name': bench_name,
            'asset_class': asset_class
        })
    
    await db.commit()


async def seed_database():
    """Main function to seed the database"""
    async with AsyncSessionLocal() as db:
        try:
            print("Starting database seeding...")
            
            # Create permissions
            print("Creating permissions...")
            permissions = await create_permissions(db)
            print(f"Created {len(permissions)} permissions")
            
            # Create roles
            print("Creating roles...")
            roles = await create_roles(db, permissions)
            print(f"Created {len(roles)} roles")
            
            # Create groups
            print("Creating groups...")
            groups = await create_groups(db, roles)
            print(f"Created {len(groups)} groups")
            
            # Create users
            print("Creating users...")
            users = await create_users(db, groups)
            print(f"Created {len(users)} users")
            
            # Create data sources
            print("Creating data sources...")
            data_sources = await create_data_sources(db)
            print(f"Created {len(data_sources)} data sources")
            
            # Create data tables
            print("Creating data tables...")
            tables = await create_data_tables(db, data_sources)
            print(f"Created {len(tables)} tables")
            
            # Create fields
            print("Creating fields...")
            fields = await create_fields(db, tables)
            print(f"Created {len(fields)} fields")
            
            # Create field relationships
            print("Creating field relationships...")
            await create_field_relationships(db, fields)
            
            # Create folders
            print("Creating folders...")
            folders = await create_folders(db, users)
            print(f"Created {len(folders)} folders")
            
            # Create reports
            print("Creating reports...")
            reports = await create_reports(db, users, folders, fields)
            print(f"Created {len(reports)} reports")
            
            # Create actual data tables with sample data
            print("Creating actual data tables...")
            await create_actual_data_tables(db)
            print("Created actual data tables with sample data")
            
            print("\nDatabase seeding completed successfully!")
            print("\nTest Users:")
            print("  Admin: admin@boe-system.local / admin123")
            print("  Creator: creator@boe-system.local / creator123")
            print("  Viewer: viewer@boe-system.local / viewer123")
            
        except Exception as e:
            print(f"Error seeding database: {e}")
            await db.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(seed_database())