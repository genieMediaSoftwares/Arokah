import { useCallback, useEffect, useRef, useState } from "react";
import ImagePreview from "./ImagePreview";
import {
  ACCEPT_ATTRIBUTE,
  MAX_IMAGE_SIZE_MB,
  uploadImage,
  validateImageFile,
} from "../services/uploadService";

/**
 * Multi-image upload grid — used for the hero carousel, gallery and portfolio.
 *
 * `value` is an array of public image URLs returned by upload.php; `onChange`
 * receives the updated array. Files upload one at a time so a single rejected
 * image doesn't discard the whole batch, and each tile can be replaced or
 * removed individually.
 */
function MultipleImageUploader({
  value = [],
  onChange,
  folder = "general",
  label,
  hint,
  max = 20,
  // Fixed-length mode: slots always render and removing clears rather than
  // deletes. The hero carousel uses this to keep its five ordered positions.
  fixedSlots = 0,
  columns = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  disabled = false,
}) {
  const inputRef = useRef(null);
  const replaceIndexRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [batch, setBatch] = useState({ current: 0, total: 0 });
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const images = fixedSlots > 0
    ? Array.from({ length: fixedSlots }, (_, i) => value[i] || "")
    : value;

  const filledCount = images.filter(Boolean).length;
  const atCapacity = fixedSlots === 0 && value.length >= max;

  const handleFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []);
      if (files.length === 0 || disabled) return;

      const replaceAt = replaceIndexRef.current;
      replaceIndexRef.current = null;

      // Replacing a specific slot only ever consumes one file.
      const selected = replaceAt !== null ? files.slice(0, 1) : files;

      const rejected = [];
      const accepted = [];
      selected.forEach((file) => {
        const problem = validateImageFile(file);
        if (problem) rejected.push(`${file.name}: ${problem}`);
        else accepted.push(file);
      });

      if (rejected.length > 0) setError(rejected[0]);
      else setError("");
      if (accepted.length === 0) return;

      let room = accepted.length;
      if (replaceAt === null) {
        if (fixedSlots > 0) {
          room = images.filter((img) => !img).length;
        } else {
          room = Math.max(0, max - value.length);
        }
        if (room === 0) {
          setError(`Maximum of ${fixedSlots || max} images reached.`);
          return;
        }
        if (accepted.length > room) {
          setError(`Only ${room} more image(s) can be added — the rest were skipped.`);
        }
      }

      const toUpload = accepted.slice(0, replaceAt !== null ? 1 : room);

      setUploading(true);
      setBatch({ current: 0, total: toUpload.length });

      const uploaded = [];
      try {
        for (let i = 0; i < toUpload.length; i += 1) {
          setBatch({ current: i + 1, total: toUpload.length });
          setProgress(0);
          const imageUrl = await uploadImage(toUpload[i], folder, { onProgress: setProgress });
          uploaded.push(imageUrl);
        }
      } catch (err) {
        setError(err?.message || "Upload failed. Please try again.");
      } finally {
        if (mountedRef.current) {
          setUploading(false);
          setProgress(0);
          setBatch({ current: 0, total: 0 });
        }
      }

      if (uploaded.length === 0) return;

      if (replaceAt !== null) {
        const next = [...images];
        next[replaceAt] = uploaded[0];
        onChange(next);
        return;
      }

      if (fixedSlots > 0) {
        // Drop new images into the first empty slots, preserving order.
        const next = [...images];
        let cursor = 0;
        for (let i = 0; i < next.length && cursor < uploaded.length; i += 1) {
          if (!next[i]) {
            next[i] = uploaded[cursor];
            cursor += 1;
          }
        }
        onChange(next);
      } else {
        onChange([...value, ...uploaded]);
      }
    },
    [disabled, fixedSlots, folder, images, max, onChange, value]
  );

  const openPicker = (replaceAt = null) => {
    if (disabled || uploading) return;
    replaceIndexRef.current = replaceAt;
    inputRef.current?.click();
  };

  const removeAt = (index) => {
    setError("");
    if (fixedSlots > 0) {
      const next = [...images];
      next[index] = "";
      onChange(next);
    } else {
      onChange(value.filter((_, i) => i !== index));
    }
  };

  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer?.files);
  };

  return (
    <div className="w-full">
      {label && (
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-slate-700">{label}</label>
          <span className="text-xs text-slate-400 font-medium">
            {filledCount} / {fixedSlots || max}
          </span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <div className={`grid ${columns} gap-3`}>
        {images.map((image, index) => (
          <div
            key={`${image || "empty"}-${index}`}
            className="relative group aspect-square rounded-xl overflow-hidden border-2 border-slate-200"
          >
            {image ? (
              <>
                <ImagePreview src={image} alt={`Image ${index + 1}`} rounded="rounded-none" className="w-full h-full" />

                <span className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  {index + 1}
                </span>

                {!disabled && !uploading && (
                  <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity
                                  flex flex-col items-center justify-center gap-1.5 p-2">
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => openPicker(index)}
                        title="Replace this image"
                        className="bg-white/95 hover:bg-white text-slate-800 text-[10px] font-bold px-2.5 py-1.5 rounded-md"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAt(index)}
                        title="Remove this image"
                        className="bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-md"
                      >
                        Remove
                      </button>
                    </div>
                    {images.length > 1 && (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => move(index, -1)}
                          disabled={index === 0}
                          title="Move left"
                          className="bg-white/85 hover:bg-white disabled:opacity-30 text-slate-800 text-[10px] font-bold w-7 h-6 rounded-md"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          onClick={() => move(index, 1)}
                          disabled={index === images.length - 1}
                          title="Move right"
                          className="bg-white/85 hover:bg-white disabled:opacity-30 text-slate-800 text-[10px] font-bold w-7 h-6 rounded-md"
                        >
                          →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => openPicker(fixedSlots > 0 ? index : null)}
                disabled={disabled || uploading}
                className="w-full h-full flex flex-col items-center justify-center gap-1 bg-slate-50
                           hover:bg-purple-50 text-slate-400 hover:text-purple-500 transition-colors disabled:opacity-50"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span className="text-[10px] font-bold">
                  {fixedSlots > 0 ? `Slot ${index + 1}` : "Add"}
                </span>
              </button>
            )}
          </div>
        ))}

        {/* Open-ended mode gets a trailing "add" tile until it hits `max`. */}
        {fixedSlots === 0 && !atCapacity && (
          <button
            type="button"
            onClick={() => openPicker(null)}
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            disabled={disabled || uploading}
            className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5
              transition-all disabled:opacity-50
              ${dragging ? "border-purple-500 bg-purple-50" : "border-slate-300 bg-slate-50 hover:border-purple-400 hover:bg-purple-50/50"}`}
          >
            <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span className="text-[11px] font-bold text-slate-600">
              {dragging ? "Drop here" : "Add Images"}
            </span>
            <span className="text-[9px] text-slate-400">or drag & drop</span>
          </button>
        )}
      </div>

      {uploading && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1.5">
            <span>
              Uploading {batch.total > 1 ? `${batch.current} of ${batch.total}` : "image"}…
            </span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-purple-600 rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {error && (
        <p className="flex items-start gap-1.5 text-xs text-red-600 font-semibold mt-2">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </p>
      )}

      {hint && !error && !uploading && (
        <p className="text-xs text-slate-400 mt-2">
          {hint} · JPG, PNG or WEBP · max {MAX_IMAGE_SIZE_MB} MB each
        </p>
      )}
    </div>
  );
}

export default MultipleImageUploader;
