/**
 * Unit tests for URL Construction Diagnostic Utility
 * 
 * Tests Requirements:
 * - 2.1: Comprehensive logging during retry attempts
 * - 2.2: Detailed error information with URL construction steps
 * - 5.1: Thorough testing of retry URL construction
 */

import UrlConstructionDiagnostic from '../../url-construction-diagnostic.js';

describe('URL Construction Diagnostic Utility', () => {
  let diagnostic;

  beforeEach(() => {
    diagnostic = new UrlConstructionDiagnostic({
      baseUrl: 'https://api-testluy.paragoniu.app',
      verbose: false // Reduce noise in tests
    });
  });

  describe('Initialization', () => {
    test('should initialize with default options', () => {
      const defaultDiagnostic = new UrlConstructionDiagnostic();
      
      expect(defaultDiagnostic.baseUrl).toBe('https://api-testluy.paragoniu.app');
      expect(defaultDiagnostic.verbose).toBe(true);
      expect(defaultDiagnostic.adaptersToTest).toEqual(['node', 'fetch', 'xhr']);
    });

    test('should initialize with custom options', () => {
      const customDiagnostic = new UrlConstructionDiagnostic({
        baseUrl: 'https://custom.api.com',
        verbose: false,
        adapters: ['node', 'fetch']
      });
      
      expect(customDiagnostic.baseUrl).toBe('https://custom.api.com');
      expect(customDiagnostic.verbose).toBe(false);
      expect(customDiagnostic.adaptersToTest).toEqual(['node', 'fetch']);
    });

    test('should have predefined test scenarios', () => {
      expect(diagnostic.testScenarios).toBeDefined();
      expect(diagnostic.testScenarios.length).toBeGreaterThan(0);
      expect(diagnostic.testScenarios[0]).toHaveProperty('name');
      expect(diagnostic.testScenarios[0]).toHaveProperty('url');
    });

    test('should have predefined deployment environments', () => {
      expect(diagnostic.deploymentEnvironments).toBeDefined();
      expect(diagnostic.deploymentEnvironments.length).toBeGreaterThan(0);
      expect(diagnostic.deploymentEnvironments[0]).toHaveProperty('name');
      expect(diagnostic.deploymentEnvironments[0]).toHaveProperty('env');
    });
  });

  describe('Adapter Creation', () => {
    test('should create NodeAdapter', () => {
      const adapter = diagnostic.createAdapter('node');
      expect(adapter).toBeDefined();
      expect(adapter.constructor.name).toBe('NodeAdapter');
    });

    test('should create FetchAdapter', () => {
      const adapter = diagnostic.createAdapter('fetch');
      expect(adapter).toBeDefined();
      expect(adapter.constructor.name).toBe('FetchAdapter');
    });

    test('should create XhrAdapter', () => {
      const adapter = diagnostic.createAdapter('xhr');
      expect(adapter).toBeDefined();
      expect(adapter.constructor.name).toBe('XhrAdapter');
    });

    test('should throw error for unknown adapter', () => {
      expect(() => {
        diagnostic.createAdapter('unknown');
      }).toThrow('Unknown adapter: unknown');
    });
  });

  describe('URL Construction Testing', () => {
    test('should test URL construction scenario successfully', async () => {
      const adapter = diagnostic.createAdapter('node');
      const scenario = { name: 'Test URL', url: '/api/v1/test' };
      
      const result = await diagnostic.testUrlConstructionScenario(adapter, scenario);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('scenario', 'Test URL');
      expect(result).toHaveProperty('originalUrl', '/api/v1/test');
      expect(result).toHaveProperty('executionTime');
      expect(typeof result.executionTime).toBe('number');
    });

    test('should handle URL construction errors gracefully', async () => {
      const adapter = diagnostic.createAdapter('node');
      const scenario = { name: 'Invalid URL', url: 'invalid://url' };
      
      const result = await diagnostic.testUrlConstructionScenario(adapter, scenario);
      
      expect(result).toBeDefined();
      expect(result.scenario).toBe('Invalid URL');
      expect(result.originalUrl).toBe('invalid://url');
    });

    test('should test all URL construction methods', async () => {
      const adapter = diagnostic.createAdapter('node');
      const scenario = { name: 'Valid URL', url: '/api/v1/payments' };
      
      const result = await diagnostic.testUrlConstructionScenario(adapter, scenario);
      
      expect(result).toHaveProperty('primaryResult');
      expect(result).toHaveProperty('retryResult');
      expect(result).toHaveProperty('fallbackResult');
    });
  });

  describe('Retry Scenario Simulation', () => {
    test('should simulate retry scenario with multiple attempts', async () => {
      const adapter = diagnostic.createAdapter('node');
      const scenario = { 
        name: '403 Forbidden Retry', 
        statusCode: 403, 
        retryCount: 3 
      };
      
      const result = await diagnostic.simulateRetryScenario(adapter, scenario);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('urlConstructionSteps');
      expect(result).toHaveProperty('successfulAttempts');
      expect(result).toHaveProperty('totalAttempts', 3);
      expect(result).toHaveProperty('scenario', '403 Forbidden Retry');
      expect(result.urlConstructionSteps).toBeInstanceOf(Array);
    });

    test('should track URL construction steps during retry', async () => {
      const adapter = diagnostic.createAdapter('node');
      const scenario = { 
        name: 'Rate Limited Retry', 
        statusCode: 429, 
        retryCount: 2 
      };
      
      const result = await diagnostic.simulateRetryScenario(adapter, scenario);
      
      expect(result.urlConstructionSteps.length).toBeGreaterThan(0);
      
      // Check that each step has required properties
      result.urlConstructionSteps.forEach(step => {
        expect(step).toHaveProperty('attempt');
        expect(step).toHaveProperty('success');
        expect(step).toHaveProperty('method');
        expect(typeof step.attempt).toBe('number');
        expect(typeof step.success).toBe('boolean');
      });
    });

    test('should handle retry simulation errors', async () => {
      const adapter = diagnostic.createAdapter('node');
      const scenario = { 
        name: 'Network Timeout', 
        error: 'TIMEOUT', 
        retryCount: 1 
      };
      
      const result = await diagnostic.simulateRetryScenario(adapter, scenario);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('scenario', 'Network Timeout');
      expect(result).toHaveProperty('urlConstructionSteps');
    });
  });

  describe('Deployment Environment Testing', () => {
    test('should test deployment environment compatibility', async () => {
      const adapter = diagnostic.createAdapter('node');
      const environment = { name: 'Vercel', env: 'vercel' };
      
      const result = await diagnostic.testDeploymentEnvironment(adapter, environment);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('environment', 'Vercel');
      expect(result).toHaveProperty('platformDetected');
      expect(result).toHaveProperty('platformConfig');
      expect(result).toHaveProperty('urlResults');
      expect(result).toHaveProperty('executionTime');
      expect(result.urlResults).toBeInstanceOf(Array);
    });

    test('should test multiple URLs in deployment environment', async () => {
      const adapter = diagnostic.createAdapter('node');
      const environment = { name: 'Netlify', env: 'netlify' };
      
      const result = await diagnostic.testDeploymentEnvironment(adapter, environment);
      
      expect(result.urlResults.length).toBeGreaterThan(0);
      
      // Check that each URL result has required properties
      result.urlResults.forEach(urlResult => {
        expect(urlResult).toHaveProperty('originalUrl');
        expect(urlResult).toHaveProperty('success');
        expect(typeof urlResult.success).toBe('boolean');
      });
    });

    test('should simulate environment variables correctly', () => {
      // Test Vercel simulation
      diagnostic.simulateEnvironment('vercel');
      expect(process.env.VERCEL).toBe('1');
      expect(process.env.VERCEL_ENV).toBe('production');

      // Test Netlify simulation
      diagnostic.simulateEnvironment('netlify');
      expect(process.env.NETLIFY).toBe('true');
      expect(process.env.CONTEXT).toBe('production');

      // Test AWS Lambda simulation
      diagnostic.simulateEnvironment('aws-lambda');
      expect(process.env.AWS_LAMBDA_FUNCTION_NAME).toBe('test-function');
      expect(process.env.AWS_REGION).toBe('us-east-1');

      // Test Cloudflare Workers simulation
      diagnostic.simulateEnvironment('cloudflare-workers');
      expect(process.env.CF_PAGES).toBe('1');
    });
  });

  describe('Summary Generation', () => {
    test('should generate comprehensive summary', () => {
      // Mock some test results
      diagnostic.results = {
        urlConstruction: {
          node: {
            'Valid URL': { success: true },
            'Invalid URL': { success: false }
          },
          fetch: {
            'Valid URL': { success: true },
            'Invalid URL': { success: true }
          }
        },
        retrySimulation: {
          node: {
            '403 Retry': { success: true },
            '429 Retry': { success: false }
          }
        },
        deploymentTesting: {
          'Vercel': {
            node: { success: true },
            fetch: { success: true }
          },
          'Netlify': {
            node: { success: false },
            fetch: { success: true }
          }
        }
      };

      diagnostic.generateSummary();

      expect(diagnostic.results.summary).toBeDefined();
      expect(diagnostic.results.summary).toHaveProperty('totalTests');
      expect(diagnostic.results.summary).toHaveProperty('passedTests');
      expect(diagnostic.results.summary).toHaveProperty('failedTests');
      expect(diagnostic.results.summary).toHaveProperty('adapters');
      expect(diagnostic.results.summary).toHaveProperty('environments');
      expect(diagnostic.results.summary).toHaveProperty('retryScenarios');

      // Verify calculations
      expect(diagnostic.results.summary.totalTests).toBe(10); // 4 + 2 + 4 (2 adapters * 2 scenarios + 2 environments * 2 adapters)
      expect(diagnostic.results.summary.passedTests).toBe(7);
      expect(diagnostic.results.summary.failedTests).toBe(3);
    });
  });

  describe('Requirements Compliance', () => {
    test('should provide comprehensive logging during retry attempts (Requirement 2.1)', async () => {
      const adapter = diagnostic.createAdapter('node');
      const scenario = { 
        name: 'Logging Test', 
        statusCode: 403, 
        retryCount: 2 
      };
      
      const result = await diagnostic.simulateRetryScenario(adapter, scenario);
      
      // Verify logging information is captured
      expect(result.urlConstructionSteps).toBeDefined();
      expect(result.urlConstructionSteps.length).toBeGreaterThan(0);
      
      // Each step should contain logging information
      result.urlConstructionSteps.forEach(step => {
        expect(step).toHaveProperty('attempt');
        expect(step).toHaveProperty('method');
        expect(typeof step.attempt).toBe('number');
        expect(['retry-specific', 'fallback'].includes(step.method)).toBe(true);
      });
    });

    test('should provide detailed error information with URL construction steps (Requirement 2.2)', async () => {
      const adapter = diagnostic.createAdapter('node');
      const scenario = { name: 'Error Detail Test', url: 'invalid://url' };
      
      const result = await diagnostic.testUrlConstructionScenario(adapter, scenario);
      
      // Verify detailed error information is provided
      expect(result).toHaveProperty('scenario');
      expect(result).toHaveProperty('originalUrl');
      expect(result).toHaveProperty('executionTime');
      
      // Should test multiple construction methods
      expect(result).toHaveProperty('primaryResult');
      expect(result).toHaveProperty('retryResult');
      expect(result).toHaveProperty('fallbackResult');
    });

    test('should thoroughly test retry URL construction (Requirement 5.1)', async () => {
      // Test that the diagnostic covers all retry scenarios
      const retryScenarios = [
        { name: '403 Forbidden', statusCode: 403 },
        { name: '429 Rate Limited', statusCode: 429 },
        { name: '500 Server Error', statusCode: 500 },
        { name: 'Network Timeout', error: 'TIMEOUT' }
      ];

      for (const scenario of retryScenarios) {
        const adapter = diagnostic.createAdapter('node');
        const testScenario = { ...scenario, retryCount: 2 };
        
        const result = await diagnostic.simulateRetryScenario(adapter, testScenario);
        
        expect(result).toBeDefined();
        expect(result).toHaveProperty('urlConstructionSteps');
        expect(result).toHaveProperty('successfulAttempts');
        expect(result).toHaveProperty('totalAttempts');
        
        // Verify retry attempts were made
        expect(result.totalAttempts).toBe(2);
        expect(result.urlConstructionSteps.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Integration with Deployment Environment Detection', () => {
    test('should integrate with deployment environment detection utilities', async () => {
      const adapter = diagnostic.createAdapter('node');
      const environment = { name: 'Test Environment', env: 'vercel' };
      
      // Simulate Vercel environment
      diagnostic.simulateEnvironment('vercel');
      
      const result = await diagnostic.testDeploymentEnvironment(adapter, environment);
      
      expect(result).toHaveProperty('platformDetected');
      expect(result).toHaveProperty('platformConfig');
      expect(result).toHaveProperty('isDeployment');
      expect(result).toHaveProperty('deploymentContext');
    });
  });
});