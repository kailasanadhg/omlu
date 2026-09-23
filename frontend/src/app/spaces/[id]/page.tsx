"use client";

import React, { useState, useEffect } from "react";
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

export default function SpaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const spaceId = params.id as string;
  const { user, isLoading: isAuthLoading } = useAuth();

  const [space, setSpace] = useState<Space | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
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

  useEffect(() => {
    if (!user || !spaceId) return;
    let isMounted = true;

    const fetchSpace = async () => {
      try {
        const [fetchedSpace, fetchedMemories, fetchedMembers] = await Promise.all([
          apiRequest<Space>(`/spaces/${spaceId}`),
          apiRequest<Memory[]>(`/memories/space/${spaceId}`),
          apiRequest<SpaceMember[]>(`/spaces/${spaceId}/members`),
        ]);
        if (isMounted) {
          setSpace(fetchedSpace);
          setMemories(fetchedMemories);
          setMembers(fetchedMembers);
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

    fetchSpace();
    return () => {
      isMounted = false;
    };
  }, [user, spaceId, refreshTrigger]);

  if (isAuthLoading || (isLoading && !space)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-neutral-400 text-xs">
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

      {/* Tabs */}
      <div className="sticky top-14 z-30 bg-white border-b border-neutral-200">
        <div className="flex items-center justify-around h-12 max-w-xl mx-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab("feed")}
            className={`flex-1 h-full flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
              activeTab === "feed"
                ? "border-black text-black"
                : "border-transparent text-neutral-400 hover:text-neutral-700"
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
                : "border-transparent text-neutral-400 hover:text-neutral-700"
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>Memories</span>
          </button>

          <button
            onClick={() => setActiveTab("members")}
            className={`flex-1 h-full flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
              activeTab === "members"
                ? "border-black text-black"
                : "border-transparent text-neutral-400 hover:text-neutral-700"
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
                    setMemories((prev) => prev.filter((m) => m.id !== id));
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
                setMemories((prev) => prev.filter((m) => m.id !== id));
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
