"use client";

import React, { useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, ArrowRight, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Space } from "@/types";
import { Button } from "@/components/ui/Button";

export default function NewSpacePage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdSpace, setCreatedSpace] = useState<Space | null>(null);
  const [copied, setCopied] = useState(false);

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
      setCreatedSpace(space);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create Space";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const inviteUrl = createdSpace ? `${origin}/join/${createdSpace.invite_code}` : "";

  const handleCopy = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // SUCCESS STEP: "Your Space is ready." with big QR code
  if (createdSpace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-6rem)] px-5 py-8 max-w-sm mx-auto text-center animate-in fade-in">
        <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">
          omlu
        </span>
        <h1 className="text-3xl font-black text-neutral-900 tracking-tight mb-2">
          Your Space is ready.
        </h1>
        <p className="text-xs text-neutral-500 mb-6">
          Share this invite QR code or link with your group.
        </p>

        {/* QR Card */}
        <div className="w-full bg-white rounded-3xl p-6 border-2 border-neutral-900 shadow-xl flex flex-col items-center mb-6">
          <h2 className="text-lg font-black text-neutral-900 mb-1">
            {createdSpace.name}
          </h2>
          <p className="text-[11px] text-neutral-500 mb-5">
            Scan to join this Space on OMLU
          </p>

          <div className="p-3 bg-white rounded-2xl border border-neutral-200 mb-5">
            <QRCodeSVG
              value={inviteUrl}
              size={180}
              level="H"
              includeMargin={false}
              className="w-44 h-44"
            />
          </div>

          <div className="w-full bg-neutral-100 rounded-xl px-3 py-2 text-xs font-mono text-neutral-600 truncate mb-4 select-all">
            {inviteUrl}
          </div>

          <Button
            variant="outline"
            onClick={handleCopy}
            className="w-full gap-2 h-11 text-xs font-bold"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-600" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Invite Link</span>
              </>
            )}
          </Button>
        </div>

        {/* Enter Space */}
        <Link href={`/spaces/${createdSpace.id}`} className="w-full">
          <Button variant="primary" size="lg" className="w-full gap-2 h-12 font-bold shadow-md">
            <span>Enter Space</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    );
  }

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
            className="w-full text-sm bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black transition-all"
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
            className="w-full text-sm bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black transition-all resize-none"
          />
        </div>

        <p className="text-xs text-neutral-400 leading-relaxed">
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
