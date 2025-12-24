export type StoredScreenshot = {
  id: string;
  mime: string;
  data: Uint8Array;
  createdAtMs: number;
  expiresAtMs: number;
  sizeBytes: number;
};

declare global {
  var __trustcheckScreenshotStore: Map<string, StoredScreenshot> | undefined;
  var __trustcheckScreenshotStoreBytes: number | undefined;
}

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MIN_TTL_MS = 5_000;
const MAX_ITEM_BYTES = 6 * 1024 * 1024; // 6MB per image safety cap
const MAX_STORE_BYTES = 64 * 1024 * 1024; // ~64MB total cap (best-effort)
const MAX_STORE_ITEMS = 220;

function getStore(): Map<string, StoredScreenshot> {
  if (!global.__trustcheckScreenshotStore) {
    global.__trustcheckScreenshotStore = new Map();
  }
  if (typeof global.__trustcheckScreenshotStoreBytes !== "number") {
    global.__trustcheckScreenshotStoreBytes = 0;
  }
  return global.__trustcheckScreenshotStore;
}

function randomId(): string {
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

export function putScreenshot(input: { mime: string; data: Uint8Array; ttlMs?: number }): { id: string } {
  const ttlMs =
    typeof input.ttlMs === "number" && Number.isFinite(input.ttlMs)
      ? Math.max(MIN_TTL_MS, input.ttlMs)
      : DEFAULT_TTL_MS;

  const sizeBytes = input.data?.byteLength ?? 0;
  if (sizeBytes <= 0 || sizeBytes > MAX_ITEM_BYTES) {
    // Refuse absurd inputs to avoid OOM.
    return { id: randomId() };
  }

  const id = randomId();
  const store = getStore();
  const now = Date.now();
  const item: StoredScreenshot = {
    id,
    mime: input.mime,
    data: input.data,
    createdAtMs: now,
    expiresAtMs: now + ttlMs,
    sizeBytes,
  };

  // Best-effort pruning before insert.
  pruneExpiredScreenshots();
  pruneToLimits(sizeBytes);

  store.set(id, {
    ...item,
  });

  global.__trustcheckScreenshotStoreBytes = (global.__trustcheckScreenshotStoreBytes ?? 0) + sizeBytes;
  return { id };
}

export function getScreenshot(id: string): StoredScreenshot | null {
  const store = getStore();
  const item = store.get(id);
  if (!item) return null;
  if (Date.now() > item.expiresAtMs) {
    store.delete(id);
    global.__trustcheckScreenshotStoreBytes = Math.max(
      0,
      (global.__trustcheckScreenshotStoreBytes ?? 0) - (item.sizeBytes ?? 0)
    );
    return null;
  }
  return item;
}

export function touchScreenshot(
  id: string,
  opts: { extendTtlMs: number; maxAgeMs?: number } = { extendTtlMs: DEFAULT_TTL_MS }
): StoredScreenshot | null {
  const store = getStore();
  const item = getScreenshot(id);
  if (!item) return null;

  const now = Date.now();
  const extend = Math.max(MIN_TTL_MS, opts.extendTtlMs);
  const maxAgeMs = typeof opts.maxAgeMs === "number" && Number.isFinite(opts.maxAgeMs) ? Math.max(extend, opts.maxAgeMs) : null;
  const hardCap = maxAgeMs ? item.createdAtMs + maxAgeMs : null;
  const nextExpiry = now + extend;

  const expiresAtMs = hardCap ? Math.min(hardCap, nextExpiry) : nextExpiry;

  // Update + move to the end for simple LRU-ish behavior.
  store.delete(id);
  store.set(id, { ...item, expiresAtMs });
  return store.get(id) ?? null;
}

export function pruneExpiredScreenshots(): void {
  const store = getStore();
  const now = Date.now();
  for (const [id, item] of store) {
    if (now > item.expiresAtMs) {
      store.delete(id);
      global.__trustcheckScreenshotStoreBytes = Math.max(
        0,
        (global.__trustcheckScreenshotStoreBytes ?? 0) - (item.sizeBytes ?? 0)
      );
    }
  }
}

function pruneToLimits(incomingBytes = 0): void {
  const store = getStore();
  let bytes = global.__trustcheckScreenshotStoreBytes ?? 0;
  const maxBytes = MAX_STORE_BYTES;
  const maxItems = MAX_STORE_ITEMS;

  // Remove oldest items until we're under caps.
  while (store.size >= maxItems || bytes + incomingBytes > maxBytes) {
    const firstKey = store.keys().next().value as string | undefined;
    if (!firstKey) break;
    const item = store.get(firstKey);
    store.delete(firstKey);
    if (item) bytes = Math.max(0, bytes - (item.sizeBytes ?? 0));
  }

  global.__trustcheckScreenshotStoreBytes = bytes;
}
