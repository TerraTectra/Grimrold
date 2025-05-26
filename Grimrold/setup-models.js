const fs = require('fs');
const path = require('path');
const { createWriteStream } = require('fs');
const https = require('https');
const { execSync } = require('child_process');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);
const { finished } = require('stream/promises');
const os = require('os');
const zlib = require('zlib');
const { createGunzip } = require('zlib');

// Конфигурация для разных ОС
const PLATFORM_CONFIG = {
  'win32': {
    binaryName: 'main.exe',
    binaryUrl: 'https://github.com/ggerganov/llama.cpp/releases/download/b3117/llama-b3117-bin-win-cu122-avx-x64.zip',
    extractCommand: 'tar -xzf',
    binaryPath: 'llama-b3117-bin-win-cu122-avx-x64/main.exe'
  },
  'linux': {
    binaryName: 'main',
    binaryUrl: 'https://github.com/ggerganov/llama.cpp/releases/download/b3117/llama-b3117-bin-ubuntu-x86_64.tgz',
    extractCommand: 'tar -xzf',
    binaryPath: 'llama-b3117-bin-ubuntu-x86_64/main'
  },
  'darwin': {
    binaryName: 'main',
    binaryUrl: 'https://github.com/ggerganov/llama.cpp/releases/download/b3117/llama-b3117-bin-macos-x64.tgz',
    extractCommand: 'tar -xzf',
    binaryPath: 'llama-b3117-bin-macos-x64/main'
  }
};

const MODELS_DIR = path.join(__dirname, 'models');
const BIN_DIR = path.join(__dirname, 'bin');

// Скачивание файла
async function downloadFile(url, outputPath) {
  console.log(`Downloading ${url} to ${outputPath}...`);
  
  return new Promise((resolve, reject) => {
    const fileStream = createWriteStream(outputPath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
        return;
      }
      
      let stream = response;
      
      // Распаковываем gzip, если это архив
      if (url.endsWith('.gz') || url.endsWith('.tgz')) {
        stream = response.pipe(createGunzip());
      }
      
      stream.pipe(fileStream)
        .on('error', reject)
        .on('finish', () => {
          console.log(`Downloaded ${outputPath}`);
          resolve();
        });
    }).on('error', reject);
  });
}

// Установка бинарного файла llama.cpp
async function setupLlamaCpp() {
  const platform = os.platform();
  const config = PLATFORM_CONFIG[platform];
  
  if (!config) {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  
  const binaryPath = path.join(BIN_DIR, config.binaryName);
  
  // Создаем директорию для бинарников, если её нет
  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
  }
  
  // Если бинарник уже существует, пропускаем загрузку
  if (fs.existsSync(binaryPath)) {
    console.log('llama.cpp binary already exists, skipping download');
    return binaryPath;
  }
  
  console.log('Downloading llama.cpp binary...');
  const tempFile = path.join(BIN_DIR, 'llama-temp.zip');
  
  try {
    // Скачиваем архив
    await downloadFile(config.binaryUrl, tempFile);
    
    // Распаковываем архив
    console.log('Extracting...');
    execSync(`tar -xzf ${tempFile} -C ${BIN_DIR}`);
    
    // Копируем бинарник в нужное место
    const extractedBinary = path.join(BIN_DIR, config.binaryPath);
    fs.renameSync(extractedBinary, binaryPath);
    
    // Делаем бинарник исполняемым (для Unix-систем)
    if (platform !== 'win32') {
      fs.chmodSync(binaryPath, 0o755);
    }
    
    console.log('llama.cpp binary is ready');
    return binaryPath;
  } finally {
    // Удаляем временные файлы
    try {
      fs.unlinkSync(tempFile);
    } catch (e) {
      // Игнорируем ошибки удаления
    }
  }
}

async function setupModels() {
  // Создаем директорию для моделей, если её нет
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }

  const models = {
    'deepseek-coder': {
      name: 'DeepSeek Coder',
      url: 'https://huggingface.co/TheBloke/deepseek-coder-33B-instruct-GGUF/resolve/main/deepseek-coder-33b-instruct.Q4_K_M.gguf',
      filename: 'deepseek-coder-33b-instruct.Q4_K_M.gguf',
      path: path.join(MODELS_DIR, 'deepseek-coder')
    },
    'mistral': {
      name: 'Mistral 7B',
      url: 'https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.1-GGUF/resolve/main/mistral-7b-instruct-v0.1.Q4_K_M.gguf',
      filename: 'mistral-7b-instruct-v0.1.Q4_K_M.gguf',
      path: path.join(MODELS_DIR, 'mistral')
    }
  };

  for (const [modelId, model] of Object.entries(models)) {
    const modelPath = path.join(model.path, model.filename);
    
    // Создаем директорию для модели, если её нет
    if (!fs.existsSync(model.path)) {
      fs.mkdirSync(model.path, { recursive: true });
    }

    // Скачиваем модель, если её нет
    if (!fs.existsSync(modelPath)) {
      console.log(`Downloading ${model.name}...`);
      try {
        await downloadFile(model.url, modelPath);
        console.log(`${model.name} downloaded successfully`);
      } catch (error) {
        console.error(`Failed to download ${model.name}:`, error.message);
        continue;
      }
    } else {
      console.log(`${model.name} already exists at ${modelPath}`);
    }
    
    // Обновляем конфигурацию модели с актуальными путями
    models[modelId].modelPath = modelPath;
  }
  
  return models;
}

async function main() {
  try {
    console.log('Setting up local models...');
    
    // Устанавливаем бинарник llama.cpp
    const llamaBinaryPath = await setupLlamaCpp();
    
    // Скачиваем модели
    const models = await setupModels();
    
    console.log('\nSetup completed successfully!');
    console.log('\nAvailable models:');
    Object.entries(models).forEach(([id, model]) => {
      console.log(`- ${model.name} (${id}): ${model.modelPath}`);
    });
    
    console.log('\nTo use these models in your code:');
    console.log(`const localModelManager = require('./core/local-model-manager');`);
    console.log(`const response = await localModelManager.generateResponse('deepseek-coder', 'Your prompt here');`);
    
  } catch (error) {
    console.error('Error during setup:', error);
    process.exit(1);
  }
}

main();
