'use strict';

const mongoose = require('mongoose');

// The homepage is a singleton document. `key` is unique and always 'mainContent',
// mirroring the old Firebase path homePage/mainContent.
const SINGLETON_KEY = 'mainContent';

const extraSectionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, trim: true, default: '' },
    imageURL: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const storySectionSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    description1: { type: String, trim: true, default: '' },
    description2: { type: String, trim: true, default: '' },
    image1: { type: String, trim: true, default: '' },
    image2: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const homeContentSchema = new mongoose.Schema(
  {
    key: { type: String, default: SINGLETON_KEY, unique: true, immutable: true },
    heroSlides: { type: [String], default: () => ['', '', '', '', ''] },
    galleryImages: { type: [String], default: [] },
    pricingImage: { type: String, trim: true, default: '' },
    promotionImage: { type: String, trim: true, default: '' },
    aboutText: { type: String, trim: true, default: '' },
    extraSections: { type: [extraSectionSchema], default: [] },
    storySection: { type: storySectionSchema, default: () => ({}) },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

homeContentSchema.set('toJSON', {
  versionKey: false,
  transform(_doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model('HomeContent', homeContentSchema);
module.exports.SINGLETON_KEY = SINGLETON_KEY;
