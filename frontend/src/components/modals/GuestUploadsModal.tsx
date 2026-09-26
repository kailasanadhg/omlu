"use client";

import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Copy, Check, Share2, RefreshCw, AlertTriangle, ShieldCheck } from "lucide-react";
import { Space } from "@/types";
import { apiRequest } from "@/lib/api";
import { Button } from "../ui/Button";

interface GuestUploadsModalProps {
  space: Space;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedSpace: Space) => void;
}

export function GuestUploadsModal({
  space,
  isOpen,
  onClose,
  onUpdate,
}: GuestUploadsModalProps) {
  const [copied, setCopied] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const guestUrl = space.guest_token ? `${origin}/g/${space.guest_token}` : "";

  const handleToggle = async () => {
    setIsToggling(true);
    setError(null);
    try {
      const nextState = !space.guest_uploads_enabled;
      const updated = await apiRequest<Space>(`/spaces/${space.id}/guest-settings`, {
        method: "PATCH",
        body: JSON.stringify({ guest_uploads_enabled: nextState }),
      });
      onUpdate(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update guest upload settings");
    } finally {
      setIsToggling(false);
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    setError(null);
    try {
      const updated = await apiRequest<Space>(`/spaces/${space.id}/regenerate-guest-link`, {
        method: "POST",
      });
      onUpdate(updated);
      setShowRegenConfirm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to regenerate guest link");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopy = () => {
    if (!guestUrl) return;
    navigator.clipboard.writeText(guestUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!guestUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Contribute to ${space.name} on OMLU`,
          text: `Add a memory to "${space.name}" on OMLU without an account`,
          url: guestUrl,
        });
      } catch {
        // User cancelled share sheet
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center relative border border-neutral-100 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-neutral-500 hover:text-black hover:bg-neutral-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand / Title */}
        <span className="text-xs font-black tracking-widest text-neutral-500 uppercase mb-1">
          Space Settings
        </span>
        <h3 className="text-xl font-black text-neutral-900 mb-1">Guest Uploads</h3>
        <p className="text-xs text-neutral-500 mb-5">
          Allow attendees and friends to contribute memories without an OMLU account.
        </p>

        {error && (
          <div className="w-full mb-4 p-2.5 bg-red-50 text-red-700 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* Setting Toggle */}
        <div className="w-full flex items-center justify-between p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/80 mb-5">
          <div className="text-left">
            <span className="text-sm font-bold text-neutral-900 block">
              Guest uploads
            </span>
            <span className="text-[11px] text-neutral-500 block">
              {space.guest_uploads_enabled ? "Enabled — anyone with link can contribute" : "OFF — only members can upload"}
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={space.guest_uploads_enabled}
            disabled={isToggling}
            onClick={handleToggle}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
              space.guest_uploads_enabled ? "bg-black" : "bg-neutral-300"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                space.guest_uploads_enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {space.guest_uploads_enabled && guestUrl ? (
          <>
            {/* Scannable QR Code Container */}
            <div className="p-4 bg-white rounded-2xl border-2 border-neutral-900 shadow-inner mb-4 inline-block">
              <QRCodeSVG
                value={guestUrl}
                size={170}
                level="H"
                includeMargin={false}
                className="w-40 h-40"
              />
            </div>

            {/* Guest URL box */}
            <div className="w-full bg-neutral-100 rounded-xl px-3 py-2 text-xs font-mono text-neutral-700 truncate mb-4 select-all">
              {guestUrl}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 w-full mb-4">
              <Button
                variant="primary"
                onClick={handleCopy}
                className="w-full gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copied Guest Link!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Guest Link</span>
                  </>
                )}
              </Button>

              <Button
                variant="secondary"
                onClick={handleShare}
                className="w-full gap-2"
              >
                <Share2 className="w-4 h-4" />
                <span>Share Guest Link</span>
              </Button>
            </div>

            {/* Regenerate / Revoke Link */}
            {showRegenConfirm ? (
              <div className="w-full p-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-left">
                <div className="flex items-start gap-2 mb-2 text-amber-700 text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Regenerating will revoke the current guest link and QR code immediately. Existing memories will NOT be affected.
                  </span>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowRegenConfirm(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:text-black rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                  >
                    {isRegenerating ? "Regenerating…" : "Confirm Revoke & New Link"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowRegenConfirm(true)}
                className="text-xs font-semibold text-neutral-500 hover:text-red-600 flex items-center gap-1.5 transition-colors py-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Regenerate / Revoke Guest Link</span>
              </button>
            )}
          </>
        ) : (
          <div className="py-6 px-4 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200 w-full text-center">
            <ShieldCheck className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
            <p className="text-xs text-neutral-600 font-medium leading-relaxed">
              When Guest Uploads are turned ON, a scannable QR code and link will be generated for events, weddings, trips, and occasions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
