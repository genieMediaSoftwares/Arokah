'use strict';

const express = require('express');
const { body } = require('express-validator');
const controller = require('../controllers/upload.controller');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { objectIdParam } = require('../validators/common.validator');

const router = express.Router();

/**
 * Image deletion.
 *
 * There is no POST here any more. Files go straight from the admin panel to
 * upload.php on Hostinger, which returns a URL, and that URL is all this API
 * ever receives — see php-upload-api/README.md.
 *
 * Deletion stayed behind on purpose. PHP has no database access, so it cannot
 * answer the only question that matters before removing a file: is anything
 * still pointing at it? This API can, and does, before forwarding the request to
 * delete.php. Letting the browser call delete.php directly would skip that check
 * and let an admin pull an image out from under a live event.
 */
router.use(protect, authorize('admin', 'staff'));

// Delete by stored reference, e.g.
//   { "image": "https://mydomain.com/uploads/home/hero_123.webp" }
// The legacy "/uploads/home/hero_123.webp" form is still accepted.
router.delete(
  '/',
  validate([
    body('image')
      .trim()
      .notEmpty()
      .withMessage('image is required')
      .isLength({ max: 2000 })
      .withMessage('image reference is too long'),
  ]),
  controller.deleteByPath
);

// Delete by FileAsset id — rows left over from the retired local driver.
router.delete('/:id', validate([objectIdParam('id')]), controller.deleteFile);

module.exports = router;
