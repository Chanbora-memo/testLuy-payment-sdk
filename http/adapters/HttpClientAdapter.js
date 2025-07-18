/**
 * HttpClientAdapter - Provides a unified HTTP client interface across different environments
 * 
 * This module selects and configures the appropriate HTTP client based on the runtime environment:
 * - Node.js: Uses axios or node-fetch
 * - Modern browsers: Uses fetch API
 * - Legacy browsers: Uses XMLHttpRequest
 */

import { detectEnvironment, Environment, getOptimalHttpClient } from '../utils/EnvironmentDetector.js';

// Import adapters (these would be separate files in a real implementation)
import FetchAdapter from './FetchAdapter.js';
import XhrAdapter from './XhrAdapter.js';
import NodeAdapter from './NodeAdapter.js';

/**
 * Creates an HTTP client adapter appropriate for the current environment
 * 
 * @param {Object} options - Configuration options for the HTTP client
 * @returns {Object} An HTTP client adapter with a unified interface
 */
export function createHttpClient(options = {}) {
  const environment = detectEnvironment();
  const clientType = options.forceClient || getOptimalHttpClient();
  
  // Select the appropriate adapter based on environment and available features
  switch (clientType) {
    case 'fetch':
      return new FetchAdapter(options);
    case 'xhr':
      return new XhrAdapter(options);
    case 'node-fetch':
    case 'axios':
      return new NodeAdapter(options);
    default:
      // Default to the most compatible option
      return new XhrAdapter(options);
  }
}

export default { createHttpClient };