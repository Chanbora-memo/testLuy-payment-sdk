/**
 * EnvironmentDetector - Detects and provides information about the current runtime environment
 *
 * This module helps the SDK adapt its behavior based on whether it's running in:
 * - Node.js
 * - Modern browsers
 * - Legacy browsers
 * - React Native
 * - Other JavaScript environments
 */

/**
 * Environment types
 * @enum {string}
 */
export const Environment = {
  NODE: "node",
  BROWSER_MODERN: "browser-modern",
  BROWSER_LEGACY: "browser-legacy",
  REACT_NATIVE: "react-native",
  UNKNOWN: "unknown",
};

/**
 * Browser types
 * @enum {string}
 */
export const BrowserType = {
  CHROME: "chrome",
  FIREFOX: "firefox",
  SAFARI: "safari",
  EDGE: "edge",
  IE: "ie",
  OPERA: "opera",
  OTHER: "other",
};

/**
 * Detects the current JavaScript runtime environment
 * @returns {Environment} The detected environment type
 */
export function detectEnvironment() {
  // Check for Node.js
  if (
    typeof process !== "undefined" &&
    process.versions != null &&
    process.versions.node != null
  ) {
    return Environment.NODE;
  }

  // Check for React Native
  if (typeof navigator !== "undefined" && navigator.product === "ReactNative") {
    return Environment.REACT_NATIVE;
  }

  // Check for modern browser
  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    return Environment.BROWSER_MODERN;
  }

  // Check for any browser
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    return Environment.BROWSER_LEGACY;
  }

  // Unknown environment
  return Environment.UNKNOWN;
}

/**
 * Detects the browser type if in a browser environment
 * @returns {BrowserType|null} The detected browser type or null if not in a browser
 */
export function detectBrowser() {
  const environment = detectEnvironment();

  if (
    environment !== Environment.BROWSER_MODERN &&
    environment !== Environment.BROWSER_LEGACY
  ) {
    return null;
  }

  const userAgent = navigator.userAgent;

  // Detect browser type from user agent
  if (userAgent.indexOf("Chrome") !== -1 && userAgent.indexOf("Edg") === -1) {
    return BrowserType.CHROME;
  } else if (userAgent.indexOf("Firefox") !== -1) {
    return BrowserType.FIREFOX;
  } else if (
    userAgent.indexOf("Safari") !== -1 &&
    userAgent.indexOf("Chrome") === -1
  ) {
    return BrowserType.SAFARI;
  } else if (userAgent.indexOf("Edg") !== -1) {
    return BrowserType.EDGE;
  } else if (userAgent.indexOf("Trident") !== -1) {
    return BrowserType.IE;
  } else if (
    userAgent.indexOf("Opera") !== -1 ||
    userAgent.indexOf("OPR") !== -1
  ) {
    return BrowserType.OPERA;
  } else {
    return BrowserType.OTHER;
  }
}

/**
 * Detects browser version if in a browser environment
 * @returns {string|null} The detected browser version or null if not in a browser
 */
export function detectBrowserVersion() {
  const environment = detectEnvironment();

  if (
    environment !== Environment.BROWSER_MODERN &&
    environment !== Environment.BROWSER_LEGACY
  ) {
    return null;
  }

  const browser = detectBrowser();
  const userAgent = navigator.userAgent;

  // Extract version based on browser type
  switch (browser) {
    case BrowserType.CHROME:
      return userAgent.match(/Chrome\/([0-9.]+)/)?.[1] || null;
    case BrowserType.FIREFOX:
      return userAgent.match(/Firefox\/([0-9.]+)/)?.[1] || null;
    case BrowserType.SAFARI:
      return userAgent.match(/Version\/([0-9.]+)/)?.[1] || null;
    case BrowserType.EDGE:
      return userAgent.match(/Edg\/([0-9.]+)/)?.[1] || null;
    case BrowserType.IE:
      return userAgent.match(/rv:([0-9.]+)/)?.[1] || null;
    case BrowserType.OPERA:
      return (
        userAgent.match(/OPR\/([0-9.]+)/)?.[1] ||
        userAgent.match(/Opera\/([0-9.]+)/)?.[1] ||
        null
      );
    default:
      return null;
  }
}

/**
 * Checks if the current environment supports specific features
 * @returns {Object} Object containing feature support flags
 */
export function detectFeatureSupport() {
  const environment = detectEnvironment();

  return {
    // Crypto API support
    cryptoSubtle:
      environment === Environment.NODE ||
      environment === Environment.BROWSER_MODERN,

    // Fetch API support
    fetch: typeof fetch !== "undefined",

    // Promise support
    promises: typeof Promise !== "undefined",

    // ES6 features
    es6:
      typeof Symbol !== "undefined" &&
      typeof Map !== "undefined" &&
      typeof Set !== "undefined",

    // Async/await support
    asyncAwait: (function () {
      try {
        eval("(async function() {})()");
        return true;
      } catch (e) {
        return false;
      }
    })(),

    // WebSocket support
    webSockets: typeof WebSocket !== "undefined",

    // IndexedDB support (for caching)
    indexedDB: typeof indexedDB !== "undefined",

    // Service Worker support
    serviceWorker:
      typeof navigator !== "undefined" && "serviceWorker" in navigator,
  };
}

/**
 * Detects if running in a deployment environment (production hosting platforms)
 * @returns {boolean} True if in a deployment environment
 */
export function isDeploymentEnvironment() {
  // Check for Node.js environment first
  if (typeof process === "undefined") {
    return false;
  }

  // Check for common deployment platform environment variables
  return !!(
    process.env.VERCEL ||
    process.env.NETLIFY ||
    process.env.RENDER ||
    process.env.HEROKU ||
    process.env.RAILWAY ||
    process.env.FLY_APP_NAME ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    (process.env.NODE_ENV === "production" && hasDeploymentIndicators())
  );
}

/**
 * Check for general deployment indicators
 * @returns {boolean} True if deployment indicators are present
 */
export function hasDeploymentIndicators() {
  if (typeof process === "undefined") {
    return false;
  }

  return !!(
    process.env.CI ||
    process.env.BUILD_ID ||
    process.env.DEPLOYMENT_ID ||
    isServerEnvironment()
  );
}

/**
 * Check if running in server-side environment
 * @returns {boolean} True if server environment
 */
export function isServerEnvironment() {
  return typeof window === "undefined" && typeof process !== "undefined";
}

/**
 * Detect the specific deployment platform
 * @returns {string} Platform name or 'unknown'
 */
export function detectPlatform() {
  if (typeof process === "undefined") {
    return "browser";
  }

  if (process.env.VERCEL) return "vercel";
  if (process.env.NETLIFY) return "netlify";
  if (process.env.RENDER) return "render";
  if (process.env.HEROKU) return "heroku";
  if (process.env.RAILWAY) return "railway";
  if (process.env.FLY_APP_NAME) return "fly";
  if (process.env.GITHUB_ACTIONS) return "github-actions";
  if (process.env.GITLAB_CI) return "gitlab-ci";

  return isServerEnvironment() ? "server" : "unknown";
}

/**
 * Gets information about the current environment
 * @returns {Object} Detailed environment information
 */
export function getEnvironmentInfo() {
  const environment = detectEnvironment();
  const featureSupport = detectFeatureSupport();

  const info = {
    environment,
    features: featureSupport,
    isDeployment: isDeploymentEnvironment(),
    platform: detectPlatform(),
    isServer: isServerEnvironment(),
  };

  // Add browser-specific information if in a browser
  if (
    environment === Environment.BROWSER_MODERN ||
    environment === Environment.BROWSER_LEGACY
  ) {
    info.browser = {
      type: detectBrowser(),
      version: detectBrowserVersion(),
      userAgent: navigator.userAgent,
      language: navigator.language,
      cookiesEnabled: navigator.cookieEnabled,
      screenSize: {
        width: window.screen.width,
        height: window.screen.height,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };
  }

  // Add Node.js specific information if in Node.js
  if (environment === Environment.NODE) {
    info.node = {
      version: process.version,
      platform: process.platform,
      arch: process.arch,
    };
  }

  return info;
}

/**
 * Determines the optimal HTTP client to use based on the environment
 * @returns {string} The recommended HTTP client type ('fetch', 'xhr', 'node-fetch', 'axios')
 */
export function getOptimalHttpClient() {
  const environment = detectEnvironment();
  const features = detectFeatureSupport();

  if (environment === Environment.NODE) {
    return "node-fetch";
  }

  if (features.fetch) {
    return "fetch";
  }

  return "xhr";
}

/**
 * Determines if the environment requires polyfills
 * @returns {Object} Object containing required polyfills
 */
export function getRequiredPolyfills() {
  const features = detectFeatureSupport();

  return {
    cryptoSubtle: !features.cryptoSubtle,
    fetch: !features.fetch,
    promises: !features.promises,
    es6: !features.es6,
  };
}

export default {
  Environment,
  BrowserType,
  detectEnvironment,
  detectBrowser,
  detectBrowserVersion,
  detectFeatureSupport,
  getEnvironmentInfo,
  getOptimalHttpClient,
  getRequiredPolyfills,
};
