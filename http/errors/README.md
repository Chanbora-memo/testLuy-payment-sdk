# Enhanced Error Classes

This directory contains enhanced error classes for the TestLuy Payment SDK that provide detailed information and handling guidance for different types of errors.

## Available Error Classes

### SDKError

Base error class for all SDK errors with enhanced information and standardized structure.

```javascript
import { SDKError } from './errors/index.js';

// Create a new SDKError
const error = new SDKError('Something went wrong', 'GENERAL_ERROR', { source: 'api' });

// Create from an existing error
const derivedError = SDKError.from(originalError, 'Derived error', 'DERIVED_CODE', { derived: true });
```

### RateLimitError

Specialized error class for rate limiting errors with retry guidance and quota information.

```javascript
import { RateLimitError } from './errors/index.js';

// Create from an HTTP response
try {
  // Make API request
} catch (error) {
  if (error.response && error.response.status === 429) {
    const rateLimitError = RateLimitError.fromResponse(error);
    const guidance = rateLimitError.getRetryGuidance();
    console.log(`Retry after ${guidance.retryAfter} seconds. ${guidance.recommendedAction}`);
  }
}
```

### CloudflareError

Specialized error class for Cloudflare-related errors with challenge detection and handling guidance.

```javascript
import { CloudflareError } from './errors/index.js';

// Create from an HTTP response
try {
  // Make API request
} catch (error) {
  if (CloudflareError.isCloudflareError(error)) {
    const cloudflareError = CloudflareError.fromResponse(error);
    const guidance = cloudflareError.getChallengeGuidance();
    console.log(`Challenge type: ${guidance.challengeType}. ${guidance.recommendedAction}`);
  }
}
```

## Error Handling Best Practices

1. **Use try/catch blocks** around API requests to catch and handle errors
2. **Check error types** to provide specific handling for different error scenarios
3. **Follow retry guidance** for retryable errors like rate limits
4. **Log error details** for debugging but mask sensitive information
5. **Provide user-friendly error messages** based on error types

## Example Usage

```javascript
import { SDKError, RateLimitError, CloudflareError } from './errors/index.js';

async function makeApiRequest() {
  try {
    // Make API request
    const response = await client.request({
      method: 'GET',
      url: '/api/endpoint'
    });
    return response.data;
  } catch (error) {
    // Check for specific error types
    if (error instanceof RateLimitError) {
      const guidance = error.getRetryGuidance();
      console.log(`Rate limited: ${guidance.recommendedAction}`);
      // Implement retry logic or inform user
    } else if (error instanceof CloudflareError) {
      const guidance = error.getChallengeGuidance();
      console.log(`Cloudflare blocked: ${guidance.recommendedAction}`);
      // Handle Cloudflare challenge
    } else if (error instanceof SDKError) {
      console.log(`SDK error: ${error.message} (${error.code})`);
      // Handle general SDK error
    } else {
      console.log(`Unknown error: ${error.message}`);
      // Handle unknown error
    }
    throw error; // Re-throw or handle as needed
  }
}
```