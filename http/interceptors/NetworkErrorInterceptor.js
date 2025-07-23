/**
 * @fileoverview
 * NetworkErrorInterceptor - An error interceptor that specifically handles
 * network-related errors with intelligent retry logic.
 */

import { ErrorInterceptor } from '../interceptors.js';
import ErrorDetector, { ErrorType } from '../ErrorDetector.js';

/**
 * NetworkErrorInterceptor handles network-related errors
 * 
 * @class
 * @extends ErrorInterceptor
 */
class NetworkErrorInterceptor extends ErrorInterceptor {
  /**
   * Creates a new NetworkErrorInterceptor instance
   * 
   * @param {Object} [options={}] - Configuration options
   * @param {number} [options.maxRetries=3] - Maximum number of retry attempts
   * @param {number} [options.baseDelay=1000] - Base delay in milliseconds before retrying
   * @param {number} [options.maxDelay=10000] - Maximum delay between retries
   * @param {number} [options.backoffFactor=2] - Factor by which to increase delay on each retry
   * @param {Function} [options.onNetworkError] - Callback function called when a network error occurs
   */
  constructor(options = {}) {
    super();
    this.options = {
      maxRetries: options.maxRetries !== undefined ? options.maxRetries : 3,
      baseDelay: options.baseDelay !== undefined ? options.baseDelay : 1000,
      maxDelay: options.maxDelay !== undefined ? options.maxDelay : 10000,
      backoffFactor: options.backoffFactor !== undefined ? options.backoffFactor : 2,
      onNetworkError: options.onNetworkError
    };
    
    this.errorDetector = new ErrorDetector();
    this.retryCount = 0;
  }

  /**
   * Handles network errors with intelligent retry logic
   * 
   * @param {Error} error - The error that occurred
   * @returns {Promise<Object>|undefined} The response if retry is successful, undefined otherwise
   */
  async onError(error) {
    // Detect if this is a network error
    const errorInfo = this.errorDetector.detectErrorType(error);
    
    if (errorInfo.type === ErrorType.NETWORK || errorInfo.type === ErrorType.TIMEOUT) {
      // Add error classification to the error object
      error.errorType = errorInfo.type;
      error.retryable = errorInfo.retryable;
      error.errorDetails = errorInfo.details;
      
      // Check if we should retry
      if (errorInfo.retryable && this.retryCount < this.options.maxRetries) {
        this.retryCount++;
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.options.baseDelay * Math.pow(this.options.backoffFactor, this.retryCount - 1),
          this.options.maxDelay
        );
        
        // Add jitter to prevent thundering herd
        const jitteredDelay = delay * (0.8 + Math.random() * 0.4); // ±20% jitter
        
        // Call onNetworkError callback if provided
        if (typeof this.options.onNetworkError === 'function') {
          await this.options.onNetworkError({
            retryCount: this.retryCount,
            maxRetries: this.options.maxRetries,
            delayMs: jitteredDelay,
            error,
            errorInfo
          });
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, jitteredDelay));
        
        // Retry the request
        try {
          // For timeout errors, increase the timeout for the retry
          if (errorInfo.type === ErrorType.TIMEOUT && error.config) {
            error.config.timeout = error.config.timeout ? error.config.timeout * 1.5 : 30000;
          }
          
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
          return undefined;
        }
      }
    }
    
    // Not a network error or max retries exceeded
    return undefined;
  }
}

export default NetworkErrorInterceptor;