'use strict';

const siteSettingsRepository = require('../repositories/siteSettings.repository');
const imageCleanup = require('./imageCleanup.service');
const { SITE_SETTINGS_KEY } = require('../constants');

/**
 * The shape returned when nothing has been saved yet.
 *
 * Every field is blank rather than pre-filled with sample content: a fresh
 * install starts empty and the admin supplies the real values. The frontend
 * renders around missing fields instead of showing placeholder data.
 */
function emptySettings() {
  return {
    companyName: '',
    tagline: '',
    logo: '',
    favicon: '',
    contact: { phone: '', whatsappNumber: '', whatsappMessage: '', email: '', address: '' },
    socialLinks: [],
    footer: { description: '', copyrightText: '' },
    about: { heading: '', subheading: '', body: '', image: '', services: [], features: [] },
  };
}

async function getSettings() {
  const data = await siteSettingsRepository.get(SITE_SETTINGS_KEY);
  if (!data) return emptySettings();

  const empty = emptySettings();
  const { id, updatedBy, createdAt, updatedAt, ...rest } = data;

  return {
    id,
    ...empty,
    ...rest,
    contact: { ...empty.contact, ...(rest.contact || {}) },
    footer: { ...empty.footer, ...(rest.footer || {}) },
    about: {
      ...empty.about,
      ...(rest.about || {}),
      services: rest.about?.services || [],
      features: rest.about?.features || [],
    },
    socialLinks: rest.socialLinks || [],
  };
}

async function saveSettings(payload, actorId) {
  const empty = emptySettings();

  const update = {
    companyName: payload.companyName ?? '',
    tagline: payload.tagline ?? '',
    logo: payload.logo ?? '',
    favicon: payload.favicon ?? '',
    contact: { ...empty.contact, ...(payload.contact || {}) },
    socialLinks: (payload.socialLinks || []).filter((link) => link?.platform && link?.url),
    footer: { ...empty.footer, ...(payload.footer || {}) },
    about: {
      ...empty.about,
      ...(payload.about || {}),
      services: (payload.about?.services || []).filter((c) => c?.title),
      features: (payload.about?.features || []).filter((c) => c?.title),
    },
    updatedBy: actorId,
  };

  const before = await siteSettingsRepository.get(SITE_SETTINGS_KEY);
  const result = await siteSettingsRepository.save(update, actorId, SITE_SETTINGS_KEY);

  if (before) {
    await imageCleanup.removeOrphans(before, result, { ignoreSiteSettings: true });
  }

  return result;
}

module.exports = { getSettings, saveSettings, emptySettings };
