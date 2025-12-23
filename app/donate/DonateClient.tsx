"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, CreditCard, ExternalLink, QrCode, Wallet } from "lucide-react";

type DonateConfig = {
  cardUrl: string;
  cryptoUrl: string;
  upiId: string;
  upiName: string;
  cryptoAddresses: Record<string, string>;
};

function sanitizeUpiId(value: string) {
  return value.trim();
}

function buildUpiUri({
  upiId,
  upiName,
  amount,
}: {
  upiId: string;
  upiName: string;
  amount?: string;
}) {
  const pa = encodeURIComponent(sanitizeUpiId(upiId));
  const pn = encodeURIComponent(upiName.trim() || "TrustCheck");
  const tn = encodeURIComponent("Donation to TrustCheck");
  const cu = "INR";
  const am = amount && amount.trim() ? `&am=${encodeURIComponent(amount.trim())}` : "";
  return `upi://pay?pa=${pa}&pn=${pn}&tn=${tn}${am}&cu=${cu}`;
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        } catch {
          // ignore
        }
      }}
      className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--text)] shadow-sm transition hover:border-[rgba(47,111,237,0.30)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
      aria-label={label ?? "Copy"}
    >
      {copied ? <Check className="h-4 w-4 text-[rgba(34,197,94,1)]" /> : <Copy className="h-4 w-4" />}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

function ValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[var(--text)]">{label}</div>
        <div className="mt-1 break-all text-sm text-[var(--muted)]">{value}</div>
      </div>
      <div className="shrink-0">
        <CopyButton value={value} label={`Copy ${label}`} />
      </div>
    </div>
  );
}

export function DonateClient({ config }: { config: DonateConfig }) {
  type Method = "card" | "upi" | "crypto";

  const available = useMemo(() => {
    return {
      card: Boolean(config.cardUrl),
      upi: Boolean(config.upiId),
      crypto: Boolean(
        config.cryptoUrl ||
          Object.values(config.cryptoAddresses)
            .map((v) => v.trim())
            .some((v) => Boolean(v))
      ),
    };
  }, [config.cardUrl, config.cryptoUrl, config.cryptoAddresses, config.upiId]);

  const defaultMethod: Method = available.card ? "card" : available.upi ? "upi" : "crypto";
  const [method, setMethod] = useState<Method>(defaultMethod);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("donate_method") as Method | null;
      if (saved && (saved === "card" || saved === "upi" || saved === "crypto")) {
        if (available[saved]) setMethod(saved);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("donate_method", method);
    } catch {
      // ignore
    }
  }, [method]);

  const [amount, setAmount] = useState<string>("");

  const amountNormalized = useMemo(() => {
    const raw = amount.trim();
    if (!raw) return "";
    if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return "";
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return "";
    if (n > 1_000_000) return "";
    return raw;
  }, [amount]);

  const upiUri = useMemo(() => {
    if (!config.upiId) return "";
    return buildUpiUri({ upiId: config.upiId, upiName: config.upiName, amount: amountNormalized });
  }, [config.upiId, config.upiName, amountNormalized]);

  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!upiUri) {
        setUpiQrDataUrl("");
        return;
      }
      try {
        const mod = await import("qrcode");
        const QRCode = (mod as unknown as { default?: typeof import("qrcode") }).default ?? (mod as typeof import("qrcode"));
        const dataUrl = await QRCode.toDataURL(upiUri, {
          width: 220,
          margin: 0,
          color: {
            dark: "#0b1220",
            light: "#ffffff",
          },
        });
        if (!cancelled) setUpiQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) setUpiQrDataUrl("");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [upiUri]);

  const cryptoRows = Object.entries(config.cryptoAddresses)
    .map(([k, v]) => [k, v.trim()] as const)
    .filter(([, v]) => Boolean(v));

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-[var(--border)] bg-white p-2">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={!available.card}
            onClick={() => setMethod("card")}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 ${
              method === "card"
                ? "bg-[rgba(47,111,237,0.10)] text-[var(--brand)] ring-1 ring-[rgba(47,111,237,0.20)]"
                : "text-[var(--muted)] hover:bg-[rgba(17,24,39,0.03)]"
            }`}
          >
            <CreditCard className="h-4 w-4" />
            Card
          </button>
          <button
            type="button"
            disabled={!available.upi}
            onClick={() => setMethod("upi")}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 ${
              method === "upi"
                ? "bg-[rgba(47,111,237,0.10)] text-[var(--brand)] ring-1 ring-[rgba(47,111,237,0.20)]"
                : "text-[var(--muted)] hover:bg-[rgba(17,24,39,0.03)]"
            }`}
          >
            <QrCode className="h-4 w-4" />
            UPI
          </button>
          <button
            type="button"
            disabled={!available.crypto}
            onClick={() => setMethod("crypto")}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 ${
              method === "crypto"
                ? "bg-[rgba(47,111,237,0.10)] text-[var(--brand)] ring-1 ring-[rgba(47,111,237,0.20)]"
                : "text-[var(--muted)] hover:bg-[rgba(17,24,39,0.03)]"
            }`}
          >
            <Wallet className="h-4 w-4" />
            Crypto
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
        {method === "card" ? (
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Donate by card</div>
                <div className="mt-1 text-sm text-[var(--muted)]">Fastest option. Opens a secure checkout page.</div>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[rgba(47,111,237,0.10)] text-[var(--brand)]">
                <CreditCard className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-4">
              {config.cardUrl ? (
                <a
                  href={config.cardUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-ink)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
                >
                  Continue
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(17,24,39,0.02)] px-4 py-3 text-sm text-[var(--muted)]">
                  Not configured. Set <span className="font-medium">NEXT_PUBLIC_DONATE_CARD_URL</span>.
                </div>
              )}
            </div>
          </div>
        ) : null}

        {method === "upi" ? (
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Donate via UPI</div>
                <div className="mt-1 text-sm text-[var(--muted)]">Enter an amount and scan the QR.</div>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[rgba(47,111,237,0.10)] text-[var(--brand)]">
                <QrCode className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {config.upiId ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(17,24,39,0.02)] p-4">
                  <ValueRow label="UPI ID" value={config.upiId} />
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(17,24,39,0.02)] px-4 py-3 text-sm text-[var(--muted)]">
                  Not configured. Set <span className="font-medium">NEXT_PUBLIC_DONATE_UPI_ID</span>.
                </div>
              )}

              {config.upiId ? (
                <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text)]">Amount (optional)</div>
                      <div className="mt-1 text-sm text-[var(--muted)]">INR, up to 2 decimals</div>
                    </div>
                    <div className="w-full sm:w-[220px]">
                      <input
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="e.g. 199"
                        className="h-11 w-full rounded-2xl border border-[var(--border)] bg-white px-3 text-sm text-[var(--text)] shadow-sm outline-none placeholder:text-[rgba(17,24,39,0.45)] focus:border-[rgba(47,111,237,0.35)] focus:ring-4 focus:ring-[var(--ring)]"
                        aria-label="Donation amount in INR"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
                    <div className="grid h-[148px] w-full place-items-center rounded-3xl bg-white ring-1 ring-[rgba(17,24,39,0.10)] shadow-sm sm:h-[156px] sm:w-[156px]">
                      {upiQrDataUrl ? (
                        <img
                          src={upiQrDataUrl}
                          alt="UPI QR code"
                          className="h-[124px] w-[124px] rounded-2xl"
                        />
                      ) : (
                        <div className="text-xs text-[var(--muted)]">QR unavailable</div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={upiUri}
                          className="inline-flex items-center gap-2 rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-ink)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
                        >
                          Open UPI
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <CopyButton value={upiUri} label="Copy UPI payment URI" />
                      </div>
                      <div className="mt-3 text-sm leading-7 text-[var(--muted)]">
                        If your UPI app doesn’t open from the link, just scan the QR.
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {method === "crypto" ? (
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Donate with crypto</div>
                <div className="mt-1 text-sm text-[var(--muted)]">Copy an address (double-check network before sending).</div>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[rgba(47,111,237,0.10)] text-[var(--brand)]">
                <Wallet className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {config.cryptoUrl ? (
                <a
                  href={config.cryptoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[rgba(47,111,237,0.18)] bg-[rgba(47,111,237,0.08)] px-4 py-3 text-sm font-semibold text-[var(--brand)] transition hover:bg-[rgba(47,111,237,0.12)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
                >
                  Open crypto payment link
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}

              {cryptoRows.length ? (
                <div className="grid gap-3">
                  {cryptoRows.map(([symbol, addr]) => (
                    <div
                      key={symbol}
                      className="rounded-2xl border border-[var(--border)] bg-[rgba(17,24,39,0.02)] p-4"
                    >
                      <ValueRow label={symbol} value={addr} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(17,24,39,0.02)] px-4 py-3 text-sm text-[var(--muted)]">
                  Not configured. Add <span className="font-medium">NEXT_PUBLIC_DONATE_BTC</span> / <span className="font-medium">NEXT_PUBLIC_DONATE_ETH</span>.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[rgba(17,24,39,0.02)] px-4 py-3 text-sm text-[var(--muted)]">
        <div className="font-medium text-[var(--text)]">Transparency</div>
        <p className="mt-1 leading-7">
          Donations help cover hosting, crawling, and AI inference. Payments happen through your provider/app—TrustCheck
          never sees your card/UPI credentials.
        </p>
      </div>
    </div>
  );
}
