/**
 * @fileoverview
 * Test file for enhanced error classes
 */

import { SDKError, RateLimitError, CloudflareError } from './errors/index.js';

// Test SDKError
console.log('Testing SDKError...');
const sdkError = new SDKError('Something went wrong', 'GENERAL_ERROR', { source: 'test' });
console.log(sdkError.toString());
console.log(JSON.stringify(sdkError.toJSON(), null, 2));
console.log('');

// Test SDKError.from
console.log('Testing SDKError.from...');
const originalError = new Error('Original error');
originalError.code = 'ORIGINAL_CODE';
const derivedError = SDKError.from(originalError, 'Derived error', 'DERIVED_CODE', { derived: true });
console.log(derivedError.toString());
console.log(JSON.stringify(derivedError.toJSON(), null, 2));
console.log('');

// Test RateLimitError
console.log('Testing RateLimitError...');
const rateLimitError = new RateLimitError('Rate limit exceeded', {
  retryAfter: 30,
  rateLimitInfo: {
    limit: 100,
    remaining: 0,
    reset: 60
  }
});
console.log(rateLimitError.toString());
console.log(JSON.stringify(rateLimitError.getRetryGuidance(), null, 2));
console.log('');

// Test RateLimitError.fromResponse
console.log('Testing RateLimitError.fromResponse...');
const mockRateLimitResponse = {
  response: {
    status: 429,
    statusText: 'Too Many Requests',
    headers: {
      'retry-after': '60',
      'x-ratelimit-limit': '100',
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': '1625097600'
    },
    data: {
      message: 'API rate limit exceeded',
      error: 'too_many_requests'
    }
  }
};
const rateLimitErrorFromResponse = RateLimitError.fromResponse(mockRateLimitResponse);
console.log(rateLimitErrorFromResponse.toString());
console.log(JSON.stringify(rateLimitErrorFromResponse.getRetryGuidance(), null, 2));
console.log('');

// Test CloudflareError
console.log('Testing CloudflareError...');
const cloudflareError = new CloudflareError('Cloudflare blocked request', {
  challengeType: 'browser_check',
  rayId: '6a8f5f3b9c6d4e3f'
});
console.log(cloudflareError.toString());
console.log(JSON.stringify(cloudflareError.getChallengeGuidance(), null, 2));
console.log('');

// Test CloudflareError.fromResponse
console.log('Testing CloudflareError.fromResponse...');
const mockCloudflareResponse = {
  response: {
    status: 403,
    statusText: 'Forbidden',
    headers: {
      'server': 'cloudflare',
      'cf-ray': '6a8f5f3b9c6d4e3f'
    },
    data: 'Checking your browser before accessing the website. This process is automatic.'
  }
};
const cloudflareErrorFromResponse = CloudflareError.fromResponse(mockCloudflareResponse);
console.log(cloudflareErrorFromResponse.toString());
console.log(JSON.stringify(cloudflareErrorFromResponse.getChallengeGuidance(), null, 2));
console.log('');

console.log('All tests completed!');