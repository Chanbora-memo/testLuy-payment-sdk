/**
 * TypeScript definitions for TestLuy Payment SDK
 * 
 * This file provides comprehensive TypeScript type definitions
 * for the TestLuy Payment SDK, enabling full type safety and
 * IntelliSense support in TypeScript projects.
 */

// ================================
// CORE SDK TYPES
// ================================

export interface TestluyPaymentSDKOptions {
  /** Your TestLuy application client ID */
  clientId: string;
  
  /** Your TestLuy application secret key (keep confidential) */
  secretKey: string;
  
  /** Base URL for the TestLuy API (without /api suffix) */
  baseUrl?: string;
  
  /** Alternative bypass URL for deployment environments */
  bypassUrl?: string;
  
  /** Enable automatic endpoint selection based on environment */
  enableSmartRouting?: boolean;
  
  /** Retry configuration for failed requests */
  retryConfig?: RetryConfig;
  
  /** Cloudflare bypass configuration */
  cloudflareConfig?: CloudflareConfig;
  
  /** Logging configuration */
  loggingConfig?: LoggingConfig;
  
  /** HTTP client configuration */
  httpConfig?: HttpConfig;
}

export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  
  /** Initial delay in milliseconds before first retry */
  baseDelay?: number;
  
  /** Maximum delay in milliseconds between retries */
  maxDelay?: number;
  
  /** Factor by which to increase delay on each retry */
  backoffFactor?: number;
  
  /** Random jitter factor to add to delay (0-1) */
  jitterFactor?: number;
}

export interface CloudflareConfig {
  /** Whether to enable Cloudflare resilience */
  enabled?: boolean;
  
  /** Whether to rotate User-Agent headers */
  rotateUserAgent?: boolean;
  
  /** Whether to add browser-like headers */
  addBrowserHeaders?: boolean;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
export type LogFormat = 'text' | 'json';

export interface LoggingConfig {
  /** Log level */
  level?: LogLevel;
  
  /** Whether to include HTTP headers in logs */
  includeHeaders?: boolean;
  
  /** Whether to include request/response bodies in logs */
  includeBody?: boolean;
  
  /** Whether to mask sensitive data in logs */
  maskSensitive?: boolean;
  
  /** Log format */
  format?: LogFormat;
  
  /** Whether to colorize console output */
  colorize?: boolean;
}

export interface HttpConfig {
  /** Request timeout in milliseconds */
  timeout?: number;
  
  /** Whether to keep connections alive */
  keepAlive?: boolean;
  
  /** Maximum number of redirects to follow */
  maxRedirects?: number;
}

// ================================
// API RESPONSE TYPES
// ================================

export interface PaymentInitiationResult {
  /** URL to redirect user to for payment */
  paymentUrl: string;
  
  /** Unique transaction identifier */
  transactionId: string;
}

export interface PaymentStatus {
  /** Transaction ID */
  id: string;
  
  /** Transaction ID (same as id) */
  transaction_id: string;
  
  /** Payment amount */
  amount: number;
  
  /** Current status of the payment */
  status: PaymentStatusValue;
  
  /** Callback URL */
  callback_url: string;
  
  /** Back URL */
  back_url?: string;
  
  /** Application ID */
  application_id: number;
  
  /** Creation timestamp */
  created_at: string;
  
  /** Last update timestamp */
  updated_at: string;
}

export type PaymentStatusValue = 'Initiated' | 'Pending' | 'Success' | 'Failed';

export interface CallbackVerificationResult {
  /** Transaction ID */
  transactionId: string;
  
  /** Payment status */
  status: PaymentStatusValue;
  
  /** Full payment details */
  paymentDetails: PaymentStatus;
}

export interface CallbackData {
  /** Transaction ID from callback */
  transaction_id?: string;
  
  /** Alternative transaction ID field */
  transactionId?: string;
  
  /** Payment status from callback */
  status?: string;
  
  /** Payment amount */
  amount?: string | number;
  
  /** Any additional callback parameters */
  [key: string]: any;
}

// ================================
// ERROR TYPES
// ================================

export class SDKError extends Error {
  constructor(
    message: string,
    public requestId?: string,
    public statusCode?: number,
    public details?: any
  );
}

export class RateLimitError extends SDKError {
  constructor(
    message: string,
    public retryAfter?: number,
    public subscription?: string,
    public limit?: number,
    public upgradeInfo?: UpgradeInfo
  );
}

export class CloudflareError extends SDKError {
  constructor(
    message: string,
    public challengeType?: string,
    public rayId?: string
  );
}

export class NetworkError extends SDKError {
  constructor(
    message: string,
    public code?: string,
    public timeout?: number,
    public retryCount?: number
  );
}

export class ValidationError extends SDKError {
  constructor(
    message: string,
    public validationDetails?: ValidationDetail[]
  );
}

export interface UpgradeInfo {
  /** Current subscription plan */
  currentPlan: string;
  
  /** Available upgrade options */
  upgradePlans: UpgradePlan[];
  
  /** Upgrade URL */
  upgradeUrl?: string;
}

export interface UpgradePlan {
  /** Plan name */
  name: string;
  
  /** Rate limit for this plan */
  rateLimit: number;
  
  /** Plan price */
  price?: number;
  
  /** Plan features */
  features?: string[];
}

export interface ValidationDetail {
  /** Field that failed validation */
  field: string;
  
  /** Error message */
  message: string;
  
  /** Provided value */
  value?: any;
}

// ================================
// ENVIRONMENT DETECTION TYPES
// ================================

export type Environment = 'node' | 'browser';
export type Platform = 
  | 'local' 
  | 'vercel' 
  | 'netlify' 
  | 'render' 
  | 'heroku' 
  | 'railway' 
  | 'fly' 
  | 'cloudflare-pages' 
  | 'aws-lambda' 
  | 'server'
  | 'unknown';

export interface EnvironmentInfo {
  /** Runtime environment */
  environment: Environment;
  
  /** Whether this is a deployment environment */
  isDeployment: boolean;
  
  /** Detected platform */
  platform: Platform;
  
  /** Whether running on server side */
  isServer: boolean;
  
  /** Node.js information (if applicable) */
  node?: {
    version: string;
    platform: string;
    arch: string;
  };
  
  /** Browser information (if applicable) */
  browser?: {
    userAgent: string;
    vendor?: string;
  };
}

// ================================
// MAIN SDK CLASS
// ================================

export default class TestluyPaymentSDK {
  constructor(options: TestluyPaymentSDKOptions);
  
  /** Client ID */
  readonly clientId: string;
  
  /** Whether credentials have been validated */
  readonly isValidated: boolean;
  
  /** Current base URL being used */
  readonly currentBaseUrl: string;
  
  /** Environment information */
  readonly environmentInfo?: EnvironmentInfo;
  
  /**
   * Validates credentials and initializes the SDK
   * @returns Promise that resolves to true if credentials are valid
   * @throws {SDKError} If validation fails
   */
  init(): Promise<boolean>;
  
  /**
   * Initiates a payment process
   * @param amount Payment amount (must be positive)
   * @param callbackUrl URL for payment completion callback
   * @param backUrl Optional URL for user cancellation/back navigation
   * @returns Promise with payment URL and transaction ID
   * @throws {ValidationError} If parameters are invalid
   * @throws {RateLimitError} If rate limit is exceeded
   * @throws {NetworkError} If network request fails
   * @throws {SDKError} For other API errors
   */
  initiatePayment(
    amount: number,
    callbackUrl: string,
    backUrl?: string
  ): Promise<PaymentInitiationResult>;
  
  /**
   * Retrieves the current status of a payment transaction
   * @param transactionId Transaction ID from initiatePayment
   * @returns Promise with payment status details
   * @throws {ValidationError} If transaction ID is invalid
   * @throws {SDKError} If transaction not found or API error
   */
  getPaymentStatus(transactionId: string): Promise<PaymentStatus>;
  
  /**
   * Processes the data received at the merchant's callback URL after a payment attempt.
   * It verifies the status by calling `getPaymentStatus`.
   * @param callbackData Callback data received from TestLuy (should contain transaction_id)
   * @returns Promise with verified payment information
   * @throws {ValidationError} If callback data is invalid
   * @throws {SDKError} If verification fails
   */
  handlePaymentCallback(callbackData: CallbackData): Promise<CallbackVerificationResult>;
  
  /**
   * Generates only the payment URL for redirecting the user to the sandbox.
   * @deprecated Use initiatePayment instead for more complete functionality
   * @param amount Payment amount (must be positive)
   * @param callbackUrl URL for payment completion callback
   * @returns Promise with payment URL only
   * @throws {ValidationError} If parameters are invalid
   * @throws {SDKError} For API errors
   */
  generatePaymentUrl(amount: number, callbackUrl: string): Promise<string>;
  
  /**
   * Manually validates credentials
   * @returns Promise that resolves to true if credentials are valid
   * @throws {SDKError} If validation fails
   */
  validateCredentials(): Promise<boolean>;
}

// ================================
// UTILITY TYPES
// ================================

export interface RequestOptions {
  /** Request timeout in milliseconds */
  timeout?: number;
  
  /** Custom headers */
  headers?: Record<string, string>;
  
  /** Whether to retry on failure */
  retry?: boolean;
  
  /** Maximum number of retries */
  maxRetries?: number;
}

export interface ApiResponse<T = any> {
  /** Response data */
  data: T;
  
  /** HTTP status code */
  status: number;
  
  /** Response headers */
  headers: Record<string, string>;
  
  /** Request ID */
  requestId?: string;
}

// ================================
// FRAMEWORK-SPECIFIC TYPES
// ================================

// Next.js types
export interface NextJSApiRequest {
  method: string;
  body: any;
  query: Record<string, string | string[]>;
  headers: Record<string, string>;
}

export interface NextJSApiResponse {
  status(code: number): NextJSApiResponse;
  json(obj: any): void;
  redirect(url: string): void;
  end(): void;
}

// Express types
export interface ExpressRequest {
  method: string;
  body: any;
  query: Record<string, any>;
  params: Record<string, string>;
  headers: Record<string, string>;
}

export interface ExpressResponse {
  status(code: number): ExpressResponse;
  json(obj: any): ExpressResponse;
  redirect(url: string): void;
  send(data: any): void;
}

// ================================
// MODULE EXPORTS
// ================================

export {
  TestluyPaymentSDK,
  SDKError,
  RateLimitError,
  CloudflareError,
  NetworkError,
  ValidationError
};

// Default export
export default TestluyPaymentSDK;
