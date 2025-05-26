const logger = require('../core/logger');
const { isCelebrateError } = require('celebrate');
const { ValidationError } = require('joi');

/**
 * Error response middleware for 404 not found.
 */
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

/**
 * Error response middleware for handling all errors.
 */
const errorHandler = (err, req, res, next) => {
  // Set status code
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;
  let errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  let details = err.details;

  // Handle specific error types
  if (isCelebrateError(err)) {
    // Joi validation error
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    
    const validationErrors = [];
    for (const [segment, joiError] of err.details.entries()) {
      validationErrors.push({
        segment,
        message: joiError.message,
        details: joiError.details.map(d => ({
          message: d.message,
          path: d.path,
          type: d.type,
          context: d.context
        }))
      });
    }
    
    message = 'Validation failed';
    details = { validation: validationErrors };
  } else if (err instanceof ValidationError) {
    // Joi validation error (direct)
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = {
      validation: [{
        message: err.message,
        details: err.details.map(d => ({
          message: d.message,
          path: d.path,
          type: d.type,
          context: d.context
        }))
      }]
    };
  } else if (err.name === 'CastError') {
    // Mongoose cast error
    statusCode = 400;
    errorCode = 'INVALID_INPUT';
    message = 'Invalid ID format';
  } else if (err.name === 'JsonWebTokenError') {
    // JWT error
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    // JWT expired
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    message = 'Token has expired';
  } else if (err.name === 'MongoError' && err.code === 11000) {
    // MongoDB duplicate key error
    statusCode = 409;
    errorCode = 'DUPLICATE_KEY';
    const field = Object.keys(err.keyValue)[0];
    message = `${field} already exists`;
    details = { field, value: err.keyValue[field] };
  }

  // Log the error
  if (statusCode >= 500) {
    logger.error(err.stack || err);
  } else if (statusCode >= 400) {
    logger.warn(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && !err.isOperational) {
    message = 'Something went wrong';
    details = undefined;
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      ...(details && { details }),
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    },
    timestamp: new Date().toISOString()
  });
};

/**
 * Wrap async middleware to catch errors and pass them to the error handler
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(statusCode, message, code, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || 'INTERNAL_SERVER_ERROR';
    this.details = details;
    this.isOperational = true;
    
    // Capture stack trace (excluding constructor call from it)
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Common error types
 */
const errors = {
  // 400 Bad Request
  badRequest: (message = 'Bad Request', details) => 
    new ApiError(400, message, 'BAD_REQUEST', details),
    
  // 401 Unauthorized
  unauthorized: (message = 'Unauthorized') => 
    new ApiError(401, message, 'UNAUTHORIZED'),
    
  // 403 Forbidden
  forbidden: (message = 'Forbidden') => 
    new ApiError(403, message, 'FORBIDDEN'),
    
  // 404 Not Found
  notFound: (message = 'Resource not found') => 
    new ApiError(404, message, 'NOT_FOUND'),
    
  // 409 Conflict
  conflict: (message = 'Conflict', details) => 
    new ApiError(409, message, 'CONFLICT', details),
    
  // 422 Unprocessable Entity
  validation: (message = 'Validation failed', details) => 
    new ApiError(422, message, 'VALIDATION_ERROR', details),
    
  // 429 Too Many Requests
  tooManyRequests: (message = 'Too many requests') => 
    new ApiError(429, message, 'RATE_LIMIT_EXCEEDED'),
    
  // 500 Internal Server Error
  internal: (message = 'Internal Server Error') => 
    new ApiError(500, message, 'INTERNAL_SERVER_ERROR'),
    
  // 501 Not Implemented
  notImplemented: (message = 'Not Implemented') => 
    new ApiError(501, message, 'NOT_IMPLEMENTED'),
    
  // 503 Service Unavailable
  serviceUnavailable: (message = 'Service Unavailable') => 
    new ApiError(503, message, 'SERVICE_UNAVAILABLE')
};

module.exports = {
  notFound,
  errorHandler,
  asyncHandler,
  ApiError,
  ...errors
};
