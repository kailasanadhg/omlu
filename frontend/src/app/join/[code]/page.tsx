"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { InvitePreview, Space } from "@/types";
import { Button } from "@/components/ui/Button";
import { getOptimizedImageUrl } from "@/lib/cloudinary";

export default function JoinSpacePage() {
  const params = useParams();
  const router = useRouter();
  const inviteCode = params.code as string;
  const { user, isLoading: isAuthLoading } = useAuth();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (!inviteCode) return;

    apiRequest<InvitePreview>(`/spaces/join/${inviteCode}`)
      .then((data) => {
        setPreview(data);
        // If user is already authenticated and already a member, redirect straight to Space!
        if (user && data.is_member) {
          router.replace(`/spaces/${data.id}`);
        }
      })
      .catch((err) => {
        setError(err.message || "Invalid or expired invite link");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [inviteCode, user, router]);

  const handleJoin = async () => {
    if (!user) {
      // Preserve destination and direct to signup
      router.push(`/signup?return_to=${encodeURIComponent(`/join/${inviteCode}`)}`);
      return;
    }

    setIsJoining(true);
    try {
      const space = await apiRequest<Space>(`/spaces/join/${inviteCode}`, {
        method: "POST",
      });
      // Immediately enter the Space feed
      router.replace(`/spaces/${space.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to join space";
      alert(message);
      setIsJoining(false);
    }
  };

  if (isLoading || isAuthLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-neutral-600 text-xs">
        <div className="animate-spin w-6 h-6 border-2 border-black border-t-transparent rounded-full mb-3" />
        <span>Loading Space invite...</span>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center max-w-sm mx-auto">
        <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
          ✕
        </div>
        <h2 className="text-xl font-black text-neutral-900 mb-2">Invite Not Found</h2>
        <p className="text-xs text-neutral-500 mb-6">
          This invite link may have expired or been removed.
        </p>
        <Button variant="primary" onClick={() => router.push("/")} className="w-full">
          Go to Home
        </Button>
      </div>
    );
  }

  const cover = preview.cover_url ? getOptimizedImageUrl(preview.cover_url, "cover") : null;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-5rem)] px-5 py-8 max-w-sm mx-auto">
      {/* Brand */}
      <span className="text-2xl font-black tracking-tight text-neutral-900 lowercase mb-6">
        omlu
      </span>

      {/* Space Preview Card */}
      <div className="w-full bg-white rounded-3xl overflow-hidden border border-neutral-200 shadow-xl mb-6">
        {/* Cover */}
        <div className="w-full h-36 bg-neutral-900 overflow-hidden relative">
          {cover ? (
            <img
              src={cover}
              alt={preview.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-tr from-neutral-800 to-black flex items-center justify-center text-white/75 font-black text-3xl">
              {preview.name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          <h2 className="text-2xl font-black text-neutral-900 mb-1 tracking-tight">
            {preview.name}
          </h2>

          {preview.description && (
            <p className="text-xs text-neutral-600 mb-4 line-clamp-3 leading-relaxed">
              {preview.description}
            </p>
          )}

          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-neutral-500 mb-6">
            <span>{preview.members_count} {preview.members_count === 1 ? "member" : "members"}</span>
            <span>·</span>
            <span>{preview.memories_count} {preview.memories_count === 1 ? "memory" : "memories"}</span>
          </div>

          <p className="text-xs italic text-neutral-500 font-medium mb-6">
            Our Memories Link Us.
          </p>

          <Button
            variant="primary"
            size="lg"
            isLoading={isJoining}
            onClick={handleJoin}
            className="w-full h-12 font-bold shadow-md"
          >
            {user ? "Join Space" : "Join Space"}
          </Button>
        </div>
      </div>

      {!user && (
        <p className="text-xs text-neutral-600 text-center">
          You&apos;ll be asked to create an account or log in, then brought straight into this Space.
        </p>
      )}
    </div>
  );
}
