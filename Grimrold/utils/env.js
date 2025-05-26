const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { logger } = require('../core/logger');

// Load environment variables from .env file
const loadEnv = () => {
  const envPath = path.resolve(process.cwd(), '.env');
  
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    logger.info(`Loaded environment variables from ${envPath}`);
  } else {
    logger.warn(`No .env file found at ${envPath}`);
  }
  
  // Set default NODE_ENV to 'development' if not set
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
};

/**
 * Get an environment variable
 * @param {string} key - Environment variable name
 * @param {*} defaultValue - Default value if not found
 * @returns {string} Environment variable value
 */
const getEnv = (key, defaultValue = undefined) => {
  const value = process.env[key];
  
  if (value === undefined && defaultValue === undefined) {
    logger.warn(`Environment variable ${key} is not set`);
  }
  
  return value !== undefined ? value : defaultValue;
};

/**
 * Get a required environment variable
 * @param {string} key - Environment variable name
 * @returns {string} Environment variable value
 * @throws {Error} If environment variable is not set
 */
const getRequiredEnv = (key) => {
  const value = process.env[key];
  
  if (value === undefined) {
    const error = new Error(`Required environment variable ${key} is not set`);
    logger.error(error.message);
    throw error;
  }
  
  return value;
};

/**
 * Get a boolean environment variable
 * @param {string} key - Environment variable name
 * @param {boolean} defaultValue - Default value if not found
 * @returns {boolean} Parsed boolean value
 */
const getBoolEnv = (key, defaultValue = false) => {
  const value = process.env[key];
  
  if (value === undefined) {
    return defaultValue;
  }
  
  return value.toLowerCase() === 'true';
};

/**
 * Get a number environment variable
 * @param {string} key - Environment variable name
 * @param {number} defaultValue - Default value if not found or invalid
 * @returns {number} Parsed number value
 */
const getNumberEnv = (key, defaultValue = 0) => {
  const value = process.env[key];
  
  if (value === undefined) {
    return defaultValue;
  }
  
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
};

/**
 * Get an array from an environment variable
 * @param {string} key - Environment variable name
 * @param {string} separator - Separator character (default: ',')
 * @param {Array} defaultValue - Default value if not found
 * @returns {Array} Parsed array
 */
const getArrayEnv = (key, separator = ',', defaultValue = []) => {
  const value = process.env[key];
  
  if (!value) {
    return defaultValue;
  }
  
  return value.split(separator).map(item => item.trim()).filter(Boolean);
};

/**
 * Validate required environment variables
 * @param {Array} requiredVars - Array of required environment variable names
 * @throws {Error} If any required environment variables are missing
 */
const validateEnvVars = (requiredVars = []) => {
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    const error = new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    logger.error(error.message);
    throw error;
  }
};

/**
 * Get all environment variables that match a prefix
 * @param {string} prefix - Prefix to filter environment variables
 * @returns {Object} Object with environment variables that match the prefix
 */
const getEnvByPrefix = (prefix) => {
  return Object.entries(process.env)
    .filter(([key]) => key.startsWith(prefix))
    .reduce((acc, [key, value]) => ({
      ...acc,
      [key.replace(new RegExp(`^${prefix}`), '')]: value,
    }), {});
};

module.exports = {
  loadEnv,
  getEnv,
  getRequiredEnv,
  getBoolEnv,
  getNumberEnv,
  getArrayEnv,
  validateEnvVars,
  getEnvByPrefix,
};
