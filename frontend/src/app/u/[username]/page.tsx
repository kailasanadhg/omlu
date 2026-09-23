"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Settings, LogOut, Grid, Sparkles, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { UserProfile, Memory } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { MemoriesGrid } from "@/components/space/MemoriesGrid";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;
  const { user: currentUser, logout, isLoading: isAuthLoading } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthLoading && !currentUser) {
      router.replace("/login");
    }
  }, [currentUser, isAuthLoading, router]);

  useEffect(() => {
    if (!currentUser || !username) return;

    let isMounted = true;
    const cleanUsername = username.replace(/^@/, "");

    const fetchUserProfile = async () => {
      try {
        const userProfile = await apiRequest<UserProfile>(`/users/@${cleanUsername}`);
        if (!isMounted) return;
        setProfile(userProfile);

        // Fetch memories for this user respecting privacy boundaries
        const userMemories = await apiRequest<Memory[]>(`/memories/user/${userProfile.id}`);
        if (!isMounted) return;
        setMemories(userMemories);
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : "User profile not found";
        setError(msg);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchUserProfile();
    return () => {
      isMounted = false;
    };
  }, [username, currentUser]);

  if (isAuthLoading || (isLoading && !profile)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-neutral-400 text-xs">
        <div className="animate-spin w-6 h-6 border-2 border-black border-t-transparent rounded-full mb-3" />
        <span>Loading profile...</span>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center max-w-sm mx-auto">
        <h2 className="text-xl font-bold text-neutral-900 mb-2">User Not Found</h2>
        <p className="text-xs text-neutral-500 mb-6">
          The user @{username} does not exist.
        </p>
        <Link href="/">
          <Button variant="primary">Return Home</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* Profile Header */}
      <div className="px-5 pt-6 pb-4 border-b border-neutral-200 bg-white">
        <div className="flex items-center gap-5 mb-4">
          <Avatar
            src={profile.avatar_url}
            name={profile.display_name}
            size="xl"
            className="ring-2 ring-neutral-200"
          />

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-neutral-900 truncate">
              {profile.display_name}
            </h1>
            <p className="text-xs font-semibold text-neutral-500">
              @{profile.username}
            </p>

            {/* Counts */}
            <div className="flex items-center gap-4 mt-3 text-xs">
              <div>
                <span className="font-bold text-neutral-900">{profile.memories_count}</span>{" "}
                <span className="text-neutral-500">
                  {profile.is_self ? "memories" : "shared memories"}
                </span>
              </div>
              <div>
                <span className="font-bold text-neutral-900">{profile.spaces_count}</span>{" "}
                <span className="text-neutral-500">
                  {profile.is_self ? "spaces" : "shared spaces"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-xs text-neutral-700 whitespace-pre-line leading-relaxed mb-4">
            {profile.bio}
          </p>
        )}

        {/* Profile Actions */}
        {profile.is_self ? (
          <div className="flex items-center gap-2 mt-2">
            <Link href="/settings/profile" className="flex-1">
              <Button variant="secondary" size="sm" className="w-full gap-1.5 h-9 text-xs">
                <Settings className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="gap-1.5 h-9 px-3 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </Button>
          </div>
        ) : (
          !profile.is_self && profile.spaces_count === 0 && (
            <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-500 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-neutral-400 shrink-0" />
              <span>
                You do not share any private Spaces with @{profile.username}.
              </span>
            </div>
          )
        )}
      </div>

      {/* Grid Tab Navigation */}
      <div className="flex items-center justify-center h-11 border-b border-neutral-200 bg-white text-xs font-bold">
        <span className="flex items-center gap-1.5 text-black border-b-2 border-black h-full px-4">
          <Grid className="w-4 h-4" />
          <span>Memories</span>
        </span>
      </div>

      {/* Memories Grid View */}
      <div className="flex-1 bg-white">
        {memories.length === 0 ? (
          <EmptyState
            title={profile.is_self ? "No memories contributed yet." : "No shared memories."}
            subtitle={
              profile.is_self
                ? "Add memories to your Spaces to see them in your profile."
                : "Private Space memories are only visible to group members."
            }
            primaryActionText={profile.is_self ? "Explore Spaces" : undefined}
            primaryActionHref={profile.is_self ? "/spaces" : undefined}
            icon={<Sparkles className="w-8 h-8" />}
          />
        ) : (
          <MemoriesGrid
            memories={memories}
            onMemoryDeleted={(id) => {
              setMemories((prev) => prev.filter((m) => m.id !== id));
            }}
          />
        )}
      </div>
    </div>
  );
}
