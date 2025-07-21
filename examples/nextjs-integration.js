/**
 * Next.js API Route Example for TestLuy Payment SDK
 *
 * This example demonstrates how to integrate the TestLuy Payment SDK
 * with Next.js API routes for secure server-side payment processing.
 *
 * File: pages/api/payment/initiate.js (Pages Router)
 * File: app/api/payment/initiate/route.js (App Router)
 */

import TestluyPaymentSDK from "testluy-payment-sdk";

// Initialize SDK instance (reuse across requests)
let sdkInstance = null;

async function initializeSDK() {
  if (!sdkInstance) {
    try {
      sdkInstance = new TestluyPaymentSDK({
        clientId: process.env.TESTLUY_CLIENT_ID,
        secretKey: process.env.TESTLUY_SECRET_KEY,
        baseUrl:
          process.env.TESTLUY_BASE_URL || "https://api-testluy.paragoniu.app",
        loggingConfig: {
          level: process.env.NODE_ENV === "production" ? "warn" : "debug",
        },
      });

      // Validate credentials on initialization
      await sdkInstance.init();
      console.log("TestLuy SDK initialized successfully");
    } catch (error) {
      console.error("Failed to initialize TestLuy SDK:", error.message);
      throw error;
    }
  }
  return sdkInstance;
}

// App Router (Next.js 13+)
export async function POST(request) {
  try {
    const sdk = await initializeSDK();
    const body = await request.json();

    const { amount, orderId, metadata = {} } = body;

    // Validate input
    if (!amount || amount <= 0) {
      return Response.json(
        { error: "Invalid amount provided" },
        { status: 400 }
      );
    }

    if (!orderId) {
      return Response.json({ error: "Order ID is required" }, { status: 400 });
    }

    // Construct callback URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const callbackUrl = `${baseUrl}/api/payment/callback?orderId=${orderId}`;
    const backUrl = `${baseUrl}/orders/${orderId}`;

    // Initiate payment
    const result = await sdk.initiatePayment(
      parseFloat(amount),
      callbackUrl,
      backUrl
    );

    // Log successful payment initiation
    console.log(`Payment initiated for order ${orderId}:`, {
      transactionId: result.transactionId,
      amount,
      metadata,
    });

    return Response.json({
      success: true,
      paymentUrl: result.paymentUrl,
      transactionId: result.transactionId,
      orderId,
      metadata,
    });
  } catch (error) {
    console.error("Payment initiation failed:", error.message);

    // Handle specific error types
    if (error.message.includes("Rate limit exceeded")) {
      return Response.json(
        {
          error: "Too many payment requests. Please try again later.",
          retryAfter: error.retryAfter || 60,
        },
        { status: 429 }
      );
    }

    return Response.json(
      { error: "Payment initiation failed. Please try again." },
      { status: 500 }
    );
  }
}

// Pages Router (Legacy)
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const sdk = await initializeSDK();
    const { amount, orderId, metadata = {} } = req.body;

    // Validate input
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount provided" });
    }

    if (!orderId) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    // Construct callback URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const callbackUrl = `${baseUrl}/api/payment/callback?orderId=${orderId}`;
    const backUrl = `${baseUrl}/orders/${orderId}`;

    // Initiate payment
    const result = await sdk.initiatePayment(
      parseFloat(amount),
      callbackUrl,
      backUrl
    );

    // Log successful payment initiation
    console.log(`Payment initiated for order ${orderId}:`, {
      transactionId: result.transactionId,
      amount,
      metadata,
    });

    res.status(200).json({
      success: true,
      paymentUrl: result.paymentUrl,
      transactionId: result.transactionId,
      orderId,
      metadata,
    });
  } catch (error) {
    console.error("Payment initiation failed:", error.message);

    // Handle specific error types
    if (error.message.includes("Rate limit exceeded")) {
      return res.status(429).json({
        error: "Too many payment requests. Please try again later.",
        retryAfter: error.retryAfter || 60,
      });
    }

    res.status(500).json({
      error: "Payment initiation failed. Please try again.",
    });
  }
}

/**
 * Callback Handler Example
 * File: pages/api/payment/callback.js or app/api/payment/callback/route.js
 */

// App Router callback handler
export async function GET(request) {
  try {
    const sdk = await initializeSDK();
    const { searchParams } = new URL(request.url);
    const callbackData = Object.fromEntries(searchParams);

    // Verify callback using SDK
    const verifiedResult = await sdk.verifyCallback(callbackData);

    const orderId = searchParams.get("orderId");

    if (verifiedResult.status === "Success") {
      // Update order status in your database
      await updateOrderStatus(orderId, "paid", verifiedResult.transactionId);

      // Redirect to success page
      return Response.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?order=${orderId}`
      );
    } else {
      // Handle failed payment
      await updateOrderStatus(orderId, "failed", verifiedResult.transactionId);

      // Redirect to failure page
      return Response.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/payment/failed?order=${orderId}`
      );
    }
  } catch (error) {
    console.error("Callback verification failed:", error.message);
    return Response.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/payment/error`
    );
  }
}

// Helper function to update order status (implement based on your database)
async function updateOrderStatus(orderId, status, transactionId) {
  // Example implementation - replace with your database logic
  console.log(
    `Updating order ${orderId} to status: ${status}, transaction: ${transactionId}`
  );

  // Example with Prisma
  // await prisma.order.update({
  //   where: { id: orderId },
  //   data: {
  //     status,
  //     transactionId,
  //     updatedAt: new Date()
  //   }
  // });
}

/**
 * Environment Variables (.env.local)
 *
 * TESTLUY_CLIENT_ID=your_client_id_here
 * TESTLUY_SECRET_KEY=your_secret_key_here
 * TESTLUY_BASE_URL=https://api-testluy.paragoniu.app
 * NEXT_PUBLIC_APP_URL=http://localhost:3000
 *
 * For production:
 * NEXT_PUBLIC_APP_URL=https://yourdomain.com
 */
