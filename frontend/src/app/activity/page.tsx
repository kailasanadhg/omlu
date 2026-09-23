"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, UserPlus, Bell } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { ActivityItem } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatRelativeTime } from "@/lib/dates";

export default function ActivityPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login");
    }
  }, [user, isAuthLoading, router]);

  useEffect(() => {
    if (!user) return;
    apiRequest<ActivityItem[]>("/activity")
      .then((data) => setActivities(data))
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  }, [user]);

  if (isAuthLoading || (isLoading && user)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-neutral-600 text-xs">
        <div className="animate-spin w-6 h-6 border-2 border-black border-t-transparent rounded-full mb-3" />
        <span>Loading activity...</span>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-5 max-w-xl mx-auto">
      <h1 className="text-2xl font-black tracking-tight text-neutral-900 mb-4">
        Activity
      </h1>

      {activities.length === 0 ? (
        <EmptyState
          title="No activity yet"
          subtitle="When someone likes or comments on your memories, or joins your Spaces, you will see it here."
          icon={<Bell className="w-8 h-8" />}
        />
      ) : (
        <div className="divide-y divide-neutral-100">
          {activities.map((act) => {
            const isLike = act.type === "like";
            const isComment = act.type === "comment";
            const isJoin = act.type === "joined_space";

            return (
              <div
                key={act.id}
                className="flex items-center justify-between py-3.5 gap-3"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="relative">
                    <Link href={`/u/${act.actor_username}`}>
                      <Avatar
                        src={act.actor_avatar_url}
                        name={act.actor_display_name}
                        size="md"
                      />
                    </Link>
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-xs">
                      {isLike && <Heart className="w-3 h-3 fill-red-600 text-red-600" />}
                      {isComment && <MessageCircle className="w-3 h-3 text-blue-600 fill-blue-600" />}
                      {isJoin && <UserPlus className="w-3 h-3 text-neutral-700" />}
                    </span>
                  </div>

                  <div className="text-xs leading-snug">
                    <Link
                      href={`/u/${act.actor_username}`}
                      className="font-bold text-neutral-900 hover:underline mr-1"
                    >
                      @{act.actor_username}
                    </Link>
                    <span className="text-neutral-700">
                      {isLike && "liked your memory"}
                      {isComment && (act.content || "commented on your memory")}
                      {isJoin && (act.content || "joined your Space")}
                    </span>
                    <span className="text-neutral-500 block text-[10px] mt-0.5">
                      {formatRelativeTime(act.created_at)}
                    </span>
                  </div>
                </div>

                {act.space_id && (
                  <Link
                    href={`/spaces/${act.space_id}`}
                    className="text-xs font-bold text-neutral-700 hover:text-black shrink-0 px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200"
                  >
                    View
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
