/** Opt-in preview proxy to the local FastAPI server. */
const upstreamBase = "http://127.0.0.1:8000/api/v1";

type Context = { params: Promise<{ path: string[] }> };

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function forward(request: Request, context: Context, method: Method) {
  if (process.env.OMLU_LOCAL_API_PROXY !== "1") {
    return new Response("Not found", { status: 404 });
  }
  const { path } = await context.params;
  const suffix = path.map(encodeURIComponent).join("/");
  const query = new URL(request.url).search;
  const headers = new Headers();
  const authorization = request.headers.get("Authorization");
  if (authorization) headers.set("Authorization", authorization);
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);
  try {
    const upstream = await fetch(`${upstreamBase}/${suffix}${query}`, {
      method,
      headers,
      body: method === "GET" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    const responseHeaders = new Headers({
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
      "Cache-Control": "no-store",
    });
    const serverDate = upstream.headers.get("Date");
    if (serverDate) responseHeaders.set("Date", serverDate);
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json({ detail: "The API is unavailable." }, { status: 502 });
  }
}

export async function GET(request: Request, context: Context) {
  return forward(request, context, "GET");
}

export async function POST(request: Request, context: Context) {
  return forward(request, context, "POST");
}

export async function PUT(request: Request, context: Context) {
  return forward(request, context, "PUT");
}

export async function PATCH(request: Request, context: Context) {
  return forward(request, context, "PATCH");
}

export async function DELETE(request: Request, context: Context) {
  return forward(request, context, "DELETE");
}
