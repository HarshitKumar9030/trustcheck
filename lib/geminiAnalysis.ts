import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export type AIAnalysisResult = {
  overallAssessment: string;
  trustSignals: {
    positive: string[];
    negative: string[];
    neutral: string[];
  };
  riskFactors: string[];
  recommendations: string[];
  confidenceLevel: "high" | "medium" | "low";
  category: string;
  summary: string;
  aiScore: number; // 0-100 AI-suggested score adjustment
};

export type WebsiteData = {
  url: string;
  hostname: string;
  protocol: string;
  htmlContent: string | null;
  domainAgeDays: number | null;
  isWellKnown: boolean;
  httpStatus: number | null;
  redirectChain: string[];
  contentType: string | null;
  headers: Record<string, string>;
  pagesCrawled?: number;
};

const ANALYSIS_PROMPT = `You are TrustCheck AI, an expert website trust and safety analyst. Your job is to assess website trust indicators based ONLY on the provided signals.

IMPORTANT GUIDELINES:
- Be calm, factual, and non-accusatory
- NEVER use words like "scam", "fraud", "fake", or "exposed"
- Use neutral language like "indicators suggest caution" or "limited information available"
- Focus on observable facts, not assumptions
- Acknowledge when data is insufficient
- Well-known established brands (Amazon, Google, Microsoft, etc.) should be treated favorably even if content couldn't be fetched (they often block bots)

SCORING RULES (be conservative for unknown sites):
- If Is Well-Known Brand is "No" AND (HTML is unavailable OR Domain Age is unknown), confidenceLevel MUST be "low" or "medium".
- If Is Well-Known Brand is "No" AND HTML is unavailable, prefer aiScore in the 45–60 range (caution), not 75+.
- Very new domains (< 180 days) should generally score <= 55 unless there are strong, explicit trust signals.
- If the content looks like a generic template storefront, unrealistic promises, heavy urgency cues, or missing contact/business details, aiScore should be below 45.
- Do not claim wrongdoing; describe observable risk indicators.

Analyze the following website data and provide a JSON response:

WEBSITE DATA:
URL: {{url}}
Hostname: {{hostname}}
Protocol: {{protocol}}
Domain Age: {{domainAge}}
Is Well-Known Brand: {{isWellKnown}}
HTTP Status: {{httpStatus}}
Content Type: {{contentType}}
Redirect Chain: {{redirectChain}}
Headers: {{headers}}
Pages Crawled (internal links): {{pagesCrawled}}

HTML CONTENT (truncated if long):
{{htmlContent}}

Respond ONLY with valid JSON in this exact format:
{
  "overallAssessment": "Brief 1-2 sentence assessment of the website's trustworthiness",
  "trustSignals": {
    "positive": ["Array of positive trust indicators found"],
    "negative": ["Array of concerning indicators found (use neutral language)"],
    "neutral": ["Array of neutral observations"]
  },
  "riskFactors": ["Specific risk factors to be aware of, if any"],
  "recommendations": ["Actionable recommendations for the user"],
  "confidenceLevel": "high/medium/low based on data quality",
  "category": "e-commerce/news/social/corporate/personal/unknown",
  "summary": "A single clear sentence summarizing the trust level",
  "aiScore": 0-100 representing suggested trust score (75+ is low risk, 45-74 is caution, below 45 is high risk)
}`;

export async function analyzeWithAI(data: WebsiteData): Promise<AIAnalysisResult | null> {
  if (!GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY not set, skipping AI analysis");
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const prompt = ANALYSIS_PROMPT
      .replace("{{url}}", data.url)
      .replace("{{hostname}}", data.hostname)
      .replace("{{protocol}}", data.protocol)
      .replace("{{domainAge}}", data.domainAgeDays != null ? `${data.domainAgeDays} days` : "Unknown")
      .replace("{{isWellKnown}}", data.isWellKnown ? "Yes" : "No")
      .replace("{{httpStatus}}", data.httpStatus?.toString() ?? "Unknown")
      .replace("{{contentType}}", data.contentType ?? "Unknown")
      .replace("{{redirectChain}}", data.redirectChain.length > 0 ? data.redirectChain.join(" -> ") : "None")
      .replace("{{headers}}", JSON.stringify(data.headers, null, 2))
      .replace("{{pagesCrawled}}", data.pagesCrawled != null ? String(data.pagesCrawled) : "Unknown")
      .replace("{{htmlContent}}", data.htmlContent?.slice(0, 15000) ?? "Content not available (site may block automated access)");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    });

    const text = response.text?.trim();
    if (!text) return null;

    // Clean up the response - remove markdown code blocks if present
    let jsonText = text;
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith("```")) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const result = JSON.parse(jsonText) as AIAnalysisResult;
    
    // Validate the result structure
    if (
      typeof result.overallAssessment !== "string" ||
      typeof result.aiScore !== "number" ||
      !result.trustSignals ||
      !Array.isArray(result.trustSignals.positive)
    ) {
      console.error("Invalid AI response structure");
      return null;
    }

    // Clamp aiScore to valid range
    result.aiScore = Math.max(0, Math.min(100, Math.round(result.aiScore)));

    // Guardrails: unknown sites with limited data should not get "Low Risk" scores.
    const limitedData = !data.isWellKnown && (!data.htmlContent || data.domainAgeDays == null);
    if (limitedData) {
      result.aiScore = Math.min(result.aiScore, 65);
      if (result.confidenceLevel === "high") result.confidenceLevel = "medium";
    }

    return result;
  } catch (error) {
    console.error("AI analysis failed:", error);
    return null;
  }
}

export function mergeScores(heuristicScore: number, aiResult: AIAnalysisResult | null): number {
  if (!aiResult) return heuristicScore;

  // AI-led merging: if confidence is high, trust the AI score as the primary output.
  if (aiResult.confidenceLevel === "high") return aiResult.aiScore;

  const weightAI = aiResult.confidenceLevel === "medium" ? 0.75 : 0.5;
  const merged = Math.round(heuristicScore * (1 - weightAI) + aiResult.aiScore * weightAI);
  return Math.max(0, Math.min(100, merged));
}
