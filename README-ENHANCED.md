# Enhanced TestLuy Payment SDK

This is an enhanced version of the TestLuy Payment SDK with Cloudflare resilience and improved error handling. It's designed to work reliably even when the API is protected by Cloudflare or other anti-bot mechanisms.

## Features

- **Cloudflare Resilience**: Automatically bypasses Cloudflare protection by mimicking legitimate browser traffic
- **Intelligent Retry Logic**: Implements exponential backoff with jitter for transient errors
- **Enhanced Error Handling**: Provides detailed error information and recovery guidance
- **Rate Limit Handling**: Respects rate limits and provides clear guidance on subscription limits
- **Browser Fingerprinting**: Rotates User-Agent strings and adds browser-like headers
- **Advanced Debugging & Monitoring**: Provides detailed performance metrics, troubleshooting suggestions, and diagnostic reports

## Installation

```bash
npm install testluy-payment-sdk
```

## Usage

### Basic Usage

```javascript
import TestluyPaymentSDK from 'testluy-payment-sdk/index-enhanced.js';

// Create SDK instance
const sdk = new TestluyPaymentSDK({
  clientId: 'your-client-id',
  secretKey: 'your-secret-key',
  baseUrl: 'https://api-testluy.paragoniu.app'
});

// Initialize the SDK (validates credentials)
await sdk.init();

// Initiate a payment
const { paymentUrl, transactionId } = await sdk.initiatePayment(
  10.50,
  'https://example.com/callback',
  'https://example.com/back'
);

// Redirect the user to the payment URL
window.location.href = paymentUrl;

// Later, check the payment status
const status = await sdk.getPaymentStatus(transactionId);
console.log('Payment status:', status);
```

### Advanced Configuration

```javascript
const sdk = new TestluyPaymentSDK({
  clientId: 'your-client-id',
  secretKey: 'your-secret-key',
  baseUrl: 'https://api-testluy.paragoniu.app',
  
  // Configure retry behavior
  retryConfig: {
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    jitterFactor: 0.1
  },
  
  // Configure Cloudflare resilience
  cloudflareConfig: {
    enabled: true,
    rotateUserAgent: true,
    addBrowserHeaders: true
  },
  
  // Configure logging
  loggingConfig: {
    level: 'info',              // 'debug', 'info', 'warn', 'error', or 'silent'
    includeHeaders: false,      // Whether to include headers in logs
    includeBody: false,         // Whether to include request/response bodies in logs
    maskSensitive: true,        // Whether to mask sensitive data in logs
    format: 'text',             // 'text' or 'json'
    colorize: true              // Whether to colorize console output
  }
});
```

## Configurable Logger

The enhanced SDK includes a powerful configurable logging system that helps with debugging and monitoring. The logger supports different log levels, sensitive data masking, and structured logging formats.

### Log Levels

- **debug**: Detailed information for debugging purposes
- **info**: General information about application operation
- **warn**: Warning messages that don't prevent operation
- **error**: Error messages that may prevent operation
- **silent**: No logging output

### Using the Logger

```javascript
import logger from 'testluy-payment-sdk/http/Logger.js';

// Log messages at different levels
logger.debug('Detailed debug information', { requestId: '123', params: { amount: 10.50 } });
logger.info('Payment initiated successfully');
logger.warn('API rate limit approaching threshold');
logger.error('Failed to process payment', new Error('Network error'));

// Update logger configuration
logger.updateConfig({
  level: 'debug',
  format: 'json',
  maskSensitive: true,
  includeTimestamp: true
});

// Create a child logger for a specific component
const paymentLogger = logger.createChild({ level: 'info' }, 'PaymentProcessor');
paymentLogger.info('Processing payment'); // Will log with [PaymentProcessor] prefix
```

### Sensitive Data Masking

The logger automatically masks sensitive data in objects:

```javascript
const userData = {
  username: 'testuser',
  password: 'secret123',
  apiKey: '1234567890abcdef'
};

logger.debug('User data:', userData);
// The password and apiKey will be masked in the output
```

### Structured Logging

The logger supports both text and JSON formats:

```javascript
// Text format (default)
logger.updateConfig({ format: 'text' });
logger.info('Payment processed', { amount: 10.50, status: 'success' });
// Output: [2023-07-16T12:34:56.789Z] [INFO] [TestluyPaymentSDK] Payment processed { amount: 10.50, status: 'success' }

// JSON format
logger.updateConfig({ format: 'json' });
logger.info('Payment processed', { amount: 10.50, status: 'success' });
// Output: {"level":"INFO","service":"TestluyPaymentSDK","timestamp":"2023-07-16T12:34:56.789Z","message":"Payment processed","data":{"amount":10.50,"status":"success"}}
```

### Testing the Logger

You can run the logger test script to see the logger in action:

```bash
node test-logger.js
```

## Error Handling

The enhanced SDK provides detailed error information and recovery guidance:

```javascript
try {
  const { paymentUrl, transactionId } = await sdk.initiatePayment(
    10.50,
    'https://example.com/callback'
  );
} catch (error) {
  if (error.isRateLimitError) {
    console.error('Rate limit exceeded:', error.message);
    console.log('Retry after:', error.retryAfter, 'seconds');
    console.log('Rate limit info:', error.rateLimitInfo);
  } else if (error.isCloudflareError) {
    console.error('Cloudflare protection encountered:', error.message);
    console.log('Challenge type:', error.challengeType);
  } else {
    console.error('Payment error:', error.message);
  }
}
```

## Environment Variables

You can configure the SDK using environment variables:

- `TESTLUY_CLIENT_ID`: Your TestLuy client ID
- `TESTLUY_SECRET_KEY`: Your TestLuy secret key
- `TESTLUY_BASE_URL`: The base URL for the TestLuy API
- `TESTLUY_MAX_RETRIES`: Maximum number of retry attempts
- `TESTLUY_BASE_DELAY`: Base delay in milliseconds before retrying
- `TESTLUY_MAX_DELAY`: Maximum delay between retries
- `TESTLUY_BACKOFF_FACTOR`: Factor by which to increase delay on each retry
- `TESTLUY_JITTER_FACTOR`: Random jitter factor to add to delay

## Testing

To run the test script:

1. Create a `.env` file with your credentials:

```
TESTLUY_CLIENT_ID=your-client-id
TESTLUY_SECRET_KEY=your-secret-key
TESTLUY_BASE_URL=https://api-testluy.paragoniu.app
```

2. Run the test script:

```bash
node test-enhanced.js
```

## Debugging and Monitoring Features

The enhanced SDK includes advanced debugging and monitoring capabilities to help you troubleshoot issues, track performance, and optimize your integration.

### Performance Metrics Tracking

Track detailed performance metrics for all API requests:

```javascript
// Enable metrics tracking
sdk.setMetricsEnabled(true);

// Make some API calls
await sdk.initiatePayment(10.50, 'https://example.com/callback');

// Get performance metrics
const metrics = sdk.getPerformanceMetrics();
console.log(`Success rate: ${metrics.requests.successful}/${metrics.requests.total}`);
console.log(`Average response time: ${metrics.performance.averageResponseTime}ms`);

// Log metrics summary to console
sdk.logMetricsSummary();
```

### Troubleshooting Suggestions

Get intelligent troubleshooting suggestions based on observed issues:

```javascript
// Get troubleshooting suggestions
const suggestions = sdk.getTroubleshootingSuggestions();
suggestions.forEach(suggestion => {
  console.log(`[${suggestion.priority}] ${suggestion.issue}: ${suggestion.suggestion}`);
});

// Log suggestions to console
sdk.logTroubleshootingSuggestions();
```

### Diagnostic Reports

Generate comprehensive diagnostic reports for debugging:

```javascript
// Generate a diagnostic report
const report = sdk.generateDiagnosticReport();
console.log('Health status:', report.summary.healthStatus);
console.log('Success rate:', report.summary.successRate);
console.log('Average response time:', report.summary.averageResponseTime);

// Log full diagnostic report to console
sdk.logDiagnosticReport();
```

### Advanced Debugging

Enable advanced debugging features for detailed troubleshooting:

```javascript
// Enable advanced debugging with detailed options
sdk.enableDebugging({
  trackPerformance: true,    // Track detailed performance metrics
  logRequests: true,         // Log all requests and responses
  includeHeaders: true,      // Include headers in logs
  includeBody: false         // Don't include request/response bodies
});

// Make some API calls
await sdk.initiatePayment(10.50, 'https://example.com/callback');

// Get advanced metrics with endpoint-specific data
const advancedMetrics = sdk.getAdvancedMetrics();
console.log('Slowest endpoint:', advancedMetrics.timings.byEndpoint);

// Get advanced troubleshooting suggestions
const advancedSuggestions = sdk.getAdvancedTroubleshootingSuggestions();

// Generate comprehensive diagnostic report
const advancedReport = sdk.generateAdvancedDiagnosticReport();
console.log('Health status:', advancedReport.summary.healthStatus);
console.log('Slowest endpoint:', advancedReport.summary.slowestEndpoint);

// Disable advanced debugging when done
sdk.disableDebugging();
```

### Configuring Debugging and Monitoring

You can configure debugging and monitoring features when initializing the SDK:

```javascript
const sdk = new TestluyPaymentSDK({
  clientId: 'your-client-id',
  secretKey: 'your-secret-key',
  baseUrl: 'https://api-testluy.paragoniu.app',
  
  // Configure logging and debugging
  loggingConfig: {
    level: 'debug',           // Enable detailed logging
    includeHeaders: true,     // Include headers in logs
    includeBody: false,       // Don't include request/response bodies
    maskSensitive: true,      // Mask sensitive data in logs
    enableMetrics: true       // Enable performance metrics tracking
  }
});
```

Or update the configuration later:

```javascript
// Update logging configuration
sdk.updateLoggingConfig({
  level: 'debug',
  includeHeaders: true,
  enableMetrics: true
});
```

### Testing Debugging Features

You can run the debugging and monitoring test script to see these features in action:

```bash
node test-debugging-monitoring.js
```

## Migrating from the Standard SDK

To migrate from the standard SDK to the enhanced version:

1. Update your import statement:

```javascript
// Before
import TestluyPaymentSDK from 'testluy-payment-sdk';

// After
import TestluyPaymentSDK from 'testluy-payment-sdk/index-enhanced.js';
```

2. The API is fully compatible, so no other changes are needed.

## License

MIT