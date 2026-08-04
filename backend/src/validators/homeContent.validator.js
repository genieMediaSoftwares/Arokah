'use strict';

const { body } = require('express-validator');
const { imageUrl } = require('./common.validator');

// Hero slides and gallery entries may be empty strings — the admin UI keeps five
// hero slots on screen whether or not each one is filled in.
const optionalImageArray = (field, max) => [
  body(field).optional().isArray({ max }).withMessage(`${field} must be an array of at most ${max} URLs`),
  imageUrl(body(`${field}.*`)),
];

const saveHomeContentRules = [
  ...optionalImageArray('heroSlides', 12),
  ...optionalImageArray('galleryImages', 60),
  imageUrl(body('pricingImage')),
  imageUrl(body('promotionImage')),
  body('aboutText').optional({ values: 'null' }).trim().isLength({ max: 5000 }),

  body('extraSections').optional().isArray({ max: 60 }).withMessage('extraSections must be an array'),
  body('extraSections.*.key').optional().trim().isLength({ max: 64 }),
  body('extraSections.*.id').optional().trim().isLength({ max: 64 }),
  body('extraSections.*.label').optional({ values: 'null' }).trim().isLength({ max: 200 }),
  imageUrl(body('extraSections.*.imageURL')),

  body('storySection').optional().isObject().withMessage('storySection must be an object'),
  body('storySection.title').optional({ values: 'null' }).trim().isLength({ max: 200 }),
  body('storySection.description1').optional({ values: 'null' }).trim().isLength({ max: 3000 }),
  body('storySection.description2').optional({ values: 'null' }).trim().isLength({ max: 3000 }),
  imageUrl(body('storySection.image1')),
  imageUrl(body('storySection.image2')),
];

module.exports = { saveHomeContentRules };
