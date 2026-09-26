"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/Button";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return_to") || "/";

  const { login, claimGuestMemories } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError("Please fill in all fields");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      await login(identifier, password);
      try {
        const stored = typeof window !== "undefined" ? localStorage.getItem("omlu_guest_session") : null;
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.guest_session_id && parsed?.guest_claim_token) {
            await claimGuestMemories(parsed.guest_session_id, parsed.guest_claim_token);
          }
        }
      } catch (claimErr) {
        console.warn("Failed to claim guest session upon login:", claimErr);
      }
      router.push(returnTo);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid credentials. Please try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-6rem)] px-6 py-12 max-w-sm mx-auto">
      {/* Brand */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-black tracking-tight text-neutral-900 lowercase mb-1">
          omlu
        </h1>
        <p className="text-xs text-neutral-500 font-medium italic">
          Our Memories Link Us.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full space-y-4">
        {error && (
          <div className="p-3 text-xs font-semibold rounded-xl bg-red-50 text-red-700 border border-red-100">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
            Email or Username
          </label>
          <input
            type="text"
            required
            autoCapitalize="none"
            placeholder="you@domain.com or @username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full text-sm text-neutral-900 placeholder:text-neutral-400 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
            Password
          </label>
          <div className="relative flex items-center">
            <input
              type={showPassword ? "text" : "password"}
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full text-sm text-neutral-900 placeholder:text-neutral-400 bg-neutral-50 border border-neutral-200 rounded-xl pl-4 pr-11 py-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3.5 text-neutral-500 hover:text-black transition-colors p-1"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
          className="w-full mt-2 h-12 text-sm font-bold"
        >
          Log in
        </Button>
      </form>

      {/* Switch to Signup */}
      <div className="mt-8 text-center text-xs text-neutral-500">
        Don&apos;t have an account?{" "}
        <Link
          href={`/signup${returnTo !== "/" ? `?return_to=${encodeURIComponent(returnTo)}` : ""}`}
          className="font-bold text-neutral-900 hover:underline"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-neutral-600">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
