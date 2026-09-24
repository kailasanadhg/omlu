"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Sparkles, Grid, ListFilter, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Space, Memory, SpaceMember } from "@/types";
import { SpaceHeader } from "@/components/space/SpaceHeader";
import { MemoriesGrid } from "@/components/space/MemoriesGrid";
import { MembersList } from "@/components/space/MembersList";
import { MemoryCard } from "@/components/feed/MemoryCard";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  PendingDrop,
  getPendingDropsForSpace,
  subscribeToPendingDrops,
  subscribeToDropReconciliation,
  pendingDropToMemory,
  initDropQueue,
} from "@/lib/dropQueue";

export default function SpaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const spaceId = params.id as string;
  const { user, isLoading: isAuthLoading } = useAuth();

  const [space, setSpace] = useState<Space | null>(null);
  const [serverMemories, setServerMemories] = useState<Memory[]>([]);
  const [pendingDrops, setPendingDrops] = useState<PendingDrop[]>([]);
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [activeTab, setActiveTab] = useState<"feed" | "grid" | "members">("feed");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login");
    }
  }, [user, isAuthLoading, router]);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Initialize drop queue and load initial pending drops for this space
  useEffect(() => {
    if (!user || !spaceId) return;

    initDropQueue(user.id).then(() => {
      getPendingDropsForSpace(user.id, spaceId).then(setPendingDrops);
    });

    const unsubscribeDrops = subscribeToPendingDrops((allDrops) => {
      const spaceDrops = allDrops.filter(
        (d) => d.userId === user.id && d.spaceId === spaceId && d.status !== "confirmed"
      );
      setPendingDrops(spaceDrops);
    });

    const unsubscribeReconcile = subscribeToDropReconciliation((canonical) => {
      if (canonical.space_id === spaceId) {
        setServerMemories((prev) => {
          const exists = prev.some(
            (m) => m.id === canonical.id || (m.client_id && m.client_id === canonical.client_id)
          );
          if (exists) {
            return prev.map((m) =>
              m.id === canonical.id || (m.client_id && m.client_id === canonical.client_id) ? canonical : m
            );
          }
          return [canonical, ...prev];
        });
        setSpace((prev) => (prev ? { ...prev, memories_count: prev.memories_count + 1 } : null));
      }
    });

    return () => {
      unsubscribeDrops();
      unsubscribeReconcile();
    };
  }, [user, spaceId]);

  // Fetch Space data without blocking memories on members
  useEffect(() => {
    if (!user || !spaceId) return;
    let isMounted = true;

    // 1. Fetch space details and memories
    const fetchCoreData = async () => {
      try {
        const [fetchedSpace, fetchedMemories] = await Promise.all([
          apiRequest<Space>(`/spaces/${spaceId}`),
          apiRequest<Memory[]>(`/memories/space/${spaceId}`),
        ]);
        if (isMounted) {
          setSpace(fetchedSpace);
          setServerMemories(fetchedMemories);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : "Failed to load Space";
          setError(message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // 2. Fetch members independently (non-blocking)
    const fetchMembers = async () => {
      try {
        const fetchedMembers = await apiRequest<SpaceMember[]>(`/spaces/${spaceId}/members`);
        if (isMounted) {
          setMembers(fetchedMembers);
        }
      } catch (err) {
        console.error("Failed to load members:", err);
      }
    };

    fetchCoreData();
    fetchMembers();

    return () => {
      isMounted = false;
    };
  }, [user, spaceId, refreshTrigger]);

  // Merge server memories + pending drops (deduplicated by client_id / id)
  const memories = useMemo(() => {
    const canonicalClientIds = new Set(serverMemories.map((m) => m.client_id).filter(Boolean));
    const canonicalIds = new Set(serverMemories.map((m) => m.id));

    const optimistic = pendingDrops
      .filter((d) => !canonicalClientIds.has(d.id) && !canonicalIds.has(d.id))
      .map(pendingDropToMemory);

    return [...optimistic, ...serverMemories];
  }, [pendingDrops, serverMemories]);

  if (isAuthLoading || (isLoading && !space)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-neutral-600 text-xs">
        <div className="animate-spin w-6 h-6 border-2 border-black border-t-transparent rounded-full mb-3" />
        <span>Entering Space...</span>
      </div>
    );
  }

  if (error || !space) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center max-w-sm mx-auto">
        <h2 className="text-xl font-bold text-neutral-900 mb-2">Space Unavailable</h2>
        <p className="text-xs text-neutral-500 mb-6">
          {error || "You might not be a member of this private Space."}
        </p>
        <button
          onClick={() => router.push("/spaces")}
          className="text-xs font-bold text-black underline"
        >
          Back to Your Spaces
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* Header */}
      <SpaceHeader space={space} />

      {/* View Switcher Tabs */}
      <div className="w-full border-b border-neutral-100 bg-white sticky top-14 z-20">
        <div className="flex items-center justify-around h-11 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("feed")}
            className={`flex-1 h-full flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
              activeTab === "feed"
                ? "border-black text-black"
                : "border-transparent text-neutral-500 hover:text-black"
            }`}
          >
            <ListFilter className="w-4 h-4" />
            <span>Feed</span>
          </button>

          <button
            onClick={() => setActiveTab("grid")}
            className={`flex-1 h-full flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
              activeTab === "grid"
                ? "border-black text-black"
                : "border-transparent text-neutral-500 hover:text-black"
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>Grid</span>
          </button>

          <button
            onClick={() => setActiveTab("members")}
            className={`flex-1 h-full flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
              activeTab === "members"
                ? "border-black text-black"
                : "border-transparent text-neutral-500 hover:text-black"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Members ({members.length})</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 w-full pb-8">
        {activeTab === "feed" && (
          memories.length === 0 ? (
            <EmptyState
              title="No memories yet."
              subtitle="Every Space starts somewhere."
              primaryActionText="Capture the first moment"
              primaryActionHref={`/camera?space_id=${space.id}`}
              icon={<Sparkles className="w-8 h-8" />}
            />
          ) : (
            <div className="divide-y divide-neutral-100">
              {memories.map((memory) => (
                <MemoryCard
                  key={memory.id}
                  memory={memory}
                  onDelete={(id) => {
                    setServerMemories((prev) => prev.filter((m) => m.id !== id));
                    setPendingDrops((prev) => prev.filter((d) => d.id !== id));
                    setSpace((prev) =>
                      prev ? { ...prev, memories_count: Math.max(0, prev.memories_count - 1) } : null
                    );
                  }}
                />
              ))}
            </div>
          )
        )}

        {activeTab === "grid" && (
          memories.length === 0 ? (
            <EmptyState
              title="No memories yet."
              subtitle="Photos posted to this Space will appear in a collective grid."
              primaryActionText="Capture the first moment"
              primaryActionHref={`/camera?space_id=${space.id}`}
              icon={<Grid className="w-8 h-8" />}
            />
          ) : (
            <MemoriesGrid
              memories={memories}
              onMemoryDeleted={(id) => {
                setServerMemories((prev) => prev.filter((m) => m.id !== id));
                setPendingDrops((prev) => prev.filter((d) => d.id !== id));
                setSpace((prev) =>
                  prev ? { ...prev, memories_count: Math.max(0, prev.memories_count - 1) } : null
                );
              }}
            />
          )
        )}

        {activeTab === "members" && (
          <MembersList
            spaceId={space.id}
            isOwner={space.is_owner}
            members={members}
            onMembersChanged={() => setRefreshTrigger((prev) => prev + 1)}
          />
        )}
      </div>
    </div>
  );
}
