/**
 * @fileoverview
 * EnhancedErrorReporter - A module for enhanced error reporting and debugging support
 * with detailed URL construction logging, retry context information, and deployment-specific guidance.
 */

import {
  getDeploymentInfo,
  getDeploymentErrorContext,
} from "./utils/DeploymentEnvironmentDetector.js";
import { Logger } from "./Logger.js";

/**
 * Error reporting levels
 * @enum {string}
 */
export const ErrorReportingLevel = {
  MINIMAL: "minimal",
  STANDARD: "standard",
  DETAILED: "detailed",
  DEBUG: "debug",
};

/**
 * Enhanced error reporter class for comprehensive debugging support
 *
 * @class
 */
class EnhancedErrorReporter {
  /**
   * Creates a new EnhancedErrorReporter instance
   *
   * @param {Object} [options={}] - Configuration options
   * @param {string} [options.level='standard'] - Error reporting level
   * @param {boolean} [options.includeStackTrace=true] - Whether to include stack traces
   * @param {boolean} [options.includeDeploymentContext=true] - Whether to include deployment context
   * @param {boolean} [options.includeUrlConstructionSteps=true] - Whether to include URL construction debugging
   * @param {boolean} [options.includeRetryContext=true] - Whether to include retry context
   * @param {boolean} [options.maskSensitiveData=true] - Whether to mask sensitive data in error reports
   * @param {Logger} [options.logger] - Logger instance for error reporting
   */
  constructor(options = {}) {
    this.config = {
      level: options.level || ErrorReportingLevel.STANDARD,
      includeStackTrace: options.includeStackTrace !== false,
      includeDeploymentContext: options.includeDeploymentContext !== false,
      includeUrlConstructionSteps:
        options.includeUrlConstructionSteps !== false,
      includeRetryContext: options.includeRetryContext !== false,
      maskSensitiveData: options.maskSensitiveData !== false,
      logger:
        options.logger ||
        new Logger({ level: "debug", prefix: "[ErrorReporter]" }),
    };

    // Deployment environment cache
    this.deploymentInfo = getDeploymentInfo();

    // Common deployment-specific error patterns
    this.deploymentErrorPatterns = this._initializeDeploymentErrorPatterns();

    // URL construction error patterns
    this.urlConstructionPatterns = this._initializeUrlConstructionPatterns();

    // Retry error patterns
    this.retryErrorPatterns = this._initializeRetryErrorPatterns();
  }

  /**
   * Initializes deployment-specific error patterns
   *
   * @returns {Map} Deployment error patterns
   * @private
   */
  _initializeDeploymentErrorPatterns() {
    const patterns = new Map();

    // Vercel-specific patterns
    patterns.set("vercel", {
      urlConstructionFailures: [
        /Invalid URL.*vercel\.app/i,
        /URL construction failed.*deployment/i,
        /Invalid URL construction.*vercel deployment/i,
        /Serverless function.*URL/i,
      ],
      corsIssues: [
        /CORS.*vercel/i,
        /Access-Control-Allow-Origin.*vercel\.app/i,
      ],
      timeoutIssues: [/timeout.*serverless/i, /FUNCTION_INVOCATION_TIMEOUT/i],
      guidance: {
        title: "Vercel Deployment Issues",
        commonCauses: [
          "Serverless function cold starts affecting URL construction",
          "Environment variable configuration differences",
          "Build process URL transformation",
          "Edge runtime limitations",
        ],
        recommendedActions: [
          "Check VERCEL_URL environment variable",
          "Verify API base URL configuration",
          "Test URL construction in Vercel function logs",
          "Consider adding URL validation logging",
        ],
        documentation:
          "https://vercel.com/docs/concepts/functions/serverless-functions",
      },
    });

    // Netlify-specific patterns
    patterns.set("netlify", {
      urlConstructionFailures: [
        /Invalid URL.*netlify\.app/i,
        /URL construction failed.*netlify/i,
        /Function.*URL.*netlify/i,
      ],
      corsIssues: [
        /CORS.*netlify/i,
        /Access-Control-Allow-Origin.*netlify\.app/i,
      ],
      functionIssues: [/Function.*timeout/i, /NETLIFY_FUNCTIONS_PORT/i],
      guidance: {
        title: "Netlify Deployment Issues",
        commonCauses: [
          "Netlify Functions environment differences",
          "Build context URL handling",
          "Function timeout limitations",
          "Environment variable scoping",
        ],
        recommendedActions: [
          "Check netlify.toml configuration",
          "Verify function environment variables",
          "Test URL construction in function logs",
          "Review Netlify function timeout settings",
        ],
        documentation: "https://docs.netlify.com/functions/overview/",
      },
    });

    // Generic serverless patterns
    patterns.set("serverless", {
      urlConstructionFailures: [
        /Invalid URL.*serverless/i,
        /URL construction failed.*lambda/i,
        /Function.*URL.*aws/i,
      ],
      coldStartIssues: [/cold start/i, /initialization.*timeout/i],
      guidance: {
        title: "Serverless Environment Issues",
        commonCauses: [
          "Cold start latency affecting initialization",
          "Environment variable differences",
          "Runtime-specific URL handling",
          "Memory or timeout constraints",
        ],
        recommendedActions: [
          "Implement URL construction caching",
          "Add comprehensive error logging",
          "Consider keep-alive strategies",
          "Optimize SDK initialization",
        ],
      },
    });

    return patterns;
  }

  /**
   * Initializes URL construction error patterns
   *
   * @returns {Map} URL construction error patterns
   * @private
   */
  _initializeUrlConstructionPatterns() {
    const patterns = new Map();

    patterns.set("invalidUrl", {
      pattern: /Invalid URL/i,
      commonCauses: [
        "Malformed base URL configuration",
        "Missing protocol in URL",
        "Invalid characters in URL components",
        "Null or undefined URL parameters",
      ],
      debuggingSteps: [
        "Check baseUrl configuration",
        "Verify URL construction parameters",
        "Validate URL encoding",
        "Test with minimal URL components",
      ],
    });

    patterns.set("protocolMissing", {
      pattern: /Protocol.*missing|Missing.*protocol/i,
      commonCauses: [
        "Base URL missing http:// or https://",
        "Relative URL used where absolute required",
        "Environment variable misconfiguration",
      ],
      debuggingSteps: [
        "Add protocol to base URL",
        "Check environment variable values",
        "Validate URL construction logic",
      ],
    });

    patterns.set("constructionFailure", {
      pattern: /URL construction.*failed/i,
      commonCauses: [
        "Adapter-specific URL building issues",
        "Deployment environment differences",
        "Retry context information loss",
      ],
      debuggingSteps: [
        "Enable URL construction debugging",
        "Check adapter-specific logic",
        "Verify retry context preservation",
      ],
    });

    return patterns;
  }

  /**
   * Initializes retry error patterns
   *
   * @returns {Map} Retry error patterns
   * @private
   */
  _initializeRetryErrorPatterns() {
    const patterns = new Map();

    patterns.set("retryUrlConstruction", {
      pattern: /retry.*URL construction|URL construction.*retry/i,
      commonCauses: [
        "Retry mechanism bypassing adapter URL logic",
        "Context information loss during retry",
        "Deployment-specific retry failures",
      ],
      debuggingSteps: [
        "Check retry context preservation",
        "Verify adapter retry integration",
        "Enable retry-specific logging",
      ],
    });

    patterns.set("retryContextLoss", {
      pattern: /retry.*context.*lost|context.*retry.*missing/i,
      commonCauses: [
        "Retry context not passed between attempts",
        "Adapter reference not preserved",
        "Configuration lost during retry",
      ],
      debuggingSteps: [
        "Verify retry context passing",
        "Check adapter reference preservation",
        "Validate configuration persistence",
      ],
    });

    return patterns;
  }

  /**
   * Creates a comprehensive error report with debugging information
   *
   * @param {Error} error - The error to report
   * @param {Object} [context={}] - Additional context information
   * @returns {Object} Comprehensive error report
   */
  createErrorReport(error, context = {}) {
    const timestamp = new Date().toISOString();
    const reportId = this._generateReportId();

    // Base error report
    const report = {
      reportId,
      timestamp,
      errorType: error.errorType || this._classifyError(error),
      message: error.message,
      level: this.config.level,

      // Basic error information
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        status: error.status || error.response?.status,
        retryable: error.retryable !== false,
      },
    };

    // Add stack trace if enabled
    if (this.config.includeStackTrace && error.stack) {
      report.error.stackTrace = this._sanitizeStackTrace(error.stack);
    }

    // Add deployment context if enabled
    if (this.config.includeDeploymentContext) {
      report.deployment = {
        ...this.deploymentInfo,
        context: getDeploymentErrorContext(error, context),
      };
    }

    // Add URL construction steps if available and enabled
    if (
      this.config.includeUrlConstructionSteps &&
      context.urlConstructionSteps
    ) {
      report.urlConstruction = this._buildUrlConstructionReport(
        context.urlConstructionSteps,
        error
      );
    }

    // Add retry context if available and enabled
    if (
      this.config.includeRetryContext &&
      (context.retryContext || error.retryContext)
    ) {
      report.retryContext = this._buildRetryContextReport(
        context.retryContext || error.retryContext,
        error
      );
    }

    // Add error analysis and guidance
    report.analysis = this._analyzeError(error, context);

    // Add debugging guidance
    report.debugging = this._generateDebuggingGuidance(error, context, report);

    // Log the report based on level
    this._logErrorReport(report, error);

    return report;
  }

  /**
   * Generates a unique report ID
   *
   * @returns {string} Unique report ID
   * @private
   */
  _generateReportId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `err_${timestamp}_${random}`;
  }

  /**
   * Classifies an error based on its properties
   *
   * @param {Error} error - Error to classify
   * @returns {string} Error classification
   * @private
   */
  _classifyError(error) {
    // Network errors
    if (
      error.code &&
      ["ENOTFOUND", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT"].includes(
        error.code
      )
    ) {
      return "network";
    }

    // HTTP status-based classification
    if (error.status || error.response?.status) {
      const status = error.status || error.response?.status;
      if (status >= 400 && status < 500) return "client";
      if (status >= 500) return "server";
    }

    // URL construction errors
    if (error.message && /Invalid URL|URL construction/i.test(error.message)) {
      return "url_construction";
    }

    // Retry-related errors
    if (error.message && /retry/i.test(error.message)) {
      return "retry";
    }

    // Deployment-related errors
    if (
      error.message &&
      /(vercel|netlify|serverless|deployment)/i.test(error.message)
    ) {
      return "deployment";
    }

    return "unknown";
  }

  /**
   * Sanitizes stack trace to remove sensitive information
   *
   * @param {string} stackTrace - Raw stack trace
   * @returns {string} Sanitized stack trace
   * @private
   */
  _sanitizeStackTrace(stackTrace) {
    if (!this.config.maskSensitiveData) {
      return stackTrace;
    }

    // Remove potentially sensitive file paths and API keys
    return stackTrace
      .replace(/\/Users\/[^\/]+/g, "/Users/[USER]")
      .replace(/\/home\/[^\/]+/g, "/home/[USER]")
      .replace(/C:\\Users\\[^\\]+/g, "C:\\Users\\[USER]")
      .replace(/\/secret-[\w-]+/g, "/[REDACTED_PROJECT]")
      .replace(/\/[\w-]*secret[\w-]*/g, "/[REDACTED_PROJECT]")
      .replace(/[a-fA-F0-9]{32,}/g, "[REDACTED]")
      .replace(/(key|token|secret)=[^&\s]+/gi, "$1=[REDACTED]");
  }

  /**
   * Builds URL construction report from validation steps
   *
   * @param {string[]} steps - URL construction validation steps
   * @param {Error} error - Original error
   * @returns {Object} URL construction report
   * @private
   */
  _buildUrlConstructionReport(steps, error) {
    const report = {
      steps: steps || [],
      analysis: {
        totalSteps: steps?.length || 0,
        failedAt: this._findFailedStep(steps),
        successfulSteps: this._countSuccessfulSteps(steps),
        recommendations: [],
      },
    };

    // Analyze URL construction failure patterns
    if (error.message) {
      for (const [patternName, pattern] of this.urlConstructionPatterns) {
        if (pattern.pattern.test(error.message)) {
          report.analysis.matchedPattern = patternName;
          report.analysis.commonCauses = pattern.commonCauses;
          report.analysis.debuggingSteps = pattern.debuggingSteps;
          break;
        }
      }
    }

    return report;
  }

  /**
   * Builds retry context report
   *
   * @param {Object} retryContext - Retry context information
   * @param {Error} error - Original error
   * @returns {Object} Retry context report
   * @private
   */
  _buildRetryContextReport(retryContext, error) {
    const report = {
      context: retryContext || {},
      analysis: {
        retryAttempt: retryContext?.attempt || 0,
        originalUrl: retryContext?.originalUrl,
        adapterType: retryContext?.adapterType,
        preservedContext: this._analyzeRetryContextPreservation(retryContext),
        recommendations: [],
      },
    };

    // Analyze retry-specific failure patterns
    if (error.message) {
      for (const [patternName, pattern] of this.retryErrorPatterns) {
        if (pattern.pattern.test(error.message)) {
          report.analysis.matchedPattern = patternName;
          report.analysis.commonCauses = pattern.commonCauses;
          report.analysis.debuggingSteps = pattern.debuggingSteps;
          break;
        }
      }
    }

    return report;
  }

  /**
   * Analyzes retry context preservation
   *
   * @param {Object} retryContext - Retry context to analyze
   * @returns {Object} Context preservation analysis
   * @private
   */
  _analyzeRetryContextPreservation(retryContext) {
    const analysis = {
      hasOriginalUrl: !!retryContext?.originalUrl,
      hasBaseUrl: !!retryContext?.baseUrl,
      hasAdapterType: !!retryContext?.adapterType,
      hasAttemptNumber: typeof retryContext?.attempt === "number",
      hasDeploymentInfo: !!retryContext?.deployment,
      score: 0,
    };

    // Calculate preservation score
    const checks = Object.keys(analysis).filter((key) => key.startsWith("has"));
    analysis.score =
      checks.filter((key) => analysis[key]).length / checks.length;

    return analysis;
  }

  /**
   * Analyzes error for patterns and context
   *
   * @param {Error} error - Error to analyze
   * @param {Object} context - Additional context
   * @returns {Object} Error analysis
   * @private
   */
  _analyzeError(error, context) {
    const analysis = {
      category: this._classifyError(error),
      severity: this._assessErrorSeverity(error),
      deploymentRelated: this._isDeploymentRelated(error),
      retryRelated: this._isRetryRelated(error),
      urlConstructionRelated: this._isUrlConstructionRelated(error),
      patterns: this._identifyErrorPatterns(error),
    };

    return analysis;
  }

  /**
   * Generates debugging guidance based on error analysis
   *
   * @param {Error} error - Error to provide guidance for
   * @param {Object} context - Error context
   * @param {Object} report - Complete error report
   * @returns {Object} Debugging guidance
   * @private
   */
  _generateDebuggingGuidance(error, context, report) {
    const guidance = {
      immediate: [],
      investigation: [],
      prevention: [],
      deploymentSpecific: null,
    };

    // Add immediate actions based on error type
    switch (report.analysis.category) {
      case "url_construction":
        guidance.immediate.push(
          "Check baseUrl configuration and format",
          "Verify URL parameters are properly encoded",
          "Test URL construction with minimal parameters"
        );
        break;

      case "retry":
        guidance.immediate.push(
          "Check retry context preservation",
          "Verify adapter reference is available",
          "Test with retry disabled to isolate issue"
        );
        break;

      case "network":
        guidance.immediate.push(
          "Check internet connectivity",
          "Verify API endpoint accessibility",
          "Test with different network configuration"
        );
        break;

      case "deployment":
        guidance.immediate.push(
          "Check deployment environment variables",
          "Verify deployment-specific configuration",
          "Test in local environment for comparison"
        );
        break;
    }

    // Add investigation steps
    guidance.investigation.push(
      "Enable debug logging for detailed information",
      "Check browser/Node.js console for additional errors",
      "Verify SDK configuration and initialization",
      "Test with different adapter implementations"
    );

    // Add prevention strategies
    guidance.prevention.push(
      "Implement comprehensive error handling",
      "Add URL validation before requests",
      "Configure proper retry strategies",
      "Set up monitoring for deployment environments"
    );

    // Add deployment-specific guidance if applicable
    if (
      report.analysis.deploymentRelated &&
      this.deploymentInfo.platform !== "local"
    ) {
      const platformPattern = this.deploymentErrorPatterns.get(
        this.deploymentInfo.platform
      );
      if (platformPattern?.guidance) {
        guidance.deploymentSpecific = platformPattern.guidance;
      }
    }

    return guidance;
  }

  /**
   * Assesses error severity
   *
   * @param {Error} error - Error to assess
   * @returns {string} Severity level
   * @private
   */
  _assessErrorSeverity(error) {
    // Critical: errors that completely break functionality
    if (
      error.message &&
      /Invalid URL|URL construction.*failed/i.test(error.message)
    ) {
      return "critical";
    }

    // High: errors that significantly impact functionality
    if (
      error.status >= 500 ||
      (error.code && ["ENOTFOUND", "ECONNREFUSED"].includes(error.code))
    ) {
      return "high";
    }

    // Medium: recoverable errors with impact
    if (error.status >= 400 || error.retryable === false) {
      return "medium";
    }

    // Low: minor or recoverable errors
    return "low";
  }

  /**
   * Checks if error is deployment-related
   *
   * @param {Error} error - Error to check
   * @returns {boolean} True if deployment-related
   * @private
   */
  _isDeploymentRelated(error) {
    return !!(
      error.message &&
      /(vercel|netlify|serverless|deployment|edge|function)/i.test(
        error.message
      )
    );
  }

  /**
   * Checks if error is retry-related
   *
   * @param {Error} error - Error to check
   * @returns {boolean} True if retry-related
   * @private
   */
  _isRetryRelated(error) {
    return (
      !!(error.message && /retry/i.test(error.message)) || !!error.retryContext
    );
  }

  /**
   * Checks if error is URL construction-related
   *
   * @param {Error} error - Error to check
   * @returns {boolean} True if URL construction-related
   * @private
   */
  _isUrlConstructionRelated(error) {
    return !!(
      error.message && /Invalid URL|URL construction/i.test(error.message)
    );
  }

  /**
   * Identifies error patterns
   *
   * @param {Error} error - Error to analyze
   * @returns {string[]} Identified patterns
   * @private
   */
  _identifyErrorPatterns(error) {
    const patterns = [];

    // Check deployment patterns
    for (const [platform, config] of this.deploymentErrorPatterns) {
      for (const [type, typePatterns] of Object.entries(config)) {
        if (Array.isArray(typePatterns)) {
          for (const pattern of typePatterns) {
            if (pattern.test(error.message)) {
              patterns.push(`${platform}_${type}`);
            }
          }
        }
      }
    }

    // Check URL construction patterns
    for (const [patternName, pattern] of this.urlConstructionPatterns) {
      if (pattern.pattern.test(error.message)) {
        patterns.push(`url_${patternName}`);
      }
    }

    // Check retry patterns
    for (const [patternName, pattern] of this.retryErrorPatterns) {
      if (pattern.pattern.test(error.message)) {
        patterns.push(`retry_${patternName}`);
      }
    }

    return patterns;
  }

  /**
   * Finds the failed step in URL construction
   *
   * @param {string[]} steps - Construction steps
   * @returns {number|null} Index of failed step
   * @private
   */
  _findFailedStep(steps) {
    if (!steps) return null;

    for (let i = 0; i < steps.length; i++) {
      if (steps[i].includes("FAILED") || steps[i].includes("failed")) {
        return i;
      }
    }

    return null;
  }

  /**
   * Counts successful steps in URL construction
   *
   * @param {string[]} steps - Construction steps
   * @returns {number} Number of successful steps
   * @private
   */
  _countSuccessfulSteps(steps) {
    if (!steps) return 0;

    return steps.filter(
      (step) =>
        step.includes("SUCCESS") ||
        step.includes("success") ||
        (!step.includes("FAILED") && !step.includes("failed"))
    ).length;
  }

  /**
   * Logs error report based on configuration
   *
   * @param {Object} report - Error report to log
   * @param {Error} error - Original error
   * @private
   */
  _logErrorReport(report, error) {
    const message = `Error Report ${report.reportId}: ${error.message}`;

    switch (report.analysis.severity) {
      case "critical":
        this.config.logger.error(message, report);
        break;
      case "high":
        this.config.logger.error(message, report);
        break;
      case "medium":
        this.config.logger.warn(message, report);
        break;
      case "low":
        this.config.logger.info(message, report);
        break;
      default:
        this.config.logger.debug(message, report);
    }
  }

  /**
   * Creates a simplified error report for production
   *
   * @param {Error} error - Error to report
   * @param {Object} [context={}] - Additional context
   * @returns {Object} Simplified error report
   */
  createSimplifiedReport(error, context = {}) {
    return {
      timestamp: new Date().toISOString(),
      message: error.message,
      type: this._classifyError(error),
      retryable: error.retryable !== false,
      deployment: this.deploymentInfo.platform,
      guidance: this._getQuickGuidance(error),
    };
  }

  /**
   * Gets quick guidance for common error types
   *
   * @param {Error} error - Error to provide guidance for
   * @returns {string} Quick guidance message
   * @private
   */
  _getQuickGuidance(error) {
    if (this._isUrlConstructionRelated(error)) {
      return "Check baseUrl configuration and URL parameters";
    }

    if (this._isRetryRelated(error)) {
      return "Verify retry configuration and adapter setup";
    }

    if (this._isDeploymentRelated(error)) {
      return "Check deployment environment configuration";
    }

    if (error.status >= 400 && error.status < 500) {
      return "Check API credentials and request parameters";
    }

    if (error.status >= 500) {
      return "Server error - retry may resolve the issue";
    }

    return "Check SDK configuration and network connectivity";
  }

  /**
   * Updates reporter configuration
   *
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
}

export default EnhancedErrorReporter;
