// =============================================================================
// presets-store — KV + fallback adapter cho preset data.
//
// Pattern: thử KV trước, rỗng/lỗi → fallback PRESETS built-in (5 mẫu seed).
// Lý do: launch an toàn (KV chưa seed → site vẫn chạy), và sau khi admin thêm
// preset qua KV.put() thì frontend đọc luôn — không cần redeploy code.
//
// KV layout (Option A): 1 key per preset, prefix `preset:` để KV.list() lọc.
// Key:   preset:<slug>
// Value: JSON.stringify(Preset)
// =============================================================================
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PRESETS, type Preset } from "../../products/tu-ke/presets";

const KV_PREFIX = "preset:";

/** Đọc env CF từ runtime context. Trả undefined nếu chạy ngoài Workers (build time). */
function getKV(): KVNamespace | undefined {
  try {
    const ctx = getCloudflareContext({ async: false });
    return ctx.env?.KE_PRESETS;
  } catch {
    return undefined;
  }
}

/** Đọc tất cả preset từ KV; nếu KV rỗng/không khả dụng → fallback PRESETS built-in. */
export async function listPresets(): Promise<Preset[]> {
  const kv = getKV();
  if (!kv) return PRESETS;

  const { keys } = await kv.list({ prefix: KV_PREFIX });
  if (keys.length === 0) return PRESETS;

  const values = await Promise.all(keys.map((k) => kv.get<Preset>(k.name, "json")));
  const presets = values.filter((v): v is Preset => v !== null);
  return presets.length > 0 ? presets : PRESETS;
}

/** Tìm preset theo slug; KV miss → fallback array built-in. */
export async function findPreset(slug: string | undefined): Promise<Preset | undefined> {
  if (!slug) return undefined;
  const kv = getKV();
  if (kv) {
    const preset = await kv.get<Preset>(KV_PREFIX + slug, "json");
    if (preset) return preset;
  }
  return PRESETS.find((p) => p.slug === slug);
}
