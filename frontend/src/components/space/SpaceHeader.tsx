"use client";

import React, { useState } from "react";
import Link from "next/link";
import { QrCode, Camera } from "lucide-react";
import { Space } from "@/types";
import { Button } from "../ui/Button";
import { InviteModal } from "../modals/InviteModal";
import { getOptimizedImageUrl } from "@/lib/cloudinary";

interface SpaceHeaderProps {
  space: Space;
}

export function SpaceHeader({ space }: SpaceHeaderProps) {
  const [showInviteModal, setShowInviteModal] = useState(false);

  const coverUrl = space.cover_url
    ? getOptimizedImageUrl(space.cover_url, "cover")
    : null;

  return (
    <div className="w-full bg-white border-b border-neutral-200">
      {/* Cover Banner */}
      <div className="w-full h-36 sm:h-48 bg-neutral-900 relative overflow-hidden">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={space.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-black flex items-center justify-center">
            <span className="text-4xl font-black text-white/30 tracking-tight">
              {space.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Info & Stats */}
      <div className="px-4 py-4 max-w-xl mx-auto">
        <h1 className="text-2xl font-black text-neutral-900 tracking-tight mb-1">
          {space.name}
        </h1>

        {space.description && (
          <p className="text-xs text-neutral-600 mb-3 whitespace-pre-line leading-relaxed">
            {space.description}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500 mb-4">
          <span>{space.members_count} {space.members_count === 1 ? "member" : "members"}</span>
          <span>·</span>
          <span>{space.memories_count} {space.memories_count === 1 ? "memory" : "memories"}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <Link href={`/camera?space_id=${space.id}`} className="flex-1">
            <Button variant="primary" size="sm" className="w-full gap-1.5 h-10">
              <Camera className="w-4 h-4 stroke-[2.5]" />
              <span>Capture Moment</span>
            </Button>
          </Link>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowInviteModal(true)}
            className="gap-1.5 h-10 px-4"
          >
            <QrCode className="w-4 h-4" />
            <span>Invite</span>
          </Button>
        </div>
      </div>

      {/* Scannable/Printable QR Modal */}
      <InviteModal
        spaceName={space.name}
        inviteCode={space.invite_code}
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />
    </div>
  );
}
