"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Users, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Space } from "@/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { getOptimizedImageUrl } from "@/lib/cloudinary";

export default function SpacesPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login");
    }
  }, [user, isAuthLoading, router]);

  useEffect(() => {
    if (!user) return;
    apiRequest<Space[]>("/spaces")
      .then((data) => setSpaces(data))
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  }, [user]);

  if (isAuthLoading || (isLoading && user)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-neutral-400 text-xs">
        <div className="animate-spin w-6 h-6 border-2 border-black border-t-transparent rounded-full mb-3" />
        <span>Loading spaces...</span>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-5 max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-neutral-900">
            Your Spaces
          </h1>
          <p className="text-xs text-neutral-500">
            Private groups where you share collective memories
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
          subtitle="Spaces are private groups for friends, batches, trips, and families."
          primaryActionText="+ Create your first Space"
          primaryActionHref="/spaces/new"
          icon={<Users className="w-8 h-8" />}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {spaces.map((space) => {
            const cover = space.cover_url
              ? getOptimizedImageUrl(space.cover_url, "avatar")
              : null;
            const initials = space.name.slice(0, 2).toUpperCase();

            return (
              <Link
                key={space.id}
                href={`/spaces/${space.id}`}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-neutral-200 hover:border-black transition-all group"
              >
                <div className="flex items-center gap-3.5 overflow-hidden">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-neutral-900 shrink-0 flex items-center justify-center text-white font-black text-sm">
                    {cover ? (
                      <img
                        src={cover}
                        alt={space.name}
                        className="w-full h-full object-cover"
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
                      {space.members_count} {space.members_count === 1 ? "member" : "members"} · {space.memories_count} {space.memories_count === 1 ? "memory" : "memories"}
                    </span>
                    {space.description && (
                      <span className="text-xs text-neutral-400 truncate mt-0.5">
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
