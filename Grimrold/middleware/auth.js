const jwt = require('jsonwebtoken');
const { ApiError, unauthorized, forbidden } = require('./errorHandler');
const config = require('../config/config');
const logger = require('../core/logger');

/**
 * Middleware to verify JWT token from Authorization header
 */
const authenticate = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw unauthorized('No token provided or invalid token format');
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      throw unauthorized('No token provided');
    }
    
    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Attach user to request object
    req.user = decoded;
    
    // Log successful authentication
    logger.info(`User ${decoded.userId} authenticated`, { 
      ip: req.ip, 
      userAgent: req.get('user-agent') 
    });
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(unauthorized('Token has expired'));
    }
    if (error.name === 'JsonWebTokenError') {
      return next(unauthorized('Invalid token'));
    }
    next(error);
  }
};

/**
 * Middleware to check if user has required roles
 * @param {...string} roles - List of allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(unauthorized('User not authenticated'));
    }
    
    if (!roles.includes(req.user.role)) {
      return next(forbidden('Insufficient permissions'));
    }
    
    next();
  };
};

/**
 * Middleware to verify API key from header
 */
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return next(unauthorized('API key is required'));
  }
  
  if (apiKey !== config.apiKey) {
    return next(forbidden('Invalid API key'));
  }
  
  next();
};

/**
 * Generate JWT token for a user
 * @param {Object} user - User object
 * @param {string} expiresIn - Token expiration time
 * @returns {string} JWT token
 */
const generateToken = (user, expiresIn = '1d') => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role || 'user'
  };
  
  return jwt.sign(payload, config.jwt.secret, { 
    expiresIn,
    issuer: 'grimrold-api'
  });
};

/**
 * Generate refresh token
 * @param {Object} user - User object
 * @returns {string} Refresh token
 */
const generateRefreshToken = (user) => {
  const payload = {
    userId: user.id,
    tokenType: 'refresh'
  };
  
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn || '7d',
    issuer: 'grimrold-api'
  });
};

/**
 * Verify refresh token
 * @param {string} token - Refresh token
 * @returns {Object} Decoded token
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret);
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

module.exports = {
  authenticate,
  authorize,
  apiKeyAuth,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken
};
