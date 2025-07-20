/**
 * @fileoverview
 * URL Construction Diagnostic Utility
 * 
 * This utility provides comprehensive debugging capabilities for URL construction
 * issues in the TestluyPaymentSDK, including retry scenario simulation and
 * deployment environment testing.
 */

import NodeAdapter from './http/adapters/NodeAdapter.js';
import FetchAdapter from './http/adapters/FetchAdapter.js';
import XhrAdapter from './http/adapters/XhrAdapter.js';
import ErrorHandler from './http/ErrorHandler.js';
import { 
  detectDeploymentPlatform, 
  getPlatformUrlConfig, 
  getDeploymentErrorContext,
  isDeploymentEnvironment 
} from './http/utils/DeploymentEnvironmentDetector.js';

/**
 * URL Construction Diagnostic Tool
 * 
 * Provides comprehensive debugging for URL construction issues,
 * retry scenario simulation, and deployment environment testing.
 */
class UrlConstructionDiagnostic {
  /**
   * Creates a new diagnostic instance
   * 
   * @param {Object} options - Configuration options
   * @param {string} [options.baseUrl] - Base URL to test with
   * @param {boolean} [options.verbose=true] - Enable verbose logging
   * @param {Array<string>} [options.adapters=['node', 'fetch', 'xhr']] - Adapters to test
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'https://api-testluy.paragoniu.app';
    this.verbose = options.verbose !== false;
    this.adaptersToTest = options.adapters || ['node', 'fetch', 'xhr'];
    
    // Test scenarios
    this.testScenarios = [
      { name: 'Valid URL', url: '/api/v1/payments' },
      { name: 'URL with query params', url: '/api/v1/payments?status=pending' },
      { name: 'URL with special chars', url: '/api/v1/payments/test-123' },
      { name: 'Empty URL', url: '' },
      { name: 'Root URL', url: '/' },
      { name: 'Malformed URL', url: 'invalid://url' },
      { name: 'URL with spaces', url: '/api/v1/payments with spaces' },
      { name: 'Very long URL', url: '/api/v1/payments/' + 'a'.repeat(1000) }
    ];

    // Deployment environments to simulate
    this.deploymentEnvironments = [
      { name: 'Local Development', env: 'development' },
      { name: 'Vercel', env: 'vercel' },
      { name: 'Netlify', env: 'netlify' },
      { name: 'AWS Lambda', env: 'aws-lambda' },
      { name: 'Cloudflare Workers', env: 'cloudflare-workers' }
    ];

    this.results = {
      urlConstruction: {},
      retrySimulation: {},
      deploymentTesting: {},
      summary: {}
    };
  }

  /**
   * Runs the complete diagnostic suite
   * 
   * @returns {Promise<Object>} Complete diagnostic results
   */
  async runDiagnostic() {
    console.log('🔍 Starting URL Construction Diagnostic...\n');
    
    try {
      // Test URL construction across adapters
      await this.testUrlConstruction();
      
      // Simulate retry scenarios
      await this.simulateRetryScenarios();
      
      // Test deployment environments
      await this.testDeploymentEnvironments();
      
      // Generate summary
      this.generateSummary();
      
      // Display results
      this.displayResults();
      
      return this.results;
    } catch (error) {
      console.error('❌ Diagnostic failed:', error.message);
      throw error;
    }
  }

  /**
   * Tests URL construction across all HTTP adapters
   */
  async testUrlConstruction() {
    console.log('📋 Testing URL Construction Across Adapters...\n');
    
    for (const adapterName of this.adaptersToTest) {
      console.log(`Testing ${adapterName.toUpperCase()} Adapter:`);
      
      const adapter = this.createAdapter(adapterName);
      this.results.urlConstruction[adapterName] = {};
      
      for (const scenario of this.testScenarios) {
        try {
          const result = await this.testUrlConstructionScenario(adapter, scenario);
          this.results.urlConstruction[adapterName][scenario.name] = result;
          
          if (this.verbose) {
            console.log(`  ✅ ${scenario.name}: ${result.success ? 'PASS' : 'FAIL'}`);
            if (!result.success) {
              console.log(`     Error: ${result.error}`);
            }
          }
        } catch (error) {
          this.results.urlConstruction[adapterName][scenario.name] = {
            success: false,
            error: error.message,
            stack: error.stack
          };
          
          if (this.verbose) {
            console.log(`  ❌ ${scenario.name}: FAIL - ${error.message}`);
          }
        }
      }
      console.log('');
    }
  }

  /**
   * Simulates retry scenarios to test URL construction during retries
   */
  async simulateRetryScenarios() {
    console.log('🔄 Simulating Retry Scenarios...\n');
    
    const retryScenarios = [
      { name: '403 Forbidden Retry', statusCode: 403, retryCount: 3 },
      { name: '429 Rate Limited Retry', statusCode: 429, retryCount: 2 },
      { name: '500 Server Error Retry', statusCode: 500, retryCount: 1 },
      { name: 'Network Timeout Retry', error: 'TIMEOUT', retryCount: 2 }
    ];

    for (const adapterName of this.adaptersToTest) {
      console.log(`Testing retry scenarios with ${adapterName.toUpperCase()} Adapter:`);
      
      const adapter = this.createAdapter(adapterName);
      this.results.retrySimulation[adapterName] = {};
      
      for (const scenario of retryScenarios) {
        try {
          const result = await this.simulateRetryScenario(adapter, scenario);
          this.results.retrySimulation[adapterName][scenario.name] = result;
          
          if (this.verbose) {
            console.log(`  ${result.success ? '✅' : '❌'} ${scenario.name}: ${result.success ? 'PASS' : 'FAIL'}`);
            if (result.urlConstructionSteps) {
              console.log(`     URL Construction Steps: ${result.urlConstructionSteps.length}`);
            }
          }
        } catch (error) {
          this.results.retrySimulation[adapterName][scenario.name] = {
            success: false,
            error: error.message,
            stack: error.stack
          };
          
          if (this.verbose) {
            console.log(`  ❌ ${scenario.name}: FAIL - ${error.message}`);
          }
        }
      }
      console.log('');
    }
  }

  /**
   * Tests URL construction in different deployment environments
   */
  async testDeploymentEnvironments() {
    console.log('🌐 Testing Deployment Environment Compatibility...\n');
    
    for (const environment of this.deploymentEnvironments) {
      console.log(`Testing ${environment.name} Environment:`);
      
      // Simulate environment
      const originalEnv = process.env.NODE_ENV;
      const originalVercel = process.env.VERCEL;
      const originalNetlify = process.env.NETLIFY;
      
      this.simulateEnvironment(environment.env);
      
      this.results.deploymentTesting[environment.name] = {};
      
      for (const adapterName of this.adaptersToTest) {
        try {
          const adapter = this.createAdapter(adapterName);
          const result = await this.testDeploymentEnvironment(adapter, environment);
          this.results.deploymentTesting[environment.name][adapterName] = result;
          
          if (this.verbose) {
            console.log(`  ${result.success ? '✅' : '❌'} ${adapterName}: ${result.success ? 'PASS' : 'FAIL'}`);
            if (result.platformDetected) {
              console.log(`     Platform Detected: ${result.platformDetected}`);
            }
          }
        } catch (error) {
          this.results.deploymentTesting[environment.name][adapterName] = {
            success: false,
            error: error.message,
            stack: error.stack
          };
          
          if (this.verbose) {
            console.log(`  ❌ ${adapterName}: FAIL - ${error.message}`);
          }
        }
      }
      
      // Restore environment
      process.env.NODE_ENV = originalEnv;
      process.env.VERCEL = originalVercel;
      process.env.NETLIFY = originalNetlify;
      
      console.log('');
    }
  }

  /**
   * Creates an HTTP adapter instance for testing
   * 
   * @param {string} adapterName - Name of the adapter to create
   * @returns {Object} Adapter instance
   */
  createAdapter(adapterName) {
    const options = {
      baseUrl: this.baseUrl,
      timeout: 5000
    };

    switch (adapterName.toLowerCase()) {
      case 'node':
        return new NodeAdapter(options);
      case 'fetch':
        return new FetchAdapter(options);
      case 'xhr':
        return new XhrAdapter(options);
      default:
        throw new Error(`Unknown adapter: ${adapterName}`);
    }
  }

  /**
   * Tests URL construction for a specific scenario
   * 
   * @param {Object} adapter - HTTP adapter instance
   * @param {Object} scenario - Test scenario
   * @returns {Promise<Object>} Test result
   */
  async testUrlConstructionScenario(adapter, scenario) {
    const startTime = Date.now();
    
    try {
      // Test primary URL construction method
      let primaryResult;
      try {
        primaryResult = adapter._buildUrl(scenario.url);
      } catch (error) {
        primaryResult = null;
      }

      // Test retry-specific URL construction method
      let retryResult;
      try {
        retryResult = adapter._buildUrlWithRetrySupport(scenario.url, {
          attempt: 1,
          originalUrl: scenario.url
        });
      } catch (error) {
        retryResult = null;
      }

      // Test fallback URL construction method
      let fallbackResult;
      try {
        const validationSteps = [];
        const context = {
          baseUrl: adapter.baseUrl,
          originalUrl: scenario.url,
          attempt: 1
        };
        fallbackResult = adapter._buildUrlFallback(scenario.url, validationSteps, context);
      } catch (error) {
        fallbackResult = null;
      }

      const endTime = Date.now();

      return {
        success: true,
        primaryResult,
        retryResult,
        fallbackResult,
        executionTime: endTime - startTime,
        scenario: scenario.name,
        originalUrl: scenario.url
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        scenario: scenario.name,
        originalUrl: scenario.url,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Simulates a retry scenario
   * 
   * @param {Object} adapter - HTTP adapter instance
   * @param {Object} scenario - Retry scenario
   * @returns {Promise<Object>} Simulation result
   */
  async simulateRetryScenario(adapter, scenario) {
    const startTime = Date.now();
    const urlConstructionSteps = [];
    
    try {
      // Simulate multiple retry attempts
      for (let attempt = 1; attempt <= scenario.retryCount; attempt++) {
        const retryContext = {
          attempt,
          originalUrl: '/api/v1/payments',
          statusCode: scenario.statusCode,
          error: scenario.error
        };

        try {
          const url = adapter._buildUrlWithRetrySupport('/api/v1/payments', retryContext);
          urlConstructionSteps.push({
            attempt,
            success: true,
            url,
            method: 'retry-specific'
          });
        } catch (error) {
          urlConstructionSteps.push({
            attempt,
            success: false,
            error: error.message,
            method: 'retry-specific'
          });

          // Try fallback method
          try {
            const validationSteps = [];
            const context = {
              baseUrl: adapter.baseUrl,
              originalUrl: '/api/v1/payments',
              attempt
            };
            const fallbackUrl = adapter._buildUrlFallback('/api/v1/payments', validationSteps, context);
            urlConstructionSteps.push({
              attempt,
              success: true,
              url: fallbackUrl,
              method: 'fallback',
              validationSteps
            });
          } catch (fallbackError) {
            urlConstructionSteps.push({
              attempt,
              success: false,
              error: fallbackError.message,
              method: 'fallback'
            });
          }
        }
      }

      const endTime = Date.now();
      const successfulAttempts = urlConstructionSteps.filter(step => step.success).length;

      return {
        success: successfulAttempts > 0,
        urlConstructionSteps,
        successfulAttempts,
        totalAttempts: scenario.retryCount,
        executionTime: endTime - startTime,
        scenario: scenario.name
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        urlConstructionSteps,
        scenario: scenario.name,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Tests URL construction in a specific deployment environment
   * 
   * @param {Object} adapter - HTTP adapter instance
   * @param {Object} environment - Deployment environment
   * @returns {Promise<Object>} Test result
   */
  async testDeploymentEnvironment(adapter, environment) {
    const startTime = Date.now();
    
    try {
      // Get platform detection results
      const platformDetected = detectDeploymentPlatform();
      const platformConfig = getPlatformUrlConfig(platformDetected);
      const isDeployment = isDeploymentEnvironment();
      const deploymentContext = getDeploymentErrorContext();

      // Test URL construction with deployment context
      const testUrls = [
        '/api/v1/payments',
        '/api/v1/payments?callback=https://example.com/callback',
        '/api/v1/payments/test-transaction'
      ];

      const urlResults = [];
      for (const testUrl of testUrls) {
        try {
          const constructedUrl = adapter._buildUrlWithRetrySupport(testUrl, {
            deploymentEnvironment: environment.env,
            platformConfig
          });
          urlResults.push({
            originalUrl: testUrl,
            constructedUrl,
            success: true
          });
        } catch (error) {
          urlResults.push({
            originalUrl: testUrl,
            error: error.message,
            success: false
          });
        }
      }

      const endTime = Date.now();
      const successfulUrls = urlResults.filter(result => result.success).length;

      return {
        success: successfulUrls === testUrls.length,
        platformDetected,
        platformConfig,
        isDeployment,
        deploymentContext,
        urlResults,
        successfulUrls,
        totalUrls: testUrls.length,
        executionTime: endTime - startTime,
        environment: environment.name
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        environment: environment.name,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Simulates a deployment environment by setting environment variables
   * 
   * @param {string} envType - Type of environment to simulate
   */
  simulateEnvironment(envType) {
    // Reset environment variables
    delete process.env.VERCEL;
    delete process.env.NETLIFY;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    delete process.env.CF_PAGES;

    switch (envType) {
      case 'vercel':
        process.env.VERCEL = '1';
        process.env.VERCEL_ENV = 'production';
        break;
      case 'netlify':
        process.env.NETLIFY = 'true';
        process.env.CONTEXT = 'production';
        break;
      case 'aws-lambda':
        process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';
        process.env.AWS_REGION = 'us-east-1';
        break;
      case 'cloudflare-workers':
        process.env.CF_PAGES = '1';
        break;
      case 'development':
      default:
        process.env.NODE_ENV = 'development';
        break;
    }
  }

  /**
   * Generates a summary of all test results
   */
  generateSummary() {
    const summary = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      adapters: {},
      environments: {},
      retryScenarios: {}
    };

    // Summarize URL construction tests
    for (const [adapterName, scenarios] of Object.entries(this.results.urlConstruction)) {
      summary.adapters[adapterName] = {
        total: Object.keys(scenarios).length,
        passed: Object.values(scenarios).filter(result => result.success).length,
        failed: Object.values(scenarios).filter(result => !result.success).length
      };
      
      summary.totalTests += summary.adapters[adapterName].total;
      summary.passedTests += summary.adapters[adapterName].passed;
      summary.failedTests += summary.adapters[adapterName].failed;
    }

    // Summarize retry simulation tests
    for (const [adapterName, scenarios] of Object.entries(this.results.retrySimulation)) {
      if (!summary.retryScenarios[adapterName]) {
        summary.retryScenarios[adapterName] = { total: 0, passed: 0, failed: 0 };
      }
      
      summary.retryScenarios[adapterName].total = Object.keys(scenarios).length;
      summary.retryScenarios[adapterName].passed = Object.values(scenarios).filter(result => result.success).length;
      summary.retryScenarios[adapterName].failed = Object.values(scenarios).filter(result => !result.success).length;
      
      summary.totalTests += summary.retryScenarios[adapterName].total;
      summary.passedTests += summary.retryScenarios[adapterName].passed;
      summary.failedTests += summary.retryScenarios[adapterName].failed;
    }

    // Summarize deployment environment tests
    for (const [envName, adapters] of Object.entries(this.results.deploymentTesting)) {
      summary.environments[envName] = {
        total: Object.keys(adapters).length,
        passed: Object.values(adapters).filter(result => result.success).length,
        failed: Object.values(adapters).filter(result => !result.success).length
      };
      
      summary.totalTests += summary.environments[envName].total;
      summary.passedTests += summary.environments[envName].passed;
      summary.failedTests += summary.environments[envName].failed;
    }

    this.results.summary = summary;
  }

  /**
   * Displays the diagnostic results in a formatted way
   */
  displayResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 URL CONSTRUCTION DIAGNOSTIC RESULTS');
    console.log('='.repeat(60));

    const { summary } = this.results;
    
    // Overall summary
    console.log('\n📈 OVERALL SUMMARY:');
    console.log(`Total Tests: ${summary.totalTests}`);
    console.log(`Passed: ${summary.passedTests} (${((summary.passedTests / summary.totalTests) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${summary.failedTests} (${((summary.failedTests / summary.totalTests) * 100).toFixed(1)}%)`);

    // Adapter summary
    console.log('\n🔧 ADAPTER RESULTS:');
    for (const [adapterName, stats] of Object.entries(summary.adapters)) {
      const passRate = ((stats.passed / stats.total) * 100).toFixed(1);
      console.log(`${adapterName.toUpperCase()}: ${stats.passed}/${stats.total} (${passRate}%)`);
    }

    // Retry scenario summary
    console.log('\n🔄 RETRY SCENARIO RESULTS:');
    for (const [adapterName, stats] of Object.entries(summary.retryScenarios)) {
      const passRate = ((stats.passed / stats.total) * 100).toFixed(1);
      console.log(`${adapterName.toUpperCase()}: ${stats.passed}/${stats.total} (${passRate}%)`);
    }

    // Environment summary
    console.log('\n🌐 DEPLOYMENT ENVIRONMENT RESULTS:');
    for (const [envName, stats] of Object.entries(summary.environments)) {
      const passRate = ((stats.passed / stats.total) * 100).toFixed(1);
      console.log(`${envName}: ${stats.passed}/${stats.total} (${passRate}%)`);
    }

    // Recommendations
    this.displayRecommendations();
  }

  /**
   * Displays recommendations based on test results
   */
  displayRecommendations() {
    console.log('\n💡 RECOMMENDATIONS:');
    
    const { summary } = this.results;
    const recommendations = [];

    // Check for adapter-specific issues
    for (const [adapterName, stats] of Object.entries(summary.adapters)) {
      if (stats.failed > 0) {
        recommendations.push(`Review ${adapterName} adapter URL construction logic - ${stats.failed} failures detected`);
      }
    }

    // Check for retry-specific issues
    for (const [adapterName, stats] of Object.entries(summary.retryScenarios)) {
      if (stats.failed > 0) {
        recommendations.push(`Improve retry URL construction for ${adapterName} adapter - ${stats.failed} failures detected`);
      }
    }

    // Check for environment-specific issues
    for (const [envName, stats] of Object.entries(summary.environments)) {
      if (stats.failed > 0) {
        recommendations.push(`Address deployment issues for ${envName} environment - ${stats.failed} failures detected`);
      }
    }

    if (recommendations.length === 0) {
      console.log('✅ All tests passed! URL construction is working correctly across all scenarios.');
    } else {
      recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }

    console.log('\n' + '='.repeat(60));
  }

  /**
   * Exports diagnostic results to a JSON file
   * 
   * @param {string} [filename] - Output filename
   */
  async exportResults(filename = 'url-diagnostic-results.json') {
    const fs = await import('fs');
    const resultsWithMetadata = {
      timestamp: new Date().toISOString(),
      baseUrl: this.baseUrl,
      adaptersToTest: this.adaptersToTest,
      testScenarios: this.testScenarios.map(s => s.name),
      deploymentEnvironments: this.deploymentEnvironments.map(e => e.name),
      results: this.results
    };

    fs.writeFileSync(filename, JSON.stringify(resultsWithMetadata, null, 2));
    console.log(`\n📄 Results exported to: ${filename}`);
  }
}

export default UrlConstructionDiagnostic;

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const diagnostic = new UrlConstructionDiagnostic({
    baseUrl: process.argv[2] || 'https://api.testluy.com',
    verbose: true
  });

  diagnostic.runDiagnostic()
    .then(results => {
      console.log('\n✅ Diagnostic completed successfully!');
      return diagnostic.exportResults();
    })
    .catch(error => {
      console.error('\n❌ Diagnostic failed:', error);
      process.exit(1);
    });
}