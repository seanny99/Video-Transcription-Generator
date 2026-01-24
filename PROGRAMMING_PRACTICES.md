# Programming Best Practices Guide

> A comprehensive guide for maintaining code quality, scalability, and maintainability in the Video Transcription Generator project.

---

## Table of Contents

1. [General Principles](#general-principles)
2. [Code Organization](#code-organization)
3. [Naming Conventions](#naming-conventions)
4. [Error Handling](#error-handling)
5. [Testing Standards](#testing-standards)
6. [Performance Guidelines](#performance-guidelines)
7. [Security Practices](#security-practices)
8. [Documentation Standards](#documentation-standards)
9. [Git Workflow](#git-workflow)
10. [Code Review Checklist](#code-review-checklist)

---

## General Principles

### SOLID Principles

| Principle | Description | Example |
|-----------|-------------|---------|
| **S**ingle Responsibility | Each class/module does one thing well | `TranscriptionService` only handles transcription |
| **O**pen/Closed | Open for extension, closed for modification | Use interfaces for transcription providers |
| **L**iskov Substitution | Subtypes must be substitutable for base types | Any `TranscriptionProvider` can be swapped |
| **I**nterface Segregation | Many specific interfaces > one general interface | Separate `Uploadable`, `Playable` interfaces |
| **D**ependency Inversion | Depend on abstractions, not concretions | Inject services via constructor |

### DRY (Don't Repeat Yourself)

```python
# ❌ Bad: Duplicated validation logic
def process_youtube_url(url: str):
    if not url.startswith("https://"):
        raise ValueError("Invalid URL")
    # ...

def process_video_url(url: str):
    if not url.startswith("https://"):
        raise ValueError("Invalid URL")
    # ...

# ✅ Good: Extracted validation
def validate_url(url: str) -> bool:
    return url.startswith("https://")

def process_youtube_url(url: str):
    if not validate_url(url):
        raise ValueError("Invalid URL")
    # ...
```

### KISS (Keep It Simple, Stupid)

- Prefer simple, readable solutions over clever ones
- Avoid premature optimization
- Write code for humans first, computers second

### YAGNI (You Aren't Gonna Need It)

- Don't add functionality until it's needed
- Avoid speculative generality
- Build for current requirements, design for extensibility

---

## Code Organization

### Project Structure

```
project/
├── backend/
│   ├── main.py              # Application entry point
│   ├── config.py            # Configuration management
│   ├── models/              # Database models
│   ├── services/            # Business logic
│   ├── routers/             # API endpoints
│   ├── utils/               # Shared utilities
│   └── tests/               # Test files mirror src structure
│
├── frontend/
│   ├── src/
│   │   ├── main/            # Electron main process
│   │   ├── renderer/        # React application
│   │   │   ├── components/  # Reusable UI components
│   │   │   ├── hooks/       # Custom React hooks
│   │   │   ├── services/    # API clients
│   │   │   ├── utils/       # Helper functions
│   │   │   └── types/       # TypeScript definitions
│   │   └── shared/          # Code shared between processes
│   └── tests/
│
└── docs/                    # Additional documentation
```

### Module Guidelines

1. **One concern per file** - Each file should have a single, clear purpose
2. **Limit file length** - If a file exceeds 300 lines, consider splitting
3. **Group related functionality** - Keep related functions/classes together
4. **Avoid circular dependencies** - Use dependency injection or restructure

---

## Naming Conventions

### Python (Backend)

```python
# Variables and functions: snake_case
user_name = "John"
def get_transcript_by_id(transcript_id: int) -> Transcript:
    pass

# Classes: PascalCase
class TranscriptionService:
    pass

# Constants: SCREAMING_SNAKE_CASE
MAX_FILE_SIZE_MB = 500
DEFAULT_WHISPER_MODEL = "base"

# Private members: leading underscore
class Service:
    def __init__(self):
        self._internal_state = {}
    
    def _private_method(self):
        pass
```

### TypeScript (Frontend)

```typescript
// Variables and functions: camelCase
const userName = "John";
function getTranscriptById(transcriptId: number): Transcript { }

// Classes and Components: PascalCase
class TranscriptionService { }
function MediaPlayer(): JSX.Element { }

// Interfaces: PascalCase with 'I' prefix (optional) or descriptive name
interface TranscriptSegment { }
interface ITranscriptionProvider { }

// Types: PascalCase
type MediaType = 'video' | 'audio';

// Constants: SCREAMING_SNAKE_CASE or camelCase
const MAX_FILE_SIZE_MB = 500;
const defaultConfig = { };

// Enums: PascalCase with PascalCase members
enum TranscriptionStatus {
    Pending = 'pending',
    Processing = 'processing',
    Complete = 'complete',
    Failed = 'failed'
}
```

### File Naming

| Type | Convention | Example |
|------|------------|---------|
| Python modules | snake_case | `transcription_service.py` |
| React components | PascalCase | `MediaPlayer.tsx` |
| TypeScript utilities | camelCase | `formatTime.ts` |
| Test files | Suffix with `_test` or `.test` | `transcription_service_test.py`, `MediaPlayer.test.tsx` |
| CSS/styles | kebab-case or match component | `media-player.css` |

---

## Error Handling

### Python Error Handling

```python
# Define custom exceptions
class TranscriptionError(Exception):
    """Base exception for transcription errors."""
    pass

class TranscriptionTimeoutError(TranscriptionError):
    """Raised when transcription exceeds time limit."""
    pass

class InvalidMediaError(TranscriptionError):
    """Raised when media file is invalid or corrupted."""
    pass

# Use specific exception handling
async def transcribe_audio(file_path: str) -> Transcript:
    try:
        result = await whisper.transcribe(file_path)
        return Transcript.from_whisper_result(result)
    except FileNotFoundError:
        logger.error(f"Audio file not found: {file_path}")
        raise InvalidMediaError(f"File not found: {file_path}")
    except TimeoutError:
        logger.error(f"Transcription timed out for: {file_path}")
        raise TranscriptionTimeoutError("Transcription exceeded time limit")
    except Exception as e:
        logger.exception(f"Unexpected error during transcription: {e}")
        raise TranscriptionError(f"Transcription failed: {str(e)}")

# FastAPI error handlers
@app.exception_handler(TranscriptionError)
async def transcription_error_handler(request: Request, exc: TranscriptionError):
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "type": type(exc).__name__}
    )
```

### TypeScript Error Handling

```typescript
// Define error types
class ApiError extends Error {
    constructor(
        message: string,
        public statusCode: number,
        public code: string
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

// Async function with proper error handling
async function fetchTranscript(id: string): Promise<Transcript> {
    try {
        const response = await api.get(`/transcripts/${id}`);
        return response.data;
    } catch (error) {
        if (error instanceof ApiError) {
            // Handle known API errors
            console.error(`API Error [${error.code}]: ${error.message}`);
            throw error;
        }
        // Wrap unknown errors
        throw new ApiError('Failed to fetch transcript', 500, 'UNKNOWN_ERROR');
    }
}

// React error boundary usage
function App() {
    return (
        <ErrorBoundary fallback={<ErrorFallback />}>
            <MainContent />
        </ErrorBoundary>
    );
}
```

### Error Handling Rules

1. **Never swallow exceptions silently** - Always log or handle
2. **Use specific exception types** - Avoid catching broad `Exception`
3. **Provide context** - Include relevant data in error messages
4. **Fail fast** - Validate inputs early
5. **Graceful degradation** - Provide fallbacks where possible

---

## Testing Standards

### Test Structure (AAA Pattern)

```python
def test_transcription_creates_segments():
    # Arrange
    audio_file = create_test_audio(duration_seconds=10)
    service = TranscriptionService()
    
    # Act
    result = service.transcribe(audio_file)
    
    # Assert
    assert len(result.segments) > 0
    assert all(s.start_time < s.end_time for s in result.segments)
```

### Test Naming

```python
# Pattern: test_[unit]_[scenario]_[expected_result]
def test_youtube_service_with_invalid_url_raises_error():
    pass

def test_transcript_sync_at_video_end_highlights_last_segment():
    pass
```

### Test Coverage Requirements

| Area | Minimum Coverage |
|------|-----------------|
| Business Logic (Services) | 80% |
| API Endpoints | 75% |
| Utility Functions | 90% |
| UI Components | 60% |

### What to Test

✅ **Do Test:**
- Business logic and calculations
- Edge cases and boundary conditions
- Error handling paths
- API contracts
- User interactions

❌ **Don't Test:**
- Framework code (React, FastAPI internals)
- Simple getters/setters
- Third-party library behavior
- Implementation details

---

## Performance Guidelines

### Backend Performance

```python
# Use async for I/O operations
async def download_youtube_video(url: str) -> Path:
    async with aiohttp.ClientSession() as session:
        # Async download
        pass

# Use background tasks for heavy processing
@router.post("/transcribe")
async def start_transcription(
    file: UploadFile,
    background_tasks: BackgroundTasks
):
    task_id = generate_task_id()
    background_tasks.add_task(process_transcription, file, task_id)
    return {"task_id": task_id, "status": "queued"}

# Stream large responses
@router.get("/transcripts/{id}/export")
async def export_transcript(id: str):
    async def generate():
        async for chunk in get_transcript_chunks(id):
            yield chunk
    return StreamingResponse(generate())
```

### Frontend Performance

```typescript
// Use React.memo for expensive components
const TranscriptSegment = React.memo(function TranscriptSegment({
    segment,
    isActive
}: Props) {
    return <div className={isActive ? 'active' : ''}>{segment.text}</div>;
});

// Use useMemo for expensive calculations
function TranscriptPanel({ transcript }: Props) {
    const sortedSegments = useMemo(
        () => transcript.segments.sort((a, b) => a.startTime - b.startTime),
        [transcript.segments]
    );
    return <div>{sortedSegments.map(s => <Segment key={s.id} {...s} />)}</div>;
}

// Use useCallback for stable function references
function MediaPlayer({ onTimeUpdate }: Props) {
    const handleTimeUpdate = useCallback((time: number) => {
        onTimeUpdate(time);
    }, [onTimeUpdate]);
    
    return <video onTimeUpdate={e => handleTimeUpdate(e.currentTarget.currentTime)} />;
}

// Virtualize long lists
import { FixedSizeList } from 'react-window';

function TranscriptList({ segments }: Props) {
    return (
        <FixedSizeList
            height={400}
            itemCount={segments.length}
            itemSize={50}
        >
            {({ index, style }) => (
                <div style={style}>{segments[index].text}</div>
            )}
        </FixedSizeList>
    );
}
```

### Performance Rules

1. **Measure before optimizing** - Use profiling tools
2. **Optimize the bottleneck** - Focus on the slowest part
3. **Lazy load** - Load resources only when needed
4. **Cache wisely** - Cache expensive computations
5. **Debounce/throttle** - Limit high-frequency operations

---

## Security Practices

### Input Validation

```python
from pydantic import BaseModel, validator, HttpUrl

class YouTubeRequest(BaseModel):
    url: HttpUrl
    
    @validator('url')
    def validate_youtube_url(cls, v):
        if 'youtube.com' not in str(v) and 'youtu.be' not in str(v):
            raise ValueError('Must be a YouTube URL')
        return v

class FileUploadRequest(BaseModel):
    filename: str
    
    @validator('filename')
    def validate_filename(cls, v):
        # Prevent path traversal
        if '..' in v or '/' in v or '\\' in v:
            raise ValueError('Invalid filename')
        return v
```

### File Upload Security

```python
ALLOWED_EXTENSIONS = {'.mp3', '.mp4', '.wav', '.webm', '.m4a'}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB

async def validate_upload(file: UploadFile) -> None:
    # Check extension
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"File type {ext} not allowed")
    
    # Check file size (read in chunks)
    size = 0
    while chunk := await file.read(8192):
        size += len(chunk)
        if size > MAX_FILE_SIZE:
            raise HTTPException(413, "File too large")
    
    # Reset file position
    await file.seek(0)
    
    # Verify file magic bytes match extension
    header = await file.read(12)
    await file.seek(0)
    if not verify_magic_bytes(header, ext):
        raise HTTPException(400, "File content doesn't match extension")
```

### Security Rules

1. **Never trust user input** - Validate and sanitize everything
2. **Use parameterized queries** - Prevent SQL injection
3. **Implement rate limiting** - Prevent abuse
4. **Secure file handling** - Validate uploads, use safe paths
5. **Keep dependencies updated** - Regularly check for vulnerabilities

---

## Documentation Standards

### Code Comments

```python
# ✅ Good: Explains WHY, not WHAT
# Using Whisper's "base" model for balance between speed and accuracy.
# Larger models (small, medium, large) available if accuracy is prioritized.
model = whisper.load_model("base")

# ❌ Bad: States the obvious
# Load the whisper model
model = whisper.load_model("base")
```

### Function Documentation

```python
def transcribe_audio(
    file_path: str,
    language: str | None = None,
    word_timestamps: bool = True
) -> TranscriptionResult:
    """
    Transcribe audio file using Whisper model.
    
    Args:
        file_path: Absolute path to the audio file. Supports mp3, wav, m4a.
        language: ISO 639-1 language code. If None, auto-detects language.
        word_timestamps: If True, includes word-level timing information.
    
    Returns:
        TranscriptionResult containing segments with timestamps and text.
    
    Raises:
        FileNotFoundError: If audio file doesn't exist.
        InvalidMediaError: If file format is unsupported or corrupted.
        TranscriptionError: If Whisper processing fails.
    
    Example:
        >>> result = transcribe_audio("/path/to/audio.mp3")
        >>> print(result.segments[0].text)
        "Hello, world!"
    """
```

### README Structure

Every module/package should have:
1. **Purpose** - What it does
2. **Installation** - How to set it up
3. **Usage** - Basic examples
4. **API Reference** - Available functions/classes
5. **Configuration** - Available options

---

## Git Workflow

### Branch Naming

```
feature/add-youtube-support
bugfix/fix-transcript-sync
hotfix/security-patch
refactor/extract-transcription-service
docs/update-readme
```

### Commit Messages

```
# Format: <type>(<scope>): <subject>

feat(transcription): add word-level timestamp support
fix(player): resolve sync drift on long videos
refactor(api): extract validation middleware
docs(readme): add installation instructions
test(youtube): add URL validation tests
chore(deps): update whisper to v3.0
```

### Commit Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change that neither fixes nor adds |
| `docs` | Documentation only |
| `test` | Adding or fixing tests |
| `chore` | Maintenance tasks |
| `perf` | Performance improvement |
| `style` | Formatting, missing semicolons, etc. |

---

## Code Review Checklist

### Before Submitting

- [ ] Code compiles/builds without errors
- [ ] All tests pass
- [ ] New code has tests
- [ ] No console.log/print statements left
- [ ] No commented-out code
- [ ] Documentation updated if needed
- [ ] No sensitive data (API keys, passwords)

### During Review

- [ ] Code is readable and self-documenting
- [ ] Functions are small and focused
- [ ] Error handling is appropriate
- [ ] Performance considerations addressed
- [ ] Security implications considered
- [ ] Edge cases handled
- [ ] Naming is clear and consistent

---

## Quick Reference Card

| Principle | Remember |
|-----------|----------|
| Single Responsibility | One reason to change |
| DRY | Extract, don't copy |
| KISS | Simple beats clever |
| YAGNI | Build what's needed now |
| Fail Fast | Validate early |
| Test Behavior | Not implementation |
| Document Why | Not what |
| Review Everything | Four eyes see more |

---

*This document should evolve with the project. Update it when new patterns emerge or practices change.*
