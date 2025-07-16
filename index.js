import axios from "axios";
import { getConfig } from "./config.js";
import { logger } from "./logger.js";
import {
  validateAmount,
  validateCallbackUrl,
  validateTransactionId,
} from "./validation.js";

// Default retry configuration
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 10000, // 10 seconds
  backoffFactor: 2, // Exponential backoff
};

/**
 * TestluyPaymentSDK - SDK for integrating with the Testluy Payment Simulator API.
 * @class
 * @param {object} options - Configuration options.
 * @param {string} options.clientId - Your Testluy application client ID.
 * @param {string} options.secretKey - Your Testluy application secret key.
 * @param {string} [options.baseUrl] - The base URL for the Testluy API (defaults to value in config or environment).
 * @param {object} [options.retryConfig] - Configuration for request retries on rate limiting.
 * @param {number} [options.retryConfig.maxRetries=3] - Maximum number of retry attempts.
 * @param {number} [options.retryConfig.initialDelayMs=1000] - Initial delay in milliseconds before first retry.
 * @param {number} [options.retryConfig.maxDelayMs=10000] - Maximum delay in milliseconds between retries.
 * @param {number} [options.retryConfig.backoffFactor=2] - Factor by which to increase delay on each retry.
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

    // Determine if we should use API prefix based on the base URL
    // For api-testluy.paragoniu.app, we don't need the /api prefix since it's already an API domain
    this.useApiPrefix = !this.baseUrl.includes("api-testluy.paragoniu.app");

    logger.info(
      `TestluyPaymentSDK initialized with baseUrl: ${this.baseUrl}, useApiPrefix: ${this.useApiPrefix}`
    );

    // Set up retry configuration with defaults
    this.retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...(options.retryConfig || {}),
    };

    // Track rate limit information
    this.rateLimitInfo = {
      limit: null,
      remaining: null,
      resetAt: null,
      currentPlan: null,
    };
  }

  /**
   * Constructs the correct API path based on the base URL configuration.
   * @private
   * @param {string} endpoint - The endpoint path (e.g., 'payment-simulator/generate-url').
   * @returns {string} The full path with or without the 'api/' prefix.
   */
  _getApiPath(endpoint) {
    const path = this.useApiPrefix ? `api/${endpoint}` : endpoint;
    logger.info(
      `TestluyPaymentSDK: Generated API path: ${path} (from endpoint: ${endpoint})`
    );
    return path;
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
    const encoder = new TextEncoder();
    // Ensure body is consistently stringified for POST/PUT, or empty string for GET/DELETE
    const bodyString =
      method === "POST" || method === "PUT"
        ? typeof body === "string"
          ? body
          : JSON.stringify(body) // Stringify if it's an object
        : ""; // Empty string for GET/DELETE etc.

    const stringToSign =
      method + "\n" + path + "\n" + timestamp + "\n" + bodyString;

    try {
      // Convert secret key to Uint8Array
      const keyData = encoder.encode(this.secretKey);

      // Import the key for HMAC
      const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false, // not extractable
        ["sign"] // usage
      );

      // Create the signature
      const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(stringToSign)
      );

      // Convert signature ArrayBuffer to hex string
      const hexSignature = Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      return hexSignature;
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
      return {
        "X-Client-ID": this.clientId,
        "X-Timestamp": timestamp,
        "X-Signature": signature,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Makes an API request with automatic retry on rate limit errors.
   * @private
   * @param {string} method - HTTP method (GET, POST, etc.).
   * @param {string} path - API endpoint path.
   * @param {object} [body={}] - Request body for POST/PUT requests.
   * @param {number} [retryCount=0] - Current retry attempt (used internally for recursion).
   * @returns {Promise<object>} The API response data.
   * @throws {Error} If the request fails after all retries or for non-rate-limit errors.
   */
  async _makeRequestWithRetry(method, path, body = {}, retryCount = 0) {
    const fullUrl = `${this.baseUrl}/${path}`;

    try {
      // Make the API request
      const response = await axios({
        method: method,
        url: fullUrl,
        data: method !== "GET" ? body : undefined,
        headers: await this._getAuthHeaders(
          method,
          path,
          method !== "GET" ? body : ""
        ),
      });

      // Update rate limit info from headers if available
      if (response.headers["x-ratelimit-limit"]) {
        this.rateLimitInfo.limit = parseInt(
          response.headers["x-ratelimit-limit"],
          10
        );
      }
      if (response.headers["x-ratelimit-remaining"]) {
        this.rateLimitInfo.remaining = parseInt(
          response.headers["x-ratelimit-remaining"],
          10
        );
      }
      if (response.headers["x-ratelimit-reset"]) {
        this.rateLimitInfo.resetAt = new Date(
          parseInt(response.headers["x-ratelimit-reset"], 10) * 1000
        );
      }

      return response.data;
    } catch (error) {
      // Check if this is a rate limit error (status code 429)
      if (error.response && error.response.status === 429) {
        // Extract rate limit info from the response
        const retryAfter =
          error.response.headers["retry-after"] ||
          (error.response.data && error.response.data.retry_after) ||
          this.retryConfig.initialDelayMs / 1000;

        // Update rate limit info
        if (error.response.data) {
          if (error.response.data.limit) {
            this.rateLimitInfo.limit = error.response.data.limit;
          }
          if (error.response.data.current_plan) {
            this.rateLimitInfo.currentPlan = error.response.data.current_plan;
          }
        }

        // Check if we've exceeded max retries
        if (retryCount >= this.retryConfig.maxRetries) {
          const errorMessage = `Rate limit exceeded. Max retries (${this.retryConfig.maxRetries}) reached.`;
          console.error(`TestluyPaymentSDK: ${errorMessage}`, {
            path,
            rateLimitInfo: this.rateLimitInfo,
          });

          // Create a more informative error
          const rateLimitError = new Error(errorMessage);
          rateLimitError.isRateLimitError = true;
          rateLimitError.rateLimitInfo = { ...this.rateLimitInfo };
          rateLimitError.retryAfter = retryAfter;
          rateLimitError.upgradeInfo = error.response.data?.upgrade_info;
          throw rateLimitError;
        }

        // Calculate backoff delay with exponential increase
        const delayMs = Math.min(
          this.retryConfig.initialDelayMs *
            Math.pow(this.retryConfig.backoffFactor, retryCount),
          this.retryConfig.maxDelayMs
        );

        // Use the server's retry-after if available, otherwise use our calculated delay
        const finalDelayMs = retryAfter * 1000 || delayMs;

        console.warn(
          `TestluyPaymentSDK: Rate limit hit. Retrying in ${finalDelayMs}ms (attempt ${
            retryCount + 1
          }/${this.retryConfig.maxRetries})`,
          {
            path,
            rateLimitInfo: this.rateLimitInfo,
          }
        );

        // Wait for the delay period
        await new Promise((resolve) => setTimeout(resolve, finalDelayMs));

        // Retry the request with incremented retry count
        return this._makeRequestWithRetry(method, path, body, retryCount + 1);
      }

      // For non-rate-limit errors, format and throw
      const errorData = error.response?.data;
      const errorMessage =
        errorData?.message || errorData?.error || error.message;
      console.error(`TestluyPaymentSDK: API request failed: ${errorMessage}`, {
        path,
        statusCode: error.response?.status,
        errorData,
      });
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

      // Use the retry mechanism for this request
      const responseData = await this._makeRequestWithRetry("POST", path, body);

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

      // If it's already a formatted error from _makeRequestWithRetry, just rethrow with context
      if (
        error.message.startsWith("API request failed:") ||
        error.isRateLimitError
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

      // Use the retry mechanism for this request
      const responseData = await this._makeRequestWithRetry("GET", path);

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

      // If it's already a formatted error from _makeRequestWithRetry, just rethrow with context
      if (
        error.message.startsWith("API request failed:") ||
        error.isRateLimitError
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

      // Use the retry mechanism for this request
      const responseData = await this._makeRequestWithRetry("POST", path, body);

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
      // If it's already a formatted error from _makeRequestWithRetry, just rethrow
      if (
        error.message.startsWith("API request failed:") ||
        error.isRateLimitError
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
      const fullUrl = `${this.baseUrl}/${path}`;

      const response = await axios.post(fullUrl, body, {
        headers: await this._getAuthHeaders("POST", path, body),
      });

      if (!response.data?.payment_url) {
        console.error(
          "TestluyPaymentSDK: Server response missing payment_url",
          response.data
        );
        throw new Error("Incomplete response received from the server.");
      }

      return response.data.payment_url;
    } catch (error) {
      const errorData = error.response?.data;
      const errorMessage =
        errorData?.message || errorData?.error || error.message;
      console.error(
        "TestluyPaymentSDK: Generate payment URL error:",
        errorData ? JSON.stringify(errorData) : error.message
      );
      throw new Error(`Failed to generate payment URL: ${errorMessage}`);
    }
  }
}

console.log("TestluyPaymentSDK loaded");
export default TestluyPaymentSDK;
