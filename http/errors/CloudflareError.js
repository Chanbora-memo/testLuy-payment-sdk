/**
 * @fileoverview
 * CloudflareError - Specialized error class for Cloudflare-related errors
 * with challenge detection and handling guidance.
 */

import SDKError from './SDKError.js';

/**
 * Error class for Cloudflare-related errors
 * 
 * @class
 * @extends SDKError
 */
class CloudflareError extends SDKError {
  /**
   * Creates a new CloudflareError instance
   * 
   * @param {string} message - Error message
   * @param {Object} [options={}] - Cloudflare error options
   * @param {string} [options.challengeType] - Type of Cloudflare challenge
   * @param {string} [options.rayId] - Cloudflare Ray ID
   * @param {boolean} [options.retryable=true] - Whether the error is retryable
   * @param {Object} [details={}] - Additional error details
   * @param {Error} [originalError=null] - Original error that caused this error
   */
  constructor(message, options = {}, details = {}, originalError = null) {
    super(
      message || 'Request blocked by Cloudflare protection',
      'CLOUDFLARE_BLOCKED',
      details,
      originalError
    );
    
    // Cloudflare specific properties
    this.challengeType = options.challengeType || 'unknown';
    this.rayId = options.rayId;
    this.retryable = options.retryable !== false;
    
    // Set challenge-specific properties
    this.setChallengeProperties();
  }
  
  /**
   * Sets challenge-specific properties based on the challenge type
   * 
   * @private
   */
  setChallengeProperties() {
    switch (this.challengeType) {
      case 'captcha':
        this.retryable = false; // CAPTCHA challenges are not automatically retryable
        this.requiresUserAction = true;
        break;
        
      case 'browser_check':
        this.retryable = true;
        this.requiresUserAction = false;
        break;
        
      case 'security_challenge':
        this.retryable = true;
        this.requiresUserAction = false;
        break;
        
      case 'ip_block':
        this.retryable = false;
        this.requiresUserAction = true;
        break;
        
      default:
        this.retryable = true;
        this.requiresUserAction = false;
    }
  }
  
  /**
   * Returns guidance on how to handle the Cloudflare challenge
   * 
   * @returns {Object} Challenge handling guidance
   */
  getChallengeGuidance() {
    const guidance = {
      challengeType: this.challengeType,
      retryable: this.retryable,
      requiresUserAction: this.requiresUserAction,
      rayId: this.rayId,
      recommendedAction: this.getRecommendedAction()
    };
    
    return guidance;
  }
  
  /**
   * Returns recommended action based on challenge type
   * 
   * @returns {string} Recommended action
   * @private
   */
  getRecommendedAction() {
    switch (this.challengeType) {
      case 'captcha':
        return 'A CAPTCHA challenge was detected. Consider using a proxy service or contact support for assistance.';
        
      case 'browser_check':
        return 'A browser verification check was detected. The SDK will automatically retry with enhanced browser fingerprinting.';
        
      case 'security_challenge':
        return 'A security challenge was detected. The SDK will automatically retry with enhanced browser fingerprinting.';
        
      case 'ip_block':
        return 'Your IP address appears to be blocked. Consider using a different IP address or contact support.';
        
      default:
        return 'An unknown Cloudflare challenge was detected. The SDK will attempt to bypass it automatically.';
    }
  }
  
  /**
   * Creates a CloudflareError from an HTTP error response
   * 
   * @param {Error} error - Original error with response object
   * @param {string} [message] - Custom error message
   * @returns {CloudflareError} New CloudflareError instance
   * @static
   */
  static fromResponse(error, message) {
    if (!error.response) {
      return new CloudflareError(message, {}, {}, error);
    }
    
    const response = error.response;
    const headers = response.headers || {};
    
    // Extract Cloudflare information
    const options = {
      rayId: headers['cf-ray'],
      retryable: true
    };
    
    // Determine challenge type from response
    if (response.data) {
      const data = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      
      if (data.includes('captcha')) {
        options.challengeType = 'captcha';
        options.retryable = false;
      } else if (data.includes('Checking your browser')) {
        options.challengeType = 'browser_check';
      } else if (data.includes('security challenge')) {
        options.challengeType = 'security_challenge';
      } else if (data.includes('Your IP has been blocked') || data.includes('Access denied')) {
        options.challengeType = 'ip_block';
        options.retryable = false;
      }
    }
    
    // Extract additional details
    const details = {
      status: response.status,
      statusText: response.statusText
    };
    
    // Check for Cloudflare specific headers
    ['cf-chl-bypass', 'cf-cache-status', 'cf-ray'].forEach(header => {
      if (headers[header]) {
        details[header.replace('cf-', '')] = headers[header];
      }
    });
    
    return new CloudflareError(
      message || 'Request blocked by Cloudflare protection',
      options,
      details,
      error
    );
  }
}

export default CloudflareError;