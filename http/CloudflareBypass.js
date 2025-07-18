/**
 * @fileoverview
 * CloudflareBypass - A module for implementing advanced techniques to bypass Cloudflare protection
 */

import RequestFingerprinter from './RequestFingerprinter.js';

/**
 * CloudflareBypass class for implementing advanced techniques to bypass Cloudflare protection
 * 
 * @class
 */
class CloudflareBypass {
  /**
   * Creates a new CloudflareBypass instance
   * 
   * @param {Object} options - Configuration options
   * @param {boolean} [options.enabled=true] - Whether to enable Cloudflare bypass techniques
   * @param {boolean} [options.rotateUserAgent=true] - Whether to rotate User-Agent strings
   * @param {boolean} [options.addBrowserHeaders=true] - Whether to add browser-like headers
   * @param {boolean} [options.addTimingVariation=true] - Whether to add timing variation to requests
   * @param {Object} [options.customHeaders={}] - Custom headers to include in all requests
   */
  constructor(options = {}) {
    this.options = {
      enabled: options.enabled !== false,
      rotateUserAgent: options.rotateUserAgent !== false,
      addBrowserHeaders: options.addBrowserHeaders !== false,
      addTimingVariation: options.addTimingVariation !== false,
      customHeaders: options.customHeaders || {}
    };
    
    // Create request fingerprinter for browser-like headers
    this.requestFingerprinter = new RequestFingerprinter({
      rotateUserAgent: this.options.rotateUserAgent,
      includeSecHeaders: true,
      randomizeHeaderOrder: true,
      customHeaders: this.options.customHeaders,
      jitterFactor: 0.3
    });
    
    // Track last request time for timing variation
    this.lastRequestTime = 0;
  }
  
  /**
   * Applies Cloudflare bypass techniques to a request config
   * 
   * @param {Object} config - Request configuration
   * @returns {Promise<Object>} Modified request configuration
   */
  async applyBypassTechniques(config) {
    if (!this.options.enabled) {
      return config;
    }
    
    // Add browser-like headers
    const modifiedConfig = { ...config };
    
    // Generate browser-like headers
    if (this.options.addBrowserHeaders) {
      const browserHeaders = this.requestFingerprinter.generateHeaders({
        url: config.url,
        method: config.method
      });
      
      // Merge headers, ensuring original headers take precedence
      modifiedConfig.headers = {
        ...browserHeaders,
        ...config.headers
      };
    }
    
    // Add timing variation to prevent pattern detection
    if (this.options.addTimingVariation) {
      await this.addTimingVariation();
    }
    
    // Add additional Cloudflare-specific bypass techniques
    modifiedConfig.headers = {
      ...modifiedConfig.headers,
      // Add cookie handling headers
      'Cookie': '',
      'Upgrade-Insecure-Requests': '1',
    };
    
    // Ensure content-type is set for POST/PUT requests
    if ((config.method === 'POST' || config.method === 'PUT') && !modifiedConfig.headers['Content-Type']) {
      modifiedConfig.headers['Content-Type'] = 'application/json';
    }
    
    return modifiedConfig;
  }
  
  /**
   * Adds timing variation to prevent pattern detection
   * 
   * @private
   * @returns {Promise<void>}
   */
  async addTimingVariation() {
    // Calculate time since last request
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // If requests are too close together, add a delay
    if (timeSinceLastRequest < 500) {
      // Add a random delay between 100-500ms
      const delay = 100 + Math.random() * 400;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Update last request time
    this.lastRequestTime = Date.now();
  }
  
  /**
   * Creates a request interceptor for EnhancedHttpClient
   * 
   * @returns {Object} A request interceptor for EnhancedHttpClient
   */
  createRequestInterceptor() {
    const self = this;
    
    return {
      async onRequest(config) {
        return self.applyBypassTechniques(config);
      }
    };
  }
}

export default CloudflareBypass;