"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function MemoryNewRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const spaceId = searchParams.get("space_id");

  useEffect(() => {
    if (spaceId) {
      router.replace(`/camera?space_id=${spaceId}`);
    } else {
      router.replace("/spaces");
    }
  }, [spaceId, router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] text-xs text-neutral-400">
      Redirecting to camera...
    </div>
  );
}

export default function NewMemoryPage() {
  return (
    <Suspense fallback={null}>
      <MemoryNewRedirect />
    </Suspense>
  );
}
