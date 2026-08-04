'use strict';

const multer = require('multer');
const uploadConfig = require('../config/upload');
const ApiError = require('../utils/ApiError');

/**
 * Files are buffered in memory and handed to the active storage driver, which
 * decides where the bytes actually land.
 *
 * Multer's diskStorage would write straight to disk, but it would also hard-wire
 * this app to a local filesystem. Buffering keeps one upload path that both the
 * local driver and an S3/R2 driver can consume, which is what lets the storage
 * backend change without touching routes or the frontend. At the configured
 * size ceiling the memory cost is negligible.
 */
const storage = multer.memoryStorage();

function extensionOf(name) {
  const match = String(name || '').toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match ? match[1] : '';
}

/**
 * First-pass filter on the declared type and extension. This is cheap and
 * rejects the obvious cases early; the authoritative check is the byte-level
 * verification in the storage service, because both of these values come from
 * the client and can be forged.
 */
function imageFileFilter(_req, file, cb) {
  const ext = extensionOf(file.originalname);
  const formats = [...uploadConfig.allowedExtensions].map((e) => e.slice(1).toUpperCase()).join(', ');

  if (!uploadConfig.allowedMimeTypes.has(file.mimetype)) {
    return cb(
      ApiError.badRequest(`Unsupported file type "${file.mimetype}". Allowed formats: ${formats}.`)
    );
  }
  if (!ext || !uploadConfig.allowedExtensions.has(ext)) {
    return cb(
      ApiError.badRequest(`Unsupported file extension "${ext || 'none'}". Allowed formats: ${formats}.`)
    );
  }
  return cb(null, true);
}

const imageUpload = multer({
  storage,
  limits: {
    fileSize: uploadConfig.maxSizeBytes,
    files: uploadConfig.maxFiles,
    // Cap field count/size so a multipart body can't be used to exhaust memory.
    fields: 10,
    fieldSize: 1024 * 100,
  },
  fileFilter: imageFileFilter,
});

/**
 * The field name is `image` (per the upload API contract) but `file` is also
 * accepted so older callers keep working.
 */
const uploadSingleImage = imageUpload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'file', maxCount: 1 },
]);

const uploadMultipleImages = imageUpload.fields([
  { name: 'images', maxCount: uploadConfig.maxFiles },
  { name: 'files', maxCount: uploadConfig.maxFiles },
]);

/** Normalises whichever field name was used into `req.file` / `req.uploadedFiles`. */
function normalizeUploadedFiles(req, _res, next) {
  const grouped = req.files || {};
  const collected = [
    ...(grouped.image || []),
    ...(grouped.file || []),
    ...(grouped.images || []),
    ...(grouped.files || []),
  ];
  req.uploadedFiles = collected;
  req.file = collected[0] || null;
  return next();
}

module.exports = { uploadSingleImage, uploadMultipleImages, normalizeUploadedFiles };
