'use strict';

const { body } = require('express-validator');
const { imageUrl } = require('./common.validator');

const text = (field, max) =>
  body(field).optional({ values: 'null' }).trim().isLength({ max }).withMessage(`Must be at most ${max} characters`);

/** Rules for an array of `{ icon, title, description }` tiles. */
const contentCardRules = (field) => [
  body(field).optional().isArray({ max: 24 }).withMessage(`${field} must be an array`),
  // Emoji are multi-byte, so the length cap is generous relative to one glyph.
  body(`${field}.*.icon`).optional({ values: 'null' }).trim().isLength({ max: 8 }),
  body(`${field}.*.title`).trim().notEmpty().withMessage('Each item needs a title').isLength({ max: 120 }),
  body(`${field}.*.description`).optional({ values: 'null' }).trim().isLength({ max: 500 }),
];

const saveSiteSettingsRules = [
  text('companyName', 120),
  text('tagline', 300),
  imageUrl(body('logo')),
  imageUrl(body('favicon')),

  text('contact.phone', 30),
  // Digits only — this is concatenated into a wa.me URL, so anything else would
  // produce a broken or injectable link.
  body('contact.whatsappNumber')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^[0-9]{6,20}$/)
    .withMessage('WhatsApp number must be 6-20 digits, including the country code and no symbols'),
  text('contact.whatsappMessage', 500),
  body('contact.email').optional({ values: 'falsy' }).trim().isEmail().withMessage('Enter a valid email').normalizeEmail(),
  text('contact.address', 500),

  body('socialLinks').optional().isArray({ max: 12 }).withMessage('socialLinks must be an array'),
  body('socialLinks.*.platform').trim().notEmpty().withMessage('Each social link needs a platform').isLength({ max: 40 }),
  body('socialLinks.*.url')
    .trim()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Each social link must be a valid http(s) URL')
    .isLength({ max: 500 }),

  text('footer.description', 1000),
  text('footer.copyrightText', 300),

  text('about.heading', 200),
  text('about.subheading', 500),
  text('about.body', 10000),
  imageUrl(body('about.image')),

  ...contentCardRules('about.services'),
  ...contentCardRules('about.features'),
];

module.exports = { saveSiteSettingsRules };
