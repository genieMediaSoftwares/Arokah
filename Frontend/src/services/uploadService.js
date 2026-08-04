import api from "./api";

/**
 * Image upload service.
 *
 * The admin never types a URL: a file goes to the backend, Multer stores it, and
 * the API returns the path to persist with the rest of the form.
 */

export const MAX_IMAGE_SIZE_MB = 5;
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

export const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
/** For the file picker's `accept` attribute. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_MIME_TYPES.join(",");

/** Folders the API accepts — must match UPLOAD_FOLDERS in the backend. */
export const UPLOAD_FOLDERS = {
  home: "home",
  events: "events",
  gallery: "gallery",
  categories: "categories",
  users: "users",
  documents: "documents",
  general: "general",
};

/**
 * Client-side pre-check. Catches mistakes instantly without a round trip, but
 * it is only a convenience — the backend re-validates every upload by reading
 * the file's actual bytes, because anything checked here can be bypassed.
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
 * Uploads one image and resolves to its stored path, e.g.
 * "/uploads/home/hero_1723363782_a1b2c3.webp".
 *
 * `onProgress` receives 0-100.
 */
export async function uploadImage(file, folder = "general", { onProgress, signal } = {}) {
  const clientError = validateImageFile(file);
  if (clientError) throw new Error(clientError);

  const formData = new FormData();
  formData.append("image", file);

  const target = UPLOAD_FOLDERS[folder] ? folder : "general";

  const response = await api.post(`/upload/${target}`, formData, {
    // Let the browser set Content-Type so it can add the multipart boundary.
    headers: { "Content-Type": undefined },
    signal,
    onUploadProgress: (event) => {
      if (!onProgress) return;
      const total = event.total || file.size;
      onProgress(total ? Math.min(100, Math.round((event.loaded * 100) / total)) : 0);
    },
  });

  const image = response?.data?.image ?? response?.data?.data?.image;
  if (!image) throw new Error("Upload succeeded but no image path was returned.");
  return image;
}

/** Uploads several images, reporting overall progress across the batch. */
export async function uploadImages(files, folder = "general", { onProgress, signal } = {}) {
  const list = Array.from(files || []);
  if (list.length === 0) return [];

  const paths = [];
  for (let index = 0; index < list.length; index += 1) {
    // Sequential so progress is meaningful and the server isn't hit all at once.
    const path = await uploadImage(list[index], folder, {
      signal,
      onProgress: (percent) => {
        if (!onProgress) return;
        const completed = (index * 100 + percent) / list.length;
        onProgress(Math.round(completed), index + 1, list.length);
      },
    });
    paths.push(path);
  }
  return paths;
}

/**
 * Deletes an uploaded image from the server.
 *
 * The backend refuses if the image is still referenced by an event or the
 * homepage, so this is only for images already detached from their content.
 */
export async function deleteImage(imagePath) {
  const response = await api.delete("/upload", { data: { image: imagePath } });
  return response?.data?.data ?? null;
}
