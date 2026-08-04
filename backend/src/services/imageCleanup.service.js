'use strict';

const logger = require('../config/logger');
const storage = require('./storage');
const Event = require('../models/Event');
const HomeContent = require('../models/HomeContent');
const SiteSettings = require('../models/SiteSettings');

/**
 * Keeps the uploads directory in step with the database.
 *
 * Whenever an image is replaced or removed, the file it used to point at
 * becomes unreachable. Nothing else will ever clean those up, so every write
 * path that can orphan a file routes through here.
 *
 * Two rules make this safe to run automatically:
 *   1. Only our own uploads are ever touched. Legacy absolute URLs inherited
 *      from the Firebase era live on other people's servers.
 *   2. A file is deleted only after confirming no other document still
 *      references it, so re-using one image in two places cannot cause a
 *      dangling reference.
 */

/** Walks any nested structure and collects every managed image path it finds. */
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
    // Mongoose documents need converting before their fields are enumerable.
    const plain = typeof value.toObject === 'function' ? value.toObject() : value;
    Object.values(plain).forEach((item) => collectImagePaths(item, found, depth + 1));
    return found;
  }

  return found;
}

/**
 * Is this image still referenced anywhere, ignoring one document?
 *
 * `ignore` excludes the document currently being updated — its old values are
 * exactly what we are trying to retire.
 */
async function isStillReferenced(
  imagePath,
  { ignoreEventId = null, ignoreHomeContent = false, ignoreSiteSettings = false } = {}
) {
  const eventFilter = {
    $or: [{ mainImage: imagePath }, { 'extras.imageURL': imagePath }],
  };
  if (ignoreEventId) eventFilter._id = { $ne: ignoreEventId };

  const eventMatch = await Event.countDocuments(eventFilter).limit(1);
  if (eventMatch > 0) return true;

  if (!ignoreHomeContent) {
    const home = await HomeContent.findOne().lean();
    if (home && collectImagePaths(home).has(imagePath)) return true;
  }

  // Site branding (logo, favicon, about image) counts as a reference too, or a
  // logo could be deleted by an unrelated event save.
  if (!ignoreSiteSettings) {
    const settings = await SiteSettings.findOne().lean();
    if (settings && collectImagePaths(settings).has(imagePath)) return true;
  }

  return false;
}

/**
 * Deletes images that appear in `previous` but not in `next`.
 * Returns the paths actually removed.
 */
async function removeOrphans(previous, next, context = {}) {
  const before = collectImagePaths(previous);
  const after = collectImagePaths(next);

  const candidates = [...before].filter((imagePath) => !after.has(imagePath));
  if (candidates.length === 0) return [];

  const deleted = [];
  for (const imagePath of candidates) {
    try {
      // Re-check against live data: the image may be shared with another record.
      if (await isStillReferenced(imagePath, context)) {
        logger.debug('Kept a replaced image — still referenced elsewhere', { imagePath });
        continue;
      }
      const result = await storage.deleteByPath(imagePath);
      if (result.deleted) deleted.push(imagePath);
    } catch (err) {
      // Cleanup must never fail the user's save.
      logger.warn('Could not remove an orphaned image', { imagePath, error: err.message });
    }
  }

  if (deleted.length > 0) {
    logger.info(`Removed ${deleted.length} orphaned image(s)`, { deleted });
  }
  return deleted;
}

/** Deletes every managed image belonging to a document being deleted outright. */
async function removeAllFor(document, context = {}) {
  return removeOrphans(document, null, context);
}

module.exports = { collectImagePaths, removeOrphans, removeAllFor, isStillReferenced };
