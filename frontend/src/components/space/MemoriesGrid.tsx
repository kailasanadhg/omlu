"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Memory } from "@/types";
import { MemoryImage } from "../ui/MemoryImage";
import { MemoryCard } from "../feed/MemoryCard";
import { HomeDrop } from "../feed/HomeDrop";

export function MemoriesGrid({ memories, onMemoryDeleted, home = false }: { memories: Memory[]; onMemoryDeleted?: (id: string) => void; home?: boolean }) {
  const [selected, setSelected] = useState<Memory | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!selected || !dialog.current) return;
    const focus = document.activeElement as HTMLElement;
    dialog.current.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; focus?.focus(); };
  }, [selected]);
  return <>
    <div className="memory-masonry">
      {memories.map((memory) => {
        return home ? <HomeDrop key={memory.id} memory={memory} /> : <div key={memory.id} className={`memory-tile ${memory.presentation?.display_shape === "circle" ? "memory-tile--circle" : ""}`}>
        <button className="block w-full text-left" onClick={() => setSelected(memory)} aria-label={`Open memory by ${memory.is_guest || !memory.author_username ? (memory.author_display_name || "Guest") : `@${memory.author_username}`} in ${memory.space_name}`}>
          <div className="memory-tile-photo">
            <MemoryImage item={memory.media_items?.[0]} alt={memory.caption || `Memory in ${memory.space_name}`} presentation={memory.presentation} />
          </div>
          {memory.is_optimistic && <span className="text-xs">{memory.upload_status === "failed" ? "Upload failed — open to retry" : "Uploading…"}</span>}
        </button>
        <div className="flex justify-between gap-2 text-xs text-neutral-600 pt-2">
          {memory.is_guest || !memory.author_username ? (
            <span className="truncate">{memory.author_display_name || "Guest"}</span>
          ) : (
            <Link href={`/u/${memory.author_username}`} className="truncate">@{memory.author_username}</Link>
          )}
          <Link href={`/spaces/${memory.space_id}`} className="truncate">{memory.space_name}</Link>
        </div>
      </div>; })}
    </div>
    {selected && <dialog ref={dialog} onCancel={() => setSelected(null)} onClose={() => setSelected(null)} aria-label="Memory details" className="memory-dialog">
      <div className="sticky top-0 z-40 flex justify-end bg-white p-2"><button onClick={() => { dialog.current?.close(); setSelected(null); }} className="px-4 py-2" aria-label="Close memory">Close ×</button></div>
      <MemoryCard key={selected.id} memory={selected} onDelete={id => { setSelected(null); onMemoryDeleted?.(id); }} />
    </dialog>}
  </>;
}
