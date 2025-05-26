const axios = require('axios');
const https = require('https');
const { logger } = require('../core/logger');
const { ApiError } = require('../middleware/errorHandler');

// Create a custom axios instance with default configuration
const httpClient = axios.create({
  timeout: 30000, // 30 seconds timeout
  maxRedirects: 5,
  // Keep connections alive for better performance
  httpAgent: new https.Agent({ keepAlive: true }),
  headers: {
    'User-Agent': 'Grimrold/1.0',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for logging
httpClient.interceptors.request.use(
  (config) => {
    // Log the request
    logger.debug(`HTTP Request: ${config.method?.toUpperCase()} ${config.url}`, {
      method: config.method,
      url: config.url,
      params: config.params,
      data: config.data ? JSON.stringify(config.data).substring(0, 500) : null, // Limit log size
    });
    
    return config;
  },
  (error) => {
    logger.error('HTTP Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for logging and error handling
httpClient.interceptors.response.use(
  (response) => {
    // Log the response
    logger.debug(`HTTP Response: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`, {
      status: response.status,
      statusText: response.statusText,
      data: JSON.stringify(response.data).substring(0, 500), // Limit log size
    });
    
    return response;
  },
  (error) => {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      logger.error('HTTP Response Error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        url: error.config.url,
        method: error.config.method,
        data: error.response.data,
        headers: error.response.headers,
      });
      
      // Create a more descriptive error message
      const status = error.response.status;
      let message = `Request failed with status code ${status}`;
      
      if (error.response.data?.error?.message) {
        message = error.response.data.error.message;
      } else if (error.response.data?.message) {
        message = error.response.data.message;
      } else if (typeof error.response.data === 'string') {
        message = error.response.data;
      }
      
      const apiError = new ApiError(status, message, 'HTTP_ERROR', {
        status,
        statusText: error.response.statusText,
        url: error.config.url,
        method: error.config.method,
        response: error.response.data,
      });
      
      return Promise.reject(apiError);
    } else if (error.request) {
      // The request was made but no response was received
      logger.error('HTTP No Response Error:', {
        message: error.message,
        code: error.code,
        url: error.config?.url,
        method: error.config?.method,
      });
      
      const apiError = new ApiError(504, 'No response received from server', 'NETWORK_ERROR', {
        code: error.code,
        message: error.message,
      });
      
      return Promise.reject(apiError);
    } else {
      // Something happened in setting up the request that triggered an Error
      logger.error('HTTP Request Setup Error:', error.message);
      
      const apiError = new ApiError(500, 'Failed to process request', 'REQUEST_ERROR', {
        message: error.message,
      });
      
      return Promise.reject(apiError);
    }
  }
);

/**
 * Make an HTTP request with retry logic
 * @param {Object} options - Axios request options
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @param {number} retryDelay - Delay between retries in ms (default: 1000)
 * @returns {Promise<Object>} Response data
 */
const requestWithRetry = async (options, maxRetries = 3, retryDelay = 1000) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await httpClient(options);
      return response.data;
    } catch (error) {
      lastError = error;
      
      // Don't retry for 4xx errors (except 408, 429, 500, 502, 503, 504)
      if (error.status && error.status >= 400 && error.status < 500 && 
          ![408, 429].includes(error.status)) {
        break;
      }
      
      // Log retry attempt
      if (attempt < maxRetries) {
        const delay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`, {
          url: options.url,
          method: options.method,
          status: error.status,
          message: error.message,
          attempt,
          maxRetries,
        });
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // If we get here, all retry attempts failed
  logger.error(`All ${maxRetries} attempts failed`, {
    url: options.url,
    method: options.method,
    error: lastError?.message,
  });
  
  throw lastError;
};

/**
 * Make a GET request
 * @param {string} url - Request URL
 * @param {Object} params - Query parameters
 * @param {Object} headers - Request headers
 * @param {Object} options - Additional axios options
 * @returns {Promise<Object>} Response data
 */
const get = (url, params = {}, headers = {}, options = {}) => {
  return requestWithRetry({
    method: 'get',
    url,
    params,
    headers,
    ...options,
  });
};

/**
 * Make a POST request
 * @param {string} url - Request URL
 * @param {Object} data - Request body
 * @param {Object} headers - Request headers
 * @param {Object} options - Additional axios options
 * @returns {Promise<Object>} Response data
 */
const post = (url, data = {}, headers = {}, options = {}) => {
  return requestWithRetry({
    method: 'post',
    url,
    data,
    headers,
    ...options,
  });
};

/**
 * Make a PUT request
 * @param {string} url - Request URL
 * @param {Object} data - Request body
 * @param {Object} headers - Request headers
 * @param {Object} options - Additional axios options
 * @returns {Promise<Object>} Response data
 */
const put = (url, data = {}, headers = {}, options = {}) => {
  return requestWithRetry({
    method: 'put',
    url,
    data,
    headers,
    ...options,
  });
};

/**
 * Make a PATCH request
 * @param {string} url - Request URL
 * @param {Object} data - Request body
 * @param {Object} headers - Request headers
 * @param {Object} options - Additional axios options
 * @returns {Promise<Object>} Response data
 */
const patch = (url, data = {}, headers = {}, options = {}) => {
  return requestWithRetry({
    method: 'patch',
    url,
    data,
    headers,
    ...options,
  });
};

/**
 * Make a DELETE request
 * @param {string} url - Request URL
 * @param {Object} params - Query parameters
 * @param {Object} headers - Request headers
 * @param {Object} options - Additional axios options
 * @returns {Promise<Object>} Response data
 */
const del = (url, params = {}, headers = {}, options = {}) => {
  return requestWithRetry({
    method: 'delete',
    url,
    params,
    headers,
    ...options,
  });
};

module.exports = {
  httpClient,
  requestWithRetry,
  get,
  post,
  put,
  patch,
  delete: del,
};
