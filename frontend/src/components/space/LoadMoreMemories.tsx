"use client";
import { useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { Memory } from "@/types";
export function LoadMoreMemories({ endpoint, memories, onLoad }: { endpoint: string; memories: Memory[]; onLoad: (items: Memory[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const lock = useRef(false);
  async function load() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const items = await apiRequest<Memory[]>(`${endpoint}?limit=30&before=${memories.at(-1)!.id}`);
      if (!Array.isArray(items)) throw new Error("Invalid memory response");
      setDone(items.length < 30); onLoad(items);
    } catch { setError("Couldn't load more memories."); }
    finally { lock.current = false; setBusy(false); }
  }
  if (done || memories.length < 30) return null;
  return <div className="p-6 text-center">{error && <p role="alert">{error}</p>}<button disabled={busy} onClick={load} className="border rounded-full px-6 py-3">{busy ? "Loading…" : error ? "Try again" : "Load more memories"}</button></div>;
}
