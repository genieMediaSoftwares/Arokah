'use strict';

const storage = require('../services/storage');
const imageCleanup = require('../services/imageCleanup.service');
const activityLog = require('../services/activityLog.service');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');

/**
 * The folder comes from the route path (/api/upload/home) or, for the generic
 * endpoint, from a body field. Either way it is checked against the allowlist in
 * the storage service, so a request can never write outside a known folder.
 */
function folderFor(req) {
  return storage.resolveFolder(req.params.folder || req.body?.folder);
}

/**
 * POST /api/upload/:folder
 *
 * Responds with the stored path at the top level, as the upload contract
 * specifies, and repeats it inside `data` so the response still matches the
 * envelope every other endpoint uses:
 *   { success: true, image: "/uploads/home/hero_123.webp", data: { ... } }
 */
const uploadSingle = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No image was uploaded. Choose a file and try again.');

  const asset = await storage.storeImage(req.file, {
    folder: folderFor(req),
    uploadedBy: req.user._id,
  });

  activityLog.record({
    req,
    action: 'image.uploaded',
    entityType: 'FileAsset',
    entityId: asset.id,
    metadata: { folder: asset.folder, size: asset.size },
  });

  return res.status(201).json({
    success: true,
    message: 'Image uploaded',
    image: asset.image,
    data: { image: asset.image, file: asset },
  });
});

/** POST /api/upload/:folder/batch — used by the multi-image uploaders. */
const uploadMultiple = asyncHandler(async (req, res) => {
  const files = req.uploadedFiles || [];
  if (files.length === 0) throw ApiError.badRequest('No images were uploaded');

  const folder = folderFor(req);
  const assets = [];

  // Sequential rather than parallel: keeps peak memory bounded when several
  // large images arrive together.
  for (const file of files) {
    assets.push(await storage.storeImage(file, { folder, uploadedBy: req.user._id }));
  }

  activityLog.record({ req, action: 'image.uploaded_batch', metadata: { folder, count: assets.length } });

  return res.status(201).json({
    success: true,
    message: `${assets.length} image(s) uploaded`,
    images: assets.map((a) => a.image),
    data: { images: assets.map((a) => a.image), files: assets },
  });
});

/**
 * DELETE /api/upload — removes an uploaded file by its stored path.
 *
 * Refuses when the image is still referenced by an event or the homepage, so
 * the admin cannot delete a file out from under live content.
 */
const deleteByPath = asyncHandler(async (req, res) => {
  const { image } = req.body;

  if (!storage.isManagedPath(image)) {
    throw ApiError.badRequest('That path is not a managed upload and cannot be deleted here');
  }

  if (await imageCleanup.isStillReferenced(image)) {
    throw ApiError.conflict('This image is still in use. Remove it from the page or event first.');
  }

  const result = await storage.deleteByPath(image);
  activityLog.record({ req, action: 'image.deleted', metadata: { image } });

  return sendSuccess(res, { message: 'Image deleted', data: result });
});

/** DELETE /api/upload/:id — removes by FileAsset id. */
const deleteFile = asyncHandler(async (req, res) => {
  const result = await storage.deleteById(req.params.id);
  activityLog.record({ req, action: 'image.deleted', entityType: 'FileAsset', entityId: req.params.id });
  return sendSuccess(res, { message: 'File deleted', data: result });
});

module.exports = { uploadSingle, uploadMultiple, deleteByPath, deleteFile };
