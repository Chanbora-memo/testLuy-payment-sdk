/**
 * FetchAdapter - HTTP client adapter using the Fetch API
 * 
 * This adapter provides a unified interface for making HTTP requests using
 * the Fetch API available in modern browsers and Node.js environments.
 */

/**
 * FetchAdapter class for making HTTP requests using the Fetch API
 */
class FetchAdapter {
  /**
   * Creates a new FetchAdapter instance
   * 
   * @param {Object} options - Configuration options
   * @param {number} [options.timeout=30000] - Request timeout in milliseconds
   * @param {Object} [options.headers={}] - Default headers to include with every request
   * @param {string} [options.baseUrl=''] - Base URL to prepend to all request URLs
   */
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.headers = options.headers || {};
    this.baseUrl = options.baseUrl || '';
    
    // Remove trailing slash from baseUrl if present
    if (this.baseUrl && this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
  }
  
  /**
   * Makes an HTTP request using the Fetch API
   * 
   * @param {Object} config - Request configuration
   * @param {string} config.method - HTTP method (GET, POST, PUT, DELETE, etc.)
   * @param {string} config.url - Request URL (will be appended to baseUrl)
   * @param {Object} [config.headers={}] - Request headers
   * @param {Object|string} [config.data=null] - Request body data
   * @param {number} [config.timeout] - Request timeout (overrides default)
   * @returns {Promise<Object>} - Promise resolving to the response data
   */
  async request(config) {
    const { method, url, headers = {}, data = null, timeout = this.timeout } = config;
    
    // Combine base URL with request URL
    const fullUrl = this._buildUrl(url);
    
    // Combine default headers with request headers
    const requestHeaders = { ...this.headers, ...headers };
    
    // Prepare fetch options
    const fetchOptions = {
      method: method.toUpperCase(),
      headers: requestHeaders,
      // Add credentials to include cookies
      credentials: 'same-origin'
    };
    
    // Add body for non-GET requests
    if (method.toUpperCase() !== 'GET' && data !== null) {
      fetchOptions.body = typeof data === 'string' ? data : JSON.stringify(data);
    }
    
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timeout after ${timeout}ms`));
        }, timeout);
      });
      
      // Race the fetch against the timeout
      const response = await Promise.race([
        fetch(fullUrl, fetchOptions),
        timeoutPromise
      ]);
      
      // Extract response data
      const responseData = await this._parseResponse(response);
      
      // Extract headers into a plain object
      const responseHeaders = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      
      // Return a unified response format
      return {
        data: responseData,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        config
      };
    } catch (error) {
      // Enhance error with request details
      error.config = config;
      throw error;
    }
  }
  
  /**
   * Builds a full URL by combining the base URL with the request URL
   * 
   * @private
   * @param {string} url - Request URL
   * @returns {string} - Full URL
   */
  _buildUrl(url) {
    // If URL is already absolute, return it as is
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      return url;
    }
    
    // Handle null or undefined URL
    if (!url) {
      throw new Error('URL cannot be null or undefined');
    }
    
    // Remove leading slash from URL if present to avoid double slashes
    const cleanUrl = url.startsWith('/') ? url.slice(1) : url;
    
    // Ensure baseUrl is valid
    if (!this.baseUrl) {
      throw new Error('Base URL is not configured');
    }
    
    // Remove trailing slash from baseUrl if present
    const baseUrlWithoutTrailingSlash = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
    
    // Combine base URL with request URL
    const fullUrl = `${baseUrlWithoutTrailingSlash}/${cleanUrl}`;
    
    try {
      // Validate URL by creating a URL object
      new URL(fullUrl);
      return fullUrl;
    } catch (error) {
      // Provide detailed error message for debugging
      throw new Error(`Failed to construct valid URL from base "${this.baseUrl}" and path "${url}": ${error.message}`);
    }
  }
  
  /**
   * Parses the response based on content type
   * 
   * @private
   * @param {Response} response - Fetch API Response object
   * @returns {Promise<*>} - Promise resolving to the parsed response data
   */
  async _parseResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    
    // Handle different response types
    if (contentType.includes('application/json')) {
      return response.json();
    } else if (contentType.includes('text/')) {
      return response.text();
    } else {
      // For binary data or other types, return as blob
      return response.blob();
    }
  }
}

export default FetchAdapter;