import axios from "axios";
import { getConfig } from "./config.js";
import {
  validateAmount,
  validateCallbackUrl,
  validateTransactionId,
} from "./validation.js";

/**
 * TestluyPaymentSDK - A payment processing SDK for integrating with the Testluy payment system
 * @class
 * @description Handles payment processing operations including payment URL generation, status checking, and callback handling
 */
class TestluyPaymentSDK {
  constructor(options = {}) {
    const { clientId, secretKey, baseUrl } = getConfig(options);
    if (!clientId || !secretKey) {
      throw new Error("Client ID and Secret Key are required.");
    }
    // Ensure baseUrl doesn't end with a slash
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    if (!this.baseUrl.startsWith('http://') && !this.baseUrl.startsWith('https://')) {
      console.warn(`Warning: Base URL "${this.baseUrl}" might be invalid. Ensure it includes http:// or https://`);
    }
    this.clientId = clientId;
    this.secretKey = secretKey;
    this.isValidated = false;
  }

  /**
   * Generate HMAC signature for request using Web Crypto API
   * @private
   */
  async _generateSignature(method, path, timestamp, body = '') {
    const encoder = new TextEncoder();
    // Ensure body is consistently stringified for POST/PUT, or empty string for GET/DELETE
    const bodyString = (method === 'POST' || method === 'PUT')
                       ? (typeof body === 'string' ? body : JSON.stringify(body))
                       : '';

    const stringToSign = method + '\n' +
                        path + '\n' +
                        timestamp + '\n' +
                        bodyString;

    // Convert secret key to Uint8Array
    const keyData = encoder.encode(this.secretKey);

    // Import the key for HMAC
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Create the signature
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(stringToSign)
    );

    // Convert to hex string
    const hexSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return hexSignature;
  }

  /**
   * Get authentication headers for request
   * @private
   */
  async _getAuthHeaders(method, path, body = '') {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    // ***** Pass the actual body intended for the request to _generateSignature *****
    const signature = await this._generateSignature(method, path, timestamp, body);

    return {
      'X-Client-ID': this.clientId,
      'X-Timestamp': timestamp,
      'X-Signature': signature,
      'Content-Type': 'application/json',
    };
  }

  async init() {
    if (!this.clientId || !this.secretKey) {
      throw new Error("Client ID and Secret Key are required.");
    }
    try {
      this.isValidated = await this.validateCredentials();
      if (!this.isValidated) {
        // Provide a more specific error based on potential validateCredentials failure
         throw new Error("Invalid credentials or inactive/in-use application subscription.");
      }
      console.log("SDK Credentials Validated Successfully.");
    } catch (error) {
        // Log the underlying error message if available
      console.error("Failed to validate credentials:", error.message);
       // Re-throw the specific error from validateCredentials or a generic one
       throw new Error(`SDK Initialization failed: ${error.message || 'Could not validate credentials.'}`);
    }
  }

  async generatePaymentUrl(amount, callbackUrl) {
    try {
      validateAmount(amount);
      validateCallbackUrl(callbackUrl);

      // ***** FIX: Prepend 'api/' to the path *****
      const path = 'api/payment-simulator/generate-url';
      const body = {
        amount: amount,
        callback_url: callbackUrl
      };
      const fullUrl = `${this.baseUrl}/${path}`;
      // console.log("POST Request URL:", fullUrl); // Debugging
      // console.log("Request Body:", JSON.stringify(body)); // Debugging

      const response = await axios.post(
        fullUrl,
        body,
        {
          // ***** Pass the correct path and body for signing *****
          headers: await this._getAuthHeaders('POST', path, body)
        }
      );
      return response.data.payment_url;
    } catch (error) {
       // Enhanced error logging
       const errorData = error.response?.data;
       const errorMessage = (errorData?.message || errorData?.error || error.message);
       console.error(
         "Generate payment URL error:",
         errorData ? JSON.stringify(errorData) : error.message // Log full response data if available
       );
       // Throw a more specific error
       throw new Error(`Failed to generate payment URL: ${errorMessage}`);
    }
  }

  async getPaymentStatus(transactionId) {
    try {
      validateTransactionId(transactionId);

      // ***** FIX: Prepend 'api/' to the path *****
      const path = `api/payment-simulator/status/${transactionId}`;
      const fullUrl = `${this.baseUrl}/${path}`;
      // console.log("GET Request URL:", fullUrl); // Debugging

      const response = await axios.get(
        fullUrl,
        {
          // ***** Pass the correct path for signing (body is implicitly empty for GET) *****
          headers: await this._getAuthHeaders('GET', path) // No body needed for GET signature here
        }
      );
      return response.data;
    } catch (error) {
      const errorData = error.response?.data;
      const errorMessage = (errorData?.message || errorData?.error || error.message);
      console.error(
          `Error fetching payment status for ${transactionId}:`,
          errorData ? JSON.stringify(errorData) : error.message
      );
      throw new Error(`Failed to get payment status: ${errorMessage}`);
    }
  }

  async validateCredentials() {
    try {
      // ***** FIX: Prepend 'api/' to the path *****
      const path = 'api/validate-credentials';
      const body = {}; // Explicitly define the empty body being sent
      const fullUrl = `${this.baseUrl}/${path}`;
      // console.log("POST Request URL for Validation:", fullUrl); // Debugging

      const response = await axios.post(
        fullUrl,
        body, // Send the empty body
        {
          // ***** Pass the correct path and the empty body object for signing *****
          headers: await this._getAuthHeaders('POST', path, body)
        }
      );
      return response.data.isValid;
    } catch (error) {
      const errorData = error.response?.data;
      const errorMessage = (errorData?.message || errorData?.error || error.message);
      console.error(
        "Validation error:",
        errorData ? JSON.stringify(errorData) : error.message
      );
      // Throwing the error is generally better than returning false,
      // as it indicates *why* validation failed (e.g., network error vs. invalid key)
      // The caller (like init) can then handle it appropriately.
      throw new Error(`Credentials validation failed: ${errorMessage}`);
      // return false; // Original behavior if preferred
    }
  }

  async initiatePaymentFlow(amount, callbackUrl, backUrl) {
    try {
      validateAmount(amount);
      validateCallbackUrl(callbackUrl); // Assuming backUrl is optional or validated elsewhere if needed

      // ***** FIX: Prepend 'api/' to the path *****
      const path = 'api/payment-simulator/generate-url';
      const body = {
        amount,
        callback_url: callbackUrl,
        // Conditionally add back_url ONLY if it has a value,
        // to ensure the body signed matches exactly what's sent.
        ...(backUrl && { back_url: backUrl })
      };
      const fullUrl = `${this.baseUrl}/${path}`;
      // console.log("POST Request URL (Flow):", fullUrl); // Debugging
      // console.log("Request Body (Flow):", JSON.stringify(body)); // Debugging

      const response = await axios.post(
        fullUrl,
        body,
        {
           // ***** Pass the correct path and body for signing *****
          headers: await this._getAuthHeaders('POST', path, body)
        }
      );

      const { payment_url, transaction_id } = response.data;

      if (!payment_url || !transaction_id) { // Check both fields returned
        console.error("Server response missing payment_url or transaction_id", response.data);
        throw new Error("Incomplete response received from the server.");
      }

      return {
        paymentUrl: payment_url,
        transactionId: transaction_id,
        // backUrl: backUrl, // No need to return this, it was an input
        // The handleCallback function reference remains useful
        handleCallback: this.handlePaymentCallback.bind(this)
      };
    } catch (error) {
      const errorData = error.response?.data;
      const errorMessage = (errorData?.message || errorData?.error || error.message);
      console.error(
          "Error in initiatePaymentFlow:",
          errorData ? JSON.stringify(errorData) : error.message
      );
      throw new Error(`Failed to initiate payment flow: ${errorMessage}`);
    }
  }

  // handlePaymentCallback calls getPaymentStatus which is now fixed, so no direct changes needed here.
  async handlePaymentCallback(callbackData, callbackUrl) {
    try {
      // Validate input callbackData minimally
      if (!callbackData || typeof callbackData !== 'object') {
          throw new Error("Invalid callback data received.");
      }
      const { transaction_id, status } = callbackData;

      if (!transaction_id) {
        throw new Error("Transaction ID is missing in callback data.");
      }
       // It's safer to rely on the status fetched from the backend via getPaymentStatus
      const paymentStatusDetails = await this.getPaymentStatus(transaction_id);

      return {
        transactionId: transaction_id,
        // Use the verified status from the backend API call
        status: paymentStatusDetails.status, // e.g., 'Success', 'Failed', 'Initiated'
        paymentDetails: paymentStatusDetails,
        // receivedCallbackStatus: status, // Optionally keep the status received in the callback
        callbackUrl: callbackUrl // The URL the callback was POSTed to (if needed)
      };
    } catch (error) {
      // Error could be from getPaymentStatus or input validation
      console.error("Error in handlePaymentCallback:", error.message);
      // Propagate the specific error message
      throw new Error(`Failed to handle payment callback: ${error.message}`);
    }
  }
}

console.log("TestluyPaymentSDK loaded");
export default TestluyPaymentSDK;