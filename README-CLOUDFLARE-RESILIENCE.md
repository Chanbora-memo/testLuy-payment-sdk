# TestLuy Payment SDK - Cloudflare Resilience

This document explains the Cloudflare resilience features implemented in the TestLuy Payment SDK to help bypass Cloudflare protection and ensure reliable API communication.

## Overview

The SDK includes several features to make HTTP requests appear more like legitimate browser traffic, implement intelligent retry mechanisms, and provide comprehensive error handling for Cloudflare-related issues.

## Features

### Browser-like Request Fingerprinting

The SDK automatically adds browser-like headers to all requests:

- Realistic User-Agent rotation
- Proper Accept and Accept-Language headers
- Sec-Fetch headers for modern browsers
- Cache-Control and Pragma headers
- Cookie handling

### Timing Variation

To avoid pattern detection:

- Random delays between requests
- Jitter added to retry intervals
- Non-predictable request patterns

### Intelligent Retry Mechanisms

When encountering Cloudflare challenges or rate limiting:

- Exponential backoff with jitter
- Smart detection of Cloudflare challenges
- Automatic retry with appropriate delays
- Configurable retry policies

### Comprehensive Error Handling

Detailed error information for debugging:

- Specific CloudflareError type with challenge information
- RateLimitError with retry guidance
- Detailed error messages and troubleshooting suggestions

## Configuration

Cloudflare resilience features are **enabled by default** with the following settings:

```javascript
// Default Cloudflare resilience configuration
cloudflareConfig: {
  enabled: true,
  rotateUserAgent: true,
  addBrowserHeaders: true,
  addTimingVariation: true
}
```

You can customize these settings when initializing the SDK:

```javascript
const sdk = new TestluyPaymentSDK({
  clientId: 'your-client-id',
  secretKey: 'your-secret-key',
  baseUrl: 'https://api-testluy.paragoniu.app',
  
  // Optional: customize Cloudflare resilience settings
  cloudflareConfig: {
    enabled: true,                // Enable/disable all Cloudflare resilience features
    rotateUserAgent: true,        // Rotate User-Agent headers
    addBrowserHeaders: true,      // Add browser-like headers
    addTimingVariation: true      // Add random timing variations
  }
});
```

## Retry Configuration

You can also customize the retry behavior:

```javascript
const sdk = new TestluyPaymentSDK({
  clientId: 'your-client-id',
  secretKey: 'your-secret-key',
  baseUrl: 'https://api-testluy.paragoniu.app',
  
  // Optional: customize retry behavior
  retryConfig: {
    maxRetries: 3,           // Maximum number of retry attempts
    baseDelay: 1000,         // Initial delay in milliseconds before first retry
    maxDelay: 10000,         // Maximum delay in milliseconds between retries
    backoffFactor: 2,        // Factor by which to increase delay on each retry
    jitterFactor: 0.1        // Random jitter factor to add to delay
  }
});
```

## Troubleshooting

If you're still experiencing Cloudflare blocking issues:

1. Enable debug logging to see detailed request/response information:
   ```javascript
   const sdk = new TestluyPaymentSDK({
     // ... other options
     loggingConfig: {
       level: 'debug',
       includeHeaders: true
     }
   });
   ```

2. Use the diagnostic tools to identify issues:
   ```javascript
   // Get troubleshooting suggestions
   const suggestions = sdk.getTroubleshootingSuggestions();
   
   // Generate a comprehensive diagnostic report
   const report = sdk.generateDiagnosticReport();
   ```

3. Check if your IP address is being blocked by Cloudflare (you may need to use a different IP or proxy).

4. Ensure you're using the latest version of the SDK.

## Best Practices

1. Always use the standardized base URL: `https://api-testluy.paragoniu.app`
2. Keep Cloudflare resilience features enabled
3. Use appropriate retry configurations based on your use case
4. Handle errors gracefully in your application
5. Monitor rate limiting information to avoid hitting limits