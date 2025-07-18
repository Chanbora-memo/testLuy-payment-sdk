/**
 * Test script for the enhanced TestluyPaymentSDK with Cloudflare resilience
 */

import TestluyPaymentSDK from './index-enhanced.js';

// Sample credentials for testing
const TEST_CREDENTIALS = {
  clientId: 'fd7865634fcfaaac2b96f03386e07d27',
  secretKey: 'secret_3c8ba8fab36d6e259a2bc40230c40c9891b36cd08e6f33224e4b0abb45170e24',
  // Using the standardized base URL
  baseUrl: 'https://api-testluy.paragoniu.app'
};

async function testEnhancedSDK() {
  console.log('=== Testing Enhanced TestluyPaymentSDK ===\n');

  // Create SDK with detailed logging
  console.log('Initializing SDK with debug logging...');
  const sdk = new TestluyPaymentSDK({
    ...TEST_CREDENTIALS,
    loggingConfig: {
      level: 'debug',
      includeHeaders: true,
      includeBody: true,
      enableMetrics: true
    },
    cloudflareConfig: {
      enabled: true,
      rotateUserAgent: true,
      addBrowserHeaders: true,
      addTimingVariation: true
    },
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2,
      jitterFactor: 0.2
    }
  });

  try {
    // Test 1: Validate credentials
    console.log('\n=== Test 1: Credential Validation ===');
    try {
      console.log('Validating credentials...');
      const isValid = await sdk.validateCredentials();
      console.log('Credentials valid:', isValid);
    } catch (error) {
      console.error('Validation error:', error.message);
    }

    // Test 2: Initiate payment
    console.log('\n=== Test 2: Payment Initiation ===');
    try {
      console.log('Initiating payment...');
      const result = await sdk.initiatePayment(10.50, 'https://example.com/callback');
      console.log('Payment initiated:', result);

      // If payment initiation was successful, test payment status
      if (result && result.transactionId) {
        console.log('\n=== Test 3: Payment Status ===');
        console.log('Checking payment status...');
        const statusResult = await sdk.getPaymentStatus(result.transactionId);
        console.log('Payment status:', statusResult);
      }
    } catch (error) {
      console.error('Payment initiation error:', error.message);
    }

    // Test 4: Performance metrics
    console.log('\n=== Test 4: Performance Metrics ===');
    const metrics = sdk.getPerformanceMetrics();
    console.log('Success rate:', `${metrics.requests?.successful || 0}/${metrics.requests?.total || 0}`);
    console.log('Average response time:', `${metrics.performance?.averageResponseTime || 'N/A'}ms`);
    console.log('Rate limited requests:', metrics.errors?.rateLimited || 0);
    console.log('Cloudflare blocks:', metrics.errors?.cloudflare || 0);

    // Test 5: Troubleshooting suggestions
    console.log('\n=== Test 5: Troubleshooting Suggestions ===');
    const suggestions = sdk.getTroubleshootingSuggestions();
    if (suggestions && suggestions.length > 0) {
      suggestions.forEach(suggestion => {
        console.log(`[${suggestion.priority}] ${suggestion.issue}: ${suggestion.suggestion}`);
      });
    } else {
      console.log('No troubleshooting suggestions available');
    }

  } catch (error) {
    console.error('\n=== Unexpected Error ===');
    console.error(error);
  }

  console.log('\n=== Testing Complete ===');
}

testEnhancedSDK().catch(console.error);