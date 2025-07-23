/**
 * @fileoverview
 * LoggingInterceptor - An interceptor that logs HTTP requests and responses
 * with configurable detail levels and sensitive data masking.
 */

import logger from '../Logger.js';

/**
 * LoggingInterceptor class for logging HTTP requests and responses
 * 
 * @class
 */
class LoggingInterceptor {
  /**
   * Creates a new LoggingInterceptor instance
   * 
   * @param {Object} [options={}] - Configuration options
   * @param {boolean} [options.logRequests=true] - Whether to log requests
   * @param {boolean} [options.logResponses=true] - Whether to log responses
   * @param {boolean} [options.logErrors=true] - Whether to log errors
   * @param {boolean} [options.includeHeaders=false] - Whether to include headers in logs
   * @param {boolean} [options.includeBody=false] - Whether to include body in logs
   * @param {boolean} [options.includeStack=false] - Whether to include stack trace in error logs
   * @param {string[]} [options.excludePaths=[]] - Paths to exclude from logging
   * @param {Function} [options.shouldLog] - Custom function to determine if a request should be logged
   * @param {boolean} [options.enableMetrics=false] - Whether to enable performance metrics tracking
   */
  constructor(options = {}) {
    this.options = {
      logRequests: options.logRequests !== false,
      logResponses: options.logResponses !== false,
      logErrors: options.logErrors !== false,
      includeHeaders: options.includeHeaders || false,
      includeBody: options.includeBody || false,
      includeStack: options.includeStack || false,
      excludePaths: options.excludePaths || [],
      shouldLog: options.shouldLog || null,
      enableMetrics: options.enableMetrics || false
    };
    
    // Use provided logger or default
    this.logger = options.logger || logger;
    
    // Track active requests for performance monitoring
    this.activeRequests = new Map();
  }
  
  /**
   * Determines if a request should be logged based on configuration
   * 
   * @param {Object} config - Request configuration
   * @returns {boolean} Whether the request should be logged
   * @private
   */
  _shouldLogRequest(config) {
    // If custom shouldLog function is provided, use it
    if (typeof this.options.shouldLog === 'function') {
      return this.options.shouldLog(config);
    }
    
    // Check if path is excluded
    if (config.url && this.options.excludePaths.length > 0) {
      for (const excludePath of this.options.excludePaths) {
        if (typeof excludePath === 'string' && config.url.includes(excludePath)) {
          return false;
        }
        if (excludePath instanceof RegExp && excludePath.test(config.url)) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Request interceptor function
   * 
   * @param {Object} config - Request configuration
   * @returns {Object} Modified request configuration
   */
  async onRequest(config) {
    // Generate unique request ID for tracking
    const requestId = this._generateRequestId();
    config.requestId = requestId;
    
    // Start performance tracking if enabled
    if (this.options.enableMetrics) {
      const trackingInfo = this.logger.startRequestTracking(requestId, {
        method: config.method?.toUpperCase(),
        url: config.url,
        hasBody: !!(config.data)
      });
      
      if (trackingInfo) {
        this.activeRequests.set(requestId, trackingInfo);
      }
    }
    
    if (this.options.logRequests && this._shouldLogRequest(config)) {
      this.logger.logRequest(config, {
        includeHeaders: this.options.includeHeaders,
        includeBody: this.options.includeBody
      });
    }
    
    return config;
  }
  
  /**
   * Response interceptor function
   * 
   * @param {Object} response - Response object
   * @returns {Object} Modified response object
   */
  async onResponse(response) {
    // End performance tracking if enabled
    if (this.options.enableMetrics && response.config?.requestId) {
      const trackingInfo = this.activeRequests.get(response.config.requestId);
      if (trackingInfo) {
        this.logger.endRequestTracking(trackingInfo, {
          success: true,
          statusCode: response.status,
          wasRetried: response.config?.retryCount > 0,
          wasRateLimited: false,
          wasCloudflareBlocked: false
        });
        
        this.activeRequests.delete(response.config.requestId);
      }
    }
    
    if (this.options.logResponses && this._shouldLogRequest(response.config)) {
      this.logger.logResponse(response, {
        includeHeaders: this.options.includeHeaders,
        includeBody: this.options.includeBody
      });
    }
    
    return response;
  }
  
  /**
   * Error interceptor function
   * 
   * @param {Error} error - Error object
   * @throws {Error} The original error after logging
   */
  async onError(error) {
    // End performance tracking if enabled
    if (this.options.enableMetrics && error.config?.requestId) {
      const trackingInfo = this.activeRequests.get(error.config.requestId);
      if (trackingInfo) {
        // Determine error type and characteristics
        const errorType = this._classifyError(error);
        const wasRateLimited = this._isRateLimitError(error);
        const wasCloudflareBlocked = this._isCloudflareError(error);
        
        this.logger.endRequestTracking(trackingInfo, {
          success: false,
          statusCode: error.response?.status,
          errorType: errorType,
          wasRetried: error.config?.retryCount > 0,
          wasRateLimited: wasRateLimited,
          wasCloudflareBlocked: wasCloudflareBlocked
        });
        
        // Record issue for troubleshooting
        this.logger.recordIssue(errorType, {
          statusCode: error.response?.status,
          message: error.message,
          url: error.config?.url,
          method: error.config?.method
        });
        
        this.activeRequests.delete(error.config.requestId);
      }
    }
    
    if (this.options.logErrors && error.config && this._shouldLogRequest(error.config)) {
      this.logger.logError(error, {
        includeHeaders: this.options.includeHeaders,
        includeBody: this.options.includeBody,
        includeStack: this.options.includeStack
      });
    }
    
    // Continue with error handling
    throw error;
  }
  
  /**
   * Generates a unique request ID
   * 
   * @returns {string} Unique request identifier
   * @private
   */
  _generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Classifies an error for troubleshooting purposes
   * 
   * @param {Error} error - Error object
   * @returns {string} Error classification
   * @private
   */
  _classifyError(error) {
    if (this._isRateLimitError(error)) {
      return 'rate_limit';
    }
    
    if (this._isCloudflareError(error)) {
      return 'cloudflare_block';
    }
    
    if (this._isNetworkTimeoutError(error)) {
      return 'network_timeout';
    }
    
    if (this._isAuthenticationError(error)) {
      return 'authentication_error';
    }
    
    if (this._isSSLError(error)) {
      return 'ssl_error';
    }
    
    if (error.response?.status >= 500) {
      return 'server_error';
    }
    
    if (error.response?.status >= 400) {
      return 'client_error';
    }
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return 'network_error';
    }
    
    return 'unknown_error';
  }
  
  /**
   * Checks if error is a rate limit error
   * 
   * @param {Error} error - Error object
   * @returns {boolean} True if rate limit error
   * @private
   */
  _isRateLimitError(error) {
    return error.response?.status === 429 || 
           error.name === 'RateLimitError' ||
           error.message?.toLowerCase().includes('rate limit');
  }
  
  /**
   * Checks if error is a Cloudflare blocking error
   * 
   * @param {Error} error - Error object
   * @returns {boolean} True if Cloudflare error
   * @private
   */
  _isCloudflareError(error) {
    return error.response?.status === 403 && 
           (error.response.headers?.server?.includes('cloudflare') ||
            error.response.data?.includes('Checking your browser') ||
            error.name === 'CloudflareError');
  }
  
  /**
   * Checks if error is a network timeout error
   * 
   * @param {Error} error - Error object
   * @returns {boolean} True if timeout error
   * @private
   */
  _isNetworkTimeoutError(error) {
    return error.code === 'ECONNABORTED' ||
           error.code === 'ETIMEDOUT' ||
           error.message?.toLowerCase().includes('timeout');
  }
  
  /**
   * Checks if error is an authentication error
   * 
   * @param {Error} error - Error object
   * @returns {boolean} True if authentication error
   * @private
   */
  _isAuthenticationError(error) {
    return error.response?.status === 401 ||
           error.response?.status === 403 ||
           error.message?.toLowerCase().includes('unauthorized') ||
           error.message?.toLowerCase().includes('authentication');
  }
  
  /**
   * Checks if error is an SSL/TLS error
   * 
   * @param {Error} error - Error object
   * @returns {boolean} True if SSL error
   * @private
   */
  _isSSLError(error) {
    return error.code === 'CERT_UNTRUSTED' ||
           error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
           error.message?.toLowerCase().includes('certificate') ||
           error.message?.toLowerCase().includes('ssl') ||
           error.message?.toLowerCase().includes('tls');
  }
}

export default LoggingInterceptor;