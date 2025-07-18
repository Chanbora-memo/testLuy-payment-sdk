/**
 * @fileoverview
 * Test file for the enhanced TestluyPaymentSDK with Cloudflare resilience
 */

import TestluyPaymentSDK from './index-enhanced.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get credentials from environment variables
const clientId = process.env.TESTLUY_CLIENT_ID;
const secretKey = process.env.TESTLUY_SECRET_KEY;
const baseUrl = process.env.TESTLUY_BASE_URL || 'https://api-testluy.paragoniu.app';

// Check if credentials are available
if (!clientId || !secretKey) {
  console.error('Error: TESTLUY_CLIENT_ID and TESTLUY_SECRET_KEY environment variables are required.');
  console.error('Please create a .env file with these variables or set them in your environment.');
  process.exit(1);
}

// Create SDK instance with enhanced Cloudflare resilience
const sdk = new TestluyPaymentSDK({
  clientId,
  secretKey,
  baseUrl,
  retryConfig: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
    jitterFactor: 0.1
  },
  cloudflareConfig: {
    enabled: true,
    rotateUserAgent: true,
    addBrowserHeaders: true
  }
});

// Test functions
async function testValidateCredentials() {
  console.log('\n--- Testing Credential Validation ---');
  try {
    const isValid = await sdk.validateCredentials();
    console.log('Credentials valid:', isValid);
  } catch (error) {
    console.error('Validation error:', error.message);
  }
}

async function testInitiatePayment() {
  console.log('\n--- Testing Payment Initiation ---');
  try {
    const { paymentUrl, transactionId } = await sdk.initiatePayment(
      10.50,
      'https://example.com/callback',
      'https://example.com/back'
    );
    console.log('Payment URL:', paymentUrl);
    console.log('Transaction ID:', transactionId);
    
    // Store transaction ID for status check
    return transactionId;
  } catch (error) {
    console.error('Payment initiation error:', error.message);
    return null;
  }
}

async function testGetPaymentStatus(transactionId) {
  if (!transactionId) {
    console.log('Skipping payment status check (no transaction ID)');
    return;
  }
  
  console.log('\n--- Testing Payment Status Check ---');
  try {
    const status = await sdk.getPaymentStatus(transactionId);
    console.log('Payment status:', status);
  } catch (error) {
    console.error('Payment status error:', error.message);
  }
}

// Run tests
async function runTests() {
  try {
    await testValidateCredentials();
    const transactionId = await testInitiatePayment();
    await testGetPaymentStatus(transactionId);
    
    console.log('\nAll tests completed!');
  } catch (error) {
    console.error('Test runner error:', error);
  }
}

runTests();