'use strict';

const app = require('./app');
const serverConfig = require('./config/server');
const { allowedOrigins } = require('./config/cors');
const logger = require('./config/logger');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const { initStorage } = require('./services/storage');
const razorpay = require('./services/razorpay.client');

let server = null;

async function start() {
  await connectDatabase();
  await initStorage();

  if (!razorpay.isConfigured()) {
    logger.warn('Razorpay credentials are not set — paid bookings will be rejected');
  }

  server = app.listen(serverConfig.port, serverConfig.host, () => {
    logger.info(`${serverConfig.appName} API listening on port ${serverConfig.port} (${serverConfig.nodeEnv})`);
    logger.info(`Allowed origins: ${allowedOrigins.join(', ')}`);
  });
}

/** Drains in-flight requests before exiting so deploys don't drop responses. */
async function shutdown(signal) {
  logger.info(`${signal} received — shutting down`);

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, serverConfig.shutdownTimeoutMs);
  forceExit.unref();

  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    await disconnectDatabase();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown', { error: err.message });
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: reason?.message || String(reason) });
});

process.on('uncaughtException', (err) => {
  // The process is in an unknown state after this; log and let the platform restart it.
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

start().catch((err) => {
  logger.error('Failed to start the server', { error: err.message, stack: err.stack });
  process.exit(1);
});
