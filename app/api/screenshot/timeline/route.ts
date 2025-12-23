import { putScreenshot } from "@/lib/screenshotStore";
import { checkIpRateLimit, rateLimitHeaders } from "@/lib/ipRateLimit";

export const runtime = "nodejs";

type Body = { url?: string };

type AgentTimelineResponse = {
  shots: Array<{ at_ms: number; mime?: string; data_base64: string }>;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function fetchWithTimeout(input: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 20000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  const rl = checkIpRateLimit(req, { scope: "screenshot_timeline", capacity: 4, refillPerSecond: 0.10 });
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: "Too many screenshot timeline requests. Please wait and try again." }), {
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

  try {
    const res = await fetchWithTimeout(`${base}/screenshots`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ url, delays_ms: [1000, 3000, 5000], full_page: false, timeout_ms: 20000 }),
      cache: "no-store",
      timeoutMs: 25000,
    });

    if (!res.ok) {
      return json({ error: "Screenshot timeline unavailable" }, 502);
    }

    const data = (await res.json()) as AgentTimelineResponse;
    if (!data?.shots || !Array.isArray(data.shots) || data.shots.length === 0) {
      return json({ error: "Invalid screenshot timeline" }, 502);
    }

    const shots = data.shots
      .filter((s) => s && typeof s.data_base64 === "string" && s.data_base64.length > 0)
      .slice(0, 6)
      .map((s) => {
        const buf = Buffer.from(s.data_base64, "base64");
        const mime = (s.mime ?? "image/png").trim() || "image/png";
        const { id } = putScreenshot({ mime, data: new Uint8Array(buf), ttlMs: 120_000 });
        const atMs = typeof s.at_ms === "number" && Number.isFinite(s.at_ms) ? Math.max(0, Math.round(s.at_ms)) : 0;
        const atSeconds = Math.round(atMs / 1000);
        return {
          id,
          url: `/api/screenshot/${id}`,
          mime,
          atMs,
          label: `${atSeconds}s`,
          expiresInSeconds: 120,
        };
      });

    if (shots.length === 0) return json({ error: "No screenshots captured" }, 502);

    return json({ shots });
  } catch {
    return json({ error: "Screenshot timeline request failed" }, 502);
  }
}
