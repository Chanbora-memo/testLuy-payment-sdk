/**
 * @fileoverview
 * ConfigurationManager - A module for managing SDK configuration
 * with support for merging, validation, and environment detection.
 */

import { DEFAULT_CONFIG, mergeConfig, validateConfig } from './config.js';

/**
 * ConfigurationManager class for handling SDK configuration
 * 
 * @class
 */
class ConfigurationManager {
  /**
   * Creates a new ConfigurationManager instance
   * 
   * @param {Object} [options={}] - Initial configuration options
   */
  constructor(options = {}) {
    // Initialize with merged configuration
    this.config = this.mergeConfigurations(options);
    
    // Validate the configuration
    this.validateConfiguration();
  }
  
  /**
   * Merges configurations from different sources
   * 
   * @param {Object} userConfig - User-provided configuration
   * @returns {Object} Merged configuration
   */
  mergeConfigurations(userConfig) {
    return {
      ...this.getDefaultConfig(),
      ...this.getEnvironmentConfig(),
      ...userConfig
    };
  }
  
  /**
   * Gets the default configuration
   * 
   * @returns {Object} Default configuration
   */
  getDefaultConfig() {
    return DEFAULT_CONFIG;
  }
  
  /**
   * Gets configuration from environment variables
   * 
   * @returns {Object} Configuration from environment variables
   */
  getEnvironmentConfig() {
    const config = {};
    
    // Check if we're in a Node.js environment
    if (typeof process !== 'undefined' && process.env) {
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
      
      // Proxy configuration
      const proxyConfig = {};
      let hasProxyConfig = false;
      
      if (process.env.TESTLUY_PROXY_HOST) {
        proxyConfig.host = process.env.TESTLUY_PROXY_HOST;
        hasProxyConfig = true;
      }
      
      if (process.env.TESTLUY_PROXY_PORT) {
        const port = parseInt(process.env.TESTLUY_PROXY_PORT, 10);
        if (!isNaN(port)) {
          proxyConfig.port = port;
          hasProxyConfig = true;
        }
      }
      
      if (process.env.TESTLUY_PROXY_AUTH) {
        proxyConfig.auth = process.env.TESTLUY_PROXY_AUTH;
        hasProxyConfig = true;
      }
      
      if (process.env.TESTLUY_PROXY_PROTOCOL) {
        proxyConfig.protocol = process.env.TESTLUY_PROXY_PROTOCOL;
        hasProxyConfig = true;
      }
      
      if (hasProxyConfig) {
        config.proxy = proxyConfig;
      }
      
      // Connection configuration
      const connectionConfig = {};
      let hasConnectionConfig = false;
      
      if (process.env.TESTLUY_KEEP_ALIVE) {
        connectionConfig.keepAlive = process.env.TESTLUY_KEEP_ALIVE === 'true';
        hasConnectionConfig = true;
      }
      
      if (process.env.TESTLUY_MAX_SOCKETS) {
        const maxSockets = parseInt(process.env.TESTLUY_MAX_SOCKETS, 10);
        if (!isNaN(maxSockets)) {
          connectionConfig.maxSockets = maxSockets;
          hasConnectionConfig = true;
        }
      }
      
      if (process.env.TESTLUY_MAX_FREE_SOCKETS) {
        const maxFreeSockets = parseInt(process.env.TESTLUY_MAX_FREE_SOCKETS, 10);
        if (!isNaN(maxFreeSockets)) {
          connectionConfig.maxFreeSockets = maxFreeSockets;
          hasConnectionConfig = true;
        }
      }
      
      if (process.env.TESTLUY_SOCKET_TIMEOUT) {
        const socketTimeout = parseInt(process.env.TESTLUY_SOCKET_TIMEOUT, 10);
        if (!isNaN(socketTimeout)) {
          connectionConfig.socketTimeout = socketTimeout;
          hasConnectionConfig = true;
        }
      }
      
      if (process.env.TESTLUY_REJECT_UNAUTHORIZED) {
        connectionConfig.rejectUnauthorized = process.env.TESTLUY_REJECT_UNAUTHORIZED === 'true';
        hasConnectionConfig = true;
      }
      
      if (hasConnectionConfig) {
        config.connection = connectionConfig;
      }
      
      // TLS configuration
      const tlsConfig = {};
      let hasTlsConfig = false;
      
      if (process.env.TESTLUY_TLS_MIN_VERSION) {
        tlsConfig.minVersion = process.env.TESTLUY_TLS_MIN_VERSION;
        hasTlsConfig = true;
      }
      
      if (process.env.TESTLUY_TLS_CIPHERS) {
        tlsConfig.ciphers = process.env.TESTLUY_TLS_CIPHERS;
        hasTlsConfig = true;
      }
      
      if (process.env.TESTLUY_TLS_CERT) {
        tlsConfig.cert = process.env.TESTLUY_TLS_CERT;
        hasTlsConfig = true;
      }
      
      if (process.env.TESTLUY_TLS_KEY) {
        tlsConfig.key = process.env.TESTLUY_TLS_KEY;
        hasTlsConfig = true;
      }
      
      if (process.env.TESTLUY_TLS_CA) {
        tlsConfig.ca = process.env.TESTLUY_TLS_CA;
        hasTlsConfig = true;
      }
      
      if (process.env.TESTLUY_TLS_PASSPHRASE) {
        tlsConfig.passphrase = process.env.TESTLUY_TLS_PASSPHRASE;
        hasTlsConfig = true;
      }
      
      if (hasTlsConfig) {
        config.tls = tlsConfig;
      }
    }
    
    return config;
  }
  
  /**
   * Validates the configuration
   * 
   * @throws {Error} If configuration is invalid
   */
  validateConfiguration() {
    validateConfig(this.config);
  }
  
  /**
   * Gets the current configuration
   * 
   * @returns {Object} Current configuration
   */
  getConfig() {
    return { ...this.config };
  }
  
  /**
   * Updates the configuration
   * 
   * @param {Object} newConfig - New configuration options
   * @returns {Object} Updated configuration
   */
  updateConfig(newConfig) {
    this.config = mergeConfig(newConfig, this.config);
    this.validateConfiguration();
    return this.getConfig();
  }
  
  /**
   * Gets a specific configuration value
   * 
   * @param {string} key - Configuration key
   * @param {*} [defaultValue] - Default value if key doesn't exist
   * @returns {*} Configuration value
   */
  get(key, defaultValue) {
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value === undefined || value === null) {
        return defaultValue;
      }
      value = value[k];
    }
    
    return value !== undefined ? value : defaultValue;
  }
  
  /**
   * Sets a specific configuration value
   * 
   * @param {string} key - Configuration key
   * @param {*} value - Configuration value
   * @returns {Object} Updated configuration
   */
  set(key, value) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    let current = this.config;
    
    for (const k of keys) {
      if (current[k] === undefined || current[k] === null || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }
    
    current[lastKey] = value;
    this.validateConfiguration();
    return this.getConfig();
  }
  
  /**
   * Detects the current environment
   * 
   * @returns {string} Environment name ('development', 'production', 'test', or 'unknown')
   */
  detectEnvironment() {
    // Check if we're in a Node.js environment
    if (typeof process !== 'undefined' && process.env) {
      const nodeEnv = process.env.NODE_ENV;
      
      if (nodeEnv) {
        return nodeEnv.toLowerCase();
      }
      
      // Check for test environment
      if (process.env.JEST_WORKER_ID || process.env.MOCHA_TEST) {
        return 'test';
      }
    }
    
    // Check for browser environment
    if (typeof window !== 'undefined') {
      // Check for development indicators
      if (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('.local') ||
        window.location.port !== ''
      ) {
        return 'development';
      }
      
      // Check for test environment
      if (
        window.jasmine ||
        window.mocha ||
        window.Cypress ||
        window.location.href.includes('test')
      ) {
        return 'test';
      }
      
      return 'production';
    }
    
    return 'unknown';
  }
  
  /**
   * Loads environment-specific configuration
   * 
   * @param {string} [environment] - Environment name (auto-detected if not provided)
   * @returns {Object} Updated configuration
   */
  loadEnvironmentConfig(environment) {
    const env = environment || this.detectEnvironment();
    
    // Default environment-specific configurations
    const envConfigs = {
      development: {
        logging: {
          level: 'debug',
          includeHeaders: true,
          includeBody: true
        },
        retryConfig: {
          maxRetries: 2
        }
      },
      production: {
        logging: {
          level: 'error',
          includeHeaders: false,
          includeBody: false
        },
        retryConfig: {
          maxRetries: 3
        }
      },
      test: {
        logging: {
          level: 'silent'
        },
        retryConfig: {
          maxRetries: 0
        }
      }
    };
    
    // Update config with environment-specific settings
    if (envConfigs[env]) {
      this.updateConfig(envConfigs[env]);
    }
    
    return this.getConfig();
  }
  
  /**
   * Creates a configuration object for the HTTP client
   * 
   * @returns {Object} HTTP client configuration
   */
  createHttpClientConfig() {
    // Extract relevant configuration for the HTTP client
    const {
      baseUrl,
      timeout,
      headers,
      retryConfig,
      proxy,
      connection,
      tls
    } = this.config;
    
    return {
      baseUrl,
      timeout,
      headers,
      retryConfig,
      proxy,
      connection,
      tls
    };
  }
}

export default ConfigurationManager;