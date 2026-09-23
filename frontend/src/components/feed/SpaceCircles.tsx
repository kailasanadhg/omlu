"use client";

import React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Space } from "@/types";
import { getOptimizedImageUrl } from "@/lib/cloudinary";

interface SpaceCirclesProps {
  spaces: Space[];
}

export function SpaceCircles({ spaces }: SpaceCirclesProps) {
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
          const cover = space.cover_url ? getOptimizedImageUrl(space.cover_url, "avatar") : null;
          const initials = space.name.slice(0, 2).toUpperCase();

          return (
            <Link
              key={space.id}
              href={`/spaces/${space.id}`}
              className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none"
            >
              <div className="w-16 h-16 rounded-full p-0.5 ring-2 ring-neutral-300 group-hover:ring-black transition-all">
                <div className="w-full h-full rounded-full overflow-hidden bg-neutral-900 flex items-center justify-center text-white font-bold text-sm">
                  {cover ? (
                    <img
                      src={cover}
                      alt={space.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
              </div>
              <span className="text-xs font-medium text-neutral-800 truncate w-16 text-center">
                {space.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
