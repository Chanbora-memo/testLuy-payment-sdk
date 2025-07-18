/**
 * @fileoverview
 * CloudflareErrorInterceptor - An error interceptor that specifically handles
 * Cloudflare-related errors and challenges.
 */

import { ErrorInterceptor } from '../interceptors.js';
import ErrorDetector, { ErrorType } from '../ErrorDetector.js';
import { CloudflareError } from '../errors/index.js';

/**
 * CloudflareErrorInterceptor handles Cloudflare-specific errors
 * 
 * @class
 * @extends ErrorInterceptor
 */
class CloudflareErrorInterceptor extends ErrorInterceptor {
  /**
   * Creates a new CloudflareErrorInterceptor instance
   * 
   * @param {Object} [options={}] - Configuration options
   * @param {number} [options.maxRetries=3] - Maximum number of retry attempts
   * @param {number} [options.baseDelay=2000] - Base delay in milliseconds before retrying
   * @param {number} [options.maxDelay=30000] - Maximum delay between retries
   * @param {number} [options.backoffFactor=2] - Factor by which to increase delay on each retry
   * @param {Function} [options.onCloudflareError] - Callback function called when a Cloudflare error occurs
   */
  constructor(options = {}) {
    super();
    this.options = {
      maxRetries: options.maxRetries !== undefined ? options.maxRetries : 3,
      baseDelay: options.baseDelay !== undefined ? options.baseDelay : 2000,
      maxDelay: options.maxDelay !== undefined ? options.maxDelay : 30000,
      backoffFactor: options.backoffFactor !== undefined ? options.backoffFactor : 2,
      onCloudflareError: options.onCloudflareError
    };
    
    this.errorDetector = new ErrorDetector();
    this.retryCount = 0;
  }

  /**
   * Handles Cloudflare errors with specialized retry logic
   * 
   * @param {Error} error - The error that occurred
   * @returns {Promise<Object>|undefined} The response if retry is successful, undefined otherwise
   */
  async onError(error) {
    // Detect if this is a Cloudflare error
    const errorInfo = this.errorDetector.detectErrorType(error);
    
    if (errorInfo.type === ErrorType.CLOUDFLARE) {
      // Create a CloudflareError instance
      const cloudflareError = CloudflareError.fromResponse(error);
      
      // Call onCloudflareError callback if provided
      if (typeof this.options.onCloudflareError === 'function') {
        await this.options.onCloudflareError(cloudflareError, errorInfo);
      }
      
      // Get challenge guidance from the error
      const challengeGuidance = cloudflareError.getChallengeGuidance();
      
      // Check if we should retry
      if (challengeGuidance.retryable && this.retryCount < this.options.maxRetries) {
        this.retryCount++;
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.options.baseDelay * Math.pow(this.options.backoffFactor, this.retryCount - 1),
          this.options.maxDelay
        );
        
        // Add jitter to prevent thundering herd
        const jitteredDelay = delay * (0.8 + Math.random() * 0.4); // ±20% jitter
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, jitteredDelay));
        
        // Retry the request with modified headers to bypass Cloudflare
        try {
          // Clone the config to avoid modifying the original
          const config = { ...error.config };
          
          // Add or modify headers to help bypass Cloudflare
          config.headers = {
            ...config.headers,
            // Randomize User-Agent
            'User-Agent': this.getRandomUserAgent(),
            // Add browser-like headers
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1'
          };
          
          // Create a new axios instance to avoid interceptor loops
          let axios = error.config.axios;
          if (!axios) {
            try {
              const axiosModule = await import('axios');
              axios = axiosModule.default || axiosModule;
            } catch (importError) {
              throw new Error('axios is required for retry functionality but not available');
            }
          }
          const response = await axios.request(config);
          return response;
        } catch (retryError) {
          // If retry fails, continue with error handling
          return undefined;
        }
      }
    }
    
    // Not a Cloudflare error or max retries exceeded
    return undefined;
  }
  
  /**
   * Gets a random User-Agent string
   * 
   * @returns {string} A random User-Agent string
   */
  getRandomUserAgent() {
    const userAgents = [
      // Chrome on Windows
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
      
      // Chrome on macOS
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
      
      // Firefox on Windows
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/116.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0',
      
      // Firefox on macOS
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/115.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/116.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/117.0',
      
      // Safari on macOS
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
      
      // Edge on Windows
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.58',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 Edg/115.0.1901.183',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 Edg/116.0.1938.54'
    ];
    
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }
}

export default CloudflareErrorInterceptor;