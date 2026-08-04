'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const serverConfig = require('./config/server');
const uploadConfig = require('./config/upload');
const { cookie } = require('./config/jwt');
const { corsOptions } = require('./config/cors');
const logger = require('./config/logger');
const routes = require('./routes');
const sanitizeRequest = require('./middleware/sanitize');
const { apiLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/error');
const paymentController = require('./controllers/payment.controller');

const app = express();

// Behind a load balancer, trust the proxy so req.ip and rate limiting see the
// real client address rather than the balancer's.
app.set('trust proxy', serverConfig.trustProxy);
app.disable('x-powered-by');

app.use(
  helmet({
    // The API serves JSON and uploaded images, never HTML pages, so the default
    // CSP is irrelevant here — the frontend host sets its own.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // uploads load from the frontend origin
  })
);

app.use(cors(corsOptions));
app.use(compression());

/**
 * The Razorpay webhook is mounted BEFORE express.json() because its signature is
 * computed over the exact request bytes. Parsing and re-serialising the body
 * would change it and every verification would fail.
 */
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json', limit: serverConfig.bodyLimit }),
  paymentController.handleWebhook
);

app.use(express.json({ limit: serverConfig.bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: serverConfig.bodyLimit }));
app.use(cookieParser(cookie.secret));
app.use(sanitizeRequest);

app.use(
  morgan(serverConfig.isProduction ? 'combined' : 'dev', {
    stream: logger.stream,
    skip: (req) => req.path === '/api/health',
  })
);

// Uploaded files. Long caching is safe because storage keys carry a random
// suffix — a given URL never changes what it points at.
app.use(
  '/uploads',
  express.static(uploadConfig.directory, {
    maxAge: uploadConfig.cacheMaxAge,
    immutable: true,
    index: false,
    dotfiles: 'deny',
    setHeaders(res) {
      // Uploads are user-supplied: never let a browser render one as HTML.
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', 'inline');
    },
  })
);

app.use('/api', apiLimiter, routes);

app.get('/', (_req, res) =>
  res.json({
    success: true,
    message: `${serverConfig.appName} API`,
    version: serverConfig.appVersion,
    docs: '/api/health',
  })
);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
