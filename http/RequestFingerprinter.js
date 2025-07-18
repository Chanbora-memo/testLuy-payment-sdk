/**
 * @fileoverview
 * RequestFingerprinter - A module for generating realistic browser-like request signatures
 * to help bypass Cloudflare and other anti-bot protections.
 */

/**
 * RequestFingerprinter class for generating realistic browser fingerprints
 * to avoid detection by Cloudflare and other anti-bot systems.
 * 
 * @class
 */
class RequestFingerprinter {
  /**
   * Creates a new RequestFingerprinter instance
   * 
   * @param {Object} options - Configuration options
   * @param {boolean} [options.rotateUserAgent=true] - Whether to rotate User-Agent strings
   * @param {boolean} [options.includeSecHeaders=true] - Whether to include Sec-* headers
   * @param {boolean} [options.randomizeHeaderOrder=true] - Whether to randomize header order
   * @param {Object} [options.customHeaders={}] - Custom headers to include in all requests
   * @param {number} [options.jitterFactor=0.3] - Factor for timing jitter (0-1)
   */
  constructor(options = {}) {
    this.options = {
      rotateUserAgent: options.rotateUserAgent !== false,
      includeSecHeaders: options.includeSecHeaders !== false,
      randomizeHeaderOrder: options.randomizeHeaderOrder !== false,
      customHeaders: options.customHeaders || {},
      jitterFactor: options.jitterFactor || 0.3
    };
    
    // Initialize last used User-Agent index for rotation
    this.lastUserAgentIndex = -1;
  }
  
  /**
   * Generates browser-like headers for HTTP requests
   * 
   * @param {Object} [options={}] - Additional options for header generation
   * @param {string} [options.url] - The URL being requested (for referer and origin)
   * @param {string} [options.method='GET'] - The HTTP method being used
   * @param {Object} [options.customHeaders={}] - Custom headers to include in this request
   * @returns {Object} Generated headers object
   */
  generateHeaders(options = {}) {
    const url = options.url || '';
    const method = options.method || 'GET';
    const customHeaders = options.customHeaders || {};
    
    // Parse URL to get origin and hostname
    let origin = '';
    let hostname = '';
    let contentType = '';
    
    try {
      if (url) {
        const parsedUrl = new URL(url);
        origin = parsedUrl.origin;
        hostname = parsedUrl.hostname;
        
        // Try to determine content type from URL path
        if (parsedUrl.pathname.endsWith('.json')) {
          contentType = 'application/json';
        } else if (parsedUrl.pathname.endsWith('.html') || parsedUrl.pathname.endsWith('/')) {
          contentType = 'text/html';
        }
      }
    } catch (error) {
      // Invalid URL, leave origin and hostname empty
    }
    
    // Base headers that most browsers include
    const headers = {
      'Accept': this.generateAcceptHeader(contentType),
      'Accept-Language': this.generateAcceptLanguage(),
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'DNT': '1',
    };
    
    // Add User-Agent
    if (this.options.rotateUserAgent) {
      headers['User-Agent'] = this.generateUserAgent();
    }
    
    // Add origin and referer if URL is provided
    if (origin) {
      headers['Origin'] = origin;
    }
    
    if (url && method !== 'GET') {
      headers['Referer'] = url;
    }
    
    // Add Sec-Fetch headers for modern browsers if enabled
    if (this.options.includeSecHeaders) {
      // Generate appropriate Sec-Fetch headers based on the request context
      const secFetchHeaders = this.generateSecFetchHeaders(method, url);
      Object.assign(headers, secFetchHeaders);
      
      // Add Client Hints headers
      headers['Sec-CH-UA'] = this.generateSecChUA();
      headers['Sec-CH-UA-Mobile'] = '?0';
      headers['Sec-CH-UA-Platform'] = this.generatePlatform();
    }
    
    // Add global custom headers from constructor
    Object.assign(headers, this.options.customHeaders);
    
    // Add request-specific custom headers
    Object.assign(headers, customHeaders);
    
    // Randomize header order if enabled
    if (this.options.randomizeHeaderOrder) {
      return this.randomizeHeaderOrder(headers);
    }
    
    return headers;
  }
  
  /**
   * Generates appropriate Sec-Fetch headers based on request context
   * 
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @returns {Object} Sec-Fetch headers
   */
  generateSecFetchHeaders(method, url) {
    const headers = {};
    let dest = 'empty';
    let mode = 'cors';
    let site = 'cross-site';
    let user = '?1';
    
    try {
      if (url) {
        const parsedUrl = new URL(url);
        
        // Determine Sec-Fetch-Site
        if (typeof window !== 'undefined' && window.location) {
          const currentOrigin = window.location.origin;
          if (parsedUrl.origin === currentOrigin) {
            site = 'same-origin';
          } else if (parsedUrl.hostname === new URL(currentOrigin).hostname) {
            site = 'same-site';
          } else {
            site = 'cross-site';
          }
        } else {
          site = 'none';
        }
        
        // Determine Sec-Fetch-Dest based on URL
        if (parsedUrl.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i)) {
          dest = 'image';
        } else if (parsedUrl.pathname.match(/\.(css)$/i)) {
          dest = 'style';
        } else if (parsedUrl.pathname.match(/\.(js)$/i)) {
          dest = 'script';
        } else if (parsedUrl.pathname.match(/\.(html|htm)$/i)) {
          dest = 'document';
        } else if (parsedUrl.pathname.includes('/api/') || 
                  parsedUrl.pathname.includes('/v1/') || 
                  parsedUrl.pathname.includes('/v2/')) {
          dest = 'empty';
        }
        
        // Determine Sec-Fetch-Mode based on method and URL
        if (method === 'GET' && dest === 'document') {
          mode = 'navigate';
        } else if (dest === 'image' || dest === 'style' || dest === 'script') {
          mode = 'no-cors';
        } else {
          mode = 'cors';
        }
      }
    } catch (error) {
      // Use defaults on error
    }
    
    headers['Sec-Fetch-Dest'] = dest;
    headers['Sec-Fetch-Mode'] = mode;
    headers['Sec-Fetch-Site'] = site;
    
    // Only add Sec-Fetch-User for navigation requests
    if (mode === 'navigate') {
      headers['Sec-Fetch-User'] = user;
    }
    
    return headers;
  }
  
  /**
   * Generates a realistic Accept header based on content type and browser patterns
   * 
   * @param {string} [contentType=''] - Expected content type
   * @returns {string} A realistic Accept header value
   */
  generateAcceptHeader(contentType = '') {
    // Common Accept headers by content type
    const acceptHeaders = {
      // For JSON API requests
      json: [
        'application/json, text/plain, */*',
        'application/json, text/javascript, */*; q=0.01',
        'application/json, text/plain, */*; q=0.01'
      ],
      
      // For HTML document requests
      html: [
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      ],
      
      // For general requests
      general: [
        '*/*',
        'text/plain, */*; q=0.01',
        'application/json, text/javascript, */*; q=0.01'
      ]
    };
    
    let category = 'general';
    
    if (contentType.includes('json')) {
      category = 'json';
    } else if (contentType.includes('html')) {
      category = 'html';
    }
    
    const headers = acceptHeaders[category];
    return headers[Math.floor(Math.random() * headers.length)];
  }
  
  /**
   * Randomizes the order of headers to avoid fingerprinting
   * 
   * @param {Object} headers - Headers object to randomize
   * @returns {Object} Randomized headers object
   */
  randomizeHeaderOrder(headers) {
    // Convert headers object to array of [key, value] pairs
    const headerEntries = Object.entries(headers);
    
    // Shuffle the array using Fisher-Yates algorithm
    for (let i = headerEntries.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [headerEntries[i], headerEntries[j]] = [headerEntries[j], headerEntries[i]];
    }
    
    // Convert back to object
    return Object.fromEntries(headerEntries);
  }
  
  /**
   * Generates a realistic User-Agent string from a pool of modern browser User-Agents
   * 
   * @returns {string} A realistic User-Agent string
   */
  generateUserAgent() {
    // Pool of realistic and up-to-date User-Agent strings for modern browsers
    const userAgents = [
      // Chrome on Windows
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
      
      // Chrome on macOS
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
      
      // Firefox on Windows
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/116.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0',
      
      // Firefox on macOS
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/115.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/116.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/117.0',
      
      // Safari on macOS
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
      
      // Edge on Windows
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.58',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 Edg/115.0.1901.183',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 Edg/116.0.1938.54'
    ];
    
    // Rotate through user agents to avoid using the same one repeatedly
    // but also avoid obvious patterns like sequential rotation
    let index;
    do {
      index = Math.floor(Math.random() * userAgents.length);
    } while (index === this.lastUserAgentIndex && userAgents.length > 1);
    
    this.lastUserAgentIndex = index;
    return userAgents[index];
  }
  
  /**
   * Generates a realistic Accept-Language header
   * 
   * @returns {string} A realistic Accept-Language header value
   */
  generateAcceptLanguage() {
    const languages = [
      // English variants with quality values
      'en-US,en;q=0.9',
      'en-US,en;q=0.8',
      'en-GB,en;q=0.9,en-US;q=0.8',
      'en-CA,en;q=0.9,en-US;q=0.8',
      'en-AU,en;q=0.9,en-US;q=0.8',
      
      // English with other languages
      'en-US,en;q=0.9,es;q=0.8',
      'en-US,en;q=0.9,fr;q=0.8',
      'en-US,en;q=0.9,de;q=0.8',
      'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
      'en-US,en;q=0.9,ja;q=0.8',
      'en-US,en;q=0.9,ko;q=0.8',
      'en-US,en;q=0.9,pt;q=0.8',
      'en-US,en;q=0.9,ru;q=0.8',
      
      // Other primary languages
      'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
      'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
      'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
      'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
      'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
      'zh-TW,zh-HK;q=0.9,zh;q=0.8,en-US;q=0.7,en;q=0.6',
      'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
      'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
      'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
    ];
    
    return languages[Math.floor(Math.random() * languages.length)];
  }
  
  /**
   * Generates a realistic Sec-CH-UA header for Chrome
   * 
   * @returns {string} A Sec-CH-UA header value
   */
  generateSecChUA() {
    const versions = [
      '"Google Chrome";v="114", "Chromium";v="114", "Not=A?Brand";v="99"',
      '"Google Chrome";v="115", "Chromium";v="115", "Not=A?Brand";v="99"',
      '"Google Chrome";v="116", "Chromium";v="116", "Not=A?Brand";v="99"',
      '"Microsoft Edge";v="114", "Chromium";v="114", "Not=A?Brand";v="99"',
      '"Microsoft Edge";v="115", "Chromium";v="115", "Not=A?Brand";v="99"',
      '"Microsoft Edge";v="116", "Chromium";v="116", "Not=A?Brand";v="99"'
    ];
    
    return versions[Math.floor(Math.random() * versions.length)];
  }
  
  /**
   * Generates a realistic platform string for Sec-CH-UA-Platform
   * 
   * @returns {string} A platform string
   */
  generatePlatform() {
    const platforms = [
      '"Windows"',
      '"macOS"',
      '"Linux"'
    ];
    
    return platforms[Math.floor(Math.random() * platforms.length)];
  }
  
  /**
   * Adds a random delay to simulate human-like request timing
   * 
   * @param {number} [baseDelay=0] - Base delay in milliseconds
   * @returns {Promise<void>} A promise that resolves after the delay
   */
  async addRandomDelay(baseDelay = 0) {
    const jitter = baseDelay * this.options.jitterFactor;
    const randomJitter = Math.random() * jitter * 2 - jitter; // Range: -jitter to +jitter
    const delay = Math.max(0, baseDelay + randomJitter);
    
    return new Promise(resolve => setTimeout(resolve, delay));
  }
  
  /**
   * Creates a request interceptor that adds browser-like headers
   * 
   * @returns {Object} A request interceptor for EnhancedHttpClient
   */
  createRequestInterceptor() {
    const self = this;
    
    return {
      async onRequest(config) {
        // Generate browser-like headers
        const headers = self.generateHeaders({
          url: config.url,
          method: config.method,
          customHeaders: config.headers
        });
        
        // Add random delay if jitter is enabled
        if (self.options.jitterFactor > 0) {
          await self.addRandomDelay(100); // Small base delay of 100ms
        }
        
        // Return modified config with browser-like headers
        return {
          ...config,
          headers: {
            ...headers,
            ...config.headers // Ensure original headers take precedence
          }
        };
      }
    };
  }
}

export default RequestFingerprinter;