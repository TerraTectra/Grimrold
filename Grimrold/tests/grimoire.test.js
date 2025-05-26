const { grimoire } = require('../core/grimoire');

describe('Grimoire', () => {
  beforeAll(async () => {
    await grimoire.initialize();
  });

  test('should create a new conversation', async () => {
    const conversation = await grimoire.createConversation();
    expect(conversation).toHaveProperty('id');
    expect(conversation).toHaveProperty('model');
    expect(conversation.messages).toHaveLength(0);
  });

  test('should process a message', async () => {
    const conversation = await grimoire.createConversation();
    const result = await grimoire.processMessage(conversation.id, 'Hello, Grimrold!');
    
    expect(result).toHaveProperty('response');
    expect(result).toHaveProperty('conversationId', conversation.id);
    expect(result).toHaveProperty('model', 'default');
  });

  test('should maintain conversation history', async () => {
    const conversation = await grimoire.createConversation();
    
    // Send first message
    await grimoire.processMessage(conversation.id, 'Hello');
    
    // Send second message
    const result = await grimoire.processMessage(conversation.id, 'How are you?');
    
    expect(result.response).toBeDefined();
    expect(conversation.messages).toHaveLength(4); // 2 user messages + 2 assistant responses
  });

  test('should throw error for non-existent conversation', async () => {
    await expect(grimoire.processMessage('non-existent-id', 'Hello'))
      .rejects
      .toThrow('Conversation not found');
  });
});
