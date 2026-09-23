"use client";

import React, { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { MediaItem } from "@/types";
import { getOptimizedImageUrl } from "@/lib/cloudinary";

interface CarouselProps {
  items: MediaItem[];
  onDoubleTap?: () => void;
}

export function Carousel({ items, onDoubleTap }: CarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const lastTapRef = useRef<number>(0);

  if (!items || items.length === 0) {
    return (
      <div className="w-full aspect-square bg-neutral-100 flex items-center justify-center text-neutral-500 font-medium text-xs">
        No images
      </div>
    );
  }

  const handleTouch = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      if (onDoubleTap) {
        onDoubleTap();
        setShowHeartAnim(true);
        setTimeout(() => setShowHeartAnim(false), 800);
      }
    }
    lastTapRef.current = now;
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
  };

  const currentItem = items[currentIndex];
  const optimizedUrl = getOptimizedImageUrl(currentItem.secure_url, "feed");

  return (
    <div
      className="relative w-full aspect-square bg-neutral-950 overflow-hidden select-none"
      onClick={handleTouch}
    >
      {/* Active Photo */}
      <img
        src={optimizedUrl}
        alt={`Memory photo ${currentIndex + 1}`}
        className="w-full h-full object-cover transition-opacity duration-200"
        loading="lazy"
      />

      {/* Floating double-tap heart animation */}
      {showHeartAnim && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-ping">
          <Heart className="w-24 h-24 text-white fill-white drop-shadow-lg" />
        </div>
      )}

      {/* Multiple Photos Controls */}
      {items.length > 1 && (
        <>
          {/* Badge indicator in top right */}
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold px-2 py-0.5 rounded-full z-20">
            {currentIndex + 1}/{items.length}
          </div>

          {/* Left Arrow Button */}
          {currentIndex > 0 && (
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm z-20 transition-opacity"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Right Arrow Button */}
          {currentIndex < items.length - 1 && (
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm z-20 transition-opacity"
              aria-label="Next photo"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {/* Indicator Dots */}
          <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5 z-20 pointer-events-none">
            {items.map((_, idx) => (
              <span
                key={idx}
                className={`transition-all duration-200 rounded-full ${
                  idx === currentIndex
                    ? "w-2 h-2 bg-white shadow-sm"
                    : "w-1.5 h-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
