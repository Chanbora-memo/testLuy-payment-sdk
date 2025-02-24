# Testluy Payment Simulator SDK

This SDK provides easy integration with the Testluy Payment Simulator.

## Installation

```bash
npm install testluy-payment-sdk
```

## Usage
```javascript
const TestluyPaymentSDK = require('testluy-payment-sdk');
const sdk = new TestluyPaymentSDK('your-client-id', 'your-secret-key', 'http://your-api-base-url');
// Generate a payment URL
sdk.generatePaymentUrl(20.00, 'your-application-id', 'https://your-callback-url.com')
.then(paymentUrl => {
console.log('Payment URL:', paymentUrl);
})
.catch(error => {
console.error('Error:', error.message);
});
// Get payment status
sdk.getPaymentStatus('transaction-id')
.then(status => {
console.log('Payment Status:', status);
})
.catch(error => {
console.error('Error:', error.message);
});
```

## API Reference

### generatePaymentUrl(amount, applicationId, callbackUrl)

Generates a payment URL for the given amount and application.

### getPaymentStatus(transactionId)

Retrieves the status of a payment for the given transaction ID.