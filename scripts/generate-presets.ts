// =============================================================================
// generate-presets.ts — chạy build() + computePrice() + buildCutlist() cho mỗi
// preset, in ra console + xuất public/presets-index.json để runtime filter trên
// /collection đọc (chứa price/panels/weight đã precompute).
//
// Chạy: pnpm generate-presets
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { PRESETS } from '../products/tu-ke/presets';
import tuKe from '../products/tu-ke/dna';
import { computePrice, formatPrice } from '../src/configurator/pricing';
import { buildCutlist } from '../src/configurator/cutlist';

interface PresetIndexEntry {
  slug: string;
  name: string;
  description: string;
  category: string;
  accent: string;
  usecase: string;
  // Precomputed metrics
  price: number;
  priceFormatted: string;
  totalPanels: number;
  totalAreaM2: number;
  totalWeightKg: number;
  // Cấu hình tóm tắt (cho card display)
  width: number;
  height: number;
  depth: number;
  columns: number;
  rows: number;
}

function main() {
  const entries: PresetIndexEntry[] = [];
  let hasError = false;

  console.log(`Sinh ${PRESETS.length} preset:\n`);
  console.log('SLUG'.padEnd(10) + 'GIÁ'.padStart(14) + '  TẤM' + '  m²'.padStart(8) + '  kg'.padStart(8));
  console.log('─'.repeat(48));

  for (const preset of PRESETS) {
    try {
      // DNA bình thường sẽ normalize trước build; mirror trình tự đó.
      const normalized = tuKe.normalizeValues
        ? tuKe.normalizeValues(preset.values)
        : preset.values;
      const result = tuKe.build(normalized);
      const price = computePrice(result, tuKe.priceConfig);
      const cutlist = buildCutlist(result);

      if (cutlist.totalPanels === 0) throw new Error('cutlist rỗng');
      if (price.total <= 0) throw new Error(`giá ≤ 0 (${price.total})`);

      entries.push({
        slug: preset.slug,
        name: preset.name,
        description: preset.description,
        category: preset.category,
        accent: preset.accent,
        usecase: preset.usecase,
        price: price.total,
        priceFormatted: formatPrice(price.total),
        totalPanels: cutlist.totalPanels,
        totalAreaM2: Number(cutlist.totalAreaM2.toFixed(2)),
        totalWeightKg: Number((cutlist.totalWeightKg ?? 0).toFixed(1)),
        width: Number(preset.values.width),
        height: Number(preset.values.height),
        depth: Number(preset.values.depth),
        columns: Number(preset.values.columns),
        rows: Number(preset.values.rows),
      });

      console.log(
        preset.slug.padEnd(10) +
          formatPrice(price.total).padStart(14) +
          String(cutlist.totalPanels).padStart(5) +
          cutlist.totalAreaM2.toFixed(2).padStart(8) +
          (cutlist.totalWeightKg ?? 0).toFixed(1).padStart(8),
      );
    } catch (err) {
      hasError = true;
      console.error(`\n[FAIL] ${preset.slug}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log('\n');

  if (hasError) {
    console.error('CÓ LỖI ở 1+ preset. Bỏ qua xuất presets-index.json.');
    process.exit(1);
  }

  const outPath = path.join(process.cwd(), 'public', 'presets-index.json');
  fs.writeFileSync(outPath, JSON.stringify(entries, null, 2), 'utf8');
  console.log(`✓ Xuất ${outPath}`);
  console.log(`  ${entries.length} preset · tổng size ${JSON.stringify(entries).length} bytes`);
}

main();
