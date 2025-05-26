const modelManager = require('../core/modelManager');

describe('ModelManager', () => {
  test('should load default model', () => {
    const models = modelManager.listModels();
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('default');
  });

  test('should get model by id', () => {
    const model = modelManager.getModel('default');
    expect(model).toBeDefined();
    expect(model.id).toBe('default');
    expect(model.name).toBe('Default Model');
  });

  test('should throw error for non-existent model', () => {
    expect(() => modelManager.getModel('non-existent')).toThrow('Model not found');
  });
});
