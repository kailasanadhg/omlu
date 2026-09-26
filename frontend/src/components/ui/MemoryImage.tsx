"use client";
import { useState } from "react";
import { MediaItem } from "@/types";
import { PrototypeFormat, prototypeAspectRatio } from "@/lib/presentationPrototype";
import { getOptimizedImageUrl } from "@/lib/cloudinary";
export function MemoryImage({ item, alt, full = false, presentationFormat }: { item?: MediaItem; alt: string; full?: boolean; presentationFormat?: PrototypeFormat }) {
  const [failed, setFailed] = useState(false);
  const ratio = item?.width && item?.height ? item.width / item.height : 1;
  const gridUrl = getOptimizedImageUrl(item?.secure_url, "grid");
  const srcSet = !full && gridUrl.includes("/image/upload/f_auto,q_auto,w_640,c_limit/")
    ? [320, 640, 960].map(width => `${gridUrl.replace("w_640", `w_${width}`)} ${width}w`).join(", ") : undefined;
  const style = { aspectRatio: presentationFormat ? prototypeAspectRatio(presentationFormat) : Math.max(.4, Math.min(2.5, ratio)) };
  return <div className={`w-full bg-neutral-100 overflow-hidden flex items-center justify-center ${presentationFormat === "circle" ? "rounded-full" : "rounded-lg"}`} style={style}>
    {!item?.secure_url || failed ? <span className="text-xs text-neutral-600 p-3">Photo unavailable</span> :
      <img src={getOptimizedImageUrl(item.secure_url, full ? "feed" : "grid")} alt={alt}
        srcSet={srcSet} sizes="(min-width: 1536px) 240px, (min-width: 1280px) 260px, (min-width: 1024px) 240px, (min-width: 640px) 30vw, 46vw"
        width={item.width || undefined} height={item.height || undefined}
        loading="lazy" decoding="async" onError={() => setFailed(true)}
        className={`w-full h-full ${presentationFormat ? "object-cover" : "object-contain"}`} />}
  </div>;
}
