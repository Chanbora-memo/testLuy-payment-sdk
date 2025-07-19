/**
 * XhrAdapter - HTTP client adapter using XMLHttpRequest
 * 
 * This adapter provides a unified interface for making HTTP requests using
 * XMLHttpRequest, which is available in all browsers including legacy ones.
 */

/**
 * XhrAdapter class for making HTTP requests using XMLHttpRequest
 */
class XhrAdapter {
    /**
     * Creates a new XhrAdapter instance
     * 
     * @param {Object} options - Configuration options
     * @param {number} [options.timeout=30000] - Request timeout in milliseconds
     * @param {Object} [options.headers={}] - Default headers to include with every request
     * @param {string} [options.baseUrl=''] - Base URL to prepend to all request URLs
     */
    constructor(options = {}) {
        this.timeout = options.timeout || 30000;
        this.headers = options.headers || {};
        this.baseUrl = options.baseUrl || '';

        // Remove trailing slash from baseUrl if present
        if (this.baseUrl && this.baseUrl.endsWith('/')) {
            this.baseUrl = this.baseUrl.slice(0, -1);
        }
    }

    /**
     * Makes an HTTP request using XMLHttpRequest
     * 
     * @param {Object} config - Request configuration
     * @param {string} config.method - HTTP method (GET, POST, PUT, DELETE, etc.)
     * @param {string} config.url - Request URL (will be appended to baseUrl)
     * @param {Object} [config.headers={}] - Request headers
     * @param {Object|string} [config.data=null] - Request body data
     * @param {number} [config.timeout] - Request timeout (overrides default)
     * @returns {Promise<Object>} - Promise resolving to the response data
     */
    request(config) {
        const { method, url, headers = {}, data = null, timeout = this.timeout } = config;

        // Combine base URL with request URL
        const fullUrl = this._buildUrl(url);

        // Create a new promise for the XHR request
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            // Set up the request
            xhr.open(method.toUpperCase(), fullUrl, true);

            // Set timeout
            xhr.timeout = timeout;

            // Set up response handling
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    // Parse response data
                    const responseData = this._parseResponse(xhr);

                    // Parse headers
                    const responseHeaders = this._parseHeaders(xhr.getAllResponseHeaders());

                    // Resolve with unified response format
                    resolve({
                        data: responseData,
                        status: xhr.status,
                        statusText: xhr.statusText,
                        headers: responseHeaders,
                        config
                    });
                } else {
                    // Create error for non-2xx responses
                    const error = new Error(`Request failed with status code ${xhr.status}`);
                    error.response = {
                        data: this._parseResponse(xhr),
                        status: xhr.status,
                        statusText: xhr.statusText,
                        headers: this._parseHeaders(xhr.getAllResponseHeaders()),
                        config
                    };
                    reject(error);
                }
            };

            // Handle network errors
            xhr.onerror = () => {
                const error = new Error('Network Error');
                error.config = config;
                reject(error);
            };

            // Handle timeouts
            xhr.ontimeout = () => {
                const error = new Error(`Request timeout after ${timeout}ms`);
                error.config = config;
                reject(error);
            };

            // Set headers
            const requestHeaders = { ...this.headers, ...headers };
            Object.keys(requestHeaders).forEach(key => {
                xhr.setRequestHeader(key, requestHeaders[key]);
            });

            // Send the request
            if (method.toUpperCase() !== 'GET' && data !== null) {
                // Prepare data for sending
                let requestData = data;
                if (typeof data === 'object' && !(data instanceof FormData)) {
                    requestData = JSON.stringify(data);
                    // Set content type to JSON if not already set
                    if (!requestHeaders['Content-Type']) {
                        xhr.setRequestHeader('Content-Type', 'application/json');
                    }
                }
                xhr.send(requestData);
            } else {
                xhr.send();
            }
        });
    }

    /**
     * Builds a full URL by combining the base URL with the request URL
     * 
     * @private
     * @param {string} url - Request URL
     * @returns {string} - Full URL
     */
    _buildUrl(url) {
        // If URL is already absolute, return it as is
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
            return url;
        }

        // Handle null or undefined URL
        if (!url) {
            throw new Error('URL cannot be null or undefined');
        }

        // Remove leading slash from URL if present to avoid double slashes
        const cleanUrl = url.startsWith('/') ? url.slice(1) : url;

        // Ensure baseUrl is valid
        if (!this.baseUrl) {
            throw new Error('Base URL is not configured');
        }

        // Remove trailing slash from baseUrl if present
        const baseUrlWithoutTrailingSlash = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;

        // Combine base URL with request URL
        const fullUrl = `${baseUrlWithoutTrailingSlash}/${cleanUrl}`;

        try {
            // Validate URL by creating a URL object
            new URL(fullUrl);
            return fullUrl;
        } catch (error) {
            // Provide detailed error message for debugging
            throw new Error(`Failed to construct valid URL from base "${this.baseUrl}" and path "${url}": ${error.message}`);
        }
    }

    /**
     * Parses the response based on content type
     * 
     * @private
     * @param {XMLHttpRequest} xhr - XMLHttpRequest object
     * @returns {*} - Parsed response data
     */
    _parseResponse(xhr) {
        const contentType = xhr.getResponseHeader('content-type') || '';

        // Handle different response types
        if (contentType.includes('application/json')) {
            try {
                return JSON.parse(xhr.responseText);
            } catch (e) {
                // If JSON parsing fails, return the raw text
                return xhr.responseText;
            }
        } else if (contentType.includes('text/')) {
            return xhr.responseText;
        } else {
            // For binary data or other types, return response
            return xhr.response;
        }
    }

    /**
     * Parses the headers string into an object
     * 
     * @private
     * @param {string} headersString - Headers string from XMLHttpRequest
     * @returns {Object} - Headers object
     */
    _parseHeaders(headersString) {
        const headers = {};

        if (!headersString) {
            return headers;
        }

        // Split headers by newline and process each line
        const headerLines = headersString.split('\r\n');
        headerLines.forEach(line => {
            const parts = line.split(': ');
            const key = parts.shift();
            const value = parts.join(': ');

            if (key && value) {
                headers[key.toLowerCase()] = value;
            }
        });

        return headers;
    }
}

export default XhrAdapter;