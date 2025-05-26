/**
 * Success response formatter
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default: 200)
 * @returns {Object} Formatted response
 */
const success = (res, data = null, message = 'Success', statusCode = 200) => {
  const response = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };

  // Remove data if null/undefined to keep response clean
  if (data === null || data === undefined) {
    delete response.data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Error response formatter
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {string} code - Error code (default: 'ERROR')
 * @param {*} errors - Additional error details
 * @returns {Object} Formatted error response
 */
const error = (res, message = 'An error occurred', statusCode = 500, code = 'ERROR', errors = null) => {
  const response = {
    success: false,
    error: {
      code,
      message,
      ...(errors && { errors }),
    },
    timestamp: new Date().toISOString(),
  };

  return res.status(statusCode).json(response);
};

/**
 * Pagination response formatter
 * @param {Object} res - Express response object
 * @param {Array} data - Paginated data
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @param {string} message - Success message
 * @returns {Object} Formatted paginated response
 */
const paginated = (res, data, page, limit, total, message = 'Success') => {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  const response = {
    success: true,
    message,
    data,
    pagination: {
      total,
      totalPages,
      currentPage: page,
      limit,
      hasNext,
      hasPrev,
      nextPage: hasNext ? page + 1 : null,
      prevPage: hasPrev ? page - 1 : null,
    },
    timestamp: new Date().toISOString(),
  };

  return res.status(200).json(response);
};

/**
 * Validation error response formatter
 * @param {Object} res - Express response object
 * @param {Array} errors - Validation errors
 * @param {string} message - Error message
 * @returns {Object} Formatted validation error response
 */
const validationError = (res, errors, message = 'Validation failed') => {
  return error(res, message, 400, 'VALIDATION_ERROR', errors);
};

/**
 * Not found response formatter
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @returns {Object} Formatted not found response
 */
const notFound = (res, message = 'Resource not found') => {
  return error(res, message, 404, 'NOT_FOUND');
};

/**
 * Unauthorized response formatter
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @returns {Object} Formatted unauthorized response
 */
const unauthorized = (res, message = 'Unauthorized') => {
  return error(res, message, 401, 'UNAUTHORIZED');
};

/**
 * Forbidden response formatter
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @returns {Object} Formatted forbidden response
 */
const forbidden = (res, message = 'Forbidden') => {
  return error(res, message, 403, 'FORBIDDEN');
};

/**
 * Rate limit exceeded response formatter
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @returns {Object} Formatted rate limit response
 */
const tooManyRequests = (res, message = 'Too many requests, please try again later') => {
  return error(res, message, 429, 'RATE_LIMIT_EXCEEDED');
};

module.exports = {
  success,
  error,
  paginated,
  validationError,
  notFound,
  unauthorized,
  forbidden,
  tooManyRequests,
};
