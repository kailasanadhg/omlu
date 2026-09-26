"use client";

import React, { useState } from "react";
import Link from "next/link";
import { QrCode, Camera, UserCheck } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Space } from "@/types";
import { Button } from "../ui/Button";
import { InviteModal } from "../modals/InviteModal";
import { GuestUploadsModal } from "../modals/GuestUploadsModal";
import { getOptimizedImageUrl } from "@/lib/cloudinary";

interface SpaceHeaderProps {
  space: Space;
  onChange?: (space: Space) => void;
}

export function SpaceHeader({ space, onChange }: SpaceHeaderProps) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [visibility, setVisibility] = useState(space.visibility);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);

  const coverUrl = space.cover_url
    ? getOptimizedImageUrl(space.cover_url, "cover")
    : null;

  return (
    <div className="w-full bg-white border-b border-neutral-200">
      {coverUrl && <div className="w-full h-36 sm:h-48 bg-neutral-100 overflow-hidden">
        <img src={coverUrl} alt="" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.visibility = "hidden"; }} />
      </div>}

      {/* Info & Stats */}
      <div className="px-4 py-8 md:px-6 mx-auto">
        <h1 className="text-2xl font-black text-neutral-900 tracking-tight mb-1">
          {space.name}
        </h1>

        {space.description && (
          <p className="text-xs text-neutral-700 mb-3 whitespace-pre-line leading-relaxed">
            {space.description}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600 mb-4">
          <span>{space.members_count} {space.members_count === 1 ? "member" : "members"}</span>
          <span>·</span>
          <span>{space.memories_count} {space.memories_count === 1 ? "memory" : "memories"}</span>
        </div>

        <p className="text-xs capitalize mb-3">{space.visibility} Space</p>
        {space.is_owner && (
          <div className="flex flex-col gap-3 mb-4">
            <form className="flex flex-wrap items-center gap-3 text-sm" onSubmit={async e => {
              e.preventDefault(); setSaving(true); setError("");
              try { onChange?.(await apiRequest<Space>(`/spaces/${space.id}`, { method: "PATCH", body: JSON.stringify({ visibility }) })); }
              catch { setError("Couldn’t change visibility. Try again."); }
              finally { setSaving(false); }
            }}>
              <label>Visibility <select value={visibility} onChange={e => setVisibility(e.target.value as "private" | "public")} className="border rounded p-2 ml-2"><option value="private">Private</option><option value="public">Public</option></select></label>
              <button disabled={saving || visibility === space.visibility} className="underline disabled:opacity-40">{saving ? "Saving…" : "Save visibility"}</button>
              <p className="w-full text-xs text-neutral-600">Public allows anyone to view memories and displays contributions on public profiles.</p>
              {error && <p role="alert">{error}</p>}
            </form>

            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowGuestModal(true)}
                className="gap-1.5 text-xs font-semibold h-8 px-3 rounded-lg"
              >
                <span>Guest uploads:</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  space.guest_uploads_enabled ? "bg-black text-white" : "bg-neutral-200 text-neutral-600"
                }`}>
                  {space.guest_uploads_enabled ? "ON" : "OFF"}
                </span>
              </Button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {space.is_member && (
          <div className="flex flex-col gap-2 max-w-md">
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

            {/* Contextual Contribute as Guest for signed-in members */}
            {space.guest_uploads_enabled && space.guest_token && (
              <div className="flex items-center justify-between px-3 py-2 bg-neutral-50 rounded-xl border border-neutral-200/70 text-xs">
                <span className="text-neutral-600">Guest uploads active</span>
                <Link
                  href={`/g/${space.guest_token}`}
                  className="font-bold text-neutral-900 hover:underline flex items-center gap-1"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Contribute as Guest</span>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scannable/Printable Member Invite QR Modal */}
      <InviteModal
        spaceName={space.name}
        inviteCode={space.invite_code}
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />

      {/* Guest Uploads Setting & QR Modal (Owner) */}
      <GuestUploadsModal
        space={space}
        isOpen={showGuestModal}
        onClose={() => setShowGuestModal(false)}
        onUpdate={(updated) => onChange?.(updated)}
      />
    </div>
  );
}

