/**
 * @fileoverview
 * Logger - A configurable logging system with sensitive data masking
 * and structured log format for better debugging.
 */

/**
 * Log levels enumeration
 * @enum {number}
 */
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4
};

/**
 * Maps log level names to their numeric values
 * @type {Object.<string, number>}
 */
const LOG_LEVEL_MAP = {
  'debug': LogLevel.DEBUG,
  'info': LogLevel.INFO,
  'warn': LogLevel.WARN,
  'error': LogLevel.ERROR,
  'silent': LogLevel.SILENT
};

/**
 * Default sensitive keys that should be masked in logs
 * @type {string[]}
 */
const DEFAULT_SENSITIVE_KEYS = [
  'password', 
  'secret', 
  'key', 
  'token', 
  'auth', 
  'credential', 
  'apiKey', 
  'accessToken', 
  'refreshToken',
  'clientSecret',
  'privateKey',
  'x-signature'
];

/**
 * Logger class for configurable logging with sensitive data masking
 * 
 * @class
 */
class Logger {
  /**
   * Creates a new Logger instance
   * 
   * @param {Object} [options={}] - Configuration options
   * @param {string|number} [options.level='warn'] - Log level (debug, info, warn, error, silent)
   * @param {boolean} [options.includeTimestamp=true] - Whether to include timestamp in logs
   * @param {boolean} [options.includeLevel=true] - Whether to include log level in logs
   * @param {boolean} [options.maskSensitive=true] - Whether to mask sensitive data
   * @param {string[]} [options.sensitiveKeys] - Keys to mask
   * @param {Function} [options.transport] - Custom transport function for logs
   * @param {string} [options.format='text'] - Log format ('text', 'json')
   * @param {boolean} [options.colorize=true] - Whether to colorize console output
   * @param {string} [options.prefix=''] - Prefix for all log messages
   * @param {boolean} [options.enableMetrics=false] - Whether to enable performance metrics tracking
   */
  constructor(options = {}) {
    this.options = {
      level: this._parseLevel(options.level || 'warn'),
      includeTimestamp: options.includeTimestamp !== false,
      includeLevel: options.includeLevel !== false,
      maskSensitive: options.maskSensitive !== false,
      sensitiveKeys: options.sensitiveKeys || [...DEFAULT_SENSITIVE_KEYS],
      transport: options.transport || this._defaultTransport.bind(this),
      format: options.format || 'text',
      colorize: options.colorize !== false && this._isNodeEnvironment(),
      prefix: options.prefix || '',
      enableMetrics: options.enableMetrics || false
    };
    
    // Initialize performance metrics tracking
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        retried: 0,
        rateLimited: 0,
        cloudflareBlocked: 0
      },
      performance: {
        totalResponseTime: 0,
        averageResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        requestTimes: []
      },
      errors: {
        byType: new Map(),
        byStatusCode: new Map(),
        recent: []
      },
      troubleshooting: {
        commonIssues: new Map(),
        suggestions: []
      }
    };
    
    // Bind log methods
    this.debug = this.debug.bind(this);
    this.info = this.info.bind(this);
    this.warn = this.warn.bind(this);
    this.error = this.error.bind(this);
  }
  
  /**
   * Checks if code is running in Node.js environment
   * 
   * @returns {boolean} True if running in Node.js
   * @private
   */
  _isNodeEnvironment() {
    return typeof process !== 'undefined' && 
           process.versions != null && 
           process.versions.node != null;
  }
  
  /**
   * Parses log level from string or number
   * 
   * @param {string|number} level - Log level
   * @returns {number} Numeric log level
   * @private
   */
  _parseLevel(level) {
    if (typeof level === 'number') {
      return Math.max(0, Math.min(4, level));
    }
    
    const levelStr = String(level).toLowerCase();
    return LOG_LEVEL_MAP[levelStr] !== undefined ? LOG_LEVEL_MAP[levelStr] : LogLevel.WARN;
  }
  
  /**
   * Gets ANSI color code for log level
   * 
   * @param {string} level - Log level
   * @returns {string} ANSI color code
   * @private
   */
  _getLevelColor(level) {
    if (!this.options.colorize) {
      return '';
    }
    
    const colors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
      reset: '\x1b[0m'   // Reset
    };
    
    return colors[level] || '';
  }
  
  /**
   * Default log transport function
   * 
   * @param {string} level - Log level
   * @param {Array} args - Log arguments
   * @private
   */
  _defaultTransport(level, args) {
    // Use appropriate console method based on level
    const resetColor = this.options.colorize ? '\x1b[0m' : '';
    const levelColor = this._getLevelColor(level);
    
    switch (level) {
      case 'debug': 
        console.debug(levelColor, ...args, resetColor); 
        break;
      case 'info': 
        console.info(levelColor, ...args, resetColor); 
        break;
      case 'warn': 
        console.warn(levelColor, ...args, resetColor); 
        break;
      case 'error': 
        console.error(levelColor, ...args, resetColor); 
        break;
    }
  }
  
  /**
   * Formats log message with timestamp and level if enabled
   * 
   * @param {string} level - Log level
   * @param {Array} args - Log arguments
   * @returns {Array} Formatted log arguments
   * @private
   */
  _formatLog(level, args) {
    if (this.options.format === 'json') {
      return [this._formatJsonLog(level, args)];
    }
    
    return this._formatTextLog(level, args);
  }
  
  /**
   * Formats log message as text
   * 
   * @param {string} level - Log level
   * @param {Array} args - Log arguments
   * @returns {Array} Formatted log arguments
   * @private
   */
  _formatTextLog(level, args) {
    const formattedArgs = [];
    
    // Add timestamp if enabled
    if (this.options.includeTimestamp) {
      const timestamp = new Date().toISOString();
      formattedArgs.push(`[${timestamp}]`);
    }
    
    // Add log level if enabled
    if (this.options.includeLevel) {
      formattedArgs.push(`[${level.toUpperCase()}]`);
    }
    
    // Add SDK identifier
    formattedArgs.push('[TestluyPaymentSDK]');
    
    // Add prefix if specified
    if (this.options.prefix) {
      formattedArgs.push(`[${this.options.prefix}]`);
    }
    
    // Add original arguments
    return [...formattedArgs, ...args];
  }
  
  /**
   * Formats log message as JSON
   * 
   * @param {string} level - Log level
   * @param {Array} args - Log arguments
   * @returns {string} JSON formatted log
   * @private
   */
  _formatJsonLog(level, args) {
    const logObject = {
      level: level.toUpperCase(),
      service: 'TestluyPaymentSDK'
    };
    
    // Add timestamp if enabled
    if (this.options.includeTimestamp) {
      logObject.timestamp = new Date().toISOString();
    }
    
    // Add prefix if specified
    if (this.options.prefix) {
      logObject.component = this.options.prefix;
    }
    
    // Process arguments into the log object
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
      // If single object argument, merge with log object
      Object.assign(logObject, { data: args[0] });
    } else if (args.length >= 2 && typeof args[0] === 'string') {
      // If message + data pattern
      logObject.message = args[0];
      if (args.length === 2 && typeof args[1] === 'object') {
        logObject.data = args[1];
      } else {
        logObject.data = args.slice(1);
      }
    } else {
      // Otherwise treat as message or array of messages
      logObject.message = args.length === 1 ? args[0] : args;
    }
    
    return JSON.stringify(logObject);
  }
  
  /**
   * Masks sensitive data in objects
   * 
   * @param {*} data - Data to mask
   * @returns {*} Masked data
   * @private
   */
  _maskSensitiveData(data) {
    if (!this.options.maskSensitive) {
      return data;
    }
    
    if (data === null || data === undefined) {
      return data;
    }
    
    // Handle different data types
    if (typeof data === 'object') {
      if (Array.isArray(data)) {
        return data.map(item => this._maskSensitiveData(item));
      }
      
      const maskedData = {};
      
      for (const [key, value] of Object.entries(data)) {
        // Check if key contains sensitive information
        const isSensitive = this.options.sensitiveKeys.some(
          sensitiveKey => key.toLowerCase().includes(sensitiveKey.toLowerCase())
        );
        
        if (isSensitive && typeof value === 'string') {
          // Mask sensitive string values
          maskedData[key] = this._maskString(value);
        } else if (typeof value === 'object' && value !== null) {
          // Recursively mask nested objects
          maskedData[key] = this._maskSensitiveData(value);
        } else {
          // Keep non-sensitive values as is
          maskedData[key] = value;
        }
      }
      
      return maskedData;
    }
    
    return data;
  }
  
  /**
   * Masks a sensitive string
   * 
   * @param {string} str - String to mask
   * @returns {string} Masked string
   * @private
   */
  _maskString(str) {
    if (typeof str !== 'string') {
      return str;
    }
    
    if (str.length <= 4) {
      return '****';
    }
    
    // Keep first and last character, mask the rest
    return str.charAt(0) + '****' + str.charAt(str.length - 1);
  }
  
  /**
   * Logs a debug message
   * 
   * @param {...*} args - Log arguments
   */
  debug(...args) {
    if (this.options.level <= LogLevel.DEBUG) {
      const maskedArgs = this.options.maskSensitive ? 
        args.map(arg => this._maskSensitiveData(arg)) : args;
      
      this.options.transport('debug', this._formatLog('debug', maskedArgs));
    }
  }
  
  /**
   * Logs an info message
   * 
   * @param {...*} args - Log arguments
   */
  info(...args) {
    if (this.options.level <= LogLevel.INFO) {
      const maskedArgs = this.options.maskSensitive ? 
        args.map(arg => this._maskSensitiveData(arg)) : args;
      
      this.options.transport('info', this._formatLog('info', maskedArgs));
    }
  }
  
  /**
   * Logs a warning message
   * 
   * @param {...*} args - Log arguments
   */
  warn(...args) {
    if (this.options.level <= LogLevel.WARN) {
      const maskedArgs = this.options.maskSensitive ? 
        args.map(arg => this._maskSensitiveData(arg)) : args;
      
      this.options.transport('warn', this._formatLog('warn', maskedArgs));
    }
  }
  
  /**
   * Logs an error message
   * 
   * @param {...*} args - Log arguments
   */
  error(...args) {
    if (this.options.level <= LogLevel.ERROR) {
      const maskedArgs = this.options.maskSensitive ? 
        args.map(arg => this._maskSensitiveData(arg)) : args;
      
      this.options.transport('error', this._formatLog('error', maskedArgs));
    }
  }
  
  /**
   * Logs an HTTP request
   * 
   * @param {Object} request - Request object
   * @param {Object} [options={}] - Logging options
   * @param {boolean} [options.includeHeaders=false] - Whether to include headers
   * @param {boolean} [options.includeBody=false] - Whether to include body
   */
  logRequest(request, options = {}) {
    if (this.options.level <= LogLevel.DEBUG) {
      const { method, url } = request;
      const logData = { method, url };
      
      if (options.includeHeaders && request.headers) {
        logData.headers = this._maskSensitiveData(request.headers);
      }
      
      if (options.includeBody && request.data) {
        logData.body = this._maskSensitiveData(request.data);
      }
      
      this.debug('HTTP Request:', logData);
    }
  }
  
  /**
   * Logs an HTTP response
   * 
   * @param {Object} response - Response object
   * @param {Object} [options={}] - Logging options
   * @param {boolean} [options.includeHeaders=false] - Whether to include headers
   * @param {boolean} [options.includeBody=false] - Whether to include body
   */
  logResponse(response, options = {}) {
    if (this.options.level <= LogLevel.DEBUG) {
      const { status, statusText, config } = response;
      const logData = { 
        status, 
        statusText,
        url: config?.url || 'unknown'
      };
      
      if (options.includeHeaders && response.headers) {
        logData.headers = this._maskSensitiveData(response.headers);
      }
      
      if (options.includeBody && response.data) {
        logData.body = this._maskSensitiveData(response.data);
      }
      
      this.debug('HTTP Response:', logData);
    }
  }
  
  /**
   * Logs an HTTP error
   * 
   * @param {Error} error - Error object
   * @param {Object} [options={}] - Logging options
   * @param {boolean} [options.includeHeaders=false] - Whether to include headers
   * @param {boolean} [options.includeBody=false] - Whether to include body
   * @param {boolean} [options.includeStack=false] - Whether to include stack trace
   */
  logError(error, options = {}) {
    if (this.options.level <= LogLevel.ERROR) {
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
        
        if (options.includeHeaders && error.config.headers) {
          logData.request.headers = this._maskSensitiveData(error.config.headers);
        }
        
        if (options.includeBody && error.config.data) {
          logData.request.body = this._maskSensitiveData(error.config.data);
        }
      }
      
      // Add response information if available
      if (error.response) {
        logData.response = {
          status: error.response.status,
          statusText: error.response.statusText
        };
        
        if (options.includeHeaders && error.response.headers) {
          logData.response.headers = this._maskSensitiveData(error.response.headers);
        }
        
        if (options.includeBody && error.response.data) {
          logData.response.data = this._maskSensitiveData(error.response.data);
        }
      }
      
      // Add stack trace if enabled
      if (options.includeStack && error.stack) {
        logData.stack = error.stack;
      }
      
      this.error('HTTP Error:', logData);
    }
  }
  
  /**
   * Updates logger configuration
   * 
   * @param {Object} options - New configuration options
   */
  updateConfig(options = {}) {
    if (options.level !== undefined) {
      this.options.level = this._parseLevel(options.level);
    }
    
    if (options.includeTimestamp !== undefined) {
      this.options.includeTimestamp = options.includeTimestamp;
    }
    
    if (options.includeLevel !== undefined) {
      this.options.includeLevel = options.includeLevel;
    }
    
    if (options.maskSensitive !== undefined) {
      this.options.maskSensitive = options.maskSensitive;
    }
    
    if (options.sensitiveKeys !== undefined) {
      this.options.sensitiveKeys = options.sensitiveKeys;
    }
    
    if (options.transport !== undefined) {
      this.options.transport = options.transport;
    }
    
    if (options.format !== undefined) {
      this.options.format = options.format;
    }
    
    if (options.colorize !== undefined) {
      this.options.colorize = options.colorize;
    }
    
    if (options.prefix !== undefined) {
      this.options.prefix = options.prefix;
    }
    
    if (options.enableMetrics !== undefined) {
      this.options.enableMetrics = options.enableMetrics;
    }
  }
  
  /**
   * Creates a child logger with inherited configuration
   * 
   * @param {Object} [options={}] - Configuration overrides for the child logger
   * @param {string} [prefix] - Prefix for all log messages from this child
   * @returns {Logger} New logger instance
   */
  createChild(options = {}, prefix) {
    const childOptions = { ...this.options, ...options };
    if (prefix) {
      childOptions.prefix = this.options.prefix 
        ? `${this.options.prefix}:${prefix}` 
        : prefix;
    }
    
    return new Logger(childOptions);
  }
  
  /**
   * Gets the current log level as a string
   * 
   * @returns {string} Current log level
   */
  getLevel() {
    const levels = Object.entries(LogLevel);
    for (const [name, value] of levels) {
      if (value === this.options.level) {
        return name.toLowerCase();
      }
    }
    return 'unknown';
  }
  
  /**
   * Checks if a specific log level is enabled
   * 
   * @param {string|number} level - Log level to check
   * @returns {boolean} True if the level is enabled
   */
  isLevelEnabled(level) {
    const parsedLevel = this._parseLevel(level);
    return this.options.level <= parsedLevel;
  }
  
  /**
   * Creates a logger factory function for creating consistent loggers
   * 
   * @param {Object} defaultOptions - Default options for all loggers
   * @returns {Function} Logger factory function
   * @static
   */
  static createLoggerFactory(defaultOptions = {}) {
    return (options = {}, prefix) => {
      const mergedOptions = { ...defaultOptions, ...options };
      if (prefix) {
        mergedOptions.prefix = prefix;
      }
      return new Logger(mergedOptions);
    };
  }
  
  /**
   * Creates a logger from environment variables
   * 
   * @param {Object} [baseOptions={}] - Base options to merge with environment settings
   * @returns {Logger} Configured logger instance
   * @static
   */
  static fromEnvironment(baseOptions = {}) {
    const options = { ...baseOptions };
    
    // Check for environment variables in Node.js environment
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.LOG_LEVEL) {
        options.level = process.env.LOG_LEVEL.toLowerCase();
      }
      
      if (process.env.LOG_FORMAT) {
        options.format = process.env.LOG_FORMAT.toLowerCase();
      }
      
      if (process.env.LOG_MASK_SENSITIVE) {
        options.maskSensitive = process.env.LOG_MASK_SENSITIVE.toLowerCase() === 'true';
      }
      
      if (process.env.LOG_COLORIZE) {
        options.colorize = process.env.LOG_COLORIZE.toLowerCase() === 'true';
      }
      
      if (process.env.LOG_ENABLE_METRICS) {
        options.enableMetrics = process.env.LOG_ENABLE_METRICS.toLowerCase() === 'true';
      }
    }
    
    return new Logger(options);
  }
  
  // ===== PERFORMANCE METRICS TRACKING =====
  
  /**
   * Records the start of a request for performance tracking
   * 
   * @param {string} requestId - Unique identifier for the request
   * @param {Object} requestInfo - Information about the request
   * @returns {Object} Request tracking object
   */
  startRequestTracking(requestId, requestInfo = {}) {
    if (!this.options.enableMetrics) {
      return null;
    }
    
    const startTime = Date.now();
    const trackingInfo = {
      requestId,
      startTime,
      method: requestInfo.method || 'UNKNOWN',
      url: requestInfo.url || 'unknown',
      ...requestInfo
    };
    
    this.metrics.requests.total++;
    
    this.debug('Request tracking started:', {
      requestId,
      method: trackingInfo.method,
      url: trackingInfo.url
    });
    
    return trackingInfo;
  }
  
  /**
   * Records the completion of a request for performance tracking
   * 
   * @param {Object} trackingInfo - Request tracking object from startRequestTracking
   * @param {Object} result - Result information
   * @param {boolean} result.success - Whether the request was successful
   * @param {number} [result.statusCode] - HTTP status code
   * @param {string} [result.errorType] - Type of error if failed
   * @param {boolean} [result.wasRetried] - Whether the request was retried
   * @param {boolean} [result.wasRateLimited] - Whether the request was rate limited
   * @param {boolean} [result.wasCloudflareBlocked] - Whether blocked by Cloudflare
   */
  endRequestTracking(trackingInfo, result = {}) {
    if (!this.options.enableMetrics || !trackingInfo) {
      return;
    }
    
    const endTime = Date.now();
    const responseTime = endTime - trackingInfo.startTime;
    
    // Update performance metrics
    this.metrics.performance.totalResponseTime += responseTime;
    this.metrics.performance.requestTimes.push(responseTime);
    this.metrics.performance.minResponseTime = Math.min(
      this.metrics.performance.minResponseTime, 
      responseTime
    );
    this.metrics.performance.maxResponseTime = Math.max(
      this.metrics.performance.maxResponseTime, 
      responseTime
    );
    this.metrics.performance.averageResponseTime = 
      this.metrics.performance.totalResponseTime / this.metrics.requests.total;
    
    // Keep only last 100 request times to prevent memory bloat
    if (this.metrics.performance.requestTimes.length > 100) {
      this.metrics.performance.requestTimes = this.metrics.performance.requestTimes.slice(-100);
    }
    
    // Update request counters
    if (result.success) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
      
      // Track error types
      if (result.errorType) {
        const count = this.metrics.errors.byType.get(result.errorType) || 0;
        this.metrics.errors.byType.set(result.errorType, count + 1);
      }
      
      // Track status codes
      if (result.statusCode) {
        const count = this.metrics.errors.byStatusCode.get(result.statusCode) || 0;
        this.metrics.errors.byStatusCode.set(result.statusCode, count + 1);
      }
      
      // Add to recent errors (keep last 10)
      this.metrics.errors.recent.push({
        timestamp: new Date().toISOString(),
        requestId: trackingInfo.requestId,
        method: trackingInfo.method,
        url: trackingInfo.url,
        errorType: result.errorType,
        statusCode: result.statusCode,
        responseTime
      });
      
      if (this.metrics.errors.recent.length > 10) {
        this.metrics.errors.recent = this.metrics.errors.recent.slice(-10);
      }
    }
    
    // Update specific counters
    if (result.wasRetried) {
      this.metrics.requests.retried++;
    }
    if (result.wasRateLimited) {
      this.metrics.requests.rateLimited++;
    }
    if (result.wasCloudflareBlocked) {
      this.metrics.requests.cloudflareBlocked++;
    }
    
    this.debug('Request tracking completed:', {
      requestId: trackingInfo.requestId,
      responseTime,
      success: result.success,
      statusCode: result.statusCode
    });
  }
  
  /**
   * Gets current performance metrics
   * 
   * @returns {Object} Current metrics data
   */
  getMetrics() {
    if (!this.options.enableMetrics) {
      return { metricsDisabled: true };
    }
    
    return {
      timestamp: new Date().toISOString(),
      requests: { ...this.metrics.requests },
      performance: {
        ...this.metrics.performance,
        minResponseTime: this.metrics.performance.minResponseTime === Infinity ? 0 : this.metrics.performance.minResponseTime,
        requestTimes: [...this.metrics.performance.requestTimes] // Copy array
      },
      errors: {
        byType: Object.fromEntries(this.metrics.errors.byType),
        byStatusCode: Object.fromEntries(this.metrics.errors.byStatusCode),
        recent: [...this.metrics.errors.recent] // Copy array
      },
      troubleshooting: {
        commonIssues: Object.fromEntries(this.metrics.troubleshooting.commonIssues),
        suggestions: [...this.metrics.troubleshooting.suggestions]
      }
    };
  }
  
  /**
   * Resets all metrics
   */
  resetMetrics() {
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        retried: 0,
        rateLimited: 0,
        cloudflareBlocked: 0
      },
      performance: {
        totalResponseTime: 0,
        averageResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        requestTimes: []
      },
      errors: {
        byType: new Map(),
        byStatusCode: new Map(),
        recent: []
      },
      troubleshooting: {
        commonIssues: new Map(),
        suggestions: []
      }
    };
    
    this.info('Performance metrics reset');
  }
  
  /**
   * Logs current performance metrics summary
   */
  logMetricsSummary() {
    if (!this.options.enableMetrics) {
      this.warn('Metrics tracking is disabled');
      return;
    }
    
    const metrics = this.getMetrics();
    const successRate = metrics.requests.total > 0 
      ? ((metrics.requests.successful / metrics.requests.total) * 100).toFixed(2)
      : 0;
    
    this.info('Performance Metrics Summary:', {
      totalRequests: metrics.requests.total,
      successfulRequests: metrics.requests.successful,
      failedRequests: metrics.requests.failed,
      successRate: `${successRate}%`,
      averageResponseTime: `${metrics.performance.averageResponseTime.toFixed(2)}ms`,
      minResponseTime: `${metrics.performance.minResponseTime === Infinity ? 0 : metrics.performance.minResponseTime}ms`,
      maxResponseTime: `${metrics.performance.maxResponseTime}ms`,
      retriedRequests: metrics.requests.retried,
      rateLimitedRequests: metrics.requests.rateLimited,
      cloudflareBlockedRequests: metrics.requests.cloudflareBlocked
    });
  }
  
  /**
   * Gets troubleshooting suggestions based on recorded issues
   * 
   * @returns {Array} Array of troubleshooting suggestions sorted by priority
   */
  getTroubleshootingSuggestions() {
    if (!this.options.enableMetrics) {
      return [];
    }
    
    // Sort suggestions by priority (high, medium, low)
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    
    return [...this.metrics.troubleshooting.suggestions].sort((a, b) => {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
  
  /**
   * Logs troubleshooting suggestions to console
   */
  logTroubleshootingSuggestions() {
    if (!this.options.enableMetrics) {
      this.warn('Metrics tracking is disabled');
      return;
    }
    
    const suggestions = this.getTroubleshootingSuggestions();
    
    if (suggestions.length === 0) {
      this.info('No troubleshooting suggestions available');
      return;
    }
    
    this.info('Troubleshooting Suggestions:');
    
    suggestions.forEach(suggestion => {
      const priorityLabel = suggestion.priority.toUpperCase();
      const actionableLabel = suggestion.actionable ? '[ACTIONABLE]' : '[INFO]';
      this.info(`${priorityLabel} ${actionableLabel} ${suggestion.issue}: ${suggestion.suggestion}`);
    });
  }
  
  /**
   * Generates a comprehensive diagnostic report
   * 
   * @returns {Object} Diagnostic report with metrics, issues, and configuration
   */
  generateDiagnosticReport() {
    const metrics = this.getMetrics();
    const suggestions = this.getTroubleshootingSuggestions();
    
    // Calculate additional diagnostic information
    const totalRequests = metrics.requests.total;
    const successRate = totalRequests > 0 
      ? (metrics.requests.successful / totalRequests) * 100 
      : 0;
    
    // Identify most common errors
    const commonErrorTypes = Object.entries(metrics.errors.byType || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, count]) => ({ type, count }));
    
    const commonStatusCodes = Object.entries(metrics.errors.byStatusCode || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([code, count]) => ({ code: parseInt(code), count }));
    
    // Generate health assessment
    let healthStatus = 'good';
    let healthReasons = [];
    
    if (successRate < 90) {
      healthStatus = 'poor';
      healthReasons.push('Low success rate (< 90%)');
    } else if (successRate < 98) {
      healthStatus = 'fair';
      healthReasons.push('Moderate success rate (< 98%)');
    }
    
    if (metrics.requests.cloudflareBlocked > 0) {
      healthStatus = healthStatus === 'good' ? 'fair' : 'poor';
      healthReasons.push('Cloudflare blocking detected');
    }
    
    if (metrics.requests.rateLimited > 0) {
      healthStatus = healthStatus === 'good' ? 'fair' : healthStatus;
      healthReasons.push('Rate limiting detected');
    }
    
    // Build the diagnostic report
    return {
      timestamp: new Date().toISOString(),
      summary: {
        healthStatus,
        healthReasons,
        totalRequests,
        successRate: successRate.toFixed(2) + '%',
        averageResponseTime: metrics.performance.averageResponseTime.toFixed(2) + 'ms',
        cloudflareBlockedRequests: metrics.requests.cloudflareBlocked,
        rateLimitedRequests: metrics.requests.rateLimited
      },
      metrics: {
        requests: metrics.requests,
        performance: {
          averageResponseTime: metrics.performance.averageResponseTime,
          minResponseTime: metrics.performance.minResponseTime === Infinity ? 0 : metrics.performance.minResponseTimeTime === Infinity ? 0 : metrics.performance.minResponseTime,
          maxResponseTime: metrics.performance.maxResponseTime
        }
      },
      issues: {
        commonErrorTypes,
        commonStatusCodes,
        recentErrors: metrics.errors.recent || []
      },
      recommendations: suggestions,
      configuration: {
        logLevel: this.getLevel(),
        metricsEnabled: this.options.enableMetrics,
        maskSensitive: this.options.maskSensitive
      }
    };
  }
  
  /**
   * Logs a comprehensive diagnostic report to console
   */
  logDiagnosticReport() {
    if (!this.options.enableMetrics) {
      this.warn('Metrics tracking is disabled');
      return;
    }
    
    const report = this.generateDiagnosticReport();
    
    this.info('=== TestluyPaymentSDK Diagnostic Report ===');
    this.info(`Timestamp: ${report.timestamp}`);
    this.info(`Health Status: ${report.summary.healthStatus.toUpperCase()}`);
    
    if (report.summary.healthReasons.length > 0) {
      this.info('Health Reasons:');
      report.summary.healthReasons.forEach(reason => {
        this.info(`- ${reason}`);
      });
    }
    
    this.info('\nRequest Summary:');
    this.info(`- Total Requests: ${report.summary.totalRequests}`);
    this.info(`- Success Rate: ${report.summary.successRate}`);
    this.info(`- Average Response Time: ${report.summary.averageResponseTime}`);
    this.info(`- Cloudflare Blocked Requests: ${report.summary.cloudflareBlockedRequests}`);
    this.info(`- Rate Limited Requests: ${report.summary.rateLimitedRequests}`);
    
    if (report.issues.commonErrorTypes.length > 0) {
      this.info('\nCommon Error Types:');
      report.issues.commonErrorTypes.forEach(({ type, count }) => {
        this.info(`- ${type}: ${count} occurrences`);
      });
    }
    
    if (report.issues.commonStatusCodes.length > 0) {
      this.info('\nCommon Error Status Codes:');
      report.issues.commonStatusCodes.forEach(({ code, count }) => {
        this.info(`- ${code}: ${count} occurrences`);
      });
    }
    
    if (report.recommendations.length > 0) {
      this.info('\nRecommendations:');
      report.recommendations.forEach(suggestion => {
        const priorityLabel = suggestion.priority.toUpperCase();
        const actionableLabel = suggestion.actionable ? '[ACTIONABLE]' : '[INFO]';
        this.info(`- ${priorityLabel} ${actionableLabel} ${suggestion.issue}: ${suggestion.suggestion}`);
      });
    }
    
    this.info('\nConfiguration:');
    this.info(`- Log Level: ${report.configuration.logLevel.toUpperCase()}`);
    this.info(`- Metrics Enabled: ${report.configuration.metricsEnabled}`);
    this.info(`- Mask Sensitive Data: ${report.configuration.maskSensitive}`);
    
    this.info('\n=== End of Diagnostic Report ===');
  }
  
  // ===== TROUBLESHOOTING HELPERS =====
  
  /**
   * Records a common issue for troubleshooting analysis
   * 
   * @param {string} issueType - Type of issue (e.g., 'rate_limit', 'cloudflare_block')
   * @param {Object} details - Additional details about the issue
   */
  recordIssue(issueType, details = {}) {
    if (!this.options.enableMetrics) {
      return;
    }
    
    const count = this.metrics.troubleshooting.commonIssues.get(issueType) || 0;
    this.metrics.troubleshooting.commonIssues.set(issueType, count + 1);
    
    // Generate suggestions based on issue type
    this._generateTroubleshootingSuggestions(issueType, details);
    
    this.debug('Issue recorded:', { issueType, details });
  }
  
  /**
   * Generates troubleshooting suggestions based on recorded issues
   * 
   * @param {string} issueType - Type of issue
   * @param {Object} details - Issue details
   * @private
   */
  _generateTroubleshootingSuggestions(issueType, details) {
    const suggestions = [];
    
    switch (issueType) {
      case 'rate_limit':
        suggestions.push({
          issue: 'Rate Limiting',
          suggestion: 'Consider upgrading your subscription plan for higher rate limits',
          priority: 'high',
          actionable: true
        });
        suggestions.push({
          issue: 'Rate Limiting',
          suggestion: 'Implement exponential backoff with jitter in your retry logic',
          priority: 'medium',
          actionable: true
        });
        break;
        
      case 'cloudflare_block':
        suggestions.push({
          issue: 'Cloudflare Blocking',
          suggestion: 'Enable browser-like headers and User-Agent rotation',
          priority: 'high',
          actionable: true
        });
        suggestions.push({
          issue: 'Cloudflare Blocking',
          suggestion: 'Add random delays between requests to avoid pattern detection',
          priority: 'medium',
          actionable: true
        });
        suggestions.push({
          issue: 'Cloudflare Blocking',
          suggestion: 'Use a proxy rotation service to vary request origins',
          priority: 'medium',
          actionable: true
        });
        break;
        
      case 'network_timeout':
        suggestions.push({
          issue: 'Network Timeouts',
          suggestion: 'Increase request timeout values in SDK configuration',
          priority: 'medium',
          actionable: true
        });
        suggestions.push({
          issue: 'Network Timeouts',
          suggestion: 'Check network connectivity and DNS resolution',
          priority: 'high',
          actionable: false
        });
        suggestions.push({
          issue: 'Network Timeouts',
          suggestion: 'Consider implementing circuit breaker pattern for unstable networks',
          priority: 'low',
          actionable: true
        });
        break;
        
      case 'authentication_error':
        suggestions.push({
          issue: 'Authentication Errors',
          suggestion: 'Verify your Client ID and Secret Key are correct',
          priority: 'high',
          actionable: true
        });
        suggestions.push({
          issue: 'Authentication Errors',
          suggestion: 'Check if your subscription is active and not expired',
          priority: 'high',
          actionable: false
        });
        suggestions.push({
          issue: 'Authentication Errors',
          suggestion: 'Ensure your system clock is synchronized (for timestamp validation)',
          priority: 'medium',
          actionable: true
        });
        break;
        
      case 'ssl_error':
        suggestions.push({
          issue: 'SSL/TLS Errors',
          suggestion: 'Update your Node.js version or certificate store',
          priority: 'medium',
          actionable: true
        });
        suggestions.push({
          issue: 'SSL/TLS Errors',
          suggestion: 'Check corporate firewall or proxy settings',
          priority: 'medium',
          actionable: false
        });
        suggestions.push({
          issue: 'SSL/TLS Errors',
          suggestion: 'Verify that your system has up-to-date root certificates',
          priority: 'high',
          actionable: true
        });
        break;
        
      case 'server_error':
        suggestions.push({
          issue: 'Server Errors',
          suggestion: 'Wait and retry later as the API service might be experiencing issues',
          priority: 'high',
          actionable: false
        });
        suggestions.push({
          issue: 'Server Errors',
          suggestion: 'Check the TestLuy status page for any ongoing incidents',
          priority: 'medium',
          actionable: true
        });
        break;
        
      case 'client_error':
        suggestions.push({
          issue: 'Client Errors',
          suggestion: 'Verify your request parameters match the API documentation',
          priority: 'high',
          actionable: true
        });
        suggestions.push({
          issue: 'Client Errors',
          suggestion: 'Check for any recent API changes that might affect your integration',
          priority: 'medium',
          actionable: true
        });
        break;
    }
    
    // Add unique suggestions to the list
    for (const suggestion of suggestions) {
      const exists = this.metrics.troubleshooting.suggestions.some(
        s => s.issue === suggestion.issue && s.suggestion === suggestion.suggestion
      );
      
      if (!exists) {
        this.metrics.troubleshooting.suggestions.push({
          ...suggestion,
          timestamp: new Date().toISOString(),
          count: 1
        });
      } else {
        // Increment count for existing suggestion
        const existing = this.metrics.troubleshooting.suggestions.find(
          s => s.issue === suggestion.issue && s.suggestion === suggestion.suggestion
        );
        if (existing) {
          existing.count = (existing.count || 1) + 1;
        }
      }
    }
    
    // Keep only last 20 suggestions
    if (this.metrics.troubleshooting.suggestions.length > 20) {
      this.metrics.troubleshooting.suggestions = this.metrics.troubleshooting.suggestions.slice(-20);
    }
  }
  
  /**
   * Gets troubleshooting suggestions based on current issues
   * 
   * @returns {Array} Array of troubleshooting suggestions
   */
  getTroubleshootingSuggestions() {
    if (!this.options.enableMetrics) {
      return [];
    }
    
    return [...this.metrics.troubleshooting.suggestions]
      .sort((a, b) => {
        // Sort by priority (high first) then by count (most frequent first)
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority] || 0;
        const bPriority = priorityOrder[b.priority] || 0;
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        
        return (b.count || 1) - (a.count || 1);
      });
  }
  
  /**
   * Logs troubleshooting suggestions
   */
  logTroubleshootingSuggestions() {
    const suggestions = this.getTroubleshootingSuggestions();
    
    if (suggestions.length === 0) {
      this.info('No troubleshooting suggestions available');
      return;
    }
    
    this.info('Troubleshooting Suggestions:');
    
    suggestions.forEach((suggestion, index) => {
      this.info(`${index + 1}. [${suggestion.priority.toUpperCase()}] ${suggestion.issue}:`);
      this.info(`   ${suggestion.suggestion}`);
      if (suggestion.count > 1) {
        this.info(`   (Occurred ${suggestion.count} times)`);
      }
    });
  }
  
  /**
   * Generates a comprehensive diagnostic report
   * 
   * @returns {Object} Diagnostic report with metrics and suggestions
   */
  generateDiagnosticReport() {
    const metrics = this.getMetrics();
    const suggestions = this.getTroubleshootingSuggestions();
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalRequests: metrics.requests?.total || 0,
        successRate: metrics.requests?.total > 0 
          ? ((metrics.requests.successful / metrics.requests.total) * 100).toFixed(2) + '%'
          : '0%',
        averageResponseTime: metrics.performance?.averageResponseTime 
          ? metrics.performance.averageResponseTime.toFixed(2) + 'ms'
          : 'N/A'
      },
      issues: {
        rateLimitingOccurrences: metrics.requests?.rateLimited || 0,
        cloudflareBlockingOccurrences: metrics.requests?.cloudflareBlocked || 0,
        totalRetries: metrics.requests?.retried || 0,
        recentErrors: metrics.errors?.recent || []
      },
      recommendations: suggestions.slice(0, 5), // Top 5 suggestions
      configuration: {
        logLevel: this.getLevel(),
        metricsEnabled: this.options.enableMetrics,
        sensitiveDataMasking: this.options.maskSensitive
      }
    };
    
    return report;
  }
  
  /**
   * Logs a comprehensive diagnostic report
   */
  logDiagnosticReport() {
    const report = this.generateDiagnosticReport();
    
    this.info('=== SDK DIAGNOSTIC REPORT ===');
    this.info('Summary:', report.summary);
    this.info('Issues:', report.issues);
    
    if (report.recommendations.length > 0) {
      this.info('Top Recommendations:');
      report.recommendations.forEach((rec, index) => {
        this.info(`${index + 1}. [${rec.priority.toUpperCase()}] ${rec.suggestion}`);
      });
    }
    
    this.info('Configuration:', report.configuration);
    this.info('=== END DIAGNOSTIC REPORT ===');
  }
}

// Create default logger instance
const defaultLogger = new Logger();

export default defaultLogger;