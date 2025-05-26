const path = require('path');
const logger = require('./logger');
const { ApiError } = require('../middleware/errorHandler');
const LocalModelManager = require('./local-model-manager');

class ModelManager {
  constructor() {
    this.localModelManager = new LocalModelManager();
    this.initialized = false;
    this.initializationPromise = null;
  }

  /**
   * Initialize the model manager and check model availability
   * @returns {Promise<void>}
   */
  async initializeModels() {
    if (this.initialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        logger.info('Initializing model manager...');
        
        // Initialize local model manager
        await this.localModelManager.initialize();
        
        // Log available models and their status
        const availableModels = await this.localModelManager.listModels();
        logger.info('Available models:');
        
        availableModels.forEach(model => {
          logger.info(`- ${model.name} (${model.id}): ${model.status}`);
          if (model.status === 'error' && model.error) {
            logger.warn(`  Error: ${model.error}`);
          }
        });
        
        this.initialized = true;
        logger.info('Model manager initialized successfully');
        
        if (availableModels.every(m => m.status !== 'ready')) {
          logger.warn('No models are ready to use. Run "npm run setup-models" to download and set up the models');
        }
      } catch (error) {
        const errorMessage = 'Failed to initialize model manager';
        logger.error(errorMessage, error);
        throw new ApiError(500, errorMessage, 'MODEL_INIT_ERROR', {
          message: error.message,
          stack: error.stack
        });
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  /**
   * List all available models with their status
   * @returns {Promise<Array>} Array of model objects with status
   */
  async listModels() {
    if (!this.initialized) {
      await this.initializeModels();
    }
    return this.localModelManager.listModels();
  }
  
  /**
   * Check if a specific model is available
   * @param {string} modelId - The ID of the model to check
   * @returns {Promise<boolean>} True if the model is available
   */
  async isModelAvailable(modelId) {
    if (!this.initialized) {
      await this.initializeModels();
    }
    return this.localModelManager.checkModel(modelId);
  }
  
  /**
   * Generate a response using the specified model
   * @param {string} modelId - The ID of the model to use
   * @param {string} prompt - The input prompt
   * @param {Object} options - Additional options for generation
   * @param {number} [options.temperature=0.7] - Temperature for sampling
   * @param {number} [options.top_p=0.9] - Top-p sampling parameter
   * @param {number} [options.max_tokens=2048] - Maximum number of tokens to generate
   * @returns {Promise<string>} The generated response
   */
  async generateResponse(modelId, prompt, options = {}) {
    if (!this.initialized) {
      await this.initializeModels();
    }

    try {
      // Check if model exists
      const availableModels = await this.listModels();
      const modelInfo = availableModels.find(m => m.id === modelId);
      
      if (!modelInfo) {
        throw new ApiError(
          404,
          `Model "${modelId}" not found`,
          'MODEL_NOT_FOUND',
          { availableModels: availableModels.map(m => m.id) }
        );
      }
      
      // Check model availability
      if (modelInfo.status !== 'ready') {
        throw new ApiError(
          503,
          `Model "${modelId}" is not available (status: ${modelInfo.status})`,
          'MODEL_NOT_AVAILABLE',
          { 
            modelId,
            status: modelInfo.status,
            error: modelInfo.error,
            solution: 'Run "npm run setup-models" to download and set up the models'
          }
        );
      }
      
      logger.info(`Generating response with model: ${modelId}`);
      const startTime = Date.now();
      
      // Generate the response
      const response = await this.localModelManager.generateResponse(
        modelId, 
        prompt, 
        {
          temperature: options.temperature,
          top_p: options.top_p,
          max_tokens: options.max_tokens,
          repeat_penalty: options.repeat_penalty
        }
      );
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(`Generated response in ${duration}s`);
      
      return response;
    } catch (error) {
      const errorMessage = `Error generating response from model ${modelId}`;
      logger.error(errorMessage, error);
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError(
        500,
        `${errorMessage}: ${error.message}`,
        'GENERATION_ERROR',
        { 
          modelId,
          error: error.message,
          stack: error.stack 
        }
      );
    }
  }
}

module.exports = ModelManager;
