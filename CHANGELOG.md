# Changelog

## Version 2.0.0

### Security Enhancement: HMAC Authentication

The SDK has been updated to use HMAC-based authentication instead of Basic Authentication for improved security. This change provides:

- Request signing to prevent request tampering
- Timestamp validation to prevent replay attacks
- More secure credential handling

### Required Changes

1. Update your SDK dependency to version 2.0.0 or later:

```bash
npm install testluy-payment-sdk@latest
```

2. No code changes are required - the SDK handles all authentication changes internally:

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
