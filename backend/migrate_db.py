
import asyncio
import sys
import os
from sqlalchemy import text
from models.database import engine

async def migrate():
    print("Starting manual migration...")
    
    # 1. Inspect Configuration
    from config import settings
    import os
    from pathlib import Path
    
    # FORCE APPDATA PATH (Mimic Production/Frozen state)
    app_data = Path(os.getenv('APPDATA', os.path.expanduser('~'))) / "VideoTranscriptionGenerator"
    db_path = app_data / 'transcripts.db'
    
    # Overwrite the engine's URL
    settings.database_url = f"sqlite+aiosqlite:///{db_path}"
    # Re-create engine with new URL
    from sqlalchemy.ext.asyncio import create_async_engine
    global engine
    engine = create_async_engine(settings.database_url)
    
    print(f"DEBUG: FORCED Target DB = {db_path}")
    
    # 2. Inspect File System
    print(f"DEBUG: DB file exists? {db_path.exists()}")
    if db_path.exists():
        print(f"DEBUG: DB file size: {db_path.stat().st_size} bytes")

    async with engine.begin() as conn:
        try:
            # 3. Inspect Existing Columns
            print("Inspection: Checking existing columns...")
            result = await conn.execute(text("PRAGMA table_info(transcripts)"))
            columns = [row[1] for row in result.fetchall()]
            print(f"DEBUG: Current columns in 'transcripts': {columns}")
            
            if 'download_progress' in columns:
                print("INFO: 'download_progress' column ALREADY EXISTS.")
                return

            # 4. Perform Migration
            print("Attempting to add 'download_progress' column to 'transcripts' table...")
            await conn.execute(text("ALTER TABLE transcripts ADD COLUMN download_progress FLOAT DEFAULT 0.0"))
            print("SUCCESS: Added 'download_progress' column.")
            
            # 5. Verify Mutation
            result = await conn.execute(text("PRAGMA table_info(transcripts)"))
            columns = [row[1] for row in result.fetchall()]
            print(f"DEBUG: New columns: {columns}")
            
        except Exception as e:
            if "duplicate column" in str(e) or "no such column" not in str(e): # Checking if it failed because it exists
                # In SQLite "duplicate column name" is the error
                print(f"INFO: Column might already exist or other error: {e}")
            else:
                 print(f"ERROR: Migration failed: {e}")
                 
    print("Migration finished.")

if __name__ == "__main__":
    # Ensure we are in backend dir context
    # If running from root, 'backend' is the package.
    # If running from backend, current dir is the package.
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.append(current_dir) # Add 'backend' dir to path to allow imports like 'from models...'
    
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        
    asyncio.run(migrate())
