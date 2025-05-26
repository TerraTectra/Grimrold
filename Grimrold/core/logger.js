const winston = require('winston');
const path = require('path');
const { createLogger, format, transports } = winston;
const { combine, timestamp, printf, colorize, json } = format;

// Define log format
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level.toUpperCase()}] ${message}`;
  
  // Add metadata if present
  if (Object.keys(metadata).length > 0) {
    // Remove stack trace from metadata to avoid duplication
    const { stack, ...rest } = metadata;
    if (Object.keys(rest).length > 0) {
      msg += ` ${JSON.stringify(rest, null, 2)}`;
    }
    if (stack) {
      msg += `\n${stack}`;
    }
  }
  
  return msg;
});

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
require('fs').mkdirSync(logsDir, { recursive: true });

// Create logger instance
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'grimrold' },
  transports: [
    // Write all logs with level `error` and below to `error.log`
    new transports.File({ 
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    // Write all logs with level `info` and below to `combined.log`
    new transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    })
  ]
});

// If we're not in production, log to the `console` with a human-readable format
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      logFormat
    )
  }));
} else {
  // In production, log to console as JSON
  logger.add(new transports.Console({
    format: combine(
      timestamp(),
      json()
    )
  }));
}

// Create a stream for morgan HTTP request logging
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error });
  // In production, you might want to restart the process after logging
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

module.exports = logger;
