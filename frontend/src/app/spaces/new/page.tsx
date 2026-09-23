"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Space } from "@/types";
import { Button } from "@/components/ui/Button";

export default function NewSpacePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please provide a name for your Space");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const space = await apiRequest<Space>("/spaces", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      // Navigate directly into the new Space — it is now accessible
      // from the main navigation and SpaceCircles on the home feed.
      router.push(`/spaces/${space.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create Space";
      setError(message);
      setIsLoading(false);
    }
  };

  // CREATION FORM
  return (
    <div className="w-full px-5 py-6 max-w-sm mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/spaces" className="p-1 rounded-full text-neutral-500 hover:text-black">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-black tracking-tight text-neutral-900">
          Create Space
        </h1>
      </div>

      <form onSubmit={handleCreate} className="space-y-4">
        {error && (
          <div className="p-3 text-xs font-semibold rounded-xl bg-red-50 text-red-700 border border-red-100">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
            Space Name *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Goa Trip 2027, The Boys, Class 10B..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-sm text-neutral-900 placeholder:text-neutral-400 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
            Description (Optional)
          </label>
          <textarea
            rows={3}
            placeholder="What is this Space for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full text-sm text-neutral-900 placeholder:text-neutral-400 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black transition-all resize-none"
          />
        </div>

        <p className="text-xs text-neutral-600 leading-relaxed">
          All Spaces on OMLU are private and invite-only. Anyone with the invite link or QR code can join.
        </p>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          className="w-full mt-4 h-12 font-bold"
        >
          Create Space
        </Button>
      </form>
    </div>
  );
}
