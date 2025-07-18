/**
 * Test file for demonstrating the configurable logger functionality
 */

import logger, { LogLevel } from './http/Logger.js';
import TestluyPaymentSDK from './index-enhanced.js';

// Test different log levels
console.log('\n--- Testing different log levels ---');

// Default level is 'warn'
console.log('\nDefault logger (warn level):');
logger.debug('This debug message should NOT appear');
logger.info('This info message should NOT appear');
logger.warn('This warning message should appear');
logger.error('This error message should appear');

// Change log level to debug
console.log('\nChanging log level to debug:');
logger.updateConfig({ level: 'debug' });
logger.debug('This debug message should now appear');
logger.info('This info message should now appear');
logger.warn('This warning message should appear');
logger.error('This error message should appear');

// Test sensitive data masking
console.log('\n--- Testing sensitive data masking ---');
const sensitiveData = {
  username: 'testuser',
  password: 'secret123',
  apiKey: '1234567890abcdef',
  data: {
    creditCard: '4111111111111111',
    cvv: '123'
  }
};

logger.debug('User data:', sensitiveData);

// Test different log formats
console.log('\n--- Testing different log formats ---');

// Text format (default)
console.log('\nText format:');
logger.updateConfig({ format: 'text' });
logger.info('This is a text format log message', { user: 'testuser', action: 'login' });

// JSON format
console.log('\nJSON format:');
logger.updateConfig({ format: 'json' });
logger.info('This is a JSON format log message', { user: 'testuser', action: 'login' });

// Test SDK integration with logger
console.log('\n--- Testing SDK integration with logger ---');

// Initialize SDK with custom logging configuration
const sdk = new TestluyPaymentSDK({
  clientId: 'test-client-id',
  secretKey: 'test-secret-key',
  baseUrl: 'https://api-testluy.paragoniu.app',
  loggingConfig: {
    level: 'debug',
    includeHeaders: true,
    includeBody: false,
    maskSensitive: true,
    format: 'text',
    colorize: true
  }
});

console.log('\nSDK initialized with custom logging configuration');

// Create a child logger for a specific component
console.log('\n--- Testing child loggers ---');
const paymentLogger = logger.createChild({ level: 'info' }, 'PaymentProcessor');
paymentLogger.debug('This debug message should NOT appear');
paymentLogger.info('This info message should appear with PaymentProcessor prefix');

// Test environment-based configuration
console.log('\n--- Testing environment-based configuration ---');
const envLogger = logger.constructor.fromEnvironment({
  level: 'info',
  format: 'text'
});
envLogger.info('This is a logger configured from environment variables');

console.log('\nLogger testing complete!');