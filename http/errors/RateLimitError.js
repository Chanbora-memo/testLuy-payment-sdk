/**
 * @fileoverview
 * RateLimitError - Specialized error class for rate limiting errors
 * with retry guidance and quota information.
 */

import SDKError from './SDKError.js';

/**
 * Error class for rate limiting errors
 * 
 * @class
 * @extends SDKError
 */
class RateLimitError extends SDKError {
  /**
   * Creates a new RateLimitError instance
   * 
   * @param {string} message - Error message
   * @param {Object} [options={}] - Rate limit options
   * @param {number} [options.retryAfter] - Seconds to wait before retrying
   * @param {Object} [options.rateLimitInfo={}] - Rate limit information
   * @param {number} [options.rateLimitInfo.limit] - Maximum requests allowed
   * @param {number} [options.rateLimitInfo.remaining] - Remaining requests allowed
   * @param {number|string} [options.rateLimitInfo.reset] - Time when the rate limit resets
   * @param {Object} [details={}] - Additional error details
   * @param {Error} [originalError=null] - Original error that caused this error
   */
  constructor(message, options = {}, details = {}, originalError = null) {
    super(
      message || 'API rate limit exceeded',
      'RATE_LIMIT_EXCEEDED',
      details,
      originalError
    );
    
    // Rate limit specific properties
    this.retryAfter = options.retryAfter;
    this.rateLimitInfo = options.rateLimitInfo || {};
    
    // Calculate retry timestamp if retryAfter is provided
    if (this.retryAfter) {
      const retryDate = new Date();
      retryDate.setSeconds(retryDate.getSeconds() + this.retryAfter);
      this.retryTimestamp = retryDate.toISOString();
    }
    
    // Calculate reset time if provided as timestamp
    if (this.rateLimitInfo.reset) {
      const resetValue = parseInt(this.rateLimitInfo.reset, 10);
      if (!isNaN(resetValue)) {
        // Check if it's a Unix timestamp (seconds since epoch)
        if (resetValue > 1000000000) {
          this.resetTimestamp = new Date(resetValue * 1000).toISOString();
        } else {
          // It's seconds from now
          const resetDate = new Date();
          resetDate.setSeconds(resetDate.getSeconds() + resetValue);
          this.resetTimestamp = resetDate.toISOString();
        }
      }
    }
  }
  
  /**
   * Returns guidance on how to handle the rate limit
   * 
   * @returns {Object} Retry guidance
   */
  getRetryGuidance() {
    return {
      shouldRetry: true,
      retryAfter: this.retryAfter || 60, // Default to 60 seconds if not specified
      retryTimestamp: this.retryTimestamp,
      resetTimestamp: this.resetTimestamp,
      recommendedAction: this.getRecommendedAction()
    };
  }
  
  /**
   * Returns recommended action based on rate limit information
   * 
   * @returns {string} Recommended action
   * @private
   */
  getRecommendedAction() {
    // If we're hitting rate limits frequently, suggest upgrading
    if (this.rateLimitInfo.limit) {
      if (this.rateLimitInfo.limit < 100) {
        return 'Consider upgrading your subscription plan for higher rate limits';
      } else if (this.rateLimitInfo.remaining === 0) {
        return 'Implement request throttling to stay within your rate limits';
      }
    }
    
    return 'Wait until the rate limit resets before making additional requests';
  }
  
  /**
   * Creates a RateLimitError from an HTTP error response
   * 
   * @param {Error} error - Original error with response object
   * @param {string} [message] - Custom error message
   * @returns {RateLimitError} New RateLimitError instance
   * @static
   */
  static fromResponse(error, message) {
    if (!error.response) {
      return new RateLimitError(message, {}, {}, error);
    }
    
    const response = error.response;
    const headers = response.headers || {};
    
    // Extract rate limit information from headers
    const rateLimitInfo = {};
    
    // Standard rate limit headers
    ['x-ratelimit-limit', 'x-rate-limit-limit'].forEach(header => {
      if (headers[header]) {
        rateLimitInfo.limit = parseInt(headers[header], 10);
      }
    });
    
    ['x-ratelimit-remaining', 'x-rate-limit-remaining'].forEach(header => {
      if (headers[header]) {
        rateLimitInfo.remaining = parseInt(headers[header], 10);
      }
    });
    
    ['x-ratelimit-reset', 'x-rate-limit-reset'].forEach(header => {
      if (headers[header]) {
        rateLimitInfo.reset = headers[header];
      }
    });
    
    // Extract retry-after header
    let retryAfter;
    if (headers['retry-after']) {
      // Check if retry-after is a timestamp or seconds
      if (isNaN(headers['retry-after'])) {
        // It's a HTTP date format
        try {
          const retryDate = new Date(headers['retry-after']);
          retryAfter = Math.ceil((retryDate.getTime() - Date.now()) / 1000);
        } catch (e) {
          retryAfter = 60; // Default to 60 seconds if parsing fails
        }
      } else {
        retryAfter = parseInt(headers['retry-after'], 10);
      }
    }
    
    // Extract additional details from response
    const details = {};
    
    // Try to extract error details from response data
    if (response.data) {
      if (typeof response.data === 'object') {
        if (response.data.message) {
          details.serverMessage = response.data.message;
        }
        if (response.data.error) {
          details.serverError = response.data.error;
        }
      }
    }
    
    return new RateLimitError(
      message || 'API rate limit exceeded',
      { retryAfter, rateLimitInfo },
      details,
      error
    );
  }
}

export default RateLimitError;