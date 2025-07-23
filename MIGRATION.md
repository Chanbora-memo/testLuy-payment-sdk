# Migration Guide

This guide helps you migrate from older versions of the TestLuy Payment SDK to the latest version with Cloudflare Tunnel Zero Trust support.

## Version 3.8.x Migration

### Breaking Changes

The enhanced SDK (v3.8.x) introduces several improvements while maintaining backward compatibility for most use cases.

### Key Changes

1. **Enhanced Main Entry Point**
2. **Automatic Environment Detection**
3. **Cloudflare Tunnel Zero Trust Support**
4. **Improved Error Handling**
5. **Configurable Logging**

## Migration Steps

### Step 1: Update Package

```bash
npm update testluy-payment-sdk@latest
```

### Step 2: Update Import (Optional)

While the default import still works, you can explicitly use the enhanced version:

```javascript
// Before (still works)
import TestluyPaymentSDK from 'testluy-payment-sdk';

// After (recommended for new projects)
import TestluyPaymentSDK from 'testluy-payment-sdk/index-enhanced.js';
```

### Step 3: Update Configuration

#### Before (v3.7.x and earlier)

```javascript
const sdk = new TestluyPaymentSDK({
  clientId: process.env.TESTLUY_CLIENT_ID,
  secretKey: process.env.TESTLUY_SECRET_KEY,
  baseUrl: process.env.TESTLUY_BASE_URL,
  retryConfig: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffFactor: 2
  }
});
```

#### After (v3.8.x)

```javascript
const sdk = new TestluyPaymentSDK({
  clientId: process.env.TESTLUY_CLIENT_ID,
  secretKey: process.env.TESTLUY_SECRET_KEY,
  baseUrl: process.env.TESTLUY_BASE_URL,
  
  // Enhanced retry configuration
  retryConfig: {
    maxRetries: 3,
    baseDelay: 1000,        // renamed from initialDelayMs
    maxDelay: 10000,        // renamed from maxDelayMs
    backoffFactor: 2,
    jitterFactor: 0.1       // new option
  },
  
  // New options
  enableSmartRouting: true,   // automatic environment detection
  cloudflareConfig: {
    enabled: true,
    rotateUserAgent: true,
    addBrowserHeaders: true
  },
  loggingConfig: {
    level: 'info',
    maskSensitive: true
  }
});
```

### Step 4: Update Error Handling

#### Before

```javascript
try {
  const result = await sdk.initiatePayment(amount, callbackUrl);
} catch (error) {
  console.error('Payment failed:', error.message);
  
  if (error.message.includes('Rate limit')) {
    // Handle rate limiting
  }
}
```

#### After

```javascript
import { RateLimitError, CloudflareError, ValidationError } from 'testluy-payment-sdk';

try {
  const result = await sdk.initiatePayment(amount, callbackUrl);
} catch (error) {
  if (error instanceof RateLimitError) {
    console.error('Rate limited:', {
      subscription: error.subscription,
      retryAfter: error.retryAfter,
      upgradeInfo: error.upgradeInfo
    });
  } else if (error instanceof CloudflareError) {
    console.error('Cloudflare protection:', error.challengeType);
  } else if (error instanceof ValidationError) {
    console.error('Validation failed:', error.validationDetails);
  } else {
    console.error('Payment failed:', error.message);
  }
}
```

## Configuration Migration Reference

### Retry Configuration

| Old Property | New Property | Notes |
|--------------|--------------|-------|
| `initialDelayMs` | `baseDelay` | Same functionality, renamed |
| `maxDelayMs` | `maxDelay` | Same functionality, renamed |
| `backoffFactor` | `backoffFactor` | No change |
| N/A | `jitterFactor` | New: adds random jitter (0-1) |

### New Configuration Options

#### Smart Routing (New)
```javascript
{
  enableSmartRouting: true,  // Automatic endpoint selection
  bypassUrl: 'https://alt-endpoint.example.com'  // Optional bypass endpoint
}
```

#### Cloudflare Configuration (New)
```javascript
{
  cloudflareConfig: {
    enabled: true,           // Auto-enabled for deployment environments
    rotateUserAgent: true,   // Rotate User-Agent headers
    addBrowserHeaders: true  // Add browser-like headers
  }
}
```

#### Logging Configuration (New)
```javascript
{
  loggingConfig: {
    level: 'info',           // 'debug', 'info', 'warn', 'error', 'silent'
    includeHeaders: false,   // Include HTTP headers in logs
    includeBody: false,      // Include request/response bodies
    maskSensitive: true,     // Mask sensitive data
    format: 'text',          // 'text' or 'json'
    colorize: true           // Colorize console output
  }
}
```

## Platform-Specific Migration

### Next.js Projects

#### Before
```javascript
// pages/api/payment.js
import TestluyPaymentSDK from 'testluy-payment-sdk';

const sdk = new TestluyPaymentSDK({
  clientId: process.env.TESTLUY_CLIENT_ID,
  secretKey: process.env.TESTLUY_SECRET_KEY,
  baseUrl: process.env.TESTLUY_BASE_URL
});

export default async function handler(req, res) {
  try {
    const result = await sdk.initiatePayment(req.body.amount, callbackUrl);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

#### After
```javascript
// app/api/payment/route.js (App Router) or pages/api/payment.js (Pages Router)
import TestluyPaymentSDK from 'testluy-payment-sdk';

const sdk = new TestluyPaymentSDK({
  clientId: process.env.TESTLUY_CLIENT_ID,
  secretKey: process.env.TESTLUY_SECRET_KEY,
  baseUrl: process.env.TESTLUY_BASE_URL,
  // Cloudflare bypass automatically enabled for Vercel deployments
  loggingConfig: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
  }
});

// App Router
export async function POST(request) {
  try {
    const body = await request.json();
    const result = await sdk.initiatePayment(body.amount, callbackUrl);
    return Response.json(result);
  } catch (error) {
    console.error('Payment failed:', error);
    return Response.json({ error: 'Payment failed' }, { status: 500 });
  }
}

// Pages Router (same as before, but with enhanced error handling)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const result = await sdk.initiatePayment(req.body.amount, callbackUrl);
    res.json(result);
  } catch (error) {
    console.error('Payment failed:', error);
    res.status(500).json({ error: 'Payment failed' });
  }
}
```

### Express.js Projects

#### Before
```javascript
const express = require('express');
const TestluyPaymentSDK = require('testluy-payment-sdk');

const app = express();
const sdk = new TestluyPaymentSDK({
  clientId: process.env.TESTLUY_CLIENT_ID,
  secretKey: process.env.TESTLUY_SECRET_KEY,
  baseUrl: process.env.TESTLUY_BASE_URL
});

app.post('/payment', async (req, res) => {
  try {
    const result = await sdk.initiatePayment(req.body.amount, callbackUrl);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### After
```javascript
import express from 'express';
import TestluyPaymentSDK, { RateLimitError } from 'testluy-payment-sdk';

const app = express();

// Initialize SDK once and reuse
const sdk = new TestluyPaymentSDK({
  clientId: process.env.TESTLUY_CLIENT_ID,
  secretKey: process.env.TESTLUY_SECRET_KEY,
  baseUrl: process.env.TESTLUY_BASE_URL,
  loggingConfig: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info'
  }
});

// Initialize SDK on startup
await sdk.init();

app.post('/payment', async (req, res) => {
  try {
    const result = await sdk.initiatePayment(req.body.amount, callbackUrl);
    res.json(result);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: error.retryAfter
      });
    }
    
    console.error('Payment failed:', error);
    res.status(500).json({ error: 'Payment failed' });
  }
});
```

## Environment Variables

No changes needed for environment variables. The same variables continue to work:

```env
TESTLUY_CLIENT_ID=your_client_id
TESTLUY_SECRET_KEY=your_secret_key
TESTLUY_BASE_URL=https://api-testluy.paragoniu.app
```

## Testing Migration

### 1. Test Basic Functionality

```javascript
// test-migration.js
import TestluyPaymentSDK from 'testluy-payment-sdk';

const sdk = new TestluyPaymentSDK({
  clientId: process.env.TESTLUY_CLIENT_ID,
  secretKey: process.env.TESTLUY_SECRET_KEY,
  baseUrl: process.env.TESTLUY_BASE_URL,
  loggingConfig: { level: 'debug' }
});

async function testMigration() {
  try {
    // Test credential validation
    await sdk.init();
    console.log('✅ SDK initialization successful');
    
    // Test payment initiation
    const result = await sdk.initiatePayment(
      1.00,
      'https://example.com/callback'
    );
    console.log('✅ Payment initiation successful:', result.transactionId);
    
    // Test status check
    const status = await sdk.getPaymentStatus(result.transactionId);
    console.log('✅ Status check successful:', status.status);
    
  } catch (error) {
    console.error('❌ Migration test failed:', error.message);
  }
}

testMigration();
```

### 2. Test Error Handling

```javascript
import { RateLimitError, CloudflareError } from 'testluy-payment-sdk';

// Test specific error types
try {
  // Trigger rate limiting with multiple requests
  await Promise.all([
    sdk.initiatePayment(1, 'https://example.com/callback'),
    sdk.initiatePayment(1, 'https://example.com/callback'),
    sdk.initiatePayment(1, 'https://example.com/callback'),
    // ... more requests
  ]);
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log('✅ Rate limit error handling working');
  }
}
```

## Rollback Plan

If you encounter issues with the new version, you can rollback:

### 1. Use Legacy Version

```bash
npm install testluy-payment-sdk@3.7.2
```

### 2. Use Legacy Import

```javascript
// Use the legacy version while keeping v3.8.x installed
import TestluyPaymentSDK from 'testluy-payment-sdk/index.js';
```

## Common Migration Issues

### Issue 1: Import Errors

**Problem:** Module not found errors after upgrade

**Solution:**
```javascript
// Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

// Or use explicit import
import TestluyPaymentSDK from 'testluy-payment-sdk/index-enhanced.js';
```

### Issue 2: TypeScript Errors

**Problem:** TypeScript compilation errors

**Solution:**
```typescript
// Install updated types
npm install @types/node@latest

// Use explicit types
import TestluyPaymentSDK, { 
  TestluyPaymentSDKOptions,
  PaymentInitiationResult 
} from 'testluy-payment-sdk';

const options: TestluyPaymentSDKOptions = {
  clientId: process.env.TESTLUY_CLIENT_ID!,
  secretKey: process.env.TESTLUY_SECRET_KEY!,
  baseUrl: process.env.TESTLUY_BASE_URL
};
```

### Issue 3: Build Errors

**Problem:** Build failures in Next.js/Vite

**Solution:**
```javascript
// next.config.js
module.exports = {
  experimental: {
    esmExternals: 'loose'
  }
};

// vite.config.js
export default {
  optimizeDeps: {
    include: ['testluy-payment-sdk']
  }
};
```

## Getting Help

If you encounter issues during migration:

1. **Check the troubleshooting guide:** [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. **Review the examples:** [examples/](examples/)
3. **Create an issue:** [GitHub Issues](https://github.com/chanboraseng/testluy-payment-sdk/issues)
4. **Contact support:** support@testluy.com

Include the following information when seeking help:
- Current SDK version
- Target SDK version
- Error messages
- Code samples
- Environment details (Node.js version, platform, etc.)
