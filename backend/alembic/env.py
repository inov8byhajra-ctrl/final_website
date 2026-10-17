import sys
import os
import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config


from alembic import context

# 1. Force Python to recognize your project folder so it can find 'app'
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# 2. Import your database Base and User model
from app.core.database import base
from app.models.user import User
from app.models.log import ActivityLog

config = context.config
from app.models.uploaded_file import UploadedFile
from app.models.business_data import BusinessData
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 3. THE FIX: Assign your actual database metadata instead of None
target_metadata = base.metadata

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()

async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()

def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()