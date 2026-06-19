// VERIFY P69 — computePrice MỚI: phụ kiện nhân hardwareMargin (1.2), không nhân margin khung.
// Đối soát: total == round( Σ(line.amount × (lineMargin ?? marginKhung)) + côngĐơn ).
// + phụ kiện có lineMargin=1.2 · hao hụt lineMargin=1. So với projection đã duyệt.
// tsx scripts/probe-hardware-margin.ts
import fs from 'node:fs';
import path from 'node:path';
import tuKe from '../products/tu-ke/dna';
import { computePrice } from '../src/configurator/pricing';
import { mergeCatalog, catalogToPriceConfig, type ProductionCatalog } from '../src/lib/production-catalog';
import type { ParamValues } from '../src/configurator/types';

const DIR = '/tmp/ke-pricing';
const catalog = mergeCatalog(JSON.parse(fs.readFileSync(path.join(DIR, 'catalog.json'), 'utf8')) as Partial<ProductionCatalog>);
const priceConfig = catalogToPriceConfig(catalog);
const vnd = (n: number) => Math.round(n).toLocaleString('vi-VN');
const padR = (s: string | number, n: number) => String(s).padEnd(n);
const padL = (s: string | number, n: number) => String(s).padStart(n);

// Giá MỚI kỳ vọng (projection đã duyệt) — kiểm vài mốc.
const EXPECT: Record<string, number> = {
  'tu-ngan-keo-4x4-2090x1090x400-kh9p': 17_359_783,
  'tu-trang-tri-cao': 25_870_464,
  'tu-sach-dung': 16_020_366,
  'tu-dau-giuong-2x2-555x454x450-x8cc': 2_575_436,
};

console.log('\n  VERIFY P69 — phụ kiện ×1.2, đối soát total + so projection');
console.log('  ' + '─'.repeat(90));
let allOk = true;
for (const file of fs.readdirSync(path.join(DIR, 'presets')).sort()) {
  if (!file.endsWith('.json')) continue;
  const preset = JSON.parse(fs.readFileSync(path.join(DIR, 'presets', file), 'utf8'));
  let values = preset.values as ParamValues;
  if (tuKe.normalizeValues) values = tuKe.normalizeValues({ ...values });
  const price = computePrice(tuKe.build(values), priceConfig);
  // Đối soát: mỗi dòng × (lineMargin ?? margin khung)
  const recon = Math.round(
    price.lines.reduce((s, l) => s + l.amount * (l.lineMargin ?? price.margin), 0) + (price.laborPerOrder ?? 0),
  );
  const reconOk = Math.abs(recon - price.total) <= price.lines.length + 2;
  const hwLines = price.lines.filter((l) => ['Bản lề giảm chấn', 'Ray ngăn kéo (bộ)', 'Chân tủ', 'Tay nắm tròn (khoét lỗ Ø35)', 'Tay nắm strip đen (Nam Khang edge profile)', 'Tay nắm bar đen (profile L, căn giữa)'].includes(l.label) || /tay nắm|bản lề|ray|chân/i.test(l.label));
  const hwMarginOk = hwLines.every((l) => l.lineMargin === (price.hardwareMargin ?? 1.2));
  const wasteLine = price.lines.find((l) => l.label === 'Hao hụt cắt ván');
  const wasteOk = !wasteLine || wasteLine.lineMargin === 1;
  const exp = EXPECT[preset.slug];
  const expOk = exp === undefined || Math.abs(price.total - exp) <= 3;
  const ok = reconOk && hwMarginOk && wasteOk && expOk;
  if (!ok) allOk = false;
  const expStr = exp !== undefined ? `  kỳ vọng ${vnd(exp)} ${expOk ? '✓' : '✗'}` : '';
  console.log(`  ${ok ? '✓' : '✗ LỖI'} ${padR(preset.slug.slice(0, 34), 35)} total=${padL(vnd(price.total), 12)} recon=${padL(vnd(recon), 12)} hw×${price.hardwareMargin}${expStr}`);
}
console.log('\n  ' + (allOk ? '✅ ĐẠT — total khớp Σ(dòng×lãi-riêng) · phụ kiện ×1.2 · hao hụt giá vốn · khớp projection.' : '❌ CÓ LỖI'));
console.log('');
