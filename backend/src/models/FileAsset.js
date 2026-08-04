'use strict';

const mongoose = require('mongoose');

/**
 * Metadata for every uploaded file. The bytes live wherever the active storage
 * driver put them (local disk today, S3-compatible object storage later) — this
 * document is the only thing the rest of the app needs to know about.
 */
const fileAssetSchema = new mongoose.Schema(
  {
    // Driver-relative location: a filename on disk, or an object key in a bucket.
    storageKey: { type: String, required: true, index: true },
    driver: { type: String, enum: ['local', 's3'], default: 'local' },
    originalName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 0 },
    // Logical grouping (event-images, home-content, receipts…).
    folder: { type: String, default: 'general', index: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    checksum: { type: String, default: '' },
  },
  { timestamps: true }
);

fileAssetSchema.index({ createdAt: -1 });

fileAssetSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model('FileAsset', fileAssetSchema);
