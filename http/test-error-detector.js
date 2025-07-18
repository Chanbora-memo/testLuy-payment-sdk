/**
 * @fileoverview
 * Test file for the ErrorDetector class
 */

import ErrorDetector, { ErrorType } from './ErrorDetector.js';
import EnhancedHttpClient from './EnhancedHttpClient.js';

/**
 * Test the ErrorDetector class
 */
async function testErrorDetector() {
  console.log('Testing ErrorDetector...');
  
  // Create a new ErrorDetector instance
  const errorDetector = new ErrorDetector();
  
  // Test 1: Network error detection
  console.log('\n1. Testing network error detection:');
  const networkError = new Error('Network Error');
  networkError.request = {}; // Axios sets this for network errors
  
  const networkErrorResult = errorDetector.detectErrorType(networkError);
  console.log('Network error detection result:', networkErrorResult);
  
  // Test 2: Timeout error detection
  console.log('\n2. Testing timeout error detection:');
  const timeoutError = new Error('timeout of 1000ms exceeded');
  timeoutError.code = 'ECONNABORTED';
  timeoutError.request = {};
  
  const timeoutErrorResult = errorDetector.detectErrorType(timeoutError);
  console.log('Timeout error detection result:', timeoutErrorResult);
  
  // Test 3: Cloudflare error detection
  console.log('\n3. Testing Cloudflare error detection:');
  const cloudflareError = new Error('Forbidden');
  cloudflareError.response = {
    status: 403,
    headers: {
      server: 'cloudflare',
      'cf-ray': '123456789abcdef'
    },
    data: 'Checking your browser before accessing the website...'
  };
  
  const cloudflareErrorResult = errorDetector.detectErrorType(cloudflareError);
  console.log('Cloudflare error detection result:', cloudflareErrorResult);
  
  // Test 4: Rate limit error detection
  console.log('\n4. Testing rate limit error detection:');
  const rateLimitError = new Error('Too Many Requests');
  rateLimitError.response = {
    status: 429,
    headers: {
      'retry-after': '5',
      'x-ratelimit-limit': '100',
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': '1619712000'
    },
    data: {
      message: 'Rate limit exceeded. Please try again later.'
    }
  };
  
  const rateLimitErrorResult = errorDetector.detectErrorType(rateLimitError);
  console.log('Rate limit error detection result:', rateLimitErrorResult);
  
  // Test 5: Authentication error detection
  console.log('\n5. Testing authentication error detection:');
  const authError = new Error('Unauthorized');
  authError.response = {
    status: 401,
    statusText: 'Unauthorized',
    data: {
      message: 'Invalid API key'
    }
  };
  
  const authErrorResult = errorDetector.detectErrorType(authError);
  console.log('Authentication error detection result:', authErrorResult);
  
  // Test 6: Validation error detection
  console.log('\n6. Testing validation error detection:');
  const validationError = new Error('Unprocessable Entity');
  validationError.response = {
    status: 422,
    statusText: 'Unprocessable Entity',
    data: {
      message: 'Validation failed',
      errors: {
        email: ['The email field is required.'],
        amount: ['The amount must be greater than 0.']
      }
    }
  };
  
  const validationErrorResult = errorDetector.detectErrorType(validationError);
  console.log('Validation error detection result:', validationErrorResult);
  
  // Test 7: Server error detection
  console.log('\n7. Testing server error detection:');
  const serverError = new Error('Internal Server Error');
  serverError.response = {
    status: 500,
    statusText: 'Internal Server Error',
    data: {
      message: 'An unexpected error occurred'
    }
  };
  
  const serverErrorResult = errorDetector.detectErrorType(serverError);
  console.log('Server error detection result:', serverErrorResult);
  
  // Test 8: Custom error detector
  console.log('\n8. Testing custom error detector:');
  const customDetector = new ErrorDetector({
    customDetectors: {
      'payment_failed': (error) => {
        if (error.response && 
            error.response.status === 400 && 
            error.response.data && 
            error.response.data.code === 'payment_failed') {
          return {
            retryable: false,
            details: {
              paymentId: error.response.data.payment_id,
              reason: error.response.data.reason
            }
          };
        }
        return null;
      }
    }
  });
  
  const paymentError = new Error('Payment Failed');
  paymentError.response = {
    status: 400,
    data: {
      code: 'payment_failed',
      message: 'Payment processing failed',
      payment_id: '123456',
      reason: 'insufficient_funds'
    }
  };
  
  const paymentErrorResult = customDetector.detectErrorType(paymentError);
  console.log('Custom payment error detection result:', paymentErrorResult);
  
  // Test 9: Integration with EnhancedHttpClient
  console.log('\n9. Testing integration with EnhancedHttpClient:');
  
  // Create a client
  const client = new EnhancedHttpClient({
    baseUrl: 'https://jsonplaceholder.typicode.com',
    timeout: 5000
  });
  
  // Add the error detector interceptor
  const errorInterceptor = errorDetector.createErrorInterceptor();
  client.addErrorInterceptor(errorInterceptor);
  
  // Make a request to a non-existent endpoint to trigger an error
  try {
    await client.get('/non-existent-endpoint');
  } catch (error) {
    console.log('Error type:', error.errorType);
    console.log('Retryable:', error.retryable);
    console.log('Error details:', error.errorDetails);
  }
  
  console.log('\nErrorDetector tests completed!');
}

// Run the test
testErrorDetector().catch(error => {
  console.error('Test failed:', error);
});