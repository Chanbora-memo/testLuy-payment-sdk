/**
 * @fileoverview
 * Test file for debugging and monitoring features in the enhanced TestluyPaymentSDK
 */

import TestluyPaymentSDK from './index-enhanced.js';

// Test configuration
const testConfig = {
  clientId: 'test-client-id',
  secretKey: 'test-secret-key',
  baseUrl: 'https://api-testluy.paragoniu.app',
  loggingConfig: {
    level: 'debug', // Enable debug logging to activate metrics
    includeHeaders: true,
    includeBody: true,
    maskSensitive: true,
    enableMetrics: true // Explicitly enable metrics
  }
};

/**
 * Test the debugging and monitoring features
 */
async function testDebuggingAndMonitoring() {
  console.log('=== Testing Debugging and Monitoring Features ===\n');

  try {
    // Initialize SDK with debug configuration
    console.log('1. Initializing SDK with debug configuration...');
    const sdk = new TestluyPaymentSDK(testConfig);

    // Test metrics tracking is enabled
    console.log('\n2. Testing metrics tracking...');
    const initialMetrics = sdk.getPerformanceMetrics();
    console.log('Initial metrics:', JSON.stringify(initialMetrics, null, 2));

    // Test updating logging configuration
    console.log('\n3. Testing logging configuration updates...');
    sdk.updateLoggingConfig({
      level: 'info',
      includeHeaders: false,
      enableMetrics: true
    });

    // Test enabling/disabling metrics
    console.log('\n4. Testing metrics enable/disable...');
    sdk.setMetricsEnabled(true);
    console.log('Metrics enabled');

    // Simulate some API calls to generate metrics data
    console.log('\n5. Simulating API calls to generate metrics...');

    try {
      // This will likely fail but will generate metrics
      await sdk.validateCredentials();
    } catch (error) {
      console.log('Expected error for invalid credentials:', error.message);
    }

    try {
      // This will also likely fail but will generate more metrics
      await sdk.initiatePayment(10.50, 'https://example.com/callback');
    } catch (error) {
      console.log('Expected error for payment initiation:', error.message);
    }

    try {
      // This will also likely fail but will generate more metrics
      await sdk.getPaymentStatus('test-transaction-id');
    } catch (error) {
      console.log('Expected error for payment status:', error.message);
    }

    // Test getting updated metrics
    console.log('\n6. Testing updated metrics after API calls...');
    const updatedMetrics = sdk.getPerformanceMetrics();
    console.log('Updated metrics:', JSON.stringify(updatedMetrics, null, 2));

    // Test troubleshooting suggestions
    console.log('\n7. Testing troubleshooting suggestions...');
    const suggestions = sdk.getTroubleshootingSuggestions();
    console.log('Troubleshooting suggestions:', JSON.stringify(suggestions, null, 2));

    // Test diagnostic report
    console.log('\n8. Testing diagnostic report generation...');
    const diagnosticReport = sdk.generateDiagnosticReport();
    console.log('Diagnostic report:', JSON.stringify(diagnosticReport, null, 2));

    // Test logging methods
    console.log('\n9. Testing logging methods...');
    console.log('\n--- Metrics Summary ---');
    sdk.logMetricsSummary();

    console.log('\n--- Troubleshooting Suggestions ---');
    sdk.logTroubleshootingSuggestions();

    console.log('\n--- Full Diagnostic Report ---');
    sdk.logDiagnosticReport();

    // Test metrics reset
    console.log('\n10. Testing metrics reset...');
    sdk.resetMetrics();
    const resetMetrics = sdk.getPerformanceMetrics();
    console.log('Metrics after reset:', JSON.stringify(resetMetrics, null, 2));

    console.log('\n=== All debugging and monitoring tests completed successfully! ===');

  } catch (error) {
    console.error('Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

/**
 * Test performance metrics tracking with simulated scenarios
 */
async function testPerformanceMetricsScenarios() {
  console.log('\n=== Testing Performance Metrics Scenarios ===\n');

  const sdk = new TestluyPaymentSDK({
    ...testConfig,
    loggingConfig: {
      ...testConfig.loggingConfig,
      level: 'debug'
    }
  });

  // Test multiple failed requests to generate various error types
  const testScenarios = [
    {
      name: 'Authentication Error',
      action: () => sdk.validateCredentials()
    },
    {
      name: 'Rate Limit Simulation',
      action: () => sdk.initiatePayment(100, 'https://example.com/callback')
    },
    {
      name: 'Invalid Transaction ID',
      action: () => sdk.getPaymentStatus('invalid-id')
    }
  ];

  for (const scenario of testScenarios) {
    console.log(`Testing scenario: ${scenario.name}`);
    try {
      await scenario.action();
    } catch (error) {
      console.log(`Expected error: ${error.message}`);
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Show final metrics
  console.log('\n--- Final Performance Metrics ---');
  sdk.logMetricsSummary();

  console.log('\n--- Generated Troubleshooting Suggestions ---');
  sdk.logTroubleshootingSuggestions();
}

/**
 * Test logger functionality directly
 */
async function testLoggerFeatures() {
  console.log('\n=== Testing Logger Features Directly ===\n');

  // Import logger directly
  const { default: logger } = await import('./http/Logger.js');

  // Test logger with metrics enabled
  logger.updateConfig({
    level: 'debug',
    enableMetrics: true,
    format: 'json'
  });

  // Test request tracking
  console.log('1. Testing request tracking...');
  const trackingInfo = logger.startRequestTracking('test-req-1', {
    method: 'POST',
    url: '/api/test',
    hasBody: true
  });

  // Simulate some processing time
  await new Promise(resolve => setTimeout(resolve, 50));

  logger.endRequestTracking(trackingInfo, {
    success: false,
    statusCode: 429,
    errorType: 'rate_limit',
    wasRetried: true,
    wasRateLimited: true
  });

  // Test issue recording
  console.log('\n2. Testing issue recording...');
  logger.recordIssue('cloudflare_block', {
    statusCode: 403,
    message: 'Cloudflare challenge detected',
    url: '/api/payment'
  });

  logger.recordIssue('network_timeout', {
    message: 'Request timeout after 30s'
  });

  // Test metrics retrieval
  console.log('\n3. Testing metrics retrieval...');
  const metrics = logger.getMetrics();
  console.log('Logger metrics:', JSON.stringify(metrics, null, 2));

  // Test troubleshooting suggestions
  console.log('\n4. Testing troubleshooting suggestions...');
  const suggestions = logger.getTroubleshootingSuggestions();
  console.log('Logger suggestions:', JSON.stringify(suggestions, null, 2));

  // Test diagnostic report
  console.log('\n5. Testing diagnostic report...');
  const report = logger.generateDiagnosticReport();
  console.log('Logger diagnostic report:', JSON.stringify(report, null, 2));
}

// Run all tests
async function runAllTests() {
  try {
    await testDebuggingAndMonitoring();
    await testPerformanceMetricsScenarios();
    await testLoggerFeatures();

    console.log('\n🎉 All debugging and monitoring tests completed successfully!');
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (typeof process !== 'undefined') {
  console.log('Starting debugging and monitoring tests...');
  runAllTests().catch(error => {
    console.error('Test failed:', error);
  });
}

export {
  testDebuggingAndMonitoring,
  testPerformanceMetricsScenarios,
  testLoggerFeatures,
  runAllTests
};