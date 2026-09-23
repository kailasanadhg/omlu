"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Users, ChevronRight, Camera } from "lucide-react";
import { Space } from "@/types";
import { apiRequest } from "@/lib/api";

interface SpaceSelectorSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SpaceSelectorSheet({ isOpen, onClose }: SpaceSelectorSheetProps) {
  const router = useRouter();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchSpaces = async () => {
      setIsLoading(true);
      try {
        const data = await apiRequest<Space[]>("/spaces");
        if (isMounted) {
          setSpaces(data);
        }
      } catch (err) {
        console.error("Failed to load spaces for selector:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchSpaces();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectSpace = (spaceId: string) => {
    onClose();
    router.push(`/camera?space_id=${spaceId}`);
  };

  const handleCreateSpace = () => {
    onClose();
    router.push("/spaces/new");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-lg bg-white rounded-t-3xl p-5 shadow-2xl z-10 max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <div>
            <h2 className="text-base font-bold text-neutral-900">Add to a Space</h2>
            <p className="text-xs text-neutral-500">Choose where to capture this moment</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-500 hover:text-black transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Space List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-neutral-600 gap-2">
              <div className="w-6 h-6 border-2 border-neutral-300 border-t-black rounded-full animate-spin" />
              <p className="text-xs font-medium">Loading spaces...</p>
            </div>
          ) : spaces.length === 0 ? (
            <div className="py-8 text-center text-neutral-600 space-y-2">
              <p className="text-sm font-medium text-neutral-800">You haven&apos;t joined any Spaces yet</p>
              <p className="text-xs text-neutral-500">Create a space to start capturing live moments</p>
            </div>
          ) : (
            spaces.map((space) => (
              <button
                key={space.id}
                onClick={() => handleSelectSpace(space.id)}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-neutral-50 hover:bg-neutral-100 active:scale-[0.99] transition text-left group border border-neutral-100/80"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-neutral-900 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    {space.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-neutral-900 truncate">
                      {space.name}
                    </p>
                    <p className="text-xs text-neutral-500 flex items-center gap-1.5 mt-0.5">
                      <span className="flex items-center gap-0.5">
                        <Users className="w-3 h-3" />
                        {space.members_count}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1 text-emerald-600 font-medium">
                        <Camera className="w-3 h-3" />
                        Tap to capture
                      </span>
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-black transition-colors shrink-0" />
              </button>
            ))
          )}
        </div>

        {/* Create Space Footer */}
        <div className="pt-3 border-t border-neutral-100">
          <button
            onClick={handleCreateSpace}
            className="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-neutral-300 hover:border-black hover:bg-neutral-50 flex items-center justify-center gap-2 text-sm font-semibold text-neutral-800 transition active:scale-[0.99]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Create Space</span>
          </button>
        </div>
      </div>
    </div>
  );
}
