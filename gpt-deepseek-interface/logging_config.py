"""Logging configuration for the application."""
import os
import logging
import logging.handlers
from pathlib import Path
import json
import socket
from datetime import datetime

class HostnameFilter(logging.Filter):
    """Add hostname to log records."""
    def filter(self, record):
        record.hostname = socket.gethostname()
        return True

def setup_logging(app_name: str = "app", log_level: str = "INFO", log_dir: str = "logs") -> None:
    """Set up logging configuration.
    
    Args:
        app_name: Name of the application
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_dir: Directory to store log files
    """
    # Create log directory if it doesn't exist
    os.makedirs(log_dir, exist_ok=True)
    
    # Convert string log level to numeric value
    numeric_level = getattr(logging, log_level.upper(), None)
    if not isinstance(numeric_level, int):
        raise ValueError(f'Invalid log level: {log_level}')
    
    # Base formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(hostname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S.%f'
    )
    
    # JSON formatter for structured logging
    class JsonFormatter(logging.Formatter):
        def format(self, record):
            log_record = {
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'level': record.levelname,
                'name': record.name,
                'hostname': socket.gethostname(),
                'message': record.getMessage(),
                'module': record.module,
                'function': record.funcName,
                'line': record.lineno,
                'process': record.process,
                'thread': record.thread,
                'thread_name': record.threadName,
            }
            
            # Add exception info if present
            if record.exc_info:
                log_record['exc_info'] = self.formatException(record.exc_info)
            
            # Add extra fields
            if hasattr(record, 'extra'):
                log_record.update(record.extra)
                
            return json.dumps(log_record, default=str)
    
    # Root logger
    logger = logging.getLogger()
    logger.setLevel(numeric_level)
    
    # Clear existing handlers
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.addFilter(HostnameFilter())
    logger.addHandler(console_handler)
    
    # File handler
    file_handler = logging.handlers.RotatingFileHandler(
        os.path.join(log_dir, f'{app_name}.log'),
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5
    )
    file_handler.setFormatter(JsonFormatter())
    file_handler.addFilter(HostnameFilter())
    logger.addHandler(file_handler)
    
    # Error file handler (only ERROR and above)
    error_file_handler = logging.handlers.RotatingFileHandler(
        os.path.join(log_dir, f'{app_name}_error.log'),
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5
    )
    error_file_handler.setLevel(logging.ERROR)
    error_file_handler.setFormatter(JsonFormatter())
    error_file_handler.addFilter(HostnameFilter())
    logger.addHandler(error_file_handler)
    
    # Suppress overly verbose logs from libraries
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    logging.getLogger('requests').setLevel(logging.WARNING)
    logging.getLogger('botocore').setLevel(logging.WARNING)
    logging.getLogger('boto3').setLevel(logging.WARNING)
    logging.getLogger('s3transfer').setLevel(logging.WARNING)
    logging.getLogger('docker').setLevel(logging.WARNING)
    logging.getLogger('kubernetes').setLevel(logging.WARNING)


def get_logger(name: str = None) -> logging.Logger:
    """Get a logger with the given name.
    
    Args:
        name: Name of the logger (default: root logger)
        
    Returns:
        Configured logger instance
    """
    return logging.getLogger(name)

# Example usage
if __name__ == "__main__":
    setup_logging("example_app", "INFO")
    logger = get_logger(__name__)
    
    logger.info("This is an info message")
    logger.warning("This is a warning message")
    logger.error("This is an error message")
    
    try:
        1 / 0
    except Exception as e:
        logger.exception("An error occurred")
