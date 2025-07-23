/**
 * @fileoverview
 * This file defines the interfaces for request, response, and error interceptors
 * used by the EnhancedHttpClient.
 */

/**
 * Base interceptor interface
 * @interface
 */
export class Interceptor {
  constructor() {
    if (this.constructor === Interceptor) {
      throw new Error("Interceptor is an abstract class and cannot be instantiated directly");
    }
  }
}

/**
 * Request interceptor interface
 * Implement this interface to modify requests before they are sent
 * 
 * @interface
 * @extends Interceptor
 */
export class RequestInterceptor extends Interceptor {
  /**
   * Called before a request is sent
   * 
   * @param {Object} config - The request configuration
   * @returns {Object|Promise<Object>} The modified request configuration
   */
  async onRequest(config) {
    throw new Error("RequestInterceptor.onRequest must be implemented");
  }
}

/**
 * Response interceptor interface
 * Implement this interface to modify responses before they are returned
 * 
 * @interface
 * @extends Interceptor
 */
export class ResponseInterceptor extends Interceptor {
  /**
   * Called after a response is received
   * 
   * @param {Object} response - The response object
   * @returns {Object|Promise<Object>} The modified response
   */
  async onResponse(response) {
    throw new Error("ResponseInterceptor.onResponse must be implemented");
  }
}

/**
 * Error interceptor interface
 * Implement this interface to handle errors that occur during requests
 * 
 * @interface
 * @extends Interceptor
 */
export class ErrorInterceptor extends Interceptor {
  /**
   * Called when an error occurs during a request
   * 
   * @param {Error} error - The error object
   * @returns {Promise<void>|Promise<Object>} If a value is returned, it will be used as the response
   *                                         If nothing is returned or an error is thrown, the error will propagate
   */
  async onError(error) {
    throw new Error("ErrorInterceptor.onError must be implemented");
  }
}

/**
 * Example implementation of a request interceptor that adds headers
 */
export class HeadersRequestInterceptor extends RequestInterceptor {
  /**
   * @param {Object} headers - Headers to add to the request
   */
  constructor(headers) {
    super();
    this.headers = headers;
  }

  /**
   * @param {Object} config - The request configuration
   * @returns {Object} The modified request configuration with added headers
   */
  async onRequest(config) {
    return {
      ...config,
      headers: {
        ...config.headers,
        ...this.headers
      }
    };
  }
}

/**
 * Example implementation of a response interceptor that extracts data
 */
export class DataExtractorResponseInterceptor extends ResponseInterceptor {
  /**
   * @param {Object} response - The response object
   * @returns {Object} The response data
   */
  async onResponse(response) {
    // Example: Extract only the data property from the response
    return {
      ...response,
      data: response.data?.data || response.data
    };
  }
}

/**
 * Example implementation of an error interceptor that handles rate limiting
 */
export class RateLimitErrorInterceptor extends ErrorInterceptor {
  /**
   * @param {Object} options - Options for handling rate limit errors
   * @param {number} [options.maxRetries=3] - Maximum number of retries
   * @param {Function} [options.onRateLimit] - Callback function when rate limited
   */
  constructor(options = {}) {
    super();
    this.maxRetries = options.maxRetries || 3;
    this.onRateLimit = options.onRateLimit;
    this.retryCount = 0;
  }

  /**
   * @param {Error} error - The error object
   * @returns {Promise<Object>|undefined} The response if retry is successful, undefined otherwise
   */
  async onError(error) {
    // Check if this is a rate limit error (status code 429)
    if (error.response && error.response.status === 429) {
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        
        // Get retry delay from response headers or use default
        const retryAfter = error.response.headers['retry-after'] || 1;
        const delayMs = parseInt(retryAfter, 10) * 1000;
        
        // Notify about rate limiting if callback is provided
        if (this.onRateLimit) {
          this.onRateLimit({
            retryCount: this.retryCount,
            maxRetries: this.maxRetries,
            delayMs,
            error
          });
        }
        
        // Wait for the specified delay
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
        // Retry the request
        try {
          const response = await error.config.axios.request(error.config);
          return response;
        } catch (retryError) {
          // If retry fails, continue with error handling
          return undefined;
        }
      }
    }
    
    // Not a rate limit error or max retries exceeded
    return undefined;
  }
}

/**
 * Advanced implementation of an error interceptor that uses RetryStrategy
 * for comprehensive retry logic including exponential backoff with jitter
 * 
 * Note: This is just a reference. The actual implementation is in RetryInterceptor.js
 * and should be imported from there.
 */
export class RetryErrorInterceptor extends ErrorInterceptor {
  /**
   * @param {Object} config - Configuration for the retry strategy
   */
  constructor(config = {}) {
    super();
    // In the actual implementation, this would initialize a RetryStrategy
    this.config = config;
  }

  /**
   * @param {Error} error - The error object
   * @returns {Promise<Object>|undefined} The response if retry is successful, undefined otherwise
   */
  async onError(error) {
    // This is just a placeholder. The actual implementation is in RetryInterceptor.js
    return undefined;
  }
}