/**
 * @fileoverview
 * DebugMonitor - Advanced debugging and monitoring features for the SDK
 * Provides request/response logging, performance metrics tracking, and troubleshooting helpers
 */

import logger from './Logger.js';

/**
 * DebugMonitor class for advanced debugging and monitoring features
 * 
 * @class
 */
class DebugMonitor {
  /**
   * Creates a new DebugMonitor instance
   * 
   * @param {Object} [options={}] - Configuration options
   * @param {boolean} [options.enabled=false] - Whether debugging is enabled
   * @param {boolean} [options.trackPerformance=false] - Whether to track performance metrics
   * @param {boolean} [options.logRequests=false] - Whether to log requests and responses
   * @param {boolean} [options.includeHeaders=false] - Whether to include headers in logs
   * @param {boolean} [options.includeBody=false] - Whether to include request/response bodies
   * @param {boolean} [options.maskSensitive=true] - Whether to mask sensitive data
   * @param {Object} [options.logger] - Custom logger instance
   */
  constructor(options = {}) {
    this.options = {
      enabled: options.enabled || false,
      trackPerformance: options.trackPerformance || false,
      logRequests: options.logRequests || false,
      includeHeaders: options.includeHeaders || false,
      includeBody: options.includeBody || false,
      maskSensitive: options.maskSensitive !== false,
      logger: options.logger || logger
    };
    
    // Initialize performance tracking
    this.requestTimers = new Map();
    this.performanceData = {
      requestCounts: {
        total: 0,
        success: 0,
        error: 0,
        byEndpoint: new Map()
      },
      timings: {
        total: 0,
        average: 0,
        min: Infinity,
        max: 0,
        byEndpoint: new Map()
      },
      errors: {
        byType: new Map(),
        byStatusCode: new Map(),
        recent: []
      }
    };
    
    // Bind methods
    this.startRequest = this.startRequest.bind(this);
    this.endRequest = this.endRequest.bind(this);
    this.logRequest = this.logRequest.bind(this);
    this.logResponse = this.logResponse.bind(this);
    this.logError = this.logError.bind(this);
  }
  
  /**
   * Starts tracking a request for performance monitoring
   * 
   * @param {string} requestId - Unique identifier for the request
   * @param {Object} requestData - Request data
   * @returns {Object} Request tracking information
   */
  startRequest(requestId, requestData = {}) {
    if (!this.options.enabled || !this.options.trackPerformance) {
      return null;
    }
    
    const startTime = performance.now();
    const trackingInfo = {
      id: requestId,
      startTime,
      method: requestData.method || 'UNKNOWN',
      url: requestData.url || 'unknown',
      endpoint: this._extractEndpoint(requestData.url || '')
    };
    
    this.requestTimers.set(requestId, trackingInfo);
    this.performanceData.requestCounts.total++;
    
    // Track by endpoint
    const endpoint = trackingInfo.endpoint;
    if (endpoint) {
      const endpointCount = this.performanceData.requestCounts.byEndpoint.get(endpoint) || 0;
      this.performanceData.requestCounts.byEndpoint.set(endpoint, endpointCount + 1);
    }
    
    if (this.options.logRequests) {
      this.options.logger.debug('DebugMonitor: Request started', {
        requestId,
        method: trackingInfo.method,
        url: trackingInfo.url
      });
    }
    
    return trackingInfo;
  }
  
  /**
   * Ends tracking a request and records performance metrics
   * 
   * @param {string} requestId - Unique identifier for the request
   * @param {Object} responseData - Response data
   * @param {boolean} [responseData.success=true] - Whether the request was successful
   * @param {number} [responseData.statusCode] - HTTP status code
   * @param {string} [responseData.errorType] - Type of error if failed
   * @returns {Object} Performance metrics for the request
   */
  endRequest(requestId, responseData = {}) {
    if (!this.options.enabled || !this.options.trackPerformance) {
      return null;
    }
    
    const trackingInfo = this.requestTimers.get(requestId);
    if (!trackingInfo) {
      return null;
    }
    
    const endTime = performance.now();
    const duration = endTime - trackingInfo.startTime;
    
    // Update overall timing stats
    this.performanceData.timings.total += duration;
    this.performanceData.timings.min = Math.min(this.performanceData.timings.min, duration);
    this.performanceData.timings.max = Math.max(this.performanceData.timings.max, duration);
    this.performanceData.timings.average = 
      this.performanceData.timings.total / this.performanceData.requestCounts.total;
    
    // Update endpoint-specific timing stats
    const endpoint = trackingInfo.endpoint;
    if (endpoint) {
      const endpointTimings = this.performanceData.timings.byEndpoint.get(endpoint) || {
        count: 0,
        total: 0,
        average: 0,
        min: Infinity,
        max: 0
      };
      
      endpointTimings.count++;
      endpointTimings.total += duration;
      endpointTimings.min = Math.min(endpointTimings.min, duration);
      endpointTimings.max = Math.max(endpointTimings.max, duration);
      endpointTimings.average = endpointTimings.total / endpointTimings.count;
      
      this.performanceData.timings.byEndpoint.set(endpoint, endpointTimings);
    }
    
    // Update success/error counts
    const success = responseData.success !== false;
    if (success) {
      this.performanceData.requestCounts.success++;
    } else {
      this.performanceData.requestCounts.error++;
      
      // Track error types
      if (responseData.errorType) {
        const errorTypeCount = this.performanceData.errors.byType.get(responseData.errorType) || 0;
        this.performanceData.errors.byType.set(responseData.errorType, errorTypeCount + 1);
      }
      
      // Track status codes
      if (responseData.statusCode) {
        const statusCodeCount = this.performanceData.errors.byStatusCode.get(responseData.statusCode) || 0;
        this.performanceData.errors.byStatusCode.set(responseData.statusCode, statusCodeCount + 1);
      }
      
      // Add to recent errors
      this.performanceData.errors.recent.push({
        timestamp: new Date().toISOString(),
        requestId,
        method: trackingInfo.method,
        url: trackingInfo.url,
        endpoint,
        errorType: responseData.errorType,
        statusCode: responseData.statusCode,
        duration
      });
      
      // Keep only the most recent 10 errors
      if (this.performanceData.errors.recent.length > 10) {
        this.performanceData.errors.recent = this.performanceData.errors.recent.slice(-10);
      }
    }
    
    // Clean up
    this.requestTimers.delete(requestId);
    
    if (this.options.logRequests) {
      this.options.logger.debug('DebugMonitor: Request completed', {
        requestId,
        duration: `${duration.toFixed(2)}ms`,
        success,
        statusCode: responseData.statusCode
      });
    }
    
    return {
      requestId,
      duration,
      success,
      endpoint
    };
  }
  
  /**
   * Logs a request with configurable detail level
   * 
   * @param {Object} request - Request object
   */
  logRequest(request) {
    if (!this.options.enabled || !this.options.logRequests) {
      return;
    }
    
    const logData = {
      method: request.method,
      url: request.url
    };
    
    if (this.options.includeHeaders && request.headers) {
      logData.headers = request.headers;
    }
    
    if (this.options.includeBody && request.data) {
      logData.body = request.data;
    }
    
    this.options.logger.debug('DebugMonitor: HTTP Request', logData);
  }
  
  /**
   * Logs a response with configurable detail level
   * 
   * @param {Object} response - Response object
   */
  logResponse(response) {
    if (!this.options.enabled || !this.options.logRequests) {
      return;
    }
    
    const logData = {
      status: response.status,
      statusText: response.statusText,
      url: response.config?.url || 'unknown'
    };
    
    if (this.options.includeHeaders && response.headers) {
      logData.headers = response.headers;
    }
    
    if (this.options.includeBody && response.data) {
      logData.body = response.data;
    }
    
    this.options.logger.debug('DebugMonitor: HTTP Response', logData);
  }
  
  /**
   * Logs an error with detailed information
   * 
   * @param {Error} error - Error object
   */
  logError(error) {
    if (!this.options.enabled) {
      return;
    }
    
    const logData = {
      message: error.message,
      name: error.name
    };
    
    // Add request information if available
    if (error.config) {
      logData.request = {
        method: error.config.method,
        url: error.config.url
      };
      
      if (this.options.includeHeaders && error.config.headers) {
        logData.request.headers = error.config.headers;
      }
      
      if (this.options.includeBody && error.config.data) {
        logData.request.body = error.config.data;
      }
    }
    
    // Add response information if available
    if (error.response) {
      logData.response = {
        status: error.response.status,
        statusText: error.response.statusText
      };
      
      if (this.options.includeHeaders && error.response.headers) {
        logData.response.headers = error.response.headers;
      }
      
      if (this.options.includeBody && error.response.data) {
        logData.response.body = error.response.data;
      }
    }
    
    this.options.logger.error('DebugMonitor: HTTP Error', logData);
  }
  
  /**
   * Gets performance metrics for all requests
   * 
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    if (!this.options.enabled || !this.options.trackPerformance) {
      return { enabled: false };
    }
    
    return {
      timestamp: new Date().toISOString(),
      requestCounts: {
        total: this.performanceData.requestCounts.total,
        success: this.performanceData.requestCounts.success,
        error: this.performanceData.requestCounts.error,
        byEndpoint: Object.fromEntries(this.performanceData.requestCounts.byEndpoint)
      },
      timings: {
        average: this.performanceData.timings.average,
        min: this.performanceData.timings.min === Infinity ? 0 : this.performanceData.timings.min,
        max: this.performanceData.timings.max,
        byEndpoint: Object.fromEntries(
          Array.from(this.performanceData.timings.byEndpoint.entries()).map(([key, value]) => [
            key,
            {
              ...value,
              min: value.min === Infinity ? 0 : value.min
            }
          ])
        )
      },
      errors: {
        byType: Object.fromEntries(this.performanceData.errors.byType),
        byStatusCode: Object.fromEntries(this.performanceData.errors.byStatusCode),
        recent: [...this.performanceData.errors.recent]
      }
    };
  }
  
  /**
   * Generates troubleshooting suggestions based on collected metrics
   * 
   * @returns {Array} Array of troubleshooting suggestions
   */
  generateTroubleshootingSuggestions() {
    if (!this.options.enabled || !this.options.trackPerformance) {
      return [];
    }
    
    const suggestions = [];
    const metrics = this.getPerformanceMetrics();
    
    // Check for slow endpoints
    const slowEndpoints = Object.entries(metrics.timings.byEndpoint)
      .filter(([_, timing]) => timing.average > 1000) // Endpoints with average > 1000ms
      .sort((a, b) => b[1].average - a[1].average);
    
    if (slowEndpoints.length > 0) {
      suggestions.push({
        issue: 'Performance',
        suggestion: `Slow endpoint detected: ${slowEndpoints[0][0]} (avg: ${slowEndpoints[0][1].average.toFixed(2)}ms)`,
        priority: 'medium',
        actionable: true
      });
    }
    
    // Check for high error rates
    const errorRate = metrics.requestCounts.total > 0 
      ? (metrics.requestCounts.error / metrics.requestCounts.total) * 100 
      : 0;
    
    if (errorRate > 20) {
      suggestions.push({
        issue: 'Reliability',
        suggestion: `High error rate detected: ${errorRate.toFixed(2)}% of requests are failing`,
        priority: 'high',
        actionable: true
      });
    }
    
    // Check for common error types
    const commonErrorTypes = Object.entries(metrics.errors.byType)
      .sort((a, b) => b[1] - a[1]);
    
    if (commonErrorTypes.length > 0) {
      const [errorType, count] = commonErrorTypes[0];
      suggestions.push({
        issue: 'Error Pattern',
        suggestion: `Common error type detected: ${errorType} (${count} occurrences)`,
        priority: 'high',
        actionable: true
      });
    }
    
    // Check for common status codes
    const commonStatusCodes = Object.entries(metrics.errors.byStatusCode)
      .sort((a, b) => b[1] - a[1]);
    
    if (commonStatusCodes.length > 0) {
      const [statusCode, count] = commonStatusCodes[0];
      
      // Provide specific suggestions based on status code
      if (statusCode === '429') {
        suggestions.push({
          issue: 'Rate Limiting',
          suggestion: `Rate limiting detected (${count} occurrences). Consider implementing backoff strategy or upgrading your plan.`,
          priority: 'high',
          actionable: true
        });
      } else if (statusCode === '403') {
        suggestions.push({
          issue: 'Access Denied',
          suggestion: `Access denied errors detected (${count} occurrences). Check authentication credentials or Cloudflare blocking.`,
          priority: 'high',
          actionable: true
        });
      } else if (statusCode.startsWith('5')) {
        suggestions.push({
          issue: 'Server Errors',
          suggestion: `Server errors detected (${count} occurrences). The API may be experiencing issues.`,
          priority: 'medium',
          actionable: false
        });
      } else if (statusCode.startsWith('4')) {
        suggestions.push({
          issue: 'Client Errors',
          suggestion: `Client errors detected (${count} occurrences). Check your request parameters.`,
          priority: 'medium',
          actionable: true
        });
      }
    }
    
    return suggestions;
  }
  
  /**
   * Creates a comprehensive diagnostic report
   * 
   * @returns {Object} Diagnostic report
   */
  createDiagnosticReport() {
    const metrics = this.getPerformanceMetrics();
    const suggestions = this.generateTroubleshootingSuggestions();
    
    // Calculate success rate
    const successRate = metrics.requestCounts.total > 0
      ? (metrics.requestCounts.success / metrics.requestCounts.total) * 100
      : 0;
    
    // Determine overall health status
    let healthStatus = 'good';
    const healthIssues = [];
    
    if (successRate < 90) {
      healthStatus = 'poor';
      healthIssues.push('Low success rate');
    } else if (successRate < 98) {
      healthStatus = 'fair';
      healthIssues.push('Moderate success rate');
    }
    
    if (metrics.timings.average > 1000) {
      healthStatus = healthStatus === 'good' ? 'fair' : healthStatus;
      healthIssues.push('High average response time');
    }
    
    // Find slowest endpoint
    let slowestEndpoint = null;
    let slowestTime = 0;
    
    Object.entries(metrics.timings.byEndpoint).forEach(([endpoint, timing]) => {
      if (timing.average > slowestTime) {
        slowestEndpoint = endpoint;
        slowestTime = timing.average;
      }
    });
    
    return {
      timestamp: new Date().toISOString(),
      summary: {
        healthStatus,
        healthIssues,
        totalRequests: metrics.requestCounts.total,
        successRate: successRate.toFixed(2) + '%',
        averageResponseTime: metrics.timings.average.toFixed(2) + 'ms',
        slowestEndpoint: slowestEndpoint ? `${slowestEndpoint} (${slowestTime.toFixed(2)}ms)` : 'N/A'
      },
      metrics,
      suggestions,
      configuration: {
        enabled: this.options.enabled,
        trackPerformance: this.options.trackPerformance,
        logRequests: this.options.logRequests,
        includeHeaders: this.options.includeHeaders,
        includeBody: this.options.includeBody,
        maskSensitive: this.options.maskSensitive
      }
    };
  }
  
  /**
   * Resets all performance metrics
   */
  resetMetrics() {
    this.requestTimers.clear();
    this.performanceData = {
      requestCounts: {
        total: 0,
        success: 0,
        error: 0,
        byEndpoint: new Map()
      },
      timings: {
        total: 0,
        average: 0,
        min: Infinity,
        max: 0,
        byEndpoint: new Map()
      },
      errors: {
        byType: new Map(),
        byStatusCode: new Map(),
        recent: []
      }
    };
    
    if (this.options.enabled) {
      this.options.logger.info('DebugMonitor: Performance metrics reset');
    }
  }
  
  /**
   * Updates configuration options
   * 
   * @param {Object} options - New configuration options
   */
  updateConfig(options = {}) {
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
    
    if (options.logger) {
      this.options.logger = options.logger;
    }
    
    if (this.options.enabled) {
      this.options.logger.info('DebugMonitor: Configuration updated', {
        enabled: this.options.enabled,
        trackPerformance: this.options.trackPerformance,
        logRequests: this.options.logRequests
      });
    }
  }
  
  /**
   * Extracts endpoint name from URL for grouping metrics
   * 
   * @param {string} url - Full URL
   * @returns {string} Endpoint name
   * @private
   */
  _extractEndpoint(url) {
    try {
      // Remove query parameters
      const urlWithoutQuery = url.split('?')[0];
      
      // Extract path
      let path;
      if (urlWithoutQuery.includes('://')) {
        const urlObj = new URL(urlWithoutQuery);
        path = urlObj.pathname;
      } else {
        path = urlWithoutQuery;
      }
      
      // Clean up path
      path = path.replace(/\/+$/, ''); // Remove trailing slashes
      
      // Handle common API patterns
      if (path.includes('/api/')) {
        path = path.split('/api/')[1];
      }
      
      // Handle dynamic IDs in paths by replacing them with placeholders
      // e.g. /users/123 -> /users/:id
      return path.replace(/\/[0-9a-f]{8,}$/i, '/:id')
                .replace(/\/[0-9]+$/i, '/:id');
    } catch (error) {
      return url;
    }
  }
}

export default DebugMonitor;