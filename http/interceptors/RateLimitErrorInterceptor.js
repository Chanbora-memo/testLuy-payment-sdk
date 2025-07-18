/**
 * @fileoverview
 * RateLimitErrorInterceptor - An error interceptor that specifically handles
 * rate limit errors with intelligent backoff.
 */

import { ErrorInterceptor } from '../interceptors.js';
import ErrorDetector, { ErrorType } from '../ErrorDetector.js';
import { RateLimitError } from '../errors/index.js';

/**
 * RateLimitErrorInterceptor handles rate limit errors with intelligent backoff
 * 
 * @class
 * @extends ErrorInterceptor
 */
class RateLimitErrorInterceptor extends ErrorInterceptor {
  /**
   * Creates a new RateLimitErrorInterceptor instance
   * 
   * @param {Object} [options={}] - Configuration options
   * @param {number} [options.maxRetries=3] - Maximum number of retry attempts
   * @param {boolean} [options.respectRetryAfter=true] - Whether to respect the Retry-After header
   * @param {number} [options.defaultRetryDelay=60000] - Default delay in milliseconds if no Retry-After header
   * @param {Function} [options.onRateLimit] - Callback function called when rate limited
   */
  constructor(options = {}) {
    super();
    this.options = {
      maxRetries: options.maxRetries !== undefined ? options.maxRetries : 3,
      respectRetryAfter: options.respectRetryAfter !== false,
      defaultRetryDelay: options.defaultRetryDelay || 60000,
      onRateLimit: options.onRateLimit
    };
    
    this.errorDetector = new ErrorDetector();
    this.retryCount = 0;
  }

  /**
   * Handles rate limit errors with intelligent backoff
   * 
   * @param {Error} error - The error that occurred
   * @returns {Promise<Object>|undefined} The response if retry is successful, undefined otherwise
   */
  async onError(error) {
    // Detect if this is a rate limit error
    const errorInfo = this.errorDetector.detectErrorType(error);
    
    if (errorInfo.type === ErrorType.RATE_LIMIT) {
      // Create a RateLimitError instance
      const rateLimitError = RateLimitError.fromResponse(error);
      
      // Check if we should retry
      if (this.retryCount < this.options.maxRetries) {
        this.retryCount++;
        
        // Get retry guidance from the error
        const retryGuidance = rateLimitError.getRetryGuidance();
        
        // Determine delay based on retry guidance
        let delay = this.options.defaultRetryDelay;
        
        if (this.options.respectRetryAfter && retryGuidance.retryAfter) {
          delay = retryGuidance.retryAfter * 1000; // Convert seconds to milliseconds
        }
        
        // Call onRateLimit callback if provided
        if (typeof this.options.onRateLimit === 'function') {
          await this.options.onRateLimit({
            retryCount: this.retryCount,
            maxRetries: this.options.maxRetries,
            delayMs: delay,
            error: rateLimitError,
            retryGuidance
          });
        }
        
        // Wait for the specified delay
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry the request
        try {
          // Create a new axios instance to avoid interceptor loops
          const axios = error.config.axios || require('axios');
          const response = await axios.request(error.config);
          return response;
        } catch (retryError) {
          // If retry fails, continue with error handling
          return undefined;
        }
      }
      
      // If we're not retrying, throw the enhanced error
      return Promise.reject(rateLimitError);
    }
    
    // Not a rate limit error
    return undefined;
  }
}

export default RateLimitErrorInterceptor;