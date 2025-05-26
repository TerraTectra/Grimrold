const rateLimit = require('express-rate-limit');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const { tooManyRequests } = require('./errorHandler');
const logger = require('../core/logger');
const config = require('../config/config');

// In-memory store for rate limiting (consider Redis for production)
const rateLimiter = new RateLimiterMemory({
  points: config.rateLimit.max, // Number of points
  duration: config.rateLimit.windowMs / 1000, // Convert to seconds
  blockDuration: 60 * 5, // Block for 5 minutes on limit exceeded
});

/**
 * Middleware to apply rate limiting to API endpoints
 */
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
    },
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Use IP + user ID if authenticated, otherwise just IP
    return req.user ? `${req.ip}:${req.user.userId}` : req.ip;
  },
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
      path: req.path,
      method: req.method,
      user: req.user ? req.user.userId : 'anonymous',
    });
    
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Per-IP rate limiting for authentication endpoints
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts, please try again later.',
    },
  },
  keyGenerator: (req) => {
    // Use IP + email to prevent brute force on specific accounts
    const email = req.body.email || 'unknown';
    return `${req.ip}:${email}`;
  },
});

/**
 * Custom rate limiter for specific endpoints with different limits
 * @param {Object} options - Rate limiting options
 * @param {number} options.points - Number of points (requests) allowed
 * @param {number} options.duration - Duration in seconds
 * @param {string} options.keyPrefix - Prefix for the rate limiter key
 * @returns {Function} Express middleware
 */
const customLimiter = (options = {}) => {
  const {
    points = 100,
    duration = 60, // seconds
    keyPrefix = 'rl',
    blockDuration = 300, // 5 minutes block on limit exceeded
  } = options;

  const limiter = new RateLimiterMemory({
    points,
    duration,
    keyPrefix,
    blockDuration,
  });

  return async (req, res, next) => {
    try {
      const key = req.user ? `${req.ip}:${req.user.userId}` : req.ip;
      const rateLimitRes = await limiter.consume(key);

      // Set rate limit headers
      res.set({
        'Retry-After': rateLimitRes.msBeforeNext / 1000,
        'X-RateLimit-Limit': points,
        'X-RateLimit-Remaining': rateLimitRes.remainingPoints,
        'X-RateLimit-Reset': new Date(Date.now() + rateLimitRes.msBeforeNext).toISOString(),
      });

      next();
    } catch (rateLimitRes) {
      // Set rate limit headers on error
      res.set({
        'Retry-After': rateLimitRes.msBeforeNext / 1000,
        'X-RateLimit-Limit': points,
        'X-RateLimit-Remaining': 0,
        'X-RateLimit-Reset': new Date(Date.now() + rateLimitRes.msBeforeNext).toISOString(),
      });

      logger.warn(`Custom rate limit exceeded`, {
        ip: req.ip,
        userId: req.user ? req.user.userId : 'anonymous',
        path: req.path,
        method: req.method,
        remainingPoints: 0,
        msBeforeNext: rateLimitRes.msBeforeNext,
      });

      return next(tooManyRequests('Too many requests, please try again later.'));
    }
  };
};

// Rate limiters for specific endpoints
const modelLimiter = customLimiter({
  points: 60, // 60 requests
  duration: 60, // per minute
  keyPrefix: 'model_limiter',
});

const codeExecutionLimiter = customLimiter({
  points: 10, // 10 requests
  duration: 60, // per minute
  keyPrefix: 'code_execution_limiter',
});

const fileUploadLimiter = customLimiter({
  points: 5, // 5 requests
  duration: 300, // per 5 minutes
  keyPrefix: 'file_upload_limiter',
});

module.exports = {
  apiLimiter,
  authLimiter,
  customLimiter,
  rateLimiter: {
    model: modelLimiter,
    codeExecution: codeExecutionLimiter,
    fileUpload: fileUploadLimiter,
  },
};
