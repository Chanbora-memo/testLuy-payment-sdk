/**
 * @fileoverview
 * RetryInterceptor - An error interceptor that implements retry logic
 * for failed HTTP requests using the RetryStrategy.
 */

import { ErrorInterceptor } from '../interceptors.js';
import RetryStrategy from '../RetryStrategy.js';

/**
 * RetryInterceptor implements retry logic for failed HTTP requests
 * 
 * @class
 * @extends ErrorInterceptor
 */
class RetryInterceptor extends ErrorInterceptor {
  /**
   * Creates a new RetryInterceptor instance
   * 
   * @param {Object} [config] - Configuration options for the retry strategy
   * @param {number} [config.maxRetries=3] - Maximum number of retry attempts
   * @param {number} [config.baseDelay=1000] - Base delay in milliseconds before retrying
   * @param {number} [config.maxDelay=30000] - Maximum delay between retries
   * @param {number} [config.backoffFactor=2] - Factor by which to increase delay on each retry
   * @param {number} [config.jitterFactor=0.1] - Random jitter factor to add to delay (0-1)
   * @param {number[]} [config.retryableStatusCodes=[408, 429, 500, 502, 503, 504]] - HTTP status codes to retry
   * @param {Function} [config.retryCondition] - Custom function to determine if a request should be retried
   * @param {Function} [config.onRetry] - Callback function called before each retry attempt
   */
  constructor(config = {}) {
    super();
    this.retryStrategy = new RetryStrategy(config);
  }

  /**
   * Handles errors by implementing retry logic
   * 
   * @param {Error} error - The error that occurred
   * @returns {Promise<Object>|undefined} The response if retry is successful, undefined otherwise
   */
  async onError(error) {
    // Skip retry if the request has a skipRetry flag
    if (error.config && error.config.skipRetry) {
      return undefined;
    }
    
    // Check if we should retry
    const attempt = error.config?.retryAttempt || 0;
    
    if (this.retryStrategy.shouldRetry(error, attempt)) {
      // Increment the retry attempt
      if (!error.config) {
        error.config = {};
      }
      error.config.retryAttempt = attempt + 1;
      
      // Calculate delay
      const delay = this.retryStrategy.calculateDelay(attempt + 1, error);
      
      // Wait for the calculated delay
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Retry the request
      try {
        // Create a new axios instance to avoid interceptor loops
        const axios = error.config.axios;
        if (axios && typeof axios.request === 'function') {
          const response = await axios.request(error.config);
          return response;
        }
      } catch (retryError) {
        // If retry fails, continue with error handling
        return undefined;
      }
    }
    
    // If we shouldn't retry, return undefined to continue with error handling
    return undefined;
  }
}

export default RetryInterceptor;