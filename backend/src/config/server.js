'use strict';

const env = require('./env');

/** HTTP server and request-handling settings. */
module.exports = {
  port: env.PORT,
  host: env.HOST,
  nodeEnv: env.NODE_ENV,
  isProduction: env.isProduction,

  appName: env.APP_NAME,
  appVersion: env.APP_VERSION,

  serverUrl: env.SERVER_URL,
  clientUrl: env.CLIENT_URL,

  bodyLimit: env.JSON_BODY_LIMIT,
  // Behind a load balancer, trust this many proxy hops so req.ip and rate
  // limiting see the real client rather than the balancer.
  trustProxy: env.TRUST_PROXY,
  shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS,

  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    authMax: env.AUTH_RATE_LIMIT_MAX,
    refreshMax: env.REFRESH_RATE_LIMIT_MAX,
    publicWriteWindowMs: env.PUBLIC_WRITE_RATE_LIMIT_WINDOW_MS,
    publicWriteMax: env.PUBLIC_WRITE_RATE_LIMIT_MAX,
    paymentWindowMs: env.PAYMENT_RATE_LIMIT_WINDOW_MS,
    paymentMax: env.PAYMENT_RATE_LIMIT_MAX,
  },
};
