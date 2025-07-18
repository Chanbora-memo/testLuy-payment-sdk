/**
 * Test script for browser compatibility layer
 * 
 * This script demonstrates the browser compatibility features of the SDK
 * by testing it in different environments and with different configurations.
 */

import TestluyPaymentSDK from './index-enhanced.js';
import EnvironmentDetector from './http/utils/EnvironmentDetector.js';

// Initialize the SDK with test credentials
const sdk = new TestluyPaymentSDK({
  clientId: 'test-client-id',
  secretKey: 'test-secret-key',
  baseUrl: 'https://api-testluy.paragoniu.app',
  loggingConfig: {
    level: 'debug',
    includeHeaders: true
  }
});

// Get environment information
const environmentInfo = sdk.getEnvironmentInfo();
console.log('Environment Information:');
console.log(JSON.stringify(environmentInfo, null, 2));

// Check required polyfills
const requiredPolyfills = sdk.getRequiredPolyfills();
console.log('\nRequired Polyfills:');
console.log(JSON.stringify(requiredPolyfills, null, 2));

// Test HMAC signature generation in different environments
async function testHmacSignatureGeneration() {
  console.log('\nTesting HMAC Signature Generation:');
  
  try {
    // Generate a test signature
    const method = 'POST';
    const path = 'api/payment-simulator/generate-url';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = { amount: 10.50, callback_url: 'https://example.com/callback' };
    
    // Use the private method via a workaround (for testing only)
    const signature = await sdk._generateSignature(method, path, timestamp, body);
    
    console.log('Successfully generated HMAC signature:', signature.substring(0, 10) + '...');
    return true;
  } catch (error) {
    console.error('Error generating HMAC signature:', error.message);
    return false;
  }
}

// Test HTTP client in different environments
async function testHttpClient() {
  console.log('\nTesting HTTP Client:');
  
  try {
    // Make a test request (this will fail with test credentials, but we can check if the client works)
    await sdk.validateCredentials().catch(error => {
      // We expect an error with test credentials, but the HTTP client should work
      if (error.message.includes('API request failed') || 
          error.message.includes('Credentials validation failed')) {
        console.log('HTTP client successfully made a request (expected error with test credentials)');
        return true;
      } else {
        console.error('HTTP client error:', error.message);
        return false;
      }
    });
  } catch (error) {
    console.error('Error testing HTTP client:', error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('=== Browser Compatibility Tests ===\n');
  
  // Test HMAC signature generation
  await testHmacSignatureGeneration();
  
  // Test HTTP client
  await testHttpClient();
  
  console.log('\n=== Tests Complete ===');
}

// Run the tests
runTests().catch(error => {
  console.error('Test error:', error);
});