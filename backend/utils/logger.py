"""
Centralized logging configuration for AgentPress.

This module provides a unified logging interface with:
- Structured JSON logging for better parsing
- Log levels for different environments
- Correlation IDs for request tracing
- Contextual information for debugging
"""

import logging
import json
import sys
import os
from datetime import datetime
from typing import Any, Dict, Optional
from contextvars import ContextVar
from functools import wraps
import traceback
from logging.handlers import RotatingFileHandler

from utils.config import config, EnvMode

# Context variable for request correlation ID
request_id: ContextVar[str] = ContextVar('request_id', default='')

class JSONFormatter(logging.Formatter):
    """Custom JSON formatter for structured logging."""
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON with contextual information."""
        log_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': record.levelname,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
            'request_id': request_id.get(),
            'thread_id': getattr(record, 'thread_id', None),
            'correlation_id': getattr(record, 'correlation_id', None)
        }
        
        # Add extra fields if present
        if hasattr(record, 'extra'):
            log_data.update(record.extra)
            
        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = {
                'type': str(record.exc_info[0].__name__),
                'message': str(record.exc_info[1]),
                'traceback': traceback.format_exception(*record.exc_info)
            }
            
        return json.dumps(log_data)

def setup_logger(name: str = 'agentpress') -> logging.Logger:
    """
    Set up a centralized logger with both file and console handlers.
    
    Args:
        name: The name of the logger
        
    Returns:
        logging.Logger: Configured logger instance
    """
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)  
    
    # Create logs directory if it doesn't exist
    log_dir = os.path.join(os.getcwd(), 'logs')
    try:
        if not os.path.exists(log_dir):
            os.makedirs(log_dir)
            print(f"Created log directory at: {log_dir}")
    except Exception as e:
        print(f"Error creating log directory: {e}")
        return logger
    
    # File handler with rotation
    try:
        log_file = os.path.join(log_dir, f'{name}_{datetime.now().strftime("%Y%m%d")}.log')
        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5,
            encoding='utf-8'
        )
        file_handler.setLevel(logging.DEBUG)
        
        # Create formatters
        file_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s'
        )
        file_handler.setFormatter(file_formatter)
        
        # Add file handler to logger
        logger.addHandler(file_handler)
        print(f"Added file handler for: {log_file}")
    except Exception as e:
        print(f"Error setting up file handler: {e}")
    
    # Console handler - WARNING in production, INFO in other environments
    try:
        console_handler = logging.StreamHandler(sys.stdout)
        if config.ENV_MODE == EnvMode.PRODUCTION:
            console_handler.setLevel(logging.WARNING)
        else:
            console_handler.setLevel(logging.INFO)
        
        console_formatter = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s'
        )
        console_handler.setFormatter(console_formatter)
        
        # Add console handler to logger
        logger.addHandler(console_handler)
        print(f"Added console handler with level: {console_handler.level}")
    except Exception as e:
        print(f"Error setting up console handler: {e}")
    
    # # Test logging
    # logger.debug("Logger setup complete - DEBUG test")
    # logger.info("Logger setup complete - INFO test")
    # logger.warning("Logger setup complete - WARNING test")
    
    return logger

# Create default logger instance
logger = setup_logger() 