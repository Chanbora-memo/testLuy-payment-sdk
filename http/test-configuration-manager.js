/**
 * @fileoverview
 * Test file for the ConfigurationManager class
 */

import ConfigurationManager from './ConfigurationManager.js';

/**
 * Test the ConfigurationManager class
 */
function testConfigurationManager() {
  console.log('Testing ConfigurationManager...');
  
  // Test 1: Create with default configuration
  console.log('\n1. Testing default configuration:');
  const configManager = new ConfigurationManager();
  console.log('Default config:', configManager.getConfig());
  
  // Test 2: Create with custom configuration
  console.log('\n2. Testing custom configuration:');
  const customConfigManager = new ConfigurationManager({
    baseUrl: 'https://custom-api.example.com',
    timeout: 10000,
    retryConfig: {
      maxRetries: 5
    }
  });
  console.log('Custom config:', customConfigManager.getConfig());
  
  // Test 3: Update configuration
  console.log('\n3. Testing configuration update:');
  configManager.updateConfig({
    timeout: 15000,
    headers: {
      'X-Custom-Header': 'CustomValue'
    }
  });
  console.log('Updated config:', configManager.getConfig());
  
  // Test 4: Get specific configuration values
  console.log('\n4. Testing get method:');
  console.log('baseUrl:', configManager.get('baseUrl'));
  console.log('timeout:', configManager.get('timeout'));
  console.log('retryConfig.maxRetries:', configManager.get('retryConfig.maxRetries'));
  console.log('nonExistentKey (with default):', configManager.get('nonExistentKey', 'defaultValue'));
  
  // Test 5: Set specific configuration values
  console.log('\n5. Testing set method:');
  configManager.set('logging.level', 'debug');
  configManager.set('retryConfig.jitterFactor', 0.2);
  configManager.set('newSection.newKey', 'newValue');
  console.log('Config after set:', configManager.getConfig());
  
  // Test 6: Environment detection
  console.log('\n6. Testing environment detection:');
  console.log('Detected environment:', configManager.detectEnvironment());
  
  // Test 7: Load environment-specific configuration
  console.log('\n7. Testing environment-specific configuration:');
  console.log('Development config:', configManager.loadEnvironmentConfig('development'));
  console.log('Production config:', configManager.loadEnvironmentConfig('production'));
  console.log('Test config:', configManager.loadEnvironmentConfig('test'));
  
  // Test 8: Create HTTP client configuration
  console.log('\n8. Testing HTTP client configuration:');
  console.log('HTTP client config:', configManager.createHttpClientConfig());
  
  // Test 9: Configuration validation
  console.log('\n9. Testing configuration validation:');
  try {
    const invalidConfigManager = new ConfigurationManager({
      timeout: -1 // Invalid timeout
    });
    console.log('Invalid config created (should not happen)');
  } catch (error) {
    console.log('Validation error caught:', error.message);
  }
  
  console.log('\nConfigurationManager tests completed!');
}

// Run the test
testConfigurationManager();