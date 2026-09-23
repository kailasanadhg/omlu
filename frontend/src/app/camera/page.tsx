"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X, SwitchCamera, AlertCircle, Sparkles, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Space, CloudinarySignature, Memory } from "@/types";
import { uploadDirectToCloudinary } from "@/lib/cloudinary";

interface CaptureItem {
  id: string;
  blob: Blob;
  width: number;
  height: number;
}

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
  const [statusMessage, setStatusMessage] = useState<string>("One tap adds this moment.");
  const [statusType, setStatusType] = useState<"idle" | "adding" | "success" | "error">("idle");
  const [pendingUploads, setPendingUploads] = useState<number>(0);
  const [recentCaptureCount, setRecentCaptureCount] = useState<number>(0);

  // Background queue
  const queueRef = useRef<CaptureItem[]>([]);
  const isProcessingQueueRef = useRef(false);
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

  // Space ref for queue processing
  const spaceRef = useRef<Space | null>(space);
  useEffect(() => {
    spaceRef.current = space;
  }, [space]);
  const [retryCount, setRetryCount] = useState(0);

  // Initialize camera stream
  useEffect(() => {
    let isCancelled = false;

    const init = async () => {
      // Stop any existing stream
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

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (!isCancelled) {
              videoRef.current?.play().catch(console.error);
              setIsCameraReady(true);
            }
          };
        }
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
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, [facingMode, retryCount]);

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

  // Background queue processing
  const processNextInQueue = async () => {
    if (isProcessingQueueRef.current || queueRef.current.length === 0 || !spaceId) {
      return;
    }

    isProcessingQueueRef.current = true;
    const item = queueRef.current.shift()!;

    setStatusType("adding");
    setStatusMessage("Adding...");

    try {
      // 1. Get Cloudinary signed signature
      const signatureData = await apiRequest<CloudinarySignature>(
        "/media/cloudinary-sign",
        {
          method: "POST",
          body: JSON.stringify({
            purpose: "memory",
            space_id: spaceId,
          }),
        }
      );

      // 2. Direct browser upload to Cloudinary
      const uploadResult = await uploadDirectToCloudinary(item.blob, signatureData);

      // 3. Post to FastAPI /memories immediately (no caption, defaulted date)
      await apiRequest<Memory>("/memories", {
        method: "POST",
        body: JSON.stringify({
          space_id: spaceId,
          media_items: [
            {
              cloudinary_public_id: uploadResult.public_id,
              cloudinary_asset_id: uploadResult.asset_id,
              secure_url: uploadResult.secure_url,
              format: uploadResult.format || "jpg",
              width: uploadResult.width || item.width,
              height: uploadResult.height || item.height,
              bytes: uploadResult.bytes,
              position: 0,
            },
          ],
        }),
      });

      // Update counters
      setPendingUploads((prev) => Math.max(0, prev - 1));
      setRecentCaptureCount((prev) => prev + 1);

      // Show success
      setStatusType("success");
      setStatusMessage(`Added to ${spaceRef.current?.name || "Space"} ✓`);

      // Reset back to idle prompt after 2.5 seconds if no new uploads
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        setStatusType("idle");
        setStatusMessage("One tap adds this moment.");
      }, 2500);
    } catch (err: unknown) {
      console.error("Failed to upload moment:", err);
      setStatusType("error");
      setStatusMessage("Failed to upload. Check connection.");
      setPendingUploads((prev) => Math.max(0, prev - 1));
    } finally {
      isProcessingQueueRef.current = false;
      // Continue with remaining queue
      if (queueRef.current.length > 0) {
        processNextInQueue();
      }
    }
  };

  // Instant shutter tap handler
  const handleShutter = () => {
    if (!videoRef.current || !isCameraReady) return;

    // 1. Haptic feedback
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(40);
      } catch {
        // Ignore haptic failures
      }
    }

    // 2. Visual flash feedback
    setFlash(true);
    setTimeout(() => setFlash(false), 120);

    // 3. Frame capture via offscreen canvas
    const video = videoRef.current;
    const width = video.videoWidth || 1080;
    const height = video.videoHeight || 1920;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // If front camera, flip horizontally for natural mirror feel
    if (facingMode === "user") {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        const captureItem: CaptureItem = {
          id: Math.random().toString(36).substring(7),
          blob,
          width,
          height,
        };

        // Queue upload immediately
        queueRef.current.push(captureItem);
        setPendingUploads((prev) => prev + 1);

        setStatusType("adding");
        setStatusMessage("Adding...");

        // Process queue
        processNextInQueue();
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

  if (isLoadingSpace || isAuthLoading) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white/50 text-xs">
        <div className="w-7 h-7 border-2 border-white/20 border-t-white rounded-full animate-spin mb-3" />
        <p>Opening camera...</p>
      </div>
    );
  }

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
          {/* Live Video Element */}
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isCameraReady ? "opacity-100" : "opacity-0"
            }`}
          />

          {/* Flash Feedback Layer */}
          <div
            className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-100 ${
              flash ? "opacity-90" : "opacity-0"
            }`}
          />

          {/* Camera Loading Spinner */}
          {!isCameraReady && !cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/40 text-xs">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span>Starting camera...</span>
            </div>
          )}

          {/* Camera Permission / Error Fallback */}
          {cameraError && (
            <div className="absolute inset-0 bg-neutral-950 p-6 flex flex-col items-center justify-center text-center space-y-4">
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
        {/* Large White Shutter Button */}
        <div className="relative flex items-center justify-center">
          <button
            onClick={handleShutter}
            disabled={!isCameraReady}
            aria-label="Capture Moment"
            className="w-20 h-20 rounded-full border-4 border-white/30 flex items-center justify-center active:scale-90 transition-transform duration-100 disabled:opacity-40 disabled:scale-100 group"
          >
            <div className="w-16 h-16 rounded-full bg-white group-active:scale-95 transition-transform shadow-lg" />
          </button>
        </div>

        {/* Dynamic Status Text */}
        <div className="flex items-center justify-center gap-1.5 min-h-[22px] text-xs font-semibold tracking-wide text-center">
          {statusType === "adding" ? (
            <div className="flex items-center gap-2 text-white/80 animate-in fade-in">
              <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span>
                {pendingUploads > 1
                  ? `Adding ${pendingUploads} moments...`
                  : "Adding moment..."}
              </span>
            </div>
          ) : statusType === "success" ? (
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold animate-in zoom-in-95 duration-150">
              <CheckCircle2 className="w-4 h-4" />
              <span>{statusMessage}</span>
            </div>
          ) : statusType === "error" ? (
            <span className="text-red-400 animate-in fade-in">{statusMessage}</span>
          ) : (
            <span className="text-white/50">{statusMessage}</span>
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
        <div className="fixed inset-0 bg-black flex items-center justify-center text-white/50 text-xs">
          Loading camera...
        </div>
      }
    >
      <LiveCameraView />
    </Suspense>
  );
}
