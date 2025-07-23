/**
 * @fileoverview
 * Example of integrating ErrorHandler with EnhancedHttpClient
 */

import EnhancedHttpClient from '../EnhancedHttpClient.js';
import ErrorHandler from '../ErrorHandler.js';
import RetryStrategy from '../RetryStrategy.js';
import ErrorDetector from '../ErrorDetector.js';
import RequestFingerprinter from '../RequestFingerprinter.js';

// Create components
const retryStrategy = new RetryStrategy({
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitterFactor: 0.1,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504]
});

const errorDetector = new ErrorDetector({
  detectCloudflare: true,
  detectRateLimit: true,
  detectNetworkIssues: true
});

const errorHandler = new ErrorHandler({
  retryStrategy,
  errorDetector,
  onError: (error) => console.log(`Error occurred: ${error.message}`),
  onRetry: ({ attempt, delay }) => console.log(`Retrying (${attempt}), delay: ${delay}ms`),
  onRecovery: () => console.log('Recovery successful'),
  detailedErrors: true,
  autoRetry: true
});

const requestFingerprinter = new RequestFingerprinter();

// Create enhanced HTTP client
const client = new EnhancedHttpClient({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add interceptors
client.addRequestInterceptor({
  async onRequest(config) {
    // Add browser-like headers to help bypass Cloudflare
    const browserHeaders = requestFingerprinter.generateHeaders();
    return {
      ...config,
      headers: {
        ...config.headers,
        ...browserHeaders
      }
    };
  }
});

client.addErrorInterceptor(errorHandler.createErrorInterceptor());

// Example usage
async function makeApiRequest() {
  try {
    const response = await client.request({
      method: 'GET',
      url: '/api/endpoint',
      params: {
        id: '12345'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('API request failed:', error.message);
    
    if (error.recoveryMessage) {
      console.error('Recovery guidance:', error.recoveryMessage);
    }
    
    // Create detailed error report
    const errorReport = errorHandler.createErrorReport(error);
    console.error('Error Report:', JSON.stringify(errorReport, null, 2));
    
    throw error;
  }
}

// Export for use in other examples
export {
  client,
  errorHandler,
  makeApiRequest
};