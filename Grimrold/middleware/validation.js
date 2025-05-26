const { celebrate, Joi, Segments } = require('celebrate');
const { ObjectId } = require('mongodb');

// Custom Joi validators
const customJoi = Joi.extend((joi) => ({
  type: 'objectId',
  base: joi.string(),
  messages: {
    'objectId.base': '{{#label}} must be a valid ObjectId',
  },
  validate(value, helpers) {
    if (!ObjectId.isValid(value)) {
      return { value, errors: helpers.error('objectId.base') };
    }
    return { value: new ObjectId(value) };
  },
}));

// Common validation schemas
const schemas = {
  // Authentication
  login: {
    [Segments.BODY]: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
    }),
  },
  
  register: {
    [Segments.BODY]: Joi.object({
      name: Joi.string().min(2).max(50).required(),
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
      role: Joi.string().valid('user', 'admin').default('user'),
    }),
  },
  
  // Conversation
  createConversation: {
    [Segments.BODY]: Joi.object({
      modelId: Joi.string().required(),
      title: Joi.string().max(100),
      metadata: Joi.object(),
    }),
  },
  
  sendMessage: {
    [Segments.PARAMS]: Joi.object({
      conversationId: customJoi.objectId().required(),
    }),
    [Segments.BODY]: Joi.object({
      message: Joi.string().required(),
      options: Joi.object({
        temperature: Joi.number().min(0).max(2).default(0.7),
        maxTokens: Joi.number().integer().min(1).max(4000),
        topP: Joi.number().min(0).max(1).default(1),
        frequencyPenalty: Joi.number().min(-2).max(2).default(0),
        presencePenalty: Joi.number().min(-2).max(2).default(0),
        stop: Joi.alternatives().try(
          Joi.string(),
          Joi.array().items(Joi.string())
        ),
      }),
      metadata: Joi.object(),
    }),
  },
  
  // Model
  createModel: {
    [Segments.BODY]: Joi.object({
      id: Joi.string().required(),
      name: Joi.string().required(),
      type: Joi.string().valid('chat', 'completion', 'embedding').required(),
      provider: Joi.string().valid('openai', 'google', 'huggingface', 'custom'),
      description: Joi.string(),
      parameters: Joi.object({
        temperature: Joi.number().min(0).max(2).default(0.7),
        maxTokens: Joi.number().integer().min(1).max(4000),
        topP: Joi.number().min(0).max(1).default(1),
        frequencyPenalty: Joi.number().min(-2).max(2).default(0),
        presencePenalty: Joi.number().min(-2).max(2).default(0),
      }),
      enabled: Joi.boolean().default(true),
    }),
  },
  
  // File upload
  fileUpload: {
    [Segments.HEADERS]: Joi.object({
      'content-type': Joi.string().pattern(/^multipart\/form-data/).required(),
    }).unknown(),
    [Segments.BODY]: Joi.object({
      purpose: Joi.string().valid('fine-tune', 'assistants').required(),
    }),
  },
  
  // Pagination
  pagination: {
    [Segments.QUERY]: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
      sort: Joi.string().pattern(/^[a-zA-Z0-9_]+:(asc|desc)$/),
      search: Joi.string(),
    }),
  },
};

// Helper function to create validation middleware
const validate = (schema) => {
  if (!schemas[schema]) {
    throw new Error(`Validation schema '${schema}' not found`);
  }
  return celebrate(schemas[schema], {
    abortEarly: false,
    allowUnknown: true,
    stripUnknown: {
      objects: true,
    },
  });
};

// Export common validators
module.exports = {
  validate,
  Joi: {
    ...Joi,
    objectId: () => customJoi.objectId(),
  },
  schemas,
  // Common validators
  validatePagination: validate('pagination'),
  validateLogin: validate('login'),
  validateRegister: validate('register'),
  validateCreateConversation: validate('createConversation'),
  validateSendMessage: validate('sendMessage'),
  validateCreateModel: validate('createModel'),
  validateFileUpload: validate('fileUpload'),
};
