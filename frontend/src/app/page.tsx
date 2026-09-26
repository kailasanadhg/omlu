"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { subscribeToDropReconciliation } from "@/lib/dropQueue";
import { Space, Memory } from "@/types";
import { SpaceCircles } from "@/components/feed/SpaceCircles";
import { RecentMemoryViewer } from "@/components/feed/RecentMemoryViewer";
import { MemoriesGrid } from "@/components/space/MemoriesGrid";
import { LoadMoreMemories } from "@/components/space/LoadMoreMemories";
import { LoadState } from "@/components/ui/LoadState";
import { groupRecentMemories, RecentSpaceMemoriesResponse } from "@/lib/recentSpaceMemories";

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [feed, setFeed] = useState<Memory[]>([]);
  const [recent, setRecent] = useState<RecentSpaceMemoriesResponse | null>(null);
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const refreshHome = useCallback(() => setRefresh(value => value + 1), []);

  useEffect(() => {
    if (!isAuthLoading && !user) router.replace("/login");
  }, [isAuthLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    Promise.all([
      apiRequest<Space[]>("/spaces"),
      apiRequest<Memory[]>("/memories/feed"),
      apiRequest<RecentSpaceMemoriesResponse>("/memories/recent-spaces"),
    ]).then(([loadedSpaces, loadedFeed, recentData]) => {
      if (!Array.isArray(loadedSpaces) || !Array.isArray(loadedFeed) || !Array.isArray(recentData.memories)) throw new Error("Invalid Home response");
      if (active) {
        setSpaces(loadedSpaces);
        setFeed(loadedFeed);
        setRecent(recentData);
      }
    }).catch(() => { if (active) setError("Couldn’t load your memories."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, refresh]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToDropReconciliation(() => refreshHome());
    const onVisible = () => { if (document.visibilityState === "visible") refreshHome(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { unsubscribe(); document.removeEventListener("visibilitychange", onVisible); };
  }, [user, refreshHome]);

  const recentBySpace = useMemo(
    () => recent ? groupRecentMemories(recent.memories, recent.server_time) : new Map(),
    [recent],
  );
  const selectedRecent = selectedSpace ? recentBySpace.get(selectedSpace.id) ?? [] : [];

  if (isAuthLoading || (loading && !recent)) return <LoadState loading />;
  if (!user) return <LoadState loading />;
  if (error) return <LoadState error={error} retry={refreshHome} />;

  return (
    <div className="min-h-screen bg-[#faf8f3]">
      <SpaceCircles spaces={spaces} recentBySpace={recentBySpace} onOpenRecent={setSelectedSpace} />
      <div className="px-4 pt-5 pb-1 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight">Memories</h1>
          <p className="text-xs text-neutral-600">Every moment stays in its Space.</p>
        </div>
        <button onClick={refreshHome} className="text-xs font-semibold underline underline-offset-2">Refresh</button>
      </div>
      {feed.length === 0 ? (
        <p className="px-4 py-16 text-center text-sm text-neutral-600">No memories yet. Add a moment to a Space to begin.</p>
      ) : (
        <>
          <MemoriesGrid memories={feed} onMemoryDeleted={id => {
            setFeed(items => items.filter(item => item.id !== id));
            refreshHome();
          }} />
          <LoadMoreMemories endpoint="/memories/feed" memories={feed} onLoad={items => setFeed(previous => [
            ...previous,
            ...items.filter(item => !previous.some(existing => existing.id === item.id)),
          ])} />
        </>
      )}
      {selectedSpace && selectedRecent.length > 0 && <RecentMemoryViewer
        memories={selectedRecent}
        spaceName={selectedSpace.name}
        spaceId={selectedSpace.id}
        onClose={() => setSelectedSpace(null)}
      />}
    </div>
  );
}
