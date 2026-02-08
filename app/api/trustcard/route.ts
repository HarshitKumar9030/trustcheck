import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import React from "react";
import { checkIpRateLimit, rateLimitHeaders } from "@/lib/ipRateLimit";

export const runtime = "edge";

type TrustCardRequest = {
  url: string;
  score: number;
  status: string;
  analyzedAt: string;
  aiSummary?: string;
};

const APP_URL_DISPLAY = process.env.NEXT_PUBLIC_APP_URL_DISPLAY ?? "scamcheck.tech";
const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://scamcheck.tech";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function ellipsize(text: string, max: number): string {
  const t = (text ?? "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function scoreColor(score: number) {
  if (score >= 75) return "#059669";
  if (score >= 45) return "#d97706";
  return "#dc2626";
}

function scoreGradientStart(score: number) {
  if (score >= 75) return "#34d399";
  if (score >= 45) return "#fbbf24";
  return "#f87171";
}

function scoreGradientEnd(score: number) {
  if (score >= 75) return "#059669";
  if (score >= 45) return "#d97706";
  return "#dc2626";
}

function scoreBg(score: number) {
  if (score >= 75) return "#ecfdf5";
  if (score >= 45) return "#fffbeb";
  return "#fef2f2";
}

function scoreBgSubtle(score: number) {
  if (score >= 75) return "rgba(5, 150, 105, 0.06)";
  if (score >= 45) return "rgba(217, 119, 6, 0.06)";
  return "rgba(220, 38, 38, 0.06)";
}

function statusIcon(score: number): string {
  if (score >= 75) return "✓";
  if (score >= 45) return "⚠";
  return "✕";
}

export async function POST(req: Request) {
  const rl = checkIpRateLimit(req, { scope: "trustcard", capacity: 10, refillPerSecond: 0.5 });
  if (!rl.ok) {
    return new Response("Too many requests", {
      status: 429,
      headers: rateLimitHeaders(rl),
    });
  }

  const payload = (await req.json()) as TrustCardRequest;
  const url = payload.url;
  const score = clamp(Math.round(payload.score ?? 0), 0, 100);
  const status = payload.status ?? "";
  const analyzedAt = payload.analyzedAt ?? new Date().toISOString();
  const aiSummary = (payload.aiSummary ?? "").trim();

  const host = safeHostname(url);
  const reportUrl = `${APP_ORIGIN}/?url=${encodeURIComponent(url)}`;

  let qrDataUri = "";
  try {
    const svg = await QRCode.toString(reportUrl, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      color: { dark: "#111827", light: "#ffffff" },
    });
    qrDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  } catch {
    qrDataUri = "";
  }

  const accent = scoreColor(score);
  const gradStart = scoreGradientStart(score);
  const gradEnd = scoreGradientEnd(score);
  const badgeBg = scoreBg(score);
  const subtleBg = scoreBgSubtle(score);
  const icon = statusIcon(score);
  const dateStr = (() => {
    try {
      return new Date(analyzedAt).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return analyzedAt;
    }
  })();

  const h = React.createElement;

  return new ImageResponse(
    h(
      "div",
      {
        style: {
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        },
      },
      // Top accent gradient bar
      h("div", {
        style: {
          width: "100%",
          height: 6,
          background: `linear-gradient(90deg, ${gradStart}, ${gradEnd})`,
          display: "flex",
        },
      }),
      // Main content wrapper
      h(
        "div",
        {
          style: {
            flex: 1,
            padding: "32px 44px 28px",
            display: "flex",
            flexDirection: "column",
          },
        },
        // Header row
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
          // Brand
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 12 } },
            // Shield icon
            h(
              "div",
              {
                style: {
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  fontSize: 22,
                  fontWeight: 700,
                },
              },
              "🛡"
            ),
            h(
              "div",
              { style: { display: "flex", flexDirection: "column" } },
              h(
                "div",
                { style: { fontSize: 24, fontWeight: 800, color: "#111827", letterSpacing: -0.5, display: "flex" } },
                "ScamCheck"
              ),
              h(
                "div",
                { style: { fontSize: 12, color: "#9ca3af", fontWeight: 500, letterSpacing: 0.5, textTransform: "uppercase", display: "flex", marginTop: 1 } },
                "Trust Report"
              )
            )
          ),
          // Status badge
          h(
            "div",
            {
              style: {
                background: badgeBg,
                border: `1.5px solid ${accent}22`,
                borderRadius: 999,
                padding: "10px 22px",
                fontSize: 15,
                fontWeight: 700,
                color: accent,
                display: "flex",
                alignItems: "center",
                gap: 8,
              },
            },
            h("span", { style: { display: "flex", fontSize: 16 } }, icon),
            ellipsize(status, 36)
          )
        ),
        // Divider
        h("div", {
          style: { width: "100%", height: 1, background: "#f3f4f6", marginTop: 24, marginBottom: 28, display: "flex" },
        }),
        // Main content row
        h(
          "div",
          { style: { display: "flex", gap: 40, flex: 1 } },
          // Left column - Score
          h(
            "div",
            { style: { width: 280, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" } },
            // Score ring
            h(
              "div",
              {
                style: {
                  width: 220,
                  height: 220,
                  borderRadius: 999,
                  background: `linear-gradient(135deg, ${gradStart}33, ${gradEnd}33)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 12,
                },
              },
              h(
                "div",
                {
                  style: {
                    width: 196,
                    height: 196,
                    borderRadius: 999,
                    background: "#ffffff",
                    border: `3px solid ${accent}`,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: `0 0 0 8px ${subtleBg}`,
                  },
                },
                h(
                  "div",
                  { style: { fontSize: 72, fontWeight: 900, color: accent, lineHeight: 1, display: "flex", letterSpacing: -2 } },
                  String(score)
                ),
                h(
                  "div",
                  { style: { fontSize: 13, color: "#6b7280", marginTop: 6, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", display: "flex" } },
                  "Trust Score"
                )
              )
            ),
            // Score label
            h(
              "div",
              { style: { marginTop: 16, fontSize: 12, color: "#9ca3af", fontWeight: 500, display: "flex" } },
              "out of 100"
            )
          ),
          // Right column - Info + Summary
          h(
            "div",
            { style: { flex: 1, display: "flex", flexDirection: "column" } },
            // Domain info
            h(
              "div",
              { style: { display: "flex", flexDirection: "column" } },
              h(
                "div",
                { style: { fontSize: 28, fontWeight: 800, color: "#111827", display: "flex", letterSpacing: -0.5 } },
                ellipsize(host, 28)
              ),
              h(
                "div",
                { style: { fontSize: 14, color: "#9ca3af", marginTop: 6, display: "flex" } },
                ellipsize(url, 60)
              )
            ),
            // Summary box
            h(
              "div",
              {
                style: {
                  marginTop: 20,
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: 16,
                  padding: "18px 22px",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                },
              },
              h(
                "div",
                { style: { fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", display: "flex" } },
                "AI Summary"
              ),
              h(
                "div",
                {
                  style: {
                    fontSize: 16,
                    color: "#374151",
                    marginTop: 10,
                    lineHeight: 1.55,
                    display: "flex",
                  },
                },
                aiSummary ? ellipsize(aiSummary, 240) : "No summary available for this analysis."
              )
            ),
            // Bottom row: QR + date
            h(
              "div",
              { style: { marginTop: 18, display: "flex", alignItems: "center", gap: 16 } },
              // QR code
              h(
                "div",
                {
                  style: {
                    width: 80,
                    height: 80,
                    borderRadius: 12,
                    background: "#ffffff",
                    border: "1px solid #e5e7eb",
                    padding: 5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  },
                },
                qrDataUri
                  ? h("img", { src: qrDataUri, width: 70, height: 70, style: { display: "flex" } })
                  : h("div", { style: { fontSize: 10, color: "#9ca3af", display: "flex" } }, "QR error")
              ),
              // Date and scan info
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 3 } },
                h("div", { style: { fontSize: 13, fontWeight: 600, color: "#374151", display: "flex" } }, "Scan to view full report"),
                h("div", { style: { fontSize: 12, color: "#9ca3af", display: "flex" } }, dateStr)
              )
            )
          )
        ),
        // Footer
        h(
          "div",
          {
            style: {
              marginTop: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: 14,
              borderTop: "1px solid #f3f4f6",
            },
          },
          h("div", { style: { fontSize: 11, color: "#b0b7c3", display: "flex" } }, "Automated analysis — Not legal or financial advice."),
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 6 } },
            h("div", { style: { fontSize: 13, fontWeight: 700, color: "#2563eb", display: "flex" } }, APP_URL_DISPLAY)
          )
        )
      )
    ),
    { width: 1200, height: 630 }
  );
}
