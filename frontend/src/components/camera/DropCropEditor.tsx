"use client";

import { useRef, useState } from "react";
import type { DisplayShape, MemoryPresentation } from "@/types";
import { cropForView, displayShapes, shapeAspect } from "@/lib/presentation";
import { PresentedPhoto } from "@/components/ui/PresentedPhoto";

export function DropCropEditor({
  src, imageWidth, imageHeight, initialShape, onConfirm, onCancel,
}: {
  src: string;
  imageWidth: number;
  imageHeight: number;
  initialShape: DisplayShape;
  onConfirm: (presentation: MemoryPresentation) => void;
  onCancel: () => void;
}) {
  const [shape, setShape] = useState<DisplayShape>(initialShape);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: 0.5, y: 0.5 });
  const drag = useRef<{ pointerId: number; x: number; y: number; centerX: number; centerY: number; crop: MemoryPresentation } | null>(null);
  const crop = cropForView(imageWidth, imageHeight, shape, zoom, center.x, center.y);
  const ratio = shapeAspect(shape);

  return <div role="dialog" aria-modal="true" aria-label="Position your Drop" className="fixed inset-0 z-[70] flex flex-col bg-black text-white px-4 py-5">
    <div className="w-full max-w-md mx-auto flex items-center justify-between">
      <button type="button" onClick={onCancel} className="text-sm font-semibold px-3 py-2">Cancel</button>
      <h1 className="text-base font-bold">Position your Drop</h1>
      <button type="button" onClick={() => onConfirm(crop)} className="text-sm font-bold rounded-full bg-white text-black px-4 py-2">Use crop</button>
    </div>
    <p className="text-center text-xs text-white/70 mt-2">Drag the photo to position it. The original stays intact.</p>
    <div className="flex-1 min-h-0 flex items-center justify-center py-4">
      <div
        role="application" tabIndex={0} aria-label="Drag to position photo within crop"
        className="max-w-full cursor-grab active:cursor-grabbing outline-offset-4"
        style={{ width: `min(100%, calc((100dvh - 245px) * ${ratio}))`, touchAction: "none" }}
        onPointerDown={event => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, centerX: center.x, centerY: center.y, crop };
        }}
        onPointerMove={event => {
          const start = drag.current;
          if (!start || start.pointerId !== event.pointerId) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          setCenter({
            x: Math.max(start.crop.crop_width / 2, Math.min(1 - start.crop.crop_width / 2,
              start.centerX - (event.clientX - start.x) / bounds.width * start.crop.crop_width)),
            y: Math.max(start.crop.crop_height / 2, Math.min(1 - start.crop.crop_height / 2,
              start.centerY - (event.clientY - start.y) / bounds.height * start.crop.crop_height)),
          });
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        onKeyDown={event => {
          const amount = event.shiftKey ? 0.05 : 0.01;
          if (event.key === "ArrowLeft") setCenter(value => ({ ...value, x: value.x - amount }));
          else if (event.key === "ArrowRight") setCenter(value => ({ ...value, x: value.x + amount }));
          else if (event.key === "ArrowUp") setCenter(value => ({ ...value, y: value.y - amount }));
          else if (event.key === "ArrowDown") setCenter(value => ({ ...value, y: value.y + amount }));
          else return;
          event.preventDefault();
        }}
      >
        <PresentedPhoto src={src} alt="Final Drop presentation preview" imageWidth={imageWidth}
          imageHeight={imageHeight} presentation={crop} />
      </div>
    </div>
    <div className="w-full max-w-md mx-auto space-y-4 pb-4">
      <div className="flex justify-center gap-2" aria-label="Drop shape">
        {displayShapes.map(item => <button key={item.value} type="button" aria-label={`Select ${item.label} shape`}
          aria-pressed={shape === item.value} onClick={() => setShape(item.value)}
          className={`min-w-12 h-10 px-2 rounded-full border text-xs font-semibold ${shape === item.value ? "bg-white text-black border-white" : "bg-white/10 border-white/40"}`}>
          {item.label}
        </button>)}
      </div>
      <label className="flex items-center gap-3 text-sm"><span>Zoom</span>
        <input type="range" min="1" max="4" step="0.01" value={zoom} onChange={event => setZoom(Number(event.target.value))} className="flex-1" />
        <span className="w-9 text-right tabular-nums">{zoom.toFixed(1)}×</span>
      </label>
    </div>
  </div>;
}
