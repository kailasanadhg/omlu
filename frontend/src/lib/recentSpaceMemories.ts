import type { MemoryPresentation } from "@/types";

export interface RecentSpaceMemory {
  id: string;
  space_id: string;
  created_at: string;
  image_url: string | null;
  image_width?: number | null;
  image_height?: number | null;
  presentation?: MemoryPresentation | null;
}

export interface RecentSpaceMemoriesResponse {
  server_time: string;
  memories: RecentSpaceMemory[];
}

export const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Strictly younger than 24 hours at the server's snapshot time. */
export function groupRecentMemories(
  memories: RecentSpaceMemory[],
  serverTime: string,
): Map<string, RecentSpaceMemory[]> {
  const now = Date.parse(serverTime);
  const grouped = new Map<string, RecentSpaceMemory[]>();
  if (!Number.isFinite(now)) return grouped;
  for (const memory of memories) {
    const created = Date.parse(memory.created_at);
    if (!Number.isFinite(created) || created > now || now - created >= RECENT_WINDOW_MS) continue;
    const list = grouped.get(memory.space_id) ?? [];
    list.push(memory);
    grouped.set(memory.space_id, list);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id));
  }
  return grouped;
}
