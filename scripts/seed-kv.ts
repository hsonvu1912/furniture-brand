// =============================================================================
// seed-kv — push 5 preset built-in lên Cloudflare KV namespace ke-presets.
//
// Workflow:
//   1. Đọc PRESETS từ products/tu-ke/presets.ts
//   2. Emit bulk JSON [{ key, value }, ...] vào file tạm
//   3. Gọi `wrangler kv bulk put --remote` để put 1 round-trip
//   4. Cleanup file tạm
//
// Chạy: pnpm seed-kv
// Idempotent: chạy lại sẽ overwrite preset cùng slug (KV.put behavior).
// =============================================================================
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { PRESETS } from "../products/tu-ke/presets";

const KV_PREFIX = "preset:";
const TMP_FILE = join(process.cwd(), ".tmp-kv-bulk.json");

const entries = PRESETS.map((preset) => ({
  key: KV_PREFIX + preset.slug,
  value: JSON.stringify(preset),
}));

console.log(`Seeding ${entries.length} presets vào KV ke-presets...`);
writeFileSync(TMP_FILE, JSON.stringify(entries));

try {
  execFileSync(
    "npx",
    ["wrangler", "kv", "bulk", "put", TMP_FILE, "--binding", "KE_PRESETS", "--remote"],
    { stdio: "inherit" },
  );
  console.log("\n✅ Seed xong. Verify: npx wrangler kv key list --binding KE_PRESETS --remote");
} finally {
  unlinkSync(TMP_FILE);
}
