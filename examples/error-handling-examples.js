/**
 * Error Handling Examples for TestLuy Payment SDK
 *
 * This file demonstrates comprehensive error handling patterns
 * for different scenarios when using the TestLuy Payment SDK.
 */

import TestluyPaymentSDK, {
  SDKError,
  RateLimitError,
  CloudflareError,
  NetworkError,
  ValidationError,
} from "testluy-payment-sdk";

// ================================
// 1. BASIC ERROR HANDLING
// ================================

/**
 * Basic error handling with try-catch
 */
async function basicErrorHandling() {
  const sdk = new TestluyPaymentSDK({
    clientId: process.env.TESTLUY_CLIENT_ID,
    secretKey: process.env.TESTLUY_SECRET_KEY,
    baseUrl: process.env.TESTLUY_BASE_URL,
  });

  try {
    const result = await sdk.initiatePayment(
      25.5,
      "https://example.com/callback"
    );

    console.log("Payment initiated successfully:", result.transactionId);
    return result;
  } catch (error) {
    console.error("Payment initiation failed:", error.message);

    // Log additional error details for debugging
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });

    throw error; // Re-throw for upstream handling
  }
}

// ================================
// 2. SPECIFIC ERROR TYPE HANDLING
// ================================

/**
 * Handle different types of errors with specific responses
 */
async function advancedErrorHandling(amount, callbackUrl) {
  const sdk = new TestluyPaymentSDK({
    clientId: process.env.TESTLUY_CLIENT_ID,
    secretKey: process.env.TESTLUY_SECRET_KEY,
    baseUrl: process.env.TESTLUY_BASE_URL,
    loggingConfig: { level: "debug" },
  });

  try {
    const result = await sdk.initiatePayment(amount, callbackUrl);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof RateLimitError) {
      console.warn("Rate limit exceeded:", {
        subscription: error.subscription,
        limit: error.limit,
        retryAfter: error.retryAfter,
        upgradeInfo: error.upgradeInfo,
      });

      return {
        success: false,
        error: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests. Please try again later.",
        retryAfter: error.retryAfter,
        upgradeInfo: error.upgradeInfo,
      };
    } else if (error instanceof CloudflareError) {
      console.error("Cloudflare protection triggered:", {
        challengeType: error.challengeType,
        rayId: error.rayId,
      });

      return {
        success: false,
        error: "CLOUDFLARE_PROTECTION",
        message: "Request blocked by security protection. Please try again.",
        rayId: error.rayId,
      };
    } else if (error instanceof ValidationError) {
      console.error("Validation failed:", error.validationDetails);

      return {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Invalid input parameters.",
        details: error.validationDetails,
      };
    } else if (error instanceof NetworkError) {
      console.error("Network error:", {
        code: error.code,
        timeout: error.timeout,
        retryCount: error.retryCount,
      });

      return {
        success: false,
        error: "NETWORK_ERROR",
        message:
          "Network connection failed. Please check your internet connection.",
        retryable: true,
      };
    } else if (error instanceof SDKError) {
      console.error("SDK error:", {
        requestId: error.requestId,
        statusCode: error.statusCode,
        details: error.details,
      });

      return {
        success: false,
        error: "SDK_ERROR",
        message: error.message,
        requestId: error.requestId,
      };
    } else {
      // Unknown error
      console.error("Unknown error:", error);

      return {
        success: false,
        error: "UNKNOWN_ERROR",
        message: "An unexpected error occurred. Please try again.",
      };
    }
  }
}

// ================================
// 3. RETRY LOGIC WITH ERROR HANDLING
// ================================

/**
 * Implement custom retry logic with exponential backoff
 */
async function paymentWithRetry(amount, callbackUrl, maxRetries = 3) {
  const sdk = new TestluyPaymentSDK({
    clientId: process.env.TESTLUY_CLIENT_ID,
    secretKey: process.env.TESTLUY_SECRET_KEY,
    baseUrl: process.env.TESTLUY_BASE_URL,
    retryConfig: {
      maxRetries: 1, // Let the SDK do one retry, then we handle additional retries
      baseDelay: 1000,
    },
  });

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Payment attempt ${attempt}/${maxRetries}`);

      const result = await sdk.initiatePayment(amount, callbackUrl);

      console.log(`Payment successful on attempt ${attempt}`);
      return result;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);

      // Don't retry for certain error types
      if (error instanceof ValidationError) {
        console.error("Validation error - not retrying");
        throw error;
      }

      if (error.message.includes("Invalid credentials")) {
        console.error("Authentication error - not retrying");
        throw error;
      }

      // For rate limiting, wait for the suggested time
      if (error instanceof RateLimitError) {
        if (attempt < maxRetries) {
          const waitTime = error.retryAfter || 1000 * Math.pow(2, attempt);
          console.log(`Rate limited - waiting ${waitTime}ms before retry`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }
      }

      // For network errors, wait with exponential backoff
      if (error instanceof NetworkError || error.code === "ECONNRESET") {
        if (attempt < maxRetries) {
          const waitTime = 1000 * Math.pow(2, attempt) + Math.random() * 1000;
          console.log(`Network error - waiting ${waitTime}ms before retry`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }
      }

      // If we've exhausted all retries or it's a non-retryable error
      if (attempt === maxRetries) {
        console.error(`All ${maxRetries} attempts failed`);
        throw new Error(
          `Payment failed after ${maxRetries} attempts: ${error.message}`
        );
      }
    }
  }
}

// ================================
// 4. EXPRESS.JS ERROR MIDDLEWARE
// ================================

/**
 * Express.js middleware for handling payment errors
 */
function createPaymentErrorHandler() {
  return (error, req, res, next) => {
    console.error("Payment error:", {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      body: req.body,
      headers: req.headers,
      timestamp: new Date().toISOString(),
    });

    if (error instanceof RateLimitError) {
      return res.status(429).json({
        error: "Too many payment requests",
        message: "Please wait before making another payment request",
        retryAfter: error.retryAfter,
        currentPlan: error.subscription,
        upgradeInfo: error.upgradeInfo,
      });
    }

    if (error instanceof ValidationError) {
      return res.status(400).json({
        error: "Invalid payment parameters",
        message: error.message,
        details: error.validationDetails,
      });
    }

    if (error instanceof CloudflareError) {
      return res.status(503).json({
        error: "Service temporarily unavailable",
        message: "Please try again in a few moments",
        rayId: error.rayId,
      });
    }

    if (error instanceof NetworkError) {
      return res.status(502).json({
        error: "Network error",
        message: "Unable to connect to payment service",
        retryable: true,
      });
    }

    // Generic error response
    res.status(500).json({
      error: "Payment processing failed",
      message: "An unexpected error occurred. Please try again.",
      requestId: generateRequestId(),
    });
  };
}

// ================================
// 5. NEXT.JS API ROUTE ERROR HANDLING
// ================================

/**
 * Next.js API route with comprehensive error handling
 */
export async function POST(request) {
  const sdk = new TestluyPaymentSDK({
    clientId: process.env.TESTLUY_CLIENT_ID,
    secretKey: process.env.TESTLUY_SECRET_KEY,
    baseUrl: process.env.TESTLUY_BASE_URL,
  });

  try {
    const body = await request.json();
    const { amount, orderId } = body;

    const result = await sdk.initiatePayment(
      amount,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/callback?orderId=${orderId}`
    );

    return Response.json({
      success: true,
      paymentUrl: result.paymentUrl,
      transactionId: result.transactionId,
    });
  } catch (error) {
    console.error("Payment API error:", error);

    if (error instanceof RateLimitError) {
      return Response.json(
        {
          error: "RATE_LIMIT_EXCEEDED",
          message:
            "Too many payment requests. Please wait before trying again.",
          retryAfter: error.retryAfter,
          upgradeInfo: error.upgradeInfo,
        },
        {
          status: 429,
          headers: {
            "Retry-After": error.retryAfter?.toString() || "60",
          },
        }
      );
    }

    if (error instanceof ValidationError) {
      return Response.json(
        {
          error: "VALIDATION_ERROR",
          message: "Invalid payment parameters",
          details: error.validationDetails,
        },
        { status: 400 }
      );
    }

    if (error instanceof CloudflareError) {
      return Response.json(
        {
          error: "SERVICE_UNAVAILABLE",
          message: "Payment service temporarily unavailable. Please try again.",
          rayId: error.rayId,
        },
        { status: 503 }
      );
    }

    // Generic error
    return Response.json(
      {
        error: "PAYMENT_FAILED",
        message: "Payment initiation failed. Please try again.",
        requestId: generateRequestId(),
      },
      { status: 500 }
    );
  }
}

// ================================
// 6. CALLBACK ERROR HANDLING
// ================================

/**
 * Handle errors in payment callback verification
 */
async function handlePaymentCallback(callbackData) {
  const sdk = new TestluyPaymentSDK({
    clientId: process.env.TESTLUY_CLIENT_ID,
    secretKey: process.env.TESTLUY_SECRET_KEY,
    baseUrl: process.env.TESTLUY_BASE_URL,
  });

  try {
    const verifiedResult = await sdk.handlePaymentCallback(callbackData);

    console.log("Callback verified successfully:", {
      transactionId: verifiedResult.transactionId,
      status: verifiedResult.status,
      amount: verifiedResult.paymentDetails.amount,
    });

    return {
      success: true,
      verified: true,
      data: verifiedResult,
    };
  } catch (error) {
    console.error("Callback verification failed:", {
      error: error.message,
      callbackData,
      timestamp: new Date().toISOString(),
    });

    if (error.message.includes("Transaction not found")) {
      return {
        success: false,
        error: "TRANSACTION_NOT_FOUND",
        message: "Invalid transaction ID",
        verified: false,
      };
    }

    if (error.message.includes("Invalid signature")) {
      return {
        success: false,
        error: "INVALID_SIGNATURE",
        message: "Callback verification failed - possible tampering detected",
        verified: false,
      };
    }

    if (error instanceof NetworkError) {
      return {
        success: false,
        error: "VERIFICATION_FAILED",
        message: "Unable to verify payment status",
        verified: false,
        retryable: true,
      };
    }

    return {
      success: false,
      error: "UNKNOWN_ERROR",
      message: "Callback verification failed",
      verified: false,
    };
  }
}

// ================================
// 7. MONITORING AND ALERTING
// ================================

/**
 * Error monitoring and alerting utilities
 */
class PaymentErrorMonitor {
  constructor(options = {}) {
    this.errorCounts = new Map();
    this.alertThreshold = options.alertThreshold || 5;
    this.timeWindow = options.timeWindow || 5 * 60 * 1000; // 5 minutes
    this.onAlert = options.onAlert || this.defaultAlertHandler;
  }

  recordError(error, context = {}) {
    const errorKey = this.getErrorKey(error);
    const now = Date.now();

    if (!this.errorCounts.has(errorKey)) {
      this.errorCounts.set(errorKey, []);
    }

    const errors = this.errorCounts.get(errorKey);
    errors.push({ timestamp: now, context });

    // Remove old errors outside the time window
    const cutoff = now - this.timeWindow;
    this.errorCounts.set(
      errorKey,
      errors.filter((e) => e.timestamp > cutoff)
    );

    // Check if we should alert
    if (errors.length >= this.alertThreshold) {
      this.onAlert(errorKey, errors, error);
    }
  }

  getErrorKey(error) {
    if (error instanceof RateLimitError) return "RATE_LIMIT";
    if (error instanceof CloudflareError) return "CLOUDFLARE";
    if (error instanceof NetworkError) return "NETWORK";
    if (error instanceof ValidationError) return "VALIDATION";
    return "UNKNOWN";
  }

  defaultAlertHandler(errorKey, errors, latestError) {
    console.error(`🚨 ALERT: ${errorKey} errors exceeded threshold`, {
      errorType: errorKey,
      count: errors.length,
      threshold: this.alertThreshold,
      timeWindow: this.timeWindow,
      latestError: latestError.message,
      timestamp: new Date().toISOString(),
    });

    // In production, you might want to:
    // - Send to monitoring service (Sentry, DataDog, etc.)
    // - Send Slack/email notifications
    // - Trigger auto-scaling or failover
  }
}

// Usage example
const errorMonitor = new PaymentErrorMonitor({
  alertThreshold: 3,
  timeWindow: 2 * 60 * 1000, // 2 minutes
  onAlert: (errorKey, errors, latestError) => {
    // Custom alert logic
    console.error(`Multiple ${errorKey} errors detected!`);
    // sendSlackNotification(errorKey, errors.length);
  },
});

// ================================
// 8. UTILITY FUNCTIONS
// ================================

function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function isRetryableError(error) {
  return (
    error instanceof NetworkError ||
    error instanceof CloudflareError ||
    error.code === "ECONNRESET" ||
    error.code === "ETIMEDOUT" ||
    (error.response && error.response.status >= 500)
  );
}

function getErrorSeverity(error) {
  if (error instanceof ValidationError) return "low";
  if (error instanceof RateLimitError) return "medium";
  if (error instanceof CloudflareError) return "high";
  if (error instanceof NetworkError) return "medium";
  return "high";
}

export {
  basicErrorHandling,
  advancedErrorHandling,
  paymentWithRetry,
  createPaymentErrorHandler,
  handlePaymentCallback,
  PaymentErrorMonitor,
  generateRequestId,
  isRetryableError,
  getErrorSeverity,
};
