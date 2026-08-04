'use strict';

/**
 * Configuration barrel.
 *
 *   const { payment, upload } = require('../config');
 *
 * Every module takes its settings from here or from one of these files
 * directly; nothing outside `config/env.js` reads `process.env`.
 */
module.exports = {
  env: require('./env'),
  logger: require('./logger'),
  database: require('./database'),
  jwt: require('./jwt'),
  cors: require('./cors'),
  email: require('./email'),
  payment: require('./payment'),
  upload: require('./upload'),
  server: require('./server'),
};
