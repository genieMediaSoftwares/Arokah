'use strict';

const env = require('./env');

/**
 * Upload policy — accepted formats, size ceilings, and folder layout.
 *
 * GIF, SVG, BMP and TIFF are deliberately absent. SVG in particular is XML that
 * can carry <script>, making it an execution vector rather than a photo format.
 */

/** Upload folders, each mapped to the filename prefix used inside it. */
const FOLDERS = {
  home: 'home',
  events: 'event',
  gallery: 'gallery',
  categories: 'category',
  users: 'profile',
  documents: 'doc',
  general: 'img',
};

module.exports = {
  driver: env.STORAGE_DRIVER,
  directory: env.UPLOAD_DIR,

  maxSizeMb: env.MAX_UPLOAD_SIZE_MB,
  maxSizeBytes: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
  maxFiles: env.MAX_UPLOAD_FILES,

  allowedMimeTypes: new Set(['image/jpeg', 'image/png', 'image/webp']),
  allowedExtensions: new Set(['.jpg', '.jpeg', '.png', '.webp']),

  folders: FOLDERS,
  folderNames: Object.keys(FOLDERS),
  defaultFolder: 'general',

  /** How long browsers may cache a served upload. Names are unique, so this is safe. */
  cacheMaxAge: env.UPLOAD_CACHE_MAX_AGE,

  /**
   * The PHP upload API in public_html. `publicBaseUrl` is the origin baked into
   * every stored image URL; `endpointBaseUrl` is where upload.php / delete.php /
   * list.php live. They are the same host in every normal deployment, and are
   * separable only so the endpoints can be moved behind a different hostname
   * without rewriting every URL already in the database.
   */
  php: {
    publicBaseUrl: env.UPLOAD_PUBLIC_BASE_URL,
    endpointBaseUrl: env.UPLOAD_PHP_ENDPOINT_URL || env.UPLOAD_PUBLIC_BASE_URL,
  },

  s3: {
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    publicBaseUrl: env.S3_PUBLIC_BASE_URL,
  },
};
