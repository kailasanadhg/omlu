"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { RecentSpaceMemory } from "@/lib/recentSpaceMemories";
import { getOptimizedImageUrl } from "@/lib/cloudinary";
import { PresentedPhoto } from "@/components/ui/PresentedPhoto";
import { legacyAspect, shapeAspect } from "@/lib/presentation";

export function RecentMemoryViewer({
  memories, spaceName, spaceId, onClose,
}: {
  memories: RecentSpaceMemory[];
  spaceName: string;
  spaceId: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const current = memories[index];
  const ratio = current?.presentation ? shapeAspect(current.presentation.display_shape)
    : legacyAspect(current?.image_width, current?.image_height);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setIndex(value => Math.min(memories.length - 1, value + 1));
      if (event.key === "ArrowLeft") setIndex(value => Math.max(0, value - 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [memories.length, onClose]);

  if (!current) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={`Recent memories in ${spaceName}`} className="fixed inset-0 z-[60] bg-black text-white flex flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="font-bold truncate">{spaceName}</p>
          <p className="text-xs text-white/70">Recent memories · {index + 1} of {memories.length}</p>
        </div>
        <button ref={closeRef} onClick={onClose} aria-label="Close recent memories" className="p-2 rounded-full hover:bg-white/15"><X className="w-6 h-6" /></button>
      </header>
      <div className="flex-1 min-h-0 flex items-center justify-center gap-2 px-2 sm:px-6">
        <button onClick={() => setIndex(value => Math.max(0, value - 1))} disabled={index === 0} aria-label="Previous memory" className="p-2 disabled:opacity-25"><ChevronLeft className="w-7 h-7" /></button>
        <div className="flex-1 min-w-0 h-full flex items-center justify-center">
          {current.image_url ? <div style={{ width: `min(100%, calc((100dvh - 150px) * ${ratio}))` }}>
            <PresentedPhoto src={getOptimizedImageUrl(current.image_url, "full")}
              imageWidth={current.image_width} imageHeight={current.image_height}
              presentation={current.presentation} alt={`Memory ${index + 1} in ${spaceName}`} />
          </div> : <p className="text-sm text-white/70">Photo unavailable</p>}
        </div>
        <button onClick={() => setIndex(value => Math.min(memories.length - 1, value + 1))} disabled={index === memories.length - 1} aria-label="Next memory" className="p-2 disabled:opacity-25"><ChevronRight className="w-7 h-7" /></button>
      </div>
      <footer className="px-4 py-4 text-center">
        <Link href={`/spaces/${spaceId}`} onClick={onClose} className="inline-flex px-5 py-2.5 rounded-full bg-white text-black text-sm font-bold">View full Space</Link>
      </footer>
    </div>
  );
}
