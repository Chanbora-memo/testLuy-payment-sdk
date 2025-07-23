const defaultConfig = {
  // Default to api-testluy.paragoniu.app as the standard base URL
  baseUrl: process.env.TESTLUY_BASE_URL || "https://api-testluy.paragoniu.app",
};

export const getConfig = (options = {}) => {
  const clientId = options.clientId; // Get from options, no default from process.env in config
  const secretKey = options.secretKey; // Get from options, no default from process.env in config
  const baseUrl = options.baseUrl || defaultConfig.baseUrl;

  return {
    clientId,
    secretKey,
    baseUrl,
  };
};
