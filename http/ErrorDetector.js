/**
 * @fileoverview
 * ErrorDetector - A module for detecting and classifying different types of errors
 * including Cloudflare blocks, rate limits, and network issues.
 */

import { SDKError, RateLimitError, CloudflareError } from './errors/index.js';

/**
 * Error types enumeration
 * @enum {string}
 */
export const ErrorType = {
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  CLOUDFLARE: 'cloudflare',
  RATE_LIMIT: 'rate_limit',
  AUTH: 'authentication',
  VALIDATION: 'validation',
  SERVER: 'server',
  CLIENT: 'client',
  UNKNOWN: 'unknown'
};

/**
 * ErrorDetector class for identifying and classifying different types of errors
 * 
 * @class
 */
class ErrorDetector {
  /**
   * Creates a new ErrorDetector instance
   * 
   * @param {Object} [options={}] - Configuration options
   * @param {boolean} [options.detectCloudflare=true] - Whether to detect Cloudflare errors
   * @param {boolean} [options.detectRateLimit=true] - Whether to detect rate limit errors
   * @param {boolean} [options.detectNetworkIssues=true] - Whether to detect network issues
   * @param {Object} [options.customDetectors={}] - Custom error detectors
   */
  constructor(options = {}) {
    this.options = {
      detectCloudflare: options.detectCloudflare !== false,
      detectRateLimit: options.detectRateLimit !== false,
      detectNetworkIssues: options.detectNetworkIssues !== false,
      customDetectors: options.customDetectors || {}
    };
  }
  
  /**
   * Detects the type of error
   * 
   * @param {Error} error - The error to analyze
   * @returns {Object} Error classification with type and details
   */
  detectErrorType(error) {
    // Start with unknown error type
    let result = {
      type: ErrorType.UNKNOWN,
      retryable: false,
      details: {}
    };
    
    // Check for custom detectors first
    for (const [type, detector] of Object.entries(this.options.customDetectors)) {
      if (typeof detector === 'function') {
        const detected = detector(error);
        if (detected) {
          return {
            type,
            ...detected
          };
        }
      }
    }
    
    // Check for network errors
    if (this.options.detectNetworkIssues && this.isNetworkError(error)) {
      result = this.detectNetworkErrorType(error);
    }
    // Check for HTTP errors with response
    else if (error.response) {
      // Check for Cloudflare errors
      if (this.options.detectCloudflare && this.isCloudflareError(error)) {
        result = this.detectCloudflareErrorType(error);
      }
      // Check for rate limit errors
      else if (this.options.detectRateLimit && this.isRateLimitError(error)) {
        result = this.detectRateLimitErrorType(error);
      }
      // Other HTTP errors
      else {
        result = this.detectHttpErrorType(error);
      }
    }
    
    return result;
  }
  
  /**
   * Checks if an error is a network error (no response)
   * 
   * @param {Error} error - The error to check
   * @returns {boolean} Whether the error is a network error
   */
  isNetworkError(error) {
    return !error.response && error.request;
  }
  
  /**
   * Detects the specific type of network error
   * 
   * @param {Error} error - The network error to analyze
   * @returns {Object} Network error classification
   */
  detectNetworkErrorType(error) {
    const result = {
      type: ErrorType.NETWORK,
      retryable: true,
      details: {
        message: error.message
      }
    };
    
    // Check for timeout
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      result.type = ErrorType.TIMEOUT;
      result.details.timeout = true;
    }
    // DNS errors
    else if (error.code === 'ENOTFOUND') {
      result.details.dns = true;
      result.retryable = false; // DNS errors are usually not retryable
    }
    // Connection refused
    else if (error.code === 'ECONNREFUSED') {
      result.details.connectionRefused = true;
    }
    // Connection reset
    else if (error.code === 'ECONNRESET') {
      result.details.connectionReset = true;
    }
    
    return result;
  }
  
  /**
   * Checks if an error is a Cloudflare-specific error
   * 
   * @param {Error} error - The error to check
   * @returns {boolean} Whether the error is a Cloudflare error
   */
  isCloudflareError(error) {
    // No response means it's not a Cloudflare error
    if (!error.response) {
      return false;
    }
    
    // Check for Cloudflare server header
    if (error.response.headers && error.response.headers.server) {
      if (error.response.headers.server.toLowerCase().includes('cloudflare')) {
        return true;
      }
    }
    
    // Check for Cloudflare challenge page
    if (error.response.data) {
      const data = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data);
      
      if (data.includes('Checking your browser') || 
          data.includes('cloudflare') || 
          data.includes('cf-') || 
          data.includes('ray id')) {
        return true;
      }
    }
    
    // Check for Cloudflare specific status codes with empty response
    if (error.response.status === 403) {
      // Cloudflare often returns 403 with minimal content
      return true;
    }
    
    return false;
  }
  
  /**
   * Detects the specific type of Cloudflare error
   * 
   * @param {Error} error - The Cloudflare error to analyze
   * @returns {Object} Cloudflare error classification
   */
  detectCloudflareErrorType(error) {
    const result = {
      type: ErrorType.CLOUDFLARE,
      retryable: true,
      details: {
        status: error.response.status
      }
    };
    
    // Extract Cloudflare Ray ID if present
    if (error.response.headers && error.response.headers['cf-ray']) {
      result.details.rayId = error.response.headers['cf-ray'];
    }
    
    // Determine challenge type
    if (error.response.data) {
      const data = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data);
      
      if (data.includes('captcha')) {
        result.details.challengeType = 'captcha';
        result.retryable = false; // CAPTCHA challenges are not automatically retryable
      } else if (data.includes('Checking your browser')) {
        result.details.challengeType = 'browser_check';
      } else if (data.includes('security challenge')) {
        result.details.challengeType = 'security_challenge';
      }
    }
    
    return result;
  }
  
  /**
   * Checks if an error is a rate limit error
   * 
   * @param {Error} error - The error to check
   * @returns {boolean} Whether the error is a rate limit error
   */
  isRateLimitError(error) {
    // No response means it's not a rate limit error
    if (!error.response) {
      return false;
    }
    
    // Check for 429 status code
    if (error.response.status === 429) {
      return true;
    }
    
    // Check for rate limit headers
    if (error.response.headers) {
      const headers = error.response.headers;
      if (headers['x-ratelimit-remaining'] === '0' || 
          headers['x-rate-limit-remaining'] === '0') {
        return true;
      }
    }
    
    // Check for rate limit message in response
    if (error.response.data) {
      const data = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data);
      
      if (data.toLowerCase().includes('rate limit') || 
          data.toLowerCase().includes('too many requests')) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Detects the specific type of rate limit error
   * 
   * @param {Error} error - The rate limit error to analyze
   * @returns {Object} Rate limit error classification
   */
  detectRateLimitErrorType(error) {
    const result = {
      type: ErrorType.RATE_LIMIT,
      retryable: true,
      details: {
        status: error.response.status
      }
    };
    
    // Extract retry-after header if present
    if (error.response.headers && error.response.headers['retry-after']) {
      result.details.retryAfter = parseInt(error.response.headers['retry-after'], 10);
      if (isNaN(result.details.retryAfter)) {
        // Handle date format in Retry-After
        try {
          const retryDate = new Date(error.response.headers['retry-after']);
          result.details.retryAfter = Math.ceil((retryDate.getTime() - Date.now()) / 1000);
        } catch (e) {
          result.details.retryAfter = 60; // Default to 60 seconds if parsing fails
        }
      }
    }
    
    // Extract rate limit information
    if (error.response.headers) {
      const headers = error.response.headers;
      
      // Standard rate limit headers
      ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset',
       'x-rate-limit-limit', 'x-rate-limit-remaining', 'x-rate-limit-reset'].forEach(header => {
        if (headers[header]) {
          const key = header.replace('x-', '').replace('ratelimit', 'rate-limit');
          result.details[key] = headers[header];
        }
      });
    }
    
    return result;
  }
  
  /**
   * Detects the type of HTTP error
   * 
   * @param {Error} error - The HTTP error to analyze
   * @returns {Object} HTTP error classification
   */
  detectHttpErrorType(error) {
    const status = error.response.status;
    let type = ErrorType.UNKNOWN;
    let retryable = false;
    
    // Classify based on status code
    if (status >= 400 && status < 500) {
      // Client errors
      type = ErrorType.CLIENT;
      
      if (status === 401 || status === 403) {
        type = ErrorType.AUTH;
        retryable = false;
      } else if (status === 422) {
        type = ErrorType.VALIDATION;
        retryable = false;
      } else if (status === 408) {
        // Request timeout
        type = ErrorType.TIMEOUT;
        retryable = true;
      }
    } else if (status >= 500) {
      // Server errors
      type = ErrorType.SERVER;
      retryable = true;
    }
    
    // Extract error details from response
    const details = {
      status,
      statusText: error.response.statusText
    };
    
    // Try to extract error message from response data
    if (error.response.data) {
      if (typeof error.response.data === 'string') {
        details.message = error.response.data;
      } else if (error.response.data.message) {
        details.message = error.response.data.message;
      } else if (error.response.data.error) {
        details.message = typeof error.response.data.error === 'string' ? 
          error.response.data.error : JSON.stringify(error.response.data.error);
      }
      
      // Extract validation errors if present
      if (type === ErrorType.VALIDATION && error.response.data.errors) {
        details.validationErrors = error.response.data.errors;
      }
    }
    
    return {
      type,
      retryable,
      details
    };
  }
  
  /**
   * Creates an error interceptor that adds error classification to errors
   * and transforms them into appropriate SDK error classes
   * 
   * @returns {Object} An error interceptor for EnhancedHttpClient
   */
  createErrorInterceptor() {
    const self = this;
    
    return {
      async onError(error) {
        // Detect error type
        const errorInfo = self.detectErrorType(error);
        
        // Add error classification to the error object
        error.errorType = errorInfo.type;
        error.retryable = errorInfo.retryable;
        error.errorDetails = errorInfo.details;
        
        // Transform into appropriate error class
        let enhancedError;
        
        switch (errorInfo.type) {
          case ErrorType.CLOUDFLARE:
            enhancedError = CloudflareError.fromResponse(error);
            break;
            
          case ErrorType.RATE_LIMIT:
            enhancedError = RateLimitError.fromResponse(error);
            break;
            
          default:
            // For other error types, use the base SDKError class
            enhancedError = SDKError.from(
              error,
              error.message,
              `${errorInfo.type.toUpperCase()}_ERROR`,
              errorInfo.details
            );
        }
        
        // Continue with error handling
        return Promise.reject(enhancedError);
      }
    };
  }
}

export default ErrorDetector;