'use strict';

const crypto = require('crypto');
const uploadConfig = require('../../config/upload');

/**
 * S3-compatible driver (AWS S3, Cloudflare R2, DigitalOcean Spaces, Hostinger
 * Object Storage).
 *
 * The AWS SDK is intentionally NOT a dependency of this project yet — nothing
 * uses object storage today, and shipping an unused 20MB SDK is waste. To turn
 * this on:
 *
 *   1. cd backend && npm install @aws-sdk/client-s3
 *   2. set STORAGE_DRIVER=s3 plus the S3_* variables in backend/.env
 *
 * Nothing else changes. The upload routes, the services, and the frontend all
 * speak to the same driver interface, so no component above this file — and no
 * component in the browser — needs to know which backend is active.
 */
class S3StorageDriver {
  constructor() {
    this.name = 's3';
    this.bucket = uploadConfig.s3.bucket;
    this.client = null;
  }

  async getClient() {
    if (this.client) return this.client;

    let S3Client;
    try {
      ({ S3Client } = require('@aws-sdk/client-s3'));
    } catch {
      throw new Error(
        'STORAGE_DRIVER=s3 requires the AWS SDK. Run: cd backend && npm install @aws-sdk/client-s3'
      );
    }

    this.client = new S3Client({
      region: uploadConfig.s3.region || 'auto',
      endpoint: uploadConfig.s3.endpoint || undefined,
      forcePathStyle: Boolean(uploadConfig.s3.endpoint), // required by R2 and most non-AWS providers
      credentials: {
        accessKeyId: uploadConfig.s3.accessKeyId,
        secretAccessKey: uploadConfig.s3.secretAccessKey,
      },
    });
    return this.client;
  }

  buildKey(folder, { prefix = 'img', extension = '.jpg' } = {}) {
    const safeFolder = sanitizeSegment(folder);
    const safePrefix = sanitizeSegment(prefix, 24);
    const stamp = Date.now();
    const random = crypto.randomBytes(6).toString('hex');
    return `${safeFolder}/${safePrefix}_${stamp}_${random}${extension}`;
  }

  async save({ buffer, mimeType, folder = 'general', prefix, extension }) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const client = await this.getClient();
    const key = this.buildKey(folder, { prefix, extension });

    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    return { key, driver: this.name };
  }

  async delete(key) {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    const client = await this.getClient();
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    return true;
  }

  async exists(key) {
    const { HeadObjectCommand } = require('@aws-sdk/client-s3');
    const client = await this.getClient();
    try {
      await client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Absolute CDN/bucket URL. Unlike the local driver this cannot be relative —
   * the bytes live on another host. The frontend's resolver passes absolute
   * URLs straight through, so the switch stays invisible to it.
   */
  getPublicUrl(key) {
    const base = uploadConfig.s3.publicBaseUrl || `${uploadConfig.s3.endpoint}/${this.bucket}`;
    return `${String(base).replace(/\/$/, '')}/${key}`;
  }

  toStorageKey(publicPath) {
    const base = uploadConfig.s3.publicBaseUrl || `${uploadConfig.s3.endpoint}/${this.bucket}`;
    const prefix = `${String(base).replace(/\/$/, '')}/`;
    const value = String(publicPath || '').trim();
    return value.startsWith(prefix) ? value.slice(prefix.length) : null;
  }

  async ensureReady() {
    const required = [
      ['S3_BUCKET', uploadConfig.s3.bucket],
      ['S3_ACCESS_KEY_ID', uploadConfig.s3.accessKeyId],
      ['S3_SECRET_ACCESS_KEY', uploadConfig.s3.secretAccessKey],
    ];
    const missing = required.filter(([, value]) => !value).map(([name]) => name);
    if (missing.length > 0) {
      throw new Error(`STORAGE_DRIVER=s3 requires these variables in backend/.env: ${missing.join(', ')}`);
    }
  }
}

function sanitizeSegment(segment, maxLength = 40) {
  const cleaned = String(segment || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLength);
  return cleaned || 'general';
}

module.exports = S3StorageDriver;
