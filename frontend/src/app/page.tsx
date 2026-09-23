"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Space, Memory } from "@/types";
import { SpaceCircles } from "@/components/feed/SpaceCircles";
import { MemoryCard } from "@/components/feed/MemoryCard";
import { EmptyState } from "@/components/ui/EmptyState";

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login");
    }
  }, [user, isAuthLoading, router]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const [fetchedSpaces, fetchedFeed] = await Promise.all([
          apiRequest<Space[]>("/spaces"),
          apiRequest<Memory[]>("/memories/feed"),
        ]);
        setSpaces(fetchedSpaces);
        setMemories(fetchedFeed);
      } catch (err) {
        console.error("Error fetching home data", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (isAuthLoading || (isLoading && user)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-neutral-400 text-xs">
        <div className="animate-spin w-6 h-6 border-2 border-black border-t-transparent rounded-full mb-3" />
        <span>Loading memories...</span>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* Top Space circles/cards */}
      <SpaceCircles spaces={spaces} />

      {/* Feed Content */}
      <div className="flex-1 w-full">
        {memories.length === 0 ? (
          <EmptyState
            title="Your memories will show up here."
            subtitle="Memories are shared photo moments contributed to your private Spaces."
            primaryActionText="Create a Space"
            primaryActionHref="/spaces/new"
            secondaryActionText="Browse Your Spaces"
            secondaryActionHref="/spaces"
            icon={<Sparkles className="w-8 h-8" />}
          />
        ) : (
          <div className="divide-y divide-neutral-100">
            {memories.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                onDelete={(deletedId) => {
                  setMemories((prev) => prev.filter((m) => m.id !== deletedId));
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
