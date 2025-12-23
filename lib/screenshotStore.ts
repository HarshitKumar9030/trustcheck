export type StoredScreenshot = {
  id: string;
  mime: string;
  data: Uint8Array;
  expiresAtMs: number;
};

declare global {
  var __trustcheckScreenshotStore: Map<string, StoredScreenshot> | undefined;
}

function getStore(): Map<string, StoredScreenshot> {
  if (!global.__trustcheckScreenshotStore) {
    global.__trustcheckScreenshotStore = new Map();
  }
  return global.__trustcheckScreenshotStore;
}

function randomId(): string {
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

export function putScreenshot(input: { mime: string; data: Uint8Array; ttlMs?: number }): { id: string } {
  const ttlMs = typeof input.ttlMs === "number" && Number.isFinite(input.ttlMs) ? Math.max(5_000, input.ttlMs) : 120_000;
  const id = randomId();
  const store = getStore();
  store.set(id, {
    id,
    mime: input.mime,
    data: input.data,
    expiresAtMs: Date.now() + ttlMs,
  });
  return { id };
}

export function getScreenshot(id: string): StoredScreenshot | null {
  const store = getStore();
  const item = store.get(id);
  if (!item) return null;
  if (Date.now() > item.expiresAtMs) {
    store.delete(id);
    return null;
  }
  return item;
}

export function consumeScreenshot(id: string): StoredScreenshot | null {
  const store = getStore();
  const item = getScreenshot(id);
  if (!item) return null;
  store.delete(id);
  return item;
}

export function pruneExpiredScreenshots(): void {
  const store = getStore();
  const now = Date.now();
  for (const [id, item] of store) {
    if (now > item.expiresAtMs) store.delete(id);
  }
}
