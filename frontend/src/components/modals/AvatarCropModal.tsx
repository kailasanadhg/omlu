"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, RotateCw, RefreshCw, Minus, Plus, Check } from "lucide-react";
import { Button } from "../ui/Button";

interface AvatarCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob) => Promise<void>;
  isUploading?: boolean;
}

const VIEWPORT_DIAMETER = 280; // Size of the circular crop viewport in pixels

interface AvatarCropDialogProps {
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob) => Promise<void>;
  isUploading?: boolean;
}

function AvatarCropDialog({
  imageSrc,
  onClose,
  onCropComplete,
  isUploading = false,
}: AvatarCropDialogProps) {
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [isInteracting, setIsInteracting] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // Gesture tracking refs
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const initialPinchDistance = useRef<number | null>(null);
  const initialPinchZoom = useRef<number>(1);
  const dragStart = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setNaturalSize({ width: naturalWidth, height: naturalHeight });
    setImageLoaded(true);
  };

  // Calculate clamped offsets & scales based on rotation, zoom and natural size
  const getBounds = useCallback(() => {
    if (!naturalSize) {
      return {
        clampedX: 0,
        clampedY: 0,
        baseScale: 1,
        currentScale: 1,
        maxOffsetX: 0,
        maxOffsetY: 0,
      };
    }

    const isRotatedSideways = rotation === 90 || rotation === 270;
    const effW = isRotatedSideways ? naturalSize.height : naturalSize.width;
    const effH = isRotatedSideways ? naturalSize.width : naturalSize.height;

    // Cover scale ensures image fills the circle viewport
    const baseScale = Math.max(VIEWPORT_DIAMETER / effW, VIEWPORT_DIAMETER / effH);
    const currentScale = baseScale * zoom;

    const renderedW = effW * currentScale;
    const renderedH = effH * currentScale;

    const maxOffsetX = Math.max(0, (renderedW - VIEWPORT_DIAMETER) / 2);
    const maxOffsetY = Math.max(0, (renderedH - VIEWPORT_DIAMETER) / 2);

    const clampedX = Math.max(-maxOffsetX, Math.min(maxOffsetX, offset.x));
    const clampedY = Math.max(-maxOffsetY, Math.min(maxOffsetY, offset.y));

    return {
      clampedX,
      clampedY,
      baseScale,
      currentScale,
      maxOffsetX,
      maxOffsetY,
    };
  }, [naturalSize, rotation, zoom, offset]);

  const { clampedX, clampedY, currentScale } = getBounds();

  // Mouse wheel zoom on desktop
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((prev) => {
        const next = prev - e.deltaY * 0.002;
        return Math.min(3, Math.max(1, next));
      });
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Pointer event handlers for unified Touch & Mouse drag / pinch
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isUploading) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setIsInteracting(true);

    if (activePointers.current.size === 1) {
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        offsetX: clampedX,
        offsetY: clampedY,
      };
    } else if (activePointers.current.size === 2) {
      const points = Array.from(activePointers.current.values());
      initialPinchDistance.current = Math.hypot(
        points[0].x - points[1].x,
        points[0].y - points[1].y
      );
      initialPinchZoom.current = zoom;
      dragStart.current = null;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 2 && initialPinchDistance.current) {
      const points = Array.from(activePointers.current.values());
      const currentDist = Math.hypot(
        points[0].x - points[1].x,
        points[0].y - points[1].y
      );
      const ratio = currentDist / initialPinchDistance.current;
      setZoom(Math.min(3, Math.max(1, initialPinchZoom.current * ratio)));
    } else if (activePointers.current.size === 1 && dragStart.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setOffset({
        x: dragStart.current.offsetX + dx,
        y: dragStart.current.offsetY + dy,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(e.pointerId);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    if (activePointers.current.size === 1) {
      const remaining = Array.from(activePointers.current.values())[0];
      dragStart.current = {
        x: remaining.x,
        y: remaining.y,
        offsetX: clampedX,
        offsetY: clampedY,
      };
      initialPinchDistance.current = null;
    } else if (activePointers.current.size === 0) {
      dragStart.current = null;
      initialPinchDistance.current = null;
      setIsInteracting(false);
    }
  };

  // Rotate 90 degrees clockwise
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Reset to initial centered fit
  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setRotation(0);
  };

  // Generate cropped high-res blob and trigger callback
  const handleApply = async () => {
    if (!imgRef.current || !naturalSize || isUploading) return;

    const S = 800; // Output square avatar resolution
    const k = S / VIEWPORT_DIAMETER;

    const canvas = document.createElement("canvas");
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // 1. Move to center
    ctx.translate(S / 2, S / 2);

    // 2. Pan (scaled up to high-res canvas dimensions)
    ctx.translate(clampedX * k, clampedY * k);

    // 3. Rotate
    ctx.rotate((rotation * Math.PI) / 180);

    // 4. Scale
    const drawScale = currentScale * k;
    ctx.scale(drawScale, drawScale);

    // 5. Draw original image centered
    ctx.drawImage(
      imgRef.current,
      -naturalSize.width / 2,
      -naturalSize.height / 2,
      naturalSize.width,
      naturalSize.height
    );

    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        await onCropComplete(blob);
      },
      "image/jpeg",
      0.92
    );
  };

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isUploading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isUploading]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Edit Profile Photo"
    >
      <div className="relative w-full max-w-sm bg-neutral-900 text-white rounded-3xl p-5 shadow-2xl border border-neutral-800 flex flex-col items-center select-none overflow-hidden">
        {/* Top Header Bar */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Cancel editing"
          >
            <X className="w-5 h-5" />
          </button>

          <h2 className="text-sm font-bold tracking-tight text-white">
            Edit Profile Photo
          </h2>

          <button
            type="button"
            onClick={handleApply}
            disabled={!imageLoaded || isUploading}
            className="px-3 py-1 rounded-full bg-white text-black font-bold text-xs hover:bg-neutral-200 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1 cursor-pointer"
          >
            {isUploading ? (
              <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            )}
            <span>{isUploading ? "Saving..." : "Done"}</span>
          </button>
        </div>

        {/* Viewport Area */}
        <div className="relative my-5 flex items-center justify-center">
          <div
            ref={viewportRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              width: VIEWPORT_DIAMETER,
              height: VIEWPORT_DIAMETER,
              touchAction: "none",
            }}
            className={`relative overflow-hidden rounded-2xl bg-black ${
              isInteracting ? "cursor-grabbing" : "cursor-grab"
            }`}
          >
            {/* The Image undergoing 2D transform */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop preview"
              draggable={false}
              onLoad={handleImageLoad}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: naturalSize ? `${naturalSize.width}px` : "auto",
                height: naturalSize ? `${naturalSize.height}px` : "auto",
                marginLeft: naturalSize ? `-${naturalSize.width / 2}px` : 0,
                marginTop: naturalSize ? `-${naturalSize.height / 2}px` : 0,
                transform: `translate3d(${clampedX}px, ${clampedY}px, 0) rotate(${rotation}deg) scale(${currentScale})`,
                transformOrigin: "center center",
                willChange: "transform",
                maxWidth: "none",
                maxHeight: "none",
                userSelect: "none",
                opacity: imageLoaded ? 1 : 0,
              }}
            />

            {/* Circular Mask & Rule-of-Thirds Grid Overlay */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none select-none z-10"
              viewBox={`0 0 ${VIEWPORT_DIAMETER} ${VIEWPORT_DIAMETER}`}
            >
              <defs>
                <mask id="omlu-avatar-crop-mask">
                  <rect
                    x="0"
                    y="0"
                    width={VIEWPORT_DIAMETER}
                    height={VIEWPORT_DIAMETER}
                    fill="white"
                  />
                  <circle
                    cx={VIEWPORT_DIAMETER / 2}
                    cy={VIEWPORT_DIAMETER / 2}
                    r={VIEWPORT_DIAMETER / 2 - 2}
                    fill="black"
                  />
                </mask>
                <clipPath id="omlu-avatar-circle-clip">
                  <circle
                    cx={VIEWPORT_DIAMETER / 2}
                    cy={VIEWPORT_DIAMETER / 2}
                    r={VIEWPORT_DIAMETER / 2 - 2}
                  />
                </clipPath>
              </defs>

              {/* Instagram-style dimmed vignette outside circle */}
              <rect
                x="0"
                y="0"
                width={VIEWPORT_DIAMETER}
                height={VIEWPORT_DIAMETER}
                fill="rgba(0, 0, 0, 0.65)"
                mask="url(#omlu-avatar-crop-mask)"
              />

              {/* White avatar boundary ring */}
              <circle
                cx={VIEWPORT_DIAMETER / 2}
                cy={VIEWPORT_DIAMETER / 2}
                r={VIEWPORT_DIAMETER / 2 - 2}
                fill="none"
                stroke="rgba(255, 255, 255, 0.6)"
                strokeWidth="1.5"
              />

              {/* Rule of thirds grid, visible while actively panning/zooming */}
              <g
                clipPath="url(#omlu-avatar-circle-clip)"
                className={`transition-opacity duration-150 ${
                  isInteracting ? "opacity-100" : "opacity-0"
                }`}
              >
                <line
                  x1="0"
                  y1={VIEWPORT_DIAMETER / 3}
                  x2={VIEWPORT_DIAMETER}
                  y2={VIEWPORT_DIAMETER / 3}
                  stroke="rgba(255, 255, 255, 0.3)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <line
                  x1="0"
                  y1={(VIEWPORT_DIAMETER * 2) / 3}
                  x2={VIEWPORT_DIAMETER}
                  y2={(VIEWPORT_DIAMETER * 2) / 3}
                  stroke="rgba(255, 255, 255, 0.3)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <line
                  x1={VIEWPORT_DIAMETER / 3}
                  y1="0"
                  x2={VIEWPORT_DIAMETER / 3}
                  y2={VIEWPORT_DIAMETER}
                  stroke="rgba(255, 255, 255, 0.3)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <line
                  x1={(VIEWPORT_DIAMETER * 2) / 3}
                  y1="0"
                  x2={(VIEWPORT_DIAMETER * 2) / 3}
                  y2={VIEWPORT_DIAMETER}
                  stroke="rgba(255, 255, 255, 0.3)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              </g>
            </svg>

            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 text-neutral-400">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Gesture Hint */}
        <p className="text-[11px] text-neutral-400 mb-4 font-medium tracking-tight">
          Drag to reposition · Pinch or scroll to zoom
        </p>

        {/* Zoom Slider Control */}
        <div className="flex items-center gap-3 w-full max-w-xs px-2 mb-4">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, z - 0.2))}
            disabled={isUploading}
            className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
            aria-label="Zoom out"
          >
            <Minus className="w-4 h-4" />
          </button>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            disabled={isUploading}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="flex-1 h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-white"
            aria-label="Zoom photo"
          />
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
            disabled={isUploading}
            className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
            aria-label="Zoom in"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Action Controls (Rotate 90° & Reset) */}
        <div className="flex items-center justify-center gap-3 w-full pb-2">
          <button
            type="button"
            onClick={handleRotate}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 hover:text-white transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Rotate 90°</span>
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 hover:text-white transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>

        {/* Main CTA Button */}
        <div className="w-full mt-3 pt-3 border-t border-neutral-800">
          <Button
            type="button"
            variant="primary"
            size="md"
            isLoading={isUploading}
            onClick={handleApply}
            className="w-full bg-white text-black hover:bg-neutral-200 h-11 font-bold rounded-2xl"
          >
            Set Profile Photo
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AvatarCropModal({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete,
  isUploading = false,
}: AvatarCropModalProps) {
  if (!isOpen || !imageSrc) return null;

  return (
    <AvatarCropDialog
      key={imageSrc}
      imageSrc={imageSrc}
      onClose={onClose}
      onCropComplete={onCropComplete}
      isUploading={isUploading}
    />
  );
}
