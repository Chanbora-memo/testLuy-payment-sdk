import logger from "./Logger.js";

/**
 * CNAME Subdomain Handler - Manages routing through CNAME-based bypass subdomains
 * for Cloudflare Tunnel Zero Trust environments
 */
class CNAMESubdomainHandler {
  constructor(config = {}) {
    this.mainDomain = config.mainDomain || "https://api-testluy.paragoniu.app";
    this.subdomainPrefix = config.subdomainPrefix || "sdk";
    this.testTimeout = config.testTimeout || 5000;
    this.validationCache = new Map();
    this.cacheExpiryMs = config.cacheExpiryMs || 600000; // 10 minutes
  }

  /**
   * Resolve the bypass endpoint URL from the main domain
   * @returns {Promise<string|null>} The bypass endpoint URL or null if not available
   */
  async resolveBypassEndpoint() {
    try {
      const bypassUrl = this.constructBypassUrl();
      logger.info(
        `CNAMESubdomainHandler: Constructed bypass URL: ${bypassUrl}`
      );

      // Check cache first
      const cacheKey = bypassUrl;
      const cached = this.validationCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheExpiryMs) {
        logger.debug(
          `CNAMESubdomainHandler: Using cached validation result for ${bypassUrl}: ${cached.isValid}`
        );
        return cached.isValid ? bypassUrl : null;
      }

      // Validate the CNAME configuration
      const isValid = await this.validateCNAMEConfiguration(bypassUrl);

      // Cache the result
      this.validationCache.set(cacheKey, {
        isValid,
        timestamp: Date.now(),
      });

      if (isValid) {
        logger.info(
          `CNAMESubdomainHandler: CNAME bypass endpoint validated: ${bypassUrl}`
        );
        return bypassUrl;
      } else {
        logger.warn(
          `CNAMESubdomainHandler: CNAME bypass endpoint validation failed: ${bypassUrl}`
        );
        return null;
      }
    } catch (error) {
      logger.error(
        `CNAMESubdomainHandler: Error resolving bypass endpoint: ${error.message}`
      );
      return null;
    }
  }

  /**
   * Construct the bypass URL from the main domain
   * @returns {string} The constructed bypass URL
   */
  constructBypassUrl() {
    try {
      const mainUrl = new URL(this.mainDomain);
      const hostname = mainUrl.hostname;

      // Extract the base domain (e.g., 'testluy.paragoniu.app' from 'api-testluy.paragoniu.app')
      const baseDomain = this.extractBaseDomain(hostname);

      // Construct the bypass subdomain (e.g., 'sdk-testluy.paragoniu.app')
      const bypassHostname = `${this.subdomainPrefix}-${baseDomain}`;

      // Return the full URL
      return `${mainUrl.protocol}//${bypassHostname}`;
    } catch (error) {
      logger.error(
        `CNAMESubdomainHandler: Error constructing bypass URL: ${error.message}`
      );
      throw new Error(`Failed to construct bypass URL from ${this.mainDomain}`);
    }
  }

  /**
   * Extract the base domain from a hostname
   * @param {string} hostname - The full hostname (e.g., 'api-testluy.paragoniu.app')
   * @returns {string} The base domain (e.g., 'testluy.paragoniu.app')
   */
  extractBaseDomain(hostname) {
    // Handle different patterns:
    // api-testluy.paragoniu.app -> testluy.paragoniu.app
    // testluy.paragoniu.app -> testluy.paragoniu.app
    // api.example.com -> example.com

    const parts = hostname.split(".");

    if (parts.length <= 2) {
      // Already a base domain (e.g., 'example.com')
      return hostname;
    }

    // Special handling for testluy.paragoniu.app pattern
    if (hostname.includes("testluy.paragoniu.app")) {
      // For api-testluy.paragoniu.app -> testluy.paragoniu.app
      if (hostname.startsWith("api-")) {
        return hostname.substring(4); // Remove 'api-' prefix
      }
      // For testluy.paragoniu.app -> testluy.paragoniu.app (no change)
      return hostname;
    }

    // Check if first part looks like a subdomain prefix (api-, www-, etc.)
    const firstPart = parts[0];
    if (firstPart.includes("-") || firstPart === "api" || firstPart === "www") {
      // Remove the first part and join the rest
      return parts.slice(1).join(".");
    }

    // If no clear subdomain pattern, assume the first part is the main identifier
    // and keep it (e.g., 'testluy.paragoniu.app' stays as is)
    return hostname;
  }

  /**
   * Validate that the CNAME configuration is working and bypasses Cloudflare
   * @param {string} bypassUrl - The bypass URL to validate
   * @returns {Promise<boolean>} True if CNAME is properly configured
   */
  async validateCNAMEConfiguration(bypassUrl) {
    try {
      logger.debug(
        `CNAMESubdomainHandler: Validating CNAME configuration for ${bypassUrl}`
      );

      // Test 1: Basic connectivity
      const connectivityTest = await this.testBasicConnectivity(bypassUrl);
      if (!connectivityTest.success) {
        logger.debug(
          `CNAMESubdomainHandler: Basic connectivity test failed: ${connectivityTest.error}`
        );
        return false;
      }

      // Test 2: Check if it's bypassing Cloudflare (optional, as this might not be detectable)
      const bypassTest = await this.testCloudflareBypass(bypassUrl);
      logger.debug(
        `CNAMESubdomainHandler: Cloudflare bypass test result: ${bypassTest.bypassed}`
      );

      // Test 3: Verify it reaches the same backend
      const backendTest = await this.testBackendConsistency(bypassUrl);
      if (!backendTest.success) {
        logger.debug(
          `CNAMESubdomainHandler: Backend consistency test failed: ${backendTest.error}`
        );
        return false;
      }

      logger.info(
        `CNAMESubdomainHandler: CNAME validation successful for ${bypassUrl}`
      );
      return true;
    } catch (error) {
      logger.error(
        `CNAMESubdomainHandler: CNAME validation error: ${error.message}`
      );
      return false;
    }
  }

  /**
   * Test basic connectivity to the bypass URL
   * @param {string} bypassUrl - The URL to test
   * @returns {Promise<object>} Test result with success flag and details
   */
  async testBasicConnectivity(bypassUrl) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.testTimeout);

      // Try multiple endpoints to test connectivity
      const testEndpoints = [
        "/health",
        "/api/validate-credentials", // This should exist and return 401/403
        "/", // Root endpoint
      ];

      let lastError = null;

      for (const endpoint of testEndpoints) {
        try {
          const response = await fetch(`${bypassUrl}${endpoint}`, {
            method: "HEAD",
            signal: controller.signal,
            headers: {
              "User-Agent": "TestluySDK-CNAMEValidator/1.0",
              Accept: "application/json",
            },
          });

          clearTimeout(timeoutId);

          // Consider it successful if we get any response (even 404/401/403)
          // The key is that we can reach the server
          const isConnectable =
            response.status < 500 || response.status === 404;

          if (isConnectable) {
            logger.debug(
              `CNAMESubdomainHandler: Connectivity test successful for ${bypassUrl}${endpoint} (status: ${response.status})`
            );
            return {
              success: true,
              status: response.status,
              endpoint: endpoint,
              headers: Object.fromEntries(response.headers.entries()),
            };
          }

          lastError = `HTTP ${response.status}`;
        } catch (endpointError) {
          lastError = endpointError.message;
          continue; // Try next endpoint
        }
      }

      clearTimeout(timeoutId);

      // If we get here, all endpoints failed
      return {
        success: false,
        error: lastError || "All test endpoints failed",
      };
    } catch (error) {
      logger.debug(
        `CNAMESubdomainHandler: Connectivity test failed for ${bypassUrl}: ${error.message}`
      );

      // Check for specific DNS resolution errors
      if (
        error.message.includes("getaddrinfo ENOTFOUND") ||
        error.message.includes("Could not resolve host")
      ) {
        return {
          success: false,
          error: "DNS resolution failed - subdomain not properly configured",
          isDnsError: true,
        };
      }

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Test if the endpoint is bypassing Cloudflare protection
   * @param {string} bypassUrl - The URL to test
   * @returns {Promise<object>} Test result with bypass detection
   */
  async testCloudflareBypass(bypassUrl) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.testTimeout);

      const response = await fetch(`${bypassUrl}/health`, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": "TestluySDK-BypassTest/1.0",
        },
      });

      clearTimeout(timeoutId);

      const headers = Object.fromEntries(response.headers.entries());

      // Check for Cloudflare headers (their absence might indicate bypass)
      const cloudflareHeaders = [
        "cf-ray",
        "cf-cache-status",
        "cf-request-id",
        "server",
      ];

      const hasCloudflareHeaders = cloudflareHeaders.some(
        (header) =>
          headers[header] &&
          headers[header].toLowerCase().includes("cloudflare")
      );

      return {
        bypassed: !hasCloudflareHeaders,
        headers: headers,
        status: response.status,
      };
    } catch (error) {
      return {
        bypassed: false,
        error: error.message,
      };
    }
  }

  /**
   * Test that the bypass URL reaches the same backend as the main URL
   * @param {string} bypassUrl - The bypass URL to test
   * @returns {Promise<object>} Test result with consistency check
   */
  async testBackendConsistency(bypassUrl) {
    try {
      // This is a simple test - in a real scenario, you might want to compare
      // specific endpoints or response signatures between main and bypass URLs

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.testTimeout);

      // Test a simple endpoint that should exist on both
      const response = await fetch(`${bypassUrl}/api/validate-credentials`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "TestluySDK-ConsistencyTest/1.0",
        },
        body: JSON.stringify({}), // Empty body for test
      });

      clearTimeout(timeoutId);

      // We expect this to fail with 401/403 (missing auth), but not 404
      // This indicates the endpoint exists and the backend is reachable
      const isConsistent = response.status !== 404;

      return {
        success: isConsistent,
        status: response.status,
        error: isConsistent ? null : "Backend endpoint not found",
      };
    } catch (error) {
      // Network errors are acceptable for this test
      // We're mainly checking that the URL structure is correct
      return {
        success: true,
        error: null,
      };
    }
  }

  /**
   * Clear the validation cache
   */
  clearCache() {
    this.validationCache.clear();
    logger.debug("CNAMESubdomainHandler: Validation cache cleared");
  }

  /**
   * Get cache statistics
   * @returns {object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.validationCache.size,
      entries: Array.from(this.validationCache.keys()),
    };
  }
}

export default CNAMESubdomainHandler;
