"use client";

import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Copy, Check, Share2 } from "lucide-react";
import { Button } from "../ui/Button";

interface InviteModalProps {
  spaceName: string;
  inviteCode: string;
  isOpen: boolean;
  onClose: () => void;
}

export function InviteModal({
  spaceName,
  inviteCode,
  isOpen,
  onClose,
}: InviteModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const inviteUrl = `${origin}/join/${inviteCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${spaceName} on OMLU`,
          text: `Join our private Space "${spaceName}" on OMLU — Our Memories Link Us`,
          url: inviteUrl,
        });
      } catch {
        // User cancelled
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center relative border border-neutral-100">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-neutral-500 hover:text-black hover:bg-neutral-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand */}
        <span className="text-xs font-black tracking-widest text-neutral-500 uppercase mb-1">
          omlu
        </span>
        <h3 className="text-xl font-black text-neutral-900 mb-1">{spaceName}</h3>
        <p className="text-xs text-neutral-500 mb-6">
          Scan to join this Space on OMLU
        </p>

        {/* QR Code Container */}
        <div className="p-4 bg-white rounded-2xl border-2 border-neutral-900 shadow-inner mb-6 inline-block">
          <QRCodeSVG
            value={inviteUrl}
            size={180}
            level="H"
            includeMargin={false}
            className="w-44 h-44"
          />
        </div>

        {/* Invite URL box */}
        <div className="w-full bg-neutral-100 rounded-xl px-3 py-2 text-xs font-mono text-neutral-700 truncate mb-4 select-all">
          {inviteUrl}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 w-full">
          <Button
            variant="primary"
            onClick={handleCopy}
            className="w-full gap-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Invite Link</span>
              </>
            )}
          </Button>

          {typeof navigator !== "undefined" && "share" in navigator && (
            <Button
              variant="outline"
              onClick={handleNativeShare}
              className="w-full gap-2"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Link</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
