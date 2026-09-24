import { CloudinarySignature } from "@/types";

export interface CloudinaryUploadResult {
  public_id: string;
  asset_id?: string;
  secure_url: string;
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
}

/**
 * Direct browser-to-Cloudinary upload using server-signed parameters.
 * Image binaries NEVER touch the FastAPI backend.
 */
export async function uploadDirectToCloudinary(
  blob: Blob,
  signature: CloudinarySignature,
  onProgress?: (progressPercent: number) => void,
  options?: { timeoutMs?: number; signal?: AbortSignal }
): Promise<CloudinaryUploadResult> {
  const formData = new FormData();
  formData.append("file", blob);
  formData.append("api_key", signature.api_key);
  formData.append("timestamp", signature.timestamp.toString());
  formData.append("signature", signature.signature);
  formData.append("folder", signature.folder);
  formData.append("public_id", signature.public_id);
  if (signature.overwrite === false) {
    formData.append("overwrite", "false");
  }

  const timeoutMs = options?.timeoutMs ?? 45000;
  const signal = options?.signal;

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Upload aborted"));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", signature.upload_url, true);
    xhr.timeout = timeoutMs;

    const onAbort = () => {
      xhr.abort();
      reject(new Error("Upload aborted"));
    };
    signal?.addEventListener("abort", onAbort);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      signal?.removeEventListener("abort", onAbort);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          resolve({
            public_id: res.public_id,
            asset_id: res.asset_id,
            secure_url: res.secure_url,
            format: res.format,
            width: res.width,
            height: res.height,
            bytes: res.bytes,
          });
        } catch {
          reject(new Error("Failed to parse Cloudinary response"));
        }
      } else {
        try {
          const errRes = JSON.parse(xhr.responseText);
          reject(new Error(errRes.error?.message || "Upload to Cloudinary failed"));
        } catch {
          reject(new Error(`Upload failed with HTTP ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => {
      signal?.removeEventListener("abort", onAbort);
      reject(new Error("Network error during Cloudinary upload"));
    };

    xhr.ontimeout = () => {
      signal?.removeEventListener("abort", onAbort);
      reject(new Error(`Upload timed out after ${timeoutMs / 1000}s`));
    };

    xhr.onabort = () => {
      signal?.removeEventListener("abort", onAbort);
      reject(new Error("Upload aborted"));
    };

    xhr.send(formData);
  });
}

/**
 * Injects on-the-fly Cloudinary transformations into delivery URLs.
 */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  type: "feed" | "grid" | "avatar" | "cover" | "full" = "feed"
): string {
  if (!url) return "";

  // If not a Cloudinary upload URL, return directly
  if (!url.includes("/image/upload/")) {
    return url;
  }

  // If the URL already contains transformation segments, avoid duplicate injection
  if (
    url.includes("/image/upload/f_auto") ||
    url.includes("/image/upload/c_") ||
    url.includes("/image/upload/w_")
  ) {
    return url;
  }

  const transformations: Record<string, string> = {
    feed: "f_auto,q_auto,w_1080,c_limit",
    grid: "f_auto,q_auto,w_400,h_400,c_fill",
    avatar: "f_auto,q_auto,w_200,h_200,c_fill",
    cover: "f_auto,q_auto,w_1200,h_600,c_fill",
    full: "f_auto,q_auto",
  };

  const transform = transformations[type] || "f_auto,q_auto";
  return url.replace("/image/upload/", `/image/upload/${transform}/`);
}
