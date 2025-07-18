/**
 * @fileoverview
 * Test file for the RetryStrategy class
 */

import RetryStrategy from './RetryStrategy.js';
import EnhancedHttpClient from './EnhancedHttpClient.js';

/**
 * Test the RetryStrategy class
 */
async function testRetryStrategy() {
  console.log('Testing RetryStrategy...');
  
  // Create a new RetryStrategy instance with custom configuration
  const retryStrategy = new RetryStrategy({
    maxRetries: 3,
    baseDelay: 100, // Small delay for testing
    maxDelay: 1000,
    backoffFactor: 2,
    jitterFactor: 0.1,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    onRetry: ({ attempt, error, delay }) => {
      console.log(`Retry attempt ${attempt} after ${delay}ms due to error: ${error.message}`);
    }
  });
  
  // Test 1: Successful operation with no retries
  console.log('\n1. Testing successful operation with no retries:');
  try {
    const result = await retryStrategy.executeWithRetry(() => {
      console.log('Executing operation...');
      return Promise.resolve('Success!');
    });
    console.log('Result:', result);
  } catch (error) {
    console.error('Test 1 failed:', error);
  }
  
  // Test 2: Operation that fails once then succeeds
  console.log('\n2. Testing operation that fails once then succeeds:');
  let attempts = 0;
  try {
    const result = await retryStrategy.executeWithRetry(() => {
      console.log(`Execution attempt ${attempts + 1}...`);
      attempts++;
      if (attempts === 1) {
        throw new Error('Temporary failure');
      }
      return Promise.resolve('Success after retry!');
    });
    console.log('Result:', result);
  } catch (error) {
    console.error('Test 2 failed:', error);
  }
  
  // Test 3: Operation that always fails
  console.log('\n3. Testing operation that always fails:');
  try {
    await retryStrategy.executeWithRetry(() => {
      console.log('Executing failing operation...');
      return Promise.reject(new Error('Permanent failure'));
    });
  } catch (error) {
    console.log('Expected error caught:', error.message);
  }
  
  // Test 4: Test delay calculation
  console.log('\n4. Testing delay calculation:');
  for (let i = 1; i <= 5; i++) {
    const delay = retryStrategy.calculateDelay(i);
    console.log(`Delay for attempt ${i}: ${delay}ms`);
  }
  
  // Test 5: Test with simulated Cloudflare error
  console.log('\n5. Testing with simulated Cloudflare error:');
  const cloudflareError = new Error('Cloudflare blocked request');
  cloudflareError.response = {
    status: 403,
    headers: {
      server: 'cloudflare'
    },
    data: 'Checking your browser before accessing the website...'
  };
  
  console.log('Should retry Cloudflare error:', retryStrategy.shouldRetry(cloudflareError, 0));
  
  // Test 6: Test with simulated rate limit error
  console.log('\n6. Testing with simulated rate limit error:');
  const rateLimitError = new Error('Rate limited');
  rateLimitError.response = {
    status: 429,
    headers: {
      'retry-after': '5'
    },
    data: 'Too Many Requests'
  };
  
  console.log('Should retry rate limit error:', retryStrategy.shouldRetry(rateLimitError, 0));
  console.log('Delay with retry-after header:', retryStrategy.calculateDelay(1, rateLimitError));
  
  // Test 7: Integration with EnhancedHttpClient
  console.log('\n7. Testing integration with EnhancedHttpClient:');
  
  // Create a mock axios instance that fails with 429 status on first call
  const mockAxios = {
    request: (config) => {
      if (!config.retryAttempt) {
        const error = new Error('Rate limited');
        error.response = {
          status: 429,
          headers: {
            'retry-after': '1'
          },
          data: 'Too Many Requests'
        };
        error.config = config;
        return Promise.reject(error);
      }
      return Promise.resolve({ data: 'Success after retry!' });
    }
  };
  
  // Create a retry interceptor
  const retryInterceptor = retryStrategy.createRetryInterceptor();
  
  // Simulate error handling
  try {
    const error = new Error('Rate limited');
    error.response = {
      status: 429,
      headers: {
        'retry-after': '1'
      },
      data: 'Too Many Requests'
    };
    error.config = {
      method: 'GET',
      url: 'https://api.example.com/test',
      axios: mockAxios
    };
    
    const result = await retryInterceptor.onError(error);
    console.log('Retry interceptor result:', result);
  } catch (error) {
    console.error('Retry interceptor test failed:', error);
  }
  
  console.log('\nRetryStrategy tests completed!');
}

// Run the test
testRetryStrategy().catch(error => {
  console.error('Test failed:', error);
});