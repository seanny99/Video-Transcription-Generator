"""
Centralized exception definitions for the backend application.
"""

class AppError(Exception):
    """Base class for application errors."""
    def __init__(self, message: str, status_code: int = 500, detail: str = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.detail = detail or message

class NotFoundError(AppError):
    """Raised when a resource is not found."""
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, status_code=404)

class ValidationError(AppError):
    """Raised when input validation fails."""
    def __init__(self, message: str = "Invalid input"):
        super().__init__(message, status_code=400)

class ConflictError(AppError):
    """Raised when there is a resource conflict."""
    def __init__(self, message: str = "Resource conflict"):
        super().__init__(message, status_code=409)

class ProcessingError(AppError):
    """Raised when an operation fails during processing (e.g., transcription)."""
    def __init__(self, message: str = "Processing failed"):
        super().__init__(message, status_code=422)
