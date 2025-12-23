import { consumeScreenshot, pruneExpiredScreenshots } from "@/lib/screenshotStore";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  pruneExpiredScreenshots();
  const { id } = await params;
  const shot = consumeScreenshot(id);
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
