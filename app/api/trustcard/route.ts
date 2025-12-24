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

const APP_URL_DISPLAY = process.env.NEXT_PUBLIC_APP_URL_DISPLAY ?? "trustcheck.agfe.tech";
const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://trustcheck.agfe.tech";

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
  if (score >= 75) return "#1f7a4a";
  if (score >= 45) return "#b7791f";
  return "#c24144";
}

function scoreBg(score: number) {
  if (score >= 75) return "#dcfce7";
  if (score >= 45) return "#fef3c7";
  return "#fee2e2";
}

export async function POST(req: Request) {
  // Trust cards can be spammed (image generation). Generous throttle.
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
        month: "long",
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
          background: "linear-gradient(135deg, #fbfbff 0%, #f3f6ff 100%)",
          padding: 40,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
        },
      },
      h(
        "div",
        {
          style: {
            width: "100%",
            height: "100%",
            background: "#fff",
            borderRadius: 32,
            border: "1px solid rgba(17,24,39,0.08)",
            boxShadow: "0 18px 50px rgba(17,24,39,0.10)",
            padding: 40,
            display: "flex",
            flexDirection: "column",
          },
        },
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 14 } },
            h("div", {
              style: {
                width: 48,
                height: 48,
                borderRadius: 14,
                background: "#2f6fed",
                boxShadow: "0 10px 25px rgba(47,111,237,0.18)",
              },
            }),
            h(
              "div",
              { style: { display: "flex", flexDirection: "column" } },
              h(
                "div",
                { style: { fontSize: 26, fontWeight: 800, color: "#111827", lineHeight: 1.1 } },
                "TrustCheck"
              ),
              h(
                "div",
                { style: { fontSize: 14, color: "#6b7280", marginTop: 2 } },
                "AI-Powered Trust Analysis"
              )
            )
          ),
          h(
            "div",
            {
              style: {
                background: badgeBg,
                color: accent,
                borderRadius: 999,
                padding: "10px 16px",
                fontSize: 16,
                fontWeight: 800,
                maxWidth: 520,
              },
            },
            ellipsize(status, 44)
          )
        ),
        h(
          "div",
          { style: { marginTop: 34, display: "flex", gap: 34, flex: 1 } },
          h(
            "div",
            { style: { width: 320, display: "flex", flexDirection: "column" } },
            h(
              "div",
              { style: { fontSize: 30, fontWeight: 800, color: "#111827" } },
              host
            ),
            h(
              "div",
              { style: { fontSize: 16, color: "#6b7280", marginTop: 6 } },
              ellipsize(url, 70)
            ),
            h(
              "div",
              {
                style: {
                  marginTop: 28,
                  width: 240,
                  height: 240,
                  borderRadius: 999,
                  background: badgeBg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                },
              },
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", alignItems: "center" } },
                h(
                  "div",
                  { style: { fontSize: 74, fontWeight: 900, color: accent, lineHeight: 1 } },
                  String(score)
                ),
                h(
                  "div",
                  { style: { fontSize: 16, color: "#6b7280", marginTop: 8, fontWeight: 600 } },
                  "Trust Score"
                )
              )
            )
          ),
          h(
            "div",
            { style: { flex: 1, display: "flex", flexDirection: "column" } },
            h(
              "div",
              {
                style: {
                  background: "rgba(17,24,39,0.02)",
                  border: "1px solid rgba(17,24,39,0.08)",
                  borderRadius: 22,
                  padding: 22,
                  display: "flex",
                  gap: 18,
                  flex: 1,
                },
              },
              h(
                "div",
                { style: { flex: 1, display: "flex", flexDirection: "column" } },
                h(
                  "div",
                  { style: { fontSize: 14, color: "#6b7280", fontWeight: 700, letterSpacing: 0.4 } },
                  "AI SUMMARY"
                ),
                h(
                  "div",
                  {
                    style: {
                      fontSize: 18,
                      color: "#111827",
                      marginTop: 12,
                      lineHeight: 1.35,
                      fontWeight: 600,
                    },
                  },
                  aiSummary ? ellipsize(aiSummary, 320) : "No AI summary was provided for this run."
                )
              ),
              h(
                "div",
                { style: { width: 170, display: "flex", flexDirection: "column", alignItems: "center" } },
                h(
                  "div",
                  {
                    style: {
                      width: 152,
                      height: 152,
                      borderRadius: 26,
                      background: "linear-gradient(135deg, #ffffff 0%, #f7f8ff 100%)",
                      border: "1px solid rgba(17,24,39,0.10)",
                      boxShadow: "0 10px 24px rgba(17,24,39,0.10)",
                      padding: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    },
                  },
                  qrDataUri
                    ? h("img", { src: qrDataUri, width: 128, height: 128, style: { borderRadius: 18 } })
                    : h("div", { style: { fontSize: 12, color: "#6b7280" } }, "QR unavailable")
                ),
                h(
                  "div",
                  { style: { fontSize: 12, color: "#6b7280", marginTop: 10 } },
                  "Scan to open report"
                )
              )
            )
          )
        ),
        h(
          "div",
          {
            style: {
              marginTop: 26,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 14,
              color: "#9ca3af",
            },
          },
          h("div", null, `Analyzed: ${dateStr}`),
          h("div", { style: { color: "#2f6fed", fontWeight: 800 } }, APP_URL_DISPLAY)
        ),
        h(
          "div",
          { style: { marginTop: 10, fontSize: 12, color: "#9ca3af" } },
          "This is an automated analysis and does not make legal claims."
        )
      )
    ),
    { width: 1200, height: 630 }
  );
}
