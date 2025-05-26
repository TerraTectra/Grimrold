# Grimrold AI Assistant Framework

Grimrold is a modular AI assistant framework that supports multiple AI models and conversation management. It provides a RESTful API for interacting with various AI models and managing conversations.

## Features

- 🚀 Multiple AI model support
- 💬 Conversation management
- 🔌 Plugin system for extending functionality
- 🔒 Secure API endpoints
- 📊 Built-in logging and monitoring

## Getting Started

### Prerequisites

- Node.js 14.0.0 or higher
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/grimrold.git
   cd grimrold
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy and configure the environment file:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

### Running the Server

```bash
# Development mode with hot-reload
npm run dev

# Production mode
npm start
```

## API Documentation

### Base URL
All API endpoints are prefixed with `/api`.

### Authentication
Include your API key in the `Authorization` header:
```
Authorization: Bearer your-api-key
```

### Endpoints

#### Create a New Conversation
```
POST /api/conversations
```

**Request Body:**
```json
{
  "modelId": "default"
}
```

**Response:**
```json
{
  "conversationId": "uuid-here",
  "model": "default",
  "createdAt": "2023-01-01T00:00:00.000Z"
}
```

#### Send a Message
```
POST /api/conversations/:conversationId/messages
```

**Request Body:**
```json
{
  "message": "Hello, Grimrold!"
}
```

**Response:**
```json
{
  "response": "Hello! How can I assist you today?",
  "conversationId": "uuid-here",
  "model": "default",
  "timestamp": "2023-01-01T00:00:01.000Z"
}
```

#### List Available Models
```
GET /api/models
```

**Response:**
```json
{
  "models": [
    {
      "id": "default",
      "name": "Default Model",
      "type": "completion",
      "description": "Default completion model for general purpose tasks",
      "parameters": {
        "temperature": 0.7,
        "max_tokens": 1500,
        "top_p": 1,
        "frequency_penalty": 0,
        "presence_penalty": 0
      },
      "enabled": true
    }
  ]
}
```

## Project Structure

```
grimrold/
├── core/                  # Core framework functionality
│   ├── grimoire.js        # Main Grimoire class
│   ├── modelManager.js    # Model management
│   └── memory.json        # Persistent memory storage
├── models/                # Model configurations
│   └── default.json       # Default model configuration
├── plugins/               # Plugins for extended functionality
│   ├── deepseek.js        # Code execution plugin
│   └── docs.js            # Documentation plugin
├── tests/                 # Test files
├── ui/                    # Web interface (future)
├── .env                   # Environment variables
├── .gitignore
├── package.json
└── server.js              # Main server file
```

## Development

### Adding a New Model

1. Create a new JSON file in the `models` directory, e.g., `gpt-4.json`
2. Define the model configuration:
   ```json
   {
     "id": "gpt-4",
     "name": "GPT-4",
     "type": "chat",
     "description": "OpenAI's GPT-4 model",
     "parameters": {
       "temperature": 0.7,
       "max_tokens": 2000
     },
     "enabled": true
   }
   ```
3. The model will be automatically loaded on server start

### Creating a Plugin

1. Create a new file in the `plugins` directory, e.g., `myplugin.js`
2. Export your plugin functions:
   ```javascript
   async function myFunction(param) {
     // Plugin logic here
     return { result: 'success' };
   }

   module.exports = { myFunction };
   ```
3. Import and use it in your code:
   ```javascript
   const { myFunction } = require('./plugins/myplugin');
   ```

## Testing

Run the test suite:

```bash
npm test
```

## License

MIT
 v9.5 — Полная структура
## API:
- POST /ask { message }
- POST /code { code }

## Установка:
1. Двойной клик install.bat
2. Переход по адресу http://localhost:3000

## Структура:
- core/ — интеллект, память
- plugins/ — модули
- agents/, mutate/, logs/, ui/
- models/ — сюда положи .gguf-модели