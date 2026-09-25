"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Users, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Space } from "@/types";
import { LoadState } from "@/components/ui/LoadState";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { getOptimizedImageUrl } from "@/lib/cloudinary";

export default function SpacesPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login");
    }
  }, [user, isAuthLoading, router]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    // Reset the visible request state when this resource or retry changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    setIsLoading(true);
    apiRequest<Space[]>("/spaces")
      .then((data) => { if (!Array.isArray(data)) throw new Error("Invalid Space response"); if (active) setSpaces(data); })
      .catch(() => { if (active) setError("Couldn’t load your Spaces."); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [user, attempt]);

  if (isAuthLoading || (isLoading && user)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-neutral-600 text-xs">
        <div className="animate-spin w-6 h-6 border-2 border-black border-t-transparent rounded-full mb-3" />
        <span>Loading spaces...</span>
      </div>
    );
  }

  if (!user) return <LoadState loading />;
  if (error) return <LoadState error={error} retry={() => setAttempt(n => n + 1)} />;

  return (
    <div className="w-full px-4 py-8 md:px-8 mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-neutral-900">
            Your Spaces
          </h1>
          <p className="text-xs text-neutral-600">
            Places for your people and memories
          </p>
        </div>

        <Link href="/spaces/new">
          <Button variant="primary" size="sm" className="gap-1 rounded-full px-3.5">
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Create Space</span>
          </Button>
        </Link>
      </div>

      {/* Spaces List */}
      {spaces.length === 0 ? (
        <EmptyState
          title="No Spaces yet"
          subtitle="Create a shared archive for friends, trips, or everyday life."
          primaryActionText="+ Create your first Space"
          primaryActionHref="/spaces/new"
          icon={<Users className="w-8 h-8" />}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {spaces.map((space) => {
            const cover = space.cover_url
              ? getOptimizedImageUrl(space.cover_url, "grid")
              : null;
            const initials = space.name.slice(0, 2).toUpperCase();

            return (
              <Link
                key={space.id}
                href={`/spaces/${space.id}`}
                className="block py-3 group"
              >
                <div className="flex flex-col gap-3 overflow-hidden">
                  <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-neutral-900 shrink-0 flex items-center justify-center text-white font-black text-sm">
                    {cover ? (
                      <img
                        src={cover}
                        alt={space.name}
                        className="w-full h-full object-cover" loading="lazy" onError={e => { e.currentTarget.style.display = "none"; }}
                      />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>

                  <div className="flex flex-col truncate">
                    <h3 className="text-base font-bold text-neutral-900 group-hover:underline truncate">
                      {space.name}
                    </h3>
                    <span className="text-xs text-neutral-500 font-medium">
                      {space.visibility} · {space.members_count} {space.members_count === 1 ? "member" : "members"} · {space.memories_count} {space.memories_count === 1 ? "memory" : "memories"}
                    </span>
                    {space.description && (
                      <span className="text-xs text-neutral-600 truncate mt-0.5">
                        {space.description}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-black shrink-0 transition-colors" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
