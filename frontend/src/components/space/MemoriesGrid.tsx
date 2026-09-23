"use client";

import React, { useState } from "react";
import { Copy, X } from "lucide-react";
import { Memory } from "@/types";
import { getOptimizedImageUrl } from "@/lib/cloudinary";
import { MemoryCard } from "../feed/MemoryCard";

interface MemoriesGridProps {
  memories: Memory[];
  onMemoryDeleted?: (id: string) => void;
}

export function MemoriesGrid({ memories, onMemoryDeleted }: MemoriesGridProps) {
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);

  if (!memories || memories.length === 0) {
    return null;
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-0.5 sm:gap-1 bg-white">
        {memories.map((memory) => {
          const firstMedia = memory.media_items[0];
          if (!firstMedia) return null;

          const thumbUrl = getOptimizedImageUrl(firstMedia.secure_url, "grid");

          return (
            <div
              key={memory.id}
              onClick={() => setSelectedMemory(memory)}
              className="relative aspect-square bg-neutral-100 cursor-pointer overflow-hidden group select-none"
            >
              <img
                src={thumbUrl}
                alt={memory.caption || "Memory thumbnail"}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
              />

              {/* Multi-photo indicator icon */}
              {memory.media_items.length > 1 && (
                <div className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/40 backdrop-blur-xs text-white">
                  <Copy className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Full Memory Modal when tapped */}
      {selectedMemory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedMemory(null)}
              className="absolute top-3 right-3 z-30 p-1.5 rounded-full bg-black/50 text-white hover:bg-black transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <MemoryCard
              memory={selectedMemory}
              onDelete={(id) => {
                setSelectedMemory(null);
                onMemoryDeleted?.(id);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
