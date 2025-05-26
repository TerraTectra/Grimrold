require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { grimoire } = require('./core/grimoire');
const { executeCode } = require('./plugins/deepseek');
const modelManager = require('./core/modelManager');
const logger = require('./core/logger');

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request logging
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// Body parsing
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Initialize Grimoire
grimoire.initialize().catch(error => {
  logger.error('Failed to initialize Grimoire:', error);
  process.exit(1);
});

// API Routes
app.post('/api/conversations', async (req, res, next) => {
  try {
    const { modelId } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    
    const conversation = await grimoire.createConversation(modelId, {
      ipAddress: ip,
      userAgent: req.get('user-agent'),
      metadata: {
        source: 'api',
        client: req.get('x-client-id') || 'unknown'
      }
    });
    
    logger.info(`Created new conversation ${conversation.id} for IP ${ip}`);
    
    res.status(201).json({
      conversationId: conversation.id,
      model: conversation.model.id,
      createdAt: conversation.createdAt
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/conversations/:conversationId/messages', async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { message, options = {} } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ 
        error: 'Message is required and must be a string',
        code: 'INVALID_MESSAGE'
      });
    }

    logger.info(`Processing message in conversation ${conversationId}`);
    
    const result = await grimoire.processMessage(conversationId, message, {
      ...options,
      metadata: {
        ...(options.metadata || {}),
        ip: req.ip,
        userAgent: req.get('user-agent')
      }
    });
    
    res.json({
      response: result.response,
      conversationId: result.conversationId,
      model: result.model,
      messageId: result.messageId,
      timestamp: result.timestamp,
      metadata: result.metadata
    });
  } catch (error) {
    if (error.message === 'Conversation not found') {
      return res.status(404).json({ 
        error: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND'
      });
    }
    next(error);
  }
});

// Backward compatibility
app.post('/ask', apiLimiter, async (req, res, next) => {
  try {
    const { message, conversationId } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        error: 'Message is required',
        code: 'MISSING_MESSAGE'
      });
    }
    
    logger.info(`Processing legacy /ask request`);
    
    const response = await grimoire.askGrimoire(message, {
      conversationId,
      metadata: {
        source: 'legacy_api',
        ip: req.ip,
        userAgent: req.get('user-agent')
      }
    });
    
    res.json({ reply: response });
  } catch (error) {
    next(error);
  }
});

// Code execution endpoint (protected by API key)
app.post('/code', async (req, res, next) => {
  try {
    // Verify API key for code execution
    const apiKey = req.get('x-api-key');
    if (apiKey !== process.env.API_KEY) {
      return res.status(403).json({ 
        error: 'Invalid or missing API key',
        code: 'INVALID_API_KEY'
      });
    }
    
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ 
        error: 'Code is required',
        code: 'MISSING_CODE'
      });
    }
    
    logger.info('Executing code');
    const result = await executeCode(code);
    
    res.json({ 
      success: true,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Code execution error:', error);
    next(error);
  }
});

// Model management endpoints
app.get('/api/models', (req, res) => {
  try {
    const models = modelManager.getEnabledModels().map(model => ({
      id: model.id,
      name: model.name,
      type: model.type,
      description: model.description,
      parameters: model.parameters,
      provider: model.provider || 'custom',
      createdAt: model.createdAt || new Date().toISOString()
    }));
    
    res.json({ 
      success: true,
      count: models.length,
      models 
    });
  } catch (error) {
    next(error);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    env: process.env.NODE_ENV || 'development'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    code: 'NOT_FOUND',
    path: req.path,
    method: req.method
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  
  logger.error(`Error: ${err.message}`, {
    stack: isProduction ? undefined : err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    params: req.params
  });
  
  res.status(statusCode).json({
    error: isProduction && statusCode >= 500 ? 'Internal Server Error' : err.message,
    code: err.code || 'INTERNAL_SERVER_ERROR',
    ...(!isProduction && { stack: err.stack })
  });
});

// Start the server
const PORT = parseInt(process.env.PORT || '3000', 10);
const server = app.listen(PORT, '0.0.0.0', () => {
  const { address, port } = server.address();
  logger.info(`Grimrold v${process.env.npm_package_version} server running at http://${address}:${port}`);
  
  // Log available models
  const models = modelManager.getEnabledModels();
  logger.info(`Loaded ${models.length} models: ${models.map(m => m.id).join(', ')}`);
  
  // Log environment
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Log memory usage
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  logger.info(`Memory usage: ${Math.round(used * 100) / 100} MB`);
});

// Handle server errors
server.on('error', (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof PORT === 'string' ? `Pipe ${PORT}` : `Port ${PORT}`;

  // Handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      logger.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Consider restarting the process in production
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Consider restarting the process in production
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down Grimrold server...');
  
  try {
    // Close the server first to stop accepting new connections
    server.close(async (err) => {
      if (err) {
        logger.error('Error during server close:', err);
        process.exit(1);
      }
      
      // Clean up resources
      await grimoire.shutdown();
      logger.info('Server shutdown complete');
      process.exit(0);
    });
    
    // Force close after timeout
    setTimeout(() => {
      logger.error('Forcing server shutdown after timeout');
      process.exit(1);
    }, 10000);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle termination signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);