import Image from "next/image";
import Link from "next/link";
import { getMongoDb } from "../../lib/mongo";
import { queryFlaggedSites, type FlaggedSiteRecord } from "../../lib/flaggedSites";

function formatWhen(ms: number): string {
  try {
    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString();
  }
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "danger" | "warn" | "neutral" }) {
  const styles =
    tone === "danger"
      ? "border-[rgba(194,65,68,0.18)] bg-[rgba(194,65,68,0.06)] text-[rgba(194,65,68,1)]"
      : tone === "warn"
        ? "border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.08)] text-[rgba(180,83,9,1)]"
        : "border-[var(--border)] bg-[rgba(17,24,39,0.02)] text-[var(--muted)]";
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles}`}>{children}</span>
  );
}

function WhatWasFound({ r }: { r: FlaggedSiteRecord }) {
  const items: Array<{ label: string; detail: string }> = [];
  for (const f of r.findings ?? []) {
    items.push({ label: f.label, detail: f.detail });
    if (items.length >= 4) break;
  }
  if (items.length === 0 && (r.issues?.length ?? 0) > 0) {
    for (const issue of r.issues.slice(0, 4)) {
      items.push({ label: "AI signal", detail: issue });
    }
  }

  if (items.length === 0) {
    return <div className="text-xs text-[var(--muted)]">Limited details available.</div>;
  }

  return (
    <ul className="space-y-1">
      {items.map((it, idx) => (
        <li key={`${it.label}-${idx}`} className="text-xs text-[var(--muted)]">
          <span className="font-medium text-[var(--text)]">{it.label}:</span> {it.detail}
        </li>
      ))}
    </ul>
  );
}

export default async function FlaggedPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const qRaw = sp.q;
  const q = Array.isArray(qRaw) ? qRaw[0] : (qRaw ?? "");

  const db = await getMongoDb();
  const mongoReady = Boolean(db);
  const flagged = mongoReady ? await queryFlaggedSites({ q, limit: 60 }) : [];

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="mx-auto max-w-5xl px-5 py-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
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
          </Link>

          <div className="flex items-center gap-1">
            <Link
              href="/flagged"
              aria-current="page"
              className="rounded-full bg-[rgba(194,65,68,0.08)] px-3 py-2 text-sm font-medium text-[rgba(194,65,68,1)] ring-1 ring-[rgba(194,65,68,0.18)]"
            >
              Flagged
            </Link>
            <Link
              href="/donate"
              className="rounded-full px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
            >
              Donate
            </Link>
            <Link
              href="/disclaimer"
              className="rounded-full px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
            >
              Disclaimer
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-16">
        <section className="pt-6 sm:pt-10">
          <div className="rounded-3xl bg-[var(--surface)] ring-1 ring-[var(--border)] shadow-[var(--shadow)]">
            <div className="px-6 py-7 sm:px-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
                    Flagged sites
                  </h1>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Public list of websites that scored low or had strong risk indicators.
                  </p>
                </div>


              </div>

              <form className="mt-5" action="/flagged" method="get">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <label className="sr-only" htmlFor="q">
                      Search
                    </label>
                    <input
                      id="q"
                      name="q"
                      defaultValue={q}
                      placeholder="Search domain or URL…"
                      className="h-11 w-full rounded-2xl border border-[var(--border)] bg-white px-4 text-sm text-[var(--text)] shadow-sm outline-none placeholder:text-[rgba(17,24,39,0.35)] focus:ring-4 focus:ring-[var(--ring)]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="h-11 rounded-2xl bg-[var(--brand)] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-ink)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
                  >
                    Search
                  </button>
                </div>
                <div className="mt-2 text-xs text-[var(--muted)]">
                  {mongoReady ? (
                    <span>
                      Showing {flagged.length}
                      {q.trim() ? " matching results" : " latest results"}.
                    </span>
                  ) : (
                    <span>
                      MongoDB is not configured. Set <span className="font-medium">MONGODB_URI</span> (and optionally <span className="font-medium">MONGODB_DB</span>) to enable the public flagged list.
                    </span>
                  )}
                </div>
              </form>

              <div className="mt-5 rounded-2xl border border-[var(--border)] bg-white">
                {mongoReady ? (
                  flagged.length > 0 ? (
                    <ul className="divide-y divide-[var(--border)]">
                      {flagged.map((r) => (
                        <li key={r.hostname} className="px-4 py-4">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-sm font-semibold text-[var(--text)] truncate">{r.hostname}</div>
                                <Badge tone={r.score < 45 ? "danger" : "warn"}>Score {r.score}</Badge>
                                <Badge tone={r.status === "High Risk Indicators Detected" ? "danger" : "warn"}>
                                  {r.status}
                                </Badge>
                                {r.aiVerdict ? (
                                  <Badge tone={r.aiVerdict === "likely_deceptive" || r.aiVerdict === "suspicious" ? "danger" : "warn"}>
                                    AI: {String(r.aiVerdict).replace(/_/g, " ")}
                                  </Badge>
                                ) : null}
                                {r.aiConfidence ? (
                                  <Badge tone={r.aiConfidence === "low" ? "warn" : "neutral"}>
                                    Confidence: {r.aiConfidence}
                                  </Badge>
                                ) : null}
                              </div>

                              <div className="mt-1 text-xs text-[var(--muted)]">
                                Last seen: <span className="font-medium text-[var(--text)]">{formatWhen(r.lastObservedAtMs)}</span> • Observed {r.timesObserved} time{r.timesObserved === 1 ? "" : "s"}
                              </div>

                              {r.summary ? (
                                <div className="mt-3 text-sm text-[var(--text)]">{r.summary}</div>
                              ) : null}

                              <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[rgba(17,24,39,0.02)] p-3">
                                <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                                  What we found
                                </div>
                                <div className="mt-2">
                                  <WhatWasFound r={r} />
                                </div>
                              </div>

                              <details className="mt-3">
                                <summary className="cursor-pointer select-none text-xs font-semibold text-[var(--brand)] hover:text-[var(--brand-ink)]">
                                  Evidence
                                </summary>
                                <div className="mt-2 rounded-2xl border border-[var(--border)] bg-white p-3 text-xs text-[var(--muted)]">
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <div>
                                      <span className="font-medium text-[var(--text)]">Domain age:</span>{" "}
                                      {typeof r.evidence?.domainAgeDays === "number" ? `${r.evidence.domainAgeDays} days` : "Unknown"}
                                    </div>
                                    <div>
                                      <span className="font-medium text-[var(--text)]">TLS:</span>{" "}
                                      {r.evidence?.tlsSupported ? "Supported" : "Unknown / not detected"}
                                    </div>
                                    <div className="sm:col-span-2">
                                      <span className="font-medium text-[var(--text)]">Redirects:</span>{" "}
                                      {(r.evidence?.redirectChain?.length ?? 0) > 0
                                        ? r.evidence.redirectChain!.slice(0, 4).join(" → ")
                                        : "None / unknown"}
                                    </div>
                                    <div>
                                      <span className="font-medium text-[var(--text)]">Pages fetched:</span>{" "}
                                      {typeof r.evidence?.pagesFetched === "number" ? r.evidence.pagesFetched : "Unknown"}
                                    </div>
                                    <div>
                                      <span className="font-medium text-[var(--text)]">Warnings:</span>{" "}
                                      {r.evidence?.warnings?.length ? r.evidence.warnings.slice(0, 2).join(" • ") : "None"}
                                    </div>
                                  </div>
                                </div>
                              </details>
                            </div>

                            <div className="shrink-0 flex flex-wrap items-center gap-2">
                              <Link
                                href={`/?url=${encodeURIComponent(r.normalizedUrl)}`}
                                className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(17,24,39,0.03)]"
                              >
                                Re-check
                              </Link>
                              <a
                                href={r.normalizedUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--brand)] hover:text-[var(--brand-ink)]"
                              >
                                Open
                              </a>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="px-4 py-5 text-sm text-[var(--muted)]">
                      {q.trim()
                        ? "No matches found. Try a different keyword."
                        : "No flagged sites yet — analyze a few websites and anything with strong risk indicators will appear here."}
                    </div>
                  )
                ) : (
                  <div className="px-4 py-5 text-sm text-[var(--muted)]">
                    MongoDB is not configured yet, so there’s nothing to show here.
                  </div>
                )}
              </div>
            </div>
          </div>
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
