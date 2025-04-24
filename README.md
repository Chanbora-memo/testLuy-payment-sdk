# Testluy Payment SDK

[![npm version](https://badge.fury.io/js/testluy-payment-sdk.svg)](https://badge.fury.io/js/testluy-payment-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

The Testluy Payment SDK provides a convenient JavaScript interface for developers to integrate their applications with the Testluy Payment **Simulator** backend. It simplifies the process of initiating simulated payments, checking transaction statuses, validating credentials, and handling callbacks within your application.

This SDK is designed primarily for server-side usage (e.g., within Node.js, Next.js API Routes, Express controllers) to protect your secret credentials.

## Key Features

* **Simplified API Calls:** Abstracts the complexities of direct HTTP requests to the Testluy backend.
* **HMAC Authentication:** Automatically handles the generation of secure HMAC-SHA256 signatures for authenticating requests.
* **Input Validation:** Includes validation for key parameters like amount, callback URL, and transaction ID using Joi.
* **Promise-based:** Uses `async/await` for clean handling of asynchronous operations.
* **Credential Validation:** Provides a method to explicitly validate API keys and subscription status.
* **Secure Callback Handling:** Includes a method to securely verify payment status upon callback, preventing tampering.

## How it Works

The SDK acts as a client library for the Testluy backend API. Here's the fundamental flow:

1. **Initialization:** You provide your `clientId`, `secretKey`, and the `baseUrl` of the Testluy backend API when creating an SDK instance.
2. **(Optional but Recommended) Initial Validation:** You can call `sdk.init()` to perform an upfront check that your credentials are valid and your subscription is active before making other calls.
3. **Request Signing:** When you call an SDK method (like `initiatePayment`), the SDK constructs the necessary request data. Critically, it uses your `secretKey` to generate an HMAC-SHA256 signature based on the request method, path, timestamp, and request body.
4. **API Call:** The SDK sends an HTTP request (using `axios`) to the appropriate backend endpoint (e.g., `{baseUrl}/api/payment-simulator/generate-url`). This request includes your `clientId`, the current timestamp, and the generated HMAC signature in specific HTTP headers (`X-Client-ID`, `X-Timestamp`, `X-Signature`).
5. **Backend Verification:** The Testluy backend receives the request. It looks up the application associated with the `clientId`, retrieves the corresponding `secretKey` (stored securely on the server), and independently generates its own HMAC signature using the same method, path, timestamp, and body.
6. **Authentication & Authorization:** The backend compares its generated signature with the one received from the SDK. If they match *and* the timestamp is recent (preventing replay attacks) *and* the associated API application subscription is active, the request is authenticated and authorized.
7. **Response:** The backend processes the request (e.g., creates a transaction record, looks up status) and sends a JSON response back to the SDK.
8. **SDK Response:** The SDK parses the backend response and returns the relevant data (e.g., payment URL and transaction ID from `initiatePayment`, status object from `getPaymentStatus`) or throws an error if the request failed.

## Installation

```bash
npm install testluy-payment-sdk@latest axios joi
# or
yarn add testluy-payment-sdk@latest axios joi
```

**(Note: `axios` and `joi` are peer dependencies used internally by the SDK for making HTTP requests and validation, respectively.)**

## Configuration

Instantiate the SDK with your credentials. It's highly recommended to use environment variables for sensitive keys.

```javascript
import TestluyPaymentSDK from 'testluy-payment-sdk';

const options = {
  clientId: process.env.TESTLUY_CLIENT_ID,   // Required: Your application Client ID
  secretKey: process.env.TESTLUY_SECRET_KEY, // Required: **NEVER EXPOSE THIS IN CLIENT-SIDE CODE**
  baseUrl: process.env.TESTLUY_BASE_URL      // Required: e.g., 'http://localhost:8000' or 'https://api.testluy.com' (NO /api suffix)
};

let sdk;
try {
  sdk = new TestluyPaymentSDK(options);
  console.log("TestluyPaymentSDK initialized.");
  // Optional: Perform initial validation on startup
  // await sdk.init();
} catch (error) {
  console.error("Failed to initialize TestluyPaymentSDK:", error.message);
  // Handle initialization error (e.g., missing keys)
}
```

## **🚨 SECURITY WARNING 🚨**

Your `secretKey` is highly sensitive. **Never embed it directly in your frontend JavaScript code.** Anyone could view your page source and steal the key, allowing them to make API calls impersonating your application.

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
* Throws `Error` if `clientId` or `secretKey` are missing or if `baseUrl` is invalid.

### `async init()`

Performs an initial validation check with the API using the provided credentials. Sets an internal flag `isValidated` upon success. Recommended to call before other methods, perhaps during server startup, to ensure keys are active.

* `@returns {Promise<boolean>}` - Resolves to `true` if credentials are valid and the subscription is active.
* Throws `Error` If validation fails due to network issues, invalid credentials, or inactive subscription. The error message will contain details from the API.

**Example (Server Startup):**

```javascript
// Assuming 'sdk' is initialized as shown in Configuration

async function checkCredentials() {
  if (!sdk) return; // SDK failed to initialize
  try {
    await sdk.init();
    console.log('Testluy SDK credentials validated successfully.');
    // Proceed with application logic that depends on the SDK
  } catch (error) {
    console.error('FATAL: Testluy SDK credential validation failed:', error.message);
    // Handle critical error (e.g., stop server, notify admin)
    process.exit(1);
  }
}

checkCredentials();
```

### `async initiatePayment(amount, callbackUrl, backUrl)`

Initiates a payment process by generating a payment URL and associated transaction ID from the Testluy simulator backend. This is the primary method to start a payment simulation.

* `@param {number} amount` - The payment amount (must be a positive number).
* `@param {string} callbackUrl` - The URL on your site where the user should be redirected after completing the payment simulation on the sandbox. Must be a valid URI.
* `@param {string} [backUrl]` - Optional URL the user should be redirected to if they click 'Back' or 'Cancel' on the sandbox payment page before completion. Must be a valid URI if provided.
* `@returns {Promise<object>}` - A promise that resolves with an object containing `{ paymentUrl: string, transactionId: string }`.
* Throws `Error` if input validation fails or the API call is unsuccessful.

**Example (Server-Side - e.g., Express Route):**

```javascript
// Assuming 'sdk' is instantiated securely and validated (e.g., via init())

app.post('/api/start-payment', async (req, res) => {
  try {
    const { amount, returnPath = '/cart' } = req.body; // Get amount from request

    // Construct full URLs based on your application's structure
    const siteBaseUrl = process.env.YOUR_APP_BASE_URL || 'http://localhost:3000';
    const merchantCallbackUrl = `${siteBaseUrl}/payment/callback`; // Your callback handler URL
    const merchantBackUrl = `${siteBaseUrl}${returnPath}`; // Where to go if user cancels

    // Use the SDK to initiate payment
    const { paymentUrl, transactionId } = await sdk.initiatePayment(
      Number(amount),
      merchantCallbackUrl,
      merchantBackUrl
    );

    console.log(`Initiated payment: ${transactionId}`);

    // Send the payment URL back to the frontend to redirect the user
    res.json({ paymentUrl }); // Frontend will use this URL

  } catch (error) {
    console.error('Failed to initiate payment:', error.message);
    // Handle error (validation, API error, etc.)
    res.status(500).json({ error: `Failed to initiate payment: ${error.message}` });
  }
});
```

### `async getPaymentStatus(transactionId)`

Retrieves the current status and details of a specific transaction from the backend. This is the authoritative source for transaction status.

* `@param {string} transactionId` - The unique ID of the transaction (obtained from `initiatePayment`).
* `@returns {Promise<object>}` - A promise that resolves with the transaction details object (structure defined by the backend, likely includes `id`, `transaction_id`, `amount`, `status` \['Initiated', 'Success', 'Failed'], `callback_url`, timestamps, etc.).
* Throws `Error` if `transactionId` is invalid or the API call fails (e.g., transaction not found, auth error).

**Example (Server-Side - Checking status independently):**

```javascript
// Example: Check status perhaps triggered by a webhook or background job
async function checkTransaction(txId) {
  try {
    console.log(`Checking status for transaction: ${txId}`);
    const statusDetails = await sdk.getPaymentStatus(txId);
    console.log('Transaction Status:', statusDetails.status);
    console.log('Full Details:', statusDetails);

    // Update your system based on statusDetails.status
    if (statusDetails.status === 'Success') {
      // Fulfill order, grant access, etc.
    } else if (statusDetails.status === 'Failed') {
      // Notify user, log failure, etc.
    }
    return statusDetails;
  } catch (error) {
    console.error(`Failed to get status for ${txId}:`, error.message);
    // Handle error (e.g., transaction not found, API down)
    throw error; // Re-throw or handle as needed
  }
}

// Example usage:
// checkTransaction('TRX_someuniqueid123').catch(err => console.error(err));
```

### `async handlePaymentCallback(callbackData)`

Processes data received at your `callbackUrl` after a user interacts with the Testluy payment simulation page. **Crucially, this method verifies the transaction's status by making a secure backend call to `getPaymentStatus` using the `transaction_id` from the `callbackData`.** It does **not** trust any status field directly present in the `callbackData`.

* `@param {object} callbackData` - An object containing data received at your callback endpoint (usually from query parameters or request body). Expected to have at least a `transaction_id` (or `transactionId`) property.
* `@returns {Promise<object>}` - A promise resolving to an object containing the verified details fetched from the backend: `{ transactionId: string, status: string, paymentDetails: object }`. `paymentDetails` is the full object returned by `getPaymentStatus`.
* Throws `Error` if `callbackData` is invalid (e.g., missing `transaction_id`) or if the internal call to `getPaymentStatus` fails.

**Example (Server-Side - In your callback handler):**

```javascript
// Example within the route handler for '/payment/callback' (matching callbackUrl)

app.get('/payment/callback', async (req, res) => { // Or app.post depending on Testluy config
  try {
    // Extract data from query parameters (GET) or body (POST)
    // Example assumes data is in query params like ?transaction_id=TRX_123&status=Success
    const callbackData = req.query; // Adjust if POST: req.body

    console.log('Received callback data:', callbackData);

    // Pass the received data to the SDK handler for verification
    const verifiedResult = await sdk.handlePaymentCallback(callbackData);

    console.log(`Verified status for ${verifiedResult.transactionId}: ${verifiedResult.status}`);
    console.log('Full verified details:', verifiedResult.paymentDetails);

    // --- IMPORTANT: Update your application state based on the *verified* status ---
    if (verifiedResult.status === 'Success') {
      // Mark order as paid in your database using verifiedResult.transactionId
      console.log(`Payment successful for ${verifiedResult.transactionId}. Fulfilling order.`);
      // Redirect user to a success page
      res.redirect('/payment/success?tx=' + verifiedResult.transactionId);
    } else { // Could be 'Failed' or potentially other statuses
      // Mark order as failed or requires investigation
      console.warn(`Payment status for ${verifiedResult.transactionId} is ${verifiedResult.status}.`);
      // Redirect user to a failure/retry page
      res.redirect('/payment/failed?tx=' + verifiedResult.transactionId);
    }
    // ----------------------------------------------------------------------------

  } catch (error) {
    console.error('Failed to handle payment callback:', error.message);
    // Respond with an error status or redirect to a generic error page
    // Avoid exposing raw error messages to the user in production
    res.status(500).send('Error processing payment callback. Please contact support.');
  }
});
```

### `async validateCredentials()`

Manually checks if the provided `clientId` and `secretKey` are valid and associated with an active, available subscription on the backend. This is the same check performed by `init()`.

* `@returns {Promise<boolean>}` - A promise resolving to `true` if credentials and subscription are valid.
* Throws `Error` if validation fails (network error, invalid keys, inactive subscription), containing details from the API.

**Note:** Direct use might be less common than `init()` as authentication happens per-request via HMAC. It can be useful for specific checks or diagnostics.

## Example: Secure Usage in Next.js API Route

This demonstrates the recommended server-side pattern using Next.js App Router. Adaptations for Pages Router are noted in comments.

```javascript
// app/api/initiate-payment/route.js (App Router)
// For Pages Router: pages/api/initiate-payment.js

import { NextResponse } from 'next/server'; // App Router
// import type { NextApiRequest, NextApiResponse } from 'next'; // Pages Router
import TestluyPaymentSDK from 'testluy-payment-sdk';

// --- SDK Initialization (Ideally done once and reused) ---
let sdkInstance = null;
try {
  // Ensure environment variables are loaded correctly (e.g., using .env.local)
  if (!process.env.TESTLUY_CLIENT_ID || !process.env.TESTLUY_SECRET_KEY || !process.env.TESTLUY_BASE_URL) {
      throw new Error("Missing required Testluy environment variables.");
  }
  sdkInstance = new TestluyPaymentSDK({
    clientId: process.env.TESTLUY_CLIENT_ID,
    secretKey: process.env.TESTLUY_SECRET_KEY,
    baseUrl: process.env.TESTLUY_BASE_URL
  });
  console.log("Testluy SDK Initialized for API Route.");
  // Optional: Validate credentials on startup (might delay first request)
  // await sdkInstance.init();
} catch (e) {
  console.error("FATAL: Failed to initialize Testluy SDK:", e.message);
  // sdkInstance remains null
}
// --------------------------------------------------------

// --- API Route Handler (App Router POST) ---
export async function POST(req) {
  if (!sdkInstance) {
    console.error("Initiate Payment Error: SDK not initialized.");
    return NextResponse.json({ error: 'Payment service temporarily unavailable.' }, { status: 503 });
  }

  try {
    // Get amount and optional back path from request body
    const body = await req.json();
    const { amount, backPath = '/cart' } = body; // Example: frontend sends { "amount": 25.50 }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: 'Invalid amount provided.' }, { status: 400 });
    }

    // Construct callback and back URLs
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'; // Use NEXT_PUBLIC_ for client-side accessible base URL if needed elsewhere
    const callbackUrl = `${appBaseUrl}/api/payment/callback`; // Your backend callback handler route
    const backUrl = `${appBaseUrl}${backPath}`; // e.g., http://localhost:3000/cart

    if (!callbackUrl.startsWith('http')) {
         console.error("Server configuration error: Invalid NEXT_PUBLIC_APP_URL or callback path.");
         return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    // Use the SDK to initiate payment
    const { paymentUrl, transactionId } = await sdkInstance.initiatePayment(
        numericAmount,
        callbackUrl,
        backUrl
    );

    console.log(`[API Route] Initiated payment ${transactionId} for amount ${numericAmount}. Redirect URL generated.`);

    // Send response containing the URL to redirect the user to
    return NextResponse.json({ paymentUrl }); // Frontend uses this URL

  } catch (error) {
    console.error('[API Route] Error initiating payment:', error.message);
    // Avoid exposing raw error details in production
    const userErrorMessage = error.message.includes('validation failed') || error.message.includes('Invalid')
        ? 'Invalid input provided.' // More specific for validation errors
        : 'Failed to initiate payment. Please try again later.';
    return NextResponse.json({ error: userErrorMessage /* , details: error.message */ }, { status: 500 }); // Log full error server-side
  }
}

/*
// --- Equivalent Handler for Pages Router ---
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    if (!sdkInstance) {
       console.error("Initiate Payment Error: SDK not initialized.");
       return res.status(503).json({ error: 'Payment service temporarily unavailable.' });
    }

    try {
        const { amount, backPath = '/cart' } = req.body;
        // ... (rest of the validation and URL construction logic is the same) ...

        const numericAmount = parseFloat(amount);
         if (isNaN(numericAmount) || numericAmount <= 0) {
           return res.status(400).json({ error: 'Invalid amount provided.' });
         }

        const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const callbackUrl = `${appBaseUrl}/api/payment/callback`;
        const backUrl = `${appBaseUrl}${backPath}`;

         if (!callbackUrl.startsWith('http')) {
              console.error("Server configuration error: Invalid NEXT_PUBLIC_APP_URL or callback path.");
              return res.status(500).json({ error: 'Server configuration error.' });
         }

        const { paymentUrl, transactionId } = await sdkInstance.initiatePayment(
            numericAmount,
            callbackUrl,
            backUrl
        );

        console.log(`[API Route] Initiated payment ${transactionId} for amount ${numericAmount}.`);
        return res.status(200).json({ paymentUrl });

    } catch (error) {
        console.error('[API Route] Error initiating payment:', error.message);
        const userErrorMessage = error.message.includes('validation failed') || error.message.includes('Invalid')
            ? 'Invalid input provided.'
            : 'Failed to initiate payment. Please try again later.';
        return res.status(500).json({ error: userErrorMessage });
    }
}
*/

```

*(Your frontend component would then `fetch` from `/api/initiate-payment`, get the `paymentUrl`, and redirect the user: `window.location.href = data.paymentUrl;`)*

## Error Handling

SDK methods will throw JavaScript `Error` objects upon failure. These failures can originate from:

* Invalid input parameters passed to the SDK method (caught by Joi validation).
* Network issues preventing communication with the backend (`axios` errors).
* Authentication/Authorization errors from the backend (invalid signature, inactive key, incorrect `clientId`).
* Processing errors on the backend (invalid transaction ID, simulation errors).
* Configuration errors (missing keys during SDK initialization).

The `error.message` property often contains specific details returned from the backend API or from the validation library. Always wrap your SDK calls in `try...catch` blocks to handle potential errors gracefully. Log detailed errors on the server-side for debugging but provide user-friendly messages to the frontend.

```javascript
try {
  // Example: Using an invalid amount
  const { paymentUrl } = await sdk.initiatePayment(-10, 'https://valid.com/callback');
} catch (error) {
  // error.message might be '"amount" must be a positive number'
  console.error("Operation failed:", error.message);
  // Inform the user or take corrective action
  // respondWithErrorToUser("Invalid amount entered. Please provide a positive value.");
}

try {
    // Example: Transaction ID not found
    const status = await sdk.getPaymentStatus('TRX_DOES_NOT_EXIST');
} catch (error) {
    // error.message might include "Transaction not found" or similar from API
    console.error("Status check failed:", error.message);
    // Handle appropriately (e.g., show 'status unknown' or 'not found')
}
```

## Changelog

Please see the project's commit history or release notes for version history and notable changes.