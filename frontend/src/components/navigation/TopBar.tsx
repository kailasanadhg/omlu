"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

export function TopBar() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (pathname === "/camera") return null;

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-neutral-200">
      <div className="max-w-[1600px] mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="inline-flex items-baseline gap-1.5">
          <span className="text-2xl font-black tracking-tight text-black font-sans lowercase">
            omlu
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-black mb-1"></span>
        </Link>

        {user && <nav aria-label="Main navigation" className="hidden md:flex items-center gap-6 text-sm">
          <Link href="/">Home</Link><Link href="/spaces">Spaces</Link>
          <Link href="/memory/new">Add memory</Link><Link href="/activity">Activity</Link>
          <Link href={`/u/${user.username}`}>@{user.username}</Link>
        </nav>}

      </div>
    </header>
  );
}
