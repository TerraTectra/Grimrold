const path = require('path');
require('dotenv').config();

const config = {
  // Server configuration
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  host: process.env.HOST || '0.0.0.0',
  
  // Security
  apiKey: process.env.API_KEY,
  allowedOrigins: process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) : 
    ['*'],
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX || 100, // Limit each IP to 100 requests per windowMs
  },
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  logDirectory: path.join(__dirname, '../logs'),
  
  // AI Models
  defaultModel: process.env.DEFAULT_MODEL || 'default',
  
  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4',
    organization: process.env.OPENAI_ORGANIZATION,
  },
  
  // Google AI Configuration
  google: {
    apiKey: process.env.GOOGLE_API_KEY,
    defaultModel: process.env.GOOGLE_DEFAULT_MODEL || 'gemini-pro',
  },
  
  // Hugging Face Configuration
  huggingface: {
    apiKey: process.env.HUGGINGFACE_API_KEY,
    defaultModel: process.env.HUGGINGFACE_DEFAULT_MODEL || 'gpt2',
  },
  
  // Session and Conversation
  session: {
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    ttl: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  },
  
  // Feature flags
  features: {
    codeExecution: process.env.FEATURE_CODE_EXECUTION !== 'false',
    fileUploads: process.env.FEATURE_FILE_UPLOADS !== 'false',
    webSearch: process.env.FEATURE_WEB_SEARCH !== 'false',
  },
  
  // Paths
  paths: {
    models: path.join(__dirname, '../models'),
    plugins: path.join(__dirname, '../plugins'),
    uploads: path.join(__dirname, '../uploads'),
    temp: path.join(__dirname, '../temp'),
  },
  
  // API Versioning
  apiVersion: '1.0',
  
  // Development settings
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production',
};

// Validate required configuration
const validateConfig = () => {
  const required = [
    // Add any required configuration keys here
  ];
  
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
};

// Create necessary directories
const ensureDirectories = () => {
  const { logDirectory, paths } = config;
  const fs = require('fs');
  
  [logDirectory, ...Object.values(paths)].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Initialize
const init = () => {
  if (config.isDevelopment) {
    console.log('Running in development mode');
  } else {
    console.log('Running in production mode');
  }
  
  validateConfig();
  ensureDirectories();
  
  return config;
};

module.exports = {
  ...config,
  init,
  validateConfig,
  ensureDirectories,
};
