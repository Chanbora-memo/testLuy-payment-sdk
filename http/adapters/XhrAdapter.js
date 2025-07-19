/**
 * XhrAdapter - HTTP client adapter using XMLHttpRequest
 *
 * This adapter provides a unified interface for making HTTP requests using
 * XMLHttpRequest, which is available in all browsers including legacy ones.
 */

import { 
  detectDeploymentPlatform, 
  getPlatformUrlConfig, 
  getDeploymentErrorContext,
  isDeploymentEnvironment 
} from '../utils/DeploymentEnvironmentDetector.js';

/**
 * XhrAdapter class for making HTTP requests using XMLHttpRequest
 */
class XhrAdapter {
  /**
   * Creates a new XhrAdapter instance
   *
   * @param {Object} options - Configuration options
   * @param {number} [options.timeout=30000] - Request timeout in milliseconds
   * @param {Object} [options.headers={}] - Default headers to include with every request
   * @param {string} [options.baseUrl=''] - Base URL to prepend to all request URLs
   */
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.headers = options.headers || {};
    this.baseUrl = options.baseUrl || "";

    // Remove trailing slash from baseUrl if present
    if (this.baseUrl && this.baseUrl.endsWith("/")) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }

    // Initialize deployment environment detection
    this.deploymentPlatform = detectDeploymentPlatform();
    this.platformConfig = getPlatformUrlConfig(this.deploymentPlatform);
    this.isDeployment = isDeploymentEnvironment();

    // Apply platform-specific configurations
    this._applyPlatformConfig();
  }

  /**
   * Applies platform-specific configuration adjustments
   *
   * @private
   */
  _applyPlatformConfig() {
    // Apply timeout adjustments based on platform
    if (this.platformConfig.timeoutAdjustments) {
      if (this.platformConfig.timeoutAdjustments.default) {
        this.timeout = Math.min(this.timeout, this.platformConfig.timeoutAdjustments.default);
      }
    }

    // Apply header adjustments
    if (this.platformConfig.headerAdjustments) {
      this.headers = {
        ...this.headers,
        ...this.platformConfig.headerAdjustments
      };
    }
  }

  /**
   * Makes an HTTP request using XMLHttpRequest
   *
   * @param {Object} config - Request configuration
   * @param {string} config.method - HTTP method (GET, POST, PUT, DELETE, etc.)
   * @param {string} config.url - Request URL (will be appended to baseUrl)
   * @param {Object} [config.headers={}] - Request headers
   * @param {Object|string} [config.data=null] - Request body data
   * @param {number} [config.timeout] - Request timeout (overrides default)
   * @returns {Promise<Object>} - Promise resolving to the response data
   */
  request(config) {
    const {
      method,
      url,
      headers = {},
      data = null,
      timeout = this.timeout,
    } = config;

    // Combine base URL with request URL
    const fullUrl = this._buildUrl(url);

    // Create a new promise for the XHR request
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Set up the request
      xhr.open(method.toUpperCase(), fullUrl, true);

      // Set timeout
      xhr.timeout = timeout;

      // Set up response handling
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Parse response data
          const responseData = this._parseResponse(xhr);

          // Parse headers
          const responseHeaders = this._parseHeaders(
            xhr.getAllResponseHeaders()
          );

          // Resolve with unified response format
          resolve({
            data: responseData,
            status: xhr.status,
            statusText: xhr.statusText,
            headers: responseHeaders,
            config,
          });
        } else {
          // Create error for non-2xx responses
          const error = new Error(
            `Request failed with status code ${xhr.status}`
          );
          error.response = {
            data: this._parseResponse(xhr),
            status: xhr.status,
            statusText: xhr.statusText,
            headers: this._parseHeaders(xhr.getAllResponseHeaders()),
            config,
          };
          reject(error);
        }
      };

      // Handle network errors
      xhr.onerror = () => {
        const error = new Error("Network Error");
        error.config = config;
        reject(error);
      };

      // Handle timeouts
      xhr.ontimeout = () => {
        const error = new Error(`Request timeout after ${timeout}ms`);
        error.config = config;
        reject(error);
      };

      // Set headers
      const requestHeaders = { ...this.headers, ...headers };
      Object.keys(requestHeaders).forEach((key) => {
        xhr.setRequestHeader(key, requestHeaders[key]);
      });

      // Send the request
      if (method.toUpperCase() !== "GET" && data !== null) {
        // Prepare data for sending
        let requestData = data;
        if (typeof data === "object" && !(data instanceof FormData)) {
          requestData = JSON.stringify(data);
          // Set content type to JSON if not already set
          if (!requestHeaders["Content-Type"]) {
            xhr.setRequestHeader("Content-Type", "application/json");
          }
        }
        xhr.send(requestData);
      } else {
        xhr.send();
      }
    });
  }

  /**
   * Builds a full URL by combining the base URL with the request URL
   *
   * @private
   * @param {string} url - Request URL
   * @returns {string} - Full URL
   */
  _buildUrl(url) {
    return this._buildUrlWithRetrySupport(url);
  }

  /**
   * Enhanced URL construction with retry support and fallback logic
   *
   * @private
   * @param {string} url - Request URL
   * @param {Object} [retryContext={}] - Retry context information
   * @returns {string} - Full URL
   */
  _buildUrlWithRetrySupport(url, retryContext = {}) {
    const validationSteps = [];
    const context = {
      originalUrl: url,
      baseUrl: this.baseUrl,
      adapterType: 'XhrAdapter',
      retryAttempt: retryContext.attempt || 0,
      ...retryContext
    };

    try {
      // Primary URL construction method
      validationSteps.push('Starting primary URL construction');
      
      // If URL is already absolute, return it as is
      if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
        validationSteps.push('URL is absolute, returning as-is');
        this._logUrlConstruction('success', validationSteps, context, url);
        return url;
      }

      // Handle null or undefined URL
      if (!url) {
        validationSteps.push('URL validation failed: null or undefined');
        throw new Error("URL cannot be null or undefined");
      }

      // Remove leading slash from URL if present to avoid double slashes
      const cleanUrl = url.startsWith("/") ? url.slice(1) : url;
      validationSteps.push(`URL cleaned: "${url}" -> "${cleanUrl}"`);

      // Ensure baseUrl is valid
      if (!this.baseUrl) {
        validationSteps.push('Base URL validation failed: not configured');
        throw new Error("Base URL is not configured");
      }

      // Validate baseUrl format
      if (
        !this.baseUrl.startsWith("http://") &&
        !this.baseUrl.startsWith("https://")
      ) {
        validationSteps.push(`Base URL validation failed: invalid format "${this.baseUrl}"`);
        throw new Error(`Invalid base URL format: ${this.baseUrl}`);
      }

      // Remove trailing slash from baseUrl if present
      const baseUrlWithoutTrailingSlash = this.baseUrl.endsWith("/")
        ? this.baseUrl.slice(0, -1)
        : this.baseUrl;
      
      validationSteps.push(`Base URL normalized: "${this.baseUrl}" -> "${baseUrlWithoutTrailingSlash}"`);

      // Combine base URL with request URL
      const fullUrl = `${baseUrlWithoutTrailingSlash}/${cleanUrl}`;
      validationSteps.push(`Full URL constructed: "${fullUrl}"`);

      try {
        // Validate URL by creating a URL object
        new URL(fullUrl);
        validationSteps.push('URL validation: SUCCESS');
        this._logUrlConstruction('success', validationSteps, context, fullUrl);
        return fullUrl;
      } catch (urlError) {
        validationSteps.push(`Primary URL validation failed: ${urlError.message}`);
        
        // Try fallback URL construction
        const fallbackUrl = this._buildUrlFallback(url, validationSteps, context);
        this._logUrlConstruction('fallback_success', validationSteps, context, fallbackUrl);
        return fallbackUrl;
      }
    } catch (error) {
      validationSteps.push(`Primary construction failed: ${error.message}`);
      
      try {
        // Attempt fallback construction
        const fallbackUrl = this._buildUrlFallback(url, validationSteps, context);
        this._logUrlConstruction('fallback_success', validationSteps, context, fallbackUrl);
        return fallbackUrl;
      } catch (fallbackError) {
        validationSteps.push(`Fallback construction failed: ${fallbackError.message}`);
        
        // Enhanced error with debugging information
        const enhancedError = this._createEnhancedUrlError(error, validationSteps, context);
        this._logUrlConstruction('failure', validationSteps, context, null, enhancedError);
        throw enhancedError;
      }
    }
  }

  /**
   * Fallback URL construction method for retry scenarios
   *
   * @private
   * @param {string} url - Request URL
   * @param {Array} validationSteps - Validation steps for logging
   * @param {Object} context - Construction context
   * @returns {string} - Full URL
   */
  _buildUrlFallback(url, validationSteps, context) {
    validationSteps.push('Starting fallback URL construction');
    
    // If URL is already absolute, return it as is
    if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
      validationSteps.push('Fallback: URL is absolute');
      return url;
    }

    // Handle null or undefined URL
    if (!url) {
      validationSteps.push('Fallback: URL is null/undefined');
      throw new Error("URL cannot be null or undefined in fallback construction");
    }

    // Ensure baseUrl is valid
    if (!this.baseUrl) {
      validationSteps.push('Fallback: Base URL not configured');
      throw new Error("Base URL is not configured for fallback construction");
    }

    // Try a more robust approach for path normalization
    let fixedPath = url;

    // Ensure path starts with slash for consistent handling
    if (!fixedPath.startsWith("/")) {
      fixedPath = `/${fixedPath}`;
    }

    // Remove any double slashes in the path
    fixedPath = fixedPath.replace(/\/+/g, "/");
    validationSteps.push(`Fallback: Path normalized "${url}" -> "${fixedPath}"`);

    // Remove trailing slash from baseUrl if present
    const baseUrlWithoutTrailingSlash = this.baseUrl.endsWith("/")
      ? this.baseUrl.slice(0, -1)
      : this.baseUrl;

    // Construct URL by combining base and normalized path
    const fallbackUrl = `${baseUrlWithoutTrailingSlash}${fixedPath}`;
    validationSteps.push(`Fallback: URL constructed "${fallbackUrl}"`);

    try {
      // Validate the fallback URL
      new URL(fallbackUrl);
      validationSteps.push('Fallback: URL validation SUCCESS');
      return fallbackUrl;
    } catch (fallbackError) {
      validationSteps.push(`Fallback: URL validation failed - ${fallbackError.message}`);
      throw new Error(`Fallback URL construction failed: ${fallbackError.message}`);
    }
  }

  /**
   * Creates an enhanced error with detailed debugging information
   *
   * @private
   * @param {Error} originalError - Original error
   * @param {Array} validationSteps - Validation steps
   * @param {Object} context - Construction context
   * @returns {Error} - Enhanced error
   */
  _createEnhancedUrlError(originalError, validationSteps, context) {
    const errorMessage = originalError.message || "Unknown URL construction error";
    const enhancedMessage = [
      `URL construction failed in ${context.adapterType}`,
      `Original URL: "${context.originalUrl}"`,
      `Base URL: "${context.baseUrl}"`,
      `Retry attempt: ${context.retryAttempt}`,
      `Error: ${errorMessage}`,
      `Validation steps: ${validationSteps.join(' -> ')}`
    ].join('. ');

    const enhancedError = new Error(enhancedMessage);
    enhancedError.originalError = originalError;
    enhancedError.validationSteps = validationSteps;
    enhancedError.context = context;
    enhancedError.recoveryGuidance = this._getUrlConstructionGuidance(context);
    
    return enhancedError;
  }

  /**
   * Provides recovery guidance for URL construction failures
   *
   * @private
   * @param {Object} context - Construction context
   * @returns {Object} - Recovery guidance
   */
  _getUrlConstructionGuidance(context) {
    const isDeployment = this._isDeploymentEnvironment();
    
    const guidance = {
      environment: isDeployment ? 'deployment' : 'local',
      commonCauses: [
        'Invalid base URL configuration',
        'Malformed endpoint path',
        'XMLHttpRequest-specific URL handling differences'
      ],
      recommendedActions: [
        'Verify baseUrl is properly configured',
        'Check that endpoint paths are valid',
        'Test URL construction in target browser environment'
      ]
    };

    if (isDeployment) {
      guidance.commonCauses.push(
        'Legacy browser URL handling differences',
        'CORS configuration issues',
        'Environment variable configuration issues'
      );
      guidance.recommendedActions.push(
        'Check baseUrl configuration in deployment environment',
        'Verify CORS settings for XMLHttpRequest',
        'Test URL construction in legacy browser environments'
      );
    }

    if (context.retryAttempt > 0) {
      guidance.commonCauses.push('Retry mechanism URL context loss');
      guidance.recommendedActions.push('Ensure retry operations preserve URL construction context');
    }

    return guidance;
  }

  /**
   * Detects if running in a deployment environment
   *
   * @private
   * @returns {boolean} - True if in deployment environment
   */
  _isDeploymentEnvironment() {
    // Check for browser deployment environment indicators
    if (typeof window !== 'undefined') {
      // Browser environment - check for deployment indicators
      const hostname = window.location?.hostname;
      return !!(
        hostname && (
          hostname.includes('.vercel.app') ||
          hostname.includes('.netlify.app') ||
          hostname.includes('.herokuapp.com') ||
          hostname.includes('.github.io') ||
          (hostname !== 'localhost' && hostname !== '127.0.0.1')
        )
      );
    }
    
    // Fallback for environments without window object
    return false;
  }

  /**
   * Logs URL construction details for debugging
   *
   * @private
   * @param {string} result - Construction result ('success', 'fallback_success', 'failure')
   * @param {Array} validationSteps - Validation steps
   * @param {Object} context - Construction context
   * @param {string} [finalUrl] - Final constructed URL
   * @param {Error} [error] - Error if construction failed
   */
  _logUrlConstruction(result, validationSteps, context, finalUrl, error) {
    // Only log in development or when debugging is enabled
    const shouldLog = (
      (typeof window !== 'undefined' && (
        window.location?.hostname === 'localhost' ||
        window.localStorage?.getItem('DEBUG_URL_CONSTRUCTION')
      ))
    );

    if (shouldLog) {
      const logData = {
        result,
        adapter: context.adapterType,
        originalUrl: context.originalUrl,
        baseUrl: context.baseUrl,
        retryAttempt: context.retryAttempt,
        finalUrl,
        validationSteps,
        timestamp: new Date().toISOString()
      };

      if (error) {
        logData.error = error.message;
        logData.recoveryGuidance = error.recoveryGuidance;
      }

      console.log(`[${context.adapterType}] URL Construction:`, JSON.stringify(logData, null, 2));
    }
  }

  /**
   * Parses the response based on content type
   *
   * @private
   * @param {XMLHttpRequest} xhr - XMLHttpRequest object
   * @returns {*} - Parsed response data
   */
  _parseResponse(xhr) {
    const contentType = xhr.getResponseHeader("content-type") || "";

    // Handle different response types
    if (contentType.includes("application/json")) {
      try {
        return JSON.parse(xhr.responseText);
      } catch (e) {
        // If JSON parsing fails, return the raw text
        return xhr.responseText;
      }
    } else if (contentType.includes("text/")) {
      return xhr.responseText;
    } else {
      // For binary data or other types, return response
      return xhr.response;
    }
  }

  /**
   * Parses the headers string into an object
   *
   * @private
   * @param {string} headersString - Headers string from XMLHttpRequest
   * @returns {Object} - Headers object
   */
  _parseHeaders(headersString) {
    const headers = {};

    if (!headersString) {
      return headers;
    }

    // Split headers by newline and process each line
    const headerLines = headersString.split("\r\n");
    headerLines.forEach((line) => {
      const parts = line.split(": ");
      const key = parts.shift();
      const value = parts.join(": ");

      if (key && value) {
        headers[key.toLowerCase()] = value;
      }
    });

    return headers;
  }
}

export default XhrAdapter;
