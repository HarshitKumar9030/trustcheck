import { putScreenshot } from "@/lib/screenshotStore";
import { checkIpRateLimit, rateLimitHeaders } from "@/lib/ipRateLimit";

export const runtime = "nodejs";

type Body = { url?: string };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function fetchWithTimeout(input: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 8000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  // Screenshots are expensive; be generous but prevent abuse.
  const rl = checkIpRateLimit(req, { scope: "screenshot", capacity: 6, refillPerSecond: 0.15 });
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: "Too many screenshot requests. Please wait and try again." }), {
      status: 429,
      headers: { "content-type": "application/json", ...rateLimitHeaders(rl) },
    });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: "Invalid body" }, 400);
  }

  const url = (body.url ?? "").trim();
  if (!url) return json({ error: "Missing url" }, 400);

  const base = (process.env.PYTHON_AGENT_URL ?? "").trim().replace(/\/$/, "");
  if (!base) return json({ error: "Screenshot agent is not configured" }, 501);

  // Expected agent contract: POST {url} -> returns image/png OR JSON { mime, data_base64 }
  try {
    const ttlMs = 30 * 60 * 1000; // 30 minutes
    const expiresInSeconds = Math.round(ttlMs / 1000);
    const res = await fetchWithTimeout(`${base}/screenshot`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "image/png,image/jpeg,application/json" },
      body: JSON.stringify({ url }),
      cache: "no-store",
      timeoutMs: 12_000,
    });

    if (!res.ok) return json({ error: "Screenshot unavailable" }, 502);

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = (await res.json()) as { mime?: string; data_base64?: string };
      if (!data?.data_base64) return json({ error: "Invalid screenshot response" }, 502);
      const buf = Buffer.from(data.data_base64, "base64");
      const mime = (data.mime ?? "image/png").trim() || "image/png";
      const { id } = putScreenshot({ mime, data: new Uint8Array(buf), ttlMs });
      return json({ id, url: `/api/screenshot/${id}`, mime, expiresInSeconds });
    }

    const arr = new Uint8Array(await res.arrayBuffer());
    const mime = contentType.split(";")[0] || "image/png";
    const { id } = putScreenshot({ mime, data: arr, ttlMs });
    return json({ id, url: `/api/screenshot/${id}`, mime, expiresInSeconds });
  } catch {
    return json({ error: "Screenshot request failed" }, 502);
  }
}
