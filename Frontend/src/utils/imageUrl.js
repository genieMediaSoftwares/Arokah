import { BASE_URL } from "../services/api";

/**
 * Turns a stored image reference into something an <img src> can load.
 *
 * The database holds three kinds of value and all three have to keep working:
 *
 *   "https://host/uploads/home/hero_1.webp"  written by upload.php — already
 *                                            absolute, passed straight through
 *   "/uploads/home/hero_1.webp"              from the retired Node uploader;
 *                                            resolved against the image host
 *   "https://drive.google.com/..."           inherited from the old Firebase
 *                                            content, on someone else's domain
 *
 * The middle case is why this function still exists after the move to absolute
 * URLs. Rows written before the migration were never rewritten, and pointing
 * them at the API origin would 404 — the Node host's disk is wiped on every
 * redeploy, and those files now live on Hostinger. Resolving them against the
 * image host instead means any file copied across with its folder and filename
 * intact keeps rendering, with no database rewrite at all.
 */

/** The domain serving public_html/uploads. */
export const UPLOAD_BASE_URL = (import.meta.env.VITE_UPLOAD_BASE_URL || "").replace(/\/+$/, "");

// BASE_URL ends in /api; the retired local uploads were served from the root.
const SERVER_ORIGIN = BASE_URL.replace(/\/api\/?$/, "");

/** Where a legacy "/uploads/..." path should be looked for now. */
const LEGACY_UPLOAD_ORIGIN = UPLOAD_BASE_URL || SERVER_ORIGIN;

export function resolveImageUrl(value) {
  const path = typeof value === "string" ? value.trim() : "";
  if (!path) return "";

  // Absolute URL, protocol-relative URL, or an inline preview blob/data URI.
  if (/^(https?:)?\/\//i.test(path) || /^(blob:|data:)/i.test(path)) return path;

  if (path.startsWith("/uploads/")) return `${LEGACY_UPLOAD_ORIGIN}${path}`;

  // Anything else is left untouched rather than guessed at.
  return path;
}

/**
 * True when this reference is a file we host and could therefore delete.
 *
 * A Google Drive or Imgur link from the Firebase era returns false: it is not
 * ours, and offering to delete it would be offering something that cannot work.
 */
export function isManagedUpload(value) {
  const path = typeof value === "string" ? value.trim() : "";
  if (!path) return false;

  if (path.startsWith("/uploads/")) return true;

  if (!UPLOAD_BASE_URL) return false;
  try {
    const parsed = new URL(path);
    return (
      parsed.origin === new URL(UPLOAD_BASE_URL).origin &&
      parsed.pathname.startsWith("/uploads/")
    );
  } catch {
    return false;
  }
}

export { SERVER_ORIGIN };
