'use strict';

const mongoose = require('mongoose');

/**
 * Site-wide branding and contact details, editable from the admin panel.
 *
 * These are business content, not deployment configuration: the phone number
 * changes when the company changes phone number, not when the app is deployed
 * somewhere else. That is why they live in MongoDB rather than in .env — an
 * admin can edit them without a rebuild, and the frontend bundle carries no
 * copy of them.
 *
 * Singleton: one document, keyed 'site'.
 */
const SINGLETON_KEY = 'site';

const socialLinkSchema = new mongoose.Schema(
  {
    platform: { type: String, trim: true, required: true, maxlength: 40 },
    url: { type: String, trim: true, required: true, maxlength: 500 },
  },
  { _id: false }
);

/** A titled tile with an optional emoji icon — used by the About page grids. */
const contentCardSchema = new mongoose.Schema(
  {
    icon: { type: String, trim: true, default: '', maxlength: 8 },
    title: { type: String, trim: true, required: true, maxlength: 120 },
    description: { type: String, trim: true, default: '', maxlength: 500 },
  },
  { _id: false }
);

const siteSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: SINGLETON_KEY, unique: true, immutable: true },

    // ── Brand ────────────────────────────────────────────────────────────────
    companyName: { type: String, trim: true, default: '', maxlength: 120 },
    tagline: { type: String, trim: true, default: '', maxlength: 300 },
    logo: { type: String, trim: true, default: '' },
    favicon: { type: String, trim: true, default: '' },

    // ── Contact ──────────────────────────────────────────────────────────────
    contact: {
      phone: { type: String, trim: true, default: '', maxlength: 30 },
      // Digits only, international format, e.g. 919876543210 — used to build
      // the wa.me link.
      whatsappNumber: { type: String, trim: true, default: '', maxlength: 20 },
      whatsappMessage: { type: String, trim: true, default: '', maxlength: 500 },
      email: { type: String, trim: true, lowercase: true, default: '', maxlength: 200 },
      address: { type: String, trim: true, default: '', maxlength: 500 },
    },

    socialLinks: { type: [socialLinkSchema], default: [] },

    // ── Footer ───────────────────────────────────────────────────────────────
    footer: {
      description: { type: String, trim: true, default: '', maxlength: 1000 },
      copyrightText: { type: String, trim: true, default: '', maxlength: 300 },
    },

    // ── About page ───────────────────────────────────────────────────────────
    about: {
      heading: { type: String, trim: true, default: '', maxlength: 200 },
      subheading: { type: String, trim: true, default: '', maxlength: 500 },
      body: { type: String, trim: true, default: '', maxlength: 10000 },
      image: { type: String, trim: true, default: '' },
      /** "What We Do" tiles. */
      services: { type: [contentCardSchema], default: [] },
      /** "Why Choose Us" tiles. */
      features: { type: [contentCardSchema], default: [] },
    },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

siteSettingsSchema.set('toJSON', {
  versionKey: false,
  transform(_doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.key;
    return ret;
  },
});

module.exports = mongoose.model('SiteSettings', siteSettingsSchema);
module.exports.SINGLETON_KEY = SINGLETON_KEY;
