import { useCallback, useEffect, useRef, useState } from "react";
import ImagePreview from "./ImagePreview";
import {
  ACCEPT_ATTRIBUTE,
  MAX_IMAGE_SIZE_MB,
  uploadImage,
  validateImageFile,
} from "../services/uploadService";

/**
 * Single-image upload field. Replaces the old "paste an image URL" input.
 *
 * The admin picks or drops a file, it uploads immediately, and `onChange`
 * receives the stored path (e.g. "/uploads/home/hero_123.webp") to save with
 * the rest of the form.
 *
 * Uploading on selection rather than on form submit is what makes the preview
 * instant and keeps the save step a plain JSON request.
 */
function ImageUploader({
  value,
  onChange,
  folder = "general",
  label,
  hint,
  aspect = "aspect-video",
  compact = false,
  disabled = false,
}) {
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  // Shown while the bytes are still in flight so the admin sees their image
  // immediately instead of an empty box.
  const [localPreview, setLocalPreview] = useState("");

  useEffect(() => {
    // Revoke the object URL when it changes or the component unmounts, otherwise
    // the browser holds the whole file in memory for the life of the page.
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleFile = useCallback(
    async (file) => {
      if (!file || disabled) return;

      const validationError = validateImageFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError("");
      const objectUrl = URL.createObjectURL(file);
      setLocalPreview(objectUrl);
      setUploading(true);
      setProgress(0);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const path = await uploadImage(file, folder, {
          signal: controller.signal,
          onProgress: setProgress,
        });
        onChange(path);
      } catch (err) {
        if (err?.name === "CanceledError" || err?.name === "AbortError") return;
        setError(err?.message || "Upload failed. Please try again.");
      } finally {
        setUploading(false);
        setProgress(0);
        setLocalPreview((current) => {
          if (current) URL.revokeObjectURL(current);
          return "";
        });
        abortRef.current = null;
      }
    },
    [disabled, folder, onChange]
  );

  const openPicker = () => {
    if (!disabled && !uploading) inputRef.current?.click();
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  };

  const onDragOver = (event) => {
    event.preventDefault();
    if (!disabled && !uploading) setDragging(true);
  };

  const remove = () => {
    setError("");
    onChange("");
  };

  const hasImage = Boolean(value) || Boolean(localPreview);
  const previewSrc = localPreview || value;

  return (
    <div className="w-full">
      {label && (
        <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-2">
          {label}
        </label>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          // Reset so picking the same file twice still fires a change event.
          event.target.value = "";
        }}
      />

      {!hasImage ? (
        <button
          type="button"
          onClick={openPicker}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={() => setDragging(false)}
          disabled={disabled}
          className={`w-full ${compact ? "py-4" : `${aspect} max-h-64`} flex flex-col items-center justify-center gap-2
            border-2 border-dashed rounded-2xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
            ${dragging
              ? "border-purple-500 bg-purple-50 scale-[0.99]"
              : error
                ? "border-red-300 bg-red-50 hover:border-red-400"
                : "border-slate-300 bg-slate-50 hover:border-purple-400 hover:bg-purple-50/50"
            }`}
        >
          <svg className={`${compact ? "w-6 h-6" : "w-9 h-9"} ${dragging ? "text-purple-500" : "text-slate-400"}`}
            fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <span className={`font-bold text-slate-700 ${compact ? "text-xs" : "text-sm"}`}>
            {dragging ? "Drop to upload" : "Upload Image"}
          </span>
          {!compact && (
            <span className="text-xs text-slate-400">
              Click to browse, or drag an image here
            </span>
          )}
          <span className="text-[10px] text-slate-400 font-medium">
            JPG, PNG or WEBP · max {MAX_IMAGE_SIZE_MB} MB
          </span>
        </button>
      ) : (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={() => setDragging(false)}
          className={`relative group rounded-2xl overflow-hidden border-2 transition-all
            ${dragging ? "border-purple-500" : "border-slate-200"}`}
        >
          <ImagePreview
            src={previewSrc}
            alt={label || "Uploaded image"}
            rounded="rounded-none"
            className={compact ? "h-24 w-full" : `${aspect} max-h-64 w-full`}
          />

          {uploading && (
            <div className="absolute inset-0 bg-slate-900/70 flex flex-col items-center justify-center gap-2 px-6">
              <div className="w-full max-w-[180px] h-1.5 bg-white/25 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-white text-xs font-bold">Uploading… {progress}%</span>
            </div>
          )}

          {!uploading && !disabled && (
            <div className="absolute inset-x-0 bottom-0 p-2 flex gap-2 bg-gradient-to-t from-black/70 to-transparent
                            opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={openPicker}
                className="flex-1 bg-white/95 hover:bg-white text-slate-800 text-xs font-bold py-2 rounded-lg transition-colors"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={remove}
                className="flex-1 bg-red-500/95 hover:bg-red-600 text-white text-xs font-bold py-2 rounded-lg transition-colors"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="flex items-start gap-1.5 text-xs text-red-600 font-semibold mt-2">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </p>
      )}

      {hint && !error && <p className="text-xs text-slate-400 mt-2">{hint}</p>}
    </div>
  );
}

export default ImageUploader;
