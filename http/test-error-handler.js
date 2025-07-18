/**
 * @fileoverview
 * Test file for ErrorHandler
 */

import ErrorHandler from './ErrorHandler.js';
import RetryStrategy from './RetryStrategy.js';
import ErrorDetector from './ErrorDetector.js';
import { SDKError, RateLimitError, CloudflareError } from './errors/index.js';

// Create instances
const retryStrategy = new RetryStrategy({
  maxRetries: 3,
  baseDelay: 100, // Small delay for testing
  jitterFactor: 0
});

const errorDetector = new ErrorDetector();

const errorHandler = new ErrorHandler({
  retryStrategy,
  errorDetector,
  onError: (error) => console.log(`Error occurred: ${error.message}`),
  onRetry: ({ attempt, delay }) => console.log(`Retrying (${attempt}), delay: ${delay}ms`),
  onRecovery: () => console.log('Recovery successful')
});

// Test functions
async function testNetworkError() {
  console.log('\n--- Testing Network Error ---');
  
  const error = new Error('Network Error');
  error.code = 'ECONNRESET';
  error.config = {
    url: 'https://api.example.com/test',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer secret-token',
      'Content-Type': 'application/json'
    },
    axios: {
      request: async () => {
        console.log('Retry request executed');
        return { data: { success: true } };
      }
    }
  };
  
  try {
    const result = await errorHandler.handleError(error);
    console.log('Recovery result:', result);
  } catch (e) {
    console.log('Error handling failed:', e.message);
    if (e.recoveryMessage) {
      console.log('Recovery message:', e.recoveryMessage);
    }
  }
}

async function testRateLimitError() {
  console.log('\n--- Testing Rate Limit Error ---');
  
  const error = new Error('Too Many Requests');
  error.response = {
    status: 429,
    statusText: 'Too Many Requests',
    headers: {
      'retry-after': '2',
      'x-ratelimit-limit': '100',
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': '60'
    },
    data: {
      message: 'API rate limit exceeded',
      error: 'too_many_requests'
    }
  };
  error.config = {
    url: 'https://api.example.com/test',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer secret-token',
      'Content-Type': 'application/json'
    },
    axios: {
      request: async () => {
        console.log('Retry request executed');
        return { data: { success: true } };
      }
    }
  };
  
  try {
    const result = await errorHandler.handleError(error);
    console.log('Recovery result:', result);
  } catch (e) {
    console.log('Error handling failed:', e.message);
    if (e.recoveryMessage) {
      console.log('Recovery message:', e.recoveryMessage);
    }
    
    // Test the error report
    console.log('\nError Report:');
    console.log(JSON.stringify(errorHandler.createErrorReport(e), null, 2));
  }
}

async function testCloudflareError() {
  console.log('\n--- Testing Cloudflare Error ---');
  
  const error = new Error('Forbidden');
  error.response = {
    status: 403,
    statusText: 'Forbidden',
    headers: {
      'server': 'cloudflare',
      'cf-ray': '6a8f5f3b9c6d4e3f'
    },
    data: 'Checking your browser before accessing the website. This process is automatic.'
  };
  error.config = {
    url: 'https://api.example.com/test',
    method: 'GET',
    headers: {
      'User-Agent': 'TestLuy SDK/1.0',
      'Content-Type': 'application/json'
    },
    axios: {
      request: async () => {
        console.log('Retry request executed');
        return { data: { success: true } };
      }
    }
  };
  
  try {
    const result = await errorHandler.handleError(error);
    console.log('Recovery result:', result);
  } catch (e) {
    console.log('Error handling failed:', e.message);
    if (e.recoveryMessage) {
      console.log('Recovery message:', e.recoveryMessage);
    }
  }
}

async function testValidationError() {
  console.log('\n--- Testing Validation Error ---');
  
  const error = new Error('Validation Failed');
  error.response = {
    status: 422,
    statusText: 'Unprocessable Entity',
    data: {
      message: 'Validation failed',
      errors: {
        amount: ['Amount must be greater than 0'],
        currency: ['Currency is required']
      }
    }
  };
  
  try {
    const result = await errorHandler.handleError(error);
    console.log('Recovery result:', result);
  } catch (e) {
    console.log('Error handling failed:', e.message);
    if (e.recoveryMessage) {
      console.log('Recovery message:', e.recoveryMessage);
    }
  }
}

async function testMaxRetries() {
  console.log('\n--- Testing Max Retries ---');
  
  const error = new Error('Server Error');
  error.response = {
    status: 500,
    statusText: 'Internal Server Error',
    data: 'Server Error'
  };
  error.config = {
    url: 'https://api.example.com/test',
    method: 'GET',
    retryAttempt: 3, // Already at max retries
    axios: {
      request: async () => {
        console.log('Retry request executed');
        return { data: { success: true } };
      }
    }
  };
  
  try {
    const result = await errorHandler.handleError(error);
    console.log('Recovery result:', result);
  } catch (e) {
    console.log('Error handling failed:', e.message);
    if (e.recoveryMessage) {
      console.log('Recovery message:', e.recoveryMessage);
    }
  }
}

async function testErrorInterceptor() {
  console.log('\n--- Testing Error Interceptor ---');
  
  const interceptor = errorHandler.createErrorInterceptor();
  
  const error = new Error('Network Error');
  error.code = 'ECONNRESET';
  error.config = {
    url: 'https://api.example.com/test',
    method: 'GET',
    axios: {
      request: async () => {
        console.log('Interceptor retry executed');
        return { data: { success: true } };
      }
    }
  };
  
  try {
    const result = await interceptor.onError(error);
    console.log('Interceptor result:', result);
  } catch (e) {
    console.log('Interceptor error:', e.message);
    if (e.recoveryMessage) {
      console.log('Recovery message:', e.recoveryMessage);
    }
  }
}

// Run tests
async function runTests() {
  try {
    await testNetworkError();
    await testRateLimitError();
    await testCloudflareError();
    await testValidationError();
    await testMaxRetries();
    await testErrorInterceptor();
    
    console.log('\nAll tests completed!');
  } catch (error) {
    console.error('Test runner error:', error);
  }
}

runTests();