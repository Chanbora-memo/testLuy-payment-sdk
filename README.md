# Testluy Payment SDK

[![npm version](https://badge.fury.io/js/testluy-payment-sdk.svg)](https://badge.fury.io/js/testluy-payment-sdk)

## Overview

The Testluy Payment SDK provides a convenient JavaScript interface for developers to integrate their applications with the Testluy Payment **Simulator** backend. It simplifies the process of initiating simulated payments, checking transaction statuses, and handling callbacks within your application.

This SDK is designed primarily for server-side usage (e.g., within Node.js, Next.js API Routes, Express controllers) to protect your secret credentials.

## Key Features

* **Simplified API Calls:** Abstracts the complexities of direct HTTP requests to the Testluy backend.
* **HMAC Authentication:** Automatically handles the generation of secure HMAC-SHA256 signatures for authenticating requests.
* **Input Validation:** Includes basic validation for key parameters like amount and callback URL.
* **Promise-based:** Uses async/await for clean handling of asynchronous operations.

## How it Works

The SDK acts as a client library for the Testluy backend API. Here's the fundamental flow:

1. **Initialization:** You provide your `clientId`, `secretKey`, and the `baseUrl` of the Testluy backend API when creating an SDK instance.
2. **Request Signing:** When you call an SDK method (like `generatePaymentUrl`), the SDK constructs the necessary request data. Critically, it uses your `secretKey` to generate an HMAC-SHA256 signature based on the request method, path, timestamp, and request body.
3. **API Call:** The SDK sends an HTTP request (using `axios`) to the appropriate backend endpoint (e.g., `{baseUrl}/api/payment-simulator/generate-url`). This request includes your `clientId`, the current timestamp, and the generated HMAC signature in specific HTTP headers (`X-Client-ID`, `X-Timestamp`, `X-Signature`).
4. **Backend Verification:** The Testluy backend receives the request. It looks up the application associated with the `clientId`, retrieves the corresponding `secretKey` (stored securely on the server), and independently generates its own HMAC signature using the same method, path, timestamp, and body.
5. **Authentication & Authorization:** The backend compares its generated signature with the one received from the SDK. If they match *and* the timestamp is recent (preventing replay attacks) *and* the associated API application subscription is active, the request is authenticated and authorized.
6. **Response:** The backend processes the request (e.g., creates a transaction record, looks up status) and sends a JSON response back to the SDK.
7. **SDK Response:** The SDK parses the backend response and returns the relevant data (e.g., payment URL, status object) or throws an error if the request failed.

## Installation

```bash
npm install testluy-payment-sdk@latest axios
# or
yarn add testluy-payment-sdk@latest axios
```

**(Note: `axios` is a peer dependency used internally by the SDK for making HTTP requests.)**

## Configuration

Instantiate the SDK with your credentials.

```javascript
import TestluyPaymentSDK from 'testluy-payment-sdk';

const options = {
  clientId: process.env.TESTLUY_CLIENT_ID,   // Recommended: Use environment variables
  secretKey: process.env.TESTLUY_SECRET_KEY, // **NEVER EXPOSE THIS IN CLIENT-SIDE CODE**
  baseUrl: process.env.TESTLUY_BASE_URL      // e.g., 'http://localhost:8000' (NO /api suffix)
};

const sdk = new TestluyPaymentSDK(options);
```

## **🚨 SECURITY WARNING 🚨**

Your `secretKey` is highly sensitive. **Never embed it directly in your frontend JavaScript code.** Anyone could view your page source and steal the key, allowing them to make API calls impersonating you.

**Recommended Usage:** Instantiate and use the SDK **only on your server-side** (e.g., in a Node.js backend, Next.js API Route, Express route handler). Your frontend should make requests to *your own* backend endpoint, which then securely uses the SDK to communicate with the Testluy API.

**Configuration Options:**

* `clientId` (String, Required): Your unique Client ID obtained from the Testluy developer portal.
* `secretKey` (String, Required): Your secret key obtained from the Testluy developer portal. **Keep this confidential.**
* `baseUrl` (String, Required): The base URL of the Testluy backend API. **Important:** Do *not* include the `/api` path segment here (e.g., use `https://api.testluy.com` or `http://localhost:8000`, **not** `https://api.testluy.com/api`).

## Usage / API Reference

All methods return Promises. Use `async/await` or `.then()/.catch()`.

### `new TestluyPaymentSDK(options)`

Creates a new instance of the SDK.

* `@param {object} options` - Configuration object (see Configuration section).
* Throws `Error` if `clientId` or `secretKey` are missing.

### `async generatePaymentUrl(amount, callbackUrl)`

Generates a unique payment URL from the Testluy simulator backend.

* `@param {number} amount` - The payment amount (must be a positive number).
* `@param {string} callbackUrl` - The URL on your site where the user might be redirected *after* the simulation attempts payment (via Testluy's mechanisms, configuration dependent). Must be a valid URL.
* `@returns {Promise<string>}` - A promise that resolves with the payment URL string.
* Throws `Error` if input validation fails or the API call is unsuccessful.

**Example (Server-Side):**

```javascript
// Example within an Express route or Next.js API Route
// Assumes 'sdk' is already instantiated securely

try {
  const amount = 19.99; // From request body or calculation
  const merchantCallbackUrl = 'https://your-merchant-site.com/payment/complete';
  const paymentUrl = await sdk.generatePaymentUrl(amount, merchantCallbackUrl);
  console.log('Payment URL:', paymentUrl);
  // Send paymentUrl back to the frontend to initiate redirect
  // res.json({ paymentUrl });
} catch (error) {
  console.error('Failed to generate payment URL:', error.message);
  // Handle error, send appropriate response to frontend
  // res.status(500).json({ error: error.message });
}
```

### `async getPaymentStatus(transactionId)`

Retrieves the status and details of a specific transaction from the backend.

* `@param {string} transactionId` - The unique ID of the transaction (obtained from `generatePaymentUrl` or `initiatePaymentFlow`).
* `@returns {Promise<object>}` - A promise that resolves with the transaction details object (structure defined by the backend, likely includes `id`, `transaction_id`, `amount`, `status` \['Initiated', 'Success', 'Failed'], timestamps, etc.).
* Throws `Error` if `transactionId` is invalid or the API call fails (e.g., transaction not found, auth error).

**Example (Server-Side):**

```javascript
try {
  const txId = 'TRX_someuniqueid123'; // From request parameter or database
  const statusDetails = await sdk.getPaymentStatus(txId);
  console.log('Transaction Status:', statusDetails.status);
  console.log('Full Details:', statusDetails);
  // Use the status to update your order, etc.
  // res.json(statusDetails);
} catch (error) {
  console.error(`Failed to get status for ${txId}:`, error.message);
  // Handle error (e.g., transaction not found)
  // res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message });
}
```

### `async initiatePaymentFlow(amount, callbackUrl, backUrl)`

Similar to `generatePaymentUrl`, potentially used for flows requiring an explicit `backUrl`.

* `@param {number} amount` - The payment amount.
* `@param {string} callbackUrl` - The primary callback URL.
* `@param {string} [backUrl]` - An optional secondary URL, possibly for cancellation or returning without payment completion.
* `@returns {Promise<object>}` - A promise resolving to an object like `{ paymentUrl: string, transactionId: string, handleCallback: function }`.
* Throws `Error` on failure.

**Example (Server-Side):**

```javascript
try {
  const amount = 50.00;
  const callbackUrl = 'https://your-site.com/payment/callback';
  const backUrl = 'https://your-site.com/cart'; // Optional return URL
  const flowData = await sdk.initiatePaymentFlow(amount, callbackUrl, backUrl);
  console.log('Payment URL:', flowData.paymentUrl);
  console.log('Transaction ID:', flowData.transactionId);
  // Send flowData.paymentUrl to frontend
} catch (error) {
  console.error('Failed to initiate payment flow:', error.message);
}
```

### `async handlePaymentCallback(callbackData)`

Processes data potentially received at your `callbackUrl`. **Important:** This method primarily acts as a wrapper to securely fetch the *verified* status from the backend using the `transaction_id` found in the `callbackData`. It does **not** trust the `status` field directly from the `callbackData`.

* `@param {object} callbackData` - An object containing data received at your callback endpoint, expected to have at least a `transaction_id` property.
* `@returns {Promise<object>}` - A promise resolving to an object containing the verified details fetched from the backend: `{ transactionId: string, status: string, paymentDetails: object, /* other fields */ }`.
* Throws `Error` if `callbackData` is invalid or if the internal call to `getPaymentStatus` fails.

**Example (Server-Side - In your callback handler):**

```javascript
// Example within the route handler for 'https://your-site.com/payment/callback'

// Assume 'req.body' contains the data POSTed by Testluy Simulator
// e.g., { transaction_id: 'TRX_abc', status: 'success' }

try {
  // Pass the received data (ensure it has transaction_id)
  const verifiedResult = await sdk.handlePaymentCallback(req.body);

  console.log(`Verified status for ${verifiedResult.transactionId}: ${verifiedResult.status}`);
  console.log('Full verified details:', verifiedResult.paymentDetails);

  // Now update your order/database based on verifiedResult.status ('Success', 'Failed')
  if (verifiedResult.status === 'Success') {
    // Mark order as paid
  } else {
    // Mark order as failed
  }
  // Respond to the callback request (e.g., with a 200 OK)
  // res.status(200).send('Callback received');

} catch (error) {
  console.error('Failed to handle payment callback:', error.message);
  // Respond with an error status to the callback request
  // res.status(500).send('Error handling callback');
}
```

### `async validateCredentials()`

Manually checks if the provided `clientId` and `secretKey` are valid and associated with an active, available subscription on the backend. Often used internally by `init()`.

* `@returns {Promise<boolean>}` - A promise resolving to `true` if credentials and subscription are valid, `false` otherwise.
* Throws `Error` if the API call itself fails (network error, etc.).

**Note:** Direct use might be less common as authentication happens per-request via HMAC. It can be useful for an initial check on server startup.

## Example: Secure Usage in Next.js API Route

This demonstrates the recommended server-side pattern.

```javascript
// pages/api/initiate-payment.js (or app/api/initiate-payment/route.js)
import TestluyPaymentSDK from 'testluy-payment-sdk';
import { NextResponse } from 'next/server'; // Use if in App Router

// Instantiate SDK securely (outside handler if possible, or memoized)
// Ensure Env vars are loaded correctly
let sdkInstance;
try {
     sdkInstance = new TestluyPaymentSDK({
        clientId: process.env.TESTLUY_CLIENT_ID,
        secretKey: process.env.TESTLUY_SECRET_KEY,
        baseUrl: process.env.TESTLUY_BASE_URL
    });
} catch (e) {
    console.error("Failed to initialize SDK:", e.message);
    // Handle initialization error appropriately
}


// --- For Pages Router ---
// export default async function handler(req, res) {
// --- For App Router ---
export async function POST(req) { // Changed for App Router
    // Ensure SDK initialized
     if (!sdkInstance) {
         const errorResponse = { error: 'Payment service temporarily unavailable.' };
         // Pages Router: return res.status(503).json(errorResponse);
         return NextResponse.json(errorResponse, { status: 503 }); // App Router
     }

    // Basic method check (less critical in App Router POST function)
    // if (req.method !== 'POST') { ... }

    try {
        // Get amount from request body
        // Pages Router: const { amount } = req.body;
        const body = await req.json(); // App Router
        const { amount } = body;

        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
             const errorResponse = { error: 'Invalid amount provided.' };
             // Pages Router: return res.status(400).json(errorResponse);
             return NextResponse.json(errorResponse, { status: 400 }); // App Router
        }

        const callbackUrl = process.env.NEXT_PUBLIC_CALLBACK_URL; // Your site's callback
        if (!callbackUrl) {
            console.error("Missing NEXT_PUBLIC_CALLBACK_URL env variable");
             const errorResponse = { error: 'Server configuration error (callback).' };
             // Pages Router: return res.status(500).json(errorResponse);
             return NextResponse.json(errorResponse, { status: 500 }); // App Router
        }

        // Use the SDK
        const paymentUrl = await sdkInstance.generatePaymentUrl(numericAmount, callbackUrl);

        // Send response to frontend
        // Pages Router: res.status(200).json({ paymentUrl });
        return NextResponse.json({ paymentUrl }); // App Router

    } catch (error) {
        console.error('[API Route] Error initiating payment:', error.message);
         const errorResponse = { error: 'Failed to initiate payment.', details: error.message };
         // Pages Router: res.status(500).json(errorResponse);
         return NextResponse.json(errorResponse, { status: 500 }); // App Router
    }
}

```

*(Your frontend component would then `fetch` from `/api/initiate-payment`)*

## Error Handling

SDK methods will throw JavaScript `Error` objects upon failure. These failures can originate from:

* Invalid input parameters passed to the SDK method.
* Network issues preventing communication with the backend.
* Authentication/Authorization errors from the backend (invalid signature, inactive key).
* Processing errors on the backend (invalid transaction ID, insufficient funds simulation).

The `error.message` property often contains specific details returned from the backend API. Always wrap your SDK calls in `try...catch` blocks to handle potential errors gracefully.

```javascript
try {
  const paymentUrl = await sdk.generatePaymentUrl(10, 'invalid-url'); // Example error
} catch (error) {
  console.error("Operation failed:", error.message);
  // Inform the user or retry if appropriate
}
```

## Changelog

Please see [CHANGELOG.md](CHANGELOG.md) for version history and notable changes.

## License

This SDK is released under the MIT License. See the [LICENSE](LICENSE) file for details.
