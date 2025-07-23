/**
 * @fileoverview
 * Unit tests for ConfigurationManager class
 */

import { jest } from '@jest/globals';
import ConfigurationManager from '../../http/ConfigurationManager.js';

describe('ConfigurationManager', () => {
  let configManager;
  let originalEnv;
  
  beforeEach(() => {
    // Save original process.env
    originalEnv = { ...process.env };
    
    // Reset the module before each test
    configManager = new ConfigurationManager();
  });
  
  afterEach(() => {
    // Restore process.env
    process.env = originalEnv;
    
    // Clear all mocks
    jest.clearAllMocks();
  });
  
  describe('constructor', () => {
    test('should initialize with default config', () => {
      expect(configManager.config).toBeDefined();
      expect(configManager.config.baseUrl).toBeDefined();
      expect(configManager.config.timeout).toBeDefined();
      expect(configManager.config.retryConfig).toBeDefined();
    });
    
    test('should merge user config with defaults', () => {
      const userConfig = {
        baseUrl: 'https://custom-api.example.com',
        timeout: 60000
      };
      
      configManager = new ConfigurationManager(userConfig);
      
      expect(configManager.config.baseUrl).toBe('https://custom-api.example.com');
      expect(configManager.config.timeout).toBe(60000);
    });
  });
  
  describe('getEnvironmentConfig', () => {
    test('should return empty object if no environment variables', () => {
      const result = configManager.getEnvironmentConfig();
      
      expect(result).toEqual({});
    });
    
    test('should read baseUrl from environment', () => {
      process.env.TESTLUY_BASE_URL = 'https://env-api.example.com';
      
      const result = configManager.getEnvironmentConfig();
      
      expect(result).toHaveProperty('baseUrl', 'https://env-api.example.com');
    });
    
    test('should read timeout from environment', () => {
      process.env.TESTLUY_TIMEOUT = '60000';
      
      const result = configManager.getEnvironmentConfig();
      
      expect(result).toHaveProperty('timeout', 60000);
    });
    
    test('should ignore invalid timeout value', () => {
      process.env.TESTLUY_TIMEOUT = 'invalid';
      
      const result = configManager.getEnvironmentConfig();
      
      expect(result).not.toHaveProperty('timeout');
    });
    
    test('should read retry configuration from environment', () => {
      process.env.TESTLUY_MAX_RETRIES = '5';
      process.env.TESTLUY_BASE_DELAY = '2000';
      
      const result = configManager.getEnvironmentConfig();
      
      expect(result).toHaveProperty('retryConfig');
      expect(result.retryConfig).toHaveProperty('maxRetries', 5);
      expect(result.retryConfig).toHaveProperty('baseDelay', 2000);
    });
  });
  
  describe('getConfig', () => {
    test('should return a copy of the current config', () => {
      const config = configManager.getConfig();
      
      expect(config).toEqual(configManager.config);
      expect(config).not.toBe(configManager.config); // Should be a different object
    });
  });
  
  describe('get', () => {
    test('should return value for existing key', () => {
      const baseUrl = configManager.get('baseUrl');
      expect(baseUrl).toBeDefined();
      expect(typeof baseUrl).toBe('string');
    });
    
    test('should return value for nested key', () => {
      const maxRetries = configManager.get('retryConfig.maxRetries');
      expect(maxRetries).toBeDefined();
      expect(typeof maxRetries).toBe('number');
    });
    
    test('should return default value for non-existent key', () => {
      expect(configManager.get('nonExistent', 'default')).toBe('default');
    });
    
    test('should return default value for non-existent nested key', () => {
      expect(configManager.get('retryConfig.nonExistent', 'default')).toBe('default');
    });
    
    test('should return default value for partially non-existent nested key', () => {
      expect(configManager.get('nonExistent.key', 'default')).toBe('default');
    });
  });
  
  describe('set', () => {
    test('should set value for existing key', () => {
      configManager.set('baseUrl', 'https://new-api.example.com');
      
      expect(configManager.config.baseUrl).toBe('https://new-api.example.com');
    });
    
    test('should set value for nested key', () => {
      configManager.set('retryConfig.maxRetries', 5);
      
      expect(configManager.config.retryConfig.maxRetries).toBe(5);
    });
    
    test('should create nested objects if needed', () => {
      configManager.set('newSection.key', 'value');
      
      expect(configManager.config.newSection.key).toBe('value');
    });
    
    test('should return the updated config', () => {
      const result = configManager.set('baseUrl', 'https://new-api.example.com');
      
      expect(result).toEqual(configManager.config);
    });
  });
  
  describe('createHttpClientConfig', () => {
    test('should extract relevant configuration for HTTP client', () => {
      // Set up a config with all relevant properties
      configManager.config = {
        baseUrl: 'https://api.example.com',
        timeout: 60000,
        headers: { 'X-Custom': 'Value' },
        retryConfig: { maxRetries: 5 },
        proxy: { host: 'proxy.example.com' },
        connection: { keepAlive: true },
        tls: { minVersion: 'TLSv1.2' },
        irrelevant: 'value'
      };
      
      const result = configManager.createHttpClientConfig();
      
      expect(result).toEqual({
        baseUrl: 'https://api.example.com',
        timeout: 60000,
        headers: { 'X-Custom': 'Value' },
        retryConfig: { maxRetries: 5 },
        proxy: { host: 'proxy.example.com' },
        connection: { keepAlive: true },
        tls: { minVersion: 'TLSv1.2' }
      });
      expect(result).not.toHaveProperty('irrelevant');
    });
  });
});