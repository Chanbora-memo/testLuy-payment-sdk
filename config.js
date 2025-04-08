// const config = {
//   clientId: process.env.TESTLUY_CLIENT_ID,
//   secretKey: process.env.TESTLUY_SECRET_KEY,
//   baseUrl: process.env.TESTLUY_BASE_URL || "http://localhost:8000/api",
// };

// export const getConfig = (options = {}) => {
//   const clientId = options.clientId || config.clientId;
//   const secretKey = options.secretKey || config.secretKey;
//   const baseUrl = options.baseUrl || config.baseUrl;

//   if (!clientId || !secretKey) {
//     console.warn(
//       "Warning: Client ID or Secret Key is missing. Ensure TESTLUY_CLIENT_ID and TESTLUY_SECRET_KEY environment variables are set."
//     );
//   }

//   return {
//     clientId,
//     secretKey,
//     baseUrl,
//   };
// };

const defaultConfig = { // Only default Base URL here if needed
  baseUrl: process.env.TESTLUY_BASE_URL || "http://localhost:8000/api",
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