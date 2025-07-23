import logger from "./Logger.js";

/**
 * Smart Endpoint Router - Automatically selects the best API endpoint
 * based on environment detection and endpoint availability
 */
class SmartEndpointRouter {
  constructor(config = {}) {
    this.primaryEndpoint =
      config.primaryEndpoint || "https://api-testluy.paragoniu.app";
    this.bypassEndpoint =
      config.bypassEndpoint || "https://sdk-testluy.paragoniu.app";
    this.testTimeout = config.testTimeout || 5000; // 5 seconds
    this.environmentDetector = new EnvironmentDetector();
    this.selectedEndpoint = null;
    this.lastTestTime = null;
    this.testCacheMs = config.testCacheMs || 300000; // 5 minutes cache
  }

  /**
   * Select the best endpoint based on environment and availability
   * @returns {Promise<string>} The selected endpoint URL
   */
  async selectEndpoint() {
    // Use cached result if recent
    if (this.selectedEndpoint && this.isCacheValid()) {
      logger.debug(
        `SmartEndpointRouter: Using cached endpoint: ${this.selectedEndpoint}`
      );
      return this.selectedEndpoint;
    }

    const envInfo = this.environmentDetector.getEnvironmentInfo();
    logger.info(
      `SmartEndpointRouter: Environment detected: ${JSON.stringify(envInfo)}`
    );

    // If we're in a deployment environment, try bypass endpoint first
    if (envInfo.isDeployment) {
      logger.info(
        "SmartEndpointRouter: Deployment environment detected, testing bypass endpoint"
      );

      if (await this.testEndpointAvailability(this.bypassEndpoint)) {
        logger.info(
          `SmartEndpointRouter: Bypass endpoint available: ${this.bypassEndpoint}`
        );
        this.selectedEndpoint = this.bypassEndpoint;
        this.lastTestTime = Date.now();
        return this.bypassEndpoint;
      } else {
        logger.warn(
          `SmartEndpointRouter: Bypass endpoint not available: ${this.bypassEndpoint}`
        );
      }
    }

    // Test primary endpoint
    if (await this.testEndpointAvailability(this.primaryEndpoint)) {
      logger.info(
        `SmartEndpointRouter: Using primary endpoint: ${this.primaryEndpoint}`
      );
      this.selectedEndpoint = this.primaryEndpoint;
      this.lastTestTime = Date.now();
      return this.primaryEndpoint;
    }

    // If primary also fails, still return it (let the actual request handle the error)
    logger.warn(
      "SmartEndpointRouter: Primary endpoint test failed, but using it anyway"
    );
    this.selectedEndpoint = this.primaryEndpoint;
    this.lastTestTime = Date.now();
    return this.primaryEndpoint;
  }

  /**
   * Test if an endpoint is available and responsive
   * @param {string} endpoint - The endpoint URL to test
   * @returns {Promise<boolean>} True if endpoint is available
   */
  async testEndpointAvailability(endpoint) {
    try {
      logger.debug(
        `SmartEndpointRouter: Testing endpoint availability: ${endpoint}`
      );

      // Create a simple health check request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.testTimeout);

      const response = await fetch(`${endpoint}/health`, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": "TestluySDK-HealthCheck/1.0",
          Accept: "application/json",
        },
      });

      clearTimeout(timeoutId);

      // Consider endpoint available if we get any response (even 404)
      // The key is that we can reach the server
      const isAvailable = response.status < 500;

      logger.debug(
        `SmartEndpointRouter: Endpoint ${endpoint} test result: ${isAvailable} (status: ${response.status})`
      );
      return isAvailable;
    } catch (error) {
      logger.debug(
        `SmartEndpointRouter: Endpoint ${endpoint} test failed: ${error.message}`
      );

      // If it's an abort error, consider it unavailable
      if (error.name === "AbortError") {
        logger.debug(`SmartEndpointRouter: Endpoint ${endpoint} timed out`);
        return false;
      }

      // For other errors (network, DNS, etc.), consider unavailable
      return false;
    }
  }

  /**
   * Check if the cached endpoint selection is still valid
   * @returns {boolean} True if cache is valid
   */
  isCacheValid() {
    if (!this.lastTestTime) return false;
    return Date.now() - this.lastTestTime < this.testCacheMs;
  }

  /**
   * Force a fresh endpoint selection on next call
   */
  invalidateCache() {
    this.selectedEndpoint = null;
    this.lastTestTime = null;
    logger.debug("SmartEndpointRouter: Cache invalidated");
  }

  /**
   * Get the currently selected endpoint without testing
   * @returns {string|null} The currently selected endpoint or null
   */
  getCurrentEndpoint() {
    return this.selectedEndpoint;
  }
}

/**
 * Environment Detector - Detects deployment environments and platform types
 */
class EnvironmentDetector {
  /**
   * Check if we're running in a deployment environment
   * @returns {boolean} True if in deployment environment
   */
  isDeploymentEnvironment() {
    // Check for common deployment platform environment variables
    return !!(
      process.env.VERCEL ||
      process.env.NETLIFY ||
      process.env.RENDER ||
      process.env.HEROKU ||
      process.env.RAILWAY ||
      process.env.FLY_APP_NAME ||
      (process.env.NODE_ENV === "production" && this.hasDeploymentIndicators())
    );
  }

  /**
   * Check for general deployment indicators
   * @returns {boolean} True if deployment indicators are present
   */
  hasDeploymentIndicators() {
    return !!(
      process.env.CI ||
      process.env.BUILD_ID ||
      process.env.DEPLOYMENT_ID ||
      process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      this.isServerEnvironment()
    );
  }

  /**
   * Check if running in server-side environment
   * @returns {boolean} True if server environment
   */
  isServerEnvironment() {
    return typeof window === "undefined" && typeof process !== "undefined";
  }

  /**
   * Get comprehensive environment information
   * @returns {object} Environment details
   */
  getEnvironmentInfo() {
    return {
      isDeployment: this.isDeploymentEnvironment(),
      platform: this.detectPlatform(),
      isServer: this.isServerEnvironment(),
      nodeEnv: process.env.NODE_ENV || "development",
      hasCI: !!process.env.CI,
      userAgent: this.getUserAgent(),
    };
  }

  /**
   * Detect the specific deployment platform
   * @returns {string} Platform name or 'unknown'
   */
  detectPlatform() {
    if (process.env.VERCEL) return "vercel";
    if (process.env.NETLIFY) return "netlify";
    if (process.env.RENDER) return "render";
    if (process.env.HEROKU) return "heroku";
    if (process.env.RAILWAY) return "railway";
    if (process.env.FLY_APP_NAME) return "fly";
    if (process.env.GITHUB_ACTIONS) return "github-actions";
    if (process.env.GITLAB_CI) return "gitlab-ci";
    return "unknown";
  }

  /**
   * Get appropriate User-Agent string for the environment
   * @returns {string} User-Agent string
   */
  getUserAgent() {
    const platform = this.detectPlatform();
    const nodeVersion = process.version || "unknown";

    return `TestluySDK/1.0 (${platform}; Node.js ${nodeVersion})`;
  }
}

export default SmartEndpointRouter;
export { EnvironmentDetector };
