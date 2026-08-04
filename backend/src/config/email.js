'use strict';

const env = require('./env');

/**
 * SMTP settings. Email is optional: with no credentials the service disables
 * itself and the app keeps working, because losing a notification must never
 * cost a booking or an enquiry.
 */
module.exports = {
  isConfigured: Boolean(env.EMAIL_USER && env.EMAIL_PASS),

  transport: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASS },
  },

  /** Falls back to the authenticated mailbox when no From address is set. */
  from: env.EMAIL_FROM || (env.EMAIL_USER ? `"${env.APP_NAME}" <${env.EMAIL_USER}>` : ''),

  /** Where contact-form enquiries are delivered. */
  adminRecipient: env.ADMIN_NOTIFY_EMAIL || env.EMAIL_USER || '',

  appName: env.APP_NAME,
};
