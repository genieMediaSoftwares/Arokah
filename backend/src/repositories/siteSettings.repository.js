'use strict';

const { query, queryOne } = require('../config/database');
const h = require('../db/helpers');
const { SITE_SETTINGS_KEY } = require('../constants');

function toApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyName: row.company_name || '',
    tagline: row.tagline || '',
    logo: row.logo || '',
    favicon: row.favicon || '',
    contact: h.parseJson(row.contact, {
      phone: '',
      whatsappNumber: '',
      whatsappMessage: '',
      email: '',
      address: '',
    }),
    socialLinks: h.parseJson(row.social_links, []),
    footer: h.parseJson(row.footer, { description: '', copyrightText: '' }),
    about: h.parseJson(row.about, {
      heading: '',
      subheading: '',
      body: '',
      image: '',
      services: [],
      features: [],
    }),
    updatedBy: row.updated_by || null,
    createdAt: h.toIso(row.created_at),
    updatedAt: h.toIso(row.updated_at),
  };
}

const siteSettingsRepository = {
  toApi,

  async get(key = SITE_SETTINGS_KEY) {
    const row = await queryOne('SELECT * FROM site_settings WHERE setting_key = ?', [key]);
    return toApi(row);
  },

  async save(payload, actorId, key = SITE_SETTINGS_KEY) {
    const existing = await queryOne('SELECT id FROM site_settings WHERE setting_key = ?', [key]);
    const contactJson = h.toJson(payload.contact);
    const socialLinksJson = h.toJson(payload.socialLinks);
    const footerJson = h.toJson(payload.footer);
    const aboutJson = h.toJson(payload.about);

    if (existing) {
      await query(
        `UPDATE site_settings
         SET company_name = ?, tagline = ?, logo = ?, favicon = ?,
             contact = ?, social_links = ?, footer = ?, about = ?, updated_by = ?
         WHERE setting_key = ?`,
        [
          payload.companyName || '',
          payload.tagline || '',
          payload.logo || '',
          payload.favicon || '',
          contactJson,
          socialLinksJson,
          footerJson,
          aboutJson,
          actorId || null,
          key,
        ]
      );
      return this.get(key);
    }

    const id = h.generateId();
    await query(
      `INSERT INTO site_settings (id, setting_key, company_name, tagline, logo, favicon, contact, social_links, footer, about, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        key,
        payload.companyName || '',
        payload.tagline || '',
        payload.logo || '',
        payload.favicon || '',
        contactJson,
        socialLinksJson,
        footerJson,
        aboutJson,
        actorId || null,
      ]
    );
    return this.get(key);
  },
};

module.exports = siteSettingsRepository;
