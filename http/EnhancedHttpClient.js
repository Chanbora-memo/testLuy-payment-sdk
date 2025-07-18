/**
 * EnhancedHttpClient - A robust HTTP client with interceptor support and enhanced resilience
 * against Cloudflare and other anti-bot protections.
 */

import { mergeConfig } from './config.js';
import { createHttpClient } from './adapters/HttpClientAdapter.js';
import { detectEnvironment, Environment, getOptimalHttpClient } from './utils/EnvironmentDetector.js';
import CloudflareBypass from './CloudflareBypass.js';

/**
 * EnhancedHttpClient - A robust HTTP client with interceptor support and enhanced resilience
 * against Cloudflare and other anti-bot protections.
 * 
 * @class
 */
class EnhancedHttpClient {
  /**
   * Creates a new EnhancedHttpClient instance
   * 
   * @param {Object} config - Configuration options for the HTTP client
   * @param {string} [config.baseUrl] - Base URL for API requests
   * @param {number} [config.timeout=30000] - Request timeout in milliseconds
   * @param {Object} [config.retryConfig] - Configuration for request retries
   * @param {number} [config.retryConfig.maxRetries=3] - Maximum number of retry attempts
   * @param {number} [config.retryConfig.baseDelay=1000] - Base delay in milliseconds before retrying
   * @param {number} [config.retryConfig.maxDelay=30000] - Maximum delay between retries
   * @param {number} [config.retryConfig.backoffFactor=2] - Factor by which to increase delay on each retry
   * @param {number} [config.retryConfig.jitterFactor=0.1] - Random jitter factor to add to delay
   * @param {Object} [config.headers] - Default headers for all requests
   * @param {string} [config.httpClient] - Force a specific HTTP client ('fetch', 'xhr', 'node-fetch', 'axios')
   */
  constructor(config = {}) {
    // Apply default configuration with user overrides
    this.config = mergeConfig(config);
    
    // Detect environment and select appropriate HTTP client
    this.environment = detectEnvironment();
    
    // Initialize Cloudflare bypass module
    this.cloudflareBypass = new CloudflareBypass(this.config.cloudflareConfig);
    
    // Create HTTP client configuration
    const clientConfig = {
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: this.config.headers || {},
      forceClient: this.config.httpClient
    };
    
    // Apply proxy configuration if enabled
    if (this.config.proxy && this.config.proxy.enabled) {
      clientConfig.proxy = {
        host: this.config.proxy.host,
        port: this.config.proxy.port,
        protocol: this.config.proxy.protocol || 'http'
      };
      
      // Add auth if provided
      if (this.config.proxy.auth) {
        clientConfig.proxy.auth = this.config.proxy.auth;
      }
    }
    
    // Apply connection settings
    if (this.config.connection) {
      clientConfig.connection = this.config.connection;
    }
    
    // Apply TLS settings
    if (this.config.tls) {
      clientConfig.tls = this.config.tls;
    }
    
    // Create the appropriate HTTP client adapter
    this.httpClient = createHttpClient(clientConfig);
    
    // Initialize interceptor arrays
    this.requestInterceptors = [];
    this.responseInterceptors = [];
    this.errorInterceptors = [];
  }
  
  /**
   * Adds a request interceptor
   * 
   * @param {Object} interceptor - The request interceptor
   * @param {Function} interceptor.onRequest - Function that receives and modifies the request config
   * @returns {number} The ID of the interceptor (can be used to remove it)
   */
  addRequestInterceptor(interceptor) {
    if (!interceptor || typeof interceptor.onRequest !== 'function') {
      throw new Error('Invalid request interceptor. Must have an onRequest method.');
    }
    
    this.requestInterceptors.push(interceptor);
    return this.requestInterceptors.length - 1; // Return index as ID
  }
  
  /**
   * Adds a response interceptor
   * 
   * @param {Object} interceptor - The response interceptor
   * @param {Function} interceptor.onResponse - Function that receives and modifies the response
   * @returns {number} The ID of the interceptor (can be used to remove it)
   */
  addResponseInterceptor(interceptor) {
    if (!interceptor || typeof interceptor.onResponse !== 'function') {
      throw new Error('Invalid response interceptor. Must have an onResponse method.');
    }
    
    this.responseInterceptors.push(interceptor);
    return this.responseInterceptors.length - 1; // Return index as ID
  }
  
  /**
   * Adds an error interceptor
   * 
   * @param {Object} interceptor - The error interceptor
   * @param {Function} interceptor.onError - Function that receives and processes errors
   * @returns {number} The ID of the interceptor (can be used to remove it)
   */
  addErrorInterceptor(interceptor) {
    if (!interceptor || typeof interceptor.onError !== 'function') {
      throw new Error('Invalid error interceptor. Must have an onError method.');
    }
    
    this.errorInterceptors.push(interceptor);
    return this.errorInterceptors.length - 1; // Return index as ID
  }
  
  /**
   * Removes a request interceptor by ID
   * 
   * @param {number} id - The ID of the interceptor to remove
   */
  removeRequestInterceptor(id) {
    if (id >= 0 && id < this.requestInterceptors.length) {
      this.requestInterceptors.splice(id, 1);
    }
  }
  
  /**
   * Removes a response interceptor by ID
   * 
   * @param {number} id - The ID of the interceptor to remove
   */
  removeResponseInterceptor(id) {
    if (id >= 0 && id < this.responseInterceptors.length) {
      this.responseInterceptors.splice(id, 1);
    }
  }
  
  /**
   * Removes an error interceptor by ID
   * 
   * @param {number} id - The ID of the interceptor to remove
   */
  removeErrorInterceptor(id) {
    if (id >= 0 && id < this.errorInterceptors.length) {
      this.errorInterceptors.splice(id, 1);
    }
  }
  
  /**
   * Makes an HTTP request
   * 
   * @param {Object} options - Request options
   * @param {string} options.method - HTTP method (GET, POST, PUT, DELETE, etc.)
   * @param {string} options.url - Request URL (will be appended to baseUrl if relative)
   * @param {Object} [options.data] - Request body data
   * @param {Object} [options.headers] - Request headers
   * @param {Object} [options.params] - URL parameters
   * @param {number} [options.timeout] - Request timeout in milliseconds
   * @returns {Promise<Object>} The response data
   */
  async request(options) {
    try {
      // Apply all registered request interceptors in sequence
      let modifiedOptions = { ...options };
      
      for (const interceptor of this.requestInterceptors) {
        try {
          modifiedOptions = await interceptor.onRequest(modifiedOptions);
        } catch (error) {
          console.error('Error in request interceptor:', error);
          throw error;
        }
      }
      
      // Make the request using the appropriate HTTP client
      const response = await this.httpClient.request(modifiedOptions);
      
      // Apply all registered response interceptors in sequence
      let modifiedResponse = response;
      
      for (const interceptor of this.responseInterceptors) {
        try {
          modifiedResponse = await interceptor.onResponse(modifiedResponse);
        } catch (error) {
          console.error('Error in response interceptor:', error);
          throw error;
        }
      }
      
      return modifiedResponse.data;
    } catch (error) {
      // Apply all registered error interceptors in sequence
      let processedError = error;
      
      for (const interceptor of this.errorInterceptors) {
        try {
          // If an interceptor returns a value instead of throwing,
          // it means the error was handled and we should return the value
          const result = await interceptor.onError(processedError);
          if (result !== undefined) {
            return result;
          }
          processedError = error; // Keep the original error for the next interceptor
        } catch (interceptorError) {
          // If the interceptor throws, use that as the new error
          processedError = interceptorError;
        }
      }
      
      // If no interceptor handled the error, reject with the processed error
      throw processedError;
    }
  }
  
  /**
   * Makes a GET request
   * 
   * @param {string} url - Request URL
   * @param {Object} [options] - Additional request options
   * @returns {Promise<Object>} The response data
   */
  async get(url, options = {}) {
    return this.request({
      method: 'GET',
      url,
      ...options
    });
  }
  
  /**
   * Makes a POST request
   * 
   * @param {string} url - Request URL
   * @param {Object} [data] - Request body data
   * @param {Object} [options] - Additional request options
   * @returns {Promise<Object>} The response data
   */
  async post(url, data = {}, options = {}) {
    return this.request({
      method: 'POST',
      url,
      data,
      ...options
    });
  }
  
  /**
   * Makes a PUT request
   * 
   * @param {string} url - Request URL
   * @param {Object} [data] - Request body data
   * @param {Object} [options] - Additional request options
   * @returns {Promise<Object>} The response data
   */
  async put(url, data = {}, options = {}) {
    return this.request({
      method: 'PUT',
      url,
      data,
      ...options
    });
  }
  
  /**
   * Makes a DELETE request
   * 
   * @param {string} url - Request URL
   * @param {Object} [options] - Additional request options
   * @returns {Promise<Object>} The response data
   */
  async delete(url, options = {}) {
    return this.request({
      method: 'DELETE',
      url,
      ...options
    });
  }
  
  /**
   * Updates the client configuration
   * 
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this.config = mergeConfig(newConfig, this.config);
    
    // Update HTTP client with new config if possible
    if (this.httpClient && typeof this.httpClient.updateConfig === 'function') {
      this.httpClient.updateConfig({
        baseUrl: this.config.baseUrl,
        timeout: this.config.timeout,
        headers: this.config.headers
      });
    }
  }
  
  /**
   * Gets information about the current environment
   * 
   * @returns {Object} Environment information
   */
  getEnvironmentInfo() {
    return {
      environment: this.environment,
      httpClient: this.config.httpClient || getOptimalHttpClient(),
      features: {
        proxy: !!this.config.proxy?.enabled,
        tls: !!this.config.tls
      }
    };
  }
}

export default EnhancedHttpClient;