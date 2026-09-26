"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  X,
  SwitchCamera,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  RotateCw,
  LogOut,
  Shield,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { GuestSpacePreview, DisplayShape, MemoryPresentation, CloudinarySignature } from "@/types";
import { cameraPresentation, displayShapes, shapeAspect } from "@/lib/presentation";
import { DropCropEditor } from "@/components/camera/DropCropEditor";
import { PresentedPhoto } from "@/components/ui/PresentedPhoto";
import { uploadDirectToCloudinary } from "@/lib/cloudinary";
import { sanitizeUserErrorMessage } from "@/lib/dropQueue";

interface UploadTask {
  id: string;
  blob: Blob;
  width: number;
  height: number;
  presentation: MemoryPresentation;
}

function GuestCameraView() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const { user } = useAuth();
  const [spacePreview, setSpacePreview] = useState<GuestSpacePreview | null>(null);
  const [isLoadingSpace, setIsLoadingSpace] = useState(true);
  const [spaceError, setSpaceError] = useState<string | null>(null);

  // Guest claim session
  const [guestSession, setGuestSession] = useState<{ sessionId: string; claimToken: string } | null>(null);

  // Camera stream state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [previewFormat, setPreviewFormat] = useState<DisplayShape>("portrait_3_4");
  const [draft, setDraft] = useState<{ blob: Blob; url: string; width: number; height: number } | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef(new Set<string>());

  // Shutter & feedback state
  const [flash, setFlash] = useState(false);
  const [lastPreview, setLastPreview] = useState<{
    url: string;
    width: number;
    height: number;
    presentation: MemoryPresentation;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("Choose a frame, then capture.");
  const [statusType, setStatusType] = useState<"idle" | "adding" | "success" | "error">("idle");
  const [recentCaptureCount, setRecentCaptureCount] = useState<number>(0);
  const [inFlightCount, setInFlightCount] = useState<number>(0);
  const [lastFailedTask, setLastFailedTask] = useState<UploadTask | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Post-upload CTA state for accountless guests
  const [showPostUploadCta, setShowPostUploadCta] = useState(false);

  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up object URLs on unmount
  useEffect(() => () => {
    for (const url of objectUrls.current) URL.revokeObjectURL(url);
    objectUrls.current.clear();
  }, []);

  // Fetch guest space details and establish guest session
  useEffect(() => {
    if (!token) return;
    let isMounted = true;

    apiRequest<GuestSpacePreview>(`/spaces/guest/${token}`)
      .then((data) => {
        if (!isMounted) return;
        setSpacePreview(data);

        // Check if a guest session is already stored in localStorage
        try {
          const stored = localStorage.getItem("omlu_guest_session");
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed?.guest_session_id && parsed?.guest_claim_token) {
              setGuestSession({
                sessionId: parsed.guest_session_id,
                claimToken: parsed.guest_claim_token,
              });
              return;
            }
          }
        } catch {}

        // Otherwise save the new session from the server
        const newSession = {
          guest_session_id: data.guest_session_id,
          guest_claim_token: data.guest_claim_token,
        };
        try {
          localStorage.setItem("omlu_guest_session", JSON.stringify(newSession));
        } catch {}
        setGuestSession({
          sessionId: data.guest_session_id,
          claimToken: data.guest_claim_token,
        });
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        console.error("Failed to load guest space preview:", err);
        setSpaceError(
          "Guest uploads are currently unavailable for this Space. The link may have expired or guest contributions may have been disabled by the owner."
        );
      })
      .finally(() => {
        if (isMounted) setIsLoadingSpace(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Video attachment helper
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

    const initCamera = async () => {
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
        console.error("Guest camera access error:", err);
        const name = err instanceof Error ? err.name : "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setCameraError("Camera access denied. Please allow camera permissions to contribute.");
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          setCameraError("No camera device found on this system.");
        } else {
          setCameraError("Unable to access camera. Please check your camera permissions.");
        }
      }
    };

    initCamera();

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

  // Attempt attachment when videoRef mounts or loading changes
  useEffect(() => {
    attachStream();
  }, [isLoadingSpace, attachStream]);

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

  // Perform background upload of a captured memory
  const processUpload = async (task: UploadTask) => {
    setInFlightCount((prev) => prev + 1);
    setStatusType("adding");
    setStatusMessage("Adding moment to Space...");

    try {
      // Step 1: Sign upload with guest endpoint
      const signResponse = await apiRequest<CloudinarySignature>("/media/guest-cloudinary-sign", {
        method: "POST",
        body: JSON.stringify({
          guest_token: token,
          guest_session_id: guestSession?.sessionId,
          client_id: task.id,
        }),
      });

      // Step 2: Upload direct to Cloudinary
      await uploadDirectToCloudinary(
        task.blob,
        signResponse,
        undefined,
        { timeoutMs: 45000 }
      );

      // Step 3: Create guest memory
      await apiRequest("/memories/guest", {
        method: "POST",
        body: JSON.stringify({
          guest_token: token,
          client_id: task.id,
          caption: null,
          memory_date: new Date().toISOString().split("T")[0],
          presentation: task.presentation,
          guest_session_id: guestSession?.sessionId,
          guest_claim_token: guestSession?.claimToken,
          media_items: [
            {
              upload_session_id: signResponse.upload_session_id,
            },
          ],
        }),
      });

      // Success feedback
      setRecentCaptureCount((prev) => prev + 1);
      setStatusType("success");
      setStatusMessage(`Added to ${spacePreview?.name || "Space"} ✓`);
      setLastFailedTask(null);

      // Show post-upload CTA for unregistered guests
      if (!user) {
        setShowPostUploadCta(true);
      }

      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        setStatusType("idle");
        setStatusMessage("Choose a frame, then capture.");
      }, 3000);
    } catch (err: unknown) {
      console.error("Guest memory upload error:", err);
      setStatusType("error");
      setStatusMessage(sanitizeUserErrorMessage(err));
      setLastFailedTask(task);
    } finally {
      setInFlightCount((prev) => Math.max(0, prev - 1));
    }
  };

  // Gallery file handler
  const handleGallery = async (file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    objectUrls.current.add(url);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      setDraft({ blob: file, url, width: image.naturalWidth, height: image.naturalHeight });
    } catch {
      URL.revokeObjectURL(url);
      objectUrls.current.delete(url);
      setStatusType("error");
      setStatusMessage("Couldn't open that photo.");
    }
  };

  const confirmDraft = (presentation: MemoryPresentation) => {
    if (!draft || !spacePreview) return;
    const taskId = crypto.randomUUID();
    const task: UploadTask = {
      id: taskId,
      blob: draft.blob,
      width: draft.width,
      height: draft.height,
      presentation,
    };
    setLastPreview({ url: draft.url, width: draft.width, height: draft.height, presentation });
    setDraft(null);
    void processUpload(task);
  };

  // Instant shutter capture: NO crop screen; framing is preserved from previewFormat
  const handleShutter = () => {
    const video = videoRef.current;
    if (!video || !isCameraReady || !spacePreview) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    const selectedShape = previewFormat;
    if (width <= 0 || height <= 0) return;

    // 1. Instant haptic feedback
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(40);
      } catch {}
    }

    // 2. Instant visual flash
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

    // 4. Capture blob & trigger non-blocking background upload
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const taskId = crypto.randomUUID();
        const presentation = cameraPresentation(width, height, selectedShape);
        const url = URL.createObjectURL(blob);
        objectUrls.current.add(url);

        if (lastPreview) {
          URL.revokeObjectURL(lastPreview.url);
          objectUrls.current.delete(lastPreview.url);
        }
        setLastPreview({ url, width, height, presentation });

        const task: UploadTask = {
          id: taskId,
          blob,
          width,
          height,
          presentation,
        };

        void processUpload(task);
      },
      "image/jpeg",
      0.92
    );
  };

  const handleClose = () => {
    if (user && spacePreview?.id) {
      router.push(`/spaces/${spacePreview.id}`);
    } else {
      router.push("/");
    }
  };

  const handleRetryFailed = () => {
    if (lastFailedTask) {
      void processUpload(lastFailedTask);
    }
  };

  // Error screen when guest uploads are disabled or invalid
  if (spaceError) {
    return (
      <div className="fixed inset-0 bg-neutral-950 text-white flex flex-col items-center justify-center p-6 text-center select-none z-50">
        <div className="w-16 h-16 rounded-3xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-amber-400 mb-4 shadow-xl">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Guest Uploads Unavailable</h1>
        <p className="text-xs text-neutral-400 max-w-sm leading-relaxed mb-6">
          {spaceError}
        </p>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-full bg-white text-black text-xs font-bold hover:bg-neutral-200 transition shadow"
        >
          Return to OMLU
        </Link>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col justify-between overflow-hidden select-none z-50">
      {/* 1. TOP BAR */}
      <header className="w-full max-w-md mx-auto px-4 pt-4 pb-2 flex flex-col gap-2 z-20">
        {/* Main Header Row */}
        <div className="flex items-center justify-between">
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
              {spacePreview ? `Contribute to ${spacePreview.name}` : "Contribute Memory"}
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
        </div>

        {/* Signed-in Guest Mode Banner */}
        {user && spacePreview && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-full bg-neutral-900/80 backdrop-blur-md border border-white/15 text-[11px] animate-in fade-in">
            <div className="flex items-center gap-1.5 text-neutral-300">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold text-white">Guest Mode Active</span>
              <span className="text-neutral-400 hidden xs:inline">· You will appear as Guest</span>
            </div>
            <Link
              href={`/spaces/${spacePreview.id}`}
              className="flex items-center gap-1 text-amber-300 hover:text-white font-bold transition ml-2"
            >
              <span>Exit Guest Mode</span>
              <LogOut className="w-3 h-3" />
            </Link>
          </div>
        )}
      </header>

      {/* 2. FLOATING VIEWFINDER */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-2 flex items-center justify-center relative min-h-0">
        <div
          className={`relative max-w-full shrink-0 overflow-hidden bg-neutral-900 ring-1 ring-white/10 shadow-2xl flex items-center justify-center ${
            previewFormat === "circle" ? "rounded-full" : "rounded-3xl"
          }`}
          style={{
            aspectRatio: shapeAspect(previewFormat),
            width: `min(100%, calc((100dvh - 280px) * ${shapeAspect(previewFormat)}))`,
          }}
        >
          {/* Live Video Element */}
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

          {/* Loading overlay for Space */}
          {isLoadingSpace && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white/80 text-xs z-30">
              <div className="w-7 h-7 border-2 border-white/20 border-t-white rounded-full animate-spin mb-3" />
              <p>Opening camera...</p>
            </div>
          )}

          {/* Camera Loading Spinner */}
          {!isCameraReady && !cameraError && !isLoadingSpace && (
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
                  Close
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
      <footer className="w-full max-w-md mx-auto px-4 pt-2 pb-6 flex flex-col items-center gap-3 z-20">
        {/* Subtle Post-Upload Account Creation CTA Banner */}
        {showPostUploadCta && !user && spacePreview && (
          <div className="w-full p-3.5 bg-neutral-900/95 backdrop-blur-md rounded-2xl border border-white/20 text-white shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-white">Memory added to {spacePreview.name}</p>
                  <p className="text-[11px] text-neutral-300 mt-0.5">
                    Keep your memories with OMLU when this session ends.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPostUploadCta(false)}
                className="text-neutral-400 hover:text-white p-1"
                aria-label="Dismiss banner"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-end gap-2.5 mt-2.5 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowPostUploadCta(false)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white font-medium"
              >
                Maybe later
              </button>
              <Link
                href={`/signup?guest_session=${guestSession?.sessionId}&claim_token=${guestSession?.claimToken}&return_to=/spaces/${spacePreview.id}`}
                className="px-3.5 py-1.5 bg-white text-black text-xs font-bold rounded-full hover:bg-neutral-100 transition shadow"
              >
                Create account
              </Link>
            </div>
          </div>
        )}

        {/* Framing Selector */}
        <div className="w-full" aria-label="Camera framing guide">
          <p className="text-center text-[11px] text-white/65 mb-2">Choose your frame before capture</p>
          <div className="flex justify-center gap-2">
            {displayShapes.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setPreviewFormat(value)}
                aria-label={`Frame ${label} format`}
                aria-pressed={previewFormat === value}
                className={`min-w-12 h-9 px-2 rounded-full border text-xs font-semibold transition-colors ${
                  previewFormat === value
                    ? "bg-white text-black border-white"
                    : "text-white border-white/40 bg-white/10"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Controls Bar: Preview Thumbnail + Shutter Button + Gallery */}
        <div className="w-full flex items-center justify-between px-6">
          {/* Left: Immediate Local Captured Preview */}
          <div className="w-14 h-14 flex items-center justify-center">
            {lastPreview ? (
              <div
                className="max-w-12 max-h-12 overflow-hidden border-2 border-white/40 shadow-lg animate-in zoom-in-75"
                style={{ width: `min(48px, ${48 * shapeAspect(lastPreview.presentation.display_shape)}px)` }}
              >
                <PresentedPhoto
                  src={lastPreview.url}
                  alt="Captured preview"
                  imageWidth={lastPreview.width}
                  imageHeight={lastPreview.height}
                  presentation={lastPreview.presentation}
                />
              </div>
            ) : (
              <div className="w-12 h-12" />
            )}
          </div>

          {/* Center: Large Shutter Button */}
          <button
            onClick={handleShutter}
            disabled={!isCameraReady || isLoadingSpace}
            aria-label="Capture Moment"
            className="w-20 h-20 rounded-full border-4 border-white/30 flex items-center justify-center active:scale-90 transition-transform duration-100 disabled:opacity-40 disabled:scale-100 group"
          >
            <div className="w-16 h-16 rounded-full bg-white group-active:scale-95 transition-transform shadow-lg" />
          </button>

          {/* Right: Gallery Picker */}
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Choose photo from gallery"
            onChange={(event) => {
              void handleGallery(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={!spacePreview}
            className="w-14 h-14 text-xs font-semibold text-white/80 hover:text-white disabled:opacity-40 flex items-center justify-center"
          >
            Gallery
          </button>
        </div>

        {/* Dynamic Status Text */}
        <div className="flex items-center justify-center gap-1.5 min-h-[22px] text-xs font-semibold tracking-wide text-center">
          {statusType === "adding" ? (
            <div className="flex items-center gap-2 text-white/80 animate-in fade-in">
              <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span>{inFlightCount > 1 ? `Adding ${inFlightCount} moments...` : statusMessage}</span>
            </div>
          ) : statusType === "success" ? (
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold animate-in zoom-in-95 duration-150">
              <CheckCircle2 className="w-4 h-4" />
              <span>{statusMessage}</span>
            </div>
          ) : statusType === "error" ? (
            <div className="flex items-center gap-2 text-red-400 animate-in fade-in">
              <span>{statusMessage}</span>
              {lastFailedTask && (
                <button
                  onClick={handleRetryFailed}
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

      {/* Gallery Crop Positioner */}
      {draft && (
        <DropCropEditor
          key={draft.url}
          src={draft.url}
          imageWidth={draft.width}
          imageHeight={draft.height}
          initialShape={previewFormat}
          onConfirm={confirmDraft}
          onCancel={() => {
            URL.revokeObjectURL(draft.url);
            objectUrls.current.delete(draft.url);
            setDraft(null);
          }}
        />
      )}
    </div>
  );
}

export default function GuestCameraPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 bg-black flex items-center justify-center text-white/80 text-xs">
          Opening camera...
        </div>
      }
    >
      <GuestCameraView />
    </Suspense>
  );
}
