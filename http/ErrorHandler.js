/**
 * @fileoverview
 * ErrorHandler - A module for handling errors with intelligent recovery strategies
 * and detailed error reporting.
 */

import { SDKError, RateLimitError, CloudflareError } from './errors/index.js';
import ErrorDetector, { ErrorType } from './ErrorDetector.js';
import RetryStrategy from './RetryStrategy.js';

/**
 * ErrorHandler class for handling errors with recovery strategies
 * 
 * @class
 */
class ErrorHandler {
  /**
   * Creates a new ErrorHandler instance
   * 
   * @param {Object} [options={}] - Configuration options
   * @param {RetryStrategy} [options.retryStrategy] - RetryStrategy instance for retry logic
   * @param {ErrorDetector} [options.errorDetector] - ErrorDetector instance for error classification
   * @param {Function} [options.onError] - Callback function called when an error occurs
   * @param {Function} [options.onRetry] - Callback function called before a retry attempt
   * @param {Function} [options.onRecovery] - Callback function called when recovery is successful
   * @param {boolean} [options.detailedErrors=true] - Whether to include detailed information in errors
   * @param {boolean} [options.autoRetry=true] - Whether to automatically retry failed requests
   */
  constructor(options = {}) {
    this.retryStrategy = options.retryStrategy || new RetryStrategy();
    this.errorDetector = options.errorDetector || new ErrorDetector();
    this.onError = options.onError;
    this.onRetry = options.onRetry;
    this.onRecovery = options.onRecovery;
    this.detailedErrors = options.detailedErrors !== false;
    this.autoRetry = options.autoRetry !== false;
    
    // Recovery strategies by error type
    this.recoveryStrategies = {
      [ErrorType.NETWORK]: this.handleNetworkError.bind(this),
      [ErrorType.TIMEOUT]: this.handleTimeoutError.bind(this),
      [ErrorType.CLOUDFLARE]: this.handleCloudflareError.bind(this),
      [ErrorType.RATE_LIMIT]: this.handleRateLimitError.bind(this),
      [ErrorType.AUTH]: this.handleAuthError.bind(this),
      [ErrorType.VALIDATION]: this.handleValidationError.bind(this),
      [ErrorType.SERVER]: this.handleServerError.bind(this),
      [ErrorType.CLIENT]: this.handleClientError.bind(this),
      [ErrorType.UNKNOWN]: this.handleUnknownError.bind(this)
    };
  }
  
  /**
   * Handles an error with appropriate recovery strategy
   * 
   * @param {Error} error - The error to handle
   * @param {Object} [context={}] - Additional context for error handling
   * @returns {Promise<Object>} Recovery result or throws enhanced error
   * @throws {SDKError} Enhanced error with detailed information
   */
  async handleError(error, context = {}) {
    // Detect error type if not already classified
    if (!error.errorType) {
      const errorInfo = this.errorDetector.detectErrorType(error);
      error.errorType = errorInfo.type;
      error.retryable = errorInfo.retryable;
      error.errorDetails = errorInfo.details;
    }
    
    // Call onError callback if provided
    if (this.onError) {
      await this.onError(error, context);
    }
    
    // Get the appropriate recovery strategy
    const recoveryStrategy = this.recoveryStrategies[error.errorType] || this.handleUnknownError;
    
    try {
      // Attempt recovery
      const result = await recoveryStrategy(error, context);
      
      // Call onRecovery callback if provided and recovery was successful
      if (this.onRecovery && result) {
        await this.onRecovery(error, result, context);
      }
      
      return result;
    } catch (recoveryError) {
      // If recovery failed, throw an enhanced error
      throw this.enhanceError(recoveryError || error);
    }
  }
  
  /**
   * Enhances an error with additional information
   * 
   * @param {Error} error - The error to enhance
   * @returns {SDKError} Enhanced error
   * @private
   */
  enhanceError(error) {
    // If the error is already an SDKError, return it
    if (error instanceof SDKError) {
      return error;
    }
    
    // Create appropriate error type based on classification
    switch (error.errorType) {
      case ErrorType.CLOUDFLARE:
        return CloudflareError.fromResponse(error);
        
      case ErrorType.RATE_LIMIT:
        return RateLimitError.fromResponse(error);
        
      default:
        // For other error types, use the base SDKError class
        return SDKError.from(
          error,
          error.message,
          `${error.errorType?.toUpperCase() || 'UNKNOWN'}_ERROR`,
          error.errorDetails || {}
        );
    }
  }
  
  /**
   * Creates a detailed error report for debugging
   * 
   * @param {Error} error - The error to report
   * @returns {Object} Detailed error report
   */
  createErrorReport(error) {
    const report = {
      timestamp: new Date().toISOString(),
      errorType: error.errorType || 'unknown',
      message: error.message,
      retryable: error.retryable !== false
    };
    
    // Add request information if available
    if (error.config) {
      report.request = {
        url: error.config.url,
        method: error.config.method,
        headers: this.sanitizeHeaders(error.config.headers)
      };
    }
    
    // Add response information if available
    if (error.response) {
      report.response = {
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers
      };
      
      // Add response data if available and not too large
      if (error.response.data) {
        try {
          const data = typeof error.response.data === 'string' 
            ? error.response.data 
            : JSON.stringify(error.response.data);
            
          // Limit data size to prevent huge error reports
          report.response.data = data.length > 1000 
            ? data.substring(0, 1000) + '... [truncated]' 
            : data;
        } catch (e) {
          report.response.data = '[Error serializing response data]';
        }
      }
    }
    
    // Add error details if available
    if (error.errorDetails) {
      report.details = error.errorDetails;
    }
    
    return report;
  }
  
  /**
   * Sanitizes headers to remove sensitive information
   * 
   * @param {Object} headers - Headers to sanitize
   * @returns {Object} Sanitized headers
   * @private
   */
  sanitizeHeaders(headers) {
    if (!headers) return {};
    
    const sanitized = { ...headers };
    
    // List of sensitive headers to mask
    const sensitiveHeaders = [
      'authorization',
      'x-api-key',
      'x-client-secret',
      'client-secret',
      'api-key',
      'token',
      'password',
      'secret'
    ];
    
    // Mask sensitive headers
    Object.keys(sanitized).forEach(key => {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }
  
  /**
   * Handles network errors
   * 
   * @param {Error} error - The network error
   * @param {Object} context - Error handling context
   * @returns {Promise<Object>} Recovery result or throws
   * @private
   */
  async handleNetworkError(error, context) {
    // Network errors are usually retryable
    if (this.autoRetry && error.retryable !== false) {
      return this.retryRequest(error, context);
    }
    
    // Provide specific guidance based on error code
    if (error.code === 'ENOTFOUND') {
      error.recoveryMessage = 'DNS resolution failed. Check your internet connection and the API hostname.';
    } else if (error.code === 'ECONNREFUSED') {
      error.recoveryMessage = 'Connection refused. The server may be down or not accepting connections.';
    } else if (error.code === 'ECONNRESET') {
      error.recoveryMessage = 'Connection reset. The connection was forcibly closed by the remote server.';
    } else if (error.code === 'ETIMEDOUT') {
      error.recoveryMessage = 'Connection timed out. The server took too long to respond.';
    }
    
    throw error;
  }
  
  /**
   * Handles timeout errors
   * 
   * @param {Error} error - The timeout error
   * @param {Object} context - Error handling context
   * @returns {Promise<Object>} Recovery result or throws
   * @private
   */
  async handleTimeoutError(error, context) {
    // Timeout errors are usually retryable
    if (this.autoRetry) {
      // Increase timeout for retry attempts
      if (error.config && error.config.timeout) {
        error.config.timeout = Math.min(error.config.timeout * 1.5, 60000); // Increase timeout up to 60s
      }
      
      return this.retryRequest(error, context);
    }
    
    error.recoveryMessage = 'Request timed out. Consider increasing the timeout value or checking your network connection.';
    throw error;
  }
  
  /**
   * Handles Cloudflare errors
   * 
   * @param {Error} error - The Cloudflare error
   * @param {Object} context - Error handling context
   * @returns {Promise<Object>} Recovery result or throws
   * @private
   */
  async handleCloudflareError(error, context) {
    // Convert to CloudflareError if not already
    const cloudflareError = error instanceof CloudflareError 
      ? error 
      : CloudflareError.fromResponse(error);
    
    // Get challenge guidance
    const guidance = cloudflareError.getChallengeGuidance();
    
    // If the challenge is retryable and auto-retry is enabled
    if (this.autoRetry && guidance.retryable) {
      // Modify request for retry to help bypass Cloudflare
      if (error.config) {
        // Add or modify headers to help bypass Cloudflare
        error.config.headers = {
          ...error.config.headers,
          // Add browser-like headers
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1'
        };
      }
      
      return this.retryRequest(error, context);
    }
    
    // If not retryable or auto-retry is disabled
    cloudflareError.recoveryMessage = guidance.recommendedAction;
    throw cloudflareError;
  }
  
  /**
   * Handles rate limit errors
   * 
   * @param {Error} error - The rate limit error
   * @param {Object} context - Error handling context
   * @returns {Promise<Object>} Recovery result or throws
   * @private
   */
  async handleRateLimitError(error, context) {
    // Convert to RateLimitError if not already
    const rateLimitError = error instanceof RateLimitError 
      ? error 
      : RateLimitError.fromResponse(error);
    
    // Get retry guidance
    const guidance = rateLimitError.getRetryGuidance();
    
    // If auto-retry is enabled
    if (this.autoRetry && guidance.shouldRetry) {
      // Use the retry-after value if available
      const retryDelay = guidance.retryAfter * 1000; // Convert to milliseconds
      
      // Add retry delay to context
      context.retryDelay = retryDelay;
      
      return this.retryRequest(error, context);
    }
    
    // If not retrying
    rateLimitError.recoveryMessage = guidance.recommendedAction;
    throw rateLimitError;
  }
  
  /**
   * Handles authentication errors
   * 
   * @param {Error} error - The authentication error
   * @param {Object} context - Error handling context
   * @returns {Promise<Object>} Recovery result or throws
   * @private
   */
  async handleAuthError(error, context) {
    // Authentication errors are generally not retryable
    error.recoveryMessage = 'Authentication failed. Check your API credentials and ensure they have not expired.';
    throw error;
  }
  
  /**
   * Handles validation errors
   * 
   * @param {Error} error - The validation error
   * @param {Object} context - Error handling context
   * @returns {Promise<Object>} Recovery result or throws
   * @private
   */
  async handleValidationError(error, context) {
    // Validation errors are not retryable
    let validationMessage = 'Validation failed. Check your request parameters.';
    
    // Extract validation errors if available
    if (error.errorDetails && error.errorDetails.validationErrors) {
      const validationErrors = error.errorDetails.validationErrors;
      
      // Format validation errors
      if (typeof validationErrors === 'object') {
        validationMessage += ' Issues:';
        
        for (const [field, messages] of Object.entries(validationErrors)) {
          const messageText = Array.isArray(messages) ? messages.join(', ') : messages;
          validationMessage += `\n- ${field}: ${messageText}`;
        }
      }
    }
    
    error.recoveryMessage = validationMessage;
    throw error;
  }
  
  /**
   * Handles server errors
   * 
   * @param {Error} error - The server error
   * @param {Object} context - Error handling context
   * @returns {Promise<Object>} Recovery result or throws
   * @private
   */
  async handleServerError(error, context) {
    // Server errors are usually retryable
    if (this.autoRetry) {
      return this.retryRequest(error, context);
    }
    
    error.recoveryMessage = 'Server error occurred. This is likely a temporary issue with the API server.';
    throw error;
  }
  
  /**
   * Handles client errors
   * 
   * @param {Error} error - The client error
   * @param {Object} context - Error handling context
   * @returns {Promise<Object>} Recovery result or throws
   * @private
   */
  async handleClientError(error, context) {
    // Client errors are generally not retryable
    error.recoveryMessage = 'Client error occurred. Check your request parameters and API documentation.';
    throw error;
  }
  
  /**
   * Handles unknown errors
   * 
   * @param {Error} error - The unknown error
   * @param {Object} context - Error handling context
   * @returns {Promise<Object>} Recovery result or throws
   * @private
   */
  async handleUnknownError(error, context) {
    // Unknown errors might be retryable
    if (this.autoRetry && error.retryable !== false) {
      return this.retryRequest(error, context);
    }
    
    error.recoveryMessage = 'An unexpected error occurred.';
    throw error;
  }
  
  /**
   * Retries a failed request
   * 
   * @param {Error} error - The error that triggered the retry
   * @param {Object} context - Retry context
   * @returns {Promise<Object>} Response if retry is successful
   * @throws {Error} If retry fails
   * @private
   */
  async retryRequest(error, context) {
    // Skip retry if the request has a skipRetry flag
    if (error.config && error.config.skipRetry) {
      throw error;
    }
    
    // Get current retry attempt
    const attempt = (error.config && error.config.retryAttempt) || 0;
    
    // Check if we've reached the maximum number of retries
    if (attempt >= this.retryStrategy.config.maxRetries) {
      error.recoveryMessage = `Maximum retry attempts (${this.retryStrategy.config.maxRetries}) reached.`;
      throw error;
    }
    
    // Increment retry attempt
    if (error.config) {
      error.config.retryAttempt = attempt + 1;
    }
    
    // Calculate delay (use context.retryDelay if provided)
    const delay = context.retryDelay || this.retryStrategy.calculateDelay(attempt + 1, error);
    
    // Call onRetry callback if provided
    if (this.onRetry) {
      await this.onRetry({
        attempt: attempt + 1,
        error,
        delay,
        context
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
      // Update retry attempt count
      if (error.config && retryError.config) {
        retryError.config.retryAttempt = error.config.retryAttempt;
      }
      
      // If retry fails, throw the new error
      throw retryError;
    }
  }
  
  /**
   * Gets a random User-Agent string
   * 
   * @returns {string} A random User-Agent string
   * @private
   */
  getRandomUserAgent() {
    const userAgents = [
      // Chrome on Windows
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
      
      // Chrome on macOS
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
      
      // Firefox on Windows
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/116.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0',
      
      // Firefox on macOS
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/115.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/116.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/117.0',
      
      // Safari on macOS
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
      
      // Edge on Windows
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.58',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 Edg/115.0.1901.183',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 Edg/116.0.1938.54'
    ];
    
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }
  
  /**
   * Creates an error interceptor for use with EnhancedHttpClient
   * 
   * @returns {Object} An error interceptor for EnhancedHttpClient
   */
  createErrorInterceptor() {
    const self = this;
    
    return {
      async onError(error) {
        try {
          // Handle the error with recovery strategies
          const result = await self.handleError(error, { config: error.config });
          return result;
        } catch (enhancedError) {
          // If recovery failed, reject with the enhanced error
          return Promise.reject(enhancedError);
        }
      }
    };
  }
}

export default ErrorHandler;