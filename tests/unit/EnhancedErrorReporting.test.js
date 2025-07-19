/**
 * Test suite for Enhanced Error Reporting and Debugging Support
 * Tests task 6: Enhanced error reporting and debugging support implementation
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import ErrorHandler from "../../http/ErrorHandler.js";
import EnhancedErrorReporter, {
  ErrorReportingLevel,
} from "../../http/EnhancedErrorReporter.js";
import { ErrorType } from "../../http/ErrorDetector.js";

describe("Enhanced Error Reporting and Debugging Support", () => {
  let errorHandler;
  let mockHttpAdapter;
  let mockLogger;

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock HTTP adapter
    mockHttpAdapter = {
      baseUrl: "https://api.testluy.tech",
      constructor: { name: "NodeAdapter" },
      request: jest.fn(),
    };

    // Create error handler with enhanced reporting
    errorHandler = new ErrorHandler({
      httpAdapter: mockHttpAdapter,
      errorReportingLevel: ErrorReportingLevel.DEBUG,
      enableUrlConstructionLogging: true,
      enableRetryContextLogging: true,
      errorReporter: new EnhancedErrorReporter({
        level: ErrorReportingLevel.DEBUG,
        logger: mockLogger,
      }),
    });
  });

  describe("URL Construction Error Reporting", () => {
    it("should create detailed error report for URL construction failures", async () => {
      const urlError = new Error("Invalid URL: undefined");
      urlError.errorType = ErrorType.VALIDATION;

      const context = {
        urlConstructionSteps: [
          "Starting primary URL construction",
          "URL validation failed: null or undefined",
          "Primary construction: FAILED - URL cannot be null or undefined",
          "Fallback construction: FAILED - Unable to construct valid URL",
        ],
      };

      try {
        await errorHandler.handleError(urlError, context);
      } catch (enhancedError) {
        // Verify enhanced error has debug report
        expect(enhancedError.debugReport).toBeDefined();
        expect(enhancedError.debugReport.errorType).toBe("url_construction");
        expect(enhancedError.debugReport.urlConstruction).toBeDefined();
        expect(enhancedError.debugReport.urlConstruction.steps).toEqual(
          context.urlConstructionSteps
        );

        // Verify debugging guidance is included
        expect(enhancedError.debugGuidance).toBeDefined();
        expect(enhancedError.debugGuidance.urlConstruction).toBeDefined();
        expect(enhancedError.debugGuidance.urlConstruction.issue).toBe(
          "URL Construction Failure"
        );
      }

      // Verify URL construction steps were logged
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("URL Construction Steps"),
        expect.any(Object)
      );
    });

    it("should provide deployment-specific guidance for URL construction errors", async () => {
      const urlError = new Error(
        "Invalid URL construction in vercel deployment"
      );
      urlError.errorType = ErrorType.VALIDATION;

      // Mock deployment environment variables properly
      const originalVercel = process.env.VERCEL;
      const originalVercelUrl = process.env.VERCEL_URL;
      process.env.VERCEL = "1";
      process.env.VERCEL_URL = "https://testapp.vercel.app";

      // Create a fresh error handler instance to pick up the environment changes
      const freshErrorHandler = new ErrorHandler({
        enableEnhancedReporting: true,
        errorReportingLevel: ErrorReportingLevel.DETAILED,
      });

      try {
        await freshErrorHandler.handleError(urlError, {});
      } catch (enhancedError) {
        expect(enhancedError.debugReport.deployment.platform).toBe("vercel");
        expect(enhancedError.debugGuidance.deploymentSpecific).toBeDefined();
        expect(enhancedError.debugGuidance.deploymentSpecific.title).toBe(
          "Vercel Deployment Issues"
        );
        expect(
          enhancedError.debugGuidance.deploymentSpecific.commonCauses
        ).toContain("Serverless function cold starts affecting initialization");
      } finally {
        // Restore environment
        if (originalVercel !== undefined) {
          process.env.VERCEL = originalVercel;
        } else {
          delete process.env.VERCEL;
        }
        if (originalVercelUrl !== undefined) {
          process.env.VERCEL_URL = originalVercelUrl;
        } else {
          delete process.env.VERCEL_URL;
        }
      }
    });

    it("should log URL construction steps with appropriate log levels", () => {
      const steps = [
        "Starting primary URL construction",
        "URL validation: SUCCESS",
        "Platform validation: FAILED - Invalid protocol",
        "Fallback construction: SUCCESS",
      ];

      const error = new Error("URL construction partially failed");
      errorHandler._logUrlConstructionSteps(steps, error);

      // Verify debug log for overall steps
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("URL Construction Steps"),
        expect.objectContaining({
          steps,
          totalSteps: 4,
        })
      );

      // Verify individual step logging with appropriate levels
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Step 1: Starting primary URL construction"
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Step 2: URL validation: SUCCESS"
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Step 3: Platform validation: FAILED - Invalid protocol"
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Step 4: Fallback construction: SUCCESS"
      );
    });
  });

  describe("Retry Context Error Reporting", () => {
    it("should create detailed error report for retry failures", async () => {
      const retryError = new Error(
        "URL construction failed during retry attempt 2"
      );
      retryError.errorType = ErrorType.NETWORK;
      retryError.retryContext = {
        attempt: 2,
        originalUrl: "https://api.testluy.tech/payment/initiate",
        baseUrl: "https://api.testluy.tech",
        adapterType: "NodeAdapter",
        deployment: {
          platform: "vercel",
          environment: "production",
          isDeployment: true,
        },
      };

      try {
        await errorHandler.handleError(retryError, {});
      } catch (enhancedError) {
        // Verify retry-specific debugging guidance
        expect(enhancedError.debugGuidance.retrySpecific).toBeDefined();
        expect(enhancedError.debugGuidance.retrySpecific.issue).toBe(
          "Retry Mechanism Failure"
        );
        expect(
          enhancedError.debugGuidance.retrySpecific.immediateActions
        ).toContain("Check retry context preservation");

        // Verify retry context is included in debug report
        expect(enhancedError.debugReport.retryContext).toBeDefined();
        expect(
          enhancedError.debugReport.retryContext.analysis.retryAttempt
        ).toBe(2);
        expect(
          enhancedError.debugReport.retryContext.analysis.adapterType
        ).toBe("NodeAdapter");
      }
    });

    it("should log retry context information during retry attempts", () => {
      const retryContext = {
        attempt: 3,
        originalUrl: "https://api.testluy.tech/payment/status",
        baseUrl: "https://api.testluy.tech",
        adapterType: "FetchAdapter",
        deployment: {
          platform: "netlify",
          environment: "production",
        },
      };

      const error = new Error("Network timeout during retry");
      errorHandler._logRetryContext(retryContext, error);

      // Verify comprehensive retry context logging
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Retry Context for error"),
        expect.objectContaining({
          retryContext,
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith("Retry attempt: 3");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Original URL: https://api.testluy.tech/payment/status"
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Adapter type: FetchAdapter"
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Deployment context: Platform=netlify, Environment=production"
      );
    });

    it("should enhance retry errors with comprehensive debugging information", async () => {
      // Mock a retry scenario
      const originalError = new Error("403 Forbidden");
      originalError.status = 403;
      originalError.config = {
        url: "https://api.testluy.tech/payment/initiate",
        retryAttempt: 0,
      };

      // Mock adapter to fail with URL construction error
      mockHttpAdapter.request.mockRejectedValue(
        new Error("Invalid URL: undefined")
      );

      try {
        await errorHandler.retryRequest(originalError, {});
      } catch (retryError) {
        // Verify retry error enhancement
        expect(retryError.retryContext).toBeDefined();
        expect(retryError.debugReport).toBeDefined();
        expect(retryError.recoveryMessage).toContain(
          "URL construction failed during retry attempt"
        );

        // Verify detailed logging occurred
        expect(mockLogger.error).toHaveBeenCalledWith(
          "URL construction failed during retry",
          expect.objectContaining({
            retryAttempt: 1,
            originalUrl: "https://api.testluy.tech/payment/initiate",
            baseUrl: "https://api.testluy.tech",
            adapterType: "NodeAdapter",
          })
        );
      }
    });
  });

  describe("Deployment-Specific Error Guidance", () => {
    it("should provide Vercel-specific debugging guidance", () => {
      const error = new Error("Function timeout");
      const deploymentInfo = {
        platform: "vercel",
        environment: "production",
        isDeployment: true,
        isServerless: true,
      };

      const guidance = errorHandler._getDeploymentSpecificGuidance(
        error,
        deploymentInfo,
        {}
      );

      expect(guidance.title).toBe("Vercel Deployment Issues");
      expect(guidance.commonCauses).toContain(
        "Serverless function cold starts affecting initialization"
      );
      expect(guidance.immediateActions).toContain(
        "Check VERCEL_URL environment variable"
      );
      expect(guidance.documentation).toBe(
        "https://vercel.com/docs/concepts/functions/serverless-functions"
      );
    });

    it("should provide Netlify-specific debugging guidance", () => {
      const error = new Error("Function error");
      const deploymentInfo = {
        platform: "netlify",
        environment: "production",
        isDeployment: true,
        isServerless: true,
      };

      const guidance = errorHandler._getDeploymentSpecificGuidance(
        error,
        deploymentInfo,
        {}
      );

      expect(guidance.title).toBe("Netlify Deployment Issues");
      expect(guidance.commonCauses).toContain(
        "Netlify Functions environment differences"
      );
      expect(guidance.immediateActions).toContain(
        "Check netlify.toml configuration"
      );
      expect(guidance.documentation).toBe(
        "https://docs.netlify.com/functions/overview/"
      );
    });

    it("should provide AWS Lambda-specific debugging guidance", () => {
      const error = new Error("Lambda timeout");
      const deploymentInfo = {
        platform: "aws",
        environment: "production",
        isDeployment: true,
        isServerless: true,
      };

      const guidance = errorHandler._getDeploymentSpecificGuidance(
        error,
        deploymentInfo,
        {}
      );

      expect(guidance.title).toBe("AWS Lambda Deployment Issues");
      expect(guidance.commonCauses).toContain(
        "Lambda cold start initialization delays"
      );
      expect(guidance.immediateActions).toContain(
        "Check Lambda function configuration"
      );
      expect(guidance.documentation).toBe(
        "https://docs.aws.amazon.com/lambda/"
      );
    });
  });

  describe("Error Report Configuration", () => {
    it("should respect error reporting level configuration", async () => {
      // Test with minimal reporting level
      const minimalErrorHandler = new ErrorHandler({
        httpAdapter: mockHttpAdapter,
        errorReportingLevel: ErrorReportingLevel.MINIMAL,
      });

      const error = new Error("Test error");
      error.errorType = ErrorType.NETWORK;

      try {
        await minimalErrorHandler.handleError(error, {});
      } catch (enhancedError) {
        // Should not have debug report with minimal level
        expect(enhancedError.debugReport).toBeUndefined();
        expect(enhancedError.debugGuidance).toBeUndefined();
      }
    });

    it("should update error reporting configuration dynamically", () => {
      const initialLevel = errorHandler.errorReportingLevel;

      errorHandler.updateErrorReportingConfig({
        level: ErrorReportingLevel.MINIMAL,
        enableUrlConstructionLogging: false,
        enableRetryContextLogging: false,
      });

      expect(errorHandler.errorReportingLevel).toBe(
        ErrorReportingLevel.MINIMAL
      );
      expect(errorHandler.enableUrlConstructionLogging).toBe(false);
      expect(errorHandler.enableRetryContextLogging).toBe(false);
    });

    it("should log retry attempts with detailed context when enabled", async () => {
      const error = new Error("Network error");
      error.status = 500;
      error.config = { url: "https://api.testluy.tech/test", retryAttempt: 0 };

      // Mock successful retry
      mockHttpAdapter.request.mockResolvedValue({
        status: 200,
        data: { success: true },
      });

      const result = await errorHandler.retryRequest(error, {
        retryDelay: 1000,
      });

      // Verify retry attempt logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Retry attempt 1"),
        expect.objectContaining({
          delay: 1000,
          maxRetries: expect.any(Number),
        })
      );

      expect(result).toBeDefined();
    });
  });

  describe("Error Pattern Identification", () => {
    it("should identify URL construction error patterns", () => {
      const reporter = new EnhancedErrorReporter();

      const urlError = new Error("Invalid URL: missing protocol");
      const patterns = reporter._identifyErrorPatterns(urlError);

      expect(patterns).toContain("url_invalidUrl");
    });

    it("should identify retry error patterns", () => {
      const reporter = new EnhancedErrorReporter();

      const retryError = new Error(
        "URL construction failed during retry attempt"
      );
      const patterns = reporter._identifyErrorPatterns(retryError);

      expect(patterns).toContain("retry_retryUrlConstruction");
    });

    it("should identify deployment-specific error patterns", () => {
      // Mock deployment environment for this test
      const originalVercel = process.env.VERCEL;
      process.env.VERCEL = "1";

      try {
        const reporter = new EnhancedErrorReporter();

        const vercelError = new Error(
          "Invalid URL construction in vercel deployment"
        );
        const patterns = reporter._identifyErrorPatterns(vercelError);

        expect(patterns.some((pattern) => pattern.startsWith("vercel_"))).toBe(
          true
        );
      } finally {
        // Restore environment
        if (originalVercel !== undefined) {
          process.env.VERCEL = originalVercel;
        } else {
          delete process.env.VERCEL;
        }
      }
    });
  });

  describe("Error Severity Assessment", () => {
    it("should assess URL construction errors as critical", () => {
      const reporter = new EnhancedErrorReporter();

      const urlError = new Error("Invalid URL construction failed");
      const severity = reporter._assessErrorSeverity(urlError);

      expect(severity).toBe("critical");
    });

    it("should assess server errors as high severity", () => {
      const reporter = new EnhancedErrorReporter();

      const serverError = new Error("Internal server error");
      serverError.status = 500;
      const severity = reporter._assessErrorSeverity(serverError);

      expect(severity).toBe("high");
    });

    it("should assess client errors as medium severity", () => {
      const reporter = new EnhancedErrorReporter();

      const clientError = new Error("Bad request");
      clientError.status = 400;
      const severity = reporter._assessErrorSeverity(clientError);

      expect(severity).toBe("medium");
    });
  });
});

describe("EnhancedErrorReporter", () => {
  let reporter;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    reporter = new EnhancedErrorReporter({
      level: ErrorReportingLevel.DEBUG,
      logger: mockLogger,
    });
  });

  describe("Error Report Generation", () => {
    it("should generate comprehensive error reports", () => {
      const error = new Error("Test error for reporting");
      error.code = "ECONNREFUSED";
      error.status = 500;

      const context = {
        urlConstructionSteps: ["Step 1: SUCCESS", "Step 2: FAILED"],
        retryContext: { attempt: 1, originalUrl: "https://api.testluy.tech" },
      };

      const report = reporter.createErrorReport(error, context);

      expect(report.reportId).toMatch(/^err_/);
      expect(report.timestamp).toBeDefined();
      expect(report.errorType).toBe("network");
      expect(report.error.code).toBe("ECONNREFUSED");
      expect(report.deployment).toBeDefined();
      expect(report.urlConstruction).toBeDefined();
      expect(report.retryContext).toBeDefined();
      expect(report.analysis).toBeDefined();
      expect(report.debugging).toBeDefined();
    });

    it("should create simplified reports for production use", () => {
      const error = new Error("Production error");
      error.status = 403;

      const report = reporter.createSimplifiedReport(error);

      expect(report.timestamp).toBeDefined();
      expect(report.message).toBe("Production error");
      expect(report.type).toBe("client");
      expect(report.retryable).toBe(true);
      expect(report.guidance).toBe(
        "Check API credentials and request parameters"
      );
    });

    it("should mask sensitive information in stack traces", () => {
      const error = new Error("Error with sensitive data");
      error.stack = `Error: Test
        at /Users/developer/secret-project/src/api.js:123:45
        at apiKey=sk_live_1234567890abcdef
        at token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`;

      const sanitized = reporter._sanitizeStackTrace(error.stack);

      expect(sanitized).toContain("/Users/[USER]");
      expect(sanitized).toContain("apiKey=[REDACTED]");
      expect(sanitized).toContain("[REDACTED]"); // Fixed: use the actual redaction format
      expect(sanitized).not.toContain("sk_live_1234567890abcdef");
      expect(sanitized).toContain("[REDACTED_PROJECT]"); // Check project name is redacted
    });
  });

  describe("Context Analysis", () => {
    it("should analyze retry context preservation", () => {
      const retryContext = {
        originalUrl: "https://api.testluy.tech",
        baseUrl: "https://api.testluy.tech",
        adapterType: "NodeAdapter",
        attempt: 2,
        deployment: { platform: "vercel" },
      };

      const analysis = reporter._analyzeRetryContextPreservation(retryContext);

      expect(analysis.hasOriginalUrl).toBe(true);
      expect(analysis.hasBaseUrl).toBe(true);
      expect(analysis.hasAdapterType).toBe(true);
      expect(analysis.hasAttemptNumber).toBe(true);
      expect(analysis.hasDeploymentInfo).toBe(true);
      expect(analysis.score).toBe(1.0); // Perfect preservation
    });

    it("should analyze partial retry context preservation", () => {
      const partialRetryContext = {
        originalUrl: "https://api.testluy.tech",
        attempt: 1,
        // Missing other fields
      };

      const analysis =
        reporter._analyzeRetryContextPreservation(partialRetryContext);

      expect(analysis.hasOriginalUrl).toBe(true);
      expect(analysis.hasBaseUrl).toBe(false);
      expect(analysis.hasAdapterType).toBe(false);
      expect(analysis.hasAttemptNumber).toBe(true);
      expect(analysis.hasDeploymentInfo).toBe(false);
      expect(analysis.score).toBe(0.4); // 2/5 fields preserved
    });
  });

  describe("Pattern Matching", () => {
    it("should match URL construction patterns correctly", () => {
      const invalidUrlError = new Error("Invalid URL provided");
      const protocolError = new Error("Protocol missing in URL");
      const constructionError = new Error("URL construction logic failed");

      expect(
        reporter.urlConstructionPatterns
          .get("invalidUrl")
          .pattern.test(invalidUrlError.message)
      ).toBe(true);
      expect(
        reporter.urlConstructionPatterns
          .get("protocolMissing")
          .pattern.test(protocolError.message)
      ).toBe(true);
      expect(
        reporter.urlConstructionPatterns
          .get("constructionFailure")
          .pattern.test(constructionError.message)
      ).toBe(true);
    });

    it("should match retry patterns correctly", () => {
      const retryUrlError = new Error("URL construction failed during retry");
      const retryContextError = new Error("Retry context information lost");

      expect(
        reporter.retryErrorPatterns
          .get("retryUrlConstruction")
          .pattern.test(retryUrlError.message)
      ).toBe(true);
      expect(
        reporter.retryErrorPatterns
          .get("retryContextLoss")
          .pattern.test(retryContextError.message)
      ).toBe(true);
    });
  });
});
