const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface RequestOptions extends RequestInit {
  token?: string | null;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { token, headers = {}, ...customConfig } = options;

  const authHeaders: Record<string, string> = {};
  
  // Use passed token or check localStorage
  const activeToken = token ?? (typeof window !== "undefined" ? localStorage.getItem("omlu_token") : null);
  if (activeToken) {
    authHeaders["Authorization"] = `Bearer ${activeToken}`;
  }

  const isFormData = customConfig.body instanceof FormData;
  if (!isFormData) {
    authHeaders["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...customConfig,
    headers: {
      ...authHeaders,
      ...(headers as Record<string, string>),
    },
  });

  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson.detail) {
        errorDetail = typeof errorJson.detail === "string" 
          ? errorJson.detail 
          : JSON.stringify(errorJson.detail);
      }
    } catch {
      // Non-json error response
    }
    throw new Error(errorDetail);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
