import { NextResponse } from "next/server";

import { getMongoDb } from "../../../lib/mongo";
import { isFlaggedAnalysis, upsertFlaggedFromAnalysis } from "../../../lib/flaggedSites";
import {
  type AnalysisCacheRecord,
  type AnalysisResponse,
  type AgentSignals,
  analyzeWebsite,
} from "../../../lib/trustAnalysis";
import { type AIAnalysisResult } from "../../../lib/geminiAnalysis";
import { putScreenshot } from "../../../lib/screenshotStore";

type AnalyzeRequest = {
  url?: string;
  force?: boolean;
  timeoutMs?: number;
  checkExternalReviews?: boolean;
};

const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24h
const CACHE_VERSION = "v4";
const ENABLE_CACHE = process.env.ENABLE_CACHE === "true";

const memoryCache = new Map<string, AnalysisCacheRecord>();

function makeCacheKey(hostname: string): string {
  return `${hostname.toLowerCase()}::${CACHE_VERSION}`;
}

const WELL_KNOWN_DOMAINS = new Set([
  "google.com", "youtube.com", "facebook.com", "amazon.com", "apple.com",
  "microsoft.com", "netflix.com", "linkedin.com", "twitter.com", "x.com",
  "instagram.com", "reddit.com", "wikipedia.org", "github.com", "stackoverflow.com",
  "ebay.com", "walmart.com", "target.com", "bestbuy.com", "costco.com",
  "paypal.com", "stripe.com", "shopify.com", "etsy.com", "zoom.us",
  "slack.com", "dropbox.com", "adobe.com", "salesforce.com", "oracle.com",
]);

function registrableDomainGuess(hostname: string): string {
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length <= 2) return hostname;
  return parts.slice(-2).join(".");
}

function isWellKnownDomain(hostname: string): boolean {
  return WELL_KNOWN_DOMAINS.has(registrableDomainGuess(hostname.toLowerCase()));
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function fetchWithTimeoutJson(
  input: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 8000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

type EphemeralScreenshot = { url: string; mime?: string; expiresInSeconds?: number };

function stripEphemeralFromAgentSignals(signals: AgentSignals | undefined): AgentSignals | undefined {
  if (!signals) return signals;
  if (!signals.screenshot) return signals;
  return { ...signals, screenshot: null };
}

async function tryCaptureScreenshotViaPythonAgent(url: string): Promise<EphemeralScreenshot | null> {
  const base = (process.env.PYTHON_AGENT_URL ?? "").trim().replace(/\/$/, "");
  if (!base) return null;

  try {
    const res = await fetchWithTimeoutJson(`${base}/screenshot`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "image/png,image/jpeg,application/json",
      },
      body: JSON.stringify({ url }),
      cache: "no-store",
      timeoutMs: 12_000,
    });

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = (await res.json()) as { mime?: string; data_base64?: string };
      if (!data?.data_base64) return null;
      const mime = (data.mime ?? "image/png").trim() || "image/png";
      const buf = Buffer.from(data.data_base64, "base64");
      const { id } = putScreenshot({ mime, data: new Uint8Array(buf), ttlMs: 120_000 });
      return { url: `/api/screenshot/${id}`, mime, expiresInSeconds: 120 };
    }

    const arr = new Uint8Array(await res.arrayBuffer());
    const mime = contentType.split(";")[0] || "image/png";
    const { id } = putScreenshot({ mime, data: arr, ttlMs: 120_000 });
    return { url: `/api/screenshot/${id}`, mime, expiresInSeconds: 120 };
  } catch {
    return null;
  }
}

type PythonAgentResponse = {
  normalized_url: string;
  hostname: string;
  score: number;
  status: AnalysisResponse["status"];
  explainability: AnalysisResponse["explainability"];
  analyzed_at: string;
  domain_age_days?: number | null;
  external_reviews?: string | null;
  warnings?: string[];
  timings_ms?: Record<string, number>;
  tls?: {
    supported: boolean;
    issuer?: string | null;
    subject?: string | null;
    not_after?: string | null;
    days_to_expiry?: number | null;
  };
  ai_judgment?: {
    legitimacy_score: number;
    confidence: "high" | "medium" | "low";
    verdict: "legitimate" | "caution" | "suspicious" | "likely_deceptive";
    category: string;
    detected_issues: string[];
    positive_signals: string[];
    platform: string;
    product_legitimacy: string;
    business_identity: string;
    summary: string;
    recommendation: string;
  } | null;
  fetch?: {
    final_url: string;
    http_status: number | null;
    content_type: string | null;
    redirect_chain: string[];
    headers: Record<string, string>;
    html_available: boolean;
    html_snippet?: string | null;
    fetch_note?: string | null;
  };
  crawl?: {
    pages_requested: number;
    pages_fetched: number;
    pages: Array<{
      url: string;
      final_url?: string | null;
      http_status?: number | null;
      content_type?: string | null;
      html_snippet?: string | null;
      fetch_note?: string | null;
    }>;
  };

  // Optional: agent may include a short-lived screenshot payload.
  screenshot?: {
    mime?: string;
    data_base64?: string;
  } | null;
};

function mapPythonAgentSignals(data: PythonAgentResponse): AgentSignals {
  let screenshot: AgentSignals["screenshot"] = null;
  try {
    const b64 = data.screenshot?.data_base64;
    if (b64 && typeof b64 === "string") {
      const mime = (data.screenshot?.mime ?? "image/png").trim() || "image/png";
      const buf = Buffer.from(b64, "base64");
      const { id } = putScreenshot({ mime, data: new Uint8Array(buf), ttlMs: 120_000 });
      screenshot = { url: `/api/screenshot/${id}`, mime, expiresInSeconds: 120 };
    }
  } catch {
    screenshot = null;
  }

  return {
    agent: "python",
    domainAgeDays: data.domain_age_days ?? null,
    externalReviews: data.external_reviews ?? null,
    warnings: data.warnings ?? [],
    timingsMs: data.timings_ms ?? {},
    tls: data.tls
      ? {
          supported: Boolean(data.tls.supported),
          issuer: data.tls.issuer ?? null,
          subject: data.tls.subject ?? null,
          notAfter: data.tls.not_after ?? null,
          daysToExpiry: data.tls.days_to_expiry ?? null,
        }
      : undefined,
    fetch: data.fetch
      ? {
          finalUrl: data.fetch.final_url,
          httpStatus: data.fetch.http_status,
          contentType: data.fetch.content_type,
          redirectChain: data.fetch.redirect_chain ?? [],
          headers: data.fetch.headers ?? {},
          htmlAvailable: Boolean(data.fetch.html_available),
          fetchNote: data.fetch.fetch_note ?? null,
        }
      : undefined,
    crawl: data.crawl
      ? {
          pagesRequested: data.crawl.pages_requested,
          pagesFetched: data.crawl.pages_fetched,
          pages:
            data.crawl.pages?.map((p) => ({
              url: p.url,
              finalUrl: p.final_url ?? null,
              httpStatus: p.http_status ?? null,
              contentType: p.content_type ?? null,
              fetchNote: p.fetch_note ?? null,
            })) ?? [],
        }
      : null,
    aiJudgment: data.ai_judgment
      ? {
          legitimacyScore: data.ai_judgment.legitimacy_score,
          confidence: data.ai_judgment.confidence,
          verdict: data.ai_judgment.verdict,
          category: data.ai_judgment.category,
          detectedIssues: data.ai_judgment.detected_issues,
          positiveSignals: data.ai_judgment.positive_signals,
          platform: data.ai_judgment.platform,
          productLegitimacy: data.ai_judgment.product_legitimacy,
          businessIdentity: data.ai_judgment.business_identity,
          summary: data.ai_judgment.summary,
          recommendation: data.ai_judgment.recommendation,
        }
      : null,
    screenshot,
  };
}

async function tryAnalyzeViaPythonAgent(
  normalizedUrl: string,
  opts: { timeoutMs?: number; checkExternalReviews?: boolean } = {}
): Promise<AnalysisResponse | null> {
  const base = (process.env.PYTHON_AGENT_URL ?? "").trim().replace(/\/$/, "");
  if (!base) return null;

  const timeoutMs = (() => {
    const raw = opts.timeoutMs;
    if (typeof raw !== "number" || !Number.isFinite(raw)) return 20000;
    return Math.max(1000, Math.min(60000, Math.round(raw)));
  })();

  const checkExternalReviews =
    typeof opts.checkExternalReviews === "boolean" ? opts.checkExternalReviews : true;

  try {
    const res = await fetchWithTimeoutJson(`${base}/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: normalizedUrl,
        timeout_ms: timeoutMs,
        check_external_reviews: checkExternalReviews,
      }),
      timeoutMs: timeoutMs + 7000,
      cache: "no-store",
    });

    if (!res.ok) return null;
    const data = (await res.json()) as PythonAgentResponse;
    if (!data?.normalized_url || typeof data.score !== "number") return null;

    const agentSignals = mapPythonAgentSignals(data);

    // Convert AI judgment to our AIAnalysisResult format for UI compatibility
    const aiJudgment = data.ai_judgment;
    const aiResult: AIAnalysisResult | undefined = aiJudgment
      ? {
          overallAssessment: aiJudgment.summary,
          trustSignals: {
            positive: aiJudgment.positive_signals,
            negative: aiJudgment.detected_issues,
            neutral: [],
          },
          riskFactors: aiJudgment.detected_issues,
          recommendations: [aiJudgment.recommendation],
          confidenceLevel: aiJudgment.confidence,
          category: aiJudgment.category,
          summary: aiJudgment.summary,
          aiScore: aiJudgment.legitimacy_score,
        }
      : undefined;

    return {
      normalizedUrl: data.normalized_url,
      score: data.score,
      status: data.status,
      explainability: data.explainability,
      cached: false,
      analyzedAt: data.analyzed_at,
      aiAnalysis: aiResult,
      agentSignals,
    };
  } catch {
    return null;
  }
}

async function getCached(cacheKey: string): Promise<AnalysisCacheRecord | null> {
  const now = Date.now();

  const mem = memoryCache.get(cacheKey);
  if (mem && mem.expireAtMs > now) return mem;

  const db = await getMongoDb();
  if (!db) return null;

  const col = db.collection<AnalysisCacheRecord>("analyses");

  // Best-effort TTL index
  try {
    await col.createIndex({ expireAtMs: 1 }, { expireAfterSeconds: 0 });
    await col.createIndex({ cacheKey: 1, analyzedAtMs: -1 });
  } catch {
    // ignore
  }

  const doc = await col.findOne(
    { cacheKey, expireAtMs: { $gt: now } },
    { sort: { analyzedAtMs: -1 } }
  );

  if (!doc) return null;
  return doc;
}

async function setCached(record: AnalysisCacheRecord): Promise<void> {
  memoryCache.set(record.cacheKey, record);

  const db = await getMongoDb();
  if (!db) return;

  const col = db.collection<AnalysisCacheRecord>("analyses");
  try {
    await col.insertOne(record);
  } catch {
    // ignore
  }
}

export async function POST(req: Request) {
  let body: AnalyzeRequest;
  try {
    body = (await req.json()) as AnalyzeRequest;
  } catch {
    return jsonError("Invalid request body.");
  }

  const url = (body.url ?? "").trim();
  if (!url) return jsonError("Please provide a URL.");

  let normalizedUrl: string;
  let cacheKey: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return jsonError("Please use an http(s) website URL.");
    }
    if (!parsed.hostname || !parsed.hostname.includes(".")) {
      return jsonError("Please enter a valid website domain.");
    }
    parsed.hash = "";
    normalizedUrl = parsed.toString();
    cacheKey = makeCacheKey(parsed.hostname);
  } catch {
    return jsonError("That URL doesn’t look quite right. Please try again.");
  }

  const force = Boolean(body.force);

  const timeoutMs = (() => {
    const raw = body.timeoutMs;
    if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
    return Math.max(1000, Math.min(60000, Math.round(raw)));
  })();

  const checkExternalReviews =
    typeof body.checkExternalReviews === "boolean" ? body.checkExternalReviews : undefined;
  if (!force && ENABLE_CACHE) {
    const cached = await getCached(cacheKey);
    if (cached) {
      const response: AnalysisResponse = {
        normalizedUrl: cached.normalizedUrl,
        score: cached.score,
        status: cached.status,
        explainability: cached.explainability,
        cached: true,
        analyzedAt: new Date(cached.analyzedAtMs).toISOString(),
        aiAnalysis: cached.aiAnalysis,
        agentSignals: stripEphemeralFromAgentSignals(cached.agentSignals) ?? { agent: "node" },
      };

      // Screenshots are per-request and short-lived; always try to capture a fresh one.
      const freshShot = await tryCaptureScreenshotViaPythonAgent(response.normalizedUrl);
      if (freshShot) {
        response.agentSignals = { ...(response.agentSignals ?? { agent: "node" }), screenshot: freshShot };
      } else {
        response.agentSignals = { ...(response.agentSignals ?? { agent: "node" }), screenshot: null };
      }

      // Public flagged list is backed by MongoDB. Best-effort persistence.
      if (isFlaggedAnalysis(response)) {
        await upsertFlaggedFromAnalysis(response, { observedAtMs: Date.now() });
      }
      return NextResponse.json(response);
    }
  }

  const agentResponse = await tryAnalyzeViaPythonAgent(normalizedUrl, {
    timeoutMs,
    checkExternalReviews,
  });
  if (agentResponse) {
    const cacheHostname = (() => {
      try {
        return new URL(agentResponse.normalizedUrl).hostname.toLowerCase();
      } catch {
        return new URL(normalizedUrl).hostname.toLowerCase();
      }
    })();

    const finalScore = agentResponse.score;
    const finalStatus = agentResponse.status;

    const analyzedAtMs = Date.parse(agentResponse.analyzedAt);
    const safeAnalyzedAtMs = Number.isFinite(analyzedAtMs) ? analyzedAtMs : Date.now();

    const record: AnalysisCacheRecord = {
      cacheKey: makeCacheKey(cacheHostname),
      normalizedUrl: agentResponse.normalizedUrl,
      score: finalScore,
      status: finalStatus,
      explainability: agentResponse.explainability,
      cached: false,
      analyzedAt: agentResponse.analyzedAt,
      analyzedAtMs: safeAnalyzedAtMs,
      expireAtMs: safeAnalyzedAtMs + CACHE_TTL_MS,
      aiAnalysis: agentResponse.aiAnalysis,
      // Don't persist ephemeral screenshot URLs into the cache.
      agentSignals: stripEphemeralFromAgentSignals(agentResponse.agentSignals) ?? { agent: "python" },
    };

    if (ENABLE_CACHE) {
      await setCached(record);
    }

    const response: AnalysisResponse = {
      normalizedUrl: record.normalizedUrl,
      score: record.score,
      status: record.status,
      explainability: record.explainability,
      cached: false,
      analyzedAt: record.analyzedAt,
      aiAnalysis: record.aiAnalysis,
      agentSignals: record.agentSignals,
    };

    // Ensure screenshot exists for this request (prefer embedded, else capture).
    if (!response.agentSignals?.screenshot) {
      const freshShot = await tryCaptureScreenshotViaPythonAgent(response.normalizedUrl);
      response.agentSignals = { ...(response.agentSignals ?? { agent: "python" }), screenshot: freshShot };
    }

    if (isFlaggedAnalysis(response)) {
      await upsertFlaggedFromAnalysis(response, { observedAtMs: Date.now() });
    }

    return NextResponse.json(response);
  }

  let analysisBase: Awaited<ReturnType<typeof analyzeWebsite>>;
  try {
    analysisBase = await analyzeWebsite(normalizedUrl);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unable to analyze that URL.";
    return jsonError(message);
  }

  // Ensure cache key is versioned
  try {
    cacheKey = makeCacheKey(new URL(analysisBase.normalizedUrl).hostname);
  } catch {
    // keep existing cacheKey
  }

  const analyzedAtMs = analysisBase.analyzedAtMs;
  const record: AnalysisCacheRecord = {
    cacheKey,
    normalizedUrl: analysisBase.normalizedUrl,
    score: analysisBase.score,
    status: analysisBase.status,
    explainability: analysisBase.explainability,
    cached: false,
    analyzedAt: new Date(analyzedAtMs).toISOString(),
    analyzedAtMs,
    expireAtMs: analyzedAtMs + CACHE_TTL_MS,
    aiAnalysis: analysisBase.aiAnalysis,
    agentSignals: { agent: "node" },
  };

  if (ENABLE_CACHE) {
    await setCached(record);
  }

  const response: AnalysisResponse = {
    normalizedUrl: record.normalizedUrl,
    score: record.score,
    status: record.status,
    explainability: record.explainability,
    cached: false,
    analyzedAt: record.analyzedAt,
    aiAnalysis: record.aiAnalysis,
    agentSignals: record.agentSignals,
  };

  // Always attempt a screenshot for every request (best-effort).
  const freshShot = await tryCaptureScreenshotViaPythonAgent(response.normalizedUrl);
  response.agentSignals = { ...(response.agentSignals ?? { agent: "node" }), screenshot: freshShot };

  if (isFlaggedAnalysis(response)) {
    await upsertFlaggedFromAnalysis(response, { observedAtMs: Date.now() });
  }

  return NextResponse.json(response);
}
