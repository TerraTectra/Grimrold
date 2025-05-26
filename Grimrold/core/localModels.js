const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const { withRetry } = require('../utils/asyncUtils');
const logger = require('./logger');
const { ApiError } = require('../middleware/errorHandler');

class LocalModelManager {
  constructor() {
    this.models = new Map();
    this.processes = new Map();
    this.initialized = false;
    this.llamaCppPath = path.join(__dirname, '..', 'llama.cpp');
    this.modelsPath = path.join(__dirname, '..', 'models');
    
    // Model configurations
    this.modelConfigs = {
      'deepseek-coder': {
        name: 'DeepSeek Coder',
        description: 'Local DeepSeek Coder model',
        type: 'code',
        modelFile: 'deepseek-coder-33b-instruct.Q4_K_M.gguf',
        downloadUrl: 'https://huggingface.co/TheBloke/deepseek-coder-33B-instruct-GGUF/resolve/main/deepseek-coder-33b-instruct.Q4_K_M.gguf',
        args: ['-m', 'deepseek-coder-33b-instruct.Q4_K_M.gguf', '--ctx-size', '4096', '--temp', '0.7']
      },
      'mistral': {
        name: 'Mistral 7B',
        description: 'Local Mistral 7B model',
        type: 'text',
        modelFile: 'mistral-7b-instruct-v0.1.Q4_K_M.gguf',
        downloadUrl: 'https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.1-GGUF/resolve/main/mistral-7b-instruct-v0.1.Q4_K_M.gguf',
        args: ['-m', 'mistral-7b-instruct-v0.1.Q4_K_M.gguf', '--ctx-size', '4096', '--temp', '0.7']
      }
    };
  }

  /**
   * Initialize the local model manager
   */
  async initialize() {
    if (this.initialized) return;

    try {
      logger.info('Initializing local model manager...');
      
      // Ensure models directory exists
      await fs.mkdir(this.modelsPath, { recursive: true });
      
      // Setup llama.cpp
      await this.setupLlamaCpp();
      
      // Setup models
      await this.setupModels();
      
      this.initialized = true;
      logger.info(`Local model manager initialized with ${this.models.size} models`);
    } catch (error) {
      logger.error('Failed to initialize local model manager:', error);
      throw new ApiError(500, 'Failed to initialize local model manager', 'LOCAL_MODEL_INIT_ERROR', {
        message: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Setup llama.cpp
   */
  async setupLlamaCpp() {
    try {
      await fs.access(path.join(this.llamaCppPath, 'main'));
      logger.info('llama.cpp is already set up');
      return;
    } catch {
      logger.info('Setting up llama.cpp...');
      
      // Clone llama.cpp
      await this.runCommand('git', ['clone', '--depth', '1', 'https://github.com/ggerganov/llama.cpp.git'], 
        { cwd: path.dirname(this.llamaCppPath) });
      
      // Build llama.cpp
      if (process.platform === 'win32') {
        await this.runCommand('cmake', ['-B', 'build', '-DLLAMA_CUBLAS=on'], { cwd: this.llamaCppPath });
        await this.runCommand('cmake', ['--build', 'build', '--config', 'Release'], { cwd: this.llamaCppPath });
      } else {
        await this.runCommand('make', ['-j'], { cwd: this.llamaCppPath });
      }
      
      logger.info('Successfully built llama.cpp');
    }
  }

  /**
   * Setup models
   */
  async setupModels() {
    for (const [modelId, config] of Object.entries(this.modelConfigs)) {
      try {
        const modelDir = path.join(this.modelsPath, modelId);
        await fs.mkdir(modelDir, { recursive: true });
        
        const modelPath = path.join(modelDir, config.modelFile);
        
        // Check if model exists
        try {
          await fs.access(modelPath);
          logger.info(`Model ${modelId} already exists at ${modelPath}`);
        } catch {
          // Download the model
          logger.info(`Downloading ${modelId} model...`);
          await this.downloadModel(config.downloadUrl, modelPath);
        }
        
        // Register the model
        this.models.set(modelId, {
          ...config,
          path: modelPath,
          command: process.platform === 'win32' ? 'main.exe' : './main',
          args: config.args.map(arg => arg === config.modelFile ? modelPath : arg)
        });
        
        logger.info(`Registered model: ${modelId}`);
      } catch (error) {
        logger.error(`Failed to setup model ${modelId}:`, error);
      }
    }
  }

  /**
   * Download a model
   */
  async downloadModel(url, outputPath) {
    const { default: fetch } = await import('node-fetch');
    const { createWriteStream } = require('fs');
    const { pipeline } = require('stream/promises');
    
    logger.info(`Downloading model from ${url} to ${outputPath}...`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download model: ${response.statusText}`);
    }
    
    await pipeline(
      response.body,
      createWriteStream(outputPath)
    );
    
    logger.info(`Successfully downloaded model to ${outputPath}`);
  }

  /**
   * Generate a response using a local model
   */
  async generateResponse(modelId, messages, options = {}) {
    if (!this.models.has(modelId)) {
      throw new ApiError(404, `Model ${modelId} not found`, 'MODEL_NOT_FOUND');
    }
    
    const model = this.models.get(modelId);
    const prompt = this.formatPrompt(messages);
    
    try {
      const response = await this.runModel(model, prompt, options);
      return {
        model: modelId,
        choices: [{
          message: {
            role: 'assistant',
            content: response
          }
        }]
      };
    } catch (error) {
      logger.error(`Error generating response with model ${modelId}:`, error);
      throw new ApiError(500, 'Failed to generate response', 'GENERATION_ERROR', {
        model: modelId,
        error: error.message
      });
    }
  }

  /**
   * Format messages into a prompt
   */
  formatPrompt(messages) {
    return messages.map(m => `${m.role}: ${m.content}`).join('\n') + '\nassistant:';
  }

  /**
   * Run a model with the given prompt
   */
  runModel(model, prompt, options = {}) {
    return new Promise((resolve, reject) => {
      const args = [
        ...model.args,
        '--prompt', prompt,
        '--temp', options.temperature || '0.7',
        '--n-predict', options.max_tokens || '2048'
      ];
      
      const process = spawn(
        path.join(this.llamaCppPath, 'build', 'bin', model.command),
        args,
        { cwd: path.dirname(model.path) }
      );
      
      let output = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        logger.error(`Model ${model.id} error: ${data}`);
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          // Extract just the assistant's response
          const response = output.split('assistant:').pop().trim();
          resolve(response);
        } else {
          reject(new Error(`Model process exited with code ${code}`));
        }
      });
      
      process.on('error', (error) => {
        reject(error);
      });
      
      // Store the process for potential cleanup
      this.processes.set(model.id, process);
    });
  }

  /**
   * Run a command and return its output
   */
  runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, { 
        ...options, 
        shell: true,
        stdio: 'inherit' 
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with code ${code}`));
        }
      });
      
      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    for (const [modelId, process] of this.processes.entries()) {
      try {
        process.kill();
        logger.info(`Stopped model process: ${modelId}`);
      } catch (error) {
        logger.error(`Error stopping model process ${modelId}:`, error);
      }
    }
    this.processes.clear();
  }
}

// Create a singleton instance
const localModelManager = new LocalModelManager();

// Handle process termination
process.on('SIGINT', async () => {
  await localModelManager.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await localModelManager.cleanup();
  process.exit(0);
});

module.exports = localModelManager;
