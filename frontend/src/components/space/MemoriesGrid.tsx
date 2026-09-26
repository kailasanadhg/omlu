"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Memory } from "@/types";
import { MemoryImage } from "../ui/MemoryImage";
import { MemoryCard } from "../feed/MemoryCard";
import { prototypeFormatForIndex } from "@/lib/presentationPrototype";

export function MemoriesGrid({ memories, onMemoryDeleted }: { memories: Memory[]; onMemoryDeleted?: (id: string) => void }) {
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
      {memories.map((memory, index) => {
        const format = prototypeFormatForIndex(index);
        return <div key={memory.id} className={`memory-tile memory-tile--${format.replace(":", "-")}`}>
        <button className="block w-full text-left" onClick={() => setSelected(memory)} aria-label={`Open memory by @${memory.author_username} in ${memory.space_name}`}>
          <div className="memory-tile-photo">
            <MemoryImage item={memory.media_items?.[0]} alt={memory.caption || `Memory in ${memory.space_name}`} presentationFormat={format} />
          </div>
          {memory.is_optimistic && <span className="text-xs">{memory.upload_status === "failed" ? "Upload failed — open to retry" : "Uploading…"}</span>}
        </button>
        <div className="flex justify-between gap-2 text-xs text-neutral-600 pt-2">
          <Link href={`/u/${memory.author_username}`} className="truncate">@{memory.author_username}</Link>
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
