const { logger } = require('../core/logger');
const { ApiError } = require('../middleware/errorHandler');

/**
 * Execute an async function with a timeout
 * @param {Function} asyncFunc - Async function to execute
 * @param {number} timeout - Timeout in milliseconds
 * @param {string} errorMessage - Custom error message (optional)
 * @returns {Promise<*>} Result of the async function
 * @throws {ApiError} If the operation times out
 */
const withTimeout = (asyncFunc, timeout, errorMessage = 'Operation timed out') => {
  return Promise.race([
    asyncFunc(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new ApiError(408, errorMessage, 'TIMEOUT')), timeout)
    )
  ]);
};

/**
 * Retry an async operation with exponential backoff
 * @param {Function} asyncFunc - Async function to retry
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} initialDelay - Initial delay in milliseconds
 * @param {Function} shouldRetry - Function to determine if a retry should be attempted
 * @returns {Promise<*>} Result of the async function
 * @throws {Error} If all retry attempts fail
 */
const withRetry = async (asyncFunc, maxRetries = 3, initialDelay = 1000, shouldRetry = () => true) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await asyncFunc();
    } catch (error) {
      lastError = error;
      
      if (!shouldRetry(error) || attempt === maxRetries) {
        break;
      }
      
      const delay = initialDelay * Math.pow(2, attempt - 1); // Exponential backoff
      const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
      
      logger.warn(`Attempt ${attempt} failed, retrying in ${delay + jitter}ms...`, {
        error: error.message,
        stack: error.stack,
        attempt,
        maxRetries,
        delay: delay + jitter,
      });
      
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }
  
  throw lastError;
};

/**
 * Execute async operations in parallel with a concurrency limit
 * @param {Array<Function>} tasks - Array of async functions to execute
 * @param {number} concurrency - Maximum number of concurrent operations
 * @returns {Promise<Array>} Array of results in the same order as tasks
 */
const parallelLimit = async (tasks, concurrency = 5) => {
  const results = [];
  const executing = [];
  
  for (const [index, task] of tasks.entries()) {
    const p = Promise.resolve().then(() => task());
    results[index] = p;
    
    if (concurrency <= tasks.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      
      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }
  }
  
  return Promise.all(results);
};

/**
 * Execute async operations in series
 * @param {Array<Function>} tasks - Array of async functions to execute
 * @returns {Promise<Array>} Array of results in the same order as tasks
 */
const series = async (tasks) => {
  const results = [];
  
  for (const task of tasks) {
    results.push(await task());
  }
  
  return results;
};

/**
 * Create a debounced version of an async function
 * @param {Function} func - Async function to debounce
 * @param {number} wait - Debounce wait time in milliseconds
 * @returns {Function} Debounced function
 */
const debounce = (func, wait) => {
  let timeout;
  let resolveFuncs = [];
  
  return (...args) => {
    return new Promise((resolve) => {
      const later = async () => {
        timeout = null;
        const currentResolveFuncs = [...resolveFuncs];
        resolveFuncs = [];
        
        try {
          const result = await func(...args);
          currentResolveFuncs.forEach(r => r(result));
        } catch (error) {
          currentResolveFuncs.forEach(r => r(Promise.reject(error)));
        }
      };
      
      if (timeout) {
        clearTimeout(timeout);
      }
      
      resolveFuncs.push(resolve);
      timeout = setTimeout(later, wait);
    });
  };
};

/**
 * Create a throttled version of an async function
 * @param {Function} func - Async function to throttle
 * @param {number} limit - Time in milliseconds to throttle invocations
 * @returns {Function} Throttled function
 */
const throttle = (func, limit) => {
  let inThrottle = false;
  let lastResult;
  let waiting = [];
  
  return (...args) => {
    return new Promise((resolve, reject) => {
      const process = async () => {
        if (inThrottle) {
          // If we're in the throttle period, queue the request
          waiting.push({ resolve, reject });
          return;
        }
        
        inThrottle = true;
        
        try {
          lastResult = await func(...args);
          resolve(lastResult);
          
          // Process any queued requests after the limit
          setTimeout(() => {
            inThrottle = false;
            const queue = [...waiting];
            waiting = [];
            
            if (queue.length > 0) {
              // Resolve all queued requests with the last result
              queue.forEach(({ resolve: res }) => res(lastResult));
            }
          }, limit);
        } catch (error) {
          // On error, reject all queued requests
          waiting.forEach(({ reject: rej }) => rej(error));
          waiting = [];
          reject(error);
        }
      };
      
      process();
    });
  };
};

/**
 * Create a memoized version of an async function
 * @param {Function} func - Async function to memoize
 * @param {Function} [resolver] - Function to resolve the cache key
 * @returns {Function} Memoized function
 */
const memoize = (func, resolver = (...args) => JSON.stringify(args)) => {
  const cache = new Map();
  
  return async (...args) => {
    const key = resolver(...args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    try {
      const result = await func(...args);
      cache.set(key, result);
      return result;
    } catch (error) {
      // Don't cache errors
      throw error;
    }
  };
};

/**
 * Execute async operations with a semaphore for concurrency control
 * @param {number} maxConcurrent - Maximum number of concurrent operations
 * @returns {Object} Semaphore object with acquire and run methods
 */
const createSemaphore = (maxConcurrent = 1) => {
  let running = 0;
  const queue = [];
  
  const acquire = () => {
    return new Promise(resolve => {
      if (running < maxConcurrent) {
        running++;
        resolve();
      } else {
        queue.push(resolve);
      }
    });
  };
  
  const release = () => {
    running--;
    if (queue.length > 0 && running < maxConcurrent) {
      const next = queue.shift();
      running++;
      next();
    }
  };
  
  const run = async (fn) => {
    await acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  };
  
  return { acquire, release, run };
};

module.exports = {
  withTimeout,
  withRetry,
  parallelLimit,
  series,
  debounce,
  throttle,
  memoize,
  createSemaphore,
};
