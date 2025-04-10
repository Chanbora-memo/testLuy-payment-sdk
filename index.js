import axios from "axios";
import { getConfig } from "./config.js";
import {
  validateAmount,
  validateCallbackUrl, // Use this for backUrl validation too (it's just URI validation)
  validateTransactionId,
} from "./validation.js";

/**
 * TestluyPaymentSDK - SDK for integrating with the Testluy Payment Simulator API.
 * @class
 * @param {object} options - Configuration options.
 * @param {string} options.clientId - Your Testluy application client ID.
 * @param {string} options.secretKey - Your Testluy application secret key.
 * @param {string} [options.baseUrl] - The base URL for the Testluy API (defaults to value in config or environment).
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
      console.warn(
        `TestluyPaymentSDK Warning: Base URL "${this.baseUrl}" might be invalid. Ensure it includes http:// or https://`
      );
    }
    this.clientId = clientId;
    this.secretKey = secretKey;
    this.isValidated = false; // State to track if validateCredentials was successful
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
        const signature = await this._generateSignature(method, path, timestamp, body);
        return {
        "X-Client-ID": this.clientId,
        "X-Timestamp": timestamp,
        "X-Signature": signature,
        "Content-Type": "application/json",
        "Accept": "application/json", // Good practice to include Accept header
        };
    } catch (error) {
        // Error already logged in _generateSignature
        throw error; // Re-throw the error
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
      console.error("TestluyPaymentSDK: Failed to validate credentials:", error.message);
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
      validateAmount(amount);
      validateCallbackUrl(callbackUrl); // Validates the success/failure callback
      if (backUrl) {
        // Also validate the backUrl if provided, using the same URI validation
         validateCallbackUrl(backUrl); // Reusing the same validator for URI format
      }

      const path = "api/payment-simulator/generate-url";
      const body = {
        amount,
        callback_url: callbackUrl,
        // Conditionally add back_url ONLY if it has a value
        ...(backUrl && { back_url: backUrl }),
      };
      const fullUrl = `${this.baseUrl}/${path}`;

      const response = await axios.post(fullUrl, body, {
        headers: await this._getAuthHeaders("POST", path, body),
      });

      const { payment_url, transaction_id } = response.data;

      // Verify response structure
      if (!payment_url || !transaction_id) {
        console.error(
          "TestluyPaymentSDK: Server response missing payment_url or transaction_id",
          response.data
        );
        throw new Error("Incomplete response received from the server.");
      }

      return {
        paymentUrl: payment_url,
        transactionId: transaction_id,
      };
    } catch (error) {
      // Handle validation errors or Axios errors
      const errorData = error.response?.data;
      const errorMessage =
        errorData?.message || errorData?.error || error.message;
      console.error(
        "TestluyPaymentSDK: Error in initiatePayment:",
        errorData ? JSON.stringify(errorData) : error.message
      );
      throw new Error(`Failed to initiate payment: ${errorMessage}`);
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

      const path = `api/payment-simulator/status/${transactionId}`;
      const fullUrl = `${this.baseUrl}/${path}`;

      const response = await axios.get(fullUrl, {
        // GET request, body is implicitly empty for signature generation
        headers: await this._getAuthHeaders("GET", path),
      });
      return response.data; // Return the full transaction details object
    } catch (error) {
      const errorData = error.response?.data;
      const errorMessage =
        errorData?.message || errorData?.error || error.message;
      console.error(
        `TestluyPaymentSDK: Error fetching payment status for ${transactionId}:`,
        errorData ? JSON.stringify(errorData) : error.message
      );
      throw new Error(`Failed to get payment status: ${errorMessage}`);
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
      const path = "api/validate-credentials";
      const body = {}; // Validation endpoint expects an empty body
      const fullUrl = `${this.baseUrl}/${path}`;

      const response = await axios.post(fullUrl, body, {
        headers: await this._getAuthHeaders("POST", path, body),
      });
      // Ensure the response has the expected structure
      if (typeof response.data?.isValid !== 'boolean') {
          console.error("TestluyPaymentSDK: Invalid response structure from validate-credentials:", response.data);
          throw new Error("Unexpected response format during credential validation.");
      }
      // If isValid is false, the API should ideally send a 4xx error handled by the catch block.
      // But if it returns 200 OK with { isValid: false }, we handle it here.
      if (!response.data.isValid) {
          throw new Error(response.data.message || "Credentials validation returned false.");
      }
      return true; // Only return true if explicitly { isValid: true }
    } catch (error) {
      const errorData = error.response?.data;
      const errorMessage =
        errorData?.message || errorData?.error || error.message;
      // Log the specific error from the API if available
      console.error(
        "TestluyPaymentSDK: Validation error:",
        errorData ? JSON.stringify(errorData) : error.message
      );
      // Throw an error explaining the failure
      throw new Error(`Credentials validation failed: ${errorMessage}`);
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
      const transaction_id = callbackData.transaction_id || callbackData.transactionId;

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
    console.warn("TestluyPaymentSDK: generatePaymentUrl is deprecated. Use initiatePayment instead.");
    try {
      validateAmount(amount);
      validateCallbackUrl(callbackUrl);

      const path = "api/payment-simulator/generate-url";
      const body = {
        amount: amount,
        callback_url: callbackUrl,
      };
      const fullUrl = `${this.baseUrl}/${path}`;

      const response = await axios.post(fullUrl, body, {
        headers: await this._getAuthHeaders("POST", path, body),
      });

      if (!response.data?.payment_url) {
           console.error("TestluyPaymentSDK: Server response missing payment_url", response.data);
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