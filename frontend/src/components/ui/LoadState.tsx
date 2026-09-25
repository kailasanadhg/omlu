"use client";
export function LoadState({ loading, error, retry }: { loading?: boolean; error?: string; retry?: () => void }) {
  return <div className="min-h-60 flex flex-col items-center justify-center gap-4 p-8 text-center" role={error ? "alert" : "status"}>
    <p>{error || (loading ? "Loading…" : "Nothing here yet.")}</p>
    {error && retry && <button onClick={retry} className="rounded-full border px-5 py-2">Try again</button>}
  </div>;
}
