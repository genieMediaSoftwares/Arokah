'use strict';

const path = require('path');
const winston = require('winston');
const env = require('./env');

/**
 * Structured logging. This is the only sanctioned way to emit runtime output —
 * `console.*` is not used anywhere in the application code, so log level and
 * destination stay controllable from configuration.
 */

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const devFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} ${level}: ${stack || message}${extra}`;
});

const transports = [
  new winston.transports.Console({
    format: env.isProduction
      ? combine(timestamp(), errors({ stack: true }), json())
      : combine(colorize(), timestamp({ format: 'HH:mm:ss' }), errors({ stack: true }), devFormat),
  }),
];

if (env.isProduction) {
  const logDir = path.resolve(__dirname, '../../logs');
  const fileFormat = combine(timestamp(), errors({ stack: true }), json());

  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: env.LOG_MAX_SIZE_BYTES,
      maxFiles: env.LOG_MAX_FILES,
      format: fileFormat,
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: env.LOG_MAX_SIZE_BYTES,
      maxFiles: env.LOG_MAX_FILES,
      format: fileFormat,
    })
  );
}

const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  transports,
  exitOnError: false,
});

/** Adapter for morgan's stream interface. */
logger.stream = {
  write: (message) => logger.info(message.trim()),
};

module.exports = logger;
