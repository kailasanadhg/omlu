"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Plus, Heart } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Avatar } from "../ui/Avatar";
import { SpaceSelectorSheet } from "./SpaceSelectorSheet";

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isSpaceSheetOpen, setIsSpaceSheetOpen] = useState(false);

  // If user is not logged in or on login/signup/camera page, don't show bottom nav
  if (!user || pathname === "/login" || pathname === "/signup" || pathname === "/camera") {
    return null;
  }

  const isHome = pathname === "/";
  const isSpaces = pathname.startsWith("/spaces");
  const isActivity = pathname.startsWith("/activity");
  const isProfile = pathname.startsWith(`/u/${user.username}`) || pathname.startsWith("/settings");

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-neutral-200 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 transition-all">
        <div className="max-w-xl mx-auto px-4 flex items-center justify-around h-12">
          {/* Home */}
          <Link
            href="/"
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-colors ${
              isHome ? "text-black" : "text-neutral-500 hover:text-black"
            }`}
            aria-label="Home Feed"
          >
            <Home className={`w-6 h-6 ${isHome ? "stroke-[2.5]" : "stroke-[1.75]"}`} />
          </Link>

          {/* Spaces */}
          <Link
            href="/spaces"
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-colors ${
              isSpaces ? "text-black" : "text-neutral-500 hover:text-black"
            }`}
            aria-label="Spaces"
          >
            <Users className={`w-6 h-6 ${isSpaces ? "stroke-[2.5]" : "stroke-[1.75]"}`} />
          </Link>

          {/* Center Prominent Create (+) Button -> Opens Space Selector */}
          <button
            onClick={() => setIsSpaceSheetOpen(true)}
            className="flex items-center justify-center w-11 h-11 rounded-full bg-black text-white shadow-md active:scale-95 transition-transform"
            aria-label="Add Moment to a Space"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>

        {/* Activity */}
        <Link
          href="/activity"
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-colors ${
            isActivity ? "text-black" : "text-neutral-500 hover:text-black"
          }`}
          aria-label="Activity"
        >
          <Heart className={`w-6 h-6 ${isActivity ? "stroke-[2.5] fill-black" : "stroke-[1.75]"}`} />
        </Link>

        {/* Profile */}
        <Link
          href={`/u/${user.username}`}
          className="flex flex-col items-center justify-center w-12 h-12 rounded-xl"
          aria-label="Profile"
        >
          <div className={`rounded-full p-0.5 ${isProfile ? "ring-2 ring-black" : ""}`}>
            <Avatar src={user.avatar_url} name={user.display_name} size="xs" />
          </div>
        </Link>
      </div>
    </nav>

    <SpaceSelectorSheet
      isOpen={isSpaceSheetOpen}
      onClose={() => setIsSpaceSheetOpen(false)}
    />
  </>
  );
}
