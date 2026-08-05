'use strict';

const storage = require('../services/storage');
const imageCleanup = require('../services/imageCleanup.service');
const activityLog = require('../services/activityLog.service');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');

/**
 * DELETE /api/upload — removes a stored image by its URL.
 *
 * Refuses when the image is still referenced by an event, the homepage or the
 * site settings, so an admin cannot delete a file out from under live content.
 * That check is the entire reason this endpoint exists rather than the browser
 * calling delete.php itself: only this side of the system can see the database.
 *
 * Accepts the absolute URL upload.php returns, and the legacy "/uploads/..."
 * form written by the retired local driver.
 */
const deleteByPath = asyncHandler(async (req, res) => {
  const { image } = req.body;

  if (!storage.isManagedPath(image)) {
    throw ApiError.badRequest('That is not an image stored by this site and cannot be deleted here');
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

module.exports = { deleteByPath, deleteFile };
