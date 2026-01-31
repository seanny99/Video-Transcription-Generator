import PyInstaller.__main__
import os
import sys

# Define the current directory
current_dir = os.path.dirname(os.path.abspath(__file__))

# Define the entry point
entry_point = os.path.join(current_dir, 'main.py')

# Find faster-whisper assets
try:
    import faster_whisper
    fw_path = os.path.dirname(faster_whisper.__file__)
    fw_assets = os.path.join(fw_path, "assets")
    # PyInstaller data format: source;destination (Windows uses ;)
    add_data_fw = f"{fw_assets};faster_whisper/assets"
except ImportError:
    add_data_fw = None

# PyInstaller arguments
args = [
    entry_point,
    '--name=backend',
    '--onefile',
    '--console',
]

if add_data_fw:
    args.append(f'--add-data={add_data_fw}')

# Add more hidden imports and settings
args.extend([
    # Include hidden imports for uvicorn and fastapi
    '--hidden-import=uvicorn.logging',
    '--hidden-import=uvicorn.loops',
    '--hidden-import=uvicorn.loops.auto',
    '--hidden-import=uvicorn.protocols',
    '--hidden-import=uvicorn.protocols.http',
    '--hidden-import=uvicorn.protocols.http.auto',
    '--hidden-import=uvicorn.protocols.websockets',
    '--hidden-import=uvicorn.protocols.websockets.auto',
    '--hidden-import=uvicorn.lifespan',
    '--hidden-import=uvicorn.lifespan.on',
    # Include database and async drivers
    '--hidden-import=aiosqlite',
    '--hidden-import=sqlalchemy.dialects.sqlite',
    '--hidden-import=sqlalchemy.dialects.sqlite.aiosqlite',
    '--hidden-import=tzdata',
    # Include routers and other sub-packages
    '--hidden-import=routers',
    '--hidden-import=models',
    '--hidden-import=engine',
    '--hidden-import=services',
    '--hidden-import=utils',
    # Include hardware detection
    '--hidden-import=psutil',
    '--hidden-import=cpuinfo',
    # Exclude unused modules that cause warnings
    '--exclude-module=tensorboard',
    '--exclude-module=urllib3.contrib.emscripten',
    '--exclude-module=pysqlite2',
    '--exclude-module=MySQLdb',
    '--exclude-module=psycopg2',
    '--exclude-module=curl_cffi',
    '--exclude-module=yt_dlp_ejs',
    # Clean build
    '--clean',
])

print(f"Building backend executable from {entry_point}...")
PyInstaller.__main__.run(args)
print("Backend build complete! Executable located in 'dist/' folder.")
