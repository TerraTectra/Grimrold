const modelManager = require('./modelManager');
const { v4: uuidv4 } = require('uuid');

class Grimoire {
  constructor() {
    this.conversations = new Map();
    this.defaultModel = process.env.DEFAULT_MODEL || 'default';
    this.rateLimit = {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100, // Max requests per window per IP
      store: new Map(),
    };
  }


  async initialize() {
    console.log('Initializing Grimoire AI...');
    
    // Clean up old conversations periodically
    this.cleanupInterval = setInterval(
      () => this.cleanupOldConversations(),
      30 * 60 * 1000 // 30 minutes
    );
    
    console.log('Grimoire AI initialized');
  }

  async shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    console.log('Grimoire AI shutdown complete');
  }

  async cleanupOldConversations(maxAgeHours = 24) {
    const now = new Date();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    let removedCount = 0;

    for (const [id, conversation] of this.conversations.entries()) {
      const lastUpdated = new Date(conversation.updatedAt);
      if (now - lastUpdated > maxAgeMs) {
        this.conversations.delete(id);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} old conversations`);
    }
    
    return removedCount;
  }

  async createConversation(modelId = null, options = {}) {
    const conversationId = options.conversationId || uuidv4();
    const model = modelId ? modelManager.getModel(modelId) : modelManager.getModel(this.defaultModel);
    
    const conversation = {
      id: conversationId,
      model: model,
      messages: [],
      metadata: {
        userAgent: options.userAgent,
        ipAddress: options.ipAddress,
        ...options.metadata
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.conversations.set(conversationId, conversation);
    return conversation;
  }

  async processMessage(conversationId, message, options = {}) {
    if (!this.conversations.has(conversationId)) {
      throw new Error('Conversation not found');
    }

    const conversation = this.conversations.get(conversationId);
    
    // Add user message to conversation
    const userMessage = {
      id: uuidv4(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      metadata: options.metadata || {}
    };
    
    conversation.messages.push(userMessage);
    conversation.updatedAt = new Date().toISOString();

    try {
      // Process the message using the appropriate model
      const startTime = Date.now();
      const response = await this.generateResponse(conversation, options);
      const processingTime = Date.now() - startTime;
      
      // Add AI response to conversation
      const assistantMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
        metadata: {
          model: conversation.model.id,
          processingTimeMs: processingTime,
          tokens: response.length / 4, // Rough estimate
          ...(options.metadata || {})
        }
      };
      
      conversation.messages.push(assistantMessage);
      conversation.updatedAt = new Date().toISOString();
      
      return {
        response: assistantMessage.content,
        conversationId,
        model: conversation.model.id,
        messageId: assistantMessage.id,
        timestamp: assistantMessage.timestamp,
        metadata: assistantMessage.metadata
      };
    } catch (error) {
      console.error('Error processing message:', error);
      
      // Add error to conversation
      const errorMessage = {
        id: uuidv4(),
        role: 'system',
        content: `Error: ${error.message}`,
        timestamp: new Date().toISOString(),
        isError: true,
        error: {
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      };
      
      conversation.messages.push(errorMessage);
      conversation.updatedAt = new Date().toISOString();
      
      throw error;
    }
  }

  async generateResponse(conversation, options = {}) {
    const { model } = conversation;
    const messages = this.prepareMessages(conversation.messages);
    
    try {
      switch (model.provider) {
        case 'openai':
          return await this.generateWithOpenAI(messages, model, options);
        case 'google':
          return await this.generateWithGoogle(messages, model, options);
        case 'huggingface':
          return await this.generateWithHuggingFace(messages, model, options);
        default:
          return await this.generateWithDefault(messages, model, options);
      }
    } catch (error) {
      console.error(`Error generating response with ${model.provider || 'default'} model:`, error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  prepareMessages(messages) {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      name: msg.metadata?.username || undefined
    }));
  }

  async generateWithOpenAI(messages, model, options) {
    const client = modelManager.getClient('openai');
    const params = {
      model: model.name,
      messages,
      ...model.parameters,
      ...options
    };

    const response = await client.chat.completions.create(params);
    return response.choices[0]?.message?.content || 'No response generated';
  }

  async generateWithGoogle(messages, model, options) {
    const client = modelManager.getClient('google');
    const genModel = client.getGenerativeModel({
      model: model.name,
      ...model.parameters,
      ...options
    });

    // Convert messages to Google's format
    const chat = genModel.startChat({
      history: messages.slice(0, -1).map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }))
    });

    const result = await chat.sendMessage(messages[messages.length - 1].content);
    return result.response.text();
  }

  async generateWithHuggingFace(messages, model, options) {
    const client = modelManager.getClient('huggingface');
    const response = await client.textGeneration({
      inputs: messages.map(m => `${m.role}: ${m.content}`).join('\n') + '\nassistant:',
      parameters: {
        ...model.parameters,
        ...options,
        return_full_text: false
      }
    });
    
    return response.generated_text;
  }

  async generateWithDefault(messages, model, options) {
    // Default implementation for models without a specific provider
    const lastMessage = messages[messages.length - 1];
    return `Model "${model.id}" received: ${lastMessage.content}`;
  }

  // Backward compatibility
  async askGrimoire(message, options = {}) {
    let conversation;
    
    if (options.conversationId && this.conversations.has(options.conversationId)) {
      conversation = this.conversations.get(options.conversationId);
    } else {
      conversation = await this.createConversation(options.modelId, options);
    }
    
    const { response } = await this.processMessage(conversation.id, message, options);
    return response;
  }

  // Utility methods
  getConversation(conversationId) {
    return this.conversations.get(conversationId);
  }

  deleteConversation(conversationId) {
    return this.conversations.delete(conversationId);
  }

  listConversations(limit = 50) {
    return Array.from(this.conversations.values())
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, limit);
  }
}

// Export a singleton instance
const grimoire = new Grimoire();

// Initialize when required
if (require.main === module) {
  grimoire.initialize();
  
  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down Grimoire AI...');
    await grimoire.shutdown();
    process.exit(0);
  };
  
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = {
  grimoire,
  askGrimoire: (message, options) => grimoire.askGrimoire(message, options)
};