/**
 * @fileoverview
 * Integration tests for complete API flows
 */

import { jest } from '@jest/globals';
import nock from 'nock';
import { 
  createTestSDK, 
  TEST_CREDENTIALS, 
  mockSuccessfulResponse 
} from './setup.js';

describe('API Flow Integration Tests', () => {
  let sdk;
  let apiScope;
  
  beforeEach(async () => {
    // Create a fresh SDK instance for each test
    sdk = await createTestSDK();
    
    // Create a nock scope for the API
    apiScope = nock(TEST_CREDENTIALS.baseUrl);
  });
  
  afterEach(() => {
    // Ensure all nock interceptors were used
    nock.cleanAll();
  });
  
  describe('Complete payment flow', () => {
    test('should successfully complete a full payment flow', async () => {
      // SDK instance is already created in beforeEach
      
      // Mock the validate credentials endpoint
      mockSuccessfulResponse(
        apiScope, 
        '/validate-credentials', 
        'POST', 
        { isValid: true }
      );
      
      // Mock the initiate payment endpoint
      const transactionId = 'test-transaction-123';
      mockSuccessfulResponse(
        apiScope, 
        '/payment-simulator/generate-url', 
        'POST', 
        {
          payment_url: 'https://payment.testluy.com/pay/test-transaction-123',
          transaction_id: transactionId
        }
      );
      
      // Mock the payment status endpoint
      mockSuccessfulResponse(
        apiScope, 
        `/payment-simulator/status/${transactionId}`, 
        'GET', 
        {
          transaction_id: transactionId,
          status: 'Success',
          amount: 100.50,
          created_at: '2025-07-17T12:00:00Z',
          updated_at: '2025-07-17T12:05:00Z'
        }
      );
      
      // Step 1: Initialize the SDK
      await sdk.init();
      expect(sdk.isValidated).toBe(true);
      
      // Step 2: Initiate a payment
      const paymentResult = await sdk.initiatePayment(
        100.50, 
        'https://example.com/callback',
        'https://example.com/cancel'
      );
      
      expect(paymentResult).toEqual({
        paymentUrl: 'https://payment.testluy.com/pay/test-transaction-123',
        transactionId: transactionId
      });
      
      // Step 3: Check payment status
      const statusResult = await sdk.getPaymentStatus(transactionId);
      
      expect(statusResult).toEqual({
        transaction_id: transactionId,
        status: 'Success',
        amount: 100.50,
        created_at: '2025-07-17T12:00:00Z',
        updated_at: '2025-07-17T12:05:00Z'
      });
      
      // Step 4: Handle callback
      const callbackData = { transaction_id: transactionId };
      const callbackResult = await sdk.handlePaymentCallback(callbackData);
      
      expect(callbackResult).toEqual({
        transactionId: transactionId,
        status: 'Success',
        paymentDetails: {
          transaction_id: transactionId,
          status: 'Success',
          amount: 100.50,
          created_at: '2025-07-17T12:00:00Z',
          updated_at: '2025-07-17T12:05:00Z'
        }
      });
    });
    
    test('should handle payment flow with failed payment', async () => {
      // SDK instance is already created in beforeEach
      
      // Mock the validate credentials endpoint
      mockSuccessfulResponse(
        apiScope, 
        '/validate-credentials', 
        'POST', 
        { isValid: true }
      );
      
      // Mock the initiate payment endpoint
      const transactionId = 'test-transaction-456';
      mockSuccessfulResponse(
        apiScope, 
        '/payment-simulator/generate-url', 
        'POST', 
        {
          payment_url: 'https://payment.testluy.com/pay/test-transaction-456',
          transaction_id: transactionId
        }
      );
      
      // Mock the payment status endpoint with a failed status
      mockSuccessfulResponse(
        apiScope, 
        `/payment-simulator/status/${transactionId}`, 
        'GET', 
        {
          transaction_id: transactionId,
          status: 'Failed',
          amount: 100.50,
          created_at: '2025-07-17T12:00:00Z',
          updated_at: '2025-07-17T12:05:00Z',
          error: 'Payment declined by user'
        }
      );
      
      // Step 1: Initialize the SDK
      await sdk.init();
      
      // Step 2: Initiate a payment
      const paymentResult = await sdk.initiatePayment(
        100.50, 
        'https://example.com/callback'
      );
      
      // Step 3: Check payment status (failed)
      const statusResult = await sdk.getPaymentStatus(transactionId);
      
      expect(statusResult.status).toBe('Failed');
      expect(statusResult.error).toBe('Payment declined by user');
      
      // Step 4: Handle callback with failed payment
      const callbackData = { transaction_id: transactionId };
      const callbackResult = await sdk.handlePaymentCallback(callbackData);
      
      expect(callbackResult.status).toBe('Failed');
      expect(callbackResult.paymentDetails.error).toBe('Payment declined by user');
    });
  });
  
  describe('Error handling in payment flow', () => {
    test('should handle validation errors in initiatePayment', async () => {
      // Mock the validate credentials endpoint
      mockSuccessfulResponse(
        apiScope, 
        '/validate-credentials', 
        'POST', 
        { isValid: true }
      );
      
      // Initialize the SDK
      await sdk.init();
      
      // Test with invalid amount
      await expect(sdk.initiatePayment(
        -100, 
        'https://example.com/callback'
      )).rejects.toThrow('Failed to initiate payment: "amount" must be a positive number');
      
      // Test with invalid callback URL
      await expect(sdk.initiatePayment(
        100, 
        'invalid-url'
      )).rejects.toThrow('Failed to initiate payment: "callbackUrl" must be a valid URI');
    });
    
    test('should handle server errors in getPaymentStatus', async () => {
      // Mock the validate credentials endpoint
      mockSuccessfulResponse(
        apiScope, 
        '/validate-credentials', 
        'POST', 
        { isValid: true }
      );
      
      // Mock the payment status endpoint with a server error
      apiScope.get('/payment-simulator/status/error-transaction')
        .reply(500, { error: 'Internal Server Error' });
      
      // Initialize the SDK
      await sdk.init();
      
      // Test with server error
      await expect(sdk.getPaymentStatus('error-transaction'))
        .rejects.toThrow('Failed to get payment status: API request failed');
    });
    
    test('should handle invalid transaction ID in handlePaymentCallback', async () => {
      // SDK instance is already created in beforeEach
      
      // Test with missing transaction ID
      await expect(sdk.handlePaymentCallback({}))
        .rejects.toThrow('Failed to handle payment callback: Transaction ID is missing in callback data');
      
      // Test with invalid callback data
      await expect(sdk.handlePaymentCallback(null))
        .rejects.toThrow('Failed to handle payment callback: Invalid callback data received');
    });
  });
});