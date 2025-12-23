"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { loadScanHistory, saveScanHistory, type ScanRecord } from "../lib/scanHistory";

export default function FlaggedPage() {
  const [scanHistory, setScanHistory] = useState<ScanRecord[]>([]);

  useEffect(() => {
    setScanHistory(loadScanHistory());
  }, []);

  const flaggedSites = useMemo(() => scanHistory.filter((r) => r.flagged), [scanHistory]);

  function removeHistoryItem(id: string) {
    setScanHistory((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveScanHistory(next);
      return next;
    });
  }

  function clearFlagged() {
    setScanHistory((prev) => {
      const next = prev.filter((p) => !p.flagged);
      saveScanHistory(next);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="mx-auto max-w-5xl px-5 py-6">
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
              <div className="text-xs text-[var(--muted)]">Flagged sites</div>
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
        <section className="pt-6 sm:pt-10">
          <div className="rounded-3xl bg-[var(--surface)] ring-1 ring-[var(--border)] shadow-[var(--shadow)]">
            <div className="px-6 py-7 sm:px-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">Flagged / Deceptive sites</h1>
                  <p className="mt-1 text-sm text-[var(--muted)]">Sites that scored low or were judged suspicious.</p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="/"
                    className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(17,24,39,0.03)]"
                  >
                    Back to analyzer
                  </a>
                  <button
                    type="button"
                    onClick={() => clearFlagged()}
                    className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)]"
                    disabled={flaggedSites.length === 0}
                  >
                    Clear flagged
                  </button>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-[var(--border)] bg-white">
                {flaggedSites.length > 0 ? (
                  <ul className="divide-y divide-[var(--border)]">
                    {flaggedSites.map((r) => (
                      <li key={r.id} className="px-4 py-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-[var(--text)] truncate">{r.hostname}</div>
                            <div className="mt-0.5 text-xs text-[var(--muted)] truncate">{new Date(r.analyzedAt).toLocaleString()}</div>
                            <div className="mt-2 text-xs text-[var(--muted)]">
                              Score <span className="font-medium text-[var(--text)]">{r.score}</span> • {r.status}
                              {r.aiVerdict ? (
                                <span>
                                  {" "}
                                  • AI: <span className="font-medium text-[var(--text)]">{String(r.aiVerdict).replace(/_/g, " ")}</span>
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="shrink-0 flex flex-wrap items-center gap-2">
                            <a
                              href={`/?url=${encodeURIComponent(r.url)}`}
                              className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(17,24,39,0.03)]"
                            >
                              Re-check
                            </a>
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--brand)] hover:text-[var(--brand-ink)]"
                            >
                              Open
                            </a>
                            <button
                              type="button"
                              onClick={() => removeHistoryItem(r.id)}
                              className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)]"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-4 py-4 text-sm text-[var(--muted)]">No flagged sites yet.</div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
