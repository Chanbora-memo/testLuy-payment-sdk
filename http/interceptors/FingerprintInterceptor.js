/**
 * @fileoverview
 * FingerprintInterceptor - A request interceptor that adds browser-like fingerprinting
 * to HTTP requests to help bypass Cloudflare and other anti-bot protections.
 */

import { RequestInterceptor } from '../interceptors.js';
import RequestFingerprinter from '../RequestFingerprinter.js';

/**
 * FingerprintInterceptor adds browser-like fingerprinting to HTTP requests
 * to help bypass Cloudflare and other anti-bot protections.
 * 
 * @class
 * @extends RequestInterceptor
 */
class FingerprintInterceptor extends RequestInterceptor {
  /**
   * Creates a new FingerprintInterceptor instance
   * 
   * @param {Object} options - Configuration options
   * @param {boolean} [options.rotateUserAgent=true] - Whether to rotate User-Agent strings
   * @param {boolean} [options.includeSecHeaders=true] - Whether to include Sec-* headers
   * @param {boolean} [options.randomizeHeaderOrder=true] - Whether to randomize header order
   * @param {Object} [options.customHeaders={}] - Custom headers to include in all requests
   * @param {number} [options.jitterFactor=0.3] - Factor for timing jitter (0-1)
   */
  constructor(options = {}) {
    super();
    this.fingerprinter = new RequestFingerprinter(options);
  }

  /**
   * Intercepts and modifies the request configuration to add browser-like fingerprinting
   * 
   * @param {Object} config - The request configuration
   * @returns {Object} The modified request configuration
   */
  async onRequest(config) {
    // Generate browser-like headers
    const headers = this.fingerprinter.generateHeaders({
      url: config.url,
      method: config.method,
      customHeaders: config.headers
    });
    
    // Add random delay if jitter is enabled
    if (this.fingerprinter.options.jitterFactor > 0) {
      await this.fingerprinter.addRandomDelay(100); // Small base delay of 100ms
    }
    
    // Return modified config with browser-like headers
    return {
      ...config,
      headers: {
        ...headers,
        ...config.headers // Ensure original headers take precedence
      }
    };
  }
}

export default FingerprintInterceptor;