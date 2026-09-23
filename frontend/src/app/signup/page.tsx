"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/Button";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return_to") || "/";

  const { signup } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName || !username || !email || !password) {
      setError("Please fill in all fields");
      return;
    }

    const cleanUsername = username.trim().replace(/^@/, "").toLowerCase();
    if (cleanUsername.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      setError("Username can only contain lowercase letters, numbers, and underscores");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      await signup(email.trim().toLowerCase(), cleanUsername, displayName.trim(), password);
      router.push(returnTo);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create account. Please try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-6rem)] px-6 py-12 max-w-sm mx-auto">
      {/* Brand */}
      <div className="text-center mb-6">
        <h1 className="text-4xl font-black tracking-tight text-neutral-900 lowercase mb-1">
          omlu
        </h1>
        <p className="text-xs text-neutral-500 font-medium italic">
          Our Memories Link Us.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full space-y-3.5">
        {error && (
          <div className="p-3 text-xs font-semibold rounded-xl bg-red-50 text-red-700 border border-red-100">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
            Name
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Kailas Nadh"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full text-sm text-neutral-900 placeholder:text-neutral-400 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
            Username
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-4 text-sm font-bold text-neutral-500">@</span>
            <input
              type="text"
              required
              autoCapitalize="none"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())}
              className="w-full text-sm text-neutral-900 placeholder:text-neutral-400 bg-neutral-50 border border-neutral-200 rounded-xl pl-8 pr-4 py-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black transition-all"
            />
          </div>
          <p className="text-[10px] text-neutral-500 mt-1">
            Letters, numbers, and underscores only.
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
            Email
          </label>
          <input
            type="email"
            required
            autoCapitalize="none"
            placeholder="you@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full text-sm text-neutral-900 placeholder:text-neutral-400 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
            Password
          </label>
          <div className="relative flex items-center">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              placeholder="At least 6 characters"
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
          className="w-full mt-3 h-12 text-sm font-bold"
        >
          Create account
        </Button>
      </form>

      {/* Switch to Login */}
      <div className="mt-8 text-center text-xs text-neutral-500">
        Already have an account?{" "}
        <Link
          href={`/login${returnTo !== "/" ? `?return_to=${encodeURIComponent(returnTo)}` : ""}`}
          className="font-bold text-neutral-900 hover:underline"
        >
          Log in
        </Link>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-neutral-600">Loading...</div>}>
      <SignupForm />
    </Suspense>
  );
}
