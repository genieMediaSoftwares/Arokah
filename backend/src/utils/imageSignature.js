'use strict';

/**
 * Content-based image verification.
 *
 * A browser-supplied filename and Content-Type are both attacker-controlled: a
 * PHP webshell renamed to `photo.jpg` with `Content-Type: image/jpeg` passes
 * every extension and MIME check. The only trustworthy signal is the file's own
 * leading bytes, so we read them and confirm the format matches what was
 * claimed before anything touches the disk.
 */

const SIGNATURES = [
  {
    format: 'jpeg',
    mimeTypes: ['image/jpeg'],
    extensions: ['.jpg', '.jpeg'],
    test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    format: 'png',
    mimeTypes: ['image/png'],
    extensions: ['.png'],
    // \x89 P N G \r \n \x1a \n
    test: (b) =>
      b.length > 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    format: 'webp',
    mimeTypes: ['image/webp'],
    extensions: ['.webp'],
    // "RIFF" .... "WEBP"
    test: (b) =>
      b.length > 12 &&
      b.toString('ascii', 0, 4) === 'RIFF' &&
      b.toString('ascii', 8, 12) === 'WEBP',
  },
];

/** Formats explicitly rejected, with the reason shown to the admin. */
const BLOCKED = [
  { format: 'gif', test: (b) => b.length > 6 && b.toString('ascii', 0, 6).match(/^GIF8[79]a$/) },
  {
    format: 'svg',
    // SVG is XML and can carry <script> — it is an execution vector, not a photo.
    test: (b) => {
      const head = b.toString('utf8', 0, Math.min(b.length, 1024)).trimStart().toLowerCase();
      return head.startsWith('<?xml') || head.startsWith('<svg');
    },
  },
  { format: 'bmp', test: (b) => b.length > 2 && b[0] === 0x42 && b[1] === 0x4d },
  {
    format: 'tiff',
    test: (b) =>
      b.length > 4 &&
      ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00) ||
        (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a)),
  },
];

/** Detects the true format from the leading bytes, or null if unrecognised. */
function detectFormat(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  const match = SIGNATURES.find((sig) => sig.test(buffer));
  return match ? match.format : null;
}

function detectBlockedFormat(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  const match = BLOCKED.find((sig) => sig.test(buffer));
  return match ? match.format : null;
}

/**
 * Verifies the bytes really are one of the accepted formats AND that the
 * declared MIME type and extension agree with what the bytes say.
 *
 * Returns { ok: true, format, extension } or { ok: false, reason }.
 */
function verifyImage(buffer, { mimeType = '', originalName = '' } = {}) {
  const blocked = detectBlockedFormat(buffer);
  if (blocked) {
    return { ok: false, reason: `${blocked.toUpperCase()} images are not supported. Use JPG, PNG or WEBP.` };
  }

  const format = detectFormat(buffer);
  if (!format) {
    return { ok: false, reason: 'This file is not a valid JPG, PNG or WEBP image.' };
  }

  const signature = SIGNATURES.find((s) => s.format === format);

  // The bytes are authoritative — a mismatch means the upload was mislabelled,
  // deliberately or otherwise.
  if (mimeType && !signature.mimeTypes.includes(mimeType.toLowerCase())) {
    return {
      ok: false,
      reason: `File content is ${format.toUpperCase()} but was sent as ${mimeType}. Upload rejected.`,
    };
  }

  const ext = extensionOf(originalName);
  if (ext && !signature.extensions.includes(ext)) {
    return {
      ok: false,
      reason: `File content is ${format.toUpperCase()} but the name ends in ${ext}. Upload rejected.`,
    };
  }

  // Always derive the stored extension from the content, never from the name.
  return { ok: true, format, extension: signature.extensions[0] };
}

function extensionOf(name) {
  const match = String(name || '').toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match ? match[1] : '';
}

module.exports = { verifyImage, detectFormat, SIGNATURES };
