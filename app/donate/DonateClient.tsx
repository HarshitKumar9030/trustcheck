"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

type DonateConfig = {
  cardUrl: string;
  cryptoUrl: string;
  upiId: string;
  upiName: string;
  cryptoAddresses: Record<string, string>;
};

// Inline SVG logos for performance (no network requests)
const CardLogo = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
  </svg>
);

const UpiLogo = ({ size = 32 }: { size?: number }) => (
  <div style={{ width: size, height: size }} className="relative">
    <Image src="/upi.png" alt="UPI" fill className="object-contain" unoptimized />
  </div>
);

const BtcLogo = () => (
  <svg viewBox="0 0 32 32" className="w-7 h-7">
    <circle cx="16" cy="16" r="16" fill="#F7931A" />
    <path fill="#fff" d="M22.5 14.1c.3-2-1.2-3.1-3.3-3.8l.7-2.7-1.7-.4-.7 2.6c-.4-.1-.9-.2-1.4-.3l.7-2.6-1.7-.4-.7 2.7c-.4-.1-.7-.2-1-.2v-.1l-2.3-.6-.4 1.8s1.3.3 1.2.3c.7.2.8.6.8 1l-.8 3.3c.1 0 .1 0 .2.1h-.2l-1.2 4.7c-.1.2-.3.6-.8.4 0 0-1.2-.3-1.2-.3l-.8 1.9 2.2.5c.4.1.8.2 1.2.3l-.7 2.8 1.7.4.7-2.7c.5.1.9.2 1.4.3l-.7 2.7 1.7.4.7-2.8c2.9.6 5.1.3 6-2.3.7-2.1-.1-3.3-1.5-4.1 1.1-.3 1.9-1 2.1-2.5zm-3.8 5.3c-.5 2.1-4 1-5.1.7l.9-3.7c1.2.3 4.7.9 4.2 3zm.5-5.4c-.5 1.9-3.4.9-4.3.7l.8-3.3c1 .2 4 .7 3.5 2.6z" />
  </svg>
);

const EthLogo = () => (
  <svg viewBox="0 0 32 32" className="w-7 h-7">
    <circle cx="16" cy="16" r="16" fill="#627EEA" />
    <path fill="#fff" fillOpacity=".6" d="M16.5 4v8.9l7.5 3.3z" />
    <path fill="#fff" d="M16.5 4L9 16.2l7.5-3.3z" />
    <path fill="#fff" fillOpacity=".6" d="M16.5 21.9v6.1L24 17.6z" />
    <path fill="#fff" d="M16.5 28V21.9L9 17.6z" />
    <path fill="#fff" fillOpacity=".2" d="M16.5 20.5l7.5-4.3-7.5-3.3z" />
    <path fill="#fff" fillOpacity=".6" d="M9 16.2l7.5 4.3v-7.6z" />
  </svg>
);

const SolLogo = () => (
  <svg viewBox="0 0 32 32" className="w-7 h-7">
    <defs>
      <linearGradient id="sol" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00FFA3" />
        <stop offset="100%" stopColor="#DC1FFF" />
      </linearGradient>
    </defs>
    <circle cx="16" cy="16" r="16" fill="url(#sol)" />
    <path fill="#fff" d="M10.5 18.7a.5.5 0 01.4-.2h11.9a.3.3 0 01.2.5l-2.4 2.4a.5.5 0 01-.4.2H8.3a.3.3 0 01-.2-.5l2.4-2.4zm0-8.1a.5.5 0 01.4-.2h11.9a.3.3 0 01.2.5l-2.4 2.4a.5.5 0 01-.4.2H8.3a.3.3 0 01-.2-.5l2.4-2.4zm10 4a.5.5 0 00-.4-.2H8.3a.3.3 0 00-.2.5l2.4 2.4a.5.5 0 00.4.2h11.9a.3.3 0 00.2-.5l-2.5-2.4z" />
  </svg>
);

const UsdtLogo = () => (
  <svg viewBox="0 0 32 32" className="w-7 h-7">
    <circle cx="16" cy="16" r="16" fill="#26A17B" />
    <path fill="#fff" d="M17.9 17.9v-.1c-.1 0-.7 0-1.9 0s-1.7 0-1.9 0v.1c-3.4.2-6 .8-6 1.5s2.6 1.3 6 1.5v4.8h3.8V21c3.4-.2 6-.8 6-1.5s-2.6-1.4-6-1.6zm0-1.6V15h5.3v-3.2H8.8V15h5.3v1.3c-3.9.2-6.8.9-6.8 1.8s3 1.6 6.8 1.8v5.9h3.8v-5.9c3.9-.2 6.8-.9 6.8-1.8s-2.9-1.6-6.8-1.8z" />
  </svg>
);

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
      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:bg-[rgba(17,24,39,0.02)] active:scale-95"
      aria-label={label ?? "Copy"}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-[var(--success)]" /> : <Copy className="h-3.5 w-3.5 text-[var(--muted)]" />}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

const cryptoLogos: Record<string, React.ReactNode> = {
  BTC: <BtcLogo />,
  ETH: <EthLogo />,
  SOL: <SolLogo />,
  USDT: <UsdtLogo />,
};

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
          width: 200,
          margin: 1,
          color: {
            dark: "#111827",
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
    <div className="space-y-8">
      {/* Method Selection */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setMethod("card")}
          disabled={!available.card}
          className={`group relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-200 ${method === "card"
            ? "border-[var(--brand)] bg-[rgba(47,111,237,0.04)] ring-2 ring-[var(--ring)]"
            : "border-[var(--border)] bg-white hover:border-[rgba(17,24,39,0.2)] hover:shadow-sm"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <div className={`transition-colors ${method === "card" ? "text-[var(--brand)]" : "text-[var(--muted)] group-hover:text-[var(--text)]"}`}>
            <CardLogo />
          </div>
          <span className={`text-sm font-medium ${method === "card" ? "text-[var(--brand)]" : "text-[var(--text)]"}`}>Card</span>
        </button>

        <button
          onClick={() => setMethod("upi")}
          disabled={!available.upi}
          className={`group relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-200 ${method === "upi"
            ? "border-[var(--brand)] bg-[rgba(47,111,237,0.04)] ring-2 ring-[var(--ring)]"
            : "border-[var(--border)] bg-white hover:border-[rgba(17,24,39,0.2)] hover:shadow-sm"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <UpiLogo />
          <span className={`text-sm font-medium ${method === "upi" ? "text-[var(--brand)]" : "text-[var(--text)]"}`}>UPI</span>
        </button>

        <button
          onClick={() => setMethod("crypto")}
          disabled={!available.crypto}
          className={`group relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-200 ${method === "crypto"
            ? "border-[var(--brand)] bg-[rgba(47,111,237,0.04)] ring-2 ring-[var(--ring)]"
            : "border-[var(--border)] bg-white hover:border-[rgba(17,24,39,0.2)] hover:shadow-sm"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <div className="flex -space-x-1">
            <div className="w-5 h-5"><BtcLogo /></div>
            <div className="w-5 h-5"><EthLogo /></div>
          </div>
          <span className={`text-sm font-medium ${method === "crypto" ? "text-[var(--brand)]" : "text-[var(--text)]"}`}>Crypto</span>
        </button>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={method}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl border border-[var(--border)] bg-white p-6"
        >
          {method === "card" && (
            <div className="text-center space-y-5">
              <div>
                <h3 className="text-base font-semibold text-[var(--text)]">Donate with Card</h3>
                <p className="text-sm text-[var(--muted)] mt-1">Secure checkout via Stripe</p>
              </div>
              {config.cardUrl ? (
                <a
                  href={config.cardUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--brand-ink)] hover:shadow-md active:scale-[0.98]"
                >
                  Continue to Payment
                  <ExternalLink className="w-4 h-4" />
                </a>
              ) : (
                <p className="text-sm text-[var(--muted)]">Payment link not configured</p>
              )}
            </div>
          )}

          {method === "upi" && (
            <div className="space-y-5">
              {config.upiId ? (
                <>
                  <div className="flex flex-col sm:flex-row gap-6 items-center">
                    {/* QR Code */}
                    <div className="shrink-0">
                      <div className="w-40 h-40 rounded-xl border border-[var(--border)] bg-white p-2 shadow-sm">
                        {upiQrDataUrl ? (
                          <img src={upiQrDataUrl} alt="UPI QR" className="w-full h-full" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-[var(--muted)]">Loading...</div>
                        )}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex-1 space-y-4 text-center sm:text-left">
                      <div className="flex items-center gap-3 justify-center sm:justify-start">
                        <UpiLogo />
                        <div>
                          <div className="text-sm font-semibold text-[var(--text)]">Pay via UPI</div>
                          <div className="text-xs text-[var(--muted)]">Scan QR or copy ID</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-3 rounded-xl bg-[rgba(17,24,39,0.02)] border border-[var(--border)]">
                        <code className="flex-1 text-sm font-mono text-[var(--text)] break-all">{config.upiId}</code>
                        <CopyButton value={config.upiId} label="Copy UPI ID" />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">Amount (optional)</label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₹</span>
                            <input
                              inputMode="decimal"
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                              placeholder="Enter amount"
                              className="w-full h-10 rounded-xl border border-[var(--border)] bg-white pl-7 pr-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--ring)]"
                            />
                          </div>
                          <a
                            href={upiUri}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand)] px-4 text-sm font-medium text-white transition hover:bg-[var(--brand-ink)]"
                          >
                            Open App
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-center text-sm text-[var(--muted)]">UPI not configured</p>
              )}
            </div>
          )}

          {method === "crypto" && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <h3 className="text-base font-semibold text-[var(--text)]">Crypto Addresses</h3>
                <p className="text-xs text-[var(--muted)] mt-0.5">Double-check the network before sending</p>
              </div>

              {cryptoRows.length > 0 ? (
                <div className="space-y-3">
                  {cryptoRows.map(([symbol, addr]) => (
                    <div key={symbol} className="flex items-center gap-3 p-3 rounded-xl bg-[rgba(17,24,39,0.02)] border border-[var(--border)]">
                      <div className="shrink-0">
                        {cryptoLogos[symbol] || <div className="w-7 h-7 rounded-full bg-gray-200" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-[var(--text)] mb-0.5">{symbol}</div>
                        <code className="text-xs text-[var(--muted)] break-all font-mono">{addr}</code>
                      </div>
                      <CopyButton value={addr} label={`Copy ${symbol} address`} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-[var(--muted)]">No addresses configured</p>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Footer */}
      <p className="text-center text-xs text-[var(--muted)]">
        Payments are processed securely. ScamCheck never stores payment details.
      </p>
    </div>
  );
}
