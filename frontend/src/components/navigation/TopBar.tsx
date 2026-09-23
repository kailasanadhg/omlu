"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

export function TopBar() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-neutral-200">
      <div className="max-w-xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="inline-flex items-baseline gap-1.5 focus:outline-none">
          <span className="text-2xl font-black tracking-tight text-black font-sans lowercase">
            omlu
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-black mb-1"></span>
        </Link>

        {user && (
          <div className="flex items-center gap-3">
            <Link
              href="/spaces/new"
              className="text-xs font-semibold px-2.5 py-1 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition-colors"
            >
              + Space
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
