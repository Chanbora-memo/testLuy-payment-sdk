/**
 * Advanced debugging and monitoring script for TestluyPaymentSDK
 * This script helps diagnose issues with Cloudflare protection and API connectivity
 */

import TestluyPaymentSDK from './index-enhanced.js';

// Sample credentials for testing
const TEST_CREDENTIALS = {
  clientId: '0f07be84baa574d9a639bbea06db61ba',
  secretKey: 'secret_232e5ef95af0680a48eaf9d95cab2ea0695d6d1d8f3ff4adf1906829d2d8fe80',
  baseUrl: 'https://api-testluy.paragoniu.app'
};

async function runDiagnostics() {
  console.log('=== TestluyPaymentSDK Advanced Diagnostics ===\n');
  
  // Create SDK with detailed logging
  console.log('Initializing SDK with debug logging...');
  const sdk = new TestluyPaymentSDK({
    ...TEST_CREDENTIALS,
    loggingConfig: {
      level: 'debug',
      includeHeaders: true,
      includeBody: true,
      enableMetrics: true
    },
    cloudflareConfig: {
      enabled: true,
      rotateUserAgent: true,
      addBrowserHeaders: true,
      addTimingVariation: true
    },
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2,
      jitterFactor: 0.2
    }
  });
  
  // Test 1: Check API connectivity
  console.log('\n=== Test 1: API Connectivity ===');
  try {
    console.log('Testing direct fetch to API endpoint...');
    const response = await fetch(`${TEST_CREDENTIALS.baseUrl}/validate-credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({})
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    try {
      const data = await response.json();
      console.log('Response data:', data);
    } catch (e) {
      const text = await response.text();
      console.log('Response text preview:', text.substring(0, 200) + '...');
      
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        console.log('HTML response detected - likely Cloudflare protection');
      }
    }
  } catch (error) {
    console.error('Direct fetch error:', error.message);
  }
  
  // Test 2: Credential validation
  console.log('\n=== Test 2: Credential Validation ===');
  try {
    console.log('Testing credential validation...');
    const isValid = await sdk.validateCredentials();
    console.log('Credentials valid:', isValid);
  } catch (error) {
    console.error('Validation error:', error.message);
  }
  
  // Test 3: Payment initiation
  console.log('\n=== Test 3: Payment Initiation ===');
  try {
    console.log('Testing payment initiation...');
    const result = await sdk.initiatePayment(10.50, 'https://example.com/callback');
    console.log('Payment initiated:', result);
  } catch (error) {
    console.error('Payment initiation error:', error.message);
  }
  
  // Test 4: Diagnostic report
  console.log('\n=== Test 4: Diagnostic Report ===');
  const report = sdk.generateDiagnosticReport();
  console.log(JSON.stringify(report, null, 2));
  
  // Test 5: Troubleshooting suggestions
  console.log('\n=== Test 5: Troubleshooting Suggestions ===');
  const suggestions = sdk.getTroubleshootingSuggestions();
  if (suggestions && suggestions.length > 0) {
    suggestions.forEach(suggestion => {
      console.log(`[${suggestion.priority}] ${suggestion.issue}: ${suggestion.suggestion}`);
    });
  } else {
    console.log('No troubleshooting suggestions available');
  }
  
  console.log('\n=== Diagnostics Complete ===');
}

runDiagnostics().catch(console.error);