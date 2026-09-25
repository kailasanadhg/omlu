"use client";
import { LoadState } from "@/components/ui/LoadState";
export default function ErrorPage({ retry }: { error: Error; retry: () => void }) {
  return <LoadState error="Couldn't display this page." retry={retry} />;
}
