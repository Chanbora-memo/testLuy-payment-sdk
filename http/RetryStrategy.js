/**
 * @fileoverview
 * RetryStrategy - A module for implementing intelligent retry mechanisms
 * to handle transient errors, rate limiting, and Cloudflare challenges.
 */

/**
 * RetryStrategy class for implementing exponential backoff with jitter
 * and intelligent error-specific retry policies.
 * 
 * @class
 */
class RetryStrategy {
  /**
   * Creates a new RetryStrategy instance
   * 
   * @param {Object} config - Configuration options
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
    this.config = {
      maxRetries: config.maxRetries !== undefined ? config.maxRetries : 3,
      baseDelay: config.baseDelay !== undefined ? config.baseDelay : 1000,
      maxDelay: config.maxDelay !== undefined ? config.maxDelay : 30000,
      backoffFactor: config.backoffFactor !== undefined ? config.backoffFactor : 2,
      jitterFactor: config.jitterFactor !== undefined ? config.jitterFactor : 0.1,
      retryableStatusCodes: config.retryableStatusCodes || [408, 429, 500, 502, 503, 504],
      retryCondition: config.retryCondition || null,
      onRetry: config.onRetry || null
    };
    
    // Validate configuration
    this._validateConfig();
  }
  
  /**
   * Validates the configuration
   * 
   * @private
   * @throws {Error} If configuration is invalid
   */
  _validateConfig() {
    if (this.config.maxRetries < 0) {
      throw new Error('maxRetries must be a non-negative number');
    }
    
    if (this.config.baseDelay <= 0) {
      throw new Error('baseDelay must be a positive number');
    }
    
    if (this.config.maxDelay <= 0) {
      throw new Error('maxDelay must be a positive number');
    }
    
    if (this.config.backoffFactor <= 0) {
      throw new Error('backoffFactor must be a positive number');
    }
    
    if (this.config.jitterFactor < 0 || this.config.jitterFactor > 1) {
      throw new Error('jitterFactor must be between 0 and 1');
    }
    
    if (!Array.isArray(this.config.retryableStatusCodes)) {
      throw new Error('retryableStatusCodes must be an array');
    }
    
    if (this.config.retryCondition !== null && typeof this.config.retryCondition !== 'function') {
      throw new Error('retryCondition must be a function');
    }
    
    if (this.config.onRetry !== null && typeof this.config.onRetry !== 'function') {
      throw new Error('onRetry must be a function');
    }
  }
  
  /**
   * Executes an operation with retry logic
   * 
   * @param {Function} operation - The operation to execute (must return a Promise)
   * @param {Object} [context={}] - Context object passed to the operation and retry callbacks
   * @returns {Promise<*>} The result of the operation
   * @throws {Error} If all retry attempts fail
   */
  async executeWithRetry(operation, context = {}) {
    if (typeof operation !== 'function') {
      throw new Error('operation must be a function');
    }
    
    let attempt = 0;
    let lastError = null;
    
    while (attempt <= this.config.maxRetries) {
      try {
        // If this is a retry attempt, add the attempt number to the context
        if (attempt > 0) {
          context.retryAttempt = attempt;
          context.retryDelay = this.calculateDelay(attempt, lastError);
          
          // Call onRetry callback if provided
          if (this.config.onRetry) {
            await this.config.onRetry({
              attempt,
              error: lastError,
              delay: context.retryDelay,
              context
            });
          }
          
          // Wait for the calculated delay before retrying
          await new Promise(resolve => setTimeout(resolve, context.retryDelay));
        }
        
        // Execute the operation
        return await operation(context);
      } catch (error) {
        lastError = error;
        
        // Check if we should retry
        if (attempt >= this.config.maxRetries || !this.shouldRetry(error, attempt)) {
          break;
        }
        
        attempt++;
      }
    }
    
    // If we get here, all retry attempts failed
    throw lastError;
  }
  
  /**
   * Calculates the delay before the next retry attempt using exponential backoff with jitter
   * 
   * @param {number} attempt - The current retry attempt (1-based)
   * @param {Error} [error] - The error that triggered the retry
   * @returns {number} The delay in milliseconds
   */
  calculateDelay(attempt, error = null) {
    // Start with the base delay
    let delay = this.config.baseDelay;
    
    // Apply exponential backoff
    delay *= Math.pow(this.config.backoffFactor, attempt - 1);
    
    // Check for Retry-After header in case of rate limiting
    if (error && error.response && error.response.headers && error.response.headers['retry-after']) {
      const retryAfter = parseInt(error.response.headers['retry-after'], 10);
      if (!isNaN(retryAfter)) {
        // Convert seconds to milliseconds
        delay = Math.max(delay, retryAfter * 1000);
      }
    }
    
    // Apply jitter to prevent thundering herd problem
    if (this.config.jitterFactor > 0) {
      const jitter = delay * this.config.jitterFactor;
      delay += Math.random() * jitter * 2 - jitter; // Range: -jitter to +jitter
    }
    
    // Ensure delay doesn't exceed maximum
    return Math.min(Math.max(0, delay), this.config.maxDelay);
  }
  
  /**
   * Determines if a request should be retried based on the error
   * 
   * @param {Error} error - The error that occurred
   * @param {number} attempt - The current retry attempt (0-based)
   * @returns {boolean} Whether the request should be retried
   */
  shouldRetry(error, attempt) {
    // Check if we've reached the maximum number of retries
    if (attempt >= this.config.maxRetries) {
      return false;
    }
    
    // If a custom retry condition is provided, use it
    if (this.config.retryCondition) {
      return this.config.retryCondition(error, attempt);
    }
    
    // Default retry logic
    
    // Network errors should be retried
    if (!error.response) {
      return true;
    }
    
    // Check if the status code is in the list of retryable status codes
    if (error.response.status && this.config.retryableStatusCodes.includes(error.response.status)) {
      return true;
    }
    
    // Check for Cloudflare specific errors
    if (this.isCloudflareError(error)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Checks if an error is a Cloudflare-specific error
   * 
   * @param {Error} error - The error to check
   * @returns {boolean} Whether the error is a Cloudflare error
   */
  isCloudflareError(error) {
    // Check for Cloudflare server header
    if (error.response && error.response.headers && error.response.headers.server) {
      if (error.response.headers.server.toLowerCase().includes('cloudflare')) {
        return true;
      }
    }
    
    // Check for Cloudflare challenge page
    if (error.response && error.response.data) {
      const data = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data);
      
      if (data.includes('Checking your browser') || 
          data.includes('cloudflare') || 
          data.includes('cf-') || 
          data.includes('ray id')) {
        return true;
      }
    }
    
    // Check for Cloudflare specific status codes with empty response
    if (error.response && error.response.status === 403) {
      // Cloudflare often returns 403 with minimal content
      return true;
    }
    
    return false;
  }
  
  /**
   * Creates a retry interceptor for use with EnhancedHttpClient
   * 
   * @returns {Object} An error interceptor for EnhancedHttpClient
   */
  createRetryInterceptor() {
    const self = this;
    
    return {
      async onError(error) {
        // Skip retry if the request has a skipRetry flag
        if (error.config && error.config.skipRetry) {
          return Promise.reject(error);
        }
        
        // Check if we should retry
        const attempt = error.config.retryAttempt || 0;
        
        if (attempt < self.config.maxRetries && self.shouldRetry(error, attempt)) {
          // Increment the retry attempt
          error.config.retryAttempt = attempt + 1;
          
          // Calculate delay
          const delay = self.calculateDelay(attempt + 1, error);
          
          // Call onRetry callback if provided
          if (self.config.onRetry) {
            await self.config.onRetry({
              attempt: attempt + 1,
              error,
              delay,
              context: { config: error.config }
            });
          }
          
          // Wait for the calculated delay
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Retry the request
          try {
            // Create a new axios instance to avoid interceptor loops
            let axios = error.config.axios;
            if (!axios) {
              try {
                const axiosModule = await import('axios');
                axios = axiosModule.default || axiosModule;
              } catch (importError) {
                throw new Error('axios is required for retry functionality but not available');
              }
            }
            const response = await axios.request(error.config);
            return response;
          } catch (retryError) {
            // If retry fails, continue with error handling
            return Promise.reject(retryError);
          }
        }
        
        // If we shouldn't retry, reject with the original error
        return Promise.reject(error);
      }
    };
  }
}

export default RetryStrategy;