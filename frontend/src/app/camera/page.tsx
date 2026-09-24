"use client";

import React, { useState, useEffect, useRef, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X, SwitchCamera, AlertCircle, Sparkles, CheckCircle2, RotateCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Space } from "@/types";
import {
  enqueueDrop,
  subscribeToPendingDrops,
  subscribeToDropReconciliation,
  initDropQueue,
  retryPendingDrop,
  PendingDrop,
} from "@/lib/dropQueue";

function LiveCameraView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const spaceId = searchParams.get("space_id");

  const { user, isLoading: isAuthLoading } = useAuth();
  const [space, setSpace] = useState<Space | null>(null);
  const [isLoadingSpace, setIsLoadingSpace] = useState(true);

  // Camera stream state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  // Shutter & feedback state
  const [flash, setFlash] = useState(false);
  const [lastPreviewUrl, setLastPreviewUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("One tap adds this moment.");
  const [statusType, setStatusType] = useState<"idle" | "adding" | "success" | "error">("idle");
  const [recentCaptureCount, setRecentCaptureCount] = useState<number>(0);
  const [failedDropId, setFailedDropId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auth guard
  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login");
    }
  }, [user, isAuthLoading, router]);

  // Load space details
  useEffect(() => {
    if (!spaceId) {
      router.replace("/spaces");
      return;
    }

    let isMounted = true;
    apiRequest<Space>(`/spaces/${spaceId}`)
      .then((data) => {
        if (isMounted) setSpace(data);
      })
      .catch((err) => {
        console.error("Failed to load space:", err);
        if (isMounted) setCameraError("Space not found or you are not a member.");
      })
      .finally(() => {
        if (isMounted) setIsLoadingSpace(false);
      });

    return () => {
      isMounted = false;
    };
  }, [spaceId, router]);

  // Initialize drop queue on mount
  useEffect(() => {
    if (user?.id) {
      initDropQueue(user.id);
    }
  }, [user?.id]);

  // Subscribe to pending drops state
  useEffect(() => {
    const unsubscribeDrops = subscribeToPendingDrops((drops: PendingDrop[]) => {
      if (!spaceId) return;
      const spaceDrops = drops.filter((d) => d.spaceId === spaceId);
      const active = spaceDrops.filter(
        (d) => d.status === "queued" || d.status === "signing" || d.status === "uploading" || d.status === "creating"
      );
      const failed = spaceDrops.find((d) => d.status === "failed");

      if (failed) {
        setStatusType("error");
        const safeMessage =
          failed.errorMessage &&
          !failed.errorMessage.includes("String to sign") &&
          !failed.errorMessage.includes("signature") &&
          !failed.errorMessage.includes("cloudinary")
            ? failed.errorMessage
            : "Upload failed. Tap to retry.";
        setStatusMessage(safeMessage);
        setFailedDropId(failed.id);
      } else if (active.length > 0) {
        setStatusType("adding");
        setStatusMessage(active.length > 1 ? `Adding ${active.length} moments...` : "Adding moment...");
        setFailedDropId(null);
      }
    });

    const unsubscribeReconcile = subscribeToDropReconciliation((canonical) => {
      if (canonical.space_id === spaceId) {
        setRecentCaptureCount((prev) => prev + 1);
        setStatusType("success");
        setStatusMessage(`Added to ${space?.name || "Space"} ✓`);

        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(() => {
          setStatusType("idle");
          setStatusMessage("One tap adds this moment.");
        }, 2500);
      }
    });

    return () => {
      unsubscribeDrops();
      unsubscribeReconcile();
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, [spaceId, space?.name]);

  // Stream attachment helper - race condition safe
  const attachStream = useCallback(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    const checkReady = () => {
      video
        .play()
        .then(() => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            setIsCameraReady(true);
          }
        })
        .catch((err) => {
          console.error("Video play error:", err);
        });
    };

    video.onloadedmetadata = checkReady;
    video.oncanplay = checkReady;
    if (video.readyState >= 2 && video.videoWidth > 0) {
      checkReady();
    }
  }, []);

  // Initialize camera stream
  useEffect(() => {
    let isCancelled = false;

    const init = async () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (!isCancelled) setCameraError("Camera is not supported on this device/browser.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        attachStream();
      } catch (err: unknown) {
        if (isCancelled) return;
        console.error("Camera access error:", err);
        const name = err instanceof Error ? err.name : "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setCameraError("Camera access denied. Please allow camera permissions to capture live moments.");
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          setCameraError("No camera device found on this system.");
        } else {
          setCameraError("Unable to access camera. Please check your camera permissions.");
        }
      }
    };

    init();

    return () => {
      isCancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [facingMode, retryCount, attachStream]);

  // Attempt attachment whenever videoRef mounts or loading changes
  useEffect(() => {
    attachStream();
  }, [isLoadingSpace, isAuthLoading, attachStream]);

  const toggleCamera = () => {
    setIsCameraReady(false);
    setCameraError(null);
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const handleRetryCamera = () => {
    setIsCameraReady(false);
    setCameraError(null);
    setRetryCount((prev) => prev + 1);
  };

  // Instant non-blocking shutter tap handler
  const handleShutter = () => {
    const video = videoRef.current;
    if (!video || !isCameraReady || !spaceId || !space || !user) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (width <= 0 || height <= 0) return;

    // 1. Instant feedback: haptic vibration
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(40);
      } catch {}
    }

    // 2. Instant feedback: visual flash
    setFlash(true);
    setTimeout(() => setFlash(false), 120);

    // 3. Draw video frame to offscreen canvas
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (facingMode === "user") {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);

    // 4. Encode to blob once at JPEG 0.92 without downscale or second compression
    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        // Immediate local preview URL for instant feedback
        const previewUrl = URL.createObjectURL(blob);
        setLastPreviewUrl(previewUrl);

        // Persistent client UUID for idempotency
        const dropId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `drop_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        setStatusType("adding");
        setStatusMessage("Adding moment...");

        // Enqueue into persistent IndexedDB draft queue and trigger background upload
        enqueueDrop({
          id: dropId,
          userId: user.id,
          spaceId: space.id,
          spaceName: space.name,
          author: {
            id: user.id,
            username: user.username,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
          },
          caption: null,
          memoryDate: new Date().toISOString().split("T")[0],
          createdAt: new Date().toISOString(),
          blob,
          width,
          height,
        });
      },
      "image/jpeg",
      0.92
    );
  };

  const handleClose = () => {
    if (spaceId) {
      router.push(`/spaces/${spaceId}`);
    } else {
      router.push("/spaces");
    }
  };

  const handleRetryFailedDrop = () => {
    if (failedDropId) {
      setStatusType("adding");
      setStatusMessage("Retrying upload...");
      retryPendingDrop(failedDropId);
    }
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col justify-between overflow-hidden select-none z-50">
      {/* 1. TOP BAR */}
      <header className="w-full max-w-md mx-auto px-4 pt-4 pb-2 flex items-center justify-between z-20">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition-all active:scale-95"
          aria-label="Close Camera"
        >
          <X className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Space Target Indicator */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 max-w-[200px] sm:max-w-xs truncate shadow-sm">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-xs font-bold truncate text-white">
            {space?.name || "Space"}
          </span>
        </div>

        {/* Flip Camera Button */}
        <button
          onClick={toggleCamera}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition-all active:scale-95"
          aria-label="Flip Camera"
        >
          <SwitchCamera className="w-5 h-5 stroke-[2]" />
        </button>
      </header>

      {/* 2. FLOATING VIEWFINDER */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-2 flex items-center justify-center relative min-h-0">
        <div className="relative w-full aspect-[3/4] max-h-full rounded-3xl overflow-hidden bg-neutral-900 border border-white/10 shadow-2xl flex items-center justify-center">
          {/* Live Video Element - ALWAYS MOUNTED to prevent race condition */}
          <video
            ref={(el) => {
              videoRef.current = el;
              if (el) attachStream();
            }}
            playsInline
            autoPlay
            muted
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              facingMode === "user" ? "-scale-x-100" : ""
            } ${isCameraReady ? "opacity-100" : "opacity-0"}`}
          />

          {/* Flash Feedback Layer */}
          <div
            className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-100 ${
              flash ? "opacity-90" : "opacity-0"
            }`}
          />

          {/* Loading overlay for Space or Auth */}
          {(isLoadingSpace || isAuthLoading) && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white/80 text-xs z-30">
              <div className="w-7 h-7 border-2 border-white/20 border-t-white rounded-full animate-spin mb-3" />
              <p>Opening camera...</p>
            </div>
          )}

          {/* Camera Loading Spinner */}
          {!isCameraReady && !cameraError && !isLoadingSpace && !isAuthLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/75 text-xs">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span>Starting camera...</span>
            </div>
          )}

          {/* Camera Permission / Error Fallback */}
          {cameraError && (
            <div className="absolute inset-0 bg-neutral-950 p-6 flex flex-col items-center justify-center text-center space-y-4 z-40">
              <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white mb-1">Camera Access Needed</h3>
                <p className="text-xs text-neutral-400 leading-relaxed max-w-xs">
                  {cameraError}
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-xs pt-2">
                <button
                  onClick={handleRetryCamera}
                  className="w-full py-2.5 px-4 bg-white text-black text-xs font-bold rounded-xl active:scale-95 transition"
                >
                  Try Again
                </button>
                <button
                  onClick={handleClose}
                  className="w-full py-2.5 px-4 bg-white/10 text-white text-xs font-semibold rounded-xl hover:bg-white/20 transition"
                >
                  Return to Space
                </button>
              </div>
            </div>
          )}

          {/* Sequential Capture Count Badge */}
          {recentCaptureCount > 0 && (
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[11px] font-bold text-white flex items-center gap-1.5 animate-in fade-in">
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span>{recentCaptureCount} captured</span>
            </div>
          )}
        </div>
      </main>

      {/* 3. CAPTURE CONTROLS & DYNAMIC STATUS */}
      <footer className="w-full max-w-md mx-auto px-4 pt-2 pb-8 flex flex-col items-center gap-4 z-20">
        {/* Controls Bar: Preview Thumbnail + Shutter Button */}
        <div className="w-full flex items-center justify-between px-6">
          {/* Left: Immediate Local Captured Preview */}
          <div className="w-14 h-14 flex items-center justify-center">
            {lastPreviewUrl ? (
              <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-white/40 shadow-lg animate-in zoom-in-75">
                <img
                  src={lastPreviewUrl}
                  alt="Captured preview"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-12 h-12" />
            )}
          </div>

          {/* Center: Large Shutter Button */}
          <button
            onClick={handleShutter}
            disabled={!isCameraReady}
            aria-label="Capture Moment"
            className="w-20 h-20 rounded-full border-4 border-white/30 flex items-center justify-center active:scale-90 transition-transform duration-100 disabled:opacity-40 disabled:scale-100 group"
          >
            <div className="w-16 h-16 rounded-full bg-white group-active:scale-95 transition-transform shadow-lg" />
          </button>

          {/* Right: Balanced Spacer */}
          <div className="w-14 h-14" />
        </div>

        {/* Dynamic Status Text */}
        <div className="flex items-center justify-center gap-1.5 min-h-[22px] text-xs font-semibold tracking-wide text-center">
          {statusType === "adding" ? (
            <div className="flex items-center gap-2 text-white/80 animate-in fade-in">
              <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span>{statusMessage}</span>
            </div>
          ) : statusType === "success" ? (
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold animate-in zoom-in-95 duration-150">
              <CheckCircle2 className="w-4 h-4" />
              <span>{statusMessage}</span>
            </div>
          ) : statusType === "error" ? (
            <div className="flex items-center gap-2 text-red-400 animate-in fade-in">
              <span>{statusMessage}</span>
              {failedDropId && (
                <button
                  onClick={handleRetryFailedDrop}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 hover:bg-red-500/30 text-[11px] font-bold"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          ) : (
            <span className="text-white/80">{statusMessage}</span>
          )}
        </div>
      </footer>
    </div>
  );
}

export default function CameraPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 bg-black flex items-center justify-center text-white/80 text-xs">
          Loading camera...
        </div>
      }
    >
      <LiveCameraView />
    </Suspense>
  );
}
