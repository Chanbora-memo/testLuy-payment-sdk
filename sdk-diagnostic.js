/**
 * SDK Diagnostic Tool
 * 
 * This script helps diagnose issues with the TestluyPaymentSDK in different environments.
 * Run this script in your project to identify configuration or URL construction issues.
 */

import TestluyPaymentSDK from './index-enhanced.js';

// Sample credentials for testing - replace with your actual credentials
const TEST_CREDENTIALS = {
  clientId: '0f07be84baa574d9a639bbea06db61ba',
  secretKey: 'secret_232e5ef95af0680a48eaf9d95cab2ea0695d6d1d8f3ff4adf1906829d2d8fe80',
  baseUrl: 'https://api-testluy.paragoniu.app'
};

async function runDiagnostic() {
  console.log('=== TestluyPaymentSDK Diagnostic Tool ===\n');
  console.log('Environment Information:');
  console.log(`- Node.js Version: ${process.version}`);
  console.log(`- Platform: ${process.platform}`);
  console.log(`- SDK Version: ${TestluyPaymentSDK.version || 'Unknown'}`);
  
  // Test 1: Basic SDK initialization
  console.log('\n=== Test 1: SDK Initialization ===');
  try {
    const sdk = new TestluyPaymentSDK({
      ...TEST_CREDENTIALS,
      loggingConfig: {
        level: 'debug',
        includeHeaders: true,
        includeBody: true
      }
    });
    console.log('✓ SDK initialized successfully');
    
    // Check if the SDK has the expected methods
    const methods = [
      'validateCredentials',
      'initiatePayment',
      'getPaymentStatus',
      'generateDiagnosticReport',
      'getTroubleshootingSuggestions'
    ];
    
    const missingMethods = methods.filter(method => typeof sdk[method] !== 'function');
    if (missingMethods.length > 0) {
      console.log(`⚠ Warning: The following methods are missing: ${missingMethods.join(', ')}`);
    } else {
      console.log('✓ All expected methods are available');
    }
    
    // Check SDK configuration
    console.log('\nSDK Configuration:');
    console.log(`- Base URL: ${sdk.config?.baseUrl || 'Not set'}`);
    console.log(`- Cloudflare Protection: ${sdk.config?.cloudflareConfig?.enabled ? 'Enabled' : 'Disabled'}`);
    console.log(`- Retry Configuration: Max ${sdk.config?.retryConfig?.maxRetries || 'Unknown'} retries`);
    
    // Test 2: URL Construction
    console.log('\n=== Test 2: URL Construction ===');
    // Access the internal _buildUrl method if available
    if (sdk._httpClient && typeof sdk._httpClient._buildUrl === 'function') {
      const testUrls = [
        '/validate-credentials',
        'validate-credentials',
        '/payment-simulator/generate-url',
        'payment-simulator/generate-url'
      ];
      
      console.log('Testing URL construction:');
      testUrls.forEach(url => {
        try {
          const fullUrl = sdk._httpClient._buildUrl(url);
          console.log(`- "${url}" → "${fullUrl}"`);
        } catch (error) {
          console.log(`- "${url}" → Error: ${error.message}`);
        }
      });
    } else {
      console.log('⚠ Cannot test URL construction (internal method not accessible)');
    }
    
    // Test 3: Direct API Connection
    console.log('\n=== Test 3: Direct API Connection ===');
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
          console.log('⚠ HTML response detected - likely Cloudflare protection');
        }
      }
    } catch (error) {
      console.error('Direct fetch error:', error.message);
    }
    
    // Test 4: SDK API Call
    console.log('\n=== Test 4: SDK API Call ===');
    try {
      console.log('Testing credential validation through SDK...');
      const isValid = await sdk.validateCredentials();
      console.log('✓ Credentials valid:', isValid);
    } catch (error) {
      console.error('✗ Validation error:', error.message);
      console.log('Error details:', error);
    }
    
    // Test 5: Generate Diagnostic Report
    console.log('\n=== Test 5: Diagnostic Report ===');
    if (typeof sdk.generateDiagnosticReport === 'function') {
      const report = sdk.generateDiagnosticReport();
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log('⚠ Diagnostic report not available');
    }
    
  } catch (error) {
    console.error('SDK initialization error:', error);
  }
  
  console.log('\n=== Diagnostic Complete ===');
  console.log('\nTroubleshooting Tips:');
  console.log('1. Ensure the baseUrl is correctly specified and accessible');
  console.log('2. Enable Cloudflare resilience features: cloudflareConfig: { enabled: true }');
  console.log('3. Configure retry behavior: retryConfig: { maxRetries: 3 }');
  console.log('4. Check network connectivity and firewall settings');
  console.log('5. Verify that your credentials are correct');
}

runDiagnostic().catch(console.error);