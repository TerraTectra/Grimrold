const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');
const { ApiError, badRequest, internal } = require('../middleware/errorHandler');
const config = require('../config/config');
const logger = require('../core/logger');

// Allowed file types and their max sizes (in bytes)
const ALLOWED_FILE_TYPES = {
  'image/jpeg': 5 * 1024 * 1024, // 5MB
  'image/png': 5 * 1024 * 1024, // 5MB
  'image/gif': 10 * 1024 * 1024, // 10MB
  'application/pdf': 10 * 1024 * 1024, // 10MB
  'text/plain': 1 * 1024 * 1024, // 1MB
  'application/json': 5 * 1024 * 1024, // 5MB
  'text/csv': 5 * 1024 * 1024, // 5MB
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 10 * 1024 * 1024, // 10MB
};

// Allowed file extensions for different purposes
const ALLOWED_EXTENSIONS = {
  image: ['.jpg', '.jpeg', '.png', '.gif'],
  document: ['.pdf', '.txt', '.doc', '.docx', '.csv', '.json'],
  dataset: ['.csv', '.json', '.txt'],
  model: ['.bin', '.pt', '.h5', '.pkl', '.joblib', '.onnx'],
};

/**
 * Generate a unique filename with extension
 * @param {string} originalName - Original filename
 * @returns {string} Generated filename
 */
const generateUniqueFilename = (originalName) => {
  const ext = path.extname(originalName).toLowerCase();
  const uniqueId = uuidv4();
  return `${uniqueId}${ext}`;
};

/**
 * Validate file against allowed types and size
 * @param {Object} file - Multer file object
 * @param {string} purpose - Purpose of the upload (e.g., 'image', 'document', 'dataset')
 * @returns {Object} Validation result
 */
const validateFile = (file, purpose = 'document') => {
  const fileType = mime.lookup(file.originalname) || 'application/octet-stream';
  const fileSize = file.size;
  const fileExt = path.extname(file.originalname).toLowerCase();
  
  // Check if file type is allowed
  const allowedTypes = ALLOWED_EXTENSIONS[purpose] || [];
  const isTypeAllowed = allowedTypes.includes(fileExt);
  
  // Check file size against max allowed for the type
  const maxSize = ALLOWED_FILE_TYPES[fileType] || 5 * 1024 * 1024; // Default 5MB
  const isSizeValid = fileSize <= maxSize;
  
  return {
    isValid: isTypeAllowed && isSizeValid,
    errors: [
      ...(isTypeAllowed ? [] : [`File type not allowed for ${purpose}. Allowed: ${allowedTypes.join(', ')}`]),
      ...(isSizeValid ? [] : [`File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`]),
    ],
    fileType,
    fileSize,
  };
};

/**
 * Save uploaded file to disk
 * @param {Object} file - Multer file object
 * @param {string} subfolder - Subfolder to save the file in
 * @returns {Promise<Object>} File info
 */
const saveFile = async (file, subfolder = 'uploads') => {
  try {
    // Create directory if it doesn't exist
    const uploadDir = path.join(config.paths.uploads, subfolder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    // Generate unique filename
    const filename = generateUniqueFilename(file.originalname);
    const filePath = path.join(uploadDir, filename);
    
    // Move file to destination
    await fs.promises.rename(file.path, filePath);
    
    // Get file stats
    const stats = await fs.promises.stat(filePath);
    
    return {
      originalName: file.originalname,
      filename,
      path: filePath,
      size: stats.size,
      mimeType: mime.lookup(file.originalname) || 'application/octet-stream',
      extension: path.extname(file.originalname).toLowerCase(),
      url: `/uploads/${subfolder}/${filename}`,
      uploadedAt: new Date(),
    };
  } catch (error) {
    logger.error('Error saving file:', error);
    throw internal('Error saving file');
  }
};

/**
 * Delete a file
 * @param {string} filePath - Path to the file
 * @returns {Promise<boolean>} True if file was deleted, false otherwise
 */
const deleteFile = async (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Error deleting file:', error);
    return false;
  }
};

/**
 * Process file upload
 * @param {Object} file - Multer file object
 * @param {string} purpose - Purpose of the upload
 * @param {string} subfolder - Subfolder to save the file in
 * @returns {Promise<Object>} File info
 */
const processFileUpload = async (file, purpose = 'document', subfolder = 'uploads') => {
  // Validate file
  const validation = validateFile(file, purpose);
  if (!validation.isValid) {
    throw badRequest('Invalid file', { errors: validation.errors });
  }
  
  // Save file
  const fileInfo = await saveFile(file, subfolder);
  
  logger.info(`File uploaded: ${fileInfo.originalName} (${fileInfo.size} bytes)`, {
    path: fileInfo.path,
    mimeType: fileInfo.mimeType,
    purpose,
  });
  
  return fileInfo;
};

/**
 * Read file content as text
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} File content
 */
const readFileAsText = async (filePath) => {
  try {
    return await fs.promises.readFile(filePath, 'utf-8');
  } catch (error) {
    logger.error('Error reading file:', error);
    throw internal('Error reading file');
  }
};

/**
 * Get file info
 * @param {string} filePath - Path to the file
 * @returns {Promise<Object>} File info
 */
const getFileInfo = async (filePath) => {
  try {
    const stats = await fs.promises.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
    
    return {
      path: filePath,
      name: path.basename(filePath),
      size: stats.size,
      mimeType,
      extension: ext,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      isDirectory: stats.isDirectory(),
    };
  } catch (error) {
    logger.error('Error getting file info:', error);
    throw internal('Error getting file info');
  }
};

module.exports = {
  ALLOWED_FILE_TYPES,
  ALLOWED_EXTENSIONS,
  generateUniqueFilename,
  validateFile,
  saveFile,
  deleteFile,
  processFileUpload,
  readFileAsText,
  getFileInfo,
};
