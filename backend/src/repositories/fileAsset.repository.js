'use strict';

const { query, queryOne } = require('../config/database');
const h = require('../db/helpers');

function toApi(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    storageKey: row.storage_key,
    driver: row.driver,
    originalName: row.original_name,
    mimeType: row.mime_type,
    size: h.toNumber(row.size),
    folder: row.folder,
    uploadedBy: row.uploaded_by || null,
    checksum: row.checksum || '',
    createdAt: h.toIso(row.created_at),
    updatedAt: h.toIso(row.updated_at),
  };
}

const fileAssetRepository = {
  toApi,

  async create({ storageKey, driver = 'local', originalName, mimeType, size, folder = 'general', uploadedBy = null, checksum = '' }) {
    const id = h.generateId();
    await query(
      `INSERT INTO file_assets (id, storage_key, driver, original_name, mime_type, size, folder, uploaded_by, checksum)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, storageKey, driver, originalName, mimeType, h.toNumber(size), folder, uploadedBy || null, checksum]
    );
    return this.findById(id);
  },

  async findById(id) {
    if (!h.isValidId(id)) return null;
    const row = await queryOne('SELECT * FROM file_assets WHERE id = ?', [id]);
    return toApi(row);
  },

  async findByStorageKey(storageKey) {
    const row = await queryOne('SELECT * FROM file_assets WHERE storage_key = ?', [storageKey]);
    return toApi(row);
  },

  async deleteByStorageKey(storageKey) {
    return query('DELETE FROM file_assets WHERE storage_key = ?', [storageKey]);
  },

  async deleteById(id) {
    if (!h.isValidId(id)) return;
    return query('DELETE FROM file_assets WHERE id = ?', [id]);
  },
};

module.exports = fileAssetRepository;
