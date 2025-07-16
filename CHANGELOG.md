# Changelog

## Version 3.3.0 (Latest)

### Multi-Domain Support

The SDK now automatically handles different API base URLs:

- **Automatic Path Detection**: SDK automatically detects the correct API path based on the base URL
- **ParagonIU Domain Support**: When using `api-testluy.paragoniu.app`, the SDK correctly omits the `/api/` prefix
- **Testluy.tech Domain Support**: When using `testluy.tech`, the SDK includes the `/api/` prefix as expected
- **Backward Compatibility**: All existing code continues to work without changes

### How to Use

Simply configure your base URL and the SDK handles the rest:

```javascript
// For ParagonIU deployment (no /api prefix needed)
const sdk = new TestluyPaymentSDK({
  clientId: 'your-client-id',
  secretKey: 'your-secret-key',
  baseUrl: 'https://api-testluy.paragoniu.app'
});

// For standard deployment (includes /api prefix)
const sdk = new TestluyPaymentSDK({
  clientId: 'your-client-id', 
  secretKey: 'your-secret-key',
  baseUrl: 'https://testluy.tech'
});
```

## Version 3.1.0

### Rate Limiting Support

The SDK has been updated to handle rate limiting with automatic retries:

- Automatic retry with exponential backoff for rate-limited requests
- Configurable retry parameters (max retries, delays, backoff factor)
- Detailed rate limit information in error objects
- Support for different rate limits based on subscription tiers

### How to Use

1. Update your SDK dependency to version 3.1.0 or later:

```bash
npm install testluy-payment-sdk@latest
```

1. No code changes are required for basic functionality - the SDK handles rate limiting automatically.

1. Optional: Configure retry behavior in the SDK options:

```javascript
const sdk = new TestluyPaymentSDK({
  clientId: 'your_client_id',
  secretKey: 'your_secret_key',
  baseUrl: 'your_base_url',
  retryConfig: {
    maxRetries: 3,              // Default: 3
    initialDelayMs: 1000,       // Default: 1000 (1 second)
    maxDelayMs: 10000,          // Default: 10000 (10 seconds)
    backoffFactor: 2            // Default: 2
  }
});
```

## Version 2.0.0

### Security Enhancement: HMAC Authentication

The SDK has been updated to use HMAC-based authentication instead of Basic Authentication for improved security. This change provides:

- Request signing to prevent request tampering
- Timestamp validation to prevent replay attacks
- More secure credential handling

### Migration Guide

1. Update your SDK dependency to version 2.0.0 or later:

```bash
npm install testluy-payment-sdk@latest
```

1. No code changes are required - the SDK handles all authentication changes internally:

```javascript
const sdk = new TestluyPaymentSDK({\n  clientId: 'your_client_id',\n  secretKey: 'your_secret_key'\n});
```

### Breaking Changes

- Removed Basic Authentication headers
- Added HMAC signature verification
- Added request timestamp validation (requests must be within 5 minutes of server time)

### Security Benefits

1. **Improved Security**: HMAC signatures ensure request integrity and authenticity
2. **No Exposed Credentials**: Credentials**Replay Protection**: Timestamp validation prevents replay attacks
3. **No Exposed Credentials**: Credentials are never sent directly in requests
4. **Request Integrity**: All requests are signed to prevent tampering

### Compatibility

The SDK maintains backward compatibility with all existing methods:

- `generatePaymentUrl()`
- `getPaymentStatus()`
- `validateCredentials()`
- `initiatePaymentFlow()`
- `handlePaymentCallback()`

Only the authentication mechanism has changed; all method signatures remain the same.
