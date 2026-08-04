'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const controller = require('../controllers/upload.controller');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { uploadSingleImage, uploadMultipleImages, normalizeUploadedFiles } = require('../middleware/upload');
const { objectIdParam } = require('../validators/common.validator');
const { UPLOAD_FOLDERS } = require('../services/storage');

const router = express.Router();

const FOLDERS = Object.keys(UPLOAD_FOLDERS);

// Uploading writes bytes to the server, so it is staff-only throughout.
router.use(protect, authorize('admin', 'staff'));

/**
 * Per-feature endpoints. The folder is part of the URL and validated against the
 * allowlist, which is what keeps uploads confined to known directories:
 *
 *   POST /api/upload/home       -> uploads/home/hero_<ts>_<rand>.webp
 *   POST /api/upload/events     -> uploads/events/event_<ts>_<rand>.jpg
 *   POST /api/upload/gallery    -> uploads/gallery/...
 *   POST /api/upload/categories -> uploads/categories/...
 *   POST /api/upload/users      -> uploads/users/...
 *   POST /api/upload/documents  -> uploads/documents/...
 */
router.post(
  '/:folder/batch',
  validate([param('folder').isIn(FOLDERS).withMessage(`folder must be one of: ${FOLDERS.join(', ')}`)]),
  uploadMultipleImages,
  normalizeUploadedFiles,
  controller.uploadMultiple
);

router.post(
  '/:folder',
  validate([param('folder').isIn(FOLDERS).withMessage(`folder must be one of: ${FOLDERS.join(', ')}`)]),
  uploadSingleImage,
  normalizeUploadedFiles,
  controller.uploadSingle
);

// Generic endpoint — folder supplied as a form field, defaults to "general".
router.post('/', uploadSingleImage, normalizeUploadedFiles, controller.uploadSingle);

// Delete by stored path, e.g. { "image": "/uploads/home/hero_123.webp" }
router.delete(
  '/',
  validate([body('image').trim().notEmpty().withMessage('image path is required').isLength({ max: 500 })]),
  controller.deleteByPath
);

// Delete by FileAsset id.
router.delete('/:id', validate([objectIdParam('id')]), controller.deleteFile);

module.exports = router;
