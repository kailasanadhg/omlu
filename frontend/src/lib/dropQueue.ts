import { Memory, CloudinarySignature } from "@/types";
import { apiRequest } from "@/lib/api";
import { uploadDirectToCloudinary, CloudinaryUploadResult } from "@/lib/cloudinary";

export type DropStatus = "queued" | "signing" | "uploading" | "creating" | "failed" | "confirmed";

export interface PendingDrop {
  id: string; // client_id UUID
  userId: string;
  spaceId: string;
  spaceName: string;
  author: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string | null;
  };
  caption: string | null;
  memoryDate: string;
  createdAt: string;
  blob: Blob;
  width: number;
  height: number;
  status: DropStatus;
  progress: number;
  errorMessage?: string | null;
  uploadSessionId?: string | null;
  uploadResult?: CloudinaryUploadResult | null;
  canonicalMemory?: Memory | null;
  retryCount: number;
  lastAttemptAt?: number;
}

const DB_NAME = "omlu_local_v1";
const STORE_NAME = "pending_drops";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB is only available in browser"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("userId", "userId", { unique: false });
          store.createIndex("spaceId", "spaceId", { unique: false });
          store.createIndex("status", "status", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

// In-memory cache of object URLs so we reuse them across renders
const objectUrlCache = new Map<string, string>();

export function getDropLocalUrl(drop: PendingDrop): string {
  let url = objectUrlCache.get(drop.id);
  if (!url && drop.blob) {
    url = URL.createObjectURL(drop.blob);
    objectUrlCache.set(drop.id, url);
  }
  return url || "";
}

export function revokeDropLocalUrl(id: string, delayMs = 10000) {
  const url = objectUrlCache.get(id);
  if (url) {
    if (delayMs > 0) {
      setTimeout(() => {
        URL.revokeObjectURL(url);
        objectUrlCache.delete(id);
      }, delayMs);
    } else {
      URL.revokeObjectURL(url);
      objectUrlCache.delete(id);
    }
  }
}

// Event listeners for pending drops changes
type DropListener = (drops: PendingDrop[]) => void;
type ReconcileListener = (canonical: Memory, clientId: string) => void;

const listeners = new Set<DropListener>();
const reconcileListeners = new Set<ReconcileListener>();

export function subscribeToPendingDrops(listener: DropListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribeToDropReconciliation(listener: ReconcileListener): () => void {
  reconcileListeners.add(listener);
  return () => {
    reconcileListeners.delete(listener);
  };
}

async function notifyListeners() {
  if (listeners.size === 0) return;
  try {
    const drops = await getAllPendingDrops();
    listeners.forEach((fn) => fn(drops));
  } catch (err) {
    console.error("Failed to notify pending drops listeners:", err);
  }
}

// IndexedDB storage operations
export async function savePendingDrop(drop: PendingDrop): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(drop);
    tx.oncomplete = () => {
      notifyListeners();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function deletePendingDrop(id: string, immediateRevoke = false): Promise<void> {
  const db = await getDB();
  revokeDropLocalUrl(id, immediateRevoke ? 0 : 10000);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => {
      notifyListeners();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllPendingDrops(): Promise<PendingDrop[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const drops = (request.result as PendingDrop[]) || [];
      // Sort newest first
      drops.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      resolve(drops);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingDropsForSpace(userId: string, spaceId: string): Promise<PendingDrop[]> {
  const all = await getAllPendingDrops();
  return all.filter((d) => d.userId === userId && d.spaceId === spaceId && d.status !== "confirmed");
}

export async function getPendingDropsForUser(userId: string): Promise<PendingDrop[]> {
  const all = await getAllPendingDrops();
  return all.filter((d) => d.userId === userId && d.status !== "confirmed");
}

export async function updatePendingDrop(id: string, updates: Partial<PendingDrop>): Promise<PendingDrop | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      const current = req.result as PendingDrop | undefined;
      if (!current) {
        resolve(null);
        return;
      }
      const updated = { ...current, ...updates };
      store.put(updated);
      tx.oncomplete = () => {
        notifyListeners();
        resolve(updated);
      };
    };
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error);
  });
}

// Convert a PendingDrop into a Memory object for the existing feed presentation
export function pendingDropToMemory(drop: PendingDrop): Memory {
  const localUrl = getDropLocalUrl(drop);
  return {
    id: drop.id,
    client_id: drop.id,
    space_id: drop.spaceId,
    space_name: drop.spaceName,
    author_id: drop.author.id,
    author_username: drop.author.username,
    author_display_name: drop.author.display_name,
    author_avatar_url: drop.author.avatar_url,
    caption: drop.caption,
    memory_date: drop.memoryDate,
    created_at: drop.createdAt,
    media_items: [
      {
        id: drop.id,
        cloudinary_public_id: drop.uploadResult?.public_id || "pending_local",
        secure_url: localUrl,
        resource_type: "image",
        format: drop.uploadResult?.format || "jpg",
        width: drop.uploadResult?.width || drop.width,
        height: drop.uploadResult?.height || drop.height,
        bytes: drop.uploadResult?.bytes,
        position: 0,
      },
    ],
    likes_count: 0,
    is_liked_by_me: false,
    comments_count: 0,
    notes: [],
    can_delete: true,
    is_optimistic: true,
    upload_status: drop.status,
    upload_progress: drop.progress,
    error_message: drop.errorMessage,
  };
}

// Background Queue Worker
let isProcessingQueue = false;

export async function processQueue() {
  if (isProcessingQueue || typeof window === "undefined") return;
  isProcessingQueue = true;

  try {
    const drops = await getAllPendingDrops();
    // Find first actionable drop (queued, signing, uploading, creating)
    const actionable = drops.filter(
      (d) => d.status === "queued" || d.status === "signing" || d.status === "uploading" || d.status === "creating"
    );

    for (const drop of actionable) {
      try {
        await processSingleDrop(drop);
      } catch (err: unknown) {
        console.error(`Failed to process drop ${drop.id}:`, err);
        const errorMsg = err instanceof Error ? err.message : "Upload failed";
        await updatePendingDrop(drop.id, {
          status: "failed",
          errorMessage: errorMsg,
          lastAttemptAt: Date.now(),
        });
      }
    }
  } finally {
    isProcessingQueue = false;
  }
}

async function processSingleDrop(drop: PendingDrop) {
  let uploadResult = drop.uploadResult;
  let sessionId = drop.uploadSessionId;

  // Step 1: Sign upload session if not already done
  if (!sessionId || !uploadResult) {
    await updatePendingDrop(drop.id, { status: "signing", progress: 10 });
    const signResponse = await apiRequest<CloudinarySignature>("/media/cloudinary-sign", {
      method: "POST",
      body: JSON.stringify({
        upload_session_id: sessionId || drop.id,
        purpose: "memory",
        space_id: drop.spaceId,
      }),
    });

    sessionId = signResponse.upload_session_id || drop.id;
    await updatePendingDrop(drop.id, {
      uploadSessionId: sessionId,
      status: "uploading",
      progress: 25,
    });

    // Step 2: Upload direct to Cloudinary
    uploadResult = await uploadDirectToCloudinary(
      drop.blob,
      signResponse,
      (pct) => {
        // Map 0-100% upload progress to 25%-85% overall progress
        const overall = Math.round(25 + (pct * 60) / 100);
        updatePendingDrop(drop.id, { progress: overall });
      },
      { timeoutMs: 45000 }
    );

    await updatePendingDrop(drop.id, {
      uploadResult,
      status: "creating",
      progress: 90,
    });
  }

  // Step 3: Call POST /memories with client_id and verified upload_session_id
  await updatePendingDrop(drop.id, { status: "creating", progress: 95 });
  const canonicalMemory = await apiRequest<Memory>("/memories", {
    method: "POST",
    body: JSON.stringify({
      client_id: drop.id,
      space_id: drop.spaceId,
      caption: drop.caption,
      memory_date: drop.memoryDate,
      media_items: [
        {
          upload_session_id: sessionId,
        },
      ],
    }),
  });

  // Step 4: Reconcile and clean up
  await updatePendingDrop(drop.id, {
    status: "confirmed",
    progress: 100,
    canonicalMemory,
  });

  // Notify reconciliation subscribers so feed swaps optimistic item with canonical
  reconcileListeners.forEach((fn) => fn(canonicalMemory, drop.id));

  // Remove confirmed item from IndexedDB
  await deletePendingDrop(drop.id);
}

// Enqueue a new photo drop
export async function enqueueDrop(drop: Omit<PendingDrop, "status" | "progress" | "retryCount">): Promise<PendingDrop> {
  const newDrop: PendingDrop = {
    ...drop,
    status: "queued",
    progress: 0,
    retryCount: 0,
  };
  await savePendingDrop(newDrop);
  // Trigger background upload
  setTimeout(() => processQueue(), 0);
  return newDrop;
}

// Manual retry for a failed drop
export async function retryPendingDrop(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const req = store.get(id);
  req.onsuccess = () => {
    const drop = req.result as PendingDrop | undefined;
    if (drop) {
      drop.status = "queued";
      drop.errorMessage = null;
      drop.retryCount = (drop.retryCount || 0) + 1;
      store.put(drop);
      tx.oncomplete = () => {
        notifyListeners();
        setTimeout(() => processQueue(), 0);
      };
    }
  };
}

// Initialize drop queue on app mount (resumes any in-flight drops)
export async function initDropQueue(userId: string): Promise<PendingDrop[]> {
  try {
    const drops = await getAllPendingDrops();
    const userDrops = drops.filter((d) => d.userId === userId);
    // If any was in an interrupted state ("signing", "uploading", "creating"), set to queued to resume
    let needsProcess = false;
    for (const drop of userDrops) {
      if (drop.status === "signing" || drop.status === "uploading" || drop.status === "creating") {
        drop.status = "queued";
        await savePendingDrop(drop);
        needsProcess = true;
      } else if (drop.status === "queued") {
        needsProcess = true;
      }
    }
    if (needsProcess) {
      setTimeout(() => processQueue(), 100);
    }
    return userDrops.filter((d) => d.status !== "confirmed");
  } catch (err) {
    console.error("Failed to initialize drop queue:", err);
    return [];
  }
}
