"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import {
    Shield, Search, Clock,
    ShieldAlert, Activity, Zap, ArrowUpRight,
    Globe, ChevronDown, ChevronUp, ExternalLink, Minus
} from "lucide-react";

// Define type inline to avoid importing from server module
export type FlaggedSiteRecord = {
    hostname: string;
    normalizedUrl: string;
    firstObservedAtMs: number;
    lastObservedAtMs: number;
    lastAnalysisAtMs: number;
    score: number;
    status: string;
    aiVerdict?: "legitimate" | "caution" | "suspicious" | "likely_deceptive" | null;
    aiConfidence?: "high" | "medium" | "low" | null;
    summary?: string | null;
    issues: string[];
    findings: Array<{ label: string; verdict: string; detail: string }>;
    evidence: Record<string, unknown>;
    timesObserved: number;
    fullReport?: unknown;
};

function formatWhen(ms: number): string {
    try {
        const date = new Date(ms);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        if (diff < 24 * 60 * 60 * 1000) {
            if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
            return `${Math.floor(diff / 3600000)}h ago`;
        }
        return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
    } catch { return "--"; }
}

function RiskBadge({ level }: { level: "high" | "medium" | "low" }) {
    const styles = {
        high: "bg-red-50 text-red-600 border-red-200",
        medium: "bg-amber-50 text-amber-600 border-amber-200",
        low: "bg-gray-50 text-gray-600 border-gray-200",
    };
    const labels = { high: "Critical", medium: "Warning", low: "Notice" };
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider border ${styles[level]}`}>
            {labels[level]}
        </span>
    );
}

function getRiskLevel(r: FlaggedSiteRecord): "high" | "medium" | "low" {
    if (r.score < 30 || r.aiVerdict === "likely_deceptive") return "high";
    if (r.score < 50 || r.aiVerdict === "suspicious") return "medium";
    return "low";
}

function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
    const radius = (size - 8) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = (score / 100) * circumference;
    const color = score < 30 ? "#c24144" : score < 50 ? "#b7791f" : score < 70 ? "#6b7280" : "#1f7a4a";

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(17,24,39,0.06)"
                    strokeWidth={4}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={4}
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - progress}
                    strokeLinecap="round"
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-gray-900">{score}</span>
            </div>
        </div>
    );
}

function ThreatCard({ r, index }: { r: FlaggedSiteRecord; index: number }) {
    const [expanded, setExpanded] = useState(false);
    const riskLevel = getRiskLevel(r);

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.4 }}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden hover:border-[rgba(17,24,39,0.15)] transition-colors"
        >
            {/* Card Header */}
            <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                        <ScoreRing score={r.score} />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h3 className="font-semibold text-gray-900 text-base truncate">{r.hostname}</h3>
                                <RiskBadge level={riskLevel} />
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs text-gray-500">
                                <span className="flex items-center gap-1 shrink-0">
                                    <Clock className="w-3 h-3 shrink-0" />
                                    {formatWhen(r.lastObservedAtMs)}
                                </span>
                                {r.aiVerdict && (
                                    <span className="flex items-center gap-1 shrink-0">
                                        <Zap className="w-3 h-3 text-gray-400 shrink-0" />
                                        <span className="capitalize truncate max-w-[100px] sm:max-w-none">{r.aiVerdict.replace(/_/g, " ")}</span>
                                    </span>
                                )}
                                <span className="hidden sm:flex items-center gap-1 text-gray-400 shrink-0">
                                    <Globe className="w-3 h-3 shrink-0" />
                                    ScamCheck DB
                                </span>
                            </div>
                        </div>
                    </div>
                    <Link
                        href={`/?url=${encodeURIComponent(r.normalizedUrl)}`}
                        className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
                    >
                        View Report <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                </div>

                {/* Summary */}
                {r.summary && (
                    <div className="mt-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">AI Summary</div>
                        <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">{r.summary}</p>
                    </div>
                )}

                {/* Issues Preview */}
                {r.issues.length > 0 && (
                    <div className="mt-4">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Top Issues</div>
                        <div className="space-y-1.5">
                            {r.issues.slice(0, 3).map((issue, i) => (
                                <div key={i} className="flex items-start gap-2 text-sm text-[var(--muted)]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--danger)] mt-1.5 shrink-0" />
                                    <span className="line-clamp-1">{issue}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Expandable Details */}
            {(r.findings.length > 0 || r.issues.length > 3) && (
                <>
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="w-full px-5 py-3 flex items-center justify-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-t border-gray-100 transition-colors"
                    >
                        {expanded ? (
                            <>Hide Details <ChevronUp className="w-4 h-4" /></>
                        ) : (
                            <>Show All Details <ChevronDown className="w-4 h-4" /></>
                        )}
                    </button>

                    <AnimatePresence>
                        {expanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden border-t border-gray-100"
                            >
                                <div className="p-5 bg-gray-50/50 space-y-4">
                                    {/* All Issues */}
                                    {r.issues.length > 3 && (
                                        <div>
                                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">All Issues ({r.issues.length})</div>
                                            <div className="space-y-1.5">
                                                {r.issues.map((issue, i) => (
                                                    <div key={i} className="flex items-start gap-2 text-sm text-[var(--muted)]">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--danger)] mt-1.5 shrink-0" />
                                                        <span>{issue}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Findings */}
                                    {r.findings.length > 0 && (
                                        <div>
                                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Findings</div>
                                            <div className="grid gap-2">
                                                {r.findings.map((f, i) => (
                                                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white border border-gray-200">
                                                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${f.verdict === "bad" ? "bg-red-500" : "bg-amber-500"}`} />
                                                        <div>
                                                            <div className="text-sm font-medium text-gray-900">{f.label}</div>
                                                            <div className="text-xs text-gray-500 mt-0.5">{f.detail}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Evidence */}
                                    {Object.keys(r.evidence).length > 0 && (
                                        <div>
                                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Evidence</div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                {r.evidence.domainAgeDays !== undefined && r.evidence.domainAgeDays !== null && (
                                                    <div className="p-2 rounded-lg bg-white border border-gray-200">
                                                        <span className="text-gray-500">Domain Age:</span>{" "}
                                                        <span className="text-gray-900 font-medium">{r.evidence.domainAgeDays as number} days</span>
                                                    </div>
                                                )}
                                                {r.evidence.tlsSupported !== undefined && (
                                                    <div className="p-2 rounded-lg bg-white border border-gray-200">
                                                        <span className="text-gray-500">TLS:</span>{" "}
                                                        <span className="text-gray-900 font-medium">{r.evidence.tlsSupported ? "Supported" : "Not Supported"}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}
        </motion.div>
    );
}

export function FlaggedClient({
    flagged,
    q,
    mongoReady,
    page,
    totalPages,
    total,
}: {
    flagged: FlaggedSiteRecord[];
    q: string;
    mongoReady: boolean;
    page: number;
    totalPages: number;
    total: number;
}) {
    const highRiskCount = flagged.filter(r => getRiskLevel(r) === "high").length;

    return (
        <div className="min-h-screen bg-[var(--bg)]">
            <div className="mx-auto max-w-5xl px-5 py-12">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="mb-10"
                >
                    <div className="flex items-center gap-2 mb-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)]">
                            <Shield className="w-3.5 h-3.5" />
                        </span>
                        <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">ScamCheck Database</span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-[var(--text)] mb-3">
                        Flagged Threats
                    </h1>
                    <p className="text-[var(--muted)] max-w-xl">
                        Cached analysis reports for sites detected as potentially malicious.
                    </p>
                </motion.div>

                {/* Stats Row */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8"
                >
                    <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-5">
                        <div className="text-3xl font-bold text-[var(--text)]">{flagged.length}</div>
                        <div className="text-sm text-[var(--muted)] mt-1">Total Flagged</div>
                    </div>
                    <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-5">
                        <div className="text-3xl font-bold text-red-600 flex items-center gap-2">
                            {highRiskCount}
                            {highRiskCount > 0 && (
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                </span>
                            )}
                        </div>
                        <div className="text-sm text-[var(--muted)] mt-1">Critical Threats</div>
                    </div>
                    <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-5 hidden sm:block">
                        <div className="text-3xl font-bold text-[var(--text)]">{flagged.reduce((sum, r) => sum + (r.timesObserved || 1), 0)}</div>
                        <div className="text-sm text-[var(--muted)] mt-1">Total Observations</div>
                    </div>
                </motion.div>

                {/* Search & Status */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, duration: 0.4 }}
                    className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-8"
                >
                    <form action="/flagged" method="get" className="relative w-full sm:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                        <input
                            name="q"
                            defaultValue={q}
                            placeholder="Search by hostname..."
                            className="w-full h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] pl-11 pr-4 text-sm text-[var(--text)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--ring)] transition-all"
                            autoComplete="off"
                        />
                    </form>

                    <div className="flex items-center gap-3">
                        {!mongoReady && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-medium text-amber-700">
                                <Activity className="w-3.5 h-3.5" />
                                Session Only
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 text-xs font-mono text-[var(--muted)]">
                            <Globe className="w-3.5 h-3.5" />
                            {mongoReady ? "PERSISTENT" : "EPHEMERAL"}
                        </div>
                    </div>
                </motion.div>

                {/* Threat Cards Grid */}
                {flagged.length > 0 ? (
                    <div className="grid gap-6">
                        {flagged.map((r, index) => (
                            <ThreatCard key={r.hostname} r={r} index={index} />
                        ))}
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm p-12 text-center"
                    >
                        <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-5">
                            <Shield className="w-7 h-7 text-gray-300" />
                        </div>
                        <p className="text-lg font-semibold text-[var(--text)]">No flagged sites</p>
                        <p className="text-sm text-[var(--muted)] mt-2 max-w-sm mx-auto">
                            {q ? "No matches found. Try a different search." : "Analyze suspicious websites to populate this database."}
                        </p>
                        <Link
                            href="/"
                            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--brand)] text-white text-sm font-semibold hover:bg-[var(--brand-ink)] transition-colors"
                        >
                            Analyze Website <ArrowUpRight className="w-4 h-4" />
                        </Link>
                    </motion.div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="mt-8 flex items-center justify-center gap-2"
                    >
                        <Link
                            href={`/flagged?${new URLSearchParams({ ...(q ? { q } : {}), page: String(Math.max(1, page - 1)) }).toString()}`}
                            className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${page <= 1
                                ? "border-[var(--border)] text-[var(--muted)] cursor-not-allowed pointer-events-none opacity-50"
                                : "border-[var(--border)] text-[var(--text)] hover:bg-[rgba(17,24,39,0.03)]"
                                }`}
                        >
                            Previous
                        </Link>

                        <div className="flex items-center gap-1 px-4 py-2 text-sm text-[var(--muted)]">
                            <span className="font-medium text-[var(--text)]">{page}</span>
                            <span>of</span>
                            <span className="font-medium text-[var(--text)]">{totalPages}</span>
                            <span className="ml-2 text-xs">({total} total)</span>
                        </div>

                        <Link
                            href={`/flagged?${new URLSearchParams({ ...(q ? { q } : {}), page: String(Math.min(totalPages, page + 1)) }).toString()}`}
                            className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${page >= totalPages
                                ? "border-[var(--border)] text-[var(--muted)] cursor-not-allowed pointer-events-none opacity-50"
                                : "border-[var(--border)] text-[var(--text)] hover:bg-[rgba(17,24,39,0.03)]"
                                }`}
                        >
                            Next
                        </Link>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
