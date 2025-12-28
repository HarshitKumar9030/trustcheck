"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Loader } from "@/app/components/Loader";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { CopyIcon, PrinterIcon, RefreshCcwIcon, ArrowRight, Check, X, AlertTriangle, Info, WrenchIcon } from "lucide-react";
import { AnimatedActionButton } from "./components/AnimatedActionButton";
import { Navbar } from "./components/Navbar";
import { loadScanHistory, saveScanHistory, type ScanRecord } from "./lib/scanHistory";

type Verdict = "good" | "warn" | "bad" | "unknown";

type ExplainabilityItem = {
  key: string;
  label: string;
  verdict: Verdict;
  detail: string;
};

type AIAnalysis = {
  overallAssessment: string;
  trustSignals: {
    positive: string[];
    negative: string[];
    neutral: string[];
  };
  riskFactors: string[];
  recommendations: string[];
  confidenceLevel: "high" | "medium" | "low";
  category: string;
  summary: string;
  aiScore: number;
};

type AgentSignals = {
  agent: "python" | "node";
  domainAgeDays?: number | null;
  externalReviews?: string | null;
  warnings?: string[];
  timingsMs?: Record<string, number>;
  tls?: {
    supported: boolean;
    issuer?: string | null;
    subject?: string | null;
    notAfter?: string | null;
    daysToExpiry?: number | null;
  };
  fetch?: {
    finalUrl: string;
    httpStatus: number | null;
    contentType: string | null;
    redirectChain: string[];
    headers: Record<string, string>;
    htmlAvailable: boolean;
    fetchNote?: string | null;
  };
  crawl?: {
    pagesRequested: number;
    pagesFetched: number;
    pages: Array<{
      url: string;
      finalUrl?: string | null;
      httpStatus?: number | null;
      contentType?: string | null;
      fetchNote?: string | null;
    }>;
  } | null;
  aiJudgment?: {
    legitimacyScore: number;
    confidence: "high" | "medium" | "low";
    verdict: "legitimate" | "caution" | "suspicious" | "likely_deceptive";
    category: string;
    detectedIssues: string[];
    positiveSignals: string[];
    platform: string;
    productLegitimacy: string;
    businessIdentity: string;
    summary: string;
    recommendation: string;
  } | null;

  screenshot?: {
    url: string;
    mime?: string;
    expiresInSeconds?: number;
  } | null;
};

type AnalysisResponse = {
  normalizedUrl: string;
  score: number;
  status: "Low Risk" | "Proceed with Caution" | "High Risk Indicators Detected";
  explainability: ExplainabilityItem[];
  cached: boolean;
  analyzedAt: string;
  aiAnalysis?: AIAnalysis;
  agentSignals?: AgentSignals;
};

type LogLevel = "info" | "good" | "warn" | "bad";

type AnalysisLogEntry = {
  id: string;
  atMs: number;
  level: LogLevel;
  title: string;
  detail?: string;
};

// ScanRecord is shared via ./lib/scanHistory

function normalizeUrlInput(raw: string): string {
  const input = raw.trim();
  if (!input) throw new Error("Please enter a website URL.");

  const withScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(input)
    ? input
    : `https://${input}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error("That URL doesn’t look quite right. Please try again.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Please use an http(s) website URL.");
  }

  if (!url.hostname || !url.hostname.includes(".")) {
    throw new Error("Please enter a valid website domain.");
  }

  url.hash = "";
  return url.toString();
}

function scoreTheme(score: number): {
  labelColor: string;
  ringColor: string;
  chipBg: string;
  badgeBorder: string;
  accent: string;
} {
  if (score >= 75) {
    return {
      labelColor: "text-[var(--success)]",
      ringColor: "ring-[var(--success)]/20",
      chipBg: "bg-[rgba(31,122,74,0.10)]",
      badgeBorder: "border-[rgba(31,122,74,0.18)]",
      accent: "rgba(31,122,74,1)",
    };
  }
  if (score >= 45) {
    return {
      labelColor: "text-[var(--warning)]",
      ringColor: "ring-[rgba(183,121,31,0.22)]",
      chipBg: "bg-[rgba(183,121,31,0.10)]",
      badgeBorder: "border-[rgba(183,121,31,0.18)]",
      accent: "rgba(183,121,31,1)",
    };
  }
  return {
    labelColor: "text-[var(--danger)]",
    ringColor: "ring-[rgba(194,65,68,0.22)]",
    chipBg: "bg-[rgba(194,65,68,0.10)]",
    badgeBorder: "border-[rgba(194,65,68,0.18)]",
    accent: "rgba(194,65,68,1)",
  };
}

function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}m ${r}s`;
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isFlaggedAnalysis(r: AnalysisResponse): boolean {
  const scoreFlag = r.score < 45;
  const statusFlag = r.status === "High Risk Indicators Detected";
  const verdict = r.agentSignals?.aiJudgment?.verdict;
  const aiFlag = verdict === "suspicious" || verdict === "likely_deceptive";
  return Boolean(scoreFlag || statusFlag || aiFlag);
}


function prettyStepLabel(step: ProgressStep | undefined) {
  if (!step) return "Working";
  return step.label;
}

function ScoreRing({ score, accent }: { score: number; accent: string }) {
  const p = clamp(Math.round(score), 0, 100);
  // Sizes: mobile 80, sm 112, lg 144
  const sizes = { mobile: 80, sm: 112, lg: 144 };
  const strokeWidth = 6;

  return (
    <div className="relative shrink-0 h-20 w-20 sm:h-28 sm:w-28 lg:h-36 lg:w-36">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="rgba(17,24,39,0.08)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke={accent}
          strokeWidth={strokeWidth}
          strokeDasharray={2 * Math.PI * 44}
          strokeDashoffset={2 * Math.PI * 44 * (1 - p / 100)}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-[var(--text)]">{p}</div>
          <div className="text-[10px] sm:text-[11px] lg:text-xs font-medium text-[var(--muted)]">/ 100</div>
        </div>
      </div>
    </div>
  );
}

function TogglePill({
  checked,
  onChange,
  label,
  description,
  icon,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <label className="group inline-flex cursor-pointer select-none items-start gap-3 rounded-2xl border border-[var(--border)] bg-white px-3 py-2 transition hover:border-[rgba(47,111,237,0.32)] focus-within:ring-4 focus-within:ring-[var(--ring)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className="relative mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border border-[var(--border)] bg-white transition-colors peer-checked:border-[rgba(47,111,237,0.6)] peer-checked:bg-[rgba(47,111,237,0.12)]">
        <motion.svg
          className="h-3.5 w-3.5"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <motion.path
            d="M4 10.5l3.1 3.1L16 4.8"
            stroke="rgba(47,111,237,1)"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          />
        </motion.svg>
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-5 text-[var(--text)]">{label}</span>
        {description ? (
          <span className="block text-xs text-[var(--muted)]">{description}</span>
        ) : null}
      </span>
      {icon ? (
        <span className="ml-auto grid h-8 w-8 place-items-center rounded-xl bg-[rgba(17,24,39,0.03)] text-[var(--muted)] transition-colors group-hover:text-[var(--brand)]">
          {icon}
        </span>
      ) : null}
    </label>
  );
}

type ProgressStep = {
  id: string;
  label: string;
  detail: string;
  weight: number;
};

const DEFAULT_EXPECTED_MS = 24_000;
const STANDARD_TIMEOUT_MS = 20_000;
const DEEP_TIMEOUT_MS = 60_000;

const PROGRESS_STEPS: ProgressStep[] = [
  {
    id: "connect",
    label: "Connecting",
    detail: "Validating URL and connecting to the site",
    weight: 0.12,
  },
  {
    id: "fetch",
    label: "Fetching homepage",
    detail: "Capturing redirects, status, and content signals",
    weight: 0.22,
  },
  {
    id: "domain",
    label: "Domain & TLS",
    detail: "Checking domain age and certificate signals",
    weight: 0.16,
  },
  {
    id: "crawl",
    label: "Crawling pages",
    detail: "Sampling multiple internal pages for evidence",
    weight: 0.28,
  },
  {
    id: "reviews",
    label: "External reviews",
    detail: "Checking public review / reputation signals",
    weight: 0.12,
  },
  {
    id: "ai",
    label: "AI judgment",
    detail: "Synthesizing evidence into an assessment",
    weight: 0.10,
  },
];

function useWorkflowProgress(active: boolean, expectedMs: number) {
  const startedAtRef = useRef(0);
  const [tick, bump] = useState(0);

  useEffect(() => {
    if (!active) return;
    startedAtRef.current = performance.now();
    const id = window.setInterval(() => {
      bump((n) => n + 1);
    }, 100);
    return () => window.clearInterval(id);
  }, [active]);

  const elapsedMs = useMemo(() => {
    if (!active) return 0;
    return performance.now() - startedAtRef.current;
  }, [active, tick]);

  const progress = useMemo(() => {
    if (!active) return 0;
    const raw = elapsedMs / Math.max(4000, expectedMs);
    return clamp(raw, 0, 0.95);
  }, [active, elapsedMs, expectedMs]);

  const stepIndex = useMemo(() => {
    if (!active) return 0;
    let acc = 0;
    for (let i = 0; i < PROGRESS_STEPS.length; i++) {
      acc += PROGRESS_STEPS[i].weight;
      if (progress <= acc) return i;
    }
    return PROGRESS_STEPS.length - 1;
  }, [active, progress]);

  const etaSeconds = useMemo(() => {
    if (!active) return 0;
    const remaining = Math.max(0, expectedMs - elapsedMs);
    return Math.max(1, Math.ceil(remaining / 1000));
  }, [active, elapsedMs, expectedMs]);

  return { elapsedMs, progress, stepIndex, etaSeconds };
}

function Icon({ verdict }: { verdict: Verdict }) {
  const size = 18;
  if (verdict === "good") {
    return <Check className="w-[18px] h-[18px] shrink-0 text-[var(--success)]" strokeWidth={2.5} />;
  }
  if (verdict === "bad") {
    return <X className="w-[18px] h-[18px] shrink-0 text-[var(--danger)]" strokeWidth={2.5} />;
  }
  if (verdict === "warn") {
    return <AlertTriangle className="w-[18px] h-[18px] shrink-0 text-[var(--warning)]" strokeWidth={2} />;
  }
  return <Info className="w-[18px] h-[18px] shrink-0 text-[rgba(17,24,39,0.4)]" strokeWidth={2} />;
}

export default function Home() {
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [showAiDetails, setShowAiDetails] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [expandedCrawl, setExpandedCrawl] = useState(false);
  const [screenshot, setScreenshot] = useState<{
    url: string;
    mime?: string;
    expiresInSeconds?: number;
  } | null>(null);
  const [capturingScreenshot, setCapturingScreenshot] = useState(false);
  const [timelineShots, setTimelineShots] = useState<
    Array<{ url: string; mime?: string; expiresInSeconds?: number; label: string; atMs?: number }>
  >([]);
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [capturingTimeline, setCapturingTimeline] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const timelineAbortRef = useRef<AbortController | null>(null);
  const [generatingCard, setGeneratingCard] = useState(false);
  const resultsRef = useRef<HTMLElement | null>(null);
  const [expectedMs, setExpectedMs] = useState(DEFAULT_EXPECTED_MS);
  const [lastRunMs, setLastRunMs] = useState<number | null>(null);
  const [deepAnalysis, setDeepAnalysis] = useState(true);
  const [checkExternalReviews, setCheckExternalReviews] = useState(true);
  const [advancedCrawl, setAdvancedCrawl] = useState(false);
  const autoRanRef = useRef(false);

  const [analysisLog, setAnalysisLog] = useState<AnalysisLogEntry[]>([]);
  const runStartedAtRef = useRef<number | null>(null);
  const lastStepRef = useRef<number>(-1);
  const [scanHistory, setScanHistory] = useState<ScanRecord[]>([]);

  const progress = useWorkflowProgress(loading, expectedMs);

  const theme = useMemo(
    () => scoreTheme(result?.score ?? 0),
    [result?.score]
  );

  const host = useMemo(() => (result ? safeHostname(result.normalizedUrl) : null), [result]);
  const agent = result?.agentSignals?.agent ?? "node";
  const aiJudgment = result?.agentSignals?.aiJudgment ?? null;

  const aiSummary = useMemo(() => {
    const a = aiJudgment?.summary?.trim();
    const b = result?.aiAnalysis?.summary?.trim();
    return a || b || "No AI summary available.";
  }, [aiJudgment?.summary, result?.aiAnalysis?.summary]);

  const aiRecommendation = useMemo(() => {
    const a = aiJudgment?.recommendation?.trim();
    const b = result?.aiAnalysis?.recommendations?.[0]?.trim();
    return a || b || null;
  }, [aiJudgment?.recommendation, result?.aiAnalysis?.recommendations]);

  const externalReviewsText = useMemo(() => {
    const text = result?.agentSignals?.externalReviews;
    const trimmed = typeof text === "string" ? text.trim() : "";
    return trimmed.length > 0 ? trimmed : null;
  }, [result?.agentSignals?.externalReviews]);

  const crawlSnapshot = result?.agentSignals?.crawl ?? null;
  const crawlPages = crawlSnapshot?.pages ?? [];
  const hasCrawlPages = crawlPages.length > 0;

  const requestedTimeoutMs = deepAnalysis ? DEEP_TIMEOUT_MS : STANDARD_TIMEOUT_MS;

  const handleSharedUrl = (sharedUrl: string) => {
    if (autoRanRef.current) return;
    autoRanRef.current = true;
    setUrlInput(sharedUrl);
    void runAnalysis(sharedUrl);
  };

  useEffect(() => {
    if (!result) return;
    const start = performance.now();
    const from = 0;
    const to = Math.max(0, Math.min(100, Math.round(result.score)));
    const durationMs = 700;

    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedScore(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [result]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("trustcheck:expectedMs");
      if (!raw) return;
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 6000 && n <= 120000) setExpectedMs(n);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setScanHistory(loadScanHistory());
  }, []);

  useEffect(() => {
    if (!loading) return;
    const stepIdx = progress.stepIndex;
    if (stepIdx === lastStepRef.current) return;
    lastStepRef.current = stepIdx;

    const startedAt = runStartedAtRef.current;
    const atMs = startedAt ? Math.max(0, performance.now() - startedAt) : 0;
    const step = PROGRESS_STEPS[stepIdx];
    setAnalysisLog((prev) => {
      const next: AnalysisLogEntry[] = [...prev];
      next.push({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        atMs,
        level: "info",
        title: prettyStepLabel(step),
        detail: step?.detail,
      });
      return next.slice(-60);
    });
  }, [loading, progress.stepIndex]);

  useEffect(() => {
    if (!result) return;
    // Persist run into history (client-side) and keep a separate flagged view.
    const record: ScanRecord = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      hostname: safeHostname(result.normalizedUrl),
      url: result.normalizedUrl,
      analyzedAt: result.analyzedAt,
      score: result.score,
      status: result.status,
      aiVerdict: result.agentSignals?.aiJudgment?.verdict,
      aiConfidence: result.agentSignals?.aiJudgment?.confidence,
      flagged: isFlaggedAnalysis(result),
    };

    setScanHistory((prev) => {
      const withoutDup = prev.filter((p) => p.hostname !== record.hostname);
      const next = [record, ...withoutDup].slice(0, 50);
      saveScanHistory(next);
      return next;
    });

    // Add final structured log entries from the agent response.
    setAnalysisLog((prev) => {
      const startedAt = runStartedAtRef.current;
      const baseAt = startedAt ? Math.max(0, performance.now() - startedAt) : 0;
      const next: AnalysisLogEntry[] = [...prev];
      const level: LogLevel = record.flagged ? "bad" : result.score >= 75 ? "good" : result.score >= 45 ? "warn" : "bad";
      next.push({
        id: `${Date.now()}-done`,
        atMs: baseAt,
        level,
        title: "Completed",
        detail: `Score ${result.score}/100 • ${result.status}`,
      });

      const timings = result.agentSignals?.timingsMs;
      if (timings && Object.keys(timings).length > 0) {
        const top = Object.entries(timings)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6);
        for (const [k, v] of top) {
          next.push({
            id: `${Date.now()}-${k}`,
            atMs: baseAt,
            level: "info",
            title: `Timing: ${k}`,
            detail: formatDurationMs(v),
          });
        }
      }

      const notes = result.agentSignals?.warnings ?? [];
      for (const n of notes.slice(0, 4)) {
        next.push({
          id: `${Date.now()}-note-${Math.random().toString(16).slice(2)}`,
          atMs: baseAt,
          level: "warn",
          title: "Note",
          detail: n,
        });
      }

      return next.slice(-80);
    });
  }, [result]);

  async function runAnalysis(explicitUrl?: string, opts?: { force?: boolean }) {
    setError(null);

    let normalized: string;
    try {
      normalized = normalizeUrlInput(explicitUrl ?? urlInput);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please check the URL and try again.");
      return;
    }

    setLoading(true);
    setResult(null);
    setAnimatedScore(0);
    setShowRaw(false);
    setExpandedCrawl(false);
    setScreenshot(null);
    setTimelineShots([]);
    setTimelineIndex(0);
    setTimelineError(null);
    setLastRunMs(null);
    setExpectedMs(requestedTimeoutMs);
    runStartedAtRef.current = performance.now();
    lastStepRef.current = -1;
    setAnalysisLog([
      {
        id: `${Date.now()}-start`,
        atMs: 0,
        level: "info",
        title: "Starting",
        detail: "Preparing analysis run",
      },
    ]);

    const minLoaderMs = 2200;

    try {
      const startedAt = performance.now();
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: normalized,
          force: Boolean(opts?.force),
          timeoutMs: requestedTimeoutMs,
          checkExternalReviews,
          advancedCrawl,
        }),
      });

      const data = (await res.json()) as AnalysisResponse | { error: string };
      if (!res.ok) {
        const message = "error" in data ? data.error : "Something went wrong. Please try again.";
        setError(message);
        return;
      }

      const typed = data as AnalysisResponse;
      setResult(typed);
      setUrlInput(typed.normalizedUrl);
      setShowAiDetails(false);
      setShowRaw(false);
      setScreenshot(typed.agentSignals?.screenshot ?? null);

      // Run timeline screenshots AFTER analysis to avoid concurrent Playwright sessions.
      // This intentionally does NOT affect the main analysis flow or global error banner.
      timelineAbortRef.current?.abort();
      const timelineController = new AbortController();
      timelineAbortRef.current = timelineController;
      void (async () => {
        setCapturingTimeline(true);
        try {
          const res = await fetch("/api/screenshot/timeline", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ url: typed.normalizedUrl }),
            signal: timelineController.signal,
          });
          const data = (await res.json()) as
            | { shots: Array<{ url: string; mime?: string; expiresInSeconds?: number; label: string; atMs?: number }> }
            | { error: string };
          if (!res.ok) {
            const msg = "error" in data ? data.error : "Screenshot timeline unavailable.";
            setTimelineError(msg);
            return;
          }
          if ("shots" in data && Array.isArray(data.shots) && data.shots.length > 0) {
            setTimelineShots(data.shots);
            setTimelineIndex(0);
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
          setTimelineError("Screenshot timeline failed.");
        } finally {
          setCapturingTimeline(false);
        }
      })();

      const durationMs = performance.now() - startedAt;
      setLastRunMs(durationMs);
      try {
        // Simple rolling expectation: mix old expectation with last duration.
        const next = Math.round(expectedMs * 0.7 + durationMs * 0.3);
        const bounded = clamp(next, 8000, 90000);
        localStorage.setItem("trustcheck:expectedMs", String(bounded));
        setExpectedMs(bounded);
      } catch {
        // ignore
      }

      queueMicrotask(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch {
      setError("We couldn’t complete the analysis right now. Please try again in a moment.");
    } finally {
      // Ensure the loader is visible long enough to be perceived.
      // Especially important when results are cached and return instantly.
      try {
        const elapsed = performance.now() - runStartedAtRef.current;
        const remaining = Math.max(0, minLoaderMs - elapsed);
        if (remaining > 0) {
          await new Promise<void>((resolve) => window.setTimeout(() => resolve(), remaining));
        }
      } catch {
        // ignore
      }
      setLoading(false);
    }
  }

  const flaggedCount = useMemo(() => scanHistory.reduce((acc, r) => acc + (r.flagged ? 1 : 0), 0), [scanHistory]);

  async function captureScreenshot() {
    if (!result?.normalizedUrl) return;
    setCapturingScreenshot(true);
    try {
      const res = await fetch("/api/screenshot/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: result.normalizedUrl }),
      });
      const data = (await res.json()) as
        | { id: string; url: string; mime?: string; expiresInSeconds?: number }
        | { error: string };
      if (!res.ok) {
        const msg = "error" in data ? data.error : "Screenshot unavailable.";
        setError(msg);
        return;
      }
      if ("url" in data) {
        setScreenshot({ url: data.url, mime: data.mime, expiresInSeconds: data.expiresInSeconds });
      }
    } catch {
      setError("Screenshot capture failed. Please try again.");
    } finally {
      setCapturingScreenshot(false);
    }
  }

  async function captureTimeline() {
    if (!result?.normalizedUrl) return;
    setTimelineError(null);
    setCapturingTimeline(true);
    timelineAbortRef.current?.abort();
    const controller = new AbortController();
    timelineAbortRef.current = controller;
    try {
      const res = await fetch("/api/screenshot/timeline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: result.normalizedUrl }),
        signal: controller.signal,
      });
      const data = (await res.json()) as
        | { shots: Array<{ url: string; mime?: string; expiresInSeconds?: number; label: string; atMs?: number }> }
        | { error: string };
      if (!res.ok) {
        const msg = "error" in data ? data.error : "Screenshot timeline unavailable.";
        setTimelineError(msg);
        return;
      }
      if ("shots" in data && Array.isArray(data.shots)) {
        setTimelineShots(data.shots);
        setTimelineIndex(0);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setTimelineError("Screenshot timeline failed.");
    } finally {
      setCapturingTimeline(false);
    }
  }

  async function copyJson() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    } catch {
      setError("Copy failed. Your browser may block clipboard access.");
    }
  }

  async function preloadImages(urls: string[], timeoutMs = 3500) {
    const unique = Array.from(new Set(urls.filter(Boolean)));
    if (unique.length === 0) return;
    await Promise.all(
      unique.map(
        (src) =>
          new Promise<void>((resolve) => {
            try {
              const img = new window.Image();
              const t = window.setTimeout(() => {
                try {
                  img.src = "";
                } catch {
                  // ignore
                }
                resolve();
              }, timeoutMs);
              img.onload = () => {
                window.clearTimeout(t);
                resolve();
              };
              img.onerror = () => {
                window.clearTimeout(t);
                resolve();
              };
              img.decoding = "async";
              img.referrerPolicy = "no-referrer";
              img.src = src;
            } catch {
              resolve();
            }
          })
      )
    );
  }

  async function printReport() {
    if (!result) return;
    try {
      setShowRaw(false);
      setShowAiDetails(true);
      setExpandedCrawl(true);

      // Ensure screenshots are loaded (and kept alive) before printing.
      const urls: string[] = [];
      if (screenshot?.url) urls.push(screenshot.url);
      for (const s of timelineShots) {
        if (s?.url) urls.push(s.url);
      }
      await preloadImages(urls);

      window.setTimeout(() => window.print(), 50);
    } catch {
      setError("Print failed. Please try again.");
    }
  }

  async function downloadTrustCard() {
    if (!result) return;
    setGeneratingCard(true);
    try {
      const res = await fetch("/api/trustcard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: result.normalizedUrl,
          score: result.score,
          status: result.status,
          analyzedAt: result.analyzedAt,
          aiSummary,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate card");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trustcheck-${new URL(result.normalizedUrl).hostname}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to generate trust card. Please try again.");
    } finally {
      setGeneratingCard(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Suspense fallback={null}>
        <SearchParamsAutoRun onSharedUrl={handleSharedUrl} />
      </Suspense>
      <Navbar subtitle="Website trust analysis" flaggedCount={flaggedCount} />

      <main className="mx-auto max-w-5xl px-5 pb-16">
        <section className="pt-10 sm:pt-14 print:hidden">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26, mass: 0.9 }}
            className="rounded-3xl bg-[var(--surface)] ring-1 ring-[var(--border)] shadow-[var(--shadow)]"
          >
            <div className="px-6 py-10 sm:px-10 sm:py-12">
              <div className="mx-auto max-w-2xl text-center">
                <h1 className="text-balance text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
                  Clear <span className="text-[#00a79d] font-bold">Trust</span> Signals for any website
                </h1>
                <p className="mt-3 text-pretty text-base leading-7 text-[var(--muted)] sm:text-lg">
                  A structured trust report built from public signals, crawl evidence, and AI judgment.
                </p>
              </div>

              <form
                className="mx-auto mt-8 max-w-2xl"
                onSubmit={(e) => {
                  e.preventDefault();
                  void runAnalysis();
                }}
              >
                <div className="flex flex-col gap-3 sm:flex-row">
                  <label className="sr-only" htmlFor="url">
                    Website URL
                  </label>
                  <input
                    id="url"
                    inputMode="url"
                    autoComplete="url"
                    placeholder="Enter website URL"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-[var(--border)] bg-white px-4 text-[15px] text-[var(--text)] outline-none placeholder:text-[rgba(17,24,39,0.45)] focus:border-[rgba(47,111,237,0.35)] focus:ring-4 focus:ring-[var(--ring)]"
                  />
                  <AnimatedActionButton
                    disabled={loading}
                    label={loading ? "Analyzing…" : "Analyze"}
                    aria-label="Analyze website"
                    onClick={async (e) => {
                      e.preventDefault();
                      await runAnalysis();
                    }}
                  />
                </div>

                {error ? (
                  <div className="mt-4 rounded-2xl border border-[rgba(194,65,68,0.18)] bg-[rgba(194,65,68,0.06)] px-4 py-3 text-sm text-[var(--text)]">
                    <div className="font-medium">Please check and try again</div>
                    <div className="mt-1 text-[var(--muted)]">{error}</div>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center sm:justify-center">
                  <TogglePill
                    checked={deepAnalysis}
                    onChange={setDeepAnalysis}
                    label="Deep analysis"
                    description="8–12 pages, up to ~60s"
                    icon={
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M3 5a2 2 0 012-2h2a1 1 0 010 2H5v10h2a1 1 0 010 2H5a2 2 0 01-2-2V5zm10-2a1 1 0 000 2h2v10h-2a1 1 0 100 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2z" />
                        <path d="M7 10a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" />
                      </svg>
                    }
                  />
                  <TogglePill
                    checked={checkExternalReviews}
                    onChange={setCheckExternalReviews}
                    label="External reviews"
                    description="Best-effort reputation signals"
                    icon={
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.955a1 1 0 00.95.69h4.157c.969 0 1.371 1.24.588 1.81l-3.363 2.444a1 1 0 00-.364 1.118l1.286 3.955c.3.921-.755 1.688-1.538 1.118l-3.363-2.444a1 1 0 00-1.176 0l-3.363 2.444c-.783.57-1.838-.197-1.538-1.118l1.286-3.955a1 1 0 00-.364-1.118L2.068 9.382c-.783-.57-.38-1.81.588-1.81h4.157a1 1 0 00.95-.69l1.286-3.955z" />
                      </svg>
                    }
                  />
                  <TogglePill
                    checked={advancedCrawl}
                    onChange={setAdvancedCrawl}
                    label="Advanced crawl"
                    description="Spider-web mode, more pages"
                    icon={
                      <WrenchIcon className="w-4 h-5"/>
                    }
                  />
                </div>

                <div className="mt-4 text-center text-xs text-[var(--muted)] sm:text-sm">
                  Tip: You can paste a domain like <span className="font-medium">example.com</span>.
                </div>
              </form>
            </div>
          </motion.div>
        </section>

        <AnimatePresence>
          {loading ? (
            <motion.section
              key="workflow"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.25 }}
              className="mt-8 sm:mt-10"
              aria-live="polite"
            >
              <div className="rounded-3xl bg-[var(--surface)] ring-1 ring-[var(--border)] shadow-[var(--shadow)]">
                <div className="px-6 py-7 sm:px-8">
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-[var(--text)]">Analysis in progress</div>
                      <div className="mt-1 text-sm text-[var(--muted)]">
                        Estimated time remaining: <span className="font-medium text-[var(--text)]">~{progress.etaSeconds}s</span>
                      </div>
                      <div className="mt-2 text-xs text-[var(--muted)]">
                        {PROGRESS_STEPS[progress.stepIndex]?.detail}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--muted)]">
                        Workflow
                      </div>
                      <div className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--muted)]">
                        {formatDurationMs(progress.elapsedMs)} elapsed
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 h-3 w-full rounded-full bg-[rgba(17,24,39,0.06)] overflow-hidden">
                    <motion.div
                      className="h-3 rounded-full bg-[var(--brand)]"
                      initial={{ width: "6%" }}
                      animate={{ width: `${Math.round(progress.progress * 100)}%` }}
                      transition={{ type: "spring", stiffness: 180, damping: 24 }}
                    />
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {PROGRESS_STEPS.map((s, idx) => {
                      const state = idx < progress.stepIndex ? "done" : idx === progress.stepIndex ? "active" : "todo";
                      return (
                        <div
                          key={s.id}
                          className={`rounded-2xl border bg-white px-4 py-4 ${state === "active"
                            ? "border-[rgba(47,111,237,0.25)] shadow-[0_10px_30px_rgba(47,111,237,0.08)]"
                            : "border-[var(--border)]"
                            }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                              {state === "done" ? (
                                <svg className="h-5 w-5 text-[var(--success)]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                  <path
                                    fillRule="evenodd"
                                    d="M16.704 5.29a1 1 0 010 1.414l-7.22 7.22a1 1 0 01-1.414 0L3.296 9.15a1 1 0 011.414-1.414l3.017 3.017 6.513-6.513a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              ) : state === "active" ? (
                                <Loader size={20} tone="brand" label="Working" />
                              ) : (
                                <span className="h-5 w-5 rounded-full border border-[var(--border)] bg-[rgba(17,24,39,0.02)]" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-[var(--text)]">{s.label}</div>
                              <div className="mt-1 text-sm text-[var(--muted)]">{s.detail}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-6 text-xs text-[var(--muted)]">
                    Tip: Some websites block automation; in those cases, confidence is lowered.
                  </div>

                  <div className="mt-5 rounded-2xl border border-[var(--border)] bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--text)]">Live analysis log</div>
                        <div className="mt-1 text-sm text-[var(--muted)]">What’s happening during this run.</div>
                      </div>
                      <div className="rounded-full border border-[var(--border)] bg-[rgba(17,24,39,0.02)] px-3 py-1.5 text-xs font-medium text-[var(--muted)]">
                        {progress.etaSeconds}s ETA
                      </div>
                    </div>
                    <div className="mt-3 max-h-40 overflow-auto rounded-xl border border-[var(--border)] bg-[rgba(17,24,39,0.01)]">
                      <ul className="divide-y divide-[var(--border)]">
                        {analysisLog.length > 0 ? (
                          analysisLog.slice(-12).map((e) => (
                            <li key={e.id} className="px-3 py-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-[var(--text)] truncate">{e.title}</div>
                                  {e.detail ? (
                                    <div className="mt-0.5 text-xs text-[var(--muted)] break-words">{e.detail}</div>
                                  ) : null}
                                </div>
                                <div className="shrink-0 text-xs text-[var(--muted)]">{formatDurationMs(e.atMs)}</div>
                              </div>
                            </li>
                          ))
                        ) : (
                          <li className="px-3 py-3 text-sm text-[var(--muted)]">Waiting for the first signal…</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {result ? (
            <motion.section
              key="results"
              ref={resultsRef}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.25 }}
              className="mt-8 sm:mt-10"
              aria-live="polite"
            >
              <div className="rounded-3xl bg-[var(--surface)] ring-1 ring-[var(--border)] shadow-[var(--shadow)]">
                <div className="px-6 py-7 sm:px-8">
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[var(--muted)]">Report</div>
                      <div className="mt-1 text-xl font-semibold tracking-tight text-[var(--text)] truncate">
                        {host}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-[var(--muted)]">
                        <span className="rounded-full border border-[var(--border)] bg-white px-2 sm:px-3 py-1 sm:py-1.5 truncate max-w-[140px] sm:max-w-none">{agent === "python" ? "ScamCheck" : "Local"}</span>
                        <span className="rounded-full border border-[var(--border)] bg-white px-2 sm:px-3 py-1 sm:py-1.5">{result.cached ? "Cached" : "Fresh"}</span>
                        <span className="hidden sm:inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5">{new Date(result.analyzedAt).toLocaleString()}</span>
                        {lastRunMs != null ? (
                          <span className="hidden sm:inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5">Run: {formatDurationMs(lastRunMs)}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className={`rounded-full px-3 py-2 text-sm font-semibold ${theme.labelColor} ${theme.chipBg} ring-1 ring-[rgba(17,24,39,0.08)]`}>
                      {result.status}
                    </div>
                  </div>

                  <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_1.25fr]">
                    <motion.div
                      whileHover={{ y: -2 }}
                      transition={{ type: "spring", stiffness: 340, damping: 26, mass: 0.6 }}
                      className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-6 overflow-hidden"
                    >
                      {/* Score Header */}
                      <div className="flex items-center gap-4">
                        <ScoreRing score={animatedScore} accent={theme.accent} />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Trust Score</div>
                          <div className="mt-1 text-sm text-[var(--muted)]">
                            {aiJudgment ? (
                              <span>
                                AI: <span className="font-semibold text-[var(--text)]">{aiJudgment.verdict.replace(/_/g, " ")}</span>
                              </span>
                            ) : result.aiAnalysis ? (
                              <span>
                                Confidence: <span className="font-medium text-[var(--text)] capitalize">{result.aiAnalysis.confidenceLevel}</span>
                              </span>
                            ) : (
                              <span className="text-xs">AI judgment not available</span>
                            )}
                          </div>
                          {/* Badges inline with text on mobile */}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {aiJudgment?.category && (
                              <span className="rounded-full bg-[rgba(17,24,39,0.04)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                                {aiJudgment.category}
                              </span>
                            )}
                            {(aiJudgment?.confidence || result.aiAnalysis?.confidenceLevel) && (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${theme.chipBg} ${theme.labelColor}`}>
                                {aiJudgment?.confidence ?? result.aiAnalysis?.confidenceLevel}
                              </span>
                            )}
                            {aiJudgment?.platform && (
                              <span className="rounded-full bg-[rgba(17,24,39,0.04)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                                {aiJudgment.platform}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons - Compact Grid */}
                      <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 print:hidden">
                        <button
                          type="button"
                          onClick={() => void runAnalysis(result.normalizedUrl)}
                          disabled={loading}
                          className="rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-[var(--text)] hover:bg-[rgba(17,24,39,0.02)]"
                        >
                          Re-analyze
                        </button>
                        <button
                          type="button"
                          onClick={() => void runAnalysis(result.normalizedUrl, { force: true })}
                          disabled={loading}
                          className="rounded-xl bg-[rgba(47,111,237,0.08)] px-3 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-[var(--brand-ink)] hover:bg-[rgba(47,111,237,0.12)] flex items-center justify-center gap-1.5"
                        >
                          <RefreshCcwIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          Refresh
                        </button>
                        <button
                          type="button"
                          onClick={() => void copyJson()}
                          className="rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-[var(--text)] hover:bg-[rgba(17,24,39,0.02)] flex items-center justify-center gap-1.5"
                        >
                          <CopyIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => printReport()}
                          className="rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-[var(--text)] hover:bg-[rgba(17,24,39,0.02)] flex items-center justify-center gap-1.5"
                        >
                          <PrinterIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          Print
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => void downloadTrustCard()}
                        disabled={generatingCard}
                        className="mt-2 w-full rounded-xl border border-[var(--border)] bg-gradient-to-r from-[rgba(47,111,237,0.04)] to-transparent px-3 py-2.5 text-xs font-semibold text-[var(--text)] hover:from-[rgba(47,111,237,0.08)] flex items-center justify-center gap-1.5 print:hidden"
                      >
                        {generatingCard ? (
                          <>
                            <span className="h-3.5 w-3.5 rounded-full border-2 border-[var(--brand)]/30 border-t-[var(--brand)] animate-spin" />
                            Generating…
                          </>
                        ) : (
                          <>
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            Download Trust Card
                          </>
                        )}
                      </button>
                    </motion.div>

                    <motion.div
                      whileHover={{ y: -2 }}
                      transition={{ type: "spring", stiffness: 340, damping: 26, mass: 0.6 }}
                      className="rounded-3xl border border-[var(--border)] bg-white p-6"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--text)]">Key findings</div>
                          <div className="mt-1 text-sm text-[var(--muted)]">
                            A concise summary plus the evidence used.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAiDetails(!showAiDetails)}
                          className="rounded-full border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--brand)] hover:text-[var(--brand-ink)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
                        >
                          {showAiDetails ? "Hide details" : "Show details"}
                        </button>
                      </div>

                      <div className="mt-5">
                        <div className={`rounded-2xl border ${theme.badgeBorder} ${theme.chipBg} px-4 py-4`}>
                          <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Summary</div>
                          <div className="mt-2 text-sm text-[var(--text)]">
                            {aiSummary}
                          </div>
                          {aiRecommendation ? (
                            <div className="mt-3 text-sm text-[var(--muted)]">
                              <span className="font-medium text-[var(--text)]">Recommendation: </span>
                              {aiRecommendation}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <AnimatePresence>
                        {showAiDetails ? (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            transition={{ duration: 0.2 }}
                            className="mt-5 grid gap-5"
                          >
                            {(aiJudgment?.positiveSignals?.length || result.aiAnalysis?.trustSignals?.positive?.length) ? (
                              <div>
                                <div className="text-xs font-medium text-[var(--success)] uppercase tracking-wide mb-2">Positive signals</div>
                                <ul className="space-y-1">
                                  {(aiJudgment?.positiveSignals ?? result.aiAnalysis?.trustSignals.positive ?? []).slice(0, 10).map((signal, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--muted)]">
                                      <span className="text-[var(--success)] mt-0.5">+</span>
                                      {signal}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}

                            {(aiJudgment?.detectedIssues?.length || result.aiAnalysis?.trustSignals?.negative?.length) ? (
                              <div>
                                <div className="text-xs font-medium text-[var(--warning)] uppercase tracking-wide mb-2">Areas of concern</div>
                                <ul className="space-y-1">
                                  {(aiJudgment?.detectedIssues ?? result.aiAnalysis?.trustSignals.negative ?? []).slice(0, 12).map((signal, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--muted)]">
                                      <span className="text-[var(--warning)] mt-0.5">!</span>
                                      {signal}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}

                            {aiJudgment?.businessIdentity || aiJudgment?.productLegitimacy ? (
                              <div className="grid gap-3 sm:grid-cols-2">
                                {aiJudgment.businessIdentity ? (
                                  <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4">
                                    <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Business identity</div>
                                    <div className="mt-2 text-sm text-[var(--text)]">{aiJudgment.businessIdentity}</div>
                                  </div>
                                ) : null}
                                {aiJudgment.productLegitimacy ? (
                                  <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4">
                                    <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Product legitimacy</div>
                                    <div className="mt-2 text-sm text-[var(--text)]">{aiJudgment.productLegitimacy}</div>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </motion.div>
                        ) : null}
                      </AnimatePresence>

                      <div className="mt-6 pt-5 border-t border-[var(--border)]">
                        <div className="text-sm font-semibold text-[var(--text)]">Why this score?</div>
                        <div className="mt-1 text-sm text-[var(--muted)]">Signals captured during the run.</div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          {result.explainability.map((item) => (
                            <div key={item.key} className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4 overflow-hidden">
                              <div className="flex items-start gap-3">
                                <Icon verdict={item.verdict} />
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-semibold text-[var(--text)] truncate">{item.label}</div>
                                  <div className="mt-1 text-sm text-[var(--muted)] line-clamp-3">{item.detail}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  <div className="mt-6 grid gap-6 lg:grid-cols-2">
                    {/* External Reviews */}
                    <div className="rounded-3xl bg-[var(--surface)] ring-1 ring-[var(--border)] shadow-[var(--shadow)] overflow-hidden">
                      <div className="px-4 py-5 sm:px-6">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-[var(--text)]">External reviews</div>
                            <div className="text-xs text-[var(--muted)] truncate">Public reputation signals</div>
                          </div>
                          <div className="shrink-0 rounded-full border border-[var(--border)] bg-white px-2 py-1 text-xs font-medium text-[var(--muted)]">
                            {agent === "python" && externalReviewsText ? "Agent" : "Limited"}
                          </div>
                        </div>
                        <div className="mt-3 rounded-xl border border-[var(--border)] bg-white p-3 overflow-hidden">
                          {externalReviewsText ? (
                            <p className="text-sm text-[var(--text)] leading-relaxed break-words whitespace-pre-wrap">
                              {externalReviewsText}
                            </p>
                          ) : (
                            <p className="text-sm text-[var(--muted)]">No external reviews available.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Crawl Snapshot */}
                    <div className="rounded-3xl bg-[var(--surface)] ring-1 ring-[var(--border)] shadow-[var(--shadow)] overflow-hidden">
                      <div className="px-4 py-5 sm:px-6">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-[var(--text)]">Crawl snapshot</div>
                            <div className="text-xs text-[var(--muted)] truncate">Internal pages sampled</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setExpandedCrawl((v) => !v)}
                            className="shrink-0 rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--brand)]"
                          >
                            {expandedCrawl ? "Collapse" : "Expand"}
                          </button>
                        </div>
                        <div className="mt-3 rounded-xl border border-[var(--border)] bg-white p-3 overflow-hidden">
                          {crawlSnapshot ? (
                            <>
                              <div className="flex flex-wrap gap-3 text-xs text-[var(--muted)] mb-2">
                                <span>Requested: <strong className="text-[var(--text)]">{crawlSnapshot.pagesRequested}</strong></span>
                                <span>Fetched: <strong className="text-[var(--text)]">{crawlSnapshot.pagesFetched}</strong></span>
                              </div>
                              {hasCrawlPages ? (
                                <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
                                  {(expandedCrawl ? crawlPages : crawlPages.slice(0, 4)).map((p) => (
                                    <a
                                      key={p.url}
                                      href={p.finalUrl ?? p.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="block rounded-lg border border-[var(--border)] px-2.5 py-1.5 hover:bg-[rgba(17,24,39,0.02)] overflow-hidden"
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="min-w-0 flex-1">
                                          <div className="text-xs font-medium text-[var(--text)] truncate">{p.url}</div>
                                          <div className="text-[10px] text-[var(--muted)] truncate">{p.contentType ?? "unknown"}</div>
                                        </div>
                                        <span className="shrink-0 text-xs font-medium text-[var(--muted)]">{p.httpStatus ?? "—"}</span>
                                      </div>
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-[var(--muted)]">No crawl data available.</p>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-[var(--muted)]">No crawl data available.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {result.agentSignals?.warnings && result.agentSignals.warnings.length > 0 ? (
                    <div className="mt-6 rounded-3xl border border-[rgba(183,121,31,0.18)] bg-[rgba(183,121,31,0.06)] px-6 py-5">
                      <div className="text-sm font-semibold text-[var(--text)]">Run notes</div>
                      <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
                        {result.agentSignals.warnings.slice(0, 8).map((w, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-[var(--warning)] mt-0.5">•</span>
                            <span className="break-words">{w}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="mt-6 rounded-3xl bg-[var(--surface)] ring-1 ring-[var(--border)] shadow-[var(--shadow)]">
                    <div className="px-6 py-7 sm:px-8">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--text)]">Diagnostics</div>
                          <div className="mt-1 text-sm text-[var(--muted)]">Raw technical signals and timing breakdown.</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowRaw((v) => !v)}
                          className="rounded-full border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--brand)] hover:text-[var(--brand-ink)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
                        >
                          {showRaw ? "Hide raw" : "Show raw"}
                        </button>
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                          <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">TLS</div>
                          <div className="mt-2 text-sm text-[var(--text)]">
                            {result.agentSignals?.tls ? (
                              <>
                                <div>Supported: <span className="font-medium">{result.agentSignals.tls.supported ? "Yes" : "No"}</span></div>
                                {result.agentSignals.tls.issuer ? (
                                  <div className="mt-1 text-[var(--muted)]">Issuer: {result.agentSignals.tls.issuer}</div>
                                ) : null}
                                {result.agentSignals.tls.daysToExpiry != null ? (
                                  <div className="mt-1 text-[var(--muted)]">Days to expiry: {result.agentSignals.tls.daysToExpiry}</div>
                                ) : null}
                              </>
                            ) : (
                              <span className="text-[var(--muted)]">Not available.</span>
                            )}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                          <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Timing</div>
                          <div className="mt-2 text-sm text-[var(--text)]">
                            {result.agentSignals?.timingsMs && Object.keys(result.agentSignals.timingsMs).length > 0 ? (
                              <div className="space-y-1">
                                {Object.entries(result.agentSignals.timingsMs)
                                  .sort((a, b) => b[1] - a[1])
                                  .slice(0, 6)
                                  .map(([k, v]) => (
                                    <div key={k} className="flex items-center justify-between gap-3">
                                      <span className="text-[var(--muted)]">{k}</span>
                                      <span className="font-medium text-[var(--text)]">{formatDurationMs(v)}</span>
                                    </div>
                                  ))}
                              </div>
                            ) : (
                              <span className="text-[var(--muted)]">Not available.</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <AnimatePresence>
                        {showRaw ? (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            transition={{ duration: 0.2 }}
                            className="mt-5 rounded-2xl border border-[var(--border)] bg-white p-4"
                          >
                            <pre className="whitespace-pre-wrap break-all text-xs leading-6 text-[var(--text)] overflow-x-auto max-w-full">
                              {JSON.stringify(result, null, 2)}
                            </pre>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </div >
            </motion.section >
          ) : null
          }
        </AnimatePresence >

        {
          result ? (
            <section className="mt-10 print:hidden" >
              <div className="rounded-3xl bg-[var(--surface)] ring-1 ring-[var(--border)] shadow-[var(--shadow)]">
                <div className="px-6 py-7 sm:px-8">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-[var(--text)]">Site snapshots</div>
                      <div className="mt-1 text-sm text-[var(--muted)]">1s, 3s, and 5s timeline snapshots (short-lived).</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void captureTimeline()}
                        disabled={capturingTimeline}
                        className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(17,24,39,0.03)] disabled:opacity-60"
                      >
                        {capturingTimeline ? "Capturing timeline…" : "Capture 1s/3s/5s"}
                      </button>
                      {timelineShots[timelineIndex]?.expiresInSeconds ? (
                        <span className="rounded-full border border-[var(--border)] bg-[rgba(17,24,39,0.02)] px-3 py-1.5 text-xs font-medium text-[var(--muted)]">
                          Expires in ~{timelineShots[timelineIndex]?.expiresInSeconds}s
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white overflow-hidden">
                    {timelineShots.length > 0 && timelineShots[timelineIndex]?.url ? (
                      <a href={timelineShots[timelineIndex].url} target="_blank" rel="noreferrer" className="block">
                        <img
                          src={timelineShots[timelineIndex].url}
                          alt={`Screenshot of ${result.normalizedUrl}`}
                          className="w-full h-auto"
                          referrerPolicy="no-referrer"
                        />
                      </a>
                    ) : (
                      <div className="px-4 py-5 text-sm text-[var(--muted)]">
                        {timelineError ? (
                          <span className="text-[rgba(194,65,68,1)]">{timelineError}</span>
                        ) : capturingTimeline ? (
                          "Capturing timeline…"
                        ) : (
                          "No timeline snapshots yet. Availability depends on the agent and the site."
                        )}
                      </div>
                    )}
                  </div>

                  {timelineShots.length > 1 ? (
                    <div className="mt-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-medium text-[var(--muted)]">
                          Showing <span className="text-[var(--text)]">{timelineShots[timelineIndex]?.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setTimelineIndex((i) => (i - 1 + timelineShots.length) % timelineShots.length)}
                            className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(17,24,39,0.03)]"
                          >
                            Prev
                          </button>
                          <button
                            type="button"
                            onClick={() => setTimelineIndex((i) => (i + 1) % timelineShots.length)}
                            className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(17,24,39,0.03)]"
                          >
                            Next
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {timelineShots.map((s, idx) => (
                          <button
                            key={`${s.url}-${idx}`}
                            type="button"
                            onClick={() => setTimelineIndex(idx)}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                              idx === timelineIndex
                                ? "border-[rgba(47,111,237,0.35)] bg-[rgba(47,111,237,0.08)] text-[var(--brand)]"
                                : "border-[var(--border)] bg-white text-[var(--text)] hover:bg-[rgba(17,24,39,0.03)]"
                            )}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {timelineShots.length === 0 && screenshot?.url ? (
                    <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[rgba(17,24,39,0.01)] px-4 py-3 text-sm text-[var(--muted)]">
                      A single snapshot is available. Use “Capture 1s/3s/5s” for the timeline.
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

        <section className="mt-10 rounded-3xl bg-[var(--surface)] ring-1 ring-[var(--border)] shadow-[var(--shadow)] px-6 py-7 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--text)]">See something suspicious?</div>
              <div className="mt-1 text-sm text-[var(--muted)]">Help improve detection by reporting scam URLs.</div>
            </div>
            <Link
              href="/report"
              className="group inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--brand)] hover:text-[var(--brand-ink)] hover:bg-[rgba(17,24,39,0.03)] transition-colors"
            >
              Report a Scam
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>

        <section
          id="disclaimer"
          className="mt-10 rounded-3xl border border-[var(--border)] bg-[rgba(17,24,39,0.02)] px-6 py-6 text-sm text-[var(--muted)]"
        >
          <div className="text-sm font-semibold text-[var(--text)]">Disclaimer</div>
          <p className="mt-2 leading-7">
            ScamCheck summarizes publicly observable signals (HTTPS/TLS, redirects, domain age, headers, and crawl evidence).
            It does not make legal or factual claims about any website.{" "}
            <a
              href="/disclaimer"
              className="font-medium text-[var(--brand)] hover:text-[var(--brand-ink)] underline underline-offset-2"
            >
              Read full disclaimer
            </a>
          </p>
        </section>
      </main >

      <footer className="mx-auto max-w-5xl px-5 pb-10">
        <div className="flex flex-col gap-1 text-xs text-[rgba(17,24,39,0.45)]">
          <span>Designed to help you think clearly, not to accuse.</span>
          <a
            href="https://scamcheck.tech"
            target="_blank"
            rel="noreferrer"
            className="w-fit text-[rgba(47,111,237,0.85)] hover:text-[rgba(47,111,237,1)]"
          >
            scamcheck.tech
          </a>
        </div>
      </footer>
    </div >
  );
}

function SearchParamsAutoRun({
  onSharedUrl,
}: {
  onSharedUrl: (url: string) => void;
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const sharedUrl = searchParams.get("url") || searchParams.get("u");
    if (!sharedUrl) return;
    onSharedUrl(sharedUrl);
  }, [onSharedUrl, searchParams]);

  return null;
}
