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
      // Explicitly check for clientId and secretKey
      throw new Error("Client ID and Secret Key are required.");
    }
    this.clientId = clientId;
    this.secretKey = secretKey;
    this.baseUrl = baseUrl;
    this.isValidated = false;
  }

  async init() {
    if (!this.clientId || !this.secretKey) {
      throw new Error("Client ID and Secret Key are required.");
    }
    try {
      this.isValidated = await this.validateCredentials();
      if (!this.isValidated) {
        throw new Error("Invalid credentials");
      }
    } catch (error) {
      console.error("Failed to validate credentials:", error.message);
      throw error;
    }
  }

  async generatePaymentUrl(amount, callbackUrl) {
    try {
      validateAmount(amount);
      validateCallbackUrl(callbackUrl);
      const response = await axios.post(
        `${this.baseUrl}/payment-simulator/generate-url`,
        {
          amount: amount,
          callback_url: callbackUrl,
          client_id: this.clientId,
          secret_key: this.secretKey,
        },
        {
          auth: {
            username: this.clientId,
            password: this.secretKey,
          },
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      return response.data.payment_url;
    } catch (error) {
      console.error(
        "Generate payment URL error:",
        error.response ? error.response.data : error.message
      );
      throw new Error(
        `Failed to generate payment URL: ${
          error.response ? error.response.data.message : error.message
        }`
      );
    }
  }

  async getPaymentStatus(transactionId) {
    try {
      validateTransactionId(transactionId);
      console.log(`Fetching payment status for transaction: ${transactionId}`);
      const response = await axios.get(
        `${this.baseUrl}/payment-simulator/status/${transactionId}`,
        {
          auth: {
            username: this.clientId,
            password: this.secretKey,
          },
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      console.log(`Payment status response:`, response.data);
      return response.data;
    } catch (error) {
      console.error(`Error fetching payment status:`, error);
      throw new Error(`Failed to get payment status: ${error.message}`);
    }
  }

  async validateCredentials() {
    try {
      console.log(`Validating credentials for client ID: ${this.clientId}`);
      const response = await axios.post(
        `${this.baseUrl}/validate-credentials`,
        {},
        {
          auth: {
            username: this.clientId,
            password: this.secretKey,
          },
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      console.log("Validation response:", response.data);
      return response.data.isValid;
    } catch (error) {
      console.error(
        "Validation error:",
        error.response ? error.response.data : error.message
      );
      return false;
    }
  }

  async initiatePaymentFlow(amount, callbackUrl, backUrl) {
    try {
      validateAmount(amount);
      validateCallbackUrl(callbackUrl);
      console.log(
        `Initiating payment flow with amount: ${amount}, callback URL: ${callbackUrl}, and back URL: ${backUrl}`
      );
      const response = await axios.post(
        `${this.baseUrl}/payment-simulator/generate-url`,
        {
          amount,
          callback_url: callbackUrl,
          back_url: backUrl,
        },
        {
          auth: {
            username: this.clientId,
            password: this.secretKey,
          },
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Response status:", response.status);
      console.log("Response data:", JSON.stringify(response.data, null, 2));

      const { payment_url, transaction_id } = response.data;

      console.log("Extracted payment_url:", payment_url);
      console.log("Extracted transaction_id:", transaction_id);

      if (!transaction_id) {
        console.error("Transaction ID is missing in the response");
        throw new Error("Transaction ID not returned from the server");
      }

      console.log("Received transaction ID in SDK:", transaction_id);

      const result = {
        paymentUrl: payment_url,
        transactionId: transaction_id,
        backUrl: backUrl,
        handleCallback: this.handlePaymentCallback.bind(this),
      };

      console.log(
        "Returning result from initiatePaymentFlow:",
        JSON.stringify(result, null, 2)
      );

      return result;
    } catch (error) {
      console.error("Error in initiatePaymentFlow:", error.message);
      if (error.response) {
        console.error(
          "Error response data:",
          JSON.stringify(error.response.data, null, 2)
        );
      }
      throw new Error(`Failed to initiate payment flow: ${error.message}`);
    }
  }

  async handlePaymentCallback(callbackData, callbackUrl) {
    try {
      const { transaction_id, status } = callbackData;
      if (!transaction_id) {
        console.error(
          "Transaction ID is undefined in callbackData:",
          callbackData
        );
        throw new Error("Transaction ID is undefined");
      }
      console.log(
        "Handling payment callback for transaction ID:",
        transaction_id
      );
      const paymentStatus = await this.getPaymentStatus(transaction_id);
      return {
        transactionId: transaction_id,
        status: status,
        paymentDetails: paymentStatus,
        callbackUrl: callbackUrl,
      };
    } catch (error) {
      console.error("Error in handlePaymentCallback:", error);
      throw new Error(`Failed to handle payment callback: ${error.message}`);
    }
  }
}

console.log("TestluyPaymentSDK loaded");
export default TestluyPaymentSDK;
