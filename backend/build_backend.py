import PyInstaller.__main__
import os
import sys

# Define the current directory
current_dir = os.path.dirname(os.path.abspath(__file__))

# Define the entry point
entry_point = os.path.join(current_dir, 'main.py')

# PyInstaller arguments
args = [
    entry_point,
    '--name=backend',
    '--onefile',
    '--console',
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
    # Include routers and other sub-packages
    '--hidden-import=routers',
    '--hidden-import=models',
    '--hidden-import=engine',
    '--hidden-import=services',
    '--hidden-import=utils',
    # Clean build
    '--clean',
]

print(f"Building backend executable from {entry_point}...")
PyInstaller.__main__.run(args)
print("Backend build complete! Executable located in 'dist/' folder.")
