"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { format } from "date-fns";
import type { Memory } from "@/types";
import { MemoryImage } from "@/components/ui/MemoryImage";
import { getOptimizedImageUrl } from "@/lib/cloudinary";
import { legacyAspect, shapeAspect, validPresentation } from "@/lib/presentation";

const HOLD_MS = 420;
const MOVE_PX = 10;

export function HomeDrop({ memory }: { memory: Memory }) {
  const [flipped, setFlipped] = useState(false);
  const [lifting, setLifting] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gesture = useRef<{ id: number; x: number; y: number; cancelled: boolean; held: boolean } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const swipeStart = useRef<number | null>(null);
  const item = memory.media_items?.[0];
  const saved = validPresentation(memory.presentation) ? memory.presentation : null;
  const ratio = saved ? shapeAspect(saved.display_shape) : legacyAspect(item?.width, item?.height);
  const circular = saved?.display_shape === "circle";
  const author = memory.is_guest || !memory.author_username ? "Guest" : memory.author_display_name || memory.author_username;
  const date = memory.created_at && !Number.isNaN(new Date(memory.created_at).getTime()) ? format(new Date(memory.created_at), "d MMM yyyy") : "";

  const clearHold = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setLifting(false);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (!open) return;
    const origin = button.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", escape); origin?.focus(); };
  }, [open]);

  const pointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    clearHold();
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, cancelled: false, held: false };
    timer.current = setTimeout(() => {
      if (!gesture.current || gesture.current.cancelled) return;
      gesture.current.held = true;
      setLifting(false);
      setOpen(true);
    }, HOLD_MS);
    setLifting(true);
  };
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > MOVE_PX) {
      current.cancelled = true;
      clearHold();
    }
  };
  const pointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    clearHold();
    if (!current.held && !current.cancelled) setFlipped(value => !value);
    gesture.current = null;
  };
  const pointerCancel = () => {
    if (gesture.current) gesture.current.cancelled = true;
    gesture.current = null;
    clearHold();
  };
  const openViewer = () => { pointerCancel(); setOpen(true); };

  return <>
    <div className={`memory-tile ${circular ? "memory-tile--circle" : ""}`}>
      <button ref={button} type="button" className="home-drop-button" style={{ aspectRatio: ratio }}
        aria-label={`Turn over memory by ${author} in ${memory.space_name}. Hold to view photo; press V to view with keyboard.`}
        aria-pressed={flipped}
        onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
        onPointerCancel={pointerCancel} onPointerLeave={event => { if (event.pointerType === "mouse") pointerCancel(); }}
        onContextMenu={event => event.preventDefault()}
        onKeyDown={event => { if (event.key.toLowerCase() === "v") { event.preventDefault(); openViewer(); } else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setFlipped(value => !value); } }}>
        <span className={`home-drop-flipper ${flipped ? "is-flipped" : ""} ${lifting ? "is-lifting" : ""}`}>
          <span className="home-drop-face home-drop-front"><MemoryImage item={item} alt={`Memory in ${memory.space_name}`} presentation={memory.presentation} /></span>
          <span className="home-drop-face home-drop-back">
            <span className="home-drop-author">{author}</span>
            <span className="home-drop-details"><span>{date}</span><span>{memory.space_name}</span></span>
          </span>
        </span>
      </button>
      {memory.is_optimistic && <span className="text-xs">{memory.upload_status === "failed" ? "Upload failed" : "Uploading…"}</span>}
      <button type="button" className="sr-only focus:not-sr-only" onClick={openViewer}>View full photo</button>
    </div>
    {open && <div role="dialog" aria-modal="true" aria-label={`Photo by ${author} in ${memory.space_name}`} className="home-photo-viewer" onPointerDown={event => { if (event.target === event.currentTarget) setOpen(false); }}
      onTouchStart={event => { swipeStart.current = event.touches[0]?.clientY ?? null; }}
      onTouchEnd={event => { if (swipeStart.current !== null && (event.changedTouches[0]?.clientY ?? 0) - swipeStart.current > 100) setOpen(false); swipeStart.current = null; }}>
      <button ref={close} type="button" className="home-photo-close" onClick={() => setOpen(false)} aria-label="Close full photo">×</button>
      {item?.secure_url ? <img src={getOptimizedImageUrl(item.secure_url, "full")} alt={`Original photo by ${author}`} className="home-photo-original" /> : <p className="text-white">Photo unavailable</p>}
    </div>}
  </>;
}
