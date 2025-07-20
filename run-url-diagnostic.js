#!/usr/bin/env node

/**
 * CLI script to run URL Construction Diagnostic
 * 
 * Usage:
 *   node run-url-diagnostic.js [baseUrl] [options]
 * 
 * Examples:
 *   node run-url-diagnostic.js
 *   node run-url-diagnostic.js https://custom-api.testluy.com
 *   node run-url-diagnostic.js https://api.testluy.com --adapters=node,fetch
 *   node run-url-diagnostic.js https://api.testluy.com --verbose=false
 */

import UrlConstructionDiagnostic from './url-construction-diagnostic.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    baseUrl: 'https://api-testluy.paragoniu.app',
    verbose: true,
    adapters: ['node', 'fetch', 'xhr']
  };

  // Parse positional arguments
  if (args.length > 0 && !args[0].startsWith('--')) {
    options.baseUrl = args[0];
  }

  // Parse named arguments
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      
      switch (key) {
        case 'verbose':
          options.verbose = value !== 'false';
          break;
        case 'adapters':
          options.adapters = value.split(',').map(a => a.trim());
          break;
        case 'help':
          showHelp();
          process.exit(0);
          break;
      }
    }
  }

  return options;
}

function showHelp() {
  console.log(`
URL Construction Diagnostic Tool

Usage:
  node run-url-diagnostic.js [baseUrl] [options]

Arguments:
  baseUrl                    Base URL to test (default: https://api-testluy.paragoniu.app)

Options:
  --verbose=true|false       Enable verbose output (default: true)
  --adapters=node,fetch,xhr  Comma-separated list of adapters to test (default: node,fetch,xhr)
  --help                     Show this help message

Examples:
  node run-url-diagnostic.js
  node run-url-diagnostic.js https://custom-api.testluy.com
  node run-url-diagnostic.js https://api-testluy.paragoniu.app --adapters=node,fetch
  node run-url-diagnostic.js https://api-testluy.paragoniu.app --verbose=false

The diagnostic will test:
  - URL construction across all specified HTTP adapters
  - Retry scenario simulation with various error conditions
  - Deployment environment compatibility testing
  - Comprehensive error reporting and debugging information

Results will be exported to a JSON file for further analysis.
`);
}

async function main() {
  try {
    const options = parseArgs();
    
    console.log('🔍 URL Construction Diagnostic Tool');
    console.log('=====================================');
    console.log(`Base URL: ${options.baseUrl}`);
    console.log(`Adapters: ${options.adapters.join(', ')}`);
    console.log(`Verbose: ${options.verbose}`);
    console.log('');

    const diagnostic = new UrlConstructionDiagnostic(options);
    
    const results = await diagnostic.runDiagnostic();
    
    // Export results with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `url-diagnostic-${timestamp}.json`;
    await diagnostic.exportResults(filename);
    
    console.log('\n✅ Diagnostic completed successfully!');
    console.log(`📄 Results exported to: ${filename}`);
    
    // Exit with appropriate code
    const { summary } = results;
    if (summary.failedTests > 0) {
      console.log(`\n⚠️  ${summary.failedTests} tests failed. Please review the results.`);
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n❌ Diagnostic failed:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the CLI
main();