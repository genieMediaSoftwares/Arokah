'use strict';

const crypto = require('crypto');
const HomeContent = require('../models/HomeContent');
const imageCleanup = require('./imageCleanup.service');

const { SINGLETON_KEY } = HomeContent;

const EMPTY_STORY = { title: '', description1: '', description2: '', image1: '', image2: '' };

function normalizeSections(sections = []) {
  return sections
    .filter((section) => section && (section.label || section.imageURL))
    .map((section) => ({
      key: String(section.key || section.id || crypto.randomUUID()),
      label: section.label || '',
      imageURL: section.imageURL || '',
    }));
}

/**
 * Reads the single homepage document. Returns an empty shell rather than 404 so
 * a fresh install renders a blank homepage instead of erroring.
 */
async function getHomeContent() {
  const doc = await HomeContent.findOne({ key: SINGLETON_KEY }).lean();
  if (!doc) {
    return {
      heroSlides: ['', '', '', '', ''],
      galleryImages: [],
      pricingImage: '',
      promotionImage: '',
      aboutText: '',
      extraSections: [],
      storySection: { ...EMPTY_STORY },
    };
  }
  const { _id, key, __v, ...rest } = doc;
  return { id: String(_id), ...rest, storySection: { ...EMPTY_STORY, ...(rest.storySection || {}) } };
}

/** Upserts the homepage in one write, mirroring the old Firebase `set()`. */
async function saveHomeContent(payload, actorId) {
  const update = {
    heroSlides: payload.heroSlides ?? [],
    galleryImages: (payload.galleryImages ?? []).filter(Boolean),
    pricingImage: payload.pricingImage ?? '',
    promotionImage: payload.promotionImage ?? '',
    aboutText: payload.aboutText ?? '',
    extraSections: normalizeSections(payload.extraSections),
    storySection: { ...EMPTY_STORY, ...(payload.storySection || {}) },
    updatedBy: actorId,
  };

  // Snapshot first: the homepage is one document, so every image swap on it is
  // a replace, and the outgoing files need reclaiming.
  const before = await HomeContent.findOne({ key: SINGLETON_KEY }).lean();

  const doc = await HomeContent.findOneAndUpdate({ key: SINGLETON_KEY }, { $set: update }, {
    new: true,
    upsert: true,
    runValidators: true,
    setDefaultsOnInsert: true,
  });

  if (before) {
    await imageCleanup.removeOrphans(before, doc.toObject(), { ignoreHomeContent: true });
  }

  return doc.toJSON();
}

/** Resets every section — backs the "Delete All" button in the admin UI. */
async function clearHomeContent(actorId) {
  return saveHomeContent(
    {
      heroSlides: ['', '', '', '', ''],
      galleryImages: [],
      pricingImage: '',
      promotionImage: '',
      aboutText: '',
      extraSections: [],
      storySection: { ...EMPTY_STORY },
    },
    actorId
  );
}

module.exports = { getHomeContent, saveHomeContent, clearHomeContent };
