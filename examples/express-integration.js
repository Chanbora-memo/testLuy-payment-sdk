/**
 * Express.js Integration Example for TestLuy Payment SDK
 *
 * This example demonstrates how to integrate the TestLuy Payment SDK
 * with an Express.js server for payment processing.
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import TestluyPaymentSDK from "testluy-payment-sdk";

const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api/", limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Initialize TestLuy SDK
let sdk = null;

async function initializeSDK() {
  try {
    sdk = new TestluyPaymentSDK({
      clientId: process.env.TESTLUY_CLIENT_ID,
      secretKey: process.env.TESTLUY_SECRET_KEY,
      baseUrl:
        process.env.TESTLUY_BASE_URL || "https://api-testluy.paragoniu.app",
      retryConfig: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffFactor: 2,
      },
      loggingConfig: {
        level: process.env.NODE_ENV === "production" ? "warn" : "info",
        maskSensitive: true,
      },
    });

    // Validate credentials on startup
    await sdk.init();
    console.log("✅ TestLuy SDK initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize TestLuy SDK:", error.message);
    process.exit(1); // Exit if SDK initialization fails
  }
}

// Initialize SDK on server startup
await initializeSDK();

// Middleware to ensure SDK is available
const ensureSDK = (req, res, next) => {
  if (!sdk) {
    return res.status(503).json({
      error: "Payment service temporarily unavailable",
    });
  }
  next();
};

// Payment initiation endpoint
app.post("/api/payment/initiate", ensureSDK, async (req, res) => {
  try {
    const { amount, orderId, customerEmail, metadata = {} } = req.body;

    // Input validation
    if (!amount || amount <= 0) {
      return res.status(400).json({
        error: "Invalid amount provided",
        details: "Amount must be a positive number",
      });
    }

    if (!orderId) {
      return res.status(400).json({
        error: "Order ID is required",
      });
    }

    // Construct callback URLs
    const baseUrl = process.env.APP_BASE_URL || "http://localhost:8000";
    const callbackUrl = `${baseUrl}/api/payment/callback?orderId=${orderId}`;
    const backUrl = `${baseUrl}/orders/${orderId}`;

    // Initiate payment
    const result = await sdk.initiatePayment(
      parseFloat(amount),
      callbackUrl,
      backUrl
    );

    // Log payment initiation
    console.log(`💳 Payment initiated:`, {
      orderId,
      transactionId: result.transactionId,
      amount,
      customerEmail,
      timestamp: new Date().toISOString(),
    });

    // Store payment information in database (implement your logic)
    await storePaymentRecord({
      orderId,
      transactionId: result.transactionId,
      amount,
      customerEmail,
      status: "initiated",
      metadata,
    });

    res.status(200).json({
      success: true,
      paymentUrl: result.paymentUrl,
      transactionId: result.transactionId,
      orderId,
    });
  } catch (error) {
    console.error("💥 Payment initiation failed:", error.message);

    // Handle rate limiting
    if (error.message.includes("Rate limit exceeded")) {
      return res.status(429).json({
        error: "Too many payment requests. Please try again later.",
        retryAfter: error.retryAfter || 60,
      });
    }

    // Handle validation errors
    if (error.message.includes("validation failed")) {
      return res.status(400).json({
        error: "Invalid payment parameters",
        details: error.message,
      });
    }

    // Generic error response
    res.status(500).json({
      error: "Payment initiation failed. Please try again.",
      requestId: generateRequestId(),
    });
  }
});

// Payment callback endpoint
app.get("/api/payment/callback", ensureSDK, async (req, res) => {
  try {
    const callbackData = req.query;
    const orderId = req.query.orderId;

    console.log("📞 Payment callback received:", {
      orderId,
      timestamp: new Date().toISOString(),
      callbackData,
    });

    // Verify callback using SDK
    const verifiedResult = await sdk.verifyCallback(callbackData);

    // Update payment status in database
    await updatePaymentStatus(orderId, {
      status: verifiedResult.status.toLowerCase(),
      transactionId: verifiedResult.transactionId,
      verifiedAt: new Date(),
      paymentDetails: verifiedResult.paymentDetails,
    });

    if (verifiedResult.status === "Success") {
      console.log("✅ Payment successful:", {
        orderId,
        transactionId: verifiedResult.transactionId,
      });

      // Process successful payment (fulfill order, send emails, etc.)
      await processSuccessfulPayment(orderId, verifiedResult);

      // Redirect to success page
      res.redirect(
        `${process.env.FRONTEND_URL}/payment/success?order=${orderId}`
      );
    } else {
      console.log("❌ Payment failed:", {
        orderId,
        transactionId: verifiedResult.transactionId,
        status: verifiedResult.status,
      });

      // Process failed payment
      await processFailedPayment(orderId, verifiedResult);

      // Redirect to failure page
      res.redirect(
        `${process.env.FRONTEND_URL}/payment/failed?order=${orderId}`
      );
    }
  } catch (error) {
    console.error("💥 Callback verification failed:", error.message);

    // Log error details for debugging
    console.error("Callback error details:", {
      orderId: req.query.orderId,
      error: error.message,
      stack: error.stack,
      callbackData: req.query,
    });

    // Redirect to error page
    res.redirect(`${process.env.FRONTEND_URL}/payment/error`);
  }
});

// Payment status check endpoint
app.get("/api/payment/status/:transactionId", ensureSDK, async (req, res) => {
  try {
    const { transactionId } = req.params;

    if (!transactionId) {
      return res.status(400).json({
        error: "Transaction ID is required",
      });
    }

    // Get payment status from SDK
    const status = await sdk.getPaymentStatus(transactionId);

    res.status(200).json({
      success: true,
      transactionId,
      status: status.status,
      details: status,
    });
  } catch (error) {
    console.error("Status check failed:", error.message);

    if (error.message.includes("Transaction not found")) {
      return res.status(404).json({
        error: "Transaction not found",
        transactionId: req.params.transactionId,
      });
    }

    res.status(500).json({
      error: "Failed to retrieve payment status",
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    sdk: sdk ? "initialized" : "not initialized",
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Unhandled error:", error.message);
  res.status(500).json({
    error: "Internal server error",
    requestId: generateRequestId(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    path: req.path,
  });
});

// Helper functions (implement based on your database and business logic)

async function storePaymentRecord(paymentData) {
  // Example implementation - replace with your database logic
  console.log("💾 Storing payment record:", paymentData);

  // Example with MongoDB/Mongoose
  // const payment = new Payment(paymentData);
  // await payment.save();

  // Example with SQL/Prisma
  // await prisma.payment.create({ data: paymentData });
}

async function updatePaymentStatus(orderId, statusData) {
  console.log("🔄 Updating payment status:", { orderId, statusData });

  // Example implementation
  // await Payment.findOneAndUpdate(
  //   { orderId },
  //   { $set: statusData },
  //   { new: true }
  // );
}

async function processSuccessfulPayment(orderId, verifiedResult) {
  console.log("🎉 Processing successful payment:", orderId);

  // Example business logic:
  // - Mark order as paid
  // - Send confirmation email
  // - Update inventory
  // - Trigger fulfillment process
  // - Send webhook notifications

  try {
    // Update order status
    // await updateOrderStatus(orderId, 'paid');
    // Send confirmation email
    // await sendPaymentConfirmationEmail(orderId, verifiedResult);
    // Trigger fulfillment
    // await triggerOrderFulfillment(orderId);
  } catch (error) {
    console.error("Error processing successful payment:", error.message);
    // Don't throw - payment was successful, log and handle separately
  }
}

async function processFailedPayment(orderId, verifiedResult) {
  console.log("😞 Processing failed payment:", orderId);

  // Example business logic:
  // - Mark order as failed
  // - Send failure notification
  // - Log failure reason
  // - Schedule retry if appropriate

  try {
    // Update order status
    // await updateOrderStatus(orderId, 'payment_failed');
    // Send failure notification
    // await sendPaymentFailureEmail(orderId, verifiedResult);
  } catch (error) {
    console.error("Error processing failed payment:", error.message);
  }
}

function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Start server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`💳 TestLuy SDK: ${sdk ? "✅ Ready" : "❌ Not Ready"}`);
});

export default app;

/**
 * Environment Variables (.env)
 *
 * # TestLuy SDK Configuration
 * TESTLUY_CLIENT_ID=your_client_id_here
 * TESTLUY_SECRET_KEY=your_secret_key_here
 * TESTLUY_BASE_URL=https://api-testluy.paragoniu.app
 *
 * # Application Configuration
 * APP_BASE_URL=http://localhost:8000
 * FRONTEND_URL=http://localhost:3000
 * NODE_ENV=development
 * PORT=8000
 *
 * # Database Configuration (example)
 * DATABASE_URL=mongodb://localhost:27017/myapp
 * # or
 * DATABASE_URL=postgresql://user:pass@localhost:5432/myapp
 */
