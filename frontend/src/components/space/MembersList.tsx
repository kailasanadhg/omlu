"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, UserMinus, LogOut } from "lucide-react";
import { SpaceMember } from "@/types";
import { apiRequest } from "@/lib/api";
import { Avatar } from "../ui/Avatar";
import { useAuth } from "@/lib/auth";

interface MembersListProps {
  spaceId: string;
  isOwner: boolean;
  members: SpaceMember[];
  onMembersChanged: () => void;
}

export function MembersList({
  spaceId,
  isOwner,
  members,
  onMembersChanged,
}: MembersListProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemoveMember = async (memberUserId: string, memberName: string) => {
    const isSelf = memberUserId === user?.id;
    const msg = isSelf
      ? "Are you sure you want to leave this Space?"
      : `Are you sure you want to remove ${memberName} from this Space?`;
    if (!confirm(msg)) return;

    setRemovingId(memberUserId);
    try {
      await apiRequest(`/spaces/${spaceId}/members/${memberUserId}`, {
        method: "DELETE",
      });
      if (isSelf) {
        router.push("/spaces");
      } else {
        onMembersChanged();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove member";
      alert(message);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="w-full bg-white divide-y divide-neutral-100">
      {members.map((member) => {
        const isSelf = member.user_id === user?.id;
        const isMemberOwner = member.role === "owner";

        return (
          <div
            key={member.id}
            className="flex items-center justify-between px-4 py-3.5"
          >
            <Link
              href={`/u/${member.username}`}
              className="flex items-center gap-3 group"
            >
              <Avatar
                src={member.avatar_url}
                name={member.display_name}
                size="md"
              />
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-neutral-900 group-hover:underline">
                    {member.display_name}
                  </span>
                  {isMemberOwner && (
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-700">
                      <ShieldCheck className="w-3 h-3 text-neutral-600" />
                      <span>Owner</span>
                    </span>
                  )}
                </div>
                <span className="text-xs text-neutral-500">
                  @{member.username}
                </span>
              </div>
            </Link>

            {/* Actions */}
            <div>
              {isOwner && !isMemberOwner && (
                <button
                  onClick={() => handleRemoveMember(member.user_id, member.display_name)}
                  disabled={removingId === member.user_id}
                  className="p-2 text-neutral-400 hover:text-red-600 transition-colors"
                  title="Remove from Space"
                >
                  <UserMinus className="w-4 h-4" />
                </button>
              )}

              {!isOwner && isSelf && (
                <button
                  onClick={() => handleRemoveMember(member.user_id, member.display_name)}
                  disabled={removingId === member.user_id}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-red-600 transition-colors px-2.5 py-1 rounded-lg border border-neutral-200"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Leave</span>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
