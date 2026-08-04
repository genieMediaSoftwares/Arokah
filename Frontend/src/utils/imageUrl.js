import { BASE_URL } from "../services/api";

/**
 * Turns a stored image reference into something an <img src> can load.
 *
 * The database holds two kinds of value and both have to keep working:
 *
 *   "/uploads/home/hero_123.webp"  uploaded through our API — needs the API
 *                                  origin prepended, because the frontend runs
 *                                  on a different port/host than the backend
 *   "https://drive.google.com/..." inherited from the old Firebase content —
 *                                  already absolute, passed straight through
 *
 * Storing the relative form is deliberate: moving the API to a new domain then
 * costs nothing, because no row in MongoDB has the hostname baked into it.
 */

// BASE_URL ends in /api; uploads are served from the server root, not under it.
const SERVER_ORIGIN = BASE_URL.replace(/\/api\/?$/, "");

export function resolveImageUrl(value) {
  const path = typeof value === "string" ? value.trim() : "";
  if (!path) return "";

  // Absolute URL, protocol-relative URL, or an inline preview blob/data URI.
  if (/^(https?:)?\/\//i.test(path) || /^(blob:|data:)/i.test(path)) return path;

  if (path.startsWith("/uploads/")) return `${SERVER_ORIGIN}${path}`;

  // Anything else is left untouched rather than guessed at.
  return path;
}

/** True when this reference is one of our own uploads (so it can be deleted). */
export function isManagedUpload(value) {
  return typeof value === "string" && value.trim().startsWith("/uploads/");
}

export { SERVER_ORIGIN };
