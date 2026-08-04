'use strict';

/**
 * Domain enumerations.
 *
 * These used to live on the Mongoose schemas and were imported from there by
 * validators and services. With the models gone they need a home that does not
 * depend on the data layer, so the same lists back both the SQL ENUM columns
 * and the request validators.
 */

const ROLES = ['admin', 'staff', 'customer'];
const STAFF_ROLES = ['admin', 'staff'];

const EVENT_STATUSES = ['upcoming', 'live', 'completed', 'cancelled'];
/** Statuses an anonymous visitor is allowed to see. */
const PUBLIC_EVENT_STATUSES = ['upcoming', 'live'];
const EXTRA_CATEGORIES = ['game', 'food', 'music', 'other'];

const BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled', 'refunded', 'failed'];
const PAYMENT_STATUSES = ['created', 'authorized', 'paid', 'failed', 'refunded', 'partially_refunded'];
const PAYMENT_METHODS = ['razorpay', 'free'];

const CONTACT_STATUSES = ['new', 'in_progress', 'closed'];

const STORAGE_DRIVERS = ['local', 's3'];

/** Singleton row keys for the two content tables. */
const HOME_CONTENT_KEY = 'mainContent';
const SITE_SETTINGS_KEY = 'site';

module.exports = {
  ROLES,
  STAFF_ROLES,
  EVENT_STATUSES,
  PUBLIC_EVENT_STATUSES,
  EXTRA_CATEGORIES,
  BOOKING_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
  CONTACT_STATUSES,
  STORAGE_DRIVERS,
  HOME_CONTENT_KEY,
  SITE_SETTINGS_KEY,
};
