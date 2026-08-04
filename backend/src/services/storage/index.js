'use strict';

const crypto = require('crypto');
const uploadConfig = require('../../config/upload');
const logger = require('../../config/logger');
const FileAsset = require('../../models/FileAsset');
const ApiError = require('../../utils/ApiError');
const { verifyImage } = require('../../utils/imageSignature');
const LocalStorageDriver = require('./localStorage.driver');
const S3StorageDriver = require('./s3Storage.driver');

const DRIVERS = { local: LocalStorageDriver, s3: S3StorageDriver };

// Folder allowlist and filename prefixes live in config/upload.js.
const UPLOAD_FOLDERS = uploadConfig.folders;

let driver = null;

function getDriver() {
  if (driver) return driver;
  const Driver = DRIVERS[uploadConfig.driver];
  if (!Driver) {
    throw new Error(
      `Unknown STORAGE_DRIVER '${uploadConfig.driver}'. Expected one of: ${Object.keys(DRIVERS).join(', ')}`
    );
  }
  driver = new Driver();
  return driver;
}

async function initStorage() {
  const active = getDriver();
  await active.ensureReady();
  logger.info(`Storage driver ready: ${active.name}`);
  return active;
}

function isValidFolder(folder) {
  return Object.prototype.hasOwnProperty.call(UPLOAD_FOLDERS, folder);
}

function resolveFolder(raw) {
  const folder = String(raw || uploadConfig.defaultFolder).toLowerCase();
  return isValidFolder(folder) ? folder : uploadConfig.defaultFolder;
}

/**
 * Verifies the bytes, stores them via the active driver, and records metadata.
 *
 * Returns `{ id, image, ... }` where `image` is the value to persist — a
 * root-relative path under the local driver, an absolute URL under S3. Callers
 * never learn where the bytes physically live.
 */
async function storeImage(file, { folder = uploadConfig.defaultFolder, uploadedBy = null } = {}) {
  if (!file || !file.buffer) throw ApiError.badRequest('No image was uploaded');

  // Authoritative check: the filename and Content-Type are client-controlled,
  // the leading bytes are not.
  const verdict = verifyImage(file.buffer, {
    mimeType: file.mimetype,
    originalName: file.originalname,
  });
  if (!verdict.ok) throw ApiError.badRequest(verdict.reason);

  const safeFolder = resolveFolder(folder);
  const active = getDriver();

  const { key, driver: driverName } = await active.save({
    buffer: file.buffer,
    mimeType: file.mimetype,
    folder: safeFolder,
    prefix: UPLOAD_FOLDERS[safeFolder],
    extension: verdict.extension, // derived from content, never from the name
  });

  const asset = await FileAsset.create({
    storageKey: key,
    driver: driverName,
    originalName: sanitizeOriginalName(file.originalname),
    mimeType: file.mimetype,
    size: file.size,
    folder: safeFolder,
    uploadedBy,
    checksum: crypto.createHash('sha256').update(file.buffer).digest('hex'),
  });

  return toPublicAsset(asset);
}

/**
 * Deletes the bytes for a stored public path and drops its FileAsset row.
 *
 * Silently ignores anything that is not one of our own uploads — legacy
 * absolute URLs from the Firebase era point at other people's servers and must
 * never be treated as deletable.
 */
async function deleteByPath(publicPath) {
  const active = getDriver();
  const key = active.toStorageKey(publicPath);
  if (!key) return { deleted: false, reason: 'not-managed' };

  let removed = false;
  try {
    removed = await active.delete(key);
  } catch (err) {
    logger.error('Failed to delete a stored file', { key, error: err.message });
    return { deleted: false, reason: 'delete-failed' };
  }

  await FileAsset.deleteOne({ storageKey: key }).catch(() => {});
  return { deleted: removed, key };
}

async function deleteById(assetId) {
  const asset = await FileAsset.findById(assetId);
  if (!asset) throw ApiError.notFound('File not found');

  await getDriver().delete(asset.storageKey);
  await asset.deleteOne();
  return { id: String(asset._id) };
}

/** True when a value is one of our own uploads rather than an external URL. */
function isManagedPath(value) {
  return Boolean(getDriver().toStorageKey(value));
}

function toPublicAsset(asset) {
  return {
    id: String(asset._id),
    // The value that gets stored in MongoDB and rendered by the frontend.
    image: getDriver().getPublicUrl(asset.storageKey),
    originalName: asset.originalName,
    mimeType: asset.mimeType,
    size: asset.size,
    folder: asset.folder,
    createdAt: asset.createdAt,
  };
}

/** Strips path components and control characters from a user-supplied name. */
function sanitizeOriginalName(name) {
  return String(name || 'upload')
    .replace(/[\\/]/g, '_')
    .replace(/[^\w.\- ]/g, '')
    .slice(0, 200) || 'upload';
}

module.exports = {
  initStorage,
  storeImage,
  deleteByPath,
  deleteById,
  isManagedPath,
  toPublicAsset,
  getDriver,
  resolveFolder,
  isValidFolder,
  UPLOAD_FOLDERS,
};
