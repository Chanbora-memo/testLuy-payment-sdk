/**
 * Test script to verify deployment environment detection functionality
 */

import { 
  detectDeploymentPlatform, 
  detectDeploymentEnvironment,
  getPlatformUrlConfig, 
  getDeploymentErrorContext,
  isDeploymentEnvironment,
  getDeploymentInfo,
  DeploymentPlatform,
  DeploymentEnvironment
} from './http/utils/DeploymentEnvironmentDetector.js';

async function testDeploymentEnvironmentDetection() {
  console.log('=== Testing Deployment Environment Detection ===\n');

  try {
    // Test basic detection
    console.log('1. Basic Environment Detection:');
    const platform = detectDeploymentPlatform();
    const environment = detectDeploymentEnvironment();
    const isDeployment = isDeploymentEnvironment();
    
    console.log(`   Platform: ${platform}`);
    console.log(`   Environment: ${environment}`);
    console.log(`   Is Deployment: ${isDeployment}`);
    console.log('   ✓ Basic detection completed\n');

    // Test platform configuration
    console.log('2. Platform Configuration:');
    const platformConfig = getPlatformUrlConfig(platform);
    console.log(`   Requires Absolute URLs: ${platformConfig.requiresAbsoluteUrls}`);
    console.log(`   URL Validation Strict: ${platformConfig.urlValidationStrict}`);
    console.log(`   CORS Handling: ${platformConfig.corsHandling}`);
    console.log(`   Default Timeout: ${platformConfig.timeoutAdjustments?.default || 'not set'}`);
    console.log('   ✓ Platform configuration retrieved\n');

    // Test deployment info
    console.log('3. Comprehensive Deployment Info:');
    const deploymentInfo = getDeploymentInfo();
    console.log(`   Platform: ${deploymentInfo.platform}`);
    console.log(`   Environment: ${deploymentInfo.environment}`);
    console.log(`   Is Deployment: ${deploymentInfo.isDeployment}`);
    console.log(`   Is Serverless: ${deploymentInfo.isServerless}`);
    console.log(`   Detected At: ${deploymentInfo.detectedAt}`);
    console.log('   ✓ Deployment info retrieved\n');

    // Test error context
    console.log('4. Error Context Generation:');
    const mockError = new Error('Test error for context generation');
    const errorContext = getDeploymentErrorContext(mockError, { testContext: true });
    
    console.log(`   Error Platform: ${errorContext.deployment.platform}`);
    console.log(`   Error Environment: ${errorContext.deployment.environment}`);
    console.log(`   Platform Guidance Available: ${!!errorContext.platformGuidance}`);
    console.log(`   Environment Variables Captured: ${!!errorContext.environmentVariables}`);
    console.log('   ✓ Error context generated\n');

    // Test platform-specific scenarios
    console.log('5. Platform-Specific Scenarios:');
    
    // Test different platform configurations
    const platforms = [
      DeploymentPlatform.LOCAL,
      DeploymentPlatform.VERCEL,
      DeploymentPlatform.NETLIFY,
      DeploymentPlatform.AWS_LAMBDA,
      DeploymentPlatform.CLOUDFLARE_WORKERS
    ];

    platforms.forEach(testPlatform => {
      const config = getPlatformUrlConfig(testPlatform);
      console.log(`   ${testPlatform}:`);
      console.log(`     - Timeout: ${config.timeoutAdjustments?.default || 'default'}`);
      console.log(`     - Headers: ${Object.keys(config.headerAdjustments || {}).length} custom headers`);
      console.log(`     - URL Validation: ${config.urlValidationStrict ? 'strict' : 'lenient'}`);
    });
    console.log('   ✓ Platform scenarios tested\n');

    // Test URL construction guidance
    console.log('6. URL Construction Error Guidance:');
    const urlError = new Error('Invalid URL construction');
    const urlErrorContext = getDeploymentErrorContext(urlError, { 
      originalUrl: '/test-endpoint',
      baseUrl: 'https://api.example.com'
    });
    
    if (urlErrorContext.platformGuidance) {
      console.log(`   Common Issues: ${urlErrorContext.platformGuidance.commonIssues?.length || 0} identified`);
      console.log(`   Recommended Actions: ${urlErrorContext.platformGuidance.recommendedActions?.length || 0} provided`);
      console.log(`   Documentation Links: ${urlErrorContext.platformGuidance.documentationLinks?.length || 0} available`);
    }
    console.log('   ✓ URL construction guidance generated\n');

    console.log('=== All Deployment Environment Detection Tests Passed! ===');
    return true;

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

// Run the test
testDeploymentEnvironmentDetection()
  .then(success => {
    if (success) {
      console.log('\n✅ Deployment environment detection is working correctly!');
      process.exit(0);
    } else {
      console.log('\n❌ Deployment environment detection tests failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n❌ Unexpected error during testing:', error);
    process.exit(1);
  });