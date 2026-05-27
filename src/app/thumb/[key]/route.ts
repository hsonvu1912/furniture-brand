// =============================================================================
// /thumb/<key> — serve PNG thumbnail từ KV namespace ke-presets (prefix thumb:).
//
// Cache aggressive 1 năm: URL gồm timestamp `<slug>-<ts>.png` → mỗi lần admin
// resave preset là URL khác → cache-busting tự nhiên.
//
// Auth: KHÔNG có (public read) — thumbnail là content marketing, không nhạy cảm.
// =============================================================================
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic"; // tránh prerender; mỗi request đọc KV.

const THUMB_PREFIX = "thumb:";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> },
): Promise<Response> {
  const { key } = await params;
  try {
    const ctx = getCloudflareContext({ async: false });
    const kv = ctx.env?.KE_PRESETS;
    if (!kv) return new Response("KV not bound", { status: 500 });
    const stream = await kv.get(THUMB_PREFIX + key, "stream");
    if (!stream) return new Response("Not found", { status: 404 });
    return new Response(stream, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return new Response(`Thumbnail error: ${msg}`, { status: 500 });
  }
}
