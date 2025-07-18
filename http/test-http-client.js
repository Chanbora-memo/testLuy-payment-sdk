import EnhancedHttpClient from './EnhancedHttpClient.js';
import { RequestInterceptor, ResponseInterceptor, ErrorInterceptor } from './interceptors.js';

// Example custom request interceptor
class CustomRequestInterceptor extends RequestInterceptor {
  async onRequest(config) {
    console.log('Request interceptor called');
    // Add a custom header
    return {
      ...config,
      headers: {
        ...config.headers,
        'X-Custom-Header': 'CustomValue'
      }
    };
  }
}

// Example custom response interceptor
class CustomResponseInterceptor extends ResponseInterceptor {
  async onResponse(response) {
    console.log('Response interceptor called');
    // Add a custom property to the response
    return {
      ...response,
      customProperty: 'CustomValue'
    };
  }
}

// Example custom error interceptor
class CustomErrorInterceptor extends ErrorInterceptor {
  async onError(error) {
    console.log('Error interceptor called');
    // Log the error but don't handle it
    console.error('Error details:', error.message);
    // Return undefined to continue with error propagation
  }
}

async function testHttpClient() {
  try {
    console.log('Creating EnhancedHttpClient instance...');
    const client = new EnhancedHttpClient({
      baseUrl: 'https://jsonplaceholder.typicode.com',
      timeout: 5000
    });
    
    console.log('Adding interceptors...');
    client.addRequestInterceptor(new CustomRequestInterceptor());
    client.addResponseInterceptor(new CustomResponseInterceptor());
    client.addErrorInterceptor(new CustomErrorInterceptor());
    
    console.log('Making GET request...');
    const response = await client.get('/posts/1');
    console.log('Response:', response);
    
    console.log('Making POST request...');
    const postResponse = await client.post('/posts', {
      title: 'foo',
      body: 'bar',
      userId: 1
    });
    console.log('POST Response:', postResponse);
    
    console.log('Testing error handling...');
    try {
      await client.get('/nonexistent-endpoint');
    } catch (error) {
      console.log('Error caught successfully:', error.message);
    }
    
    console.log('All tests passed!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testHttpClient();