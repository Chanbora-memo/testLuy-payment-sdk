/**
 * @fileoverview
 * Configuration handling for the EnhancedHttpClient
 */

/**
 * Default configuration for the HTTP client
 */
export const DEFAULT_CONFIG = {
  baseUrl: 'https://api-testluy.paragoniu.app',
  timeout: 30000,
  retryConfig: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    jitterFactor: 0.1
  },
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  logging: {
    level: 'warn',
    includeHeaders: false,
    includeBody: false,
    maskSensitive: true
  },
  proxy: {
    enabled: false,
    host: null,
    port: null,
    auth: null,
    protocol: 'http'
  },
  connection: {
    keepAlive: true,
    maxSockets: 10,
    maxFreeSockets: 5,
    socketTimeout: 60000,
    rejectUnauthorized: true
  },
  tls: {
    minVersion: 'TLSv1.2',
    ciphers: null,
    cert: null,
    key: null,
    ca: null,
    passphrase: null
  }
};

/**
 * Merges user configuration with default configuration
 * 
 * @param {Object} userConfig - User-provided configuration
 * @param {Object} [baseConfig=DEFAULT_CONFIG] - Base configuration to merge with
 * @returns {Object} Merged configuration
 */
export function mergeConfig(userConfig, baseConfig = DEFAULT_CONFIG) {
  // Start with a deep copy of the base config
  const config = JSON.parse(JSON.stringify(baseConfig));
  
  // If no user config, return the default
  if (!userConfig) {
    return config;
  }
  
  // Merge top-level properties
  Object.keys(userConfig).forEach(key => {
    // For objects, merge recursively
    if (
      typeof userConfig[key] === 'object' && 
      userConfig[key] !== null &&
      !Array.isArray(userConfig[key]) &&
      config[key] && 
      typeof config[key] === 'object'
    ) {
      config[key] = { ...config[key], ...userConfig[key] };
    } 
    // For non-objects, replace directly
    else {
      config[key] = userConfig[key];
    }
  });
  
  return config;
}

/**
 * Validates the configuration object
 * 
 * @param {Object} config - Configuration to validate
 * @throws {Error} If configuration is invalid
 */
export function validateConfig(config) {
  // Validate baseUrl
  if (config.baseUrl && typeof config.baseUrl !== 'string') {
    throw new Error('Configuration error: baseUrl must be a string');
  }
  
  // Validate timeout
  if (config.timeout !== undefined && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
    throw new Error('Configuration error: timeout must be a positive number');
  }
  
  // Validate retryConfig
  if (config.retryConfig) {
    if (typeof config.retryConfig !== 'object') {
      throw new Error('Configuration error: retryConfig must be an object');
    }
    
    if (
      config.retryConfig.maxRetries !== undefined && 
      (typeof config.retryConfig.maxRetries !== 'number' || config.retryConfig.maxRetries < 0)
    ) {
      throw new Error('Configuration error: retryConfig.maxRetries must be a non-negative number');
    }
    
    if (
      config.retryConfig.baseDelay !== undefined && 
      (typeof config.retryConfig.baseDelay !== 'number' || config.retryConfig.baseDelay <= 0)
    ) {
      throw new Error('Configuration error: retryConfig.baseDelay must be a positive number');
    }
    
    if (
      config.retryConfig.maxDelay !== undefined && 
      (typeof config.retryConfig.maxDelay !== 'number' || config.retryConfig.maxDelay <= 0)
    ) {
      throw new Error('Configuration error: retryConfig.maxDelay must be a positive number');
    }
    
    if (
      config.retryConfig.backoffFactor !== undefined && 
      (typeof config.retryConfig.backoffFactor !== 'number' || config.retryConfig.backoffFactor <= 0)
    ) {
      throw new Error('Configuration error: retryConfig.backoffFactor must be a positive number');
    }
    
    if (
      config.retryConfig.jitterFactor !== undefined && 
      (typeof config.retryConfig.jitterFactor !== 'number' || 
       config.retryConfig.jitterFactor < 0 || 
       config.retryConfig.jitterFactor > 1)
    ) {
      throw new Error('Configuration error: retryConfig.jitterFactor must be a number between 0 and 1');
    }
  }
  
  // Validate headers
  if (config.headers && typeof config.headers !== 'object') {
    throw new Error('Configuration error: headers must be an object');
  }
  
  // Validate logging
  if (config.logging) {
    if (typeof config.logging !== 'object') {
      throw new Error('Configuration error: logging must be an object');
    }
    
    if (
      config.logging.level !== undefined && 
      !['debug', 'info', 'warn', 'error', 'silent'].includes(config.logging.level)
    ) {
      throw new Error('Configuration error: logging.level must be one of: debug, info, warn, error, silent');
    }
    
    if (
      config.logging.includeHeaders !== undefined && 
      typeof config.logging.includeHeaders !== 'boolean'
    ) {
      throw new Error('Configuration error: logging.includeHeaders must be a boolean');
    }
    
    if (
      config.logging.includeBody !== undefined && 
      typeof config.logging.includeBody !== 'boolean'
    ) {
      throw new Error('Configuration error: logging.includeBody must be a boolean');
    }
    
    if (
      config.logging.maskSensitive !== undefined && 
      typeof config.logging.maskSensitive !== 'boolean'
    ) {
      throw new Error('Configuration error: logging.maskSensitive must be a boolean');
    }
  }
  
  // Validate proxy configuration
  if (config.proxy) {
    if (typeof config.proxy !== 'object') {
      throw new Error('Configuration error: proxy must be an object');
    }
    
    if (
      config.proxy.enabled !== undefined && 
      typeof config.proxy.enabled !== 'boolean'
    ) {
      throw new Error('Configuration error: proxy.enabled must be a boolean');
    }
    
    if (
      config.proxy.host !== undefined && 
      config.proxy.host !== null &&
      typeof config.proxy.host !== 'string'
    ) {
      throw new Error('Configuration error: proxy.host must be a string or null');
    }
    
    if (
      config.proxy.port !== undefined && 
      config.proxy.port !== null &&
      (typeof config.proxy.port !== 'number' || config.proxy.port <= 0 || config.proxy.port > 65535)
    ) {
      throw new Error('Configuration error: proxy.port must be a number between 1 and 65535 or null');
    }
    
    if (
      config.proxy.protocol !== undefined && 
      config.proxy.protocol !== null &&
      typeof config.proxy.protocol !== 'string'
    ) {
      throw new Error('Configuration error: proxy.protocol must be a string or null');
    }
    
    // If proxy is enabled, host and port must be provided
    if (config.proxy.enabled === true) {
      if (!config.proxy.host) {
        throw new Error('Configuration error: proxy.host is required when proxy is enabled');
      }
      if (!config.proxy.port) {
        throw new Error('Configuration error: proxy.port is required when proxy is enabled');
      }
    }
  }
  
  // Validate connection configuration
  if (config.connection) {
    if (typeof config.connection !== 'object') {
      throw new Error('Configuration error: connection must be an object');
    }
    
    if (
      config.connection.keepAlive !== undefined && 
      typeof config.connection.keepAlive !== 'boolean'
    ) {
      throw new Error('Configuration error: connection.keepAlive must be a boolean');
    }
    
    if (
      config.connection.maxSockets !== undefined && 
      (typeof config.connection.maxSockets !== 'number' || config.connection.maxSockets <= 0)
    ) {
      throw new Error('Configuration error: connection.maxSockets must be a positive number');
    }
    
    if (
      config.connection.maxFreeSockets !== undefined && 
      (typeof config.connection.maxFreeSockets !== 'number' || config.connection.maxFreeSockets < 0)
    ) {
      throw new Error('Configuration error: connection.maxFreeSockets must be a non-negative number');
    }
    
    if (
      config.connection.socketTimeout !== undefined && 
      (typeof config.connection.socketTimeout !== 'number' || config.connection.socketTimeout <= 0)
    ) {
      throw new Error('Configuration error: connection.socketTimeout must be a positive number');
    }
    
    if (
      config.connection.rejectUnauthorized !== undefined && 
      typeof config.connection.rejectUnauthorized !== 'boolean'
    ) {
      throw new Error('Configuration error: connection.rejectUnauthorized must be a boolean');
    }
  }
  
  // Validate TLS configuration
  if (config.tls) {
    if (typeof config.tls !== 'object') {
      throw new Error('Configuration error: tls must be an object');
    }
    
    if (
      config.tls.minVersion !== undefined && 
      config.tls.minVersion !== null &&
      typeof config.tls.minVersion !== 'string'
    ) {
      throw new Error('Configuration error: tls.minVersion must be a string or null');
    }
    
    // Valid TLS versions
    const validTlsVersions = ['TLSv1', 'TLSv1.1', 'TLSv1.2', 'TLSv1.3'];
    if (
      config.tls.minVersion !== undefined && 
      config.tls.minVersion !== null &&
      !validTlsVersions.includes(config.tls.minVersion)
    ) {
      throw new Error(`Configuration error: tls.minVersion must be one of: ${validTlsVersions.join(', ')} or null`);
    }
    
    if (
      config.tls.ciphers !== undefined && 
      config.tls.ciphers !== null &&
      typeof config.tls.ciphers !== 'string'
    ) {
      throw new Error('Configuration error: tls.ciphers must be a string or null');
    }
    
    // Validate cert and key (they must be provided together)
    if (config.tls.cert !== null && config.tls.key === null) {
      throw new Error('Configuration error: tls.key is required when tls.cert is provided');
    }
    
    if (config.tls.key !== null && config.tls.cert === null) {
      throw new Error('Configuration error: tls.cert is required when tls.key is provided');
    }
  }
}

/**
 * Gets configuration from environment variables
 * 
 * @returns {Object} Configuration from environment variables
 */
export function getEnvironmentConfig() {
  const config = {};
  
  // Base URL
  if (process.env.TESTLUY_BASE_URL) {
    config.baseUrl = process.env.TESTLUY_BASE_URL;
  }
  
  // Timeout
  if (process.env.TESTLUY_TIMEOUT) {
    const timeout = parseInt(process.env.TESTLUY_TIMEOUT, 10);
    if (!isNaN(timeout)) {
      config.timeout = timeout;
    }
  }
  
  // Retry configuration
  const retryConfig = {};
  let hasRetryConfig = false;
  
  if (process.env.TESTLUY_MAX_RETRIES) {
    const maxRetries = parseInt(process.env.TESTLUY_MAX_RETRIES, 10);
    if (!isNaN(maxRetries)) {
      retryConfig.maxRetries = maxRetries;
      hasRetryConfig = true;
    }
  }
  
  if (process.env.TESTLUY_BASE_DELAY) {
    const baseDelay = parseInt(process.env.TESTLUY_BASE_DELAY, 10);
    if (!isNaN(baseDelay)) {
      retryConfig.baseDelay = baseDelay;
      hasRetryConfig = true;
    }
  }
  
  if (process.env.TESTLUY_MAX_DELAY) {
    const maxDelay = parseInt(process.env.TESTLUY_MAX_DELAY, 10);
    if (!isNaN(maxDelay)) {
      retryConfig.maxDelay = maxDelay;
      hasRetryConfig = true;
    }
  }
  
  if (process.env.TESTLUY_BACKOFF_FACTOR) {
    const backoffFactor = parseFloat(process.env.TESTLUY_BACKOFF_FACTOR);
    if (!isNaN(backoffFactor)) {
      retryConfig.backoffFactor = backoffFactor;
      hasRetryConfig = true;
    }
  }
  
  if (process.env.TESTLUY_JITTER_FACTOR) {
    const jitterFactor = parseFloat(process.env.TESTLUY_JITTER_FACTOR);
    if (!isNaN(jitterFactor)) {
      retryConfig.jitterFactor = jitterFactor;
      hasRetryConfig = true;
    }
  }
  
  if (hasRetryConfig) {
    config.retryConfig = retryConfig;
  }
  
  // Logging configuration
  const loggingConfig = {};
  let hasLoggingConfig = false;
  
  if (process.env.TESTLUY_LOG_LEVEL) {
    loggingConfig.level = process.env.TESTLUY_LOG_LEVEL;
    hasLoggingConfig = true;
  }
  
  if (process.env.TESTLUY_LOG_INCLUDE_HEADERS) {
    loggingConfig.includeHeaders = process.env.TESTLUY_LOG_INCLUDE_HEADERS === 'true';
    hasLoggingConfig = true;
  }
  
  if (process.env.TESTLUY_LOG_INCLUDE_BODY) {
    loggingConfig.includeBody = process.env.TESTLUY_LOG_INCLUDE_BODY === 'true';
    hasLoggingConfig = true;
  }
  
  if (process.env.TESTLUY_LOG_MASK_SENSITIVE) {
    loggingConfig.maskSensitive = process.env.TESTLUY_LOG_MASK_SENSITIVE === 'true';
    hasLoggingConfig = true;
  }
  
  if (hasLoggingConfig) {
    config.logging = loggingConfig;
  }
  
  return config;
}

/**
 * Gets the complete configuration by merging default, environment, and user configs
 * 
 * @param {Object} userConfig - User-provided configuration
 * @returns {Object} Complete configuration
 */
export function getCompleteConfig(userConfig = {}) {
  // Start with default config
  const defaultConfig = DEFAULT_CONFIG;
  
  // Merge with environment config
  const envConfig = getEnvironmentConfig();
  const mergedConfig = mergeConfig(envConfig, defaultConfig);
  
  // Merge with user config
  const finalConfig = mergeConfig(userConfig, mergedConfig);
  
  // Validate the final config
  validateConfig(finalConfig);
  
  return finalConfig;
}