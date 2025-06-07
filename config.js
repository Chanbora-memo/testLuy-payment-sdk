const defaultConfig = {
  // Only default Base URL here if needed
  baseUrl: process.env.TESTLUY_BASE_URL || "https://testluy.tech",
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
