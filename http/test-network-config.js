/**
 * @fileoverview
 * Test file for proxy and network configuration functionality
 */

import ConfigurationManager from './ConfigurationManager.js';
import EnhancedHttpClient from './EnhancedHttpClient.js';

/**
 * Test proxy configuration
 */
function testProxyConfiguration() {
  console.log('Testing proxy configuration...');
  
  // Test 1: Create configuration with proxy settings
  console.log('\n1. Testing proxy configuration:');
  const configManager = new ConfigurationManager({
    proxy: {
      enabled: true,
      host: 'proxy.example.com',
      port: 8080,
      protocol: 'http',
      auth: 'username:password'
    }
  });
  
  const config = configManager.getConfig();
  console.log('Proxy configuration:', config.proxy);
  
  // Test 2: Create HTTP client with proxy settings
  console.log('\n2. Testing HTTP client with proxy:');
  const httpClient = new EnhancedHttpClient(config);
  console.log('HTTP client created with proxy configuration');
  
  // Test 3: Update proxy configuration
  console.log('\n3. Testing proxy configuration update:');
  configManager.set('proxy.enabled', false);
  console.log('Proxy enabled:', configManager.get('proxy.enabled'));
  configManager.set('proxy.enabled', true);
  configManager.set('proxy.host', 'new-proxy.example.com');
  configManager.set('proxy.port', 3128);
  console.log('Updated proxy configuration:', configManager.get('proxy'));
  
  // Test 4: Invalid proxy configuration
  console.log('\n4. Testing invalid proxy configuration:');
  try {
    const invalidConfigManager = new ConfigurationManager({
      proxy: {
        enabled: true,
        // Missing host and port
      }
    });
    console.log('Invalid config created (should not happen)');
  } catch (error) {
    console.log('Validation error caught:', error.message);
  }
}

/**
 * Test connection configuration
 */
function testConnectionConfiguration() {
  console.log('\nTesting connection configuration...');
  
  // Test 1: Create configuration with connection settings
  console.log('\n1. Testing connection configuration:');
  const configManager = new ConfigurationManager({
    connection: {
      keepAlive: true,
      maxSockets: 20,
      maxFreeSockets: 10,
      socketTimeout: 30000,
      rejectUnauthorized: false
    }
  });
  
  const config = configManager.getConfig();
  console.log('Connection configuration:', config.connection);
  
  // Test 2: Create HTTP client with connection settings
  console.log('\n2. Testing HTTP client with connection settings:');
  const httpClient = new EnhancedHttpClient(config);
  console.log('HTTP client created with connection configuration');
  
  // Test 3: Update connection configuration
  console.log('\n3. Testing connection configuration update:');
  configManager.set('connection.keepAlive', false);
  configManager.set('connection.maxSockets', 50);
  console.log('Updated connection configuration:', configManager.get('connection'));
  
  // Test 4: Invalid connection configuration
  console.log('\n4. Testing invalid connection configuration:');
  try {
    const invalidConfigManager = new ConfigurationManager({
      connection: {
        maxSockets: -5 // Invalid value
      }
    });
    console.log('Invalid config created (should not happen)');
  } catch (error) {
    console.log('Validation error caught:', error.message);
  }
}

/**
 * Test TLS configuration
 */
function testTlsConfiguration() {
  console.log('\nTesting TLS configuration...');
  
  // Test 1: Create configuration with TLS settings
  console.log('\n1. Testing TLS configuration:');
  const configManager = new ConfigurationManager({
    tls: {
      minVersion: 'TLSv1.2',
      ciphers: 'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384',
      cert: '-----BEGIN CERTIFICATE-----\nMIIBIjANBgkq...\n-----END CERTIFICATE-----',
      key: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkq...\n-----END PRIVATE KEY-----',
      ca: '-----BEGIN CERTIFICATE-----\nMIIBIjANBgkq...\n-----END CERTIFICATE-----',
      passphrase: 'test-passphrase'
    }
  });
  
  const config = configManager.getConfig();
  console.log('TLS configuration:', {
    minVersion: config.tls.minVersion,
    ciphers: config.tls.ciphers,
    hasCert: !!config.tls.cert,
    hasKey: !!config.tls.key,
    hasCa: !!config.tls.ca,
    hasPassphrase: !!config.tls.passphrase
  });
  
  // Test 2: Create HTTP client with TLS settings
  console.log('\n2. Testing HTTP client with TLS settings:');
  const httpClient = new EnhancedHttpClient(config);
  console.log('HTTP client created with TLS configuration');
  
  // Test 3: Update TLS configuration
  console.log('\n3. Testing TLS configuration update:');
  configManager.set('tls.minVersion', 'TLSv1.3');
  console.log('Updated TLS minVersion:', configManager.get('tls.minVersion'));
  
  // Test 4: Invalid TLS configuration
  console.log('\n4. Testing invalid TLS configuration:');
  try {
    const invalidConfigManager = new ConfigurationManager({
      tls: {
        minVersion: 'SSLv3' // Invalid version
      }
    });
    console.log('Invalid config created (should not happen)');
  } catch (error) {
    console.log('Validation error caught:', error.message);
  }
  
  // Test 5: Missing key with cert provided
  console.log('\n5. Testing missing key with cert provided:');
  try {
    const invalidConfigManager = new ConfigurationManager({
      tls: {
        cert: '-----BEGIN CERTIFICATE-----\nMIIBIjANBgkq...\n-----END CERTIFICATE-----',
        key: null // Missing key
      }
    });
    console.log('Invalid config created (should not happen)');
  } catch (error) {
    console.log('Validation error caught:', error.message);
  }
}

/**
 * Test environment variable configuration
 */
function testEnvironmentVariables() {
  console.log('\nTesting environment variable configuration...');
  console.log('Note: This test will only show meaningful results if environment variables are set');
  
  // Mock environment variables for testing
  if (typeof process !== 'undefined' && process.env) {
    // Save original values
    const originalEnv = { ...process.env };
    
    // Set mock environment variables
    process.env.TESTLUY_PROXY_HOST = 'env-proxy.example.com';
    process.env.TESTLUY_PROXY_PORT = '9090';
    process.env.TESTLUY_PROXY_PROTOCOL = 'https';
    process.env.TESTLUY_KEEP_ALIVE = 'true';
    process.env.TESTLUY_MAX_SOCKETS = '15';
    process.env.TESTLUY_TLS_MIN_VERSION = 'TLSv1.2';
    
    // Create configuration manager
    const configManager = new ConfigurationManager();
    const config = configManager.getConfig();
    
    console.log('Proxy from env:', config.proxy);
    console.log('Connection from env:', config.connection);
    console.log('TLS from env:', config.tls);
    
    // Restore original environment
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('TESTLUY_') && !originalEnv[key]) {
        delete process.env[key];
      }
    });
    
    Object.keys(originalEnv).forEach(key => {
      if (key.startsWith('TESTLUY_')) {
        process.env[key] = originalEnv[key];
      }
    });
  } else {
    console.log('Environment variables not available in this environment');
  }
}

/**
 * Run all tests
 */
function runTests() {
  console.log('=== Testing Proxy and Network Configuration ===\n');
  
  testProxyConfiguration();
  testConnectionConfiguration();
  testTlsConfiguration();
  testEnvironmentVariables();
  
  console.log('\n=== All tests completed ===');
}

// Run the tests
runTests();