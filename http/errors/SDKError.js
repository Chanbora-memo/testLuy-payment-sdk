/**
 * @fileoverview
 * SDKError - Base error class for all SDK errors with enhanced information
 * and standardized structure.
 */

/**
 * Base error class for all SDK errors
 * 
 * @class
 * @extends Error
 */
class SDKError extends Error {
  /**
   * Creates a new SDKError instance
   * 
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {Object} [details={}] - Additional error details
   * @param {Error} [originalError=null] - Original error that caused this error
   */
  constructor(message, code, details = {}, originalError = null) {
    super(message);
    
    // Standard error properties
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Store original error if provided
    this.originalError = originalError;
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    
    // Extract HTTP information if available
    if (originalError && originalError.response) {
      this.status = originalError.response.status;
      this.statusText = originalError.response.statusText;
      this.headers = originalError.response.headers;
      
      // Extract response data safely
      if (originalError.response.data) {
        try {
          this.responseData = typeof originalError.response.data === 'string' 
            ? JSON.parse(originalError.response.data) 
            : originalError.response.data;
        } catch (e) {
          this.responseData = originalError.response.data;
        }
      }
      
      // Extract request information
      if (originalError.config) {
        this.request = {
          url: originalError.config.url,
          method: originalError.config.method,
          headers: this.sanitizeHeaders(originalError.config.headers)
        };
      }
    }
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
   * Returns a plain object representation of the error
   * 
   * @returns {Object} Plain object representation of the error
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      status: this.status,
      statusText: this.statusText,
      details: this.details,
      request: this.request,
      stack: this.stack
    };
  }
  
  /**
   * Returns a string representation of the error
   * 
   * @returns {string} String representation of the error
   */
  toString() {
    return `${this.name} [${this.code}]: ${this.message}${
      this.status ? ` (HTTP ${this.status})` : ''
    }`;
  }
  
  /**
   * Creates an SDKError from an existing error
   * 
   * @param {Error} error - Original error
   * @param {string} [message] - Custom error message (defaults to original error message)
   * @param {string} [code='UNKNOWN_ERROR'] - Error code
   * @param {Object} [details={}] - Additional error details
   * @returns {SDKError} New SDKError instance
   * @static
   */
  static from(error, message, code = 'UNKNOWN_ERROR', details = {}) {
    return new SDKError(
      message || error.message,
      code,
      details,
      error
    );
  }
}

export default SDKError;