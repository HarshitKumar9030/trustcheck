import { NextResponse } from "next/server";
import { createCanvas, loadImage, type CanvasRenderingContext2D } from "canvas";
import path from "path";
import QRCode from "qrcode";

type TrustCardRequest = {
  url: string;
  score: number;
  status: string;
  analyzedAt: string;
  aiSummary?: string;
};

const APP_URL_DISPLAY = "trustcheck.agfe.tech";
const APP_ORIGIN = "https://trustcheck.agfe.tech";

function getScoreColor(score: number): string {
  if (score >= 75) return "#1f7a4a"; // green
  if (score >= 45) return "#b7791f"; // amber
  return "#c24144"; // red
}

function getScoreBgColor(score: number): string {
  if (score >= 75) return "#dcfce7"; // light green
  if (score >= 45) return "#fef3c7"; // light amber
  return "#fee2e2"; // light red
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function ellipsize(text: string, max: number): string {
  const t = (text ?? "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as TrustCardRequest;
    const { url, score, status, analyzedAt, aiSummary } = payload;

    const reportUrl = `${APP_ORIGIN}/?url=${encodeURIComponent(url)}`;

    // Card dimensions (optimized for social sharing)
    const width = 1200;
    const height = 630;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#fbfbff");
    gradient.addColorStop(1, "#f3f6ff");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Soft brand glow accents
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#2f6fed";
    ctx.beginPath();
    ctx.arc(260, 140, 220, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = getScoreColor(score);
    ctx.beginPath();
    ctx.arc(width - 220, height - 160, 260, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Main card area with shadow effect
    const cardX = 40;
    const cardY = 40;
    const cardWidth = width - 80;
    const cardHeight = height - 80;
    const cornerRadius = 32;

    // Card shadow
    ctx.shadowColor = "rgba(17, 24, 39, 0.08)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 18;

    // Draw card background
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cornerRadius);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Card border
    ctx.strokeStyle = "rgba(17, 24, 39, 0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Try to load and draw logo
    try {
      const logoPath = path.join(process.cwd(), "public", "trustcheck.png");
      const logo = await loadImage(logoPath);
      const logoSize = 48;
      ctx.drawImage(logo, 80, 80, logoSize, logoSize);
    } catch {
      // Draw placeholder logo if image fails
      ctx.fillStyle = "#2f6fed";
      ctx.beginPath();
      ctx.roundRect(80, 80, 48, 48, 12);
      ctx.fill();
    }

    // TrustCheck branding
    ctx.font = "bold 24px sans-serif";
    ctx.fillStyle = "#111827";
    ctx.fillText("TrustCheck", 144, 108);

    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#6b7280";
    ctx.fillText("AI-Powered Trust Analysis", 144, 128);

    // Status badge (top-right)
    {
      const badgeText = ellipsize(status, 30);
      ctx.font = "bold 16px sans-serif";
      const paddingX = 16;
      const badgeW = Math.max(220, Math.min(460, ctx.measureText(badgeText).width + paddingX * 2));
      const badgeH = 44;
      const badgeX = width - 80 - badgeW;
      const badgeY = 84;
      ctx.fillStyle = getScoreBgColor(score);
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 22);
      ctx.fill();
      ctx.fillStyle = getScoreColor(score);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }

    // Website (hostname + URL)
    const host = safeHostname(url);
    ctx.font = "bold 28px sans-serif";
    ctx.fillStyle = "#111827";
    ctx.fillText(host, 80, 205);

    ctx.font = "16px sans-serif";
    ctx.fillStyle = "#6b7280";
    ctx.fillText(ellipsize(url, 70), 80, 232);

    // Score circle
    const circleX = 210;
    const circleY = 390;
    const circleRadius = 102;

    // Score background circle
    ctx.fillStyle = getScoreBgColor(score);
    ctx.beginPath();
    ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
    ctx.fill();

    // Score arc (progress)
    const scoreAngle = (score / 100) * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = getScoreColor(score);
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(circleX, circleY, circleRadius - 15, -Math.PI / 2, scoreAngle);
    ctx.stroke();

    // Score number
    ctx.font = "bold 68px sans-serif";
    ctx.fillStyle = getScoreColor(score);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(score.toString(), circleX, circleY - 10);

    // "Trust Score" label
    ctx.font = "16px sans-serif";
    ctx.fillStyle = "#6b7280";
    ctx.fillText("Trust Score", circleX, circleY + 40);

    // Reset text align
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    const contentLeft = 380;

    // AI Summary section
    const summaryBoxX = contentLeft;
    const summaryBoxY = 270;
    const summaryBoxW = width - 80 - summaryBoxX;
    const summaryBoxH = 250;

    // QR (right side inside the summary box)
    const qrBoxSize = 152;
    const qrPad = 12;
    const qrInner = qrBoxSize - qrPad * 2;
    const qrX = summaryBoxX + summaryBoxW - 22 - qrBoxSize;
    const qrY = summaryBoxY + 62;
    const summaryTextMaxWidth = summaryBoxW - 44 - (qrBoxSize + 22);

    let qrImage: Awaited<ReturnType<typeof loadImage>> | null = null;
    try {
      const qrDataUrl = await QRCode.toDataURL(reportUrl, {
        errorCorrectionLevel: "M",
        margin: 1,
        scale: 10,
        color: { dark: "#111827", light: "#ffffff" },
      });
      qrImage = await loadImage(qrDataUrl);
    } catch {
      qrImage = null;
    }

    ctx.fillStyle = "rgba(17, 24, 39, 0.02)";
    roundRectPath(ctx, summaryBoxX, summaryBoxY, summaryBoxW, summaryBoxH, 22);
    ctx.fill();

    ctx.strokeStyle = "rgba(17, 24, 39, 0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // AI Summary section
    ctx.font = "bold 16px sans-serif";
    ctx.fillStyle = "#111827";
    ctx.fillText("AI summary", contentLeft + 22, summaryBoxY + 36);

    // QR container + label
    {
      const qrGradient = ctx.createLinearGradient(qrX, qrY, qrX + qrBoxSize, qrY + qrBoxSize);
      qrGradient.addColorStop(0, "#ffffff");
      qrGradient.addColorStop(1, "#f7f8ff");

      ctx.save();
      ctx.shadowColor = "rgba(17, 24, 39, 0.10)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 10;

      ctx.fillStyle = qrGradient;
      roundRectPath(ctx, qrX, qrY, qrBoxSize, qrBoxSize, 26);
      ctx.fill();

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      ctx.strokeStyle = "rgba(17, 24, 39, 0.10)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // inner clip for softened edges
      if (qrImage) {
        ctx.save();
        roundRectPath(ctx, qrX + qrPad, qrY + qrPad, qrInner, qrInner, 18);
        ctx.clip();
        ctx.drawImage(qrImage, qrX + qrPad, qrY + qrPad, qrInner, qrInner);
        ctx.restore();
      } else {
        ctx.fillStyle = "rgba(17, 24, 39, 0.03)";
        roundRectPath(ctx, qrX + qrPad, qrY + qrPad, qrInner, qrInner, 18);
        ctx.fill();
        ctx.fillStyle = "#6b7280";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("QR unavailable", qrX + qrBoxSize / 2, qrY + qrBoxSize / 2);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }

      ctx.restore();

      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.textAlign = "center";
      ctx.fillText("Scan to open report", qrX + qrBoxSize / 2, summaryBoxY + summaryBoxH - 18);
      ctx.textAlign = "left";
    }

    if (aiSummary && aiSummary.trim()) {
      ctx.font = "16px sans-serif";
      ctx.fillStyle = "#374151";
      const summaryLines = wrapText(ctx, aiSummary.trim(), summaryTextMaxWidth);
      let lineY = summaryBoxY + 70;
      const maxLines = 5;
      const shown = summaryLines.slice(0, maxLines);
      for (let i = 0; i < shown.length; i++) {
        let line = shown[i];
        const isLast = i === shown.length - 1 && summaryLines.length > maxLines;
        if (isLast) line = ellipsize(line, 110);
        ctx.fillText(line, contentLeft + 22, lineY);
        lineY += 26;
      }
    } else {
      ctx.font = "16px sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.fillText("No AI summary was provided for this run.", contentLeft + 22, summaryBoxY + 78);
    }

    // Footer row
    const footerY = height - 70;

    // Analyzed date
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#9ca3af";
    const dateStr = new Date(analyzedAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    ctx.textAlign = "left";
    ctx.fillText(`Analyzed: ${dateStr}`, 80, footerY);

    // Disclaimer
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#9ca3af";
    ctx.fillText(
      "This is an automated analysis and does not make legal claims.",
      80,
      height - 50
    );

    // App URL (bottom-right)
    ctx.font = "bold 14px sans-serif";
    ctx.fillStyle = "#2f6fed";
    ctx.textAlign = "right";
    ctx.fillText(APP_URL_DISPLAY, width - 80, footerY);
    ctx.textAlign = "left";

    // Convert to PNG buffer
    const buffer = canvas.toBuffer("image/png");
    const pngBytes = new Uint8Array(buffer);

    return new NextResponse(pngBytes, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Trust card generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate trust card" },
      { status: 500 }
    );
  }
}
