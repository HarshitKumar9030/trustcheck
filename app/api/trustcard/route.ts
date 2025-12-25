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

function scoreBg(score: number) {
  if (score >= 75) return "#ecfdf5";
  if (score >= 45) return "#fffbeb";
  return "#fef2f2";
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
  const badgeBg = scoreBg(score);
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
          background: "#f9fafb",
          padding: 28,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        },
      },
      h(
        "div",
        {
          style: {
            width: "100%",
            height: "100%",
            background: "#ffffff",
            borderRadius: 24,
            border: "1px solid #e5e7eb",
            padding: 36,
            display: "flex",
            flexDirection: "column",
          },
        },
        // Header
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 14 } },
            h("div", {
              style: {
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "#2563eb",
                display: "flex",
              },
            }),
            h(
              "div",
              { style: { fontSize: 26, fontWeight: 700, color: "#111827", letterSpacing: -0.3, display: "flex" } },
              "ScamCheck"
            )
          ),
          h(
            "div",
            {
              style: {
                background: badgeBg,
                color: accent,
                borderRadius: 999,
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: 600,
                display: "flex",
              },
            },
            ellipsize(status, 36)
          )
        ),
        // Main content
        h(
          "div",
          { style: { marginTop: 28, display: "flex", gap: 36, flex: 1 } },
          // Left - Domain and Score
          h(
            "div",
            { style: { width: 320, display: "flex", flexDirection: "column" } },
            h(
              "div",
              { style: { fontSize: 28, fontWeight: 700, color: "#111827", display: "flex" } },
              ellipsize(host, 22)
            ),
            h(
              "div",
              { style: { fontSize: 13, color: "#6b7280", marginTop: 4, display: "flex" } },
              ellipsize(url, 50)
            ),
            // Score circle
            h(
              "div",
              {
                style: {
                  marginTop: 24,
                  width: 200,
                  height: 200,
                  borderRadius: 999,
                  background: badgeBg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                },
              },
              h(
                "div",
                {
                  style: {
                    width: 164,
                    height: 164,
                    borderRadius: 999,
                    background: "#ffffff",
                    border: "1px solid #e5e7eb",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  },
                },
                h(
                  "div",
                  { style: { fontSize: 64, fontWeight: 800, color: accent, lineHeight: 1, display: "flex" } },
                  String(score)
                ),
                h(
                  "div",
                  { style: { fontSize: 13, color: "#6b7280", marginTop: 4, fontWeight: 500, display: "flex" } },
                  "Trust Score"
                )
              )
            )
          ),
          // Right - Summary and QR
          h(
            "div",
            { style: { flex: 1, display: "flex", flexDirection: "column" } },
            // Summary box
            h(
              "div",
              {
                style: {
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: 16,
                  padding: 20,
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                },
              },
              h(
                "div",
                { style: { fontSize: 11, color: "#6b7280", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", display: "flex" } },
                "Summary"
              ),
              h(
                "div",
                {
                  style: {
                    fontSize: 16,
                    color: "#374151",
                    marginTop: 10,
                    lineHeight: 1.5,
                    display: "flex",
                  },
                },
                aiSummary ? ellipsize(aiSummary, 260) : "No summary available."
              )
            ),
            // QR and date
            h(
              "div",
              { style: { marginTop: 16, display: "flex", alignItems: "center", gap: 16 } },
              h(
                "div",
                {
                  style: {
                    width: 88,
                    height: 88,
                    borderRadius: 12,
                    background: "#ffffff",
                    border: "1px solid #e5e7eb",
                    padding: 6,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  },
                },
                qrDataUri
                  ? h("img", { src: qrDataUri, width: 76, height: 76, style: { display: "flex" } })
                  : h("div", { style: { fontSize: 10, color: "#9ca3af", display: "flex" } }, "QR error")
              ),
              h(
                "div",
                { style: { display: "flex", flexDirection: "column" } },
                h("div", { style: { fontSize: 13, fontWeight: 500, color: "#374151", display: "flex" } }, "Scan for report"),
                h("div", { style: { fontSize: 12, color: "#9ca3af", marginTop: 2, display: "flex" } }, dateStr)
              )
            )
          )
        ),
        // Footer
        h(
          "div",
          {
            style: {
              marginTop: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: 12,
              borderTop: "1px solid #f3f4f6",
            },
          },
          h("div", { style: { fontSize: 11, color: "#9ca3af", display: "flex" } }, "Automated analysis. Not legal advice."),
          h("div", { style: { fontSize: 13, fontWeight: 600, color: "#2563eb", display: "flex" } }, APP_URL_DISPLAY)
        )
      )
    ),
    { width: 1200, height: 630 }
  );
}
