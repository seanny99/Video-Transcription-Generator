"""
Database connection and session management.
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

from config import settings

# SQLite with async support
DATABASE_URL = settings.database_url.replace("sqlite:///", "sqlite+aiosqlite:///")

# SQLite needs special handling for async operations
engine = create_async_engine(
    DATABASE_URL, 
    echo=settings.debug,
    connect_args={
        "timeout": 30,  # Wait up to 30 seconds for locks
        "check_same_thread": False,
    },
    pool_pre_ping=True,  # Verify connections before use
)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

from sqlalchemy import Column, Integer, String, DateTime, select
from datetime import datetime

Base = declarative_base()


class SchemaVersion(Base):
    """Tracks the database schema version for future migrations."""
    __tablename__ = "schema_version"
    id = Column(Integer, primary_key=True)
    version = Column(Integer, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow)


async def get_db():
    """Dependency for getting database sessions."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Initialize database tables and handle legacy migrations."""
    import os
    import shutil
    from pathlib import Path
    
    # 1. Handle Legacy Data Relocation (Migration from Project Root to APPDATA)
    # This ensures users don't lose history after shifting to persistent storage
    current_script_dir = Path(__file__).parent
    legacy_db = current_script_dir.parent / "transcripts.db"
    new_db_path = Path(settings.database_url.replace("sqlite:///", ""))
    
    if legacy_db.exists() and not new_db_path.exists():
        try:
            # Ensure target directory exists
            new_db_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(str(legacy_db), str(new_db_path))
            print(f"INFO: Successfully migrated legacy database to {new_db_path}")
            # We use copy2 then delete for safety
            legacy_db.unlink()
        except Exception as e:
            print(f"WARNING: Failed to migrate legacy database: {e}")

    # 2. Initialize Tables
    # Import models here to ensure they are registered with Base metadata
    from models.media import MediaFile
    from models.transcript import Transcript, TranscriptSegment
    
    async with engine.begin() as conn:
        # Create all tables if they don't exist
        await conn.run_sync(Base.metadata.create_all)
        
        # Check/Initialize SchemaVersion
        try:
            # We use a raw SQL check to avoid complications with models not yet fully synced
            result = await conn.execute(select(SchemaVersion).limit(1))
            version_record = result.scalar_one_or_none()
            
            if not version_record:
                # First run - set initial version (4.2.0 = version 1)
                await conn.execute(
                    SchemaVersion.__table__.insert().values(version=1)
                )
                print("INFO: Initialized schema version 1")
        except Exception as e:
            # If table doesn't exist yet, metadata.create_all will handle it above
            print(f"NOTE: Schema versioning setup: {e}")
