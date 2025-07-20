/**
 * Test script for URL Construction Diagnostic Utility
 */

import UrlConstructionDiagnostic from './url-construction-diagnostic.js';

async function testDiagnosticUtility() {
  console.log('🧪 Testing URL Construction Diagnostic Utility...\n');

  try {
    // Test with different configurations
    const configs = [
      {
        name: 'Default Configuration',
        options: {}
      },
      {
        name: 'Custom Base URL',
        options: {
          baseUrl: 'https://api-testluy.paragoniu.app',
          verbose: true
        }
      },
      {
        name: 'Limited Adapters',
        options: {
          adapters: ['node', 'fetch'],
          verbose: false
        }
      }
    ];

    for (const config of configs) {
      console.log(`\n📋 Testing: ${config.name}`);
      console.log('-'.repeat(50));

      const diagnostic = new UrlConstructionDiagnostic(config.options);
      
      try {
        const results = await diagnostic.runDiagnostic();
        
        console.log(`✅ ${config.name} completed successfully`);
        console.log(`   Total Tests: ${results.summary.totalTests}`);
        console.log(`   Passed: ${results.summary.passedTests}`);
        console.log(`   Failed: ${results.summary.failedTests}`);
        
        // Export results for this configuration
        await diagnostic.exportResults(`diagnostic-${config.name.toLowerCase().replace(/\s+/g, '-')}.json`);
        
      } catch (error) {
        console.error(`❌ ${config.name} failed:`, error.message);
      }
    }

    console.log('\n🎉 All diagnostic tests completed!');

  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run the test
testDiagnosticUtility();