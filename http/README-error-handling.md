# Error Handling System

The TestLuy Payment SDK includes a comprehensive error handling system that provides detailed error information, automatic recovery strategies, and intelligent retry mechanisms.

## Components

### ErrorHandler

The `ErrorHandler` class is the main entry point for error handling. It provides:

- Error classification and detection
- Automatic recovery strategies based on error type
- Intelligent retry mechanisms with exponential backoff
- Detailed error reporting for debugging
- Integration with EnhancedHttpClient through interceptors

### Error Classes

- `SDKError`: Base error class with enhanced information
- `RateLimitError`: Specialized error for rate limiting with retry guidance
- `CloudflareError`: Specialized error for Cloudflare challenges with handling guidance

### ErrorDetector

The `ErrorDetector` class analyzes errors and classifies them into specific types:

- Network errors (connection issues, DNS failures)
- Timeout errors
- Cloudflare errors (bot detection, challenges)
- Rate limit errors
- Authentication errors
- Validation errors
- Server errors
- Client errors

### RetryStrategy

The `RetryStrategy` class implements intelligent retry mechanisms:

- Exponential backoff with jitter
- Error-specific retry policies
- Configurable retry limits and delays

## Usage Examples

### Basic Error Handling

```javascript
import { ErrorHandler } from 'testluy-payment-sdk/http';

const errorHandler = new ErrorHandler();

try {
  // Make API request
} catch (error) {
  try {
    // Attempt recovery
    const result = await errorHandler.handleError(error);
    return result;
  } catch (enhancedError) {
    // Recovery failed, handle the enhanced error
    console.error(enhancedError.message);
    if (enhancedError.recoveryMessage) {
      console.error('Recovery guidance:', enhancedError.recoveryMessage);
    }
    throw enhancedError;
  }
}
```

### Custom Configuration

```javascript
import { ErrorHandler, RetryStrategy, ErrorDetector } from 'testluy-payment-sdk/http';

const retryStrategy = new RetryStrategy({
  maxRetries: 5,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitterFactor: 0.1
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
```

### Integration with EnhancedHttpClient

```javascript
import { EnhancedHttpClient, ErrorHandler } from 'testluy-payment-sdk/http';

const errorHandler = new ErrorHandler();
const client = new EnhancedHttpClient({
  baseURL: 'https://api.example.com',
  timeout: 10000
});

// Add error interceptor
client.addErrorInterceptor(errorHandler.createErrorInterceptor());

// Make requests with automatic error handling
const response = await client.request({
  method: 'GET',
  url: '/endpoint'
});
```

### Error Reporting

```javascript
import { ErrorHandler } from 'testluy-payment-sdk/http';

const errorHandler = new ErrorHandler();

try {
  // Make API request
} catch (error) {
  // Create detailed error report for debugging
  const errorReport = errorHandler.createErrorReport(error);
  console.error('Error Report:', JSON.stringify(errorReport, null, 2));
  
  // Send error report to monitoring system
  await sendToMonitoring(errorReport);
}
```

## Recovery Strategies

The ErrorHandler implements different recovery strategies based on the error type:

### Network Errors

- Automatic retry with exponential backoff
- Connection reset errors are retried with increased delays
- DNS errors are not retried (permanent failure)

### Timeout Errors

- Automatic retry with increased timeout values
- Exponential backoff between retries

### Cloudflare Errors

- Browser fingerprinting enhancement for retries
- User-Agent rotation
- Addition of browser-like headers
- Different retry strategies based on challenge type

### Rate Limit Errors

- Respect of Retry-After headers
- Intelligent backoff based on rate limit reset times
- Guidance on subscription limits and upgrade options

### Server Errors (5xx)

- Automatic retry with exponential backoff
- Detailed error reporting

### Client Errors (4xx)

- No automatic retry (client-side issue)
- Detailed validation error reporting
- Authentication guidance

## Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `retryStrategy` | RetryStrategy instance | New RetryStrategy() |
| `errorDetector` | ErrorDetector instance | New ErrorDetector() |
| `onError` | Callback when error occurs | null |
| `onRetry` | Callback before retry attempt | null |
| `onRecovery` | Callback when recovery succeeds | null |
| `detailedErrors` | Include detailed error info | true |
| `autoRetry` | Automatically retry failures | true |

## Best Practices

1. **Always use try/catch blocks** around API requests to handle errors gracefully
2. **Provide user-friendly error messages** based on error types
3. **Log detailed error reports** for debugging but mask sensitive information
4. **Configure retry policies** appropriate for your use case
5. **Handle non-retryable errors** with appropriate user guidance
6. **Monitor retry attempts** to identify recurring issues