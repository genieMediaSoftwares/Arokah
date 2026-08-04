'use strict';

const { query, queryOne } = require('../config/database');
const h = require('../db/helpers');
const { HOME_CONTENT_KEY } = require('../constants');

function toApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    heroSlides: h.parseJson(row.hero_slides, ['', '', '', '', '']),
    galleryImages: h.parseJson(row.gallery_images, []),
    pricingImage: row.pricing_image || '',
    promotionImage: row.promotion_image || '',
    aboutText: row.about_text || '',
    extraSections: h.parseJson(row.extra_sections, []),
    storySection: h.parseJson(row.story_section, { title: '', description1: '', description2: '', image1: '', image2: '' }),
    updatedBy: row.updated_by || null,
    createdAt: h.toIso(row.created_at),
    updatedAt: h.toIso(row.updated_at),
  };
}

const homeContentRepository = {
  toApi,

  async get(key = HOME_CONTENT_KEY) {
    const row = await queryOne('SELECT * FROM home_contents WHERE setting_key = ?', [key]);
    return toApi(row);
  },

  async save(payload, actorId, key = HOME_CONTENT_KEY) {
    const existing = await queryOne('SELECT id FROM home_contents WHERE setting_key = ?', [key]);
    const heroSlidesJson = h.toJson(payload.heroSlides);
    const galleryImagesJson = h.toJson(payload.galleryImages);
    const extraSectionsJson = h.toJson(payload.extraSections);
    const storySectionJson = h.toJson(payload.storySection);

    if (existing) {
      await query(
        `UPDATE home_contents
         SET hero_slides = ?, gallery_images = ?, pricing_image = ?, promotion_image = ?,
             about_text = ?, extra_sections = ?, story_section = ?, updated_by = ?
         WHERE setting_key = ?`,
        [
          heroSlidesJson,
          galleryImagesJson,
          payload.pricingImage || '',
          payload.promotionImage || '',
          payload.aboutText || '',
          extraSectionsJson,
          storySectionJson,
          actorId || null,
          key,
        ]
      );
      return this.get(key);
    }

    const id = h.generateId();
    await query(
      `INSERT INTO home_contents (id, setting_key, hero_slides, gallery_images, pricing_image, promotion_image, about_text, extra_sections, story_section, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        key,
        heroSlidesJson,
        galleryImagesJson,
        payload.pricingImage || '',
        payload.promotionImage || '',
        payload.aboutText || '',
        extraSectionsJson,
        storySectionJson,
        actorId || null,
      ]
    );
    return this.get(key);
  },
};

module.exports = homeContentRepository;
