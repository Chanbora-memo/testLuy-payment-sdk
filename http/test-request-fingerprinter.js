/**
 * @fileoverview
 * Test file for the RequestFingerprinter class
 */

import RequestFingerprinter from './RequestFingerprinter.js';
import EnhancedHttpClient from './EnhancedHttpClient.js';

/**
 * Test the RequestFingerprinter class
 */
async function testRequestFingerprinter() {
  console.log('Testing RequestFingerprinter...');
  
  // Create a new RequestFingerprinter instance
  const fingerprinter = new RequestFingerprinter({
    rotateUserAgent: true,
    includeSecHeaders: true,
    randomizeHeaderOrder: true,
    jitterFactor: 0.2,
    customHeaders: {
      'X-Custom-Global': 'GlobalValue'
    }
  });
  
  // Test header generation
  console.log('\n1. Testing header generation:');
  const headers1 = fingerprinter.generateHeaders({
    url: 'https://api-testluy.paragoniu.app/v1/payments',
    method: 'POST',
    customHeaders: {
      'Content-Type': 'application/json'
    }
  });
  
  console.log('Generated headers:');
  console.log(JSON.stringify(headers1, null, 2));
  
  // Test User-Agent rotation
  console.log('\n2. Testing User-Agent rotation:');
  const userAgents = new Set();
  
  for (let i = 0; i < 5; i++) {
    const ua = fingerprinter.generateUserAgent();
    userAgents.add(ua);
    console.log(`User-Agent ${i + 1}: ${ua}`);
  }
  
  console.log(`Generated ${userAgents.size} unique User-Agents out of 5 attempts`);
  
  // Test Accept header generation
  console.log('\n3. Testing Accept header generation:');
  console.log('JSON API Accept header:', fingerprinter.generateAcceptHeader('application/json'));
  console.log('HTML Accept header:', fingerprinter.generateAcceptHeader('text/html'));
  console.log('General Accept header:', fingerprinter.generateAcceptHeader());
  
  // Test Sec-Fetch headers generation
  console.log('\n4. Testing Sec-Fetch headers generation:');
  const apiSecFetch = fingerprinter.generateSecFetchHeaders('GET', 'https://api-testluy.paragoniu.app/v1/payments');
  console.log('API Sec-Fetch headers:', apiSecFetch);
  
  const htmlSecFetch = fingerprinter.generateSecFetchHeaders('GET', 'https://example.com/index.html');
  console.log('HTML Sec-Fetch headers:', htmlSecFetch);
  
  // Test header order randomization
  console.log('\n5. Testing header order randomization:');
  const testHeaders = {
    'User-Agent': 'Test User Agent',
    'Accept': 'application/json',
    'Accept-Language': 'en-US',
    'Content-Type': 'application/json'
  };
  
  console.log('Original headers order:');
  console.log(Object.keys(testHeaders));
  
  const randomized1 = fingerprinter.randomizeHeaderOrder(testHeaders);
  console.log('Randomized order 1:');
  console.log(Object.keys(randomized1));
  
  const randomized2 = fingerprinter.randomizeHeaderOrder(testHeaders);
  console.log('Randomized order 2:');
  console.log(Object.keys(randomized2));
  
  // Test random delay
  console.log('\n6. Testing random delay:');
  const baseDelay = 500;
  console.log(`Adding random delay with base: ${baseDelay}ms and jitter factor: ${fingerprinter.options.jitterFactor}`);
  
  const start = Date.now();
  await fingerprinter.addRandomDelay(baseDelay);
  const elapsed = Date.now() - start;
  
  console.log(`Actual delay: ${elapsed}ms`);
  
  // Test with EnhancedHttpClient
  console.log('\n7. Testing integration with EnhancedHttpClient:');
  
  const client = new EnhancedHttpClient({
    baseUrl: 'https://jsonplaceholder.typicode.com',
    timeout: 5000
  });
  
  // Add the fingerprinter's request interceptor
  const interceptor = fingerprinter.createRequestInterceptor();
  client.addRequestInterceptor(interceptor);
  
  // Add a response interceptor to log the request headers
  client.addResponseInterceptor({
    async onResponse(response) {
      console.log('Request headers sent:');
      console.log(JSON.stringify(response.config.headers, null, 2));
      return response;
    }
  });
  
  // Make a test request
  try {
    console.log('Making test request...');
    const response = await client.get('/posts/1');
    console.log('Response received:', response);
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test request failed:', error.message);
  }
}

// Run the test
testRequestFingerprinter().catch(error => {
  console.error('Test failed:', error);
});