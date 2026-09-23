"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Check } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { User, CloudinarySignature } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { processImageForUpload } from "@/lib/imageUtils";
import { uploadDirectToCloudinary } from "@/lib/cloudinary";

function EditProfileForm({ user }: { user: User }) {
  const router = useRouter();
  const { updateUserContext } = useAuth();

  const [displayName, setDisplayName] = useState(user.display_name || "");
  const [username, setUsername] = useState(user.username || "");
  const [bio, setBio] = useState(user.bio || "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatar_url || null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image");
      return;
    }

    setIsUploadingAvatar(true);
    setError("");

    try {
      // 1. Process image on canvas
      const processed = await processImageForUpload(file, 800, 0.9);

      // 2. Request signature for avatar upload
      const signatureData = await apiRequest<CloudinarySignature>(
        "/media/cloudinary-sign",
        {
          method: "POST",
          body: JSON.stringify({ purpose: "avatar" }),
        }
      );

      // 3. Upload directly to Cloudinary
      const res = await uploadDirectToCloudinary(processed.blob, signatureData);
      setAvatarUrl(res.secure_url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to upload avatar";
      setError(message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Name cannot be empty");
      return;
    }

    const cleanUsername = username.trim().replace(/^@/, "").toLowerCase();
    if (cleanUsername.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    setError("");
    setIsSaving(true);
    setSuccess(false);

    try {
      const updated = await apiRequest<User>("/users/me/profile", {
        method: "PATCH",
        body: JSON.stringify({
          display_name: displayName.trim(),
          username: cleanUsername,
          bio: bio.trim() || null,
          avatar_url: avatarUrl,
        }),
      });

      updateUserContext(updated);
      setSuccess(true);
      setTimeout(() => {
        router.push(`/u/${updated.username}`);
      }, 1000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save profile";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full px-5 py-6 max-w-sm mx-auto">
      {/* Top Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-1 rounded-full text-neutral-500 hover:text-black"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-black tracking-tight text-neutral-900">
          Edit Profile
        </h1>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {error && (
          <div className="p-3 text-xs font-semibold rounded-xl bg-red-50 text-red-700 border border-red-100">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 text-xs font-semibold rounded-xl bg-green-50 text-green-700 border border-green-100 flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            <span>Profile updated successfully!</span>
          </div>
        )}

        {/* Avatar Upload */}
        <div className="flex flex-col items-center justify-center py-2">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <Avatar
              src={avatarUrl}
              name={displayName || user.display_name}
              size="xl"
              className="ring-2 ring-neutral-200"
            />
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-6 h-6" />
            </div>
            {isUploadingAvatar && (
              <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center text-white">
                <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full" />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-bold text-neutral-900 mt-2 hover:underline"
          >
            Change Photo
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarChange}
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
            Display Name
          </label>
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full text-sm text-neutral-900 placeholder:text-neutral-400 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
            Username
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-4 text-sm font-bold text-neutral-400">@</span>
            <input
              type="text"
              required
              autoCapitalize="none"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())}
              className="w-full text-sm text-neutral-900 placeholder:text-neutral-400 bg-neutral-50 border border-neutral-200 rounded-xl pl-8 pr-4 py-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
            Bio
          </label>
          <textarea
            rows={3}
            placeholder="Tell your Spaces a little about yourself..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full text-sm text-neutral-900 placeholder:text-neutral-400 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black transition-all resize-none"
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isSaving}
          className="w-full mt-4 h-12 font-bold"
        >
          Save Changes
        </Button>
      </form>
    </div>
  );
}

export default function EditProfilePage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login");
    }
  }, [user, isAuthLoading, router]);

  if (isAuthLoading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-neutral-400 text-xs">
        <div className="animate-spin w-6 h-6 border-2 border-black border-t-transparent rounded-full mb-3" />
        <span>Loading...</span>
      </div>
    );
  }

  return <EditProfileForm key={user.id} user={user} />;
}
