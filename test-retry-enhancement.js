/**
 * Test script to verify ErrorHandler retry enhancements
 */

import ErrorHandler from './http/ErrorHandler.js';
import EnhancedHttpClient from './http/EnhancedHttpClient.js';
import RetryStrategy from './http/RetryStrategy.js';

// Mock HTTP adapter for testing
class MockHttpAdapter {
    constructor() {
        this.baseUrl = 'https://api-testluy.paragoniu.app';
        this.requestCount = 0;
    }

    async request(config) {
        this.requestCount++;
        console.log(`MockHttpAdapter: Request attempt ${this.requestCount} for ${config.url}`);

        // Simulate failure on first attempt, success on second
        if (this.requestCount === 1) {
            const error = new Error('403 Forbidden');
            error.config = config;
            error.response = {
                status: 403,
                statusText: 'Forbidden',
                data: 'Access denied'
            };
            throw error;
        }

        // Success on retry
        return {
            data: { success: true, attempt: this.requestCount },
            status: 200,
            statusText: 'OK'
        };
    }

    // Add _buildUrl method to match adapter interface
    _buildUrl(url) {
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
            return url;
        }

        if (!url) {
            throw new Error('URL cannot be null or undefined');
        }

        const cleanUrl = url.startsWith('/') ? url : `/${url}`;

        if (!this.baseUrl) {
            throw new Error('Base URL is not configured');
        }

        const baseUrlWithoutTrailingSlash = this.baseUrl.endsWith('/')
            ? this.baseUrl.slice(0, -1)
            : this.baseUrl;

        return `${baseUrlWithoutTrailingSlash}${cleanUrl}`;
    }
}

async function testRetryEnhancement() {
    console.log('=== Testing ErrorHandler Retry Enhancement ===\n');

    try {
        // Create mock HTTP adapter
        const mockAdapter = new MockHttpAdapter();

        // Create retry strategy
        const retryStrategy = new RetryStrategy({
            maxRetries: 2,
            baseDelay: 100, // Short delay for testing
            maxDelay: 1000
        });

        // Create ErrorHandler with HTTP adapter
        const errorHandler = new ErrorHandler({
            retryStrategy,
            httpAdapter: mockAdapter,
            onRetry: ({ attempt, delay, retryContext }) => {
                console.log(`Retry attempt ${attempt} after ${delay}ms`);
                if (retryContext) {
                    console.log(`Retry context: ${JSON.stringify(retryContext, null, 2)}`);
                }
            }
        });

        // Create EnhancedHttpClient
        const httpClient = new EnhancedHttpClient({
            baseUrl: 'https://api-testluy.paragoniu.app'
        });

        // Add error interceptor
        const interceptor = errorHandler.createErrorInterceptor();
        httpClient.addErrorInterceptor(interceptor);

        // Verify that the HTTP adapter was set
        console.log('HTTP adapter set on ErrorHandler:', !!errorHandler.httpAdapter);
        console.log('HTTP adapter type:', errorHandler.httpAdapter?.constructor?.name);

        // Test retry functionality
        console.log('\n--- Testing Retry Mechanism ---');

        // Create a mock error to trigger retry
        const mockError = new Error('403 Forbidden');
        mockError.config = {
            method: 'GET',
            url: '/api/test-endpoint',
            retryAttempt: 0
        };
        mockError.response = {
            status: 403,
            statusText: 'Forbidden'
        };

        // Test the retry mechanism
        try {
            const result = await errorHandler.retryRequest(mockError, {});
            console.log('Retry successful:', result);
            console.log('Total requests made:', mockAdapter.requestCount);
        } catch (retryError) {
            console.error('Retry failed:', retryError.message);
            if (retryError.retryContext) {
                console.log('Retry context:', retryError.retryContext);
            }
        }

    } catch (error) {
        console.error('Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testRetryEnhancement().then(() => {
    console.log('\n=== Test Complete ===');
}).catch(error => {
    console.error('Test execution failed:', error);
});