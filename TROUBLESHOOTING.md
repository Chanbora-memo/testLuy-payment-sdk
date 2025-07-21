# TestLuy Payment SDK Troubleshooting Guide

This comprehensive troubleshooting guide helps you diagnose and resolve common issues when using the TestLuy Payment SDK.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Common Issues](#common-issues)
- [Environment-Specific Issues](#environment-specific-issues)
- [Error Code Reference](#error-code-reference)
- [Debug Mode](#debug-mode)
- [Performance Issues](#performance-issues)
- [Network and Connectivity](#network-and-connectivity)
- [Getting Support](#getting-support)

## Quick Diagnostics

### 1. Check SDK Version and Environment

```javascript
import TestluyPaymentSDK from 'testluy-payment-sdk';

console.log('SDK Version:', TestluyPaymentSDK.version);
console.log('Node Version:', process.version);
console.log('Environment:', process.env.NODE_ENV);

// Check environment variables
console.log('Config:', {
  clientId: process.env.TESTLUY_CLIENT_ID ? '✓ Set' : '✗ Missing',
  secretKey: process.env.TESTLUY_SECRET_KEY ? '✓ Set' : '✗ Missing',
  baseUrl: process.env.TESTLUY_BASE_URL || 'Using default'
});
```

### 2. Basic Connectivity Test

```javascript
const sdk = new TestluyPaymentSDK({
  clientId: process.env.TESTLUY_CLIENT_ID,
  secretKey: process.env.TESTLUY_SECRET_KEY,
  baseUrl: process.env.TESTLUY_BASE_URL,
  loggingConfig: { level: 'debug' }
});

try {
  await sdk.init();
  console.log('✅ SDK initialized successfully');
} catch (error) {
  console.error('❌ SDK initialization failed:', error.message);
}
```

## Common Issues

### Issue 1: "Invalid credentials" Error

**Symptoms:**
- Error message: "Invalid credentials" or "Authentication failed"
- HTTP 401 Unauthorized responses

**Causes:**
- Missing or incorrect `clientId` or `secretKey`
- Environment variables not loaded
- Expired or deactivated credentials

**Solutions:**

1. **Verify Environment Variables:**
```bash
# Check if variables are set
echo $TESTLUY_CLIENT_ID
echo $TESTLUY_SECRET_KEY
echo $TESTLUY_BASE_URL
```

2. **Load Environment Variables Properly:**
```javascript
// For Node.js projects
import dotenv from 'dotenv';
dotenv.config();

// For Next.js - use .env.local file
// Variables should be prefixed with NEXT_PUBLIC_ for client-side access
```

3. **Validate Credentials Format:**
```javascript
// Client ID should be a UUID-like string
const clientIdRegex = /^[a-f0-9-]{36}$/i;
console.log('Valid Client ID:', clientIdRegex.test(process.env.TESTLUY_CLIENT_ID));

// Secret key should be a long alphanumeric string
console.log('Secret Key Length:', process.env.TESTLUY_SECRET_KEY?.length);
```

### Issue 2: Rate Limiting Errors

**Symptoms:**
- Error message: "Rate limit exceeded"
- HTTP 429 Too Many Requests responses
- Slow response times

**Causes:**
- Exceeding subscription rate limits
- Too many concurrent requests
- Inefficient retry logic

**Solutions:**

1. **Check Current Subscription:**
```javascript
try {
  await sdk.init();
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log('Current Plan:', error.subscription);
    console.log('Rate Limit:', error.limit, 'requests per minute');
    console.log('Upgrade Info:', error.upgradeInfo);
  }
}
```

2. **Implement Request Caching:**
```javascript
const cache = new Map();

async function getCachedPaymentStatus(transactionId) {
  const cacheKey = `status_${transactionId}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < 30000) {
    return cached.data;
  }
  
  const status = await sdk.getPaymentStatus(transactionId);
  cache.set(cacheKey, { data: status, timestamp: Date.now() });
  
  return status;
}
```

3. **Optimize Retry Configuration:**
```javascript
const sdk = new TestluyPaymentSDK({
  clientId: process.env.TESTLUY_CLIENT_ID,
  secretKey: process.env.TESTLUY_SECRET_KEY,
  baseUrl: process.env.TESTLUY_BASE_URL,
  retryConfig: {
    maxRetries: 5,
    baseDelay: 2000,    // Longer delays
    maxDelay: 60000,    // Up to 1 minute
    backoffFactor: 2.5  // More aggressive backoff
  }
});
```

### Issue 3: Cloudflare Protection Blocks

**Symptoms:**
- Error message contains "Cloudflare"
- HTTP 403 Forbidden or 503 Service Unavailable
- Works locally but fails in deployment

**Causes:**
- Cloudflare Tunnel Zero Trust protection
- Bot detection triggered
- Missing or incorrect bypass headers

**Solutions:**

1. **Verify Smart Routing is Enabled:**
```javascript
const sdk = new TestluyPaymentSDK({
  clientId: process.env.TESTLUY_CLIENT_ID,
  secretKey: process.env.TESTLUY_SECRET_KEY,
  baseUrl: process.env.TESTLUY_BASE_URL,
  enableSmartRouting: true, // Should be true by default
  cloudflareConfig: {
    enabled: true,
    rotateUserAgent: true,
    addBrowserHeaders: true
  }
});
```

2. **Check Environment Detection:**
```javascript
// Enable debug logging to see environment detection
const sdk = new TestluyPaymentSDK({
  clientId: process.env.TESTLUY_CLIENT_ID,
  secretKey: process.env.TESTLUY_SECRET_KEY,
  baseUrl: process.env.TESTLUY_BASE_URL,
  loggingConfig: { level: 'debug' }
});

// Look for logs like:
// [INFO] TestluyPaymentSDK: Deployment environment detected (vercel), using header-based Cloudflare bypass
```

3. **Manual Environment Detection:**
```javascript
// Check platform environment variables
console.log('Platform Detection:', {
  vercel: !!process.env.VERCEL,
  netlify: !!process.env.NETLIFY,
  render: !!process.env.RENDER,
  heroku: !!process.env.HEROKU,
  railway: !!process.env.RAILWAY,
  fly: !!process.env.FLY_APP_NAME,
  aws: !!process.env.AWS_LAMBDA_FUNCTION_NAME
});
```

### Issue 4: Build and Import Errors

**Symptoms:**
- Module not found errors
- TypeScript compilation errors
- Bundler errors in Next.js/Vite

**Causes:**
- Incorrect import paths
- Module resolution issues
- Build tool configuration

**Solutions:**

1. **Use Correct Import Syntax:**
```javascript
// ✅ Correct imports
import TestluyPaymentSDK from 'testluy-payment-sdk';
// or for enhanced version
import TestluyPaymentSDK from 'testluy-payment-sdk/index-enhanced.js';

// ❌ Avoid these
import { TestluyPaymentSDK } from 'testluy-payment-sdk'; // Wrong
import TestluyPaymentSDK from 'testluy-payment-sdk/index'; // Missing extension
```

2. **Next.js Configuration Fix:**
```javascript
// next.config.js
module.exports = {
  experimental: {
    esmExternals: 'loose'
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        stream: false,
        util: false
      };
    }
    return config;
  }
};
```

3. **Vite Configuration Fix:**
```javascript
// vite.config.js
export default {
  optimizeDeps: {
    include: ['testluy-payment-sdk']
  },
  build: {
    commonjsOptions: {
      include: [/testluy-payment-sdk/, /node_modules/]
    }
  }
};
```

## Environment-Specific Issues

### Vercel Issues

**Problem:** Function timeout errors
**Solution:**
```javascript
// Set appropriate timeouts for Vercel functions
const sdk = new TestluyPaymentSDK({
  clientId: process.env.TESTLUY_CLIENT_ID,
  secretKey: process.env.TESTLUY_SECRET_KEY,
  baseUrl: process.env.TESTLUY_BASE_URL,
  httpConfig: {
    timeout: 8000 // Vercel has 10s limit for hobby plan
  }
});
```

### Netlify Issues

**Problem:** Function size limits
**Solution:**
```javascript
// netlify.toml
[build]
  functions = "netlify/functions"

[functions]
  node_bundler = "esbuild"
  
[[plugins]]
  package = "@netlify/plugin-nextjs" # If using Next.js
```

### AWS Lambda Issues

**Problem:** Cold start timeouts
**Solution:**
```javascript
// Keep SDK instance warm
let sdkInstance = null;

export const handler = async (event, context) => {
  if (!sdkInstance) {
    sdkInstance = new TestluyPaymentSDK({
      clientId: process.env.TESTLUY_CLIENT_ID,
      secretKey: process.env.TESTLUY_SECRET_KEY,
      baseUrl: process.env.TESTLUY_BASE_URL,
      httpConfig: { timeout: 5000 } // Shorter timeout for Lambda
    });
  }
  
  // Use sdkInstance...
};
```

## Error Code Reference

| Error Code | Description | Solution |
|------------|-------------|----------|
| `ECONNRESET` | Connection reset by server | Check network stability, implement retry logic |
| `ETIMEDOUT` | Request timeout | Increase timeout, check network |
| `ENOTFOUND` | DNS resolution failed | Check domain name, DNS settings |
| `403` | Forbidden | Check credentials, Cloudflare protection |
| `401` | Unauthorized | Verify credentials, check subscription |
| `429` | Rate limited | Implement backoff, upgrade subscription |
| `500` | Server error | Check service status, retry request |
| `503` | Service unavailable | Temporary issue, retry with backoff |

## Debug Mode

### Enable Comprehensive Logging

```javascript
const sdk = new TestluyPaymentSDK({
  clientId: process.env.TESTLUY_CLIENT_ID,
  secretKey: process.env.TESTLUY_SECRET_KEY,
  baseUrl: process.env.TESTLUY_BASE_URL,
  loggingConfig: {
    level: 'debug',
    includeHeaders: true,
    includeBody: true,
    maskSensitive: false, // ⚠️ Only for debugging
    format: 'text',
    colorize: true
  }
});
```

### Custom Debug Information

```javascript
// Add custom debug logging
const originalConsoleLog = console.log;
console.log = (...args) => {
  originalConsoleLog(`[${new Date().toISOString()}]`, ...args);
};

// Monitor network requests
process.on('warning', (warning) => {
  console.warn('Node.js Warning:', warning);
});
```

## Performance Issues

### Issue: Slow Response Times

**Diagnostic:**
```javascript
const startTime = Date.now();

try {
  const result = await sdk.initiatePayment(amount, callbackUrl);
  const endTime = Date.now();
  console.log(`Payment initiated in ${endTime - startTime}ms`);
} catch (error) {
  const endTime = Date.now();
  console.error(`Payment failed after ${endTime - startTime}ms:`, error.message);
}
```

**Solutions:**
1. Use connection pooling
2. Implement request caching
3. Optimize retry configuration
4. Use regional endpoints if available

### Issue: Memory Leaks

**Diagnostic:**
```javascript
// Monitor memory usage
setInterval(() => {
  const usage = process.memoryUsage();
  console.log('Memory Usage:', {
    rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB'
  });
}, 30000);
```

**Solutions:**
1. Reuse SDK instances
2. Implement proper error handling
3. Clear timeouts and intervals
4. Use weak references for caching

## Network and Connectivity

### Test Network Connectivity

```javascript
import { ping } from 'net-ping';

// Test basic connectivity to TestLuy API
const testConnectivity = async () => {
  try {
    const response = await fetch('https://api-testluy.paragoniu.app/health', {
      method: 'GET',
      timeout: 5000
    });
    
    console.log('API Health Check:', response.status === 200 ? '✅ OK' : '❌ Failed');
  } catch (error) {
    console.error('❌ Connectivity test failed:', error.message);
  }
};
```

### Proxy and Firewall Issues

```javascript
// Test with custom proxy settings
const sdk = new TestluyPaymentSDK({
  clientId: process.env.TESTLUY_CLIENT_ID,
  secretKey: process.env.TESTLUY_SECRET_KEY,
  baseUrl: process.env.TESTLUY_BASE_URL,
  httpConfig: {
    proxy: {
      host: 'proxy.company.com',
      port: 8080,
      auth: {
        username: 'user',
        password: 'pass'
      }
    }
  }
});
```

## Getting Support

### Before Contacting Support

1. **Gather Debug Information:**
```javascript
const debugInfo = {
  sdkVersion: TestluyPaymentSDK.version,
  nodeVersion: process.version,
  platform: process.platform,
  arch: process.arch,
  environment: process.env.NODE_ENV,
  deployment: {
    vercel: !!process.env.VERCEL,
    netlify: !!process.env.NETLIFY,
    render: !!process.env.RENDER,
    heroku: !!process.env.HEROKU
  },
  error: error.message,
  stack: error.stack,
  timestamp: new Date().toISOString()
};

console.log('Debug Info:', JSON.stringify(debugInfo, null, 2));
```

2. **Test with Minimal Example:**
```javascript
// Minimal reproduction case
const sdk = new TestluyPaymentSDK({
  clientId: 'test-client-id',
  secretKey: 'test-secret-key',
  baseUrl: 'http://localhost:8000'
});

try {
  await sdk.init();
} catch (error) {
  console.error('Minimal test failed:', error.message);
}
```

### Contact Channels

- **GitHub Issues:** [https://github.com/chanboraseng/testluy-payment-sdk/issues](https://github.com/chanboraseng/testluy-payment-sdk/issues)
- **Email Support:** support@testluy.com
- **Documentation:** [README.md](README.md)

### Include in Support Request

- SDK version
- Node.js version
- Operating system
- Deployment platform
- Full error message and stack trace
- Minimal code reproduction
- Debug information
- Steps to reproduce the issue
