'use strict';

const crypto = require('crypto');
const homeContentRepository = require('../repositories/homeContent.repository');
const imageCleanup = require('./imageCleanup.service');
const { HOME_CONTENT_KEY } = require('../constants');

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
  const doc = await homeContentRepository.get(HOME_CONTENT_KEY);
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
  return { ...doc, storySection: { ...EMPTY_STORY, ...(doc.storySection || {}) } };
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

  const before = await homeContentRepository.get(HOME_CONTENT_KEY);
  const result = await homeContentRepository.save(update, actorId, HOME_CONTENT_KEY);

  if (before) {
    await imageCleanup.removeOrphans(before, result, { ignoreHomeContent: true });
  }

  return result;
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
