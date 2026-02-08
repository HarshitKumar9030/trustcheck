import { NextResponse } from "next/server";
import { getMongoDb } from "@/lib/mongo";

const ALLOWED_CATEGORIES = new Set([
  "phishing", "malware", "scam", "fake-store", "impersonation",
  "financial-fraud", "tech-support-scam", "romance-scam", "crypto-scam",
  "counterfeit", "data-harvesting", "other",
]);

const MAX_URL_LENGTH = 2048;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_EVIDENCE_LENGTH = 5000;

/** Strip HTML tags AND control characters from user text input. */
function sanitizeText(raw: string, maxLength: number): string {
  return raw
    .replace(/<[^>]*>/g, "")                 // strip HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")  // control chars
    .trim()
    .slice(0, maxLength);
}

export async function POST(req: Request) {
  try {
    const { url, category, description, evidence } = await req.json();

    if (!url || !category) {
      return NextResponse.json(
        { error: "URL and Category are required." },
        { status: 400 }
      );
    }

    // Validate URL format
    const urlStr = String(url).trim();
    if (urlStr.length > MAX_URL_LENGTH) {
      return NextResponse.json({ error: "URL is too long." }, { status: 400 });
    }
    try {
      const parsed = new URL(urlStr);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return NextResponse.json({ error: "URL must use http or https." }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL format." }, { status: 400 });
    }

    // Validate category against allowlist
    const categoryStr = String(category).trim().toLowerCase();
    if (!ALLOWED_CATEGORIES.has(categoryStr)) {
      return NextResponse.json(
        { error: `Invalid category. Allowed: ${[...ALLOWED_CATEGORIES].join(", ")}` },
        { status: 400 }
      );
    }

    const db = await getMongoDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database connection failed." },
        { status: 500 }
      );
    }

    const report = {
      url: urlStr,
      category: categoryStr,
      description: sanitizeText(String(description || ""), MAX_DESCRIPTION_LENGTH),
      evidence: sanitizeText(String(evidence || ""), MAX_EVIDENCE_LENGTH),
      createdAt: new Date(),
      status: "pending",
    };

    await db.collection("scam_reports").insertOne(report);

    return NextResponse.json({ success: true, message: "Report submitted successfully." });
  } catch (error) {
    console.error("Error submitting scam report:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
