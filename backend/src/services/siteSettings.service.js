'use strict';

const SiteSettings = require('../models/SiteSettings');
const imageCleanup = require('./imageCleanup.service');

const { SINGLETON_KEY } = SiteSettings;

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
  const doc = await SiteSettings.findOne({ key: SINGLETON_KEY }).lean();
  if (!doc) return emptySettings();

  const { _id, key, __v, updatedBy, ...rest } = doc;
  const empty = emptySettings();

  // Merge over the empty shape so a document saved before a field existed still
  // returns that field rather than `undefined`.
  return {
    id: String(_id),
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

  // Snapshot first so a replaced logo or about-image gets reclaimed from disk.
  const before = await SiteSettings.findOne({ key: SINGLETON_KEY }).lean();

  const doc = await SiteSettings.findOneAndUpdate(
    { key: SINGLETON_KEY },
    { $set: update },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  if (before) {
    await imageCleanup.removeOrphans(before, doc.toObject(), { ignoreSiteSettings: true });
  }

  return doc.toJSON();
}

module.exports = { getSettings, saveSettings, emptySettings };
