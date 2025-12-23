"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Loader from "@/app/components/Loader";

/**
 * Shows a short, Apple-like fluid loader overlay.
 * - On first mount (initial visit / refresh) it shows for `minMs`.
 * - On route changes it briefly shows again (helps transitions feel deliberate).
 */
export function PageLoadGate({ minMs = 900 }: { minMs?: number }) {
  const pathname = usePathname();
  return <Gate key={pathname} minMs={minMs} />;
}

function Gate({ minMs }: { minMs: number }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => setVisible(false), Math.max(150, minMs));
    return () => window.clearTimeout(id);
  }, [minMs]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(255,255,255,0.55)] backdrop-blur-md"
    >
      <div className="rounded-3xl bg-white/80 ring-1 ring-[rgba(17,24,39,0.10)] shadow-[0_30px_90px_rgba(17,24,39,0.18)] px-7 py-6">
        <div className="flex items-center gap-4">
          <Loader size={60} tone="brand" label="Loading" />
          <div>
            <div className="text-sm font-semibold text-[rgba(17,24,39,0.92)]">Loading…</div>
            <div className="mt-1 text-sm text-[rgba(17,24,39,0.55)]">Please wait a moment.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
