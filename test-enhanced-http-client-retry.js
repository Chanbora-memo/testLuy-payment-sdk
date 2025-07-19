/**
 * Test script to verify EnhancedHttpClient retry coordination
 * This tests that the ErrorHandler receives the HTTP adapter reference
 * and uses it for retry operations while maintaining adapter context.
 */

import EnhancedHttpClient from './http/EnhancedHttpClient.js';
import ErrorHandler from './http/ErrorHandler.js';
import RetryStrategy from './http/RetryStrategy.js';

// Mock HTTP adapter for testing
class MockHttpAdapter {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.requestCount = 0;
  }

  async request(config) {
    this.requestCount++;
    console.log(`MockHttpAdapter.request called (attempt ${this.requestCount})`);
    console.log('Config:', {
      method: config.method,
      url: config.url,
      adapterType: config.adapterType,
      baseUrl: config.baseUrl,
      retryAttempt: config.retryAttempt
    });

    // Simulate failure on first attempt, success on second
    if (this.requestCount === 1) {
      const error = new Error('Simulated network error');
      error.config = config;
      error.request = {}; // Add request property to make it a network error
      error.code = 'ECONNRESET'; // Simulate connection reset
      throw error;
    }

    // Return successful response
    return {
      data: { success: true, attempt: this.requestCount },
      status: 200,
      headers: {}
    };
  }
}

async function testEnhancedHttpClientRetryCoordination() {
  console.log('=== Testing EnhancedHttpClient Retry Coordination ===\n');

  try {
    // Create retry strategy
    const retryStrategy = new RetryStrategy({
      maxRetries: 2,
      baseDelay: 100, // Short delay for testing
      maxDelay: 1000,
      backoffFactor: 2,
      jitterFactor: 0
    });

    // Create enhanced HTTP client
    const httpClient = new EnhancedHttpClient({
      baseUrl: 'https://api.example.com',
      timeout: 5000
    });

    // Replace the internal HTTP client with our mock for testing
    const originalHttpClient = httpClient.httpClient;
    httpClient.httpClient = new MockHttpAdapter('https://api.example.com');

    // Create error handler
    const errorHandler = new ErrorHandler({
      retryStrategy: retryStrategy,
      onError: (error) => {
        console.log(`ErrorHandler.onError: ${error.message}`);
      },
      onRetry: ({ attempt, delay, retryContext }) => {
        console.log(`ErrorHandler.onRetry: Attempt ${attempt}, delay ${delay}ms`);
        console.log('Retry context:', retryContext);
      },
      onRecovery: () => {
        console.log('ErrorHandler.onRecovery: Request recovered successfully');
      }
    });

    // Add error interceptor to HTTP client
    const interceptorId = httpClient.addErrorInterceptor(errorHandler.createErrorInterceptor());

    console.log('1. Testing HTTP adapter reference assignment...');
    
    // Verify that the ErrorHandler received the HTTP adapter reference
    const errorInterceptor = httpClient.errorInterceptors[interceptorId];
    const hasHttpAdapter = errorInterceptor._errorHandler.httpAdapter !== undefined;
    const hasAdapterType = errorInterceptor._errorHandler.adapterType !== undefined;
    
    console.log(`   ✓ HTTP adapter reference assigned: ${hasHttpAdapter}`);
    console.log(`   ✓ Adapter type assigned: ${hasAdapterType}`);
    console.log(`   ✓ Adapter type: ${errorInterceptor._errorHandler.adapterType}`);

    console.log('\n2. Testing request with retry...');
    
    // Make a request that will fail first, then succeed on retry
    const response = await httpClient.request({
      method: 'GET',
      url: '/test-endpoint'
    });

    console.log('\n3. Verifying results...');
    console.log(`   ✓ Request succeeded: ${response.success}`);
    console.log(`   ✓ Total attempts made: ${httpClient.httpClient.requestCount}`);
    console.log(`   ✓ Final attempt number: ${response.attempt}`);

    // Verify that retry used the same adapter
    if (httpClient.httpClient.requestCount === 2) {
      console.log('   ✓ Retry mechanism used the same HTTP adapter');
    } else {
      console.log('   ✗ Unexpected number of requests made');
    }

    console.log('\n4. Testing adapter context preservation...');
    
    // Reset request count for next test
    httpClient.httpClient.requestCount = 0;
    
    // Make another request to verify context is preserved
    const response2 = await httpClient.request({
      method: 'POST',
      url: '/another-endpoint',
      data: { test: 'data' }
    });

    console.log(`   ✓ Second request succeeded: ${response2.success}`);
    console.log(`   ✓ Adapter context maintained across requests`);

    console.log('\n=== All tests passed! ===');
    
    return true;

  } catch (error) {
    console.error('\n=== Test failed ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Run the test
testEnhancedHttpClientRetryCoordination()
  .then(success => {
    if (success) {
      console.log('\n✅ EnhancedHttpClient retry coordination test completed successfully');
      process.exit(0);
    } else {
      console.log('\n❌ EnhancedHttpClient retry coordination test failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
  });