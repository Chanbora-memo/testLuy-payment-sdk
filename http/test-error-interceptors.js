/**
 * @fileoverview
 * Test file for the error interceptors
 */

import EnhancedHttpClient from './EnhancedHttpClient.js';
import ErrorClassifierInterceptor from './interceptors/ErrorClassifierInterceptor.js';
import CloudflareErrorInterceptor from './interceptors/CloudflareErrorInterceptor.js';
import RateLimitErrorInterceptor from './interceptors/RateLimitErrorInterceptor.js';
import NetworkErrorInterceptor from './interceptors/NetworkErrorInterceptor.js';

/**
 * Test the error interceptors
 */
async function testErrorInterceptors() {
  console.log('Testing Error Interceptors...');
  
  // Create a new EnhancedHttpClient instance
  const client = new EnhancedHttpClient({
    baseUrl: 'https://jsonplaceholder.typicode.com',
    timeout: 5000
  });
  
  // Add error interceptors in the correct order
  // 1. First classify the error
  client.addErrorInterceptor(new ErrorClassifierInterceptor({
    onError: (error, errorInfo) => {
      console.log(`Error classified as: ${errorInfo.type}, retryable: ${errorInfo.retryable}`);
    }
  }));
  
  // 2. Then add specific error handlers
  client.addErrorInterceptor(new CloudflareErrorInterceptor({
    maxRetries: 2,
    onCloudflareError: (error, errorInfo) => {
      console.log(`Cloudflare error detected: ${errorInfo.details.challengeType || 'unknown'}`);
    }
  }));
  
  client.addErrorInterceptor(new RateLimitErrorInterceptor({
    maxRetries: 2,
    onRateLimit: ({ retryCount, maxRetries, delayMs }) => {
      console.log(`Rate limited. Retry ${retryCount}/${maxRetries} after ${delayMs}ms`);
    }
  }));
  
  client.addErrorInterceptor(new NetworkErrorInterceptor({
    maxRetries: 2,
    onNetworkError: ({ retryCount, maxRetries, delayMs }) => {
      console.log(`Network error. Retry ${retryCount}/${maxRetries} after ${delayMs}ms`);
    }
  }));
  
  // Test 1: Make a request to a non-existent endpoint to trigger a 404 error
  console.log('\n1. Testing 404 error:');
  try {
    await client.get('/non-existent-endpoint');
  } catch (error) {
    console.log('Error type:', error.errorType);
    console.log('Retryable:', error.retryable);
    console.log('Error details:', error.errorDetails);
  }
  
  // Test 2: Simulate a network error
  console.log('\n2. Testing network error:');
  try {
    // Create a client with an invalid base URL
    const badClient = new EnhancedHttpClient({
      baseUrl: 'https://non-existent-domain-12345.com',
      timeout: 2000
    });
    
    // Add the same error interceptors
    badClient.addErrorInterceptor(new ErrorClassifierInterceptor());
    badClient.addErrorInterceptor(new NetworkErrorInterceptor({
      maxRetries: 1,
      baseDelay: 500,
      onNetworkError: ({ retryCount }) => {
        console.log(`Network error retry ${retryCount}`);
      }
    }));
    
    await badClient.get('/test');
  } catch (error) {
    console.log('Error type:', error.errorType);
    console.log('Retryable:', error.retryable);
    console.log('Error message:', error.message);
  }
  
  // Test 3: Simulate a timeout error
  console.log('\n3. Testing timeout error:');
  try {
    // Create a client with a very short timeout
    const timeoutClient = new EnhancedHttpClient({
      baseUrl: 'https://httpbin.org',
      timeout: 10 // 10ms is too short for any request
    });
    
    // Add the same error interceptors
    timeoutClient.addErrorInterceptor(new ErrorClassifierInterceptor());
    timeoutClient.addErrorInterceptor(new NetworkErrorInterceptor({
      maxRetries: 1,
      baseDelay: 500,
      onNetworkError: ({ retryCount }) => {
        console.log(`Timeout error retry ${retryCount}`);
      }
    }));
    
    await timeoutClient.get('/delay/2');
  } catch (error) {
    console.log('Error type:', error.errorType);
    console.log('Retryable:', error.retryable);
    console.log('Error message:', error.message);
  }
  
  console.log('\nError interceptors tests completed!');
}

// Run the test
testErrorInterceptors().catch(error => {
  console.error('Test failed:', error);
});