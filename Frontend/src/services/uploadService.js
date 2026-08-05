import axios from "axios";
import api, { tokenStore, refreshAccessToken, normalizeError } from "./api";
import { UPLOAD_BASE_URL } from "../utils/imageUrl";

/**
 * Image upload service.
 *
 * Files do NOT go through the Express API. They are posted straight to
 * upload.php in Hostinger's public_html, which writes them into
 * public_html/uploads/ and returns a permanent public URL. That URL is the only
 * thing that ever reaches the database.
 *
 *   file ──▶ upload.php ──▶ "https://host/uploads/events/event_1_ab.webp"
 *                                        │
 *                                        ▼
 *                            Express saves the string
 *
 * The point of the arrangement is durability: the Node API runs on Render, whose
 * filesystem is wiped on every redeploy, so anything it stored locally vanished.
 * Hostinger's disk is permanent, so an image stays until something deletes it on
 * purpose.
 *
 * Deletion deliberately does NOT follow the same shortcut — see deleteImage().
 */

export const UPLOAD_ENDPOINT = `${UPLOAD_BASE_URL}/upload.php`;
export const LIST_ENDPOINT = `${UPLOAD_BASE_URL}/list.php`;

export const MAX_IMAGE_SIZE_MB = 5;
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

export const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
/** For the file picker's `accept` attribute. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_MIME_TYPES.join(",");

/** Folders upload.php accepts — must match UPLOAD_FOLDERS in _upload_config.php. */
export const UPLOAD_FOLDERS = {
  home: "home",
  events: "events",
  gallery: "gallery",
  categories: "categories",
  users: "users",
  documents: "documents",
  general: "general",
};

/** A plain client for the PHP host — no baseURL, no auth interceptor, no retries. */
const uploadClient = axios.create({ timeout: 60000 });

function assertConfigured() {
  if (!UPLOAD_BASE_URL) {
    throw new Error(
      "Image uploads are not configured: set VITE_UPLOAD_BASE_URL in Frontend/.env and rebuild."
    );
  }
}

/**
 * Rewrites the one axios failure that is genuinely ambiguous.
 *
 * A blocked CORS response and an unreachable host are indistinguishable to
 * JavaScript — the browser hands back an error with no status and no body in
 * both cases, on purpose. Since the upload host is a different origin from the
 * app, "could not reach the server" is the less likely of the two readings and
 * sends people looking at their network instead of at `.htaccess`.
 */
function describeTransportFailure(error) {
  if (error?.response || error?.code === "ECONNABORTED") return null;
  if (error?.name === "CanceledError" || error?.name === "AbortError") return null;

  return new Error(
    `The image host at ${UPLOAD_BASE_URL} did not accept the request. ` +
      "This is usually CORS or a misconfigured .htaccess rather than a network fault — " +
      "open cors-check.php on that domain to see which."
  );
}

/**
 * Client-side pre-check. Catches mistakes instantly without a round trip, but
 * it is only a convenience — upload.php re-validates every upload by reading the
 * file's actual bytes, because anything checked here can be bypassed.
 */
export function validateImageFile(file) {
  if (!file) return "Choose an image first.";

  const name = file.name || "";
  const extension = name.slice(name.lastIndexOf(".")).toLowerCase();

  if (!ACCEPTED_EXTENSIONS.includes(extension)) {
    return `"${extension || "unknown"}" files are not supported. Use JPG, PNG or WEBP.`;
  }
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    return `"${file.type || "unknown"}" files are not supported. Use JPG, PNG or WEBP.`;
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return `Image is ${formatBytes(file.size)}. Maximum size is ${MAX_IMAGE_SIZE_MB} MB.`;
  }
  if (file.size === 0) {
    return "That file is empty.";
  }
  return null;
}

export function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Posts the file once. Split out so the 401 path below can replay it with a
 * fresh token without duplicating the request setup.
 */
function postFile(file, folder, token, { onProgress, signal }) {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("folder", folder);

  return uploadClient.post(UPLOAD_ENDPOINT, formData, {
    // Let the browser set Content-Type so it can add the multipart boundary.
    headers: { Authorization: `Bearer ${token}` },
    signal,
    onUploadProgress: (event) => {
      if (!onProgress) return;
      const total = event.total || file.size;
      onProgress(total ? Math.min(100, Math.round((event.loaded * 100) / total)) : 0);
    },
  });
}

/**
 * Uploads one image and resolves to its absolute public URL, e.g.
 * "https://example.com/uploads/home/home_1723363782_a1b2c3.webp".
 *
 * `onProgress` receives 0-100.
 */
export async function uploadImage(file, folder = "general", { onProgress, signal } = {}) {
  assertConfigured();

  const clientError = validateImageFile(file);
  if (clientError) throw new Error(clientError);

  const target = UPLOAD_FOLDERS[folder] ? folder : "general";

  let token = tokenStore.get();
  if (!token) throw new Error("Sign in again to upload images.");

  let response;
  try {
    response = await postFile(file, target, token, { onProgress, signal });
  } catch (error) {
    // Access tokens live about fifteen minutes, and an admin editing a long page
    // will cross that boundary mid-session. One silent refresh and one replay
    // turns what would be a baffling "sign in again" into nothing at all.
    if (error?.response?.status !== 401) {
      throw describeTransportFailure(error) || normalizeError(error);
    }

    try {
      token = await refreshAccessToken();
    } catch {
      throw new Error("Your session expired. Sign in again to upload images.");
    }
    response = await postFile(file, target, token, { onProgress, signal }).catch((retryError) => {
      throw describeTransportFailure(retryError) || normalizeError(retryError);
    });
  }

  const imageUrl = response?.data?.imageUrl;
  if (!imageUrl) throw new Error("Upload succeeded but no image URL was returned.");
  return imageUrl;
}

/** Uploads several images, reporting overall progress across the batch. */
export async function uploadImages(files, folder = "general", { onProgress, signal } = {}) {
  const list = Array.from(files || []);
  if (list.length === 0) return [];

  const urls = [];
  for (let index = 0; index < list.length; index += 1) {
    // Sequential so progress is meaningful and the server isn't hit all at once.
    const url = await uploadImage(list[index], folder, {
      signal,
      onProgress: (percent) => {
        if (!onProgress) return;
        const completed = (index * 100 + percent) / list.length;
        onProgress(Math.round(completed), index + 1, list.length);
      },
    });
    urls.push(url);
  }
  return urls;
}

/**
 * Deletes an uploaded image.
 *
 * This one call still goes through the Express API rather than straight to
 * delete.php, and the asymmetry is deliberate. PHP has no database access, so it
 * cannot tell whether the file is still on a live event or the homepage; Express
 * can, refuses when it is, and only then forwards the request to delete.php.
 * Calling delete.php from here would skip that check and break a published page.
 *
 * Most deletions never come through here at all. Replacing an image during an
 * edit, or deleting a record outright, leaves the old file orphaned — and the
 * Express save path already detects that and cleans it up server-side, so it
 * happens even if the admin closes the tab mid-save.
 */
export async function deleteImage(imageUrl) {
  const response = await api.delete("/upload", { data: { image: imageUrl } });
  return response?.data?.data ?? null;
}

/**
 * Lists what is physically stored on Hostinger, straight from list.php.
 *
 * The database says what the site displays; this says what actually exists.
 * The difference between the two is the orphan set.
 */
export async function listStoredImages({ folder, page = 1, limit = 100 } = {}) {
  assertConfigured();

  const token = tokenStore.get();
  if (!token) throw new Error("Sign in again to browse stored images.");

  try {
    const response = await uploadClient.get(LIST_ENDPOINT, {
      headers: { Authorization: `Bearer ${token}` },
      params: { ...(folder ? { folder } : {}), page, limit },
    });
    return {
      files: response?.data?.files ?? [],
      meta: response?.data?.meta ?? null,
    };
  } catch (error) {
    throw describeTransportFailure(error) || normalizeError(error);
  }
}
