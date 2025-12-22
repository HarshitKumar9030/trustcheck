"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { CopyIcon, PrinterIcon, RefreshCcwIcon } from "lucide-react";
import { AnimatedActionButton } from "./components/AnimatedActionButton";

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

function ScoreRing({ score, accent }: { score: number; accent: string }) {
  const p = clamp(Math.round(score), 0, 100);
  const deg = p * 3.6;
  return (
    <div
      className="relative grid h-28 w-28 place-items-center rounded-full"
      style={{
        background: `conic-gradient(${accent} ${deg}deg, rgba(17,24,39,0.08) 0deg)`,
      }}
      aria-label={`Trust score ${p} out of 100`}
    >
      <div className="grid h-[104px] w-[104px] place-items-center rounded-full bg-[var(--surface)] ring-1 ring-[var(--border)]">
        <div className="text-center">
          <div className="text-3xl font-semibold tracking-tight text-[var(--text)]">{p}</div>
          <div className="text-[11px] font-medium text-[var(--muted)]">/ 100</div>
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
    <label className="group inline-flex cursor-pointer select-none items-start gap-3 rounded-2xl border border-[var(--border)] bg-white px-3 py-2 transition hover:border-[rgba(47,111,237,0.32)] hover:shadow-sm focus-within:ring-4 focus-within:ring-[var(--ring)]">
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
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!active) return;
    setElapsedMs(0);
    const startedAt = performance.now();
    const id = window.setInterval(() => {
      setElapsedMs(performance.now() - startedAt);
    }, 100);
    return () => window.clearInterval(id);
  }, [active]);

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
  const common = "h-5 w-5";
  if (verdict === "good") {
    return (
      <svg
        className={`${common} text-[var(--success)]`}
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M16.704 5.29a1 1 0 010 1.414l-7.22 7.22a1 1 0 01-1.414 0L3.296 9.15a1 1 0 011.414-1.414l3.017 3.017 6.513-6.513a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  if (verdict === "bad") {
    return (
      <svg
        className={`${common} text-[var(--danger)]`}
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm2.707-10.707a1 1 0 00-1.414-1.414L10 7.172 8.707 5.879a1 1 0 10-1.414 1.414L8.586 8.586 7.293 9.879a1 1 0 101.414 1.414L10 10l1.293 1.293a1 1 0 001.414-1.414L11.414 8.586l1.293-1.293z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  if (verdict === "warn") {
    return (
      <svg
        className={`${common} text-[var(--warning)]`}
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.72-1.36 3.485 0l6.518 11.594c.75 1.333-.213 2.99-1.742 2.99H3.48c-1.53 0-2.492-1.657-1.742-2.99L8.257 3.1zM10 7a1 1 0 00-1 1v3a1 1 0 002 0V8a1 1 0 00-1-1zm0 8a1.25 1.25 0 100-2.5A1.25 1.25 0 0010 15z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return (
    <svg
      className={`${common} text-[rgba(17,24,39,0.35)]`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-11a1 1 0 00-1 1v1a1 1 0 002 0V8a1 1 0 00-1-1zm0 7a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
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
  const [generatingCard, setGeneratingCard] = useState(false);
  const resultsRef = useRef<HTMLElement | null>(null);
  const [expectedMs, setExpectedMs] = useState(DEFAULT_EXPECTED_MS);
  const [lastRunMs, setLastRunMs] = useState<number | null>(null);
  const [deepAnalysis, setDeepAnalysis] = useState(true);
  const [checkExternalReviews, setCheckExternalReviews] = useState(true);
  const autoRanRef = useRef(false);

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
    setLastRunMs(null);
    setExpectedMs(requestedTimeoutMs);

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
      setLoading(false);
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

  function printReport() {
    if (!result) return;
    try {
      setShowRaw(false);
      setShowAiDetails(true);
      setExpandedCrawl(true);
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
      <header className="mx-auto max-w-5xl px-5 py-6 print:hidden">
        <div className="flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 group">
            <Image
              src="/trustcheck.png"
              alt="TrustCheck"
              width={36}
              height={36}
              className="rounded-xl ring-1 ring-[var(--border)] shadow-[0_8px_30px_rgba(17,24,39,0.06)]"
            />
            <div>
              <div className="text-sm font-semibold tracking-tight text-[var(--text)] group-hover:text-[var(--brand)] transition-colors">
                TrustCheck
              </div>
              <div className="text-xs text-[var(--muted)]">AI-Powered Trust Analysis</div>
            </div>
          </a>

          <div className="flex items-center gap-1">
            <a
              href="/donate"
              className="rounded-full px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
            >
              Donate
            </a>
            <a
              href="/disclaimer"
              className="rounded-full px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
            >
              Disclaimer
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-16">
        <section className="pt-10 sm:pt-14 print:hidden">
          <div className="rounded-3xl bg-[var(--surface)] ring-1 ring-[var(--border)] shadow-[var(--shadow)]">
            <div className="px-6 py-10 sm:px-10 sm:py-12">
              <div className="mx-auto max-w-2xl text-center">
                <h1 className="text-balance text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
                  Clear trust signals for any website
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
                    className="h-12 w-full rounded-2xl border border-[var(--border)] bg-white px-4 text-[15px] text-[var(--text)] shadow-sm outline-none placeholder:text-[rgba(17,24,39,0.45)] focus:border-[rgba(47,111,237,0.35)] focus:ring-4 focus:ring-[var(--ring)]"
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
                </div>

                <div className="mt-4 text-center text-xs text-[var(--muted)] sm:text-sm">
                  Tip: You can paste a domain like <span className="font-medium">example.com</span>.
                </div>
              </form>
            </div>
          </div>
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
                          className={`rounded-2xl border bg-white px-4 py-4 ${
                            state === "active"
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
                                <span className="h-5 w-5 rounded-full border-2 border-[var(--brand)]/25 border-t-[var(--brand)] animate-spin" />
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
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                            <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5">Source: {agent === "python" ? "TrustCheck Agent" : "Local analyzer"}</span>
                        <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5">{result.cached ? "Cached" : "Fresh"}</span>
                        <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5">{new Date(result.analyzedAt).toLocaleString()}</span>
                        {lastRunMs != null ? (
                          <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5">Run time: {formatDurationMs(lastRunMs)}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className={`rounded-full px-3 py-2 text-sm font-semibold ${theme.labelColor} ${theme.chipBg} ring-1 ring-[rgba(17,24,39,0.08)]`}>
                      {result.status}
                    </div>
                  </div>

                  <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_1.25fr]">
                    <div className="rounded-3xl border border-[var(--border)] bg-white p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-medium text-[var(--muted)]">Trust Score</div>
                          <div className="mt-2 text-sm text-[var(--muted)]">
                            {aiJudgment ? (
                              <span>
                                AI verdict: <span className="font-medium text-[var(--text)]">{aiJudgment.verdict.replace(/_/g, " ")}</span>
                              </span>
                            ) : result.aiAnalysis ? (
                              <span>
                                AI confidence: <span className="font-medium text-[var(--text)] capitalize">{result.aiAnalysis.confidenceLevel}</span>
                              </span>
                            ) : (
                              <span>AI judgment not available.</span>
                            )}
                          </div>
                        </div>

                        <ScoreRing score={animatedScore} accent={theme.accent} />
                      </div>

                      <div className="mt-6 flex flex-wrap gap-2">
                        {aiJudgment?.category ? (
                          <span className="rounded-full border border-[var(--border)] bg-[rgba(17,24,39,0.02)] px-3 py-1.5 text-xs font-medium text-[var(--muted)]">
                            Category: <span className="text-[var(--text)]">{aiJudgment.category}</span>
                          </span>
                        ) : null}
                        {aiJudgment?.confidence ? (
                          <span className={`rounded-full border px-3 py-1.5 text-xs font-medium ${theme.badgeBorder} ${theme.chipBg} ${theme.labelColor}`}>
                            Confidence: <span className="capitalize">{aiJudgment.confidence}</span>
                          </span>
                        ) : result.aiAnalysis?.confidenceLevel ? (
                          <span className={`rounded-full border px-3 py-1.5 text-xs font-medium ${theme.badgeBorder} ${theme.chipBg} ${theme.labelColor}`}>
                            Confidence: <span className="capitalize">{result.aiAnalysis.confidenceLevel}</span>
                          </span>
                        ) : null}
                        {aiJudgment?.platform ? (
                          <span className="rounded-full border border-[var(--border)] bg-[rgba(17,24,39,0.02)] px-3 py-1.5 text-xs font-medium text-[var(--muted)]">
                            Platform: <span className="text-[var(--text)]">{aiJudgment.platform}</span>
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-6 flex flex-col gap-3">
                        <button
                          type="button"
                          onClick={() => void runAnalysis(result.normalizedUrl)}
                          disabled={loading}
                          className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text)] shadow-sm transition hover:bg-[rgba(17,24,39,0.03)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)] print:hidden"
                        >
                          Re-analyze
                        </button>
                        <div className="grid gap-3 sm:grid-cols-3 print:hidden">
                          <button
                            type="button"
                            onClick={() => void runAnalysis(result.normalizedUrl, { force: true })}
                            disabled={loading}
                            className="rounded-2xl bg-[rgba(47,111,237,0.10)] px-4 py-3 text-sm font-semibold text-[var(--brand-ink)] shadow-sm transition hover:bg-[rgba(47,111,237,0.14)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
                            title="Refresh"
                          >
                            <span className="inline-flex items-center justify-center gap-2">
                              <RefreshCcwIcon className="h-4 w-4"/>
                              Refresh
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void copyJson()}
                            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text)] shadow-sm transition hover:bg-[rgba(17,24,39,0.03)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
                          >
                            <span className="inline-flex items-center justify-center gap-2">
                              <CopyIcon className="h-4 w-4" />
                              Copy JSON
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => printReport()}
                            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text)] shadow-sm transition hover:bg-[rgba(17,24,39,0.03)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
                          >
                            <span className="inline-flex items-center justify-center gap-2">
                              <PrinterIcon className="h-4 w-4"/>
                              Print
                            </span>
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => void downloadTrustCard()}
                          disabled={generatingCard}
                          className="w-full rounded-2xl border border-[var(--border)] bg-gradient-to-r from-[rgba(47,111,237,0.05)] to-[rgba(47,111,237,0.02)] px-4 py-3 text-sm font-semibold text-[var(--text)] shadow-sm transition hover:from-[rgba(47,111,237,0.08)] hover:to-[rgba(47,111,237,0.04)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)] flex items-center justify-center gap-2 print:hidden"
                        >
                          {generatingCard ? (
                            <>
                              <span className="h-4 w-4 rounded-full border-2 border-[var(--brand)]/40 border-t-[var(--brand)] animate-spin" />
                              Generating…
                            </>
                          ) : (
                            <>
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                              </svg>
                              Download Trust Card
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-[var(--border)] bg-white p-6">
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
                            <div key={item.key} className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4">
                              <div className="flex items-start gap-3">
                                <Icon verdict={item.verdict} />
                                <div>
                                  <div className="text-sm font-semibold text-[var(--text)]">{item.label}</div>
                                  <div className="mt-1 text-sm text-[var(--muted)]">{item.detail}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-6 lg:grid-cols-2">
                    <div className="rounded-3xl bg-[var(--surface)] ring-1 ring-[var(--border)] shadow-[var(--shadow)]">
                      <div className="px-6 py-7 sm:px-8">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-[var(--text)]">External reviews</div>
                            <div className="mt-1 text-sm text-[var(--muted)]">Public reputation signals (best-effort).</div>
                          </div>
                          <div className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--muted)]">
                            {agent === "python" && externalReviewsText ? "Agent" : "Limited"}
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-4">
                          {externalReviewsText ? (
                            <pre className="whitespace-pre-wrap text-sm text-[var(--text)] leading-6">
                              {externalReviewsText}
                            </pre>
                          ) : (
                            <div className="text-sm text-[var(--muted)]">
                              No external review text was returned for this run.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl bg-[var(--surface)] ring-1 ring-[var(--border)] shadow-[var(--shadow)]">
                      <div className="px-6 py-7 sm:px-8">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-[var(--text)]">Crawl snapshot</div>
                            <div className="mt-1 text-sm text-[var(--muted)]">Internal pages sampled for evidence.</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setExpandedCrawl((v) => !v)}
                            className="rounded-full border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--brand)] hover:text-[var(--brand-ink)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
                          >
                            {expandedCrawl ? "Collapse" : "Expand"}
                          </button>
                        </div>

                        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-4">
                          {crawlSnapshot ? (
                            <>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                                <span>
                                  Requested: <span className="font-medium text-[var(--text)]">{crawlSnapshot.pagesRequested}</span>
                                </span>
                                <span>
                                  Fetched: <span className="font-medium text-[var(--text)]">{crawlSnapshot.pagesFetched}</span>
                                </span>
                              </div>
                              {hasCrawlPages ? (
                                <div className="mt-3 space-y-2">
                                  {(expandedCrawl ? crawlPages : crawlPages.slice(0, 6)).map((p) => (
                                    <a
                                      key={p.url}
                                      href={p.finalUrl ?? p.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="block rounded-xl border border-[var(--border)] bg-[rgba(17,24,39,0.01)] px-3 py-2 hover:bg-[rgba(17,24,39,0.03)]"
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                          <div className="truncate text-sm font-medium text-[var(--text)]">{p.url}</div>
                                          <div className="mt-0.5 text-xs text-[var(--muted)] truncate">
                                            {p.contentType ?? "unknown content-type"}
                                          </div>
                                        </div>
                                        <div className="shrink-0 rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--muted)]">
                                          {p.httpStatus ?? "—"}
                                        </div>
                                      </div>
                                      {p.fetchNote ? (
                                        <div className="mt-1 text-xs text-[var(--muted)]">{p.fetchNote}</div>
                                      ) : null}
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <div className="mt-3 text-sm text-[var(--muted)]">No crawl data was returned for this run.</div>
                              )}
                            </>
                          ) : (
                            <div className="text-sm text-[var(--muted)]">No crawl data was returned for this run.</div>
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
                            {w}
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
                            <pre className="whitespace-pre-wrap text-xs leading-6 text-[var(--text)]">
                              {JSON.stringify(result, null, 2)}
                            </pre>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>

        <section
          id="disclaimer"
          className="mt-10 rounded-3xl border border-[var(--border)] bg-[rgba(17,24,39,0.02)] px-6 py-6 text-sm text-[var(--muted)]"
        >
          <div className="text-sm font-semibold text-[var(--text)]">Disclaimer</div>
          <p className="mt-2 leading-7">
            This analysis is automated and based on publicly available data. It does not make legal or
            factual claims about any website.{" "}
            <a
              href="/disclaimer"
              className="font-medium text-[var(--brand)] hover:text-[var(--brand-ink)] underline underline-offset-2"
            >
              Read full disclaimer
            </a>
          </p>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-5 pb-10">
        <div className="flex flex-col gap-1 text-xs text-[rgba(17,24,39,0.45)]">
          <span>Designed to help you think clearly, not to accuse.</span>
          <a
            href="https://trustcheck.agfe.tech"
            target="_blank"
            rel="noreferrer"
            className="w-fit text-[rgba(47,111,237,0.85)] hover:text-[rgba(47,111,237,1)]"
          >
            trustcheck.agfe.tech
          </a>
        </div>
      </footer>
    </div>
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
