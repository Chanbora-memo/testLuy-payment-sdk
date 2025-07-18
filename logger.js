/**
 * Logger utility for TestLuy Payment SDK
 * This is a compatibility wrapper around the enhanced Logger implementation
 */

import defaultLogger from './http/Logger.js';

// Re-export the default logger instance
export const logger = {
  log: (...args) => defaultLogger.info(...args),
  warn: (...args) => defaultLogger.warn(...args),
  error: (...args) => defaultLogger.error(...args),
  info: (...args) => defaultLogger.info(...args),
  debug: (...args) => defaultLogger.debug(...args),
};

// Configure the logger based on NODE_ENV
if (typeof process !== 'undefined' && process.env) {
  const isDevelopment = process.env.NODE_ENV !== "production";
  
  // In production, only show warnings and errors by default
  if (!isDevelopment) {
    defaultLogger.updateConfig({
      level: 'warn',
      includeTimestamp: true,
      maskSensitive: true
    });
  } else {
    // In development, show all logs
    defaultLogger.updateConfig({
      level: 'debug',
      includeTimestamp: true,
      colorize: true
    });
  }
}

export default logger;