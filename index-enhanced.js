/**
 * @fileoverview
 * Enhanced TestluyPaymentSDK with Cloudflare resilience and improved error handling
 */

import { getConfig } from "./config.js";
import { validateAmount, validateCallbackUrl, validateTransactionId } from "./validation.js";

// Import enhanced HTTP components
import EnhancedHttpClient from './http/EnhancedHttpClient.js';
import RequestFingerprinter from './http/RequestFingerprinter.js';
import ErrorHandler from './http/ErrorHandler.js';
import RetryStrategy from './http/RetryStrategy.js';
import CloudflareBypass from './http/CloudflareBypass.js';
import { CloudflareError, RateLimitError } from './http/errors/index.js';
import logger, { LogLevel } from './http/Logger.js';
import { LoggingInterceptor, DebugInterceptor } from './http/interceptors/index.js';

// Import browser compatibility components
import CryptoPolyfill from './http/utils/CryptoPolyfill.js';
import EnvironmentDetector from './http/utils/EnvironmentDetector.js';

// Default retry configuration
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffFactor: 2, // Exponential backoff
  jitterFactor: 0.1, // Add jitter to prevent thundering herd
};

/**
 * TestluyPaymentSDK - SDK for integrating with the Testluy Payment Simulator API.
 * Enhanced with Cloudflare resilience and improved error handling.
 * 
 * @class
 * @param {object} options - Configuration options.
 * @param {string} options.clientId - Your Testluy application client ID.
 * @param {string} options.secretKey - Your Testluy application secret key.
 * @param {string} [options.baseUrl] - The base URL for the Testluy API (defaults to value in config or environment).
 * @param {object} [options.retryConfig] - Configuration for request retries on rate limiting.
 * @param {number} [options.retryConfig.maxRetries=3] - Maximum number of retry attempts.
 * @param {number} [options.retryConfig.baseDelay=1000] - Initial delay in milliseconds before first retry.
 * @param {number} [options.retryConfig.maxDelay=10000] - Maximum delay in milliseconds between retries.
 * @param {number} [options.retryConfig.backoffFactor=2] - Factor by which to increase delay on each retry.
 * @param {number} [options.retryConfig.jitterFactor=0.1] - Random jitter factor to add to delay.
 * @param {object} [options.cloudflareConfig] - Configuration for Cloudflare resilience.
 * @param {boolean} [options.cloudflareConfig.enabled=true] - Whether to enable Cloudflare resilience.
 * @param {boolean} [options.cloudflareConfig.rotateUserAgent=true] - Whether to rotate User-Agent headers.
 * @param {boolean} [options.cloudflareConfig.addBrowserHeaders=true] - Whether to add browser-like headers.
 * @param {object} [options.loggingConfig] - Configuration for logging.
 * @param {string} [options.loggingConfig.level='warn'] - Log level (debug, info, warn, error, silent).
 * @param {boolean} [options.loggingConfig.includeHeaders=false] - Whether to include headers in logs.
 * @param {boolean} [options.loggingConfig.includeBody=false] - Whether to include request/response bodies in logs.
 * @param {boolean} [options.loggingConfig.maskSensitive=true] - Whether to mask sensitive data in logs.
 * @throws {Error} If clientId or secretKey is missing.
 */
class TestluyPaymentSDK {
  constructor(options = {}) {
    const { clientId, secretKey, baseUrl } = getConfig(options);
    if (!clientId || !secretKey) {
      throw new Error(
        "TestluyPaymentSDK: Client ID and Secret Key are required."
      );
    }
    
    // Ensure baseUrl doesn't end with a slash
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    if (
      !this.baseUrl.startsWith("http://") &&
      !this.baseUrl.startsWith("https://")
    ) {
      logger.warn(
        `TestluyPaymentSDK Warning: Base URL "${this.baseUrl}" might be invalid. Ensure it includes http:// or https://`
      );
    }
    
    this.clientId = clientId;
    this.secretKey = secretKey;
    this.isValidated = false; // State to track if validateCredentials was successful

    // Always use the /api prefix for all API endpoints
    this.useApiPrefix = true;

    logger.info(
      `TestluyPaymentSDK initialized with baseUrl: ${this.baseUrl}, useApiPrefix: ${this.useApiPrefix}`
    );

    // Set up retry configuration with defaults
    this.retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...(options.retryConfig || {}),
    };
    
    // Set up Cloudflare resilience configuration - enabled by default with all features
    this.cloudflareConfig = {
      enabled: true,
      rotateUserAgent: true,
      addBrowserHeaders: true,
      addTimingVariation: true,
      ...(options.cloudflareConfig || {}),
    };
    
    // Set up logging configuration
    this.loggingConfig = {
      level: 'warn',
      includeHeaders: false,
      includeBody: false,
      maskSensitive: true,
      format: 'text',
      colorize: true,
      ...(options.loggingConfig || {}),
    };

    // Track rate limit information
    this.rateLimitInfo = {
      limit: null,
      remaining: null,
      resetAt: null,
      currentPlan: null,
    };
    
    // Initialize enhanced HTTP components
    this._initializeHttpClient();
  }
  
  /**
   * Initializes the enhanced HTTP client with interceptors for Cloudflare resilience
   * 
   * @private
   */
  _initializeHttpClient() {
    // Initialize environment detection
    this.environmentInfo = EnvironmentDetector.getEnvironmentInfo();
    logger.info('TestluyPaymentSDK: Environment detected', this.environmentInfo);
    
    // Initialize crypto polyfill
    this.cryptoPolyfill = CryptoPolyfill;
    
    // Initialize Cloudflare bypass module
    this.cloudflareBypass = new CloudflareBypass(this.cloudflareConfig);
    
    // Configure logger based on options
    if (this.loggingConfig) {
      logger.updateConfig({
        level: this.loggingConfig.level || 'warn',
        maskSensitive: this.loggingConfig.maskSensitive !== false,
        format: this.loggingConfig.format || 'text',
        colorize: this.loggingConfig.colorize !== false
      });
    }
    
    // Create retry strategy
    this.retryStrategy = new RetryStrategy({
      maxRetries: this.retryConfig.maxRetries,
      baseDelay: this.retryConfig.baseDelay,
      maxDelay: this.retryConfig.maxDelay,
      backoffFactor: this.retryConfig.backoffFactor,
      jitterFactor: this.retryConfig.jitterFactor,
    });
    
    // Create error handler
    this.errorHandler = new ErrorHandler({
      retryStrategy: this.retryStrategy,
      onError: (error) => {
        logger.error(`TestluyPaymentSDK: Request error: ${error.message}`);
      },
      onRetry: ({ attempt, delay }) => {
        logger.warn(`TestluyPaymentSDK: Retrying request (${attempt}/${this.retryConfig.maxRetries}) after ${delay}ms`);
      },
      onRecovery: () => {
        logger.info('TestluyPaymentSDK: Request recovered successfully');
      }
    });
    
    // Create request fingerprinter for browser-like headers
    this.requestFingerprinter = new RequestFingerprinter();
    
    // Create enhanced HTTP client
    this.httpClient = new EnhancedHttpClient({
      baseUrl: this.baseUrl,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    // Add request interceptor for authentication
    this.httpClient.addRequestInterceptor({
      onRequest: async (config) => {
        // Add authentication headers
        const authHeaders = await this._getAuthHeaders(
          config.method,
          config.url,
          config.data
        );
        
        // Merge headers
        return {
          ...config,
          headers: {
            ...config.headers,
            ...authHeaders
          }
        };
      }
    });
    
    // Add Cloudflare bypass interceptor
    if (this.cloudflareConfig.enabled) {
      this.httpClient.addRequestInterceptor(this.cloudflareBypass.createRequestInterceptor());
    }
    
    // Add response interceptor for rate limit tracking
    this.httpClient.addResponseInterceptor({
      onResponse: (response) => {
        // Update rate limit info from headers if available
        if (response.headers && response.headers["x-ratelimit-limit"]) {
          this.rateLimitInfo.limit = parseInt(
            response.headers["x-ratelimit-limit"],
            10
          );
        }
        if (response.headers && response.headers["x-ratelimit-remaining"]) {
          this.rateLimitInfo.remaining = parseInt(
            response.headers["x-ratelimit-remaining"],
            10
          );
        }
        if (response.headers && response.headers["x-ratelimit-reset"]) {
          this.rateLimitInfo.resetAt = new Date(
            parseInt(response.headers["x-ratelimit-reset"], 10) * 1000
          );
        }
        
        return response;
      }
    });
    
    // Add error interceptor for handling errors
    this.httpClient.addErrorInterceptor(this.errorHandler.createErrorInterceptor());
    
    // Add logging interceptor if logging is enabled
    if (this.loggingConfig) {
      // Enable metrics in logger if debug level is enabled
      const enableMetrics = this.loggingConfig.level === 'debug' || this.loggingConfig.enableMetrics;
      
      // Update logger configuration to enable metrics if needed
      if (enableMetrics) {
        logger.updateConfig({ enableMetrics: true });
      }
      
      const loggingInterceptor = new LoggingInterceptor({
        logRequests: true,
        logResponses: true,
        logErrors: true,
        includeHeaders: this.loggingConfig.includeHeaders || false,
        includeBody: this.loggingConfig.includeBody || false,
        includeStack: this.loggingConfig.includeStack || false,
        enableMetrics: enableMetrics,
        logger: logger
      });
      
      this.httpClient.addRequestInterceptor(loggingInterceptor);
      this.httpClient.addResponseInterceptor(loggingInterceptor);
      this.httpClient.addErrorInterceptor(loggingInterceptor);
      
      logger.info('TestluyPaymentSDK: Logging interceptor configured with metrics:', { enableMetrics });
      
      // Add debug interceptor for advanced debugging and monitoring
      this.debugInterceptor = new DebugInterceptor({
        enabled: enableMetrics,
        trackPerformance: enableMetrics,
        logRequests: this.loggingConfig.level === 'debug',
        includeHeaders: this.loggingConfig.includeHeaders || false,
        includeBody: this.loggingConfig.includeBody || false,
        maskSensitive: this.loggingConfig.maskSensitive !== false
      });
      
      this.httpClient.addRequestInterceptor(this.debugInterceptor);
      this.httpClient.addResponseInterceptor(this.debugInterceptor);
      this.httpClient.addErrorInterceptor(this.debugInterceptor);
      
      logger.info('TestluyPaymentSDK: Debug interceptor configured');
    }
  }

  /**
   * Constructs the correct API path based on the base URL configuration.
   * @private
   * @param {string} endpoint - The endpoint path (e.g., 'payment-simulator/generate-url').
   * @returns {string} The full path with or without the 'api/' prefix.
   */
  _getApiPath(endpoint) {
    // Handle null or undefined endpoint
    if (!endpoint) {
      logger.error('TestluyPaymentSDK: Invalid endpoint - cannot be null or undefined');
      throw new Error('Invalid endpoint - cannot be null or undefined');
    }
    
    // Ensure endpoint doesn't start with a slash
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    
    // Check if the endpoint already includes 'api/' prefix to avoid duplication
    if (cleanEndpoint.startsWith('api/')) {
      // If endpoint already has api/ prefix, don't add it again
      const finalPath = `/${cleanEndpoint}`;
      logger.info(
        `TestluyPaymentSDK: Generated API path (already has prefix): ${finalPath} (from endpoint: ${endpoint})`
      );
      return finalPath;
    }
    
    // Add api/ prefix if needed
    const path = this.useApiPrefix ? `api/${cleanEndpoint}` : cleanEndpoint;
    
    // Ensure path starts with a slash
    const finalPath = path.startsWith('/') ? path : `/${path}`;
    
    logger.info(
      `TestluyPaymentSDK: Generated API path: ${finalPath} (from endpoint: ${endpoint})`
    );
    return finalPath;
  }

  /**
   * Generates the HMAC-SHA256 signature for an API request.
   * @private
   * @param {string} method - HTTP method (e.g., 'GET', 'POST').
   * @param {string} path - API endpoint path (e.g., 'api/payment-simulator/generate-url').
   * @param {string} timestamp - UNIX timestamp string.
   * @param {string|object} [body=''] - Request body (JSON object or string).
   * @returns {Promise<string>} The computed HMAC signature in hex format.
   */
  async _generateSignature(method, path, timestamp, body = "") {
    // Ensure body is consistently stringified for POST/PUT, or empty string for GET/DELETE
    const bodyString =
      method === "POST" || method === "PUT"
        ? typeof body === "string"
          ? body
          : JSON.stringify(body) // Stringify if it's an object
        : ""; // Empty string for GET/DELETE etc.

    // Remove the leading slash from the path for signature generation
    // This is important because the API expects the path without a leading slash
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;

    const stringToSign =
      method + "\n" + cleanPath + "\n" + timestamp + "\n" + bodyString;

    try {
      // Use the cross-platform CryptoPolyfill to generate the signature
      const signature = await this.cryptoPolyfill.createHmacSignature(
        this.secretKey,
        stringToSign
      );
      
      return signature;
    } catch (error) {
      console.error("TestluyPaymentSDK: Error generating signature:", error);
      throw new Error("Failed to generate request signature.");
    }
  }

  /**
   * Generates the necessary authentication headers for an API request.
   * @private
   * @param {string} method - HTTP method.
   * @param {string} path - API endpoint path.
   * @param {string|object} [body=''] - Request body.
   * @returns {Promise<object>} An object containing the required headers.
   */
  async _getAuthHeaders(method, path, body = "") {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    try {
      const signature = await this._generateSignature(
        method,
        path,
        timestamp,
        body
      );
      
      // Basic auth headers
      const headers = {
        "X-Client-ID": this.clientId,
        "X-Timestamp": timestamp,
        "X-Signature": signature,
      };
      
      return headers;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Makes an API request using the enhanced HTTP client
   * @private
   * @param {string} method - HTTP method (GET, POST, etc.).
   * @param {string} path - API endpoint path.
   * @param {object} [body={}] - Request body for POST/PUT requests.
   * @returns {Promise<object>} The API response data.
   * @throws {Error} If the request fails.
   */
  async _makeRequest(method, path, body = {}) {
    try {
      // Validate path before making the request
      if (!path) {
        throw new Error('Invalid API path: path cannot be empty');
      }
      
      // Validate that the path is properly formatted
      if (!path.startsWith('/')) {
        logger.warn(`TestluyPaymentSDK: API path "${path}" doesn't start with a slash, adding one`);
        path = `/${path}`;
      }
      
      // Ensure the path includes the /api/ prefix if useApiPrefix is true
      if (this.useApiPrefix && !path.includes('/api/')) {
        logger.warn(`TestluyPaymentSDK: API path "${path}" is missing /api/ prefix, it may not work correctly`);
      }
      
      // Make the API request using the enhanced HTTP client
      const response = await this.httpClient.request({
        method: method,
        url: path,
        data: method !== "GET" ? body : undefined
      });
      
      return response;
    } catch (error) {
      // Handle URL construction errors
      if (error.message && (
          error.message.includes('Invalid URL') || 
          error.message.includes('Failed to construct') ||
          error.message.includes('URL cannot be null')
      )) {
        logger.error(`TestluyPaymentSDK: URL construction error: ${error.message}`);
        logger.error(`TestluyPaymentSDK: Attempted path: "${path}", baseUrl: "${this.baseUrl}"`);
        throw new Error(`URL construction error: ${error.message}. Please check your baseUrl and endpoint path.`);
      }
      
      // Handle specific error types
      if (error instanceof RateLimitError) {
        const guidance = error.getRetryGuidance();
        const errorMessage = `Rate limit exceeded. ${guidance.recommendedAction}`;
        
        // Create a more informative error
        const rateLimitError = new Error(errorMessage);
        rateLimitError.isRateLimitError = true;
        rateLimitError.rateLimitInfo = { ...this.rateLimitInfo };
        rateLimitError.retryAfter = guidance.retryAfter;
        throw rateLimitError;
      } else if (error instanceof CloudflareError) {
        const guidance = error.getChallengeGuidance();
        const errorMessage = `Cloudflare protection encountered. ${guidance.recommendedAction}`;
        
        // Create a more informative error
        const cloudflareError = new Error(errorMessage);
        cloudflareError.isCloudflareError = true;
        cloudflareError.challengeType = guidance.challengeType;
        throw cloudflareError;
      }
      
      // For other errors, format and throw
      const errorMessage = error.message || 'Unknown error';
      console.error(`TestluyPaymentSDK: API request failed: ${errorMessage}`);
      throw new Error(`API request failed: ${errorMessage}`);
    }
  }

  /**
   * Performs an initial validation check with the API using the provided credentials.
   * Sets an internal flag `isValidated` upon success. Recommended to call before other methods.
   * @async
   * @returns {Promise<boolean>} True if credentials are valid and subscription is active, otherwise throws an error.
   * @throws {Error} If validation fails due to network issues, invalid credentials, or inactive subscription.
   */
  async init() {
    if (!this.clientId || !this.secretKey) {
      throw new Error(
        "TestluyPaymentSDK: Client ID and Secret Key are required for initialization."
      );
    }
    try {
      const isValid = await this.validateCredentials(); // Reuse validateCredentials logic
      if (!isValid) {
        // validateCredentials should throw an error explaining why it's not valid
        // If it somehow returned false without throwing, throw a generic error.
        throw new Error(
          "TestluyPaymentSDK: Credential validation returned false."
        );
      }
      this.isValidated = true; // Mark as validated
      console.log("TestluyPaymentSDK: Credentials Validated Successfully.");
      return true;
    } catch (error) {
      this.isValidated = false; // Ensure flag is false on error
      // Log the underlying error message if available
      console.error(
        "TestluyPaymentSDK: Failed to validate credentials:",
        error.message
      );
      // Re-throw the specific error from validateCredentials or a generic one
      throw new Error(
        `TestluyPaymentSDK: Initialization failed: ${
          error.message || "Could not validate credentials."
        }`
      );
    }
  }

  /**
   * Initiates a payment process by generating a payment URL.
   * @async
   * @param {number} amount - The amount for the payment.
   * @param {string} callbackUrl - The URL the user should be redirected to after completing the payment simulation on the sandbox.
   * @param {string} [backUrl] - Optional URL the user should be redirected to if they click 'Back' or 'Cancel' on the sandbox payment page before completion.
   * @returns {Promise<object>} An object containing the `paymentUrl` and `transactionId`.
   * @throws {Error} If input validation fails or the API call is unsuccessful.
   * @example
   * const { paymentUrl, transactionId } = await sdk.initiatePayment(10.50, 'https://myapp.com/payment/callback', 'https://myapp.com/cart');
   * // Redirect user to paymentUrl
   */
  async initiatePayment(amount, callbackUrl, backUrl) {
    try {
      // Validate inputs first
      validateAmount(amount);
      validateCallbackUrl(callbackUrl); // Validates the success/failure callback
      if (backUrl) {
        // Also validate the backUrl if provided, using the same URI validation
        validateCallbackUrl(backUrl); // Reusing the same validator for URI format
      }

      const path = this._getApiPath("payment-simulator/generate-url");
      const body = {
        amount,
        callback_url: callbackUrl,
        // Conditionally add back_url ONLY if it has a value
        ...(backUrl && { back_url: backUrl }),
      };

      // Use the enhanced HTTP client for this request
      const responseData = await this._makeRequest("POST", path, body);

      const { payment_url, transaction_id } = responseData;

      // Verify response structure
      if (!payment_url || !transaction_id) {
        console.error(
          "TestluyPaymentSDK: Server response missing payment_url or transaction_id",
          responseData
        );
        throw new Error("Incomplete response received from the server.");
      }

      return {
        paymentUrl: payment_url,
        transactionId: transaction_id,
      };
    } catch (error) {
      // If it's a validation error, just rethrow with a clear message
      if (error.message.includes("validation failed")) {
        throw new Error(`Failed to initiate payment: ${error.message}`);
      }

      // If it's already a formatted error from _makeRequest, just rethrow with context
      if (
        error.message.startsWith("API request failed:") ||
        error.isRateLimitError ||
        error.isCloudflareError
      ) {
        throw new Error(`Failed to initiate payment: ${error.message}`);
      }

      // Otherwise, format the error
      console.error(
        "TestluyPaymentSDK: Error in initiatePayment:",
        error.message
      );
      throw new Error(`Failed to initiate payment: ${error.message}`);
    }
  }

  /**
   * Retrieves the current status and details of a specific transaction.
   * @async
   * @param {string} transactionId - The unique ID of the transaction to check.
   * @returns {Promise<object>} An object containing the transaction details (e.g., status, amount, timestamps).
   * @throws {Error} If input validation fails or the API call is unsuccessful.
   */
  async getPaymentStatus(transactionId) {
    try {
      validateTransactionId(transactionId);

      const path = this._getApiPath(
        `payment-simulator/status/${transactionId}`
      );

      // Use the enhanced HTTP client for this request
      const responseData = await this._makeRequest("GET", path);

      // Verify response structure
      if (!responseData || !responseData.status) {
        console.error(
          "TestluyPaymentSDK: Server response missing status information",
          responseData
        );
        throw new Error("Incomplete response received from the server.");
      }

      return responseData; // Return the full transaction details object
    } catch (error) {
      // If it's a validation error, just rethrow with a clear message
      if (error.message.includes("validation failed")) {
        throw new Error(`Failed to get payment status: ${error.message}`);
      }

      // If it's already a formatted error from _makeRequest, just rethrow with context
      if (
        error.message.startsWith("API request failed:") ||
        error.isRateLimitError ||
        error.isCloudflareError
      ) {
        throw new Error(`Failed to get payment status: ${error.message}`);
      }

      // Otherwise, format the error
      console.error(
        `TestluyPaymentSDK: Error fetching payment status for ${transactionId}:`,
        error.message
      );
      throw new Error(`Failed to get payment status: ${error.message}`);
    }
  }

  /**
   * Validates the configured API credentials (Client ID, Secret Key) and checks if the associated subscription is active.
   * @async
   * @returns {Promise<boolean>} True if credentials are valid and subscription is active.
   * @throws {Error} If validation fails due to network issues, invalid credentials, or inactive/in-use subscription.
   */
  async validateCredentials() {
    try {
      const path = this._getApiPath("validate-credentials");
      const body = {}; // Validation endpoint expects an empty body

      // Use the enhanced HTTP client for this request
      const responseData = await this._makeRequest("POST", path, body);

      // Ensure the response has the expected structure
      if (typeof responseData?.isValid !== "boolean") {
        console.error(
          "TestluyPaymentSDK: Invalid response structure from validate-credentials:",
          responseData
        );
        throw new Error(
          "Unexpected response format during credential validation."
        );
      }

      // If isValid is false, the API should ideally send a 4xx error handled by the catch block.
      // But if it returns 200 OK with { isValid: false }, we handle it here.
      if (!responseData.isValid) {
        throw new Error(
          responseData.message || "Credentials validation returned false."
        );
      }

      return true; // Only return true if explicitly { isValid: true }
    } catch (error) {
      // If it's already a formatted error from _makeRequest, just rethrow
      if (
        error.message.startsWith("API request failed:") ||
        error.isRateLimitError ||
        error.isCloudflareError
      ) {
        throw error;
      }

      // Otherwise, format the error
      console.error("TestluyPaymentSDK: Validation error:", error.message);

      // Throw an error explaining the failure
      throw new Error(`Credentials validation failed: ${error.message}`);
    }
  }

  /**
   * Processes the data received at the merchant's callback URL after a payment attempt.
   * It verifies the status by calling `getPaymentStatus`.
   * @async
   * @param {object} callbackData - The query parameters or body received at the callback URL (should contain at least `transaction_id`).
   * @returns {Promise<object>} An object containing the verified transaction status and details.
   * @throws {Error} If callback data is invalid or `getPaymentStatus` fails.
   * @example
   * // Example assuming callbackData is URLSearchParams from `window.location.search`
   * const urlParams = new URLSearchParams(window.location.search);
   * const dataFromCallback = Object.fromEntries(urlParams.entries());
   * try {
   *   const result = await sdk.handlePaymentCallback(dataFromCallback);
   *   console.log('Payment Result:', result.status, result.paymentDetails);
   *   // Update UI based on result.status
   * } catch (error) {
   *   console.error('Callback handling failed:', error);
   * }
   */
  async handlePaymentCallback(callbackData) {
    try {
      // Validate input callbackData minimally
      if (!callbackData || typeof callbackData !== "object") {
        throw new Error("Invalid callback data received.");
      }
      // Extract transaction_id, prefer case-insensitivity if needed but stick to snake_case
      const transaction_id =
        callbackData.transaction_id || callbackData.transactionId;

      if (!transaction_id) {
        throw new Error("Transaction ID is missing in callback data.");
      }

      // Crucially, fetch the authoritative status from the backend
      const paymentStatusDetails = await this.getPaymentStatus(transaction_id);

      return {
        transactionId: transaction_id,
        // Use the verified status from the backend API call
        status: paymentStatusDetails.status, // e.g., 'Success', 'Failed', 'Initiated'
        paymentDetails: paymentStatusDetails, // Contains the full transaction object
      };
    } catch (error) {
      // Error could be from getPaymentStatus or input validation
      console.error(
        "TestluyPaymentSDK: Error in handlePaymentCallback:",
        error.message
      );
      // Propagate the specific error message
      throw new Error(`Failed to handle payment callback: ${error.message}`);
    }
  }

  // --- Debugging and Monitoring Methods ---

  /**
   * Gets current performance metrics and statistics
   * 
   * @returns {Object} Performance metrics including request counts, response times, and error statistics
   * @example
   * const metrics = sdk.getPerformanceMetrics();
   * console.log(`Success rate: ${metrics.requests.successful}/${metrics.requests.total}`);
   * console.log(`Average response time: ${metrics.performance.averageResponseTime}ms`);
   */
  getPerformanceMetrics() {
    return logger.getMetrics();
  }

  /**
   * Gets troubleshooting suggestions based on encountered issues
   * 
   * @returns {Array} Array of troubleshooting suggestions sorted by priority and frequency
   * @example
   * const suggestions = sdk.getTroubleshootingSuggestions();
   * suggestions.forEach(suggestion => {
   *   console.log(`[${suggestion.priority}] ${suggestion.issue}: ${suggestion.suggestion}`);
   * });
   */
  getTroubleshootingSuggestions() {
    return logger.getTroubleshootingSuggestions();
  }

  /**
   * Generates a comprehensive diagnostic report with metrics, issues, and recommendations
   * 
   * @returns {Object} Diagnostic report containing summary, issues, recommendations, and configuration
   * @example
   * const report = sdk.generateDiagnosticReport();
   * console.log('SDK Diagnostic Report:', JSON.stringify(report, null, 2));
   */
  generateDiagnosticReport() {
    return logger.generateDiagnosticReport();
  }

  /**
   * Logs current performance metrics summary to console
   * 
   * @example
   * sdk.logMetricsSummary(); // Outputs metrics summary to console
   */
  logMetricsSummary() {
    logger.logMetricsSummary();
  }

  /**
   * Logs troubleshooting suggestions to console
   * 
   * @example
   * sdk.logTroubleshootingSuggestions(); // Outputs suggestions to console
   */
  logTroubleshootingSuggestions() {
    logger.logTroubleshootingSuggestions();
  }

  /**
   * Logs a comprehensive diagnostic report to console
   * 
   * @example
   * sdk.logDiagnosticReport(); // Outputs full diagnostic report to console
   */
  logDiagnosticReport() {
    logger.logDiagnosticReport();
  }

  /**
   * Resets all performance metrics and troubleshooting data
   * 
   * @example
   * sdk.resetMetrics(); // Clears all collected metrics and starts fresh
   */
  resetMetrics() {
    logger.resetMetrics();
  }

  /**
   * Enables or disables performance metrics tracking
   * 
   * @param {boolean} enabled - Whether to enable metrics tracking
   * @example
   * sdk.setMetricsEnabled(true); // Enable detailed performance tracking
   */
  setMetricsEnabled(enabled) {
    logger.updateConfig({ enableMetrics: enabled });
    
    // Update logging interceptor if it exists
    if (this.loggingConfig) {
      this.loggingConfig.enableMetrics = enabled;
      logger.info('TestluyPaymentSDK: Metrics tracking', enabled ? 'enabled' : 'disabled');
      
      // Update debug interceptor if it exists
      if (this.debugInterceptor) {
        this.debugInterceptor.updateConfig({
          enabled: enabled,
          trackPerformance: enabled
        });
      }
    }
  }

  /**
   * Updates logging configuration
   * 
   * @param {Object} config - Logging configuration options
   * @param {string} [config.level] - Log level (debug, info, warn, error, silent)
   * @param {boolean} [config.includeHeaders] - Whether to include headers in logs
   * @param {boolean} [config.includeBody] - Whether to include request/response bodies
   * @param {boolean} [config.maskSensitive] - Whether to mask sensitive data
   * @param {boolean} [config.enableMetrics] - Whether to enable metrics tracking
   * @example
   * sdk.updateLoggingConfig({
   *   level: 'debug',
   *   includeHeaders: true,
   *   enableMetrics: true
   * });
   */
  updateLoggingConfig(config) {
    // Update internal config
    if (config) {
      Object.assign(this.loggingConfig, config);
    }
    
    // Update logger configuration
    logger.updateConfig({
      level: this.loggingConfig.level,
      includeHeaders: this.loggingConfig.includeHeaders,
      includeBody: this.loggingConfig.includeBody,
      maskSensitive: this.loggingConfig.maskSensitive,
      enableMetrics: this.loggingConfig.enableMetrics
    });
    
    // Update debug interceptor if it exists
    if (this.debugInterceptor) {
      this.debugInterceptor.updateConfig({
        enabled: this.loggingConfig.enableMetrics || this.loggingConfig.level === 'debug',
        trackPerformance: this.loggingConfig.enableMetrics,
        logRequests: this.loggingConfig.level === 'debug',
        includeHeaders: this.loggingConfig.includeHeaders,
        includeBody: this.loggingConfig.includeBody,
        maskSensitive: this.loggingConfig.maskSensitive
      });
    }
    
    logger.info('TestluyPaymentSDK: Logging configuration updated', config);
  }
  
  /**
   * Gets advanced performance metrics from the debug monitor
   * 
   * @returns {Object} Detailed performance metrics by endpoint and status code
   * @example
   * const advancedMetrics = sdk.getAdvancedMetrics();
   * console.log('Slowest endpoint:', advancedMetrics.timings.byEndpoint);
   */
  getAdvancedMetrics() {
    if (!this.debugInterceptor) {
      return { enabled: false, message: 'Debug interceptor not enabled' };
    }
    
    return this.debugInterceptor.getPerformanceMetrics();
  }
  
  /**
   * Gets advanced troubleshooting suggestions from the debug monitor
   * 
   * @returns {Array} Array of troubleshooting suggestions with detailed context
   * @example
   * const advancedSuggestions = sdk.getAdvancedTroubleshootingSuggestions();
   * advancedSuggestions.forEach(suggestion => console.log(suggestion.issue, suggestion.suggestion));
   */
  getAdvancedTroubleshootingSuggestions() {
    if (!this.debugInterceptor) {
      return [];
    }
    
    return this.debugInterceptor.getTroubleshootingSuggestions();
  }
  
  /**
   * Generates a comprehensive diagnostic report with detailed metrics and recommendations
   * 
   * @returns {Object} Detailed diagnostic report with endpoint-specific metrics
   * @example
   * const advancedReport = sdk.generateAdvancedDiagnosticReport();
   * console.log('Health status:', advancedReport.summary.healthStatus);
   * console.log('Slowest endpoint:', advancedReport.summary.slowestEndpoint);
   */
  generateAdvancedDiagnosticReport() {
    if (!this.debugInterceptor) {
      return {
        timestamp: new Date().toISOString(),
        enabled: false,
        message: 'Debug interceptor not enabled'
      };
    }
    
    return this.debugInterceptor.createDiagnosticReport();
  }
  
  /**
   * Enables advanced debugging features for troubleshooting
   * 
   * @param {Object} [options={}] - Debug options
   * @param {boolean} [options.trackPerformance=true] - Whether to track detailed performance metrics
   * @param {boolean} [options.logRequests=true] - Whether to log all requests and responses
   * @param {boolean} [options.includeHeaders=false] - Whether to include headers in logs
   * @param {boolean} [options.includeBody=false] - Whether to include request/response bodies
   * @returns {Object} Current debug configuration
   * @example
   * sdk.enableDebugging({ includeHeaders: true });
   * // Make some API calls
   * const report = sdk.generateAdvancedDiagnosticReport();
   */
  enableDebugging(options = {}) {
    const debugOptions = {
      trackPerformance: options.trackPerformance !== false,
      logRequests: options.logRequests !== false,
      includeHeaders: options.includeHeaders || false,
      includeBody: options.includeBody || false
    };
    
    // Update logging config
    this.updateLoggingConfig({
      level: 'debug',
      includeHeaders: debugOptions.includeHeaders,
      includeBody: debugOptions.includeBody,
      enableMetrics: true
    });
    
    // Update debug interceptor if it exists
    if (this.debugInterceptor) {
      this.debugInterceptor.updateConfig({
        enabled: true,
        trackPerformance: debugOptions.trackPerformance,
        logRequests: debugOptions.logRequests,
        includeHeaders: debugOptions.includeHeaders,
        includeBody: debugOptions.includeBody
      });
      
      logger.info('TestluyPaymentSDK: Advanced debugging enabled', debugOptions);
    } else {
      logger.warn('TestluyPaymentSDK: Debug interceptor not available');
    }
    
    return {
      enabled: true,
      ...debugOptions
    };
  }
  
  /**
   * Disables advanced debugging features
   * 
   * @example
   * sdk.disableDebugging();
   */
  disableDebugging() {
    // Update logging config back to defaults
    this.updateLoggingConfig({
      level: 'warn',
      includeHeaders: false,
      includeBody: false,
      enableMetrics: false
    });
    
    // Update debug interceptor if it exists
    if (this.debugInterceptor) {
      this.debugInterceptor.updateConfig({
        enabled: false,
        trackPerformance: false,
        logRequests: false
      });
      
      logger.info('TestluyPaymentSDK: Advanced debugging disabled');
    }
  }
  
  /**
   * Gets information about the current runtime environment
   * 
   * @returns {Object} Environment information including browser/Node.js details and feature support
   * @example
   * const envInfo = sdk.getEnvironmentInfo();
   * console.log(`Running in ${envInfo.environment} environment`);
   * if (envInfo.browser) {
   *   console.log(`Browser: ${envInfo.browser.type} ${envInfo.browser.version}`);
   * }
   */
  getEnvironmentInfo() {
    return this.environmentInfo || EnvironmentDetector.getEnvironmentInfo();
  }
  
  /**
   * Checks if the current environment requires polyfills
   * 
   * @returns {Object} Object containing required polyfills
   * @example
   * const requiredPolyfills = sdk.getRequiredPolyfills();
   * if (requiredPolyfills.cryptoSubtle) {
   *   console.log('This environment requires a crypto.subtle polyfill');
   * }
   */
  getRequiredPolyfills() {
    return EnvironmentDetector.getRequiredPolyfills();
  }

  // --- Deprecated Method ---

  /**
   * Generates only the payment URL for redirecting the user to the sandbox.
   * @async
   * @deprecated Use initiatePayment instead for more complete functionality, including transactionId and backUrl support.
   * @param {number} amount - The amount for the payment.
   * @param {string} callbackUrl - The URL to redirect back to after payment simulation.
   * @returns {Promise<string>} The payment URL.
   * @throws {Error} If input validation fails or the API call is unsuccessful.
   */
  async generatePaymentUrl(amount, callbackUrl) {
    console.warn(
      "TestluyPaymentSDK: generatePaymentUrl is deprecated. Use initiatePayment instead."
    );
    try {
      validateAmount(amount);
      validateCallbackUrl(callbackUrl);

      const path = this._getApiPath("payment-simulator/generate-url");
      const body = {
        amount: amount,
        callback_url: callbackUrl,
      };

      // Use the enhanced HTTP client for this request
      const responseData = await this._makeRequest("POST", path, body);

      if (!responseData?.payment_url) {
        console.error(
          "TestluyPaymentSDK: Server response missing payment_url",
          responseData
        );
        throw new Error("Incomplete response received from the server.");
      }

      return responseData.payment_url;
    } catch (error) {
      const errorMessage = error.message || 'Unknown error';
      console.error(
        "TestluyPaymentSDK: Generate payment URL error:",
        errorMessage
      );
      throw new Error(`Failed to generate payment URL: ${errorMessage}`);
    }
  }
}

console.log("Enhanced TestluyPaymentSDK loaded with Cloudflare resilience");
export default TestluyPaymentSDK;