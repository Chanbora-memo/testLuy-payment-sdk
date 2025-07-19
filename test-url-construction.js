/**
 * Test script to verify URL construction fixes
 */

import TestluyPaymentSDK from './index-enhanced.js';

// Test credentials
const TEST_CREDENTIALS = {
  clientId: 'fd7865634fcfaaac2b96f03386e07d27',
  secretKey: 'sk_test_fIjYNNa3oU7JhVnHIAaWfyDePqRZTc23',
  baseUrl: 'https://api-testluy.paragoniu.app'
};

async function testURLConstruction() {
  console.log('=== Testing URL Construction Fixes ===\n');

  try {
    // Create SDK instance with enhanced error handling
    const sdk = new TestluyPaymentSDK({
      ...TEST_CREDENTIALS,
      loggingConfig: {
        level: 'debug',
        includeHeaders: false,
        includeBody: false
      },
      retryConfig: {
        maxRetries: 2,  // Reduce retries for testing
        baseDelay: 500,
        maxDelay: 2000
      }
    });

    console.log('✓ SDK created successfully');
    console.log(`Base URL: ${sdk.baseUrl}`);
    console.log(`Use API Prefix: ${sdk.useApiPrefix}`);

    // Test URL path generation
    console.log('\n=== Testing URL Path Generation ===');
    const testEndpoints = [
      'validate-credentials',
      'payment-simulator/generate-url',
      'payment-simulator/status/test-123'
    ];

    testEndpoints.forEach(endpoint => {
      try {
        const path = sdk._getApiPath(endpoint);
        console.log(`✓ ${endpoint} → ${path}`);
      } catch (error) {
        console.error(`✗ ${endpoint} → Error: ${error.message}`);
      }
    });

    // Test actual validation call (this might fail with 403 but should not have URL construction errors)
    console.log('\n=== Testing Actual API Call ===');
    try {
      console.log('Attempting credential validation...');
      const isValid = await sdk.validateCredentials();
      console.log(`✓ Credentials validation successful: ${isValid}`);
    } catch (error) {
      if (error.message.includes('URL construction error')) {
        console.error('✗ URL construction error detected:', error.message);
      } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
        console.log('⚠ Got 403 error (CORS issue), but no URL construction error - this is expected');
      } else {
        console.log(`⚠ Got error: ${error.message}`);
      }
    }

    console.log('\n=== URL Construction Test Complete ===');

  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testURLConstruction().catch(console.error);
