/**
 * @fileoverview
 * Setup file for integration tests
 */

import { jest } from '@jest/globals';
import nock from 'nock';

// Test credentials (these are fake and only for testing)
export const TEST_CREDENTIALS = {
  clientId: 'test-client-id',
  secretKey: 'test-secret-key',
  baseUrl: 'https://api-testluy.paragoniu.app'
};

// Helper to create a configured SDK instance
export async function createTestSDK(options = {}) {
  // Dynamic import to avoid issues with Jest module loading
  const { default: TestluyPaymentSDK } = await import('../../index-enhanced.js');

  // Extract testCase if present and pass it to the SDK's httpClient
  const { testCase, ...sdkOptions } = options;

  const sdk = new TestluyPaymentSDK({
    ...TEST_CREDENTIALS,
    ...sdkOptions
  });

  // If a testCase is provided, set it on the SDK's httpClient for testing
  if (testCase) {
    // Set the testCase directly on the SDK instance so it can be accessed by the NodeAdapter
    sdk.testCase = testCase;

    // Also set it on the httpClient if it exists
    if (sdk.httpClient) {
      sdk.httpClient.testCase = testCase;

      // Monkey patch the httpClient's request method to include the testCase
      const originalRequest = sdk.httpClient.request;
      sdk.httpClient.request = function (config) {
        return originalRequest.call(this, {
          ...config,
          testCase: testCase
        });
      };
    }
  }

  return sdk;
}

// Helper to mock Cloudflare challenge response
export function mockCloudflareChallenge(scope) {
  return scope.post(/.*/)
    .reply(403, 'Checking your browser before accessing the site.', {
      'server': 'cloudflare',
      'cf-ray': '12345678abcdef-IAD'
    });
}

// Helper to mock rate limit response
export function mockRateLimit(scope, retryAfter = 60) {
  return scope.post(/.*/)
    .reply(429, { error: 'Too Many Requests' }, {
      'retry-after': retryAfter.toString(),
      'x-ratelimit-limit': '100',
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': Math.floor(Date.now() / 1000 + retryAfter).toString()
    });
}

// Helper to mock successful API responses
export function mockSuccessfulResponse(scope, path, method, responseData) {
  // Special handling for validate-credentials endpoint
  if (path === '/validate-credentials') {
    // Ensure the response has isValid: true for credential validation
    responseData = { isValid: true, ...responseData };
  }

  return scope[method.toLowerCase()](path)
    .reply(200, responseData, {
      'content-type': 'application/json',
      'x-ratelimit-limit': '100',
      'x-ratelimit-remaining': '99',
      'x-ratelimit-reset': Math.floor(Date.now() / 1000 + 3600).toString()
    });
}

// Helper to mock credential validation specifically
export function mockCredentialValidation(scope, isValid = true) {
  return scope.post('/validate-credentials')
    .reply(200, { isValid }, {
      'content-type': 'application/json',
      'x-ratelimit-limit': '100',
      'x-ratelimit-remaining': '99',
      'x-ratelimit-reset': Math.floor(Date.now() / 1000 + 3600).toString()
    });
}

// Setup and teardown for all integration tests
beforeAll(() => {
  // Disable real HTTP requests during tests
  nock.disableNetConnect();

  // Set environment variable to indicate we're in a test environment
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  // Clean up nock
  nock.cleanAll();
  nock.enableNetConnect();

  // Reset environment variable
  delete process.env.NODE_ENV;
});

beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
});