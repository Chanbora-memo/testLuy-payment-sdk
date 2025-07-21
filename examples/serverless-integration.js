/**
 * Serverless Functions Integration Examples for TestLuy Payment SDK
 * 
 * This file provides examples for integrating the TestLuy Payment SDK
 * with various serverless platforms and functions.
 */

// ================================
// 1. VERCEL SERVERLESS FUNCTIONS
// ================================

/**
 * Vercel API Route Example
 * File: api/payment/initiate.js
 */
import TestluyPaymentSDK from 'testluy-payment-sdk';

const sdk = new TestluyPaymentSDK({
  clientId: process.env.TESTLUY_CLIENT_ID,
  secretKey: process.env.TESTLUY_SECRET_KEY,
  baseUrl: process.env.TESTLUY_BASE_URL || 'https://api-testluy.paragoniu.app',
  loggingConfig: {
    level: 'info',
    maskSensitive: true
  }
});

export default async function handler(req, res) {
  // Handle CORS for frontend requests
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { amount, orderId, customerEmail } = req.body;
    
    // Validate required fields
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID required' });
    }
    
    // Construct URLs using Vercel's environment variables
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.FRONTEND_URL || 'http://localhost:3000';
      
    const callbackUrl = `${baseUrl}/api/payment/callback?orderId=${orderId}`;
    const backUrl = `${baseUrl}/checkout?orderId=${orderId}`;
    
    // Initiate payment
    const result = await sdk.initiatePayment(
      parseFloat(amount),
      callbackUrl,
      backUrl
    );
    
    console.log(`[Vercel] Payment initiated: ${result.transactionId} for order ${orderId}`);
    
    return res.status(200).json({
      success: true,
      paymentUrl: result.paymentUrl,
      transactionId: result.transactionId,
      orderId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min expiry
    });
    
  } catch (error) {
    console.error('[Vercel] Payment initiation failed:', error.message);
    
    if (error.message.includes('Rate limit')) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfter: 60
      });
    }
    
    return res.status(500).json({
      error: 'Payment initiation failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// ================================
// 2. NETLIFY FUNCTIONS
// ================================

/**
 * Netlify Function Example
 * File: netlify/functions/payment-initiate.js
 */
const { TestluyPaymentSDK } = require('testluy-payment-sdk');

const sdk = new TestluyPaymentSDK({
  clientId: process.env.TESTLUY_CLIENT_ID,
  secretKey: process.env.TESTLUY_SECRET_KEY,
  baseUrl: process.env.TESTLUY_BASE_URL || 'https://api-testluy.paragoniu.app'
});

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  try {
    const { amount, orderId, metadata } = JSON.parse(event.body || '{}');
    
    if (!amount || amount <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid amount provided' })
      };
    }
    
    // Use Netlify's site URL
    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'http://localhost:8888';
    const callbackUrl = `${siteUrl}/.netlify/functions/payment-callback?orderId=${orderId}`;
    const backUrl = `${siteUrl}/checkout`;
    
    const result = await sdk.initiatePayment(
      parseFloat(amount),
      callbackUrl,
      backUrl
    );
    
    console.log(`[Netlify] Payment initiated: ${result.transactionId}`);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        paymentUrl: result.paymentUrl,
        transactionId: result.transactionId,
        orderId
      })
    };
    
  } catch (error) {
    console.error('[Netlify] Payment failed:', error.message);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Payment initiation failed',
        details: error.message
      })
    };
  }
};

// ================================
// 3. AWS LAMBDA FUNCTIONS
// ================================

/**
 * AWS Lambda Function Example
 * File: lambda/payment-initiate.js
 */
import TestluyPaymentSDK from 'testluy-payment-sdk';

const sdk = new TestluyPaymentSDK({
  clientId: process.env.TESTLUY_CLIENT_ID,
  secretKey: process.env.TESTLUY_SECRET_KEY,
  baseUrl: process.env.TESTLUY_BASE_URL || 'https://api-testluy.paragoniu.app',
  loggingConfig: {
    level: 'warn', // Reduced logging for Lambda
    format: 'json'
  }
});

export const handler = async (event, context) => {
  // Lambda context for request tracking
  const requestId = context.awsRequestId;
  
  try {
    // Parse event based on trigger (API Gateway, ALB, etc.)
    let body;
    if (event.body) {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } else {
      body = event;
    }
    
    const { amount, orderId, userId } = body;
    
    if (!amount || amount <= 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Invalid amount',
          requestId
        })
      };
    }
    
    // Construct callback URL using API Gateway endpoint
    const apiGatewayUrl = process.env.API_GATEWAY_URL || 'https://your-api.execute-api.region.amazonaws.com/stage';
    const callbackUrl = `${apiGatewayUrl}/payment/callback?orderId=${orderId}`;
    const backUrl = `${process.env.FRONTEND_URL}/orders/${orderId}`;
    
    const result = await sdk.initiatePayment(
      parseFloat(amount),
      callbackUrl,
      backUrl
    );
    
    console.log(`[Lambda] Payment initiated: ${result.transactionId} (${requestId})`);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        paymentUrl: result.paymentUrl,
        transactionId: result.transactionId,
        orderId,
        requestId
      })
    };
    
  } catch (error) {
    console.error(`[Lambda] Payment failed (${requestId}):`, error.message);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Payment initiation failed',
        requestId,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};

// ================================
// 4. CLOUDFLARE WORKERS
// ================================

/**
 * Cloudflare Workers Example
 * File: worker.js
 */
import TestluyPaymentSDK from 'testluy-payment-sdk';

export default {
  async fetch(request, env, ctx) {
    // Initialize SDK with environment variables from Workers
    const sdk = new TestluyPaymentSDK({
      clientId: env.TESTLUY_CLIENT_ID,
      secretKey: env.TESTLUY_SECRET_KEY,
      baseUrl: env.TESTLUY_BASE_URL || 'https://api-testluy.paragoniu.app'
    });
    
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    
    if (url.pathname === '/api/payment/initiate' && request.method === 'POST') {
      try {
        const { amount, orderId } = await request.json();
        
        if (!amount || amount <= 0) {
          return new Response(JSON.stringify({ error: 'Invalid amount' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const workerUrl = new URL(request.url).origin;
        const callbackUrl = `${workerUrl}/api/payment/callback?orderId=${orderId}`;
        const backUrl = `${env.FRONTEND_URL}/checkout`;
        
        const result = await sdk.initiatePayment(
          parseFloat(amount),
          callbackUrl,
          backUrl
        );
        
        return new Response(JSON.stringify({
          success: true,
          paymentUrl: result.paymentUrl,
          transactionId: result.transactionId,
          orderId
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
        
      } catch (error) {
        return new Response(JSON.stringify({
          error: 'Payment initiation failed',
          details: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    return new Response('Not Found', { status: 404 });
  }
};

// ================================
// 5. DEPLOYMENT CONFIGURATION
// ================================

/**
 * Environment Variables for Different Platforms
 */

// Vercel (.env.local)
/*
TESTLUY_CLIENT_ID=your_client_id
TESTLUY_SECRET_KEY=your_secret_key
TESTLUY_BASE_URL=https://api-testluy.paragoniu.app
FRONTEND_URL=https://your-app.vercel.app
*/

// Netlify (netlify.toml)
/*
[build.environment]
  TESTLUY_CLIENT_ID = "your_client_id"
  TESTLUY_SECRET_KEY = "your_secret_key"
  TESTLUY_BASE_URL = "https://api-testluy.paragoniu.app"

[context.production.environment]
  NODE_ENV = "production"
*/

// AWS Lambda (serverless.yml)
/*
provider:
  name: aws
  runtime: nodejs18.x
  environment:
    TESTLUY_CLIENT_ID: ${env:TESTLUY_CLIENT_ID}
    TESTLUY_SECRET_KEY: ${env:TESTLUY_SECRET_KEY}
    TESTLUY_BASE_URL: ${env:TESTLUY_BASE_URL}
    API_GATEWAY_URL: ${self:custom.apiGatewayUrl}
    FRONTEND_URL: ${env:FRONTEND_URL}
*/

// Cloudflare Workers (wrangler.toml)
/*
[vars]
TESTLUY_BASE_URL = "https://api-testluy.paragoniu.app"
FRONTEND_URL = "https://your-app.pages.dev"

[[env.production.vars]]
name = "NODE_ENV"
value = "production"
*/
