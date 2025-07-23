/**
 * DeploymentEnvironmentDetector - Detects deployment platforms and provides platform-specific configurations
 * 
 * This module helps the SDK adapt its behavior based on deployment environments like:
 * - Vercel
 * - Netlify
 * - AWS Lambda
 * - Cloudflare Workers
 * - Local development
 * - Other serverless platforms
 */

/**
 * Deployment platform types
 * @enum {string}
 */
export const DeploymentPlatform = {
  VERCEL: 'vercel',
  NETLIFY: 'netlify',
  AWS_LAMBDA: 'aws-lambda',
  CLOUDFLARE_WORKERS: 'cloudflare-workers',
  HEROKU: 'heroku',
  RAILWAY: 'railway',
  RENDER: 'render',
  DIGITAL_OCEAN: 'digital-ocean',
  LOCAL: 'local',
  UNKNOWN: 'unknown'
};

/**
 * Environment types for deployment context
 * @enum {string}
 */
export const DeploymentEnvironment = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
  PREVIEW: 'preview',
  LOCAL: 'local'
};

/**
 * Detects the current deployment platform
 * @returns {DeploymentPlatform} The detected deployment platform
 */
export function detectDeploymentPlatform() {
  // Check for Node.js environment variables first
  if (typeof process !== 'undefined' && process.env) {
    const env = process.env;
    
    // Vercel detection
    if (env.VERCEL || env.VERCEL_ENV || env.VERCEL_URL) {
      return DeploymentPlatform.VERCEL;
    }
    
    // Netlify detection
    if (env.NETLIFY || env.NETLIFY_BUILD_BASE || env.DEPLOY_URL) {
      return DeploymentPlatform.NETLIFY;
    }
    
    // AWS Lambda detection
    if (env.AWS_LAMBDA_FUNCTION_NAME || env.AWS_EXECUTION_ENV || env.LAMBDA_RUNTIME_DIR) {
      return DeploymentPlatform.AWS_LAMBDA;
    }
    
    // Heroku detection
    if (env.DYNO || env.HEROKU_APP_NAME || env.HEROKU_SLUG_COMMIT) {
      return DeploymentPlatform.HEROKU;
    }
    
    // Railway detection
    if (env.RAILWAY_ENVIRONMENT || env.RAILWAY_PROJECT_ID) {
      return DeploymentPlatform.RAILWAY;
    }
    
    // Render detection
    if (env.RENDER || env.RENDER_SERVICE_ID || env.RENDER_EXTERNAL_URL) {
      return DeploymentPlatform.RENDER;
    }
    
    // Digital Ocean App Platform detection
    if (env.DIGITALOCEAN_APP_ID || env.APP_URL) {
      return DeploymentPlatform.DIGITAL_OCEAN;
    }
  }
  
  // Check for Cloudflare Workers (different global context)
  if (typeof globalThis !== 'undefined' && 
      (globalThis.CloudflareWorkersGlobalScope || 
       (typeof caches !== 'undefined' && typeof addEventListener !== 'undefined'))) {
    return DeploymentPlatform.CLOUDFLARE_WORKERS;
  }
  
  // Check for browser context with deployment indicators
  if (typeof window !== 'undefined') {
    const hostname = window.location?.hostname;
    
    if (hostname) {
      // Vercel domains
      if (hostname.includes('.vercel.app') || hostname.includes('.now.sh')) {
        return DeploymentPlatform.VERCEL;
      }
      
      // Netlify domains
      if (hostname.includes('.netlify.app') || hostname.includes('.netlify.com')) {
        return DeploymentPlatform.NETLIFY;
      }
      
      // Heroku domains
      if (hostname.includes('.herokuapp.com')) {
        return DeploymentPlatform.HEROKU;
      }
      
      // Railway domains
      if (hostname.includes('.railway.app')) {
        return DeploymentPlatform.RAILWAY;
      }
      
      // Render domains
      if (hostname.includes('.onrender.com')) {
        return DeploymentPlatform.RENDER;
      }
      
      // Local development
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
        return DeploymentPlatform.LOCAL;
      }
    }
  }
  
  // Check for local development in Node.js
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.NODE_ENV === 'development' || 
        process.env.NODE_ENV === 'dev' ||
        !process.env.NODE_ENV) {
      return DeploymentPlatform.LOCAL;
    }
  }
  
  return DeploymentPlatform.UNKNOWN;
}

/**
 * Detects the deployment environment (dev, staging, prod, etc.)
 * @returns {DeploymentEnvironment} The detected deployment environment
 */
export function detectDeploymentEnvironment() {
  const platform = detectDeploymentPlatform();
  
  // Local development
  if (platform === DeploymentPlatform.LOCAL) {
    return DeploymentEnvironment.LOCAL;
  }
  
  // Check environment variables
  if (typeof process !== 'undefined' && process.env) {
    const env = process.env;
    
    // Standard NODE_ENV
    if (env.NODE_ENV === 'production' || env.NODE_ENV === 'prod') {
      return DeploymentEnvironment.PRODUCTION;
    }
    if (env.NODE_ENV === 'staging' || env.NODE_ENV === 'stage') {
      return DeploymentEnvironment.STAGING;
    }
    if (env.NODE_ENV === 'development' || env.NODE_ENV === 'dev') {
      return DeploymentEnvironment.DEVELOPMENT;
    }
    
    // Platform-specific environment detection
    switch (platform) {
      case DeploymentPlatform.VERCEL:
        if (env.VERCEL_ENV === 'production') return DeploymentEnvironment.PRODUCTION;
        if (env.VERCEL_ENV === 'preview') return DeploymentEnvironment.PREVIEW;
        if (env.VERCEL_ENV === 'development') return DeploymentEnvironment.DEVELOPMENT;
        break;
        
      case DeploymentPlatform.NETLIFY:
        if (env.CONTEXT === 'production') return DeploymentEnvironment.PRODUCTION;
        if (env.CONTEXT === 'deploy-preview') return DeploymentEnvironment.PREVIEW;
        if (env.CONTEXT === 'branch-deploy') return DeploymentEnvironment.STAGING;
        break;
        
      case DeploymentPlatform.HEROKU:
        // Heroku doesn't have built-in staging, but check common patterns
        if (env.HEROKU_APP_NAME && env.HEROKU_APP_NAME.includes('prod')) {
          return DeploymentEnvironment.PRODUCTION;
        }
        if (env.HEROKU_APP_NAME && env.HEROKU_APP_NAME.includes('staging')) {
          return DeploymentEnvironment.STAGING;
        }
        break;
    }
  }
  
  // Browser-based detection
  if (typeof window !== 'undefined') {
    const hostname = window.location?.hostname;
    
    if (hostname) {
      // Common production patterns
      if (!hostname.includes('staging') && 
          !hostname.includes('dev') && 
          !hostname.includes('test') &&
          !hostname.includes('preview')) {
        return DeploymentEnvironment.PRODUCTION;
      }
      
      // Staging patterns
      if (hostname.includes('staging') || hostname.includes('stage')) {
        return DeploymentEnvironment.STAGING;
      }
      
      // Development patterns
      if (hostname.includes('dev') || hostname.includes('development')) {
        return DeploymentEnvironment.DEVELOPMENT;
      }
      
      // Preview patterns
      if (hostname.includes('preview') || hostname.includes('pr-')) {
        return DeploymentEnvironment.PREVIEW;
      }
    }
  }
  
  // Default to production for unknown deployment environments
  return DeploymentEnvironment.PRODUCTION;
}

/**
 * Gets platform-specific URL construction adjustments
 * @param {DeploymentPlatform} platform - The deployment platform
 * @returns {Object} Platform-specific URL configuration
 */
export function getPlatformUrlConfig(platform = null) {
  const detectedPlatform = platform || detectDeploymentPlatform();
  
  const baseConfig = {
    platform: detectedPlatform,
    requiresAbsoluteUrls: false,
    urlValidationStrict: true,
    corsHandling: 'standard',
    headerAdjustments: {},
    timeoutAdjustments: {}
  };
  
  switch (detectedPlatform) {
    case DeploymentPlatform.VERCEL:
      return {
        ...baseConfig,
        requiresAbsoluteUrls: true,
        urlValidationStrict: false, // Vercel can handle various URL formats
        corsHandling: 'permissive',
        headerAdjustments: {
          'User-Agent': 'TestluySDK/1.0 (Vercel)',
          'X-Deployment-Platform': 'vercel'
        },
        timeoutAdjustments: {
          default: 25000, // Vercel has 30s timeout for serverless functions
          maximum: 25000
        },
        urlPatterns: {
          functionUrls: /\.vercel\.app$/,
          previewUrls: /.*-.*\.vercel\.app$/
        }
      };
      
    case DeploymentPlatform.NETLIFY:
      return {
        ...baseConfig,
        requiresAbsoluteUrls: true,
        urlValidationStrict: false,
        corsHandling: 'permissive',
        headerAdjustments: {
          'User-Agent': 'TestluySDK/1.0 (Netlify)',
          'X-Deployment-Platform': 'netlify'
        },
        timeoutAdjustments: {
          default: 25000, // Netlify functions have 26s timeout
          maximum: 25000
        },
        urlPatterns: {
          functionUrls: /\.netlify\.app$/,
          previewUrls: /.*--.*\.netlify\.app$/
        }
      };
      
    case DeploymentPlatform.AWS_LAMBDA:
      return {
        ...baseConfig,
        requiresAbsoluteUrls: true,
        urlValidationStrict: true,
        corsHandling: 'strict',
        headerAdjustments: {
          'User-Agent': 'TestluySDK/1.0 (AWS-Lambda)',
          'X-Deployment-Platform': 'aws-lambda'
        },
        timeoutAdjustments: {
          default: 25000, // AWS Lambda timeout varies, be conservative
          maximum: 25000
        }
      };
      
    case DeploymentPlatform.CLOUDFLARE_WORKERS:
      return {
        ...baseConfig,
        requiresAbsoluteUrls: true,
        urlValidationStrict: false,
        corsHandling: 'permissive',
        headerAdjustments: {
          'User-Agent': 'TestluySDK/1.0 (Cloudflare-Workers)',
          'X-Deployment-Platform': 'cloudflare-workers'
        },
        timeoutAdjustments: {
          default: 10000, // Cloudflare Workers have shorter timeouts
          maximum: 10000
        }
      };
      
    case DeploymentPlatform.HEROKU:
      return {
        ...baseConfig,
        requiresAbsoluteUrls: false,
        urlValidationStrict: true,
        corsHandling: 'standard',
        headerAdjustments: {
          'User-Agent': 'TestluySDK/1.0 (Heroku)',
          'X-Deployment-Platform': 'heroku'
        },
        timeoutAdjustments: {
          default: 25000,
          maximum: 25000
        }
      };
      
    case DeploymentPlatform.LOCAL:
      return {
        ...baseConfig,
        requiresAbsoluteUrls: false,
        urlValidationStrict: false, // More lenient for local development
        corsHandling: 'permissive',
        headerAdjustments: {
          'User-Agent': 'TestluySDK/1.0 (Local-Development)',
          'X-Deployment-Platform': 'local'
        },
        timeoutAdjustments: {
          default: 30000, // Longer timeout for local development
          maximum: 60000
        }
      };
      
    default:
      return {
        ...baseConfig,
        headerAdjustments: {
          'User-Agent': 'TestluySDK/1.0',
          'X-Deployment-Platform': 'unknown'
        }
      };
  }
}

/**
 * Gets deployment-specific error context for enhanced error messages
 * @param {Error} error - The error that occurred
 * @param {Object} requestContext - Additional request context
 * @returns {Object} Enhanced error context with deployment information
 */
export function getDeploymentErrorContext(error, requestContext = {}) {
  const platform = detectDeploymentPlatform();
  const environment = detectDeploymentEnvironment();
  const platformConfig = getPlatformUrlConfig(platform);
  
  const context = {
    deployment: {
      platform,
      environment,
      isLocal: platform === DeploymentPlatform.LOCAL,
      isServerless: [
        DeploymentPlatform.VERCEL,
        DeploymentPlatform.NETLIFY,
        DeploymentPlatform.AWS_LAMBDA,
        DeploymentPlatform.CLOUDFLARE_WORKERS
      ].includes(platform)
    },
    platformConfig,
    timestamp: new Date().toISOString()
  };
  
  // Add platform-specific debugging information
  if (typeof process !== 'undefined' && process.env) {
    context.environmentVariables = {
      NODE_ENV: process.env.NODE_ENV,
      // Platform-specific variables (sanitized)
      ...(platform === DeploymentPlatform.VERCEL && {
        VERCEL_ENV: process.env.VERCEL_ENV,
        VERCEL_REGION: process.env.VERCEL_REGION
      }),
      ...(platform === DeploymentPlatform.NETLIFY && {
        CONTEXT: process.env.CONTEXT,
        BRANCH: process.env.BRANCH
      })
    };
  }
  
  // Add browser context if available
  if (typeof window !== 'undefined') {
    context.browser = {
      hostname: window.location?.hostname,
      protocol: window.location?.protocol,
      port: window.location?.port,
      userAgent: navigator?.userAgent
    };
  }
  
  // Add error-specific guidance based on platform
  if (error && error.message) {
    context.platformGuidance = getPlatformSpecificErrorGuidance(error, platform);
  }
  
  return context;
}

/**
 * Gets platform-specific error guidance
 * @param {Error} error - The error that occurred
 * @param {DeploymentPlatform} platform - The deployment platform
 * @returns {Object} Platform-specific error guidance
 */
function getPlatformSpecificErrorGuidance(error, platform) {
  const guidance = {
    platform,
    commonIssues: [],
    recommendedActions: [],
    documentationLinks: []
  };
  
  const errorMessage = error.message.toLowerCase();
  
  // URL construction errors
  if (errorMessage.includes('invalid url') || errorMessage.includes('url construction')) {
    switch (platform) {
      case DeploymentPlatform.VERCEL:
        guidance.commonIssues.push(
          'Vercel serverless functions may handle URL construction differently than local development',
          'Environment variables might not be properly configured in Vercel dashboard'
        );
        guidance.recommendedActions.push(
          'Check baseUrl configuration in Vercel environment variables',
          'Verify that TESTLUY_BASE_URL is set in Vercel project settings',
          'Test URL construction in Vercel function logs'
        );
        guidance.documentationLinks.push('https://vercel.com/docs/concepts/projects/environment-variables');
        break;
        
      case DeploymentPlatform.NETLIFY:
        guidance.commonIssues.push(
          'Netlify Functions may have different URL handling than local development',
          'Build process might transform environment variables'
        );
        guidance.recommendedActions.push(
          'Check baseUrl configuration in Netlify site settings',
          'Verify environment variables in Netlify dashboard',
          'Review Netlify function logs for URL construction details'
        );
        guidance.documentationLinks.push('https://docs.netlify.com/configure-builds/environment-variables/');
        break;
        
      case DeploymentPlatform.AWS_LAMBDA:
        guidance.commonIssues.push(
          'AWS Lambda cold starts may affect URL construction timing',
          'Lambda environment variables might differ from local setup'
        );
        guidance.recommendedActions.push(
          'Check Lambda environment variables in AWS Console',
          'Review CloudWatch logs for detailed error information',
          'Verify API Gateway configuration if applicable'
        );
        break;
        
      case DeploymentPlatform.CLOUDFLARE_WORKERS:
        guidance.commonIssues.push(
          'Cloudflare Workers have limited Node.js API compatibility',
          'URL construction may behave differently in Workers runtime'
        );
        guidance.recommendedActions.push(
          'Use Web APIs instead of Node.js APIs where possible',
          'Check Cloudflare Workers logs for detailed errors',
          'Verify environment variables in Workers dashboard'
        );
        break;
        
      case DeploymentPlatform.LOCAL:
        guidance.commonIssues.push(
          'Local environment configuration may differ from production',
          'Missing or incorrect environment variables'
        );
        guidance.recommendedActions.push(
          'Check .env file configuration',
          'Verify TESTLUY_BASE_URL is properly set',
          'Compare local and production environment variables'
        );
        break;
    }
  }
  
  // CORS errors
  if (errorMessage.includes('cors') || errorMessage.includes('cross-origin')) {
    guidance.commonIssues.push('CORS configuration may differ between platforms');
    guidance.recommendedActions.push(
      'Check CORS headers in API responses',
      'Verify allowed origins in API configuration'
    );
  }
  
  // Timeout errors
  if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    switch (platform) {
      case DeploymentPlatform.VERCEL:
      case DeploymentPlatform.NETLIFY:
        guidance.commonIssues.push('Serverless functions have execution time limits');
        guidance.recommendedActions.push('Consider reducing request timeout or optimizing request handling');
        break;
        
      case DeploymentPlatform.CLOUDFLARE_WORKERS:
        guidance.commonIssues.push('Cloudflare Workers have strict CPU time limits');
        guidance.recommendedActions.push('Optimize request processing to reduce execution time');
        break;
    }
  }
  
  return guidance;
}

/**
 * Checks if the current environment is a deployment environment (not local)
 * @returns {boolean} True if running in a deployment environment
 */
export function isDeploymentEnvironment() {
  const platform = detectDeploymentPlatform();
  return platform !== DeploymentPlatform.LOCAL && platform !== DeploymentPlatform.UNKNOWN;
}

/**
 * Gets comprehensive deployment information
 * @returns {Object} Complete deployment environment information
 */
export function getDeploymentInfo() {
  const platform = detectDeploymentPlatform();
  const environment = detectDeploymentEnvironment();
  const platformConfig = getPlatformUrlConfig(platform);
  
  return {
    platform,
    environment,
    isDeployment: isDeploymentEnvironment(),
    isServerless: [
      DeploymentPlatform.VERCEL,
      DeploymentPlatform.NETLIFY,
      DeploymentPlatform.AWS_LAMBDA,
      DeploymentPlatform.CLOUDFLARE_WORKERS
    ].includes(platform),
    platformConfig,
    detectedAt: new Date().toISOString()
  };
}

export default {
  DeploymentPlatform,
  DeploymentEnvironment,
  detectDeploymentPlatform,
  detectDeploymentEnvironment,
  getPlatformUrlConfig,
  getDeploymentErrorContext,
  isDeploymentEnvironment,
  getDeploymentInfo
};