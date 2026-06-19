// =============================================================================
// verify-nesting-util.ts — CHỨNG MINH bằng số: util tổng (→ hao hụt) có dùng
// diện tích KHỔ ĐÃ CẮT (nửa ×0.5, tư ×0.25) ở mẫu số, theo tỷ lệ đúng không?
// Gọi thẳng nestBoards, in từng board (fraction + khổ cắt + phần dùng + util riêng),
// rồi so 2 mẫu số: "khổ đã cắt" (code dùng) vs "nếu mua nguyên tấm" (sai lầm tiềm ẩn).
// =============================================================================
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import tuKe from '../products/tu-ke/dna';
import { buildCutlist } from '../src/configurator/cutlist';
import { mergeCatalog, catalogToPriceConfig } from '../src/lib/production-catalog';
import { nestBoards } from '../src/lib/nesting';
import { computeNestingCost } from '../src/lib/nesting/cost';

const DIR = '/tmp/ke-export';
const catalog = mergeCatalog(JSON.parse(readFileSync(join(DIR, 'catalog.json'), 'utf8')));
const priceConfig = catalogToPriceConfig(catalog);
const boards = priceConfig.boards ?? [];
const KERF = priceConfig.kerfMm ?? 3;

// preset cần soi (đại diện có nửa + tư)
const slugs = ['ke-tv-2m4', 'tu-trang-tri-thap', 'tu-ngan-keo-4x4-2090x1090x400-kh9p'];

for (const slug of slugs) {
  const preset = JSON.parse(readFileSync(join(DIR, 'presets', `${slug}.json`), 'utf8'));
  const values = tuKe.normalizeValues ? tuKe.normalizeValues(preset.values) : preset.values;
  const build = tuKe.build(values);
  const cutlist = buildCutlist(build, priceConfig);
  const res = nestBoards(build.parts, boards, KERF);
  const cost = computeNestingCost(build.parts, boards, { kerfMm: KERF, minWasteMultiplier: priceConfig.wasteMultiplierMin });

  console.log(`\n========== ${preset.name}  (${slug}) ==========`);
  let cutArea = 0; // Σ diện tích khổ ĐÃ CẮT (m²)  ← code dùng
  let fullArea = 0; // Σ diện tích NẾU mua nguyên tấm (m²)  ← nếu không thu nhỏ
  let partArea = 0; // Σ diện tích phần dùng (m²)
  console.log('  #  fraction   khổ cắt (mm)      khổ cắt m²   phần dùng m²   util riêng');
  res.boards.forEach((b, i) => {
    const f = b.fraction ?? 1;
    const cut = (b.boardLength * b.boardWidth) / 1e6;
    const full = cut / f; // khổ nguyên = khổ cắt / fraction
    const used = b.placements.reduce((s, pl) => s + pl.partLength * pl.partWidth, 0) / 1e6;
    cutArea += cut;
    fullArea += full;
    partArea += used;
    const tag = f === 1 ? 'nguyên' : f === 0.5 ? 'NỬA ' : 'TƯ  ';
    console.log(
      `  ${String(i + 1).padStart(2)} ${tag} ${f.toFixed(2)}  ` +
        `${String(Math.round(b.boardLength)).padStart(5)}×${String(Math.round(b.boardWidth)).padStart(4)}   ` +
        `${cut.toFixed(3).padStart(8)}   ${used.toFixed(3).padStart(10)}   ${((used / cut) * 100).toFixed(1)}%`,
    );
  });
  const utilCut = partArea / cutArea; // = công thức code
  const utilFull = partArea / fullArea; // = nếu tính nguyên tấm (mẫu số to hơn → util thấp giả tạo)
  console.log('  ────────────────────────────────────────────────────────────────');
  console.log(`  Σ phần dùng           = ${partArea.toFixed(3)} m²   (cutlist tổng ${cutlist.totalAreaM2.toFixed(3)} m², lệch do trừ dán cạnh)`);
  console.log(`  Σ khổ ĐÃ CẮT (code)   = ${cutArea.toFixed(3)} m²  → util = ${(utilCut * 100).toFixed(1)}%  → hao hụt ×${(1 / utilCut).toFixed(3)}`);
  console.log(`  Σ NẾU mua nguyên tấm  = ${fullArea.toFixed(3)} m²  → util = ${(utilFull * 100).toFixed(1)}%  → hao hụt ×${(1 / utilFull).toFixed(3)}  (SAI nếu dùng cái này)`);
  console.log(`  avgUtilization (engine trả) = ${(cost.avgUtilization * 100).toFixed(1)}%   wasteMultiplier = ×${cost.wasteMultiplier.toFixed(3)}`);
  const match = Math.abs(cost.avgUtilization - utilCut) < 1e-9;
  console.log(`  → Engine khớp mẫu số "${match ? 'KHỔ ĐÃ CẮT' : '??'}"  ${match ? '✓ ĐÚNG (nửa ×0.5, tư ×0.25)' : '✗ SAI'}`);
  console.log(`  → laborSheets=${cost.laborSheets} | breakdown nguyên ${cost.boardBreakdown.full}·nửa ${cost.boardBreakdown.half}·tư ${cost.boardBreakdown.quarter}`);
}
