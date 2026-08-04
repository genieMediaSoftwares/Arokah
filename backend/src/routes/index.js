'use strict';

const express = require('express');
const { isConnected } = require('../config/database');

const authRoutes = require('./auth.routes');
const eventRoutes = require('./event.routes');
const homeContentRoutes = require('./homeContent.routes');
const siteSettingsRoutes = require('./siteSettings.routes');
const paymentRoutes = require('./payment.routes');
const contactRoutes = require('./contact.routes');
const uploadRoutes = require('./upload.routes');
const adminRoutes = require('./admin.routes');
const { sendSuccess } = require('../utils/apiResponse');

const router = express.Router();

/** Liveness/readiness probe for the host platform. */
router.get('/health', (_req, res) =>
  sendSuccess(res, {
    message: 'API is healthy',
    data: {
      uptime: Math.round(process.uptime()),
      database: isConnected() ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    },
  })
);

router.use('/auth', authRoutes);
router.use('/events', eventRoutes);
router.use('/home-content', homeContentRoutes);
router.use('/site-settings', siteSettingsRoutes);
router.use('/payments', paymentRoutes);
router.use('/contact', contactRoutes);
router.use('/upload', uploadRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
