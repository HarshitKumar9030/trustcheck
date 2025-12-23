import Loader from "@/app/components/Loader";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[var(--bg)] grid place-items-center px-6">
      <div className="w-full max-w-md rounded-3xl bg-[var(--surface)] ring-1 ring-[var(--border)] shadow-[var(--shadow)] p-7">
        <div className="flex items-center gap-4">
          <Loader size={56} tone="brand" label="Loading" />
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">Loading TrustCheck…</div>
            <div className="mt-1 text-sm text-[var(--muted)]">Getting everything ready.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
