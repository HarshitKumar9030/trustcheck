import { getMongoDb } from "./mongo";
import type { AnalysisResponse, Verdict } from "./trustAnalysis";
import type { Filter } from "mongodb";

export type FlaggedSiteRecord = {
  hostname: string;
  normalizedUrl: string;
  firstObservedAtMs: number;
  lastObservedAtMs: number;
  lastAnalysisAtMs: number;
  score: number;
  status: AnalysisResponse["status"];
  aiVerdict?: "legitimate" | "caution" | "suspicious" | "likely_deceptive" | null;
  aiConfidence?: "high" | "medium" | "low" | null;
  summary?: string | null;
  issues: string[];
  findings: Array<{
    label: string;
    verdict: Verdict;
    detail: string;
  }>;
  evidence: {
    domainAgeDays?: number | null;
    tlsSupported?: boolean;
    tlsIssuer?: string | null;
    redirectChain?: string[];
    pagesFetched?: number | null;
    warnings?: string[];
  };
  timesObserved: number;
};

declare global {
  // Fallback store when MongoDB isn't configured/available.
  // Best-effort only; resets on server restart.
  // Keyed by hostname.
  // eslint-disable-next-line no-var
  var __trustcheckFlaggedFallback: Map<string, FlaggedSiteRecord> | undefined;
}

function getFallbackStore(): Map<string, FlaggedSiteRecord> {
  if (!global.__trustcheckFlaggedFallback) {
    global.__trustcheckFlaggedFallback = new Map();
  }
  return global.__trustcheckFlaggedFallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function isFlaggedAnalysis(r: Pick<AnalysisResponse, "score" | "status" | "agentSignals">): boolean {
  const scoreFlag = r.score < 45;
  const statusFlag = r.status === "High Risk Indicators Detected";
  const verdict = r.agentSignals?.aiJudgment?.verdict;
  const aiFlag = verdict === "suspicious" || verdict === "likely_deceptive";
  return Boolean(scoreFlag || statusFlag || aiFlag);
}

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function compactList(values: unknown, limit: number): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (!s) continue;
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

function buildFlaggedDoc(analysis: AnalysisResponse, observedAtMs: number): FlaggedSiteRecord | null {
  const hostname = safeHostname(analysis.normalizedUrl);
  if (!hostname) return null;

  const aiVerdict = analysis.agentSignals?.aiJudgment?.verdict ?? null;
  const aiConfidence = analysis.agentSignals?.aiJudgment?.confidence ?? analysis.aiAnalysis?.confidenceLevel ?? null;

  const issues = (() => {
    const fromAgent = analysis.agentSignals?.aiJudgment?.detectedIssues;
    if (fromAgent?.length) return compactList(fromAgent, 10);
    const fromAi = analysis.aiAnalysis?.riskFactors;
    if (fromAi?.length) return compactList(fromAi, 10);
    const fromNeg = analysis.aiAnalysis?.trustSignals?.negative;
    if (fromNeg?.length) return compactList(fromNeg, 10);
    return [];
  })();

  const findings = (analysis.explainability ?? [])
    .filter((i) => i.verdict === "bad" || i.verdict === "warn")
    .slice(0, 8)
    .map((i) => ({
      label: i.label,
      verdict: i.verdict,
      detail: i.detail,
    }));

  const summary =
    analysis.agentSignals?.aiJudgment?.summary ?? analysis.aiAnalysis?.summary ?? analysis.aiAnalysis?.overallAssessment ?? null;

  const lastAnalysisAtMs = (() => {
    const parsed = Date.parse(analysis.analyzedAt);
    return Number.isFinite(parsed) ? parsed : observedAtMs;
  })();

  return {
    hostname,
    normalizedUrl: analysis.normalizedUrl,
    firstObservedAtMs: observedAtMs,
    lastObservedAtMs: observedAtMs,
    lastAnalysisAtMs,
    score: clamp(Math.round(analysis.score), 0, 100),
    status: analysis.status,
    aiVerdict,
    aiConfidence,
    summary,
    issues,
    findings,
    evidence: {
      domainAgeDays: analysis.agentSignals?.domainAgeDays ?? null,
      tlsSupported: analysis.agentSignals?.tls?.supported,
      tlsIssuer: analysis.agentSignals?.tls?.issuer ?? null,
      redirectChain: analysis.agentSignals?.fetch?.redirectChain ?? [],
      pagesFetched: analysis.agentSignals?.crawl?.pagesFetched ?? null,
      warnings: analysis.agentSignals?.warnings ?? [],
    },
    timesObserved: 1,
  };
}

async function ensureIndexes(): Promise<void> {
  const db = await getMongoDb();
  if (!db) return;
  const col = db.collection<FlaggedSiteRecord>("flagged_sites");
  try {
    await col.createIndex({ hostname: 1 }, { unique: true });
    await col.createIndex({ lastObservedAtMs: -1 });
    await col.createIndex({ score: 1 });
    await col.createIndex({ status: 1 });
    await col.createIndex({ hostname: "text", normalizedUrl: "text", summary: "text", issues: "text" });
  } catch {
    // ignore
  }
}

export async function upsertFlaggedFromAnalysis(
  analysis: AnalysisResponse,
  opts: { observedAtMs?: number } = {}
): Promise<void> {
  const db = await getMongoDb();

  const observedAtMs =
    typeof opts.observedAtMs === "number" && Number.isFinite(opts.observedAtMs) ? opts.observedAtMs : Date.now();

  const doc = buildFlaggedDoc(analysis, observedAtMs);
  if (!doc) return;

  // If MongoDB isn't configured, fall back to an in-memory list so /flagged still works.
  if (!db) {
    const store = getFallbackStore();
    const prev = store.get(doc.hostname);
    if (prev) {
      store.set(doc.hostname, {
        ...doc,
        firstObservedAtMs: prev.firstObservedAtMs,
        timesObserved: (prev.timesObserved ?? 0) + 1,
      });
    } else {
      store.set(doc.hostname, doc);
    }
    return;
  }

  await ensureIndexes();

  const col = db.collection<FlaggedSiteRecord>("flagged_sites");
  try {
    await col.updateOne(
      { hostname: doc.hostname },
      {
        $setOnInsert: {
          hostname: doc.hostname,
          firstObservedAtMs: doc.firstObservedAtMs,
          timesObserved: 0,
        },
        $set: {
          normalizedUrl: doc.normalizedUrl,
          lastObservedAtMs: doc.lastObservedAtMs,
          lastAnalysisAtMs: doc.lastAnalysisAtMs,
          score: doc.score,
          status: doc.status,
          aiVerdict: doc.aiVerdict,
          aiConfidence: doc.aiConfidence,
          summary: doc.summary,
          issues: doc.issues,
          findings: doc.findings,
          evidence: doc.evidence,
        },
        $inc: { timesObserved: 1 },
      },
      { upsert: true }
    );
  } catch (e) {
    // Don't hard-fail /api/analyze, but do log so it can be diagnosed.
    console.warn("[flagged_sites] upsert failed", e);
  }
}

export async function queryFlaggedSites(opts: {
  q?: string;
  limit?: number;
}): Promise<FlaggedSiteRecord[]> {
  const db = await getMongoDb();

  const limit = (() => {
    const raw = opts.limit;
    if (typeof raw !== "number" || !Number.isFinite(raw)) return 50;
    return clamp(Math.round(raw), 1, 200);
  })();

  const q = (opts.q ?? "").trim();

  const filter: Filter<FlaggedSiteRecord> = (() => {
    if (!q) return {};
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return {
      $or: [
        { hostname: { $regex: escaped, $options: "i" } },
        { normalizedUrl: { $regex: escaped, $options: "i" } },
        { $text: { $search: q } },
      ],
    };
  })();

  // Mongo-backed query (preferred)
  if (db) {
    await ensureIndexes();
    const col = db.collection<FlaggedSiteRecord>("flagged_sites");
    try {
      return await col
        .find(filter)
        .sort({ lastObservedAtMs: -1 })
        .limit(limit)
        .toArray();
    } catch (e) {
      console.warn("[flagged_sites] query failed", e);
      // fall through to in-memory
    }
  }

  // In-memory fallback
  const store = getFallbackStore();
  const all = Array.from(store.values());
  const filtered = (() => {
    if (!q) return all;
    const needle = q.toLowerCase();
    return all.filter((r) => {
      const hay = `${r.hostname} ${r.normalizedUrl} ${(r.summary ?? "")} ${(r.issues ?? []).join(" ")}`.toLowerCase();
      return hay.includes(needle);
    });
  })();

  return filtered.sort((a, b) => (b.lastObservedAtMs ?? 0) - (a.lastObservedAtMs ?? 0)).slice(0, limit);
}
