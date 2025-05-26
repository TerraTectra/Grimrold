const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const logger = require('./logger');

class LocalModelManager {
  constructor() {
    this.modelsDir = path.join(process.cwd(), 'models');
    this.binDir = path.join(process.cwd(), 'bin');
    this.binaryName = process.platform === 'win32' ? 'main.exe' : 'main';
    this.binaryPath = path.join(this.binDir, this.binaryName);
    
    this.models = {
      'deepseek-coder': {
        name: 'DeepSeek Coder',
        model: 'deepseek-coder-33b-instruct.Q4_K_M.gguf',
        path: path.join(this.modelsDir, 'deepseek-coder'),
        args: [
          '-m', 'deepseek-coder-33b-instruct.Q4_K_M.gguf',
          '--ctx-size', '4096',
          '--temp', '0.7',
          '--top-p', '0.9',
          '--repeat_penalty', '1.1'
        ]
      },
      'mistral': {
        name: 'Mistral 7B',
        model: 'mistral-7b-instruct-v0.1.Q4_K_M.gguf',
        path: path.join(this.modelsDir, 'mistral'),
        args: [
          '-m', 'mistral-7b-instruct-v0.1.Q4_K_M.gguf',
          '--ctx-size', '4096',
          '--temp', '0.7',
          '--top-p', '0.9',
          '--repeat_penalty', '1.1'
        ]
      }
    };
  }

  async checkModel(modelId) {
    const model = this.models[modelId];
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }
    
    try {
      // Проверяем наличие бинарного файла
      await fs.access(this.binaryPath);
      
      // Проверяем наличие модели
      const modelPath = path.join(model.path, model.model);
      await fs.access(modelPath);
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Lists all available models and their status
   * @returns {Promise<Array>} Array of model objects with status
   */
  async listModels() {
    const results = [];
    
    for (const [id, model] of Object.entries(this.models)) {
      const modelPath = path.join(model.path, model.model);
      let status = 'not_installed';
      let error = null;
      
      try {
        await fs.access(modelPath);
        await fs.access(this.binaryPath);
        status = 'ready';
      } catch (err) {
        error = err.message;
        status = 'error';
      }
      
      results.push({
        id,
        name: model.name,
        status,
        path: model.path,
        modelFile: model.model,
        error: error || undefined
      });
    }
    
    return results;
  }

  async generateResponse(modelId, prompt, options = {}) {
    const model = this.models[modelId];
    if (!model) {
      throw new Error(`Model ${modelId} not found. Available models: ${Object.keys(this.models).join(', ')}`);
    }

    // Check model and binary availability
    if (!await this.checkModel(modelId)) {
      const availableModels = await this.listModels();
      const status = availableModels.find(m => m.id === modelId)?.status || 'not_found';
      throw new Error(`Model ${modelId} is not available (status: ${status}). Run setup first.`);
    }

    return new Promise((resolve, reject) => {
      try {
        const modelPath = path.join(model.path, model.model);
        
        // Подготавливаем аргументы для запуска
        const args = [
          ...model.args,
          '--temp', String(options.temperature || 0.7),
          '--top-p', String(options.top_p || 0.9),
          '--repeat_penalty', String(options.repeat_penalty || 1.1),
          '-p', prompt
        ];
        
        // Заменяем плейсхолдер пути к модели
        const processedArgs = args.map(arg => 
          arg === `-m` ? arg : arg.replace(/\$\{MODEL_PATH\}/g, modelPath)
        );

        console.log(`Starting model with command: ${this.binaryPath} ${processedArgs.join(' ')}`);
        
        const process = spawn(this.binaryPath, processedArgs, {
          cwd: model.path,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let errorOutput = '';
        
        process.stdout.on('data', (data) => {
          output += data.toString();
          process.stdout.write(data); // Вывод в реальном времени
        });
        
        process.stderr.on('data', (data) => {
          errorOutput += data.toString();
          process.stderr.write(data); // Вывод ошибок в реальном времени
        });

        process.on('close', (code) => {
          if (code === 0) {
            resolve(output.trim());
          } else {
            reject(new Error(`Model process exited with code ${code}\n${errorOutput}`));
          }
        });

        process.on('error', (error) => {
          reject(new Error(`Failed to start model process: ${error.message}\n${errorOutput}`));
        });
        
        // Если нужно отправить данные в stdin (если потребуется в будущем)
        if (options.input) {
          process.stdin.write(options.input);
          process.stdin.end();
        }
        
      } catch (error) {
        reject(new Error(`Error generating response: ${error.message}`));
      }
    });
  }
}

module.exports = new LocalModelManager();
