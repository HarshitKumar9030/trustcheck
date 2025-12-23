"use client";

export type ScanRecord = {
  id: string;
  hostname: string;
  url: string;
  analyzedAt: string;
  score: number;
  status: "Low Risk" | "Proceed with Caution" | "High Risk Indicators Detected";
  aiVerdict?: "legitimate" | "caution" | "suspicious" | "likely_deceptive";
  aiConfidence?: "high" | "medium" | "low";
  flagged: boolean;
};

export const STORAGE_HISTORY_KEY = "trustcheck:scanHistory";

export function loadScanHistory(): ScanRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((v): v is ScanRecord => typeof v === "object" && v !== null)
      .slice(0, 50);
  } catch {
    return [];
  }
}

export function saveScanHistory(next: ScanRecord[]) {
  try {
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(next.slice(0, 50)));
  } catch {
    // ignore
  }
}
