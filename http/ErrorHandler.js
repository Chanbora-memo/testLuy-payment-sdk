/**
 * @fileoverview
 * ErrorHandler - A module for handling errors with intelligent recovery strategies
 * and detailed error reporting.
 */

import { SDKError, RateLimitError, CloudflareError } from "./errors/index.js";
import ErrorDetector, { ErrorType } from "./ErrorDetector.js";
import RetryStrategy from "./RetryStrategy.js";
import {
  getDeploymentErrorContext,
  getDeploymentInfo,
} from "./utils/DeploymentEnvironmentDetector.js";
import EnhancedErrorReporter, {
  ErrorReportingLevel,
} from "./EnhancedErrorReporter.js";

/**
 * ErrorHandler class for handling errors with recovery strategies
 *
 * @class
 */
class ErrorHandler {
  /**
   * Creates a new ErrorHandler instance
   *
   * @param {Object} [options={}] - Configuration options
   * @param {RetryStrategy} [options.retryStrategy] - RetryStrategy instance for retry logic
   * @param {ErrorDetector} [options.errorDetector] - ErrorDetector instance for error classification
   * @param {Function} [options.onError] - Callback function called when an error occurs
   * @param {Function} [options.onRetry] - Callback function called before a retry attempt
   * @param {Function} [options.onRecovery] - Callback function called when recovery is successful
   * @param {boolean} [options.detailedErrors=true] - Whether to include detailed information in errors
   * @param {boolean} [options.autoRetry=true] - Whether to automatically retry failed requests
   * @param {Object} [options.httpAdapter] - HTTP adapter instance for making retry requests
   * @param {EnhancedErrorReporter} [options.errorReporter] - Enhanced error reporter for debugging
   * @param {string} [options.errorReportingLevel='standard'] - Error reporting level (minimal, standard, detailed, debug)
   * @param {boolean} [options.enableUrlConstructionLogging=true] - Whether to log URL construction steps
   * @param {boolean} [options.enableRetryContextLogging=true] - Whether to log retry context information
   */
  constructor(options = {}) {
    this.retryStrategy = options.retryStrategy || new RetryStrategy();
    this.errorDetector = options.errorDetector || new ErrorDetector();
    this.onError = options.onError;
    this.onRetry = options.onRetry;
    this.onRecovery = options.onRecovery;
    this.detailedErrors = options.detailedErrors !== false;
    this.autoRetry = options.autoRetry !== false;
    this.httpAdapter = options.httpAdapter;

    // Enhanced error reporting configuration
    this.errorReportingLevel =
      options.errorReportingLevel || ErrorReportingLevel.STANDARD;
    this.enableUrlConstructionLogging =
      options.enableUrlConstructionLogging !== false;
    this.enableRetryContextLogging =
      options.enableRetryContextLogging !== false;

    // Initialize enhanced error reporter
    this.errorReporter =
      options.errorReporter ||
      new EnhancedErrorReporter({
        level: this.errorReportingLevel,
        includeUrlConstructionSteps: this.enableUrlConstructionLogging,
        includeRetryContext: this.enableRetryContextLogging,
        includeDeploymentContext: true,
        maskSensitiveData: true,
      });

    // Recovery strategies by error type
    this.recoveryStrategies = {
      [ErrorType.NETWORK]: this.handleNetworkError.bind(this),
      [ErrorType.TIMEOUT]: this.handleTimeoutError.bind(this),
      [ErrorType.CLOUDFLARE]: this.handleCloudflareError.bind(this),
      [ErrorType.RATE_LIMIT]: this.handleRateLimitError.bind(this),
      [ErrorType.AUTH]: this.handleAuthError.bind(this),
      [ErrorType.VALIDATION]: this.handleValidationError.bind(this),
      [ErrorType.SERVER]: this.handleServerError.bind(this),
      [ErrorType.CLIENT]: this.handleClientError.bind(this),
      [ErrorType.UNKNOWN]: this.handleUnknownError.bind(this),
    };
  }

  /**
   * Handles an error with appropriate recovery strategy
   *
   * @param {Error} error - The error to handle
   * @param {Object} [context={}] - Additional context for error handling
   * @returns {Promise<Object>} Recovery result or throws enhanced error
   * @throws {SDKError} Enhanced error with detailed information
   */
  async handleError(error, context = {}) {
    // Detect error type if not already classified
    if (!error.errorType) {
      const errorInfo = this.errorDetector.detectErrorType(error);
      error.errorType = errorInfo.type;
      error.retryable = errorInfo.retryable;
      error.errorDetails = errorInfo.details;
    }

    // Create enhanced error report for debugging
    if (this.errorReportingLevel !== ErrorReportingLevel.MINIMAL) {
      error.debugReport = this.errorReporter.createErrorReport(error, context);

      // Log URL construction steps if available
      if (this.enableUrlConstructionLogging && context.urlConstructionSteps) {
        this._logUrlConstructionSteps(context.urlConstructionSteps, error);
      }

      // Log retry context if available
      if (
        this.enableRetryContextLogging &&
        (context.retryContext || error.retryContext)
      ) {
        this._logRetryContext(
          context.retryContext || error.retryContext,
          error
        );
      }
    }

    // Call onError callback if provided
    if (this.onError) {
      await this.onError(error, context);
    }

    // Get the appropriate recovery strategy
    const recoveryStrategy =
      this.recoveryStrategies[error.errorType] || this.handleUnknownError;

    try {
      // Attempt recovery
      const result = await recoveryStrategy(error, context);

      // Call onRecovery callback if provided and recovery was successful
      if (this.onRecovery && result) {
        await this.onRecovery(error, result, context);
      }

      return result;
    } catch (recoveryError) {
      // If recovery failed, enhance the error with debugging information
      const enhancedError = this.enhanceError(recoveryError);

      // Add enhanced debugging information to the error
      if (this.errorReportingLevel !== ErrorReportingLevel.MINIMAL) {
        enhancedError.debugReport = this.errorReporter.createErrorReport(
          enhancedError,
          context
        );
        enhancedError.debugGuidance = this._generateDebuggingGuidance(
          enhancedError,
          context
        );
      }

      throw enhancedError;
      throw this.enhanceError(recoveryError || error);
    }
  }

  /**
   * Enhances an error with additional information
   *
   * @param {Error} error - The error to enhance
   * @returns {SDKError} Enhanced error
   * @private
   */
  enhanceError(error) {
    // If the error is already an SDKError, return it
    if (error instanceof SDKError) {
      return error;
    }

    // Create appropriate error type based on classification
    switch (error.errorType) {
      case ErrorType.CLOUDFLARE:
        return CloudflareError.fromResponse(error);

      case ErrorType.RATE_LIMIT:
        return RateLimitError.fromResponse(error);

      default:
        // For other error types, use the base SDKError class
        return SDKError.from(
          error,
          error.message,
          `${error.errorType?.toUpperCase() || "UNKNOWN"}_ERROR`,
          error.errorDetails || {}
        );
    }
  }

  /**
   * Creates a detailed error report for debugging with deployment context
   *
   * @param {Error} error - The error to report
   * @returns {Object} Detailed error report
   */
  createErrorReport(error) {
    const deploymentInfo = getDeploymentInfo();
    const deploymentContext = getDeploymentErrorContext(error);

    const report = {
      timestamp: new Date().toISOString(),
      errorType: error.errorType || "unknown",
      message: error.message,
      retryable: error.retryable !== false,
      deployment: {
        platform: deploymentInfo.platform,
        environment: deploymentInfo.environment,
        isDeployment: deploymentInfo.isDeployment,
        isServerless: deploymentInfo.isServerless,
      },
      deploymentContext,
    };

    // Add request information if available
    if (error.config) {
      report.request = {
        url: error.config.url,
        method: error.config.method,
        headers: this.sanitizeHeaders(error.config.headers),
      };
    }

    // Add response information if available
    if (error.response) {
      report.response = {
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers,
      };

      // Add response data if available and not too large
      if (error.response.data) {
        try {
          const data =
            typeof error.response.data === "string"
              ? error.response.data
              : JSON.stringify(error.response.data);

          // Limit data size to prevent huge error reports
          report.response.data =
            data.length > 1000
              ? data.substring(0, 1000) + "... [truncated]"
              : data;
        } catch (e) {
          report.response.data = "[Error serializing response data]";
        }
      }
    }

    // Add error details if available
    if (error.errorDetails) {
      report.details = error.errorDetails;
    }

    return report;
  }

  /**
   * Sanitizes headers to remove sensitive information
   *
   * @param {Object} headers - Headers to sanitize
   * @returns {Object} Sanitized headers
   * @private
   */
  sanitizeHeaders(headers) {
    if (!headers) return {};

    const sanitized = { ...headers };

    // List of sensitive headers to mask
    const sensitiveHeaders = [
      "authorization",
      "x-api-key",
      "x-client-secret",
      "client-secret",
      "api-key",
      "token",
      "password",
      "secret",
    ];

    // Mask sensitive headers
    Object.keys(sanitized).forEach((key) => {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = "[REDACTED]";
      }
    });

    return sanitized;
  }

  /**
   * Handles network errors
   *
   * @param {Error} error - The network error
   * @param {Object} context - Error handling context
   * @returns {Promise<Object>} Recovery result or throws
   * @private
   */
  async handleNetworkError(error, context) {
    // Network errors are usually retryable
    if (this.autoRetry && error.retryable !== false) {
      return this.retryRequest(error, context);
    }

    // Provide specific guidance based on error code
    if (error.code === "ENOTFOUND") {
      error.recoveryMessage =
        "DNS resolution failed. Check your internet connection and the API hostname.";
    } else if (error.code === "ECONNREFUSED") {
      error.recoveryMessage =
        "Connection refused. The server may be down or not accepting connections.";
    } else if (error.code === "ECONNRESET") {
      error.recoveryMessage =
        "Connection reset. The connection was forcibly closed by the remote server.";
    } else if (error.code === "ETIMEDOUT") {
      error.recoveryMessage =
        "Connection timed out. The server took too long to respond.";
    }

    throw error;
  }

  /**
   * Handles timeout errors
   *
   * @param {Error} error - The timeout error
   * @param {Object} context - Error handling context
   * @returns {Promise<Object>} Recovery result or throws
   * @private
   */
  async handleTimeoutError(error, context) {
    // Timeout errors are usually retryable
    if (this.autoRetry) {
      // Increase timeout for retry attempts
      if (error.config && error.config.timeout) {
        error.config.timeout = Math.min(error.config.timeout * 1.5, 60000); // Increase timeout up to 60s
      }

      return this.retryRequest(error, context);
    }

    error.recoveryMessage =
      "Request timed out. Consider increasing the timeout value or checking your network connection.";
    throw error;
  }

  /**
   * Handles Cloudflare errors
   *
   * @param {Error} error - The Cloudflare error
   * @param {Object} context - Error handling context
   * @returns {Promise<Object>} Recovery result or throws
   * @private
   */
  async handleCloudflareError(error, context) {
    // Convert to CloudflareError if not already
    const cloudflareError =
      error instanceof CloudflareError
        ? error
        : CloudflareError.fromResponse(error);

    // Get challenge guidance
    const guidance = cloudflareError.getChallengeGuidance();

    // If the challenge is retryable and auto-retry is enabled
    if (this.autoRetry && guidance.retryable) {
      // Modify request for retry to help bypass Cloudflare
      if (error.config) {
        // Add or modify headers to help bypass Cloudflare
        error.config.headers = {
          ...error.config.headers,
          // Add browser-like headers
          "User-Agent": this.getRandomUserAgent(),
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
        };
      }

      return this.retryRequest(error, context);
    }

    // If not retryable or auto-retry is disabled
    cloudflareError.recoveryMessage = guidance.recommendedAction;
    throw cloudflareError;
  }

  /**
   * Handles rate limit errors
   *
   * @param {Error} error - The rate limit error
   * @param {Object} context - Error handling context
   * @returns {Promise<Object>} Recovery result or throws
   * @private
   */
  async handleRateLimitError(error, context) {
    // Convert to RateLimitError if not already
    const rateLimitError =
      error instanceof RateLimitError
        ? error
        : RateLimitError.fromResponse(error);

    // Get retry guidance
    const guidance = rateLimitError.getRetryGuidance();

    // If auto-retry is enabled
    if (this.autoRetry && guidance.shouldRetry) {
      // Use the retry-after value if available
      const retryDelay = guidance.retryAfter * 1000; // Convert to milliseconds

      // Add retry delay to context
      context.retryDelay = retryDelay;

      return this.retryRequest(error, context);
    }

    // If not retrying
    rateLimitError.recoveryMessage = guidance.recommendedAction;
    throw rateLimitError;
  }

  /**
   * Handles authentication errors
   *
   * @param {Error} error - The authentication error
   * @param {Object} context - Error handling context
   * @returns {Promise<Object>} Recovery result or throws
   * @private
   */
  async handleAuthError(error, context) {
    // Authentication errors are generally not retryable
    error.recoveryMessage =
      "Authentication failed. Check your API credentials and ensure they have not expired.";
    throw error;
  }

  /**
   * Handles validation errors
   *
   * @param {Error} error - The validation error
   * @param {Object} context - Error handling context
   * @returns {Promise<Object>} Recovery result or throws
   * @private
   */
  async handleValidationError(error, context) {
    // Validation errors are not retryable
    let validationMessage = "Validation failed. Check your request parameters.";

    // Extract validation errors if available
    if (error.errorDetails && error.errorDetails.validationErrors) {
      const validationErrors = error.errorDetails.validationErrors;

      // Format validation errors
      if (typeof validationErrors === "object") {
        validationMessage += " Issues:";

        for (const [field, messages] of Object.entries(validationErrors)) {
          const messageText = Array.isArray(messages)
            ? messages.join(", ")
            : messages;
          validationMessage += `\n- ${field}: ${messageText}`;
        }
      }
    }

    error.recoveryMessage = validationMessage;
    throw error;
  }

  /**
   * Handles server errors
   *
   * @param {Error} error - The server error
   * @param {Object} context - Error handling context
   * @returns {Promise<Object>} Recovery result or throws
   * @private
   */
  async handleServerError(error, context) {
    // Server errors are usually retryable
    if (this.autoRetry) {
      return this.retryRequest(error, context);
    }

    error.recoveryMessage =
      "Server error occurred. This is likely a temporary issue with the API server.";
    throw error;
  }

  /**
   * Handles client errors
   *
   * @param {Error} error - The client error
   * @param {Object} context - Error handling context
   * @returns {Promise<Object>} Recovery result or throws
   * @private
   */
  async handleClientError(error, context) {
    // Client errors are generally not retryable
    error.recoveryMessage =
      "Client error occurred. Check your request parameters and API documentation.";
    throw error;
  }

  /**
   * Handles unknown errors
   *
   * @param {Error} error - The unknown error
   * @param {Object} context - Error handling context
   * @returns {Promise<Object>} Recovery result or throws
   * @private
   */
  async handleUnknownError(error, context) {
    // Unknown errors might be retryable
    if (this.autoRetry && error.retryable !== false) {
      return this.retryRequest(error, context);
    }

    error.recoveryMessage = "An unexpected error occurred.";
    throw error;
  }

  /**
   * Retries a failed request
   *
   * @param {Error} error - The error that triggered the retry
   * @param {Object} context - Retry context
   * @returns {Promise<Object>} Response if retry is successful
   * @throws {Error} If retry fails
   * @private
   */
  async retryRequest(error, context) {
    // Skip retry if the request has a skipRetry flag
    if (error.config && error.config.skipRetry) {
      throw error;
    }

    // Get current retry attempt
    const attempt = (error.config && error.config.retryAttempt) || 0;

    // Check if we've reached the maximum number of retries
    if (attempt >= this.retryStrategy.config.maxRetries) {
      error.recoveryMessage = `Maximum retry attempts (${this.retryStrategy.config.maxRetries}) reached.`;
      throw error;
    }

    // Preserve retry context to maintain URL construction parameters with deployment info
    const deploymentInfo = getDeploymentInfo();
    const retryContext = {
      originalUrl: error.config?.url,
      baseUrl: this.httpAdapter?.baseUrl,
      attempt: attempt + 1,
      originalError: error.message,
      adapterType: this.httpAdapter?.constructor?.name,
      timestamp: new Date().toISOString(),
      deployment: {
        platform: deploymentInfo.platform,
        environment: deploymentInfo.environment,
        isDeployment: deploymentInfo.isDeployment,
      },
    };

    // Increment retry attempt
    if (error.config) {
      error.config.retryAttempt = attempt + 1;
      // Add retry context to config for debugging
      error.config.retryContext = retryContext;
    }

    // Calculate delay (use context.retryDelay if provided)
    const delay =
      context.retryDelay ||
      this.retryStrategy.calculateDelay(attempt + 1, error);

    // Call onRetry callback if provided
    if (this.onRetry) {
      await this.onRetry({
        attempt: attempt + 1,
        error,
        delay,
        context,
        retryContext,
      });
    }

    // Log retry attempt if retry context logging is enabled
    if (this.enableRetryContextLogging) {
      this.errorReporter.config.logger.info(
        `Retry attempt ${attempt + 1} for ${
          error.errorType || "unknown"
        } error`,
        {
          errorMessage: error.message,
          retryContext,
          delay,
          maxRetries: this.retryStrategy.config.maxRetries,
        }
      );
    }

    // Wait for the calculated delay
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Retry the request
    try {
      // Use HTTP adapter if available, otherwise fall back to axios
      if (this.httpAdapter && typeof this.httpAdapter.request === "function") {
        // Use the original HTTP adapter to maintain URL construction logic
        const response = await this.httpAdapter.request(error.config);
        return response;
      } else {
        // Fallback to axios for backward compatibility
        let axios = error.config.axios;
        if (!axios) {
          try {
            const axiosModule = await import("axios");
            axios = axiosModule.default || axiosModule;
          } catch (importError) {
            throw new Error(
              "HTTP adapter not available and axios is required for retry functionality but not available"
            );
          }
        }
        const response = await axios.request(error.config);
        return response;
      }
    } catch (retryError) {
      // Update retry attempt count and preserve context
      if (error.config && retryError.config) {
        retryError.config.retryAttempt = error.config.retryAttempt;
        retryError.config.retryContext = retryContext;
      }

      // Enhance retry error with context information including deployment details
      if (retryError.message && retryError.message.includes("Invalid URL")) {
        retryError.retryContext = retryContext;
        retryError.deploymentContext = getDeploymentErrorContext(
          retryError,
          retryContext
        );

        const platformInfo = retryContext.deployment
          ? ` Platform: ${retryContext.deployment.platform}, Environment: ${retryContext.deployment.environment}.`
          : "";

        retryError.recoveryMessage =
          `URL construction failed during retry attempt ${retryContext.attempt}. ` +
          `Original URL: "${retryContext.originalUrl}", Base URL: "${retryContext.baseUrl}", ` +
          `Adapter: ${retryContext.adapterType}.${platformInfo} This may indicate an issue with URL construction in retry scenarios.`;

        // Create enhanced error report for URL construction failures during retry
        if (this.errorReportingLevel !== ErrorReportingLevel.MINIMAL) {
          retryError.debugReport = this.errorReporter.createErrorReport(
            retryError,
            {
              retryContext,
              urlConstructionSteps: context.urlConstructionSteps || [],
              isRetryFailure: true,
            }
          );

          // Log detailed retry failure information
          this.errorReporter.config.logger.error(
            "URL construction failed during retry",
            {
              retryAttempt: retryContext.attempt,
              originalUrl: retryContext.originalUrl,
              baseUrl: retryContext.baseUrl,
              adapterType: retryContext.adapterType,
              deployment: retryContext.deployment,
              errorMessage: retryError.message,
            }
          );
        }
      }

      // If retry fails, throw the new error
      throw retryError;
    }
  }

  /**
   * Logs URL construction steps for debugging
   *
   * @param {string[]} steps - URL construction steps
   * @param {Error} error - Associated error
   * @private
   */
  _logUrlConstructionSteps(steps, error) {
    if (!steps || !Array.isArray(steps)) return;

    this.errorReporter.config.logger.debug(
      `URL Construction Steps for error: ${error.message}`,
      {
        steps,
        totalSteps: steps.length,
        errorType: error.errorType,
        timestamp: new Date().toISOString(),
      }
    );

    // Log each step individually for detailed analysis
    steps.forEach((step, index) => {
      const level =
        step.includes("FAILED") || step.includes("failed") ? "error" : "debug";
      this.errorReporter.config.logger[level](`Step ${index + 1}: ${step}`);
    });
  }

  /**
   * Logs retry context information for debugging
   *
   * @param {Object} retryContext - Retry context information
   * @param {Error} error - Associated error
   * @private
   */
  _logRetryContext(retryContext, error) {
    if (!retryContext) return;

    this.errorReporter.config.logger.debug(
      `Retry Context for error: ${error.message}`,
      {
        retryContext,
        errorType: error.errorType,
        timestamp: new Date().toISOString(),
      }
    );

    // Log key retry information
    if (retryContext.attempt) {
      this.errorReporter.config.logger.info(
        `Retry attempt: ${retryContext.attempt}`
      );
    }

    if (retryContext.originalUrl) {
      this.errorReporter.config.logger.debug(
        `Original URL: ${retryContext.originalUrl}`
      );
    }

    if (retryContext.adapterType) {
      this.errorReporter.config.logger.debug(
        `Adapter type: ${retryContext.adapterType}`
      );
    }

    if (retryContext.deployment) {
      this.errorReporter.config.logger.debug(
        `Deployment context: Platform=${retryContext.deployment.platform}, Environment=${retryContext.deployment.environment}`
      );
    }
  }

  /**
   * Generates debugging guidance based on error analysis
   *
   * @param {Error} error - Error to provide guidance for
   * @param {Object} context - Error context
   * @returns {Object} Debugging guidance
   * @private
   */
  _generateDebuggingGuidance(error, context) {
    const guidance = {
      immediate: [],
      investigation: [],
      prevention: [],
      deploymentSpecific: null,
      urlConstruction: null,
      retrySpecific: null,
    };

    // URL construction specific guidance
    if (error.message && /Invalid URL|URL construction/i.test(error.message)) {
      guidance.urlConstruction = {
        issue: "URL Construction Failure",
        immediateActions: [
          "Check baseUrl configuration format",
          "Verify URL parameters are properly encoded",
          "Test with minimal URL components",
          "Enable URL construction debugging",
        ],
        investigationSteps: [
          "Review URL construction steps in error report",
          "Check adapter-specific URL building logic",
          "Verify deployment environment URL handling",
          "Test URL construction in isolation",
        ],
        preventionStrategies: [
          "Implement URL validation before construction",
          "Add fallback URL construction methods",
          "Configure proper error handling for URL failures",
          "Set up URL construction monitoring",
        ],
      };
    }

    // Retry specific guidance
    if (error.retryContext || (error.message && /retry/i.test(error.message))) {
      guidance.retrySpecific = {
        issue: "Retry Mechanism Failure",
        immediateActions: [
          "Check retry context preservation",
          "Verify adapter reference availability",
          "Test with retry disabled to isolate issue",
          "Review retry configuration",
        ],
        investigationSteps: [
          "Analyze retry context in error report",
          "Check adapter retry integration",
          "Verify URL construction during retry",
          "Review retry strategy configuration",
        ],
        preventionStrategies: [
          "Implement retry context validation",
          "Add retry-specific error handling",
          "Configure appropriate retry strategies",
          "Monitor retry success rates",
        ],
      };
    }

    // Deployment specific guidance
    const deploymentInfo = getDeploymentInfo();
    if (deploymentInfo.isDeployment && error.message) {
      guidance.deploymentSpecific = this._getDeploymentSpecificGuidance(
        error,
        deploymentInfo,
        context
      );
    }

    // General guidance based on error type
    switch (error.errorType) {
      case "network":
        guidance.immediate.push(
          "Check network connectivity",
          "Verify API endpoint accessibility",
          "Test with different network configuration"
        );
        guidance.investigation.push(
          "Review network logs and traces",
          "Check DNS resolution",
          "Verify SSL/TLS configuration"
        );
        break;

      case "authentication":
        guidance.immediate.push(
          "Verify API credentials",
          "Check authentication token validity",
          "Review authentication flow"
        );
        guidance.investigation.push(
          "Check credential storage and retrieval",
          "Verify authentication headers",
          "Review token refresh mechanisms"
        );
        break;

      case "rate_limit":
        guidance.immediate.push(
          "Implement backoff strategy",
          "Check rate limit headers",
          "Review request frequency"
        );
        guidance.investigation.push(
          "Analyze rate limiting patterns",
          "Review retry strategy configuration",
          "Check concurrent request handling"
        );
        break;
    }

    return guidance;
  }

  /**
   * Gets deployment-specific debugging guidance
   *
   * @param {Error} error - Error to analyze
   * @param {Object} deploymentInfo - Deployment information
   * @param {Object} context - Error context
   * @returns {Object|null} Deployment-specific guidance
   * @private
   */
  _getDeploymentSpecificGuidance(error, deploymentInfo, context) {
    const platform = deploymentInfo.platform;

    const baseGuidance = {
      platform,
      environment: deploymentInfo.environment,
      isServerless: deploymentInfo.isServerless,
    };

    switch (platform) {
      case "vercel":
        return {
          ...baseGuidance,
          title: "Vercel Deployment Issues",
          commonCauses: [
            "Serverless function cold starts affecting initialization",
            "Environment variable configuration differences",
            "Build process URL transformation",
            "Edge runtime limitations and URL handling",
          ],
          immediateActions: [
            "Check VERCEL_URL environment variable",
            "Verify API base URL configuration in vercel.json",
            "Test URL construction in Vercel function logs",
            "Review serverless function timeout settings",
          ],
          investigationSteps: [
            "Review Vercel function logs for detailed errors",
            "Check build logs for URL-related warnings",
            "Test URL construction in local Vercel environment",
            "Verify environment variable propagation",
          ],
          documentation:
            "https://vercel.com/docs/concepts/functions/serverless-functions",
          troubleshooting:
            "https://vercel.com/docs/concepts/functions/troubleshooting",
        };

      case "netlify":
        return {
          ...baseGuidance,
          title: "Netlify Deployment Issues",
          commonCauses: [
            "Netlify Functions environment differences",
            "Build context URL handling variations",
            "Function timeout limitations",
            "Environment variable scoping issues",
          ],
          immediateActions: [
            "Check netlify.toml configuration",
            "Verify function environment variables in Netlify dashboard",
            "Test URL construction in function logs",
            "Review Netlify function timeout settings",
          ],
          investigationSteps: [
            "Review Netlify function logs",
            "Check build logs for environment setup",
            "Test in Netlify Dev environment",
            "Verify function deployment configuration",
          ],
          documentation: "https://docs.netlify.com/functions/overview/",
          troubleshooting:
            "https://docs.netlify.com/functions/troubleshooting-tips/",
        };

      case "aws":
        return {
          ...baseGuidance,
          title: "AWS Lambda Deployment Issues",
          commonCauses: [
            "Lambda cold start initialization delays",
            "VPC configuration affecting external requests",
            "IAM permissions for external API calls",
            "Lambda timeout and memory constraints",
          ],
          immediateActions: [
            "Check Lambda function configuration",
            "Verify IAM role permissions",
            "Review VPC and security group settings",
            "Test URL construction in CloudWatch logs",
          ],
          investigationSteps: [
            "Review CloudWatch logs for detailed errors",
            "Check Lambda metrics and performance",
            "Test with different Lambda configurations",
            "Verify network connectivity from Lambda",
          ],
          documentation: "https://docs.aws.amazon.com/lambda/",
          troubleshooting:
            "https://docs.aws.amazon.com/lambda/latest/dg/troubleshooting.html",
        };

      default:
        return {
          ...baseGuidance,
          title: "General Deployment Issues",
          commonCauses: [
            "Environment configuration differences",
            "Build process affecting URL construction",
            "Runtime environment limitations",
            "Network configuration issues",
          ],
          immediateActions: [
            "Check environment variable configuration",
            "Verify deployment-specific settings",
            "Test URL construction in deployment logs",
            "Compare local vs deployment behavior",
          ],
          investigationSteps: [
            "Review deployment logs and metrics",
            "Check build and runtime configurations",
            "Test with minimal deployment setup",
            "Verify network and security configurations",
          ],
        };
    }
  }

  /**
   * Updates error reporting configuration
   *
   * @param {Object} config - New configuration options
   */
  updateErrorReportingConfig(config) {
    if (config.level) {
      this.errorReportingLevel = config.level;
    }

    if (config.enableUrlConstructionLogging !== undefined) {
      this.enableUrlConstructionLogging = config.enableUrlConstructionLogging;
    }

    if (config.enableRetryContextLogging !== undefined) {
      this.enableRetryContextLogging = config.enableRetryContextLogging;
    }

    // Update error reporter configuration
    this.errorReporter.updateConfig(config);
  }

  /**
   * Gets a random User-Agent string
   *
   * @returns {string} A random User-Agent string
   * @private
   */
  getRandomUserAgent() {
    const userAgents = [
      // Chrome on Windows
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",

      // Chrome on macOS
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",

      // Firefox on Windows
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/116.0",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0",

      // Firefox on macOS
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/115.0",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/116.0",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/117.0",

      // Safari on macOS
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",

      // Edge on Windows
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.58",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 Edg/115.0.1901.183",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 Edg/116.0.1938.54",
    ];

    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  /**
   * Creates an error interceptor for use with EnhancedHttpClient
   *
   * @returns {Object} An error interceptor for EnhancedHttpClient
   */
  createErrorInterceptor() {
    const self = this;

    return {
      // Expose the ErrorHandler instance so EnhancedHttpClient can set the HTTP adapter
      _errorHandler: self,

      async onError(error) {
        try {
          // Handle the error with recovery strategies
          const result = await self.handleError(error, {
            config: error.config,
          });
          return result;
        } catch (enhancedError) {
          // If recovery failed, reject with the enhanced error
          return Promise.reject(enhancedError);
        }
      },
    };
  }
}

export default ErrorHandler;
