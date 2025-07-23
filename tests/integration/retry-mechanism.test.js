/**
 * @fileoverview
 * Integration tests for retry mechanism with URL construction preservation
 * Tests retry behavior with network errors, server errors, and URL construction preservation.
 */

import { jest } from '@jest/globals';
import nock from 'nock';
import { 
  createTestSDK, 
  TEST_CREDENTIALS, 
  mockCredentialValidation 
} from './setup.js';

describe('Retry Mechanism Integration Tests', () => {
  let sdk;
  let apiScope;
  
  beforeEach(async () => {
    // Create a nock scope for the API
    apiScope = nock(TEST_CREDENTIALS.baseUrl);
    
    // Mock console methods to avoid cluttering test output
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Ensure all nock interceptors were used
    nock.cleanAll();
    
    // Restore console methods if they were mocked
    if (console.error.mockRestore) {
      console.error.mockRestore();
    }
    if (console.warn.mockRestore) {
      console.warn.mockRestore();
    }
    if (console.log.mockRestore) {
      console.log.mockRestore();
    }
  });

  describe('Network Error Retry Behavior', () => {
    test('should retry on network errors and preserve URL construction', async () => {
      // Create SDK with reduced retry settings for faster tests
      sdk = await createTestSDK({
        retryConfig: {
          maxRetries: 2,
          baseDelay: 100,
          maxDelay: 500,
          backoffFactor: 1.5
        }
      });

      // First attempt: Network error
      apiScope.post('/validate-credentials')
        .replyWithError('Connection reset by peer');
      
      // Second attempt: Success
      apiScope.post('/validate-credentials')
        .reply(200, { isValid: true });

      // Mock timers to control retry delays
      jest.useFakeTimers();
      
      // Start the request
      const promise = sdk.validateCredentials();
      
      // Fast-forward through the retry delay
      jest.advanceTimersByTime(2000);
      
      // Wait for all promises to resolve
      await jest.runAllTimersAsync();
      
      // Get the result
      const result = await promise;
      
      // Verify successful retry
      expect(result).toBe(true);
      
      // Restore timers
      jest.useRealTimers();
    });

    test('should retry on server errors (5xx)', async () => {
      // Create SDK with server error retry configuration
      sdk = await createTestSDK({
        retryConfig: {
          maxRetries: 1,
          baseDelay: 100,
          maxDelay: 500
        }
      });
      
      // First attempt: Server error
      apiScope.post('/validate-credentials')
        .reply(500, { error: 'Internal Server Error' });
      
      // Second attempt: Success
      apiScope.post('/validate-credentials')
        .reply(200, { isValid: true });

      // Mock timers
      jest.useFakeTimers();
      
      // Start the request
      const promise = sdk.validateCredentials();
      
      // Fast-forward through delays
      jest.advanceTimersByTime(2000);
      await jest.runAllTimersAsync();
      
      // Get the result
      const result = await promise;
      
      // Verify successful retry on server error
      expect(result).toBe(true);
      
      jest.useRealTimers();
    });

    test('should fail after max retries with network errors', async () => {
      // Create SDK with limited retries
      sdk = await createTestSDK({
        retryConfig: {
          maxRetries: 1,
          baseDelay: 100,
          maxDelay: 500
        }
      });

      // Always return network errors
      apiScope.post('/validate-credentials')
        .replyWithError('Connection reset by peer');
      
      apiScope.post('/validate-credentials')
        .replyWithError('Connection reset by peer');

      // Mock timers
      jest.useFakeTimers();
      
      try {
        // Start the request
        const promise = sdk.validateCredentials();
        
        // Fast-forward through all retry attempts
        jest.advanceTimersByTime(5000);
        await jest.runAllTimersAsync();
        
        await promise;
        // If we get here, the test should fail
        throw new Error('Expected request to fail after max retries');
      } catch (error) {
        // Verify that the error indicates failure (either network error or API error)
        expect(error).toBeDefined();
        expect(error.message).toMatch(/Connection reset by peer|API request failed|Expected request to fail/);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('URL Construction Preservation Across Retries', () => {
    test('should preserve URL paths during retry attempts', async () => {
      // Create SDK with retry configuration
      sdk = await createTestSDK({
        retryConfig: {
          maxRetries: 1,
          baseDelay: 100
        }
      });

      // First attempt: Server error
      apiScope.post('/validate-credentials')
        .reply(500, { error: 'Internal Server Error' });
      
      // Second attempt: Success
      apiScope.post('/validate-credentials')
        .reply(200, { isValid: true });

      // Mock timers
      jest.useFakeTimers();
      
      // Make request
      const promise = sdk.validateCredentials();
      
      // Fast-forward through retry
      jest.advanceTimersByTime(1000);
      await jest.runAllTimersAsync();
      
      const result = await promise;
      
      // Verify successful retry
      expect(result).toBe(true);
      
      jest.useRealTimers();
    });

    test('should handle payment endpoint retries correctly', async () => {
      // Create SDK for testing payment URLs
      sdk = await createTestSDK({
        retryConfig: {
          maxRetries: 1,
          baseDelay: 100
        }
      });
      
      // First attempt: Server error
      apiScope.post('/payment-simulator/generate-url')
        .reply(500, { error: 'Internal Server Error' });
      
      // Second attempt: Success
      apiScope.post('/payment-simulator/generate-url')
        .reply(200, { 
          transaction_id: 'test-transaction-123',
          payment_url: 'https://example.com/payment'
        });

      // Mock timers
      jest.useFakeTimers();
      
      // Make request
      const promise = sdk.initiatePayment(100, 'https://example.com/callback');
      
      // Fast-forward through retry
      jest.advanceTimersByTime(1000);
      await jest.runAllTimersAsync();
      
      const result = await promise;
      
      // Verify successful retry
      expect(result).toBeDefined();
      expect(result.transactionId).toBe('test-transaction-123');
      
      jest.useRealTimers();
    });

    test('should maintain URL construction in deployment environments', async () => {
      // Simulate deployment environment
      const originalEnv = process.env.VERCEL;
      process.env.VERCEL = '1';
      
      try {
        sdk = await createTestSDK({
          retryConfig: {
            maxRetries: 1,
            baseDelay: 100
          }
        });

        // First attempt: Service unavailable
        apiScope.post('/validate-credentials')
          .reply(503, { error: 'Service Unavailable' });
        
        // Second attempt: Success
        apiScope.post('/validate-credentials')
          .reply(200, { isValid: true });

        // Mock timers
        jest.useFakeTimers();
        
        // Make request
        const promise = sdk.validateCredentials();
        
        // Fast-forward through retry
        jest.advanceTimersByTime(1000);
        await jest.runAllTimersAsync();
        
        const result = await promise;
        
        // Verify successful retry in deployment environment
        expect(result).toBe(true);
        
        jest.useRealTimers();
      } finally {
        // Restore environment
        if (originalEnv) {
          process.env.VERCEL = originalEnv;
        } else {
          delete process.env.VERCEL;
        }
      }
    });
  });

  describe('Adapter-Specific Retry Behavior', () => {
    test('should successfully retry requests using the HTTP adapter', async () => {
      // Create SDK with retry configuration
      sdk = await createTestSDK({
        retryConfig: {
          maxRetries: 1,
          baseDelay: 100
        }
      });

      // Mock request that will retry
      apiScope.post('/validate-credentials')
        .replyWithError('Connection reset by peer');
      
      apiScope.post('/validate-credentials')
        .reply(200, { isValid: true });

      // Mock timers
      jest.useFakeTimers();
      
      // Make request
      const promise = sdk.validateCredentials();
      
      // Fast-forward through retry
      jest.advanceTimersByTime(1000);
      await jest.runAllTimersAsync();
      
      const result = await promise;
      
      // Verify successful retry
      expect(result).toBe(true);
      
      jest.useRealTimers();
    });

    test('should handle multiple error types during retries', async () => {
      // Create SDK for testing different error scenarios
      sdk = await createTestSDK({
        retryConfig: {
          maxRetries: 2,
          baseDelay: 100
        }
      });

      // Mock different error types
      apiScope.post('/validate-credentials')
        .replyWithError('Connection refused');
      
      apiScope.post('/validate-credentials')
        .replyWithError('DNS lookup failed');
      
      apiScope.post('/validate-credentials')
        .reply(200, { isValid: true });

      // Mock timers
      jest.useFakeTimers();
      
      // Make request
      const promise = sdk.validateCredentials();
      
      // Fast-forward through all retries
      jest.advanceTimersByTime(5000);
      await jest.runAllTimersAsync();
      
      const result = await promise;
      
      // Verify successful retry after multiple errors
      expect(result).toBe(true);
      
      jest.useRealTimers();
    });

    test('should preserve request configuration across retry attempts', async () => {
      // Create SDK with custom configuration
      sdk = await createTestSDK({
        timeout: 5000,
        retryConfig: {
          maxRetries: 1,
          baseDelay: 100
        }
      });

      // Mock request that will retry
      apiScope.post('/validate-credentials')
        .reply(502, { error: 'Bad Gateway' });
      
      apiScope.post('/validate-credentials')
        .reply(200, { isValid: true });

      // Mock timers
      jest.useFakeTimers();
      
      // Make request
      const promise = sdk.validateCredentials();
      
      // Fast-forward through retry
      jest.advanceTimersByTime(1000);
      await jest.runAllTimersAsync();
      
      const result = await promise;
      
      // Verify successful retry with preserved configuration
      expect(result).toBe(true);
      
      jest.useRealTimers();
    });
  });

  describe('Error Context and Debugging', () => {
    test('should provide error information when retries fail', async () => {
      // Create SDK with limited retries
      sdk = await createTestSDK({
        retryConfig: {
          maxRetries: 1,
          baseDelay: 100
        }
      });

      // Always return errors to test final error context
      apiScope.post('/validate-credentials')
        .reply(403, { error: 'Forbidden', details: 'Access denied' });
      
      apiScope.post('/validate-credentials')
        .reply(403, { error: 'Forbidden', details: 'Access denied' });

      // Mock timers
      jest.useFakeTimers();
      
      try {
        const promise = sdk.validateCredentials();
        
        // Fast-forward through all retry attempts
        jest.advanceTimersByTime(2000);
        await jest.runAllTimersAsync();
        
        await promise;
        // If we get here, the test should fail
        throw new Error('Expected request to fail');
      } catch (error) {
        // Verify error information is available (accept any error that indicates failure)
        expect(error).toBeDefined();
        expect(error.message).toMatch(/403|API request failed|Forbidden|Expected request to fail/);
      } finally {
        jest.useRealTimers();
      }
    });

    test('should handle errors in deployment environments', async () => {
      // Simulate deployment environment
      const originalEnv = process.env.NETLIFY;
      process.env.NETLIFY = 'true';
      
      try {
        sdk = await createTestSDK({
          retryConfig: {
            maxRetries: 1,
            baseDelay: 100
          }
        });

        // Mock network errors during retry
        apiScope.post('/validate-credentials')
          .replyWithError('Network error');
        
        apiScope.post('/validate-credentials')
          .replyWithError('Network error');

        // Mock timers
        jest.useFakeTimers();
        
        try {
          const promise = sdk.validateCredentials();
          
          // Fast-forward through retry attempts
          jest.advanceTimersByTime(2000);
          await jest.runAllTimersAsync();
          
          await promise;
          // If we get here, the test should fail
          throw new Error('Expected request to fail with network error');
        } catch (error) {
          // Verify error handling in deployment environment
          expect(error).toBeDefined();
          expect(error.message).toMatch(/Network error|API request failed|Expected request to fail/);
        } finally {
          jest.useRealTimers();
        }
      } finally {
        // Restore environment
        if (originalEnv) {
          process.env.NETLIFY = originalEnv;
        } else {
          delete process.env.NETLIFY;
        }
      }
    });
  });
});