'use strict';

const logger = require('../config/logger');
const storage = require('./storage');
const eventRepository = require('../repositories/event.repository');
const homeContentRepository = require('../repositories/homeContent.repository');
const siteSettingsRepository = require('../repositories/siteSettings.repository');

/**
 * Keeps the uploads directory in step with the database.
 */

function collectImagePaths(value, found = new Set(), depth = 0) {
  if (depth > 8 || value === null || value === undefined) return found;

  if (typeof value === 'string') {
    if (storage.isManagedPath(value)) found.add(value);
    return found;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectImagePaths(item, found, depth + 1));
    return found;
  }

  if (typeof value === 'object') {
    const plain = typeof value.toObject === 'function' ? value.toObject() : value;
    Object.values(plain).forEach((item) => collectImagePaths(item, found, depth + 1));
    return found;
  }

  return found;
}

async function isStillReferenced(
  imagePath,
  { ignoreEventId = null, ignoreHomeContent = false, ignoreSiteSettings = false } = {}
) {
  const events = await eventRepository.findAll({ limit: 1000 });
  const eventMatch = events.some((evt) => {
    if (ignoreEventId && String(evt._id || evt.id) === String(ignoreEventId)) return false;
    if (evt.mainImage === imagePath) return true;
    return (evt.extras || []).some((ex) => ex.imageURL === imagePath);
  });
  if (eventMatch) return true;

  if (!ignoreHomeContent) {
    const home = await homeContentRepository.get();
    if (home && collectImagePaths(home).has(imagePath)) return true;
  }

  if (!ignoreSiteSettings) {
    const settings = await siteSettingsRepository.get();
    if (settings && collectImagePaths(settings).has(imagePath)) return true;
  }

  return false;
}

async function removeOrphans(previous, next, context = {}) {
  const before = collectImagePaths(previous);
  const after = collectImagePaths(next);

  const candidates = [...before].filter((imagePath) => !after.has(imagePath));
  if (candidates.length === 0) return [];

  const deleted = [];
  for (const imagePath of candidates) {
    try {
      if (await isStillReferenced(imagePath, context)) {
        logger.debug('Kept a replaced image — still referenced elsewhere', { imagePath });
        continue;
      }
      const result = await storage.deleteByPath(imagePath);
      if (result.deleted) deleted.push(imagePath);
    } catch (err) {
      logger.warn('Could not remove an orphaned image', { imagePath, error: err.message });
    }
  }

  if (deleted.length > 0) {
    logger.info(`Removed ${deleted.length} orphaned image(s)`, { deleted });
  }
  return deleted;
}

async function removeAllFor(document, context = {}) {
  return removeOrphans(document, null, context);
}

module.exports = { collectImagePaths, removeOrphans, removeAllFor, isStillReferenced };
