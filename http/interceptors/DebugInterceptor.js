/**
 * @fileoverview
 * DebugInterceptor - HTTP client interceptor for debugging and monitoring
 * Integrates with DebugMonitor to provide request/response logging and performance tracking
 */

import DebugMonitor from '../DebugMonitor.js';

/**
 * DebugInterceptor class for HTTP client debugging and monitoring
 * 
 * @class
 */
class DebugInterceptor {
  /**
   * Creates a new DebugInterceptor instance
   * 
   * @param {Object} [options={}] - Configuration options
   * @param {boolean} [options.enabled=false] - Whether debugging is enabled
   * @param {boolean} [options.trackPerformance=false] - Whether to track performance metrics
   * @param {boolean} [options.logRequests=false] - Whether to log requests and responses
   * @param {boolean} [options.includeHeaders=false] - Whether to include headers in logs
   * @param {boolean} [options.includeBody=false] - Whether to include request/response bodies
   * @param {boolean} [options.maskSensitive=true] - Whether to mask sensitive data
   * @param {DebugMonitor} [options.debugMonitor] - Custom debug monitor instance
   */
  constructor(options = {}) {
    this.options = {
      enabled: options.enabled || false,
      trackPerformance: options.trackPerformance || false,
      logRequests: options.logRequests || false,
      includeHeaders: options.includeHeaders || false,
      includeBody: options.includeBody || false,
      maskSensitive: options.maskSensitive !== false
    };
    
    // Use provided debug monitor or create a new one
    this.debugMonitor = options.debugMonitor || new DebugMonitor(this.options);
    
    // Track active requests
    this.activeRequests = new Map();
  }
  
  /**
   * Request interceptor function
   * 
   * @param {Object} config - Request configuration
   * @returns {Object} Modified request configuration
   */
  async onRequest(config) {
    if (!this.options.enabled) {
      return config;
    }
    
    // Generate unique request ID if not already present
    if (!config.requestId) {
      config.requestId = this._generateRequestId();
    }
    
    // Start tracking request
    if (this.options.trackPerformance) {
      const trackingInfo = this.debugMonitor.startRequest(config.requestId, {
        method: config.method,
        url: config.url,
        hasBody: !!config.data
      });
      
      if (trackingInfo) {
        this.activeRequests.set(config.requestId, trackingInfo);
      }
    }
    
    // Log request
    if (this.options.logRequests) {
      this.debugMonitor.logRequest(config);
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
    if (!this.options.enabled) {
      return response;
    }
    
    // Get request ID from config
    const requestId = response.config?.requestId;
    
    // End tracking request
    if (this.options.trackPerformance && requestId) {
      this.debugMonitor.endRequest(requestId, {
        success: true,
        statusCode: response.status
      });
      
      this.activeRequests.delete(requestId);
    }
    
    // Log response
    if (this.options.logRequests) {
      this.debugMonitor.logResponse(response);
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
    if (!this.options.enabled) {
      throw error;
    }
    
    // Get request ID from config
    const requestId = error.config?.requestId;
    
    // End tracking request
    if (this.options.trackPerformance && requestId) {
      // Determine error type
      const errorType = this._classifyError(error);
      
      this.debugMonitor.endRequest(requestId, {
        success: false,
        statusCode: error.response?.status,
        errorType: errorType
      });
      
      this.activeRequests.delete(requestId);
    }
    
    // Log error
    this.debugMonitor.logError(error);
    
    // Continue with error handling
    throw error;
  }
  
  /**
   * Gets performance metrics
   * 
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    return this.debugMonitor.getPerformanceMetrics();
  }
  
  /**
   * Gets troubleshooting suggestions
   * 
   * @returns {Array} Troubleshooting suggestions
   */
  getTroubleshootingSuggestions() {
    return this.debugMonitor.generateTroubleshootingSuggestions();
  }
  
  /**
   * Creates a diagnostic report
   * 
   * @returns {Object} Diagnostic report
   */
  createDiagnosticReport() {
    return this.debugMonitor.createDiagnosticReport();
  }
  
  /**
   * Resets all performance metrics
   */
  resetMetrics() {
    this.debugMonitor.resetMetrics();
  }
  
  /**
   * Updates configuration options
   * 
   * @param {Object} options - New configuration options
   */
  updateConfig(options = {}) {
    // Update internal options
    if (options.enabled !== undefined) {
      this.options.enabled = options.enabled;
    }
    
    if (options.trackPerformance !== undefined) {
      this.options.trackPerformance = options.trackPerformance;
    }
    
    if (options.logRequests !== undefined) {
      this.options.logRequests = options.logRequests;
    }
    
    if (options.includeHeaders !== undefined) {
      this.options.includeHeaders = options.includeHeaders;
    }
    
    if (options.includeBody !== undefined) {
      this.options.includeBody = options.includeBody;
    }
    
    if (options.maskSensitive !== undefined) {
      this.options.maskSensitive = options.maskSensitive;
    }
    
    // Update debug monitor
    this.debugMonitor.updateConfig(this.options);
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
    if (error.response?.status === 429 || error.name === 'RateLimitError') {
      return 'rate_limit';
    }
    
    if (error.response?.status === 403 && 
        (error.response.headers?.server?.includes('cloudflare') ||
         error.name === 'CloudflareError')) {
      return 'cloudflare_block';
    }
    
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return 'network_timeout';
    }
    
    if (error.response?.status === 401) {
      return 'authentication_error';
    }
    
    if (error.code?.includes('CERT_') || error.code?.includes('SSL_')) {
      return 'ssl_error';
    }
    
    if (error.response?.status >= 500) {
      return 'server_error';
    }
    
    if (error.response?.status >= 400) {
      return 'client_error';
    }
    
    return 'unknown_error';
  }
}

export default DebugInterceptor;