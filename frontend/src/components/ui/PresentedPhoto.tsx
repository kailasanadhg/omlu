"use client";

import type { CSSProperties } from "react";
import type { MemoryPresentation } from "@/types";
import { legacyAspect, placementFromCrop, shapeAspect, validPresentation } from "@/lib/presentation";

export function PresentedPhoto({
  src, alt, imageWidth, imageHeight, presentation, className = "", onError,
}: {
  src: string;
  alt: string;
  imageWidth?: number | null;
  imageHeight?: number | null;
  presentation?: MemoryPresentation | null;
  className?: string;
  onError?: () => void;
}) {
  const saved = validPresentation(presentation) ? presentation : null;
  const ratio = saved ? shapeAspect(saved.display_shape) : legacyAspect(imageWidth, imageHeight);
  const placement = saved ? placementFromCrop(saved) : null;
  const imageStyle: CSSProperties = saved ? {
    position: "absolute",
    left: `${100 * placement!.left}%`,
    top: `${100 * placement!.top}%`,
    width: `${100 * placement!.width}%`,
    height: `${100 * placement!.height}%`,
    maxWidth: "none",
  } : { width: "100%", height: "100%", objectFit: "contain" };

  return <div
    className={`relative w-full overflow-hidden bg-neutral-100 ${saved?.display_shape === "circle" ? "rounded-full" : "rounded-lg"} ${className}`}
    style={{ aspectRatio: ratio }}
  >
    {src ? <img src={src} alt={alt} width={imageWidth || undefined} height={imageHeight || undefined}
      loading="lazy" decoding="async" draggable={false} onError={onError} style={imageStyle} className="select-none pointer-events-none" />
      : <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-600">Photo unavailable</div>}
  </div>;
}
