import { useState } from "react";
import { resolveImageUrl } from "../utils/imageUrl";

/**
 * Renders a stored image reference, resolving `/uploads/...` paths against the
 * API origin. Falls back to a neutral placeholder if the image fails to load —
 * older content may point at an external host that has since gone away.
 */
function ImagePreview({
  src,
  alt = "",
  className = "",
  rounded = "rounded-xl",
  onClick,
  showZoom = false,
}) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveImageUrl(src);

  if (!resolved || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-slate-100 border border-slate-200 text-slate-400 ${rounded} ${className}`}
        title={failed ? "This image could not be loaded" : "No image"}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M18 10.5h.008v.008H18V10.5zM2.25 19.5V4.5A2.25 2.25 0 014.5 2.25h15A2.25 2.25 0 0121.75 4.5v15a2.25 2.25 0 01-2.25 2.25h-15A2.25 2.25 0 012.25 19.5z"
          />
        </svg>
        {failed && <span className="text-[9px] mt-1 font-semibold">Unavailable</span>}
      </div>
    );
  }

  return (
    <div className={`relative group/preview overflow-hidden ${rounded} ${className}`}>
      <img
        src={resolved}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        onClick={onClick}
        className={`w-full h-full object-cover ${onClick ? "cursor-zoom-in" : ""}`}
      />
      {showZoom && onClick && (
        <div className="absolute inset-0 bg-black/0 group-hover/preview:bg-black/25 transition-colors flex items-center justify-center opacity-0 group-hover/preview:opacity-100 pointer-events-none">
          <svg className="w-5 h-5 text-white drop-shadow" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
      )}
    </div>
  );
}

export default ImagePreview;
