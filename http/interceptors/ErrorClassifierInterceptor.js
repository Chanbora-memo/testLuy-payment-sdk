/**
 * @fileoverview
 * ErrorClassifierInterceptor - An error interceptor that classifies errors
 * using the ErrorDetector.
 */

import { ErrorInterceptor } from '../interceptors.js';
import ErrorDetector from '../ErrorDetector.js';

/**
 * ErrorClassifierInterceptor classifies errors using the ErrorDetector
 * 
 * @class
 * @extends ErrorInterceptor
 */
class ErrorClassifierInterceptor extends ErrorInterceptor {
  /**
   * Creates a new ErrorClassifierInterceptor instance
   * 
   * @param {Object} [options={}] - Configuration options
   * @param {boolean} [options.detectCloudflare=true] - Whether to detect Cloudflare errors
   * @param {boolean} [options.detectRateLimit=true] - Whether to detect rate limit errors
   * @param {boolean} [options.detectNetworkIssues=true] - Whether to detect network issues
   * @param {Object} [options.customDetectors={}] - Custom error detectors
   * @param {Function} [options.onError] - Callback function called when an error is classified
   */
  constructor(options = {}) {
    super();
    this.errorDetector = new ErrorDetector(options);
    this.errorCallback = options.onError;
  }

  /**
   * Handles errors by classifying them
   * 
   * @param {Error} error - The error that occurred
   * @returns {Promise<void>} Always rejects with the classified error
   */
  async onError(error) {
    // Detect error type
    const errorInfo = this.errorDetector.detectErrorType(error);
    
    // Add error classification to the error object
    error.errorType = errorInfo.type;
    error.retryable = errorInfo.retryable;
    error.errorDetails = errorInfo.details;
    
    // Call onError callback if provided
    if (typeof this.errorCallback === 'function') {
      await this.errorCallback(error, errorInfo);
    }
    
    // Continue with error handling
    return Promise.reject(error);
  }
}

export default ErrorClassifierInterceptor;