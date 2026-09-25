const configuredBase = process.env.NEXT_PUBLIC_API_URL?.trim() ||
  (process.env.NODE_ENV === "production" ? "https://omlu-core.onrender.com/api/v1" : "http://localhost:8000/api/v1");
export const API_BASE = `${configuredBase.replace(/\/+$/, "").replace(/\/api\/v1$/, "")}/api/v1`;

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
interface RequestOptions extends RequestInit { token?: string | null }
const inFlight = new Map<string, Promise<unknown>>();

export function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, ...config } = options;
  const activeToken = token === undefined
    ? (typeof window !== "undefined" ? localStorage.getItem("omlu_token") : null) : token;
  const requestHeaders = new Headers(headers);
  if (activeToken) requestHeaders.set("Authorization", `Bearer ${activeToken}`);
  if (!(config.body instanceof FormData)) requestHeaders.set("Content-Type", "application/json");
  const canDedupe = (!config.method || config.method === "GET") && !config.signal;
  const key = `${endpoint}:${JSON.stringify([...requestHeaders])}`;
  if (canDedupe && inFlight.has(key)) return inFlight.get(key) as Promise<T>;
  const request = (async () => {
    const timeout = AbortSignal.timeout(30000);
    let response: Response;
    try {
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...config, cache: "no-store", headers: requestHeaders,
        signal: config.signal ? AbortSignal.any([config.signal, timeout]) : timeout,
      });
    } catch (error) {
      if (config.signal?.aborted) throw error;
      throw new ApiError("Couldn't reach OMLU. Check your connection and try again.", 0);
    }
    if (!response.ok) {
      let message = response.status === 401 ? "Your session expired. Please sign in again." : `Request failed (${response.status}). Please try again.`;
      try { const body = await response.json(); if (typeof body.detail === "string") message = body.detail; } catch { /* Keep useful HTTP error. */ }
      if (response.status === 401 && activeToken && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("omlu:unauthorized", { detail: activeToken }));
      }
      throw new ApiError(message, response.status);
    }
    if (response.status === 204) return {} as T;
    try { return await response.json() as T; }
    catch { throw new ApiError("OMLU returned an unreadable response. Please try again.", response.status); }
  })();
  if (canDedupe) {
    inFlight.set(key, request);
    void request.finally(() => inFlight.delete(key)).catch(() => {});
  }
  return request;
}
