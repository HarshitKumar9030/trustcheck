import { analyzeWithAI, mergeScores, type AIAnalysisResult, type WebsiteData } from "./geminiAnalysis";

export type Verdict = "good" | "warn" | "bad" | "unknown" | "info";

export type ExplainabilityItem = {
  key: string;
  label: string;
  verdict: Verdict;
  detail: string;
};

export type AgentSignals = {
  agent: "python" | "node";
  domainAgeDays?: number | null;
  externalReviews?: string | null;
  warnings?: string[];
  timingsMs?: Record<string, number>;
  tls?: {
    supported: boolean;
    issuer?: string | null;
    subject?: string | null;
    notAfter?: string | null;
    daysToExpiry?: number | null;
  };
  fetch?: {
    finalUrl: string;
    httpStatus: number | null;
    contentType: string | null;
    redirectChain: string[];
    headers: Record<string, string>;
    htmlAvailable: boolean;
    fetchNote?: string | null;
  };
  crawl?: {
    pagesRequested: number;
    pagesFetched: number;
    pages: Array<{
      url: string;
      finalUrl?: string | null;
      httpStatus?: number | null;
      contentType?: string | null;
      fetchNote?: string | null;
    }>;
  } | null;
  aiJudgment?: {
    legitimacyScore: number;
    confidence: "high" | "medium" | "low";
    verdict: "legitimate" | "caution" | "suspicious" | "likely_deceptive";
    category: string;
    detectedIssues: string[];
    positiveSignals: string[];
    platform: string;
    productLegitimacy: string;
    businessIdentity: string;
    summary: string;
    recommendation: string;
    investigationLog?: string[];
    contradictionsFound?: string[];
    identityVerdict?: string;
  } | null;

  // Short-lived per-run screenshot (served by our API and may expire quickly).
  screenshot?: {
    url: string;
    mime?: string;
    expiresInSeconds?: number;
  } | null;
};

export type AnalysisResponse = {
  normalizedUrl: string;
  score: number;
  status: "Low Risk" | "Proceed with Caution" | "High Risk Indicators Detected";
  explainability: ExplainabilityItem[];
  cached: boolean;
  analyzedAt: string;
  aiAnalysis?: AIAnalysisResult;
  agentSignals?: AgentSignals;
};

export type AnalysisCacheRecord = AnalysisResponse & {
  cacheKey: string;
  analyzedAtMs: number;
  expireAtMs: number;
};

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Please use an http(s) website URL.");
  }
  url.hash = "";
  return url.toString();
}

/** Compound ccTLDs where the registrable domain is 3 labels, not 2. */
const TWO_PART_TLDS = new Set([
  "co.uk","org.uk","me.uk","ac.uk","gov.uk","net.uk","sch.uk",
  "com.au","net.au","org.au","edu.au","gov.au","id.au",
  "co.nz","net.nz","org.nz","govt.nz","ac.nz","school.nz",
  "com.br","net.br","org.br","gov.br","edu.br",
  "co.in","net.in","org.in","gen.in","firm.in","ind.in","ac.in",
  "co.za","org.za","web.za","net.za","gov.za","ac.za",
  "co.jp","ne.jp","or.jp","ac.jp","go.jp","lg.jp",
  "co.kr","ne.kr","or.kr","go.kr","pe.kr","re.kr",
  "com.cn","net.cn","org.cn","gov.cn","edu.cn","ac.cn",
  "com.mx","net.mx","org.mx","gob.mx","edu.mx",
  "com.ar","net.ar","org.ar","gob.ar","edu.ar",
  "com.sg","net.sg","org.sg","gov.sg","edu.sg",
  "com.hk","net.hk","org.hk","gov.hk","edu.hk","idv.hk",
  "com.tw","net.tw","org.tw","gov.tw","edu.tw","idv.tw",
  "co.il","org.il","net.il","ac.il","gov.il",
  "com.tr","net.tr","org.tr","gov.tr","edu.tr",
  "com.ng","net.ng","org.ng","gov.ng","edu.ng",
  "co.ke","or.ke","ne.ke","go.ke","ac.ke",
  "com.my","net.my","org.my","gov.my","edu.my",
  "com.ph","net.ph","org.ph","gov.ph","edu.ph",
  "co.th","in.th","or.th","ac.th","go.th",
  "com.pk","net.pk","org.pk","gov.pk","edu.pk",
]);

function registrableDomainGuess(hostname: string): string {
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length <= 2) return hostname;
  // Check for compound ccTLD (e.g. co.uk → need 3 labels)
  if (parts.length >= 3) {
    const lastTwo = parts.slice(-2).join(".");
    if (TWO_PART_TLDS.has(lastTwo)) {
      return parts.slice(-3).join(".");
    }
  }
  return parts.slice(-2).join(".");
}

// Well-known established domains get a trust bonus (these sites block bots but are reputable)
const WELL_KNOWN_DOMAINS = new Set([
  // Search & portals
  "google.com", "bing.com", "yahoo.com", "duckduckgo.com", "baidu.com", "yandex.ru",
  // Video & streaming
  "youtube.com", "netflix.com", "hulu.com", "disneyplus.com", "hbomax.com",
  "primevideo.com", "peacocktv.com", "crunchyroll.com", "twitch.tv", "vimeo.com",
  // Social media
  "facebook.com", "instagram.com", "twitter.com", "x.com", "linkedin.com",
  "reddit.com", "tiktok.com", "snapchat.com", "pinterest.com", "tumblr.com",
  "discord.com", "telegram.org", "whatsapp.com", "signal.org",
  // Tech giants
  "apple.com", "microsoft.com", "amazon.com", "meta.com",
  "ibm.com", "intel.com", "nvidia.com", "amd.com", "dell.com", "hp.com",
  "lenovo.com", "samsung.com", "sony.com", "lg.com", "asus.com",
  // Dev & cloud
  "github.com", "gitlab.com", "bitbucket.org", "stackoverflow.com",
  "npmjs.com", "pypi.org", "docker.com", "vercel.com", "netlify.com",
  "heroku.com", "digitalocean.com", "aws.amazon.com", "cloud.google.com",
  "azure.microsoft.com",
  // SaaS & productivity
  "zoom.us", "slack.com", "notion.so", "atlassian.com", "trello.com",
  "asana.com", "monday.com", "figma.com", "canva.com",
  "salesforce.com", "oracle.com", "sap.com", "workday.com", "servicenow.com",
  "dropbox.com", "box.com", "adobe.com", "autodesk.com", "intuit.com",
  // E-commerce & retail
  "ebay.com", "walmart.com", "target.com", "bestbuy.com", "costco.com",
  "etsy.com", "shopify.com", "aliexpress.com", "wish.com", "wayfair.com",
  "homedepot.com", "lowes.com", "macys.com", "nordstrom.com", "ikea.com",
  "zappos.com", "newegg.com", "overstock.com",
  // Finance & payments
  "paypal.com", "stripe.com", "square.com", "venmo.com",
  "chase.com", "bankofamerica.com", "wellsfargo.com", "citi.com",
  "capitalone.com", "amex.com", "visa.com", "mastercard.com",
  "fidelity.com", "schwab.com", "vanguard.com", "tdameritrade.com",
  "robinhood.com", "coinbase.com", "binance.com", "kraken.com",
  "sofi.com", "ally.com", "discover.com",
  // News & media
  "nytimes.com", "washingtonpost.com", "bbc.com", "bbc.co.uk", "cnn.com",
  "reuters.com", "apnews.com", "bloomberg.com", "wsj.com", "forbes.com",
  "theguardian.com", "npr.org", "time.com", "economist.com",
  "usatoday.com", "nbcnews.com", "abcnews.go.com", "cbsnews.com",
  "foxnews.com", "politico.com", "thehill.com",
  // Knowledge & education
  "wikipedia.org", "wikimedia.org", "britannica.com",
  "coursera.org", "edx.org", "udemy.com", "khanacademy.org",
  "duolingo.com", "quizlet.com",
  // Publishing & blogs
  "medium.com", "substack.com", "quora.com", "wordpress.com", "blogger.com",
  // Travel & food
  "booking.com", "airbnb.com", "expedia.com", "tripadvisor.com",
  "kayak.com", "hotels.com", "vrbo.com",
  "doordash.com", "ubereats.com", "grubhub.com", "yelp.com",
  // Health & govt
  "webmd.com", "mayoclinic.org", "nih.gov", "cdc.gov", "who.int",
  "healthcare.gov", "medicare.gov",
  // Music & entertainment
  "spotify.com", "soundcloud.com", "bandcamp.com",
  "imdb.com", "rottentomatoes.com",
  // Telecoms & ISPs
  "att.com", "verizon.com", "t-mobile.com", "comcast.com", "xfinity.com",
  // Ride & logistics
  "uber.com", "lyft.com", "fedex.com", "ups.com", "usps.com", "dhl.com",
  // Gaming
  "steampowered.com", "epicgames.com", "ea.com", "roblox.com", "minecraft.net",
  // Real estate & auto
  "zillow.com", "realtor.com", "redfin.com", "trulia.com",
  "carvana.com", "carmax.com", "autotrader.com",
]);

function isWellKnownDomain(hostname: string): boolean {
  const domain = registrableDomainGuess(hostname.toLowerCase());
  return WELL_KNOWN_DOMAINS.has(domain);
}

function statusForScore(score: number): AnalysisResponse["status"] {
  if (score >= 75) return "Low Risk";
  if (score >= 45) return "Proceed with Caution";
  return "High Risk Indicators Detected";
}

function hasAny(text: string, needles: string[]): boolean {
  const hay = text.toLowerCase();
  return needles.some((n) => hay.includes(n));
}

function countAny(text: string, needles: string[]): number {
  const hay = text.toLowerCase();
  let count = 0;
  for (const n of needles) if (hay.includes(n)) count += 1;
  return count;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 12000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getDomainAgeDays(hostname: string): Promise<number | null> {
  const domain = registrableDomainGuess(hostname);
  try {
    const res = await fetchWithTimeout(`https://rdap.org/domain/${domain}`, {
      headers: {
        accept: "application/rdap+json, application/json",
      },
      timeoutMs: 5000,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      events?: Array<{ eventAction?: string; eventDate?: string }>;
    };

    const events = data.events ?? [];
    const registration = events.find((e) => {
      const action = String(e.eventAction ?? "").toLowerCase();
      return action.includes("registration") || action === "created" || action === "registered";
    });
    if (!registration?.eventDate) return null;

    const created = Date.parse(registration.eventDate);
    if (!Number.isFinite(created)) return null;
    const ageMs = Date.now() - created;
    const days = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    return days >= 0 ? days : null;
  } catch {
    return null;
  }
}

async function fetchHomepageSignals(normalizedUrl: string): Promise<{
  finalUrl: string;
  htmlText: string | null;
  httpStatus: number | null;
  contentType: string | null;
  headers: Record<string, string>;
  redirectChain: string[];
}> {
  const redirectChain: string[] = [];
  let currentUrl = normalizedUrl;
  let maxRedirects = 5;
  let httpStatus: number | null = null;
  let contentType: string | null = null;
  const headers: Record<string, string> = {};

  try {
    while (maxRedirects > 0) {
      const res = await fetchWithTimeout(currentUrl, {
        redirect: "manual",
        timeoutMs: 12000,
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 TrustCheckBot/2.0",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.5",
        },
        cache: "no-store",
      });

      httpStatus = res.status;
      contentType = res.headers.get("content-type");

      const headerNames = ["server", "x-powered-by", "strict-transport-security", "content-security-policy", "x-frame-options"];
      for (const name of headerNames) {
        const value = res.headers.get(name);
        if (value) headers[name] = value;
      }

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (location) {
          redirectChain.push(currentUrl);
          currentUrl = new URL(location, currentUrl).toString();
          maxRedirects--;
          continue;
        }
      }

      if (!contentType?.toLowerCase().includes("text/html")) {
        return { finalUrl: currentUrl, htmlText: null, httpStatus, contentType, headers, redirectChain };
      }

      const html = await res.text();
      return { finalUrl: currentUrl, htmlText: html.slice(0, 500_000), httpStatus, contentType, headers, redirectChain };
    }

    return { finalUrl: currentUrl, htmlText: null, httpStatus, contentType, headers, redirectChain };
  } catch {
    return { finalUrl: normalizedUrl, htmlText: null, httpStatus: null, contentType: null, headers: {}, redirectChain: [] };
  }
}

export async function analyzeWebsite(
  rawUrl: string
): Promise<Omit<AnalysisResponse, "cached" | "analyzedAt"> & { analyzedAtMs: number; cacheKey: string }> {
  const normalizedUrl = normalizeUrl(rawUrl);
  const url = new URL(normalizedUrl);
  const hostname = url.hostname;
  const cacheKey = hostname.toLowerCase();

  const explainability: ExplainabilityItem[] = [];

  // 1) HTTPS status
  const httpsVerdict: Verdict = url.protocol === "https:" ? "good" : "warn";
  explainability.push({
    key: "https",
    label: "HTTPS status",
    verdict: httpsVerdict,
    detail:
      url.protocol === "https:"
        ? "Connection is encrypted (HTTPS)."
        : "Website is using HTTP; encryption may be missing.",
  });

  // 2) Domain age (best-effort via RDAP)
  const ageDays = await getDomainAgeDays(hostname);
  let domainVerdict: Verdict = "unknown";
  let domainDetail = "Domain age couldn’t be determined from public registry data.";
  if (ageDays != null) {
    if (ageDays >= 365) domainVerdict = "good";
    else if (ageDays >= 90) domainVerdict = "warn";
    else domainVerdict = "bad";

    const years = (ageDays / 365).toFixed(ageDays >= 365 ? 1 : 2);
    domainDetail = `Estimated domain age: about ${years} years.`;
  }
  explainability.push({
    key: "domainAge",
    label: "Domain age",
    verdict: domainVerdict,
    detail: domainDetail,
  });

  // 3) Homepage content signals (best-effort)
  const { finalUrl, htmlText, httpStatus, contentType, headers, redirectChain } = await fetchHomepageSignals(normalizedUrl);

  // Cross-domain redirect detection
  const finalHostname = (() => { try { return new URL(finalUrl).hostname; } catch { return hostname; } })();
  const crossDomainRedirect = registrableDomainGuess(hostname) !== registrableDomainGuess(finalHostname);
  if (crossDomainRedirect) {
    explainability.push({
      key: "crossDomainRedirect",
      label: "Cross-domain redirect",
      verdict: "warn",
      detail: `Redirected from ${hostname} to ${finalHostname}. Cross-domain redirects can indicate domain forwarding or potential phishing setups.`,
    });
  }

  const finalProtocol = (() => {
    try {
      return new URL(finalUrl).protocol;
    } catch {
      return url.protocol;
    }
  })();

  if (finalProtocol !== url.protocol) {
    // Update HTTPS signal if redirect changes it
    const httpsItem = explainability.find((x) => x.key === "https");
    if (httpsItem) {
      httpsItem.verdict = finalProtocol === "https:" ? "good" : "warn";
      httpsItem.detail =
        finalProtocol === "https:"
          ? "Redirected to an encrypted (HTTPS) connection."
          : "Redirected to an unencrypted (HTTP) connection.";
    }
  }

  const text = htmlText ? htmlText.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ") : "";

  // Business info presence (phrase-level to avoid false positives)
  const businessNeedles = [
    "about us", "about our", "our company", "our team", "who we are",
    "contact us", "get in touch", "reach out",
    "privacy policy", "privacy notice", "data protection",
    "terms of service", "terms and conditions", "terms of use",
    "refund policy", "return policy", "returns & exchanges",
    "shipping policy", "shipping info", "delivery info",
    "customer support", "help center", "help centre", "faq",
    "company info", "corporate info", "our mission", "our story",
    "trust & safety", "cookie policy",
  ];
  const businessCount = text ? countAny(text, businessNeedles) : 0;
  let businessVerdict: Verdict = "unknown";
  let businessDetail = "Homepage content wasn’t available to check for business details.";
  if (htmlText) {
    businessVerdict = businessCount >= 3 ? "good" : businessCount >= 1 ? "warn" : "bad";
    businessDetail =
      businessCount >= 3
        ? "Found multiple common business/support signals (e.g., contact, policies)."
        : businessCount >= 1
          ? "Found limited business/support info on the homepage."
          : "Didn’t find common business/support markers on the homepage.";
  }
  explainability.push({
    key: "businessInfo",
    label: "Business information",
    verdict: businessVerdict,
    detail: businessDetail,
  });

  // Medical/health scam detection (two tiers to avoid flagging legitimate health sites)
  const scamMedicalPhrases = [
    "miracle cure", "guaranteed cure", "secret remedy",
    "doctors don't want", "big pharma hides", "one weird trick",
    "clinically proven to cure", "fda approved cure",
    "lose weight fast", "rapid weight loss", "burn fat instantly",
    "100% natural cure", "ancient remedy", "detox miracle",
  ];
  const genericMedicalTerms = [
    "supplement", "weight loss", "anti-aging", "detox", "cleanse", "miracle", "remedy",
  ];
  const scamMedicalHit = htmlText ? hasAny(text, scamMedicalPhrases) : false;
  const genericMedicalCount = htmlText ? countAny(text, genericMedicalTerms) : 0;
  const medicalFound = scamMedicalHit || genericMedicalCount >= 3;
  let medicalVerdict: Verdict = "unknown";
  let medicalDetail = "Homepage content wasn’t available to check for claims.";
  if (htmlText) {
    medicalVerdict = medicalFound ? "warn" : "good";
    medicalDetail = medicalFound
      ? "Detected health/medical-related phrasing that may indicate unverified claims; consider extra caution."
      : "No obvious health/medical-claim phrasing detected on the homepage.";
  }
  explainability.push({
    key: "medicalClaims",
    label: "Medical claims detected",
    verdict: medicalVerdict,
    detail: medicalDetail,
  });

  // Customer support signals (phrase-level to reduce false positives)
  const supportNeedles = [
    "customer support", "customer service", "help center", "help centre",
    "contact us", "get in touch", "live chat", "chat with us",
    "return policy", "returns policy", "refund policy",
    "shipping policy", "delivery policy",
    "email us", "call us", "phone support",
    "support team", "support center", "support centre",
    "toll free", "toll-free",
  ];
  const supportFound = htmlText ? hasAny(text, supportNeedles) : false;
  let supportVerdict: Verdict = "unknown";
  let supportDetail = "Homepage content wasn’t available to check for support signals.";
  if (htmlText) {
    supportVerdict = supportFound ? "good" : "warn";
    supportDetail = supportFound
      ? "Found customer support cues (support/contact/policies)."
      : "Didn’t find obvious customer support cues on the homepage.";
  }
  explainability.push({
    key: "customerSupport",
    label: "Customer support signals",
    verdict: supportVerdict,
    detail: supportDetail,
  });

  // Check if this is a well-known established domain
  const isWellKnown = isWellKnownDomain(hostname);
  
  // Add established brand signal if applicable
  if (isWellKnown) {
    explainability.push({
      key: "establishedBrand",
      label: "Established brand",
      verdict: "good",
      detail: "This is a widely recognized, established website with global presence.",
    });
  }

  // AI Analysis
  const websiteData: WebsiteData = {
    url: normalizedUrl,
    hostname,
    protocol: url.protocol,
    htmlContent: htmlText,
    domainAgeDays: ageDays,
    isWellKnown,
    httpStatus,
    redirectChain,
    contentType,
    headers,
  };

  const aiResult = await analyzeWithAI(websiteData);

  if (aiResult) {
    let aiVerdict: Verdict = "unknown";
    if (aiResult.confidenceLevel === "high") {
      aiVerdict = aiResult.aiScore >= 75 ? "good" : aiResult.aiScore >= 45 ? "warn" : "bad";
    } else if (aiResult.confidenceLevel === "medium") {
      aiVerdict = aiResult.aiScore >= 70 ? "good" : aiResult.aiScore >= 40 ? "warn" : "bad";
    }

    explainability.push({
      key: "aiAnalysis",
      label: "AI Analysis",
      verdict: aiVerdict,
      detail: aiResult.summary || aiResult.overallAssessment,
    });
  }

  // Scoring (simple, calm heuristic)
  let score = 50;

  const add = (v: Verdict, weights: { good: number; warn: number; bad: number; unknown: number; info: number }) => {
    score += weights[v];
  };

  add(explainability.find((x) => x.key === "https")?.verdict ?? "unknown", {
    good: 12,
    warn: -10,
    bad: -15,
    unknown: 0,
    info: 0,
  });

  add(domainVerdict, { good: 15, warn: 5, bad: -12, unknown: isWellKnown ? 10 : 0, info: 0 });
  
  add(businessVerdict, { 
    good: 12, 
    warn: 3, 
    bad: -8, 
    unknown: isWellKnown ? 10 : 0,
    info: 0,
  });
  add(medicalVerdict, { 
    good: 5, 
    warn: -8, 
    bad: -8, 
    unknown: isWellKnown ? 3 : 0,
    info: 0,
  });
  add(supportVerdict, { 
    good: 10, 
    warn: 2, 
    bad: -6, 
    unknown: isWellKnown ? 8 : 0,
    info: 0,
  });

  // Penalty for cross-domain redirects
  if (crossDomainRedirect) {
    score -= 10;
  }

  // Bonus for well-known established domains
  if (isWellKnown) {
    score += 15;
  }

  // Security headers bonus
  if (headers["strict-transport-security"]) score += 3;
  if (headers["content-security-policy"]) score += 2;
  if (headers["x-frame-options"]) score += 2;

  // Merge with AI score if available
  const finalScore = clampScore(mergeScores(score, aiResult));

  return {
    normalizedUrl: normalizeUrl(finalUrl),
    score: finalScore,
    status: statusForScore(finalScore),
    explainability,
    aiAnalysis: aiResult ?? undefined,
    analyzedAtMs: Date.now(),
    cacheKey,
  };
}
