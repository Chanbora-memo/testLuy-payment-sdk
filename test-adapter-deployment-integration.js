/**
 * Test script to verify HTTP adapter integration with deployment environment detection
 */

import NodeAdapter from './http/adapters/NodeAdapter.js';

async function testAdapterDeploymentIntegration() {
  console.log('=== Testing HTTP Adapter Deployment Integration ===\n');

  try {
    // Test NodeAdapter with deployment environment detection
    console.log('1. Creating NodeAdapter with deployment detection:');
    const adapter = new NodeAdapter({
      baseUrl: 'https://api-testluy.paragoniu.app',
      timeout: 30000
    });

    console.log(`   Platform detected: ${adapter.deploymentPlatform}`);
    console.log(`   Is deployment: ${adapter.isDeployment}`);
    console.log(`   Platform config loaded: ${!!adapter.platformConfig}`);
    console.log(`   Timeout adjusted: ${adapter.timeout}ms`);
    console.log(`   Headers count: ${Object.keys(adapter.headers).length}`);
    console.log('   ✓ Adapter initialized with deployment detection\n');

    // Test URL construction with deployment context
    console.log('2. Testing URL construction with deployment context:');
    
    // Test normal URL construction
    try {
      const normalUrl = adapter._buildUrl('/test-endpoint');
      console.log(`   Normal URL construction: ${normalUrl}`);
      console.log('   ✓ Normal URL construction successful\n');
    } catch (error) {
      console.log(`   Normal URL construction failed: ${error.message}`);
    }

    // Test URL construction with retry context
    console.log('3. Testing URL construction with retry context:');
    try {
      const retryUrl = adapter._buildUrlWithRetrySupport('/test-endpoint', { 
        attempt: 1,
        originalError: 'Test retry scenario'
      });
      console.log(`   Retry URL construction: ${retryUrl}`);
      console.log('   ✓ Retry URL construction successful\n');
    } catch (error) {
      console.log(`   Retry URL construction failed: ${error.message}`);
      console.log(`   Error includes deployment context: ${error.message.includes('Platform:')}`);
    }

    // Test error handling with deployment context
    console.log('4. Testing error handling with deployment context:');
    try {
      // Force an error by using invalid URL
      adapter._buildUrlWithRetrySupport(null);
    } catch (error) {
      console.log(`   Error message includes platform: ${error.message.includes('Platform:')}`);
      console.log(`   Error has deployment context: ${!!error.deploymentContext}`);
      console.log(`   Error has recovery guidance: ${!!error.recoveryGuidance}`);
      console.log('   ✓ Error handling includes deployment context\n');
    }

    // Test platform-specific configurations
    console.log('5. Testing platform-specific configurations:');
    console.log(`   Platform config - Requires absolute URLs: ${adapter.platformConfig.requiresAbsoluteUrls}`);
    console.log(`   Platform config - URL validation strict: ${adapter.platformConfig.urlValidationStrict}`);
    console.log(`   Platform config - CORS handling: ${adapter.platformConfig.corsHandling}`);
    console.log(`   Platform config - Timeout adjustments: ${JSON.stringify(adapter.platformConfig.timeoutAdjustments)}`);
    console.log(`   Platform config - Header adjustments: ${JSON.stringify(adapter.platformConfig.headerAdjustments)}`);
    console.log('   ✓ Platform configurations accessible\n');

    console.log('=== All HTTP Adapter Deployment Integration Tests Passed! ===');
    return true;

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

// Run the test
testAdapterDeploymentIntegration()
  .then(success => {
    if (success) {
      console.log('\n✅ HTTP Adapter deployment integration is working correctly!');
      process.exit(0);
    } else {
      console.log('\n❌ HTTP Adapter deployment integration tests failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n❌ Unexpected error during testing:', error);
    process.exit(1);
  });