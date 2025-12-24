import { getScreenshot, pruneExpiredScreenshots, touchScreenshot } from "@/lib/screenshotStore";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  pruneExpiredScreenshots();
  const { id } = await params;
  // Do not consume: users may view, swipe, and print multiple times.
  // Touch extends lifetime while actively used.
  const shot = touchScreenshot(id, { extendTtlMs: 30 * 60 * 1000, maxAgeMs: 2 * 60 * 60 * 1000 }) ?? getScreenshot(id);
  if (!shot) {
    return new Response("Not found", {
      status: 404,
      headers: { "cache-control": "no-store" },
    });
  }

  // Response() in the Node.js runtime expects a BodyInit; Buffer is accepted while Uint8Array
  return new Response(Buffer.from(shot.data), {
    status: 200,
    headers: {
      "content-type": shot.mime || "image/png",
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}
