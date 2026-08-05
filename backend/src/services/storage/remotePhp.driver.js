'use strict';

const jwt = require('jsonwebtoken');
const uploadConfig = require('../../config/upload');
const jwtConfig = require('../../config/jwt');
const logger = require('../../config/logger');

/**
 * Storage backed by the PHP upload API in public_html.
 *
 * This driver never writes a byte. The React admin panel posts files straight to
 * upload.php and sends back only the URL it returns, which is all this API ever
 * stores. What is left for Node is the half PHP cannot do: PHP has no database
 * access, so it cannot know whether an image is still referenced by an event or
 * the homepage. Node does, and it is the only thing standing between "an admin
 * replaced a hero slide" and "the old file leaks onto the disk forever".
 *
 * So the responsibilities split cleanly:
 *
 *   upload.php   owns the bytes
 *   this driver  owns knowing WHEN a file is no longer needed, and says so
 *
 * The one call it makes outward is delete.php, authenticated with a short-lived
 * service token signed using the same JWT_SECRET the PHP side verifies against.
 */

/** Exactly `<folder>/<filename>.<ext>` — mirrors UPLOAD_VALID_KEY in _upload_lib.php. */
const VALID_KEY = /^[a-z0-9_-]{1,40}\/[a-z0-9_-]{1,80}\.(jpg|jpeg|png|webp)$/i;

const REQUEST_TIMEOUT_MS = 15_000;
const SERVICE_TOKEN_TTL = '2m';

class RemotePhpDriver {
  constructor() {
    this.name = 'php';
    this.publicBaseUrl = stripTrailingSlash(uploadConfig.php.publicBaseUrl);
    this.endpointBaseUrl = stripTrailingSlash(
      uploadConfig.php.endpointBaseUrl || uploadConfig.php.publicBaseUrl
    );
  }

  get deleteEndpoint() {
    return `${this.endpointBaseUrl}/delete.php`;
  }

  /**
   * Uploads do not pass through this API any more.
   *
   * Throwing rather than quietly proxying the file is deliberate: if some future
   * route starts accepting multipart again, it fails loudly at the first request
   * instead of writing to a Render disk that is wiped on every redeploy — which
   * is the exact failure this whole migration exists to end.
   */
  async save() {
    throw new Error(
      'Uploads are handled by the PHP upload API (upload.php). ' +
        'The React admin panel posts files there directly and sends back only the URL.'
    );
  }

  /** `events/event_1_ab.webp` -> `https://mydomain.com/uploads/events/event_1_ab.webp` */
  getPublicUrl(key) {
    return `${this.publicBaseUrl}/uploads/${String(key).replace(/^\/+/, '')}`;
  }

  /**
   * Inverse of getPublicUrl, and the function that decides what counts as "one
   * of ours" for the whole orphan-cleanup path.
   *
   * Three forms resolve to the same key, because all three exist in the
   * database at once during and after the migration:
   *
   *   https://mydomain.com/uploads/events/x.webp   what upload.php returns now
   *   /uploads/events/x.webp                       written by the old local driver
   *   events/x.webp                                a bare key
   *
   * Legacy relative paths are accepted so that images copied across to Hostinger
   * keep their folder and filename, and rows that were never rewritten still get
   * cleaned up correctly instead of leaking.
   *
   * Anything else — a Google Drive link inherited from Firebase, a URL on
   * another host — returns null and is left strictly alone. Those files are not
   * ours to delete.
   */
  toStorageKey(publicPath) {
    let value = String(publicPath || '').trim();
    if (!value || value.length > 2000) return null;

    if (/^https?:\/\//i.test(value)) {
      let parsed;
      try {
        parsed = new URL(value);
      } catch {
        return null;
      }
      // Only URLs on our own upload host describe files we control.
      if (!this.publicBaseUrl || parsed.origin !== new URL(this.publicBaseUrl).origin) {
        return null;
      }
      value = parsed.pathname;
    }

    value = value.replace(/^\/+/, '');
    if (value.startsWith('uploads/')) value = value.slice('uploads/'.length);

    // Percent-encoding has no legitimate place in a key this system generated,
    // and decoding it is how "%2e%2e%2f" turns into traversal.
    if (value.includes('%') || value.includes('\0')) return null;

    return VALID_KEY.test(value) ? value : null;
  }

  /**
   * A short-lived token, signed with the same secret and carrying the same
   * claims the PHP side already knows how to verify.
   *
   * Two minutes rather than the usual fifteen because this token never leaves
   * the two servers — it is minted per call and used immediately, so there is no
   * reason to leave it valid for longer than the request it authorises.
   */
  serviceToken() {
    return jwt.sign(
      { sub: 'system:image-cleanup', role: 'admin', type: jwtConfig.ACCESS_TOKEN_TYPE },
      jwtConfig.accessToken.secret,
      { expiresIn: SERVICE_TOKEN_TTL }
    );
  }

  /**
   * Asks delete.php to remove a file.
   *
   * Returns true when the file is gone and false when it never existed or the
   * call failed. A failure here is logged and swallowed rather than thrown: this
   * runs as a side effect of saving content, and a leaked orphan file is a far
   * better outcome than an admin's save appearing to fail because the image host
   * was briefly unreachable. list.php exists to find anything that leaks this way.
   */
  async delete(key) {
    if (!this.isConfigured()) {
      logger.warn('Skipped a remote image delete — the PHP upload API is not configured', { key });
      return false;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(this.deleteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.serviceToken()}`,
        },
        body: JSON.stringify({ imageUrl: this.getPublicUrl(key) }),
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload.success !== true) {
        logger.warn('The PHP upload API refused a delete', {
          key,
          status: response.status,
          message: payload.message || 'no message',
          code: payload.code || 'UNKNOWN',
        });
        return false;
      }

      // deleted:false means "already gone", which is the desired end state.
      return payload.deleted === true;
    } catch (err) {
      const reason = err.name === 'AbortError' ? 'timed out' : err.message;
      logger.error('Could not reach the PHP upload API to delete an image', { key, reason });
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Cheap existence probe against the public URL — no auth, no body transferred. */
  async exists(key) {
    try {
      const response = await fetch(this.getPublicUrl(key), { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  isConfigured() {
    return Boolean(this.publicBaseUrl);
  }

  async ensureReady() {
    if (!this.isConfigured()) {
      throw new Error(
        'STORAGE_DRIVER=php requires UPLOAD_PUBLIC_BASE_URL in backend/.env ' +
          '(the domain serving public_html/uploads, e.g. https://example.com).'
      );
    }
    logger.info(`Images are served from ${this.publicBaseUrl}/uploads and deleted via ${this.deleteEndpoint}`);
  }
}

function stripTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

module.exports = RemotePhpDriver;
