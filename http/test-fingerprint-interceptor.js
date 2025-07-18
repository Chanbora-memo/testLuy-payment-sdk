/**
 * @fileoverview
 * Test file for the FingerprintInterceptor class
 */

import EnhancedHttpClient from './EnhancedHttpClient.js';
import FingerprintInterceptor from './interceptors/FingerprintInterceptor.js';

/**
 * Test the FingerprintInterceptor class
 */
async function testFingerprintInterceptor() {
  console.log('Testing FingerprintInterceptor...');

  // Create a new EnhancedHttpClient instance
  const client = new EnhancedHttpClient({
    baseUrl: 'https://jsonplaceholder.typicode.com',
    timeout: 5000
  });

  // Create and add the FingerprintInterceptor with Cloudflare evasion features
  const fingerprintInterceptor = new FingerprintInterceptor({
    rotateUserAgent: true,
    includeSecHeaders: true,
    randomizeHeaderOrder: true,  // Enable header order randomization
    jitterFactor: 0.2,
    customHeaders: {
      'X-Custom-Global': 'GlobalValue'
    }
  });

  client.addRequestInterceptor(fingerprintInterceptor);

  // Add a response interceptor to log the request headers
  client.addResponseInterceptor({
    async onResponse(response) {
      console.log('Request headers sent:');
      console.log(JSON.stringify(response.config.headers, null, 2));
      return response;
    }
  });

  // Make multiple test requests to demonstrate features
  try {
    console.log('\nMaking multiple test requests to demonstrate Cloudflare evasion features...');

    // Test different request types to show context-aware headers
    const endpoints = [
      { url: '/posts/1', method: 'GET', description: 'API GET request' },
      { url: '/posts', method: 'POST', data: { title: 'foo', body: 'bar', userId: 1 }, description: 'API POST request' },
      { url: '/users/1', method: 'GET', description: 'Another API GET request' }
    ];

    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      console.log(`\nRequest ${i + 1} (${endpoint.description}):`);

      let response;
      if (endpoint.method === 'GET') {
        response = await client.get(endpoint.url);
      } else if (endpoint.method === 'POST') {
        response = await client.post(endpoint.url, endpoint.data);
      }

      console.log(`Response ${i + 1} received:`, response);

      // We can't access response.config.headers here because it's not available in the response object
      // The headers were already logged by the response interceptor above

      // Add a small delay between requests
      if (i < endpoints.length - 1) {
        console.log('Waiting before next request...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Test request failed:', error.message);
  }
}

// Run the test
testFingerprintInterceptor().catch(error => {
  console.error('Test failed:', error);
});