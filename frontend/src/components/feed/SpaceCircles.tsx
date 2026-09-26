"use client";

import React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Space } from "@/types";
import type { RecentSpaceMemory } from "@/lib/recentSpaceMemories";
import { getOptimizedImageUrl } from "@/lib/cloudinary";
import { PresentedPhoto } from "@/components/ui/PresentedPhoto";
import { circleThumbnailCrop, validPresentation } from "@/lib/presentation";

interface SpaceCirclesProps {
  spaces: Space[];
  recentBySpace?: Map<string, RecentSpaceMemory[]>;
  onOpenRecent?: (space: Space) => void;
}

export function SpaceCircles({ spaces, recentBySpace, onOpenRecent }: SpaceCirclesProps) {
  return (
    <div className="w-full border-b border-neutral-200 py-3.5 bg-white">
      <div className="flex items-center gap-4 overflow-x-auto px-4 scrollbar-none select-none">
        {/* "+ Space" button */}
        <Link
          href="/spaces/new"
          className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none"
        >
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-neutral-300 flex items-center justify-center text-neutral-500 group-hover:border-black group-hover:text-black transition-colors bg-neutral-50">
            <Plus className="w-6 h-6 stroke-[2]" />
          </div>
          <span className="text-xs font-medium text-neutral-600 truncate w-16 text-center">
            New Space
          </span>
        </Link>

        {/* Existing Spaces */}
        {spaces.map((space) => {
          const recent = recentBySpace?.get(space.id) ?? [];
          const cover = recent.length > 0 && recent.at(-1)?.image_url
            ? getOptimizedImageUrl(recent.at(-1)?.image_url, "grid")
            : space.cover_url ? getOptimizedImageUrl(space.cover_url, "avatar") : null;
          const latest = recent.at(-1);
          const recentCrop = latest && validPresentation(latest.presentation) && latest.image_width && latest.image_height
            ? circleThumbnailCrop(latest.presentation, latest.image_width, latest.image_height) : null;
          const initials = space.name.slice(0, 2).toUpperCase();

          const circle = (
            <div className={`w-16 h-16 rounded-full p-0.5 ring-2 transition-all ${recent.length > 0 ? "ring-black group-hover:ring-[3px]" : "ring-neutral-300 group-hover:ring-black"}`}>
              <div className="w-full h-full rounded-full overflow-hidden bg-neutral-900 flex items-center justify-center text-white font-bold text-sm">
                {cover && recentCrop ? <PresentedPhoto src={cover} alt="" imageWidth={latest?.image_width}
                  imageHeight={latest?.image_height} presentation={recentCrop} />
                  : cover ? <img src={cover} alt="" className="w-full h-full object-cover" loading="lazy" /> : <span>{initials}</span>}
              </div>
            </div>
          );
          return (
            <div key={space.id} className="flex flex-col items-center gap-1.5 shrink-0 group">
              {recent.length > 0 && onOpenRecent ? (
                <button type="button" onClick={() => onOpenRecent(space)} aria-label={`View ${recent.length} recent ${recent.length === 1 ? "memory" : "memories"} in ${space.name}`} className="focus:outline-none focus-visible:outline-2 rounded-full">
                  {circle}
                </button>
              ) : <Link href={`/spaces/${space.id}`} aria-label={`Open ${space.name}`} className="focus:outline-none focus-visible:outline-2 rounded-full">{circle}</Link>}
              <Link href={`/spaces/${space.id}`} className="text-xs font-medium text-neutral-800 truncate w-16 text-center hover:underline" title={`View full ${space.name} Space`}>
                {space.name}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
