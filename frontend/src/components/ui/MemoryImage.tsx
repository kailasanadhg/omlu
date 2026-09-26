"use client";
import { useState } from "react";
import { MediaItem, MemoryPresentation } from "@/types";
import { getOptimizedImageUrl } from "@/lib/cloudinary";
import { PresentedPhoto } from "./PresentedPhoto";
export function MemoryImage({ item, alt, full = false, presentation }: { item?: MediaItem; alt: string; full?: boolean; presentation?: MemoryPresentation | null }) {
  const [failed, setFailed] = useState(false);
  return <PresentedPhoto src={failed ? "" : getOptimizedImageUrl(item?.secure_url, full ? "full" : "grid")}
    alt={alt} imageWidth={item?.width} imageHeight={item?.height} presentation={presentation} onError={() => setFailed(true)} />;
}
