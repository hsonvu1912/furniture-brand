// =============================================================================
// PROBE — Giá / m² mặt đứng cho TẤT CẢ preset thật (kéo từ KV về /tmp/ke-pricing).
// Chạy đúng pipeline production: build() → computePrice() với catalog KV thật.
// Mục tiêu: định lượng "tủ nhỏ đắt hơn/m² mặt đứng" + phân rã NGUYÊN NHÂN.
//   node: tsx scripts/probe-price-per-m2.ts
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import tuKe from '../products/tu-ke/dna';
import { computePrice } from '../src/configurator/pricing';
import { mergeCatalog, catalogToPriceConfig, type ProductionCatalog } from '../src/lib/production-catalog';
import type { ParamValues, BuildResult } from '../src/configurator/types';

const DIR = '/tmp/ke-pricing';
const catalog = mergeCatalog(JSON.parse(fs.readFileSync(path.join(DIR, 'catalog.json'), 'utf8')) as Partial<ProductionCatalog>);
const priceConfig = catalogToPriceConfig(catalog);

interface Row {
  slug: string;
  name: string;
  w: number; h: number; d: number;
  cols: number; rows: number;
  frontM2: number;     // diện tích mặt đứng W×H (m²)
  volM3: number;       // thể tích W×H×D (m³)
  panelM2: number;     // tổng diện tích tấm RAW (chưa hao hụt)
  surfRatio: number;   // panelM2 / frontM2  ← tỉ lệ "tốn ván / mặt đứng"
  material: number;    // đã nhân hao hụt
  hardware: number;
  labor: number;
  margin: number;
  total: number;
  perM2: number;       // total / frontM2  ← HEADLINE
  waste: number;       // wasteMultiplier
  util: number;        // nesting util
  sheets: number;
  units: number;       // ngăn+cánh
}

const rows: Row[] = [];

for (const file of fs.readdirSync(path.join(DIR, 'presets')).sort()) {
  if (!file.endsWith('.json')) continue;
  const preset = JSON.parse(fs.readFileSync(path.join(DIR, 'presets', file), 'utf8'));
  const slug: string = preset.slug ?? file.replace('.json', '');
  const name: string = preset.name ?? slug;
  let values = preset.values as ParamValues;
  if (tuKe.normalizeValues) values = tuKe.normalizeValues({ ...values });
  let build: BuildResult;
  try {
    build = tuKe.build(values);
  } catch (e) {
    console.error(`  ⚠️ build lỗi ${slug}:`, (e as Error).message);
    continue;
  }
  const price = computePrice(build, priceConfig);
  const w = build.size?.w ?? Number(values.width);
  const h = build.size?.h ?? Number(values.height);
  const d = build.size?.d ?? Number(values.depth);
  const frontM2 = (w * h) / 1_000_000;
  const volM3 = (w * h * d) / 1_000_000_000;
  const panelM2 = build.parts.reduce((s, p) => s + (p.length_mm * p.width_mm / 1_000_000) * p.qty, 0);
  rows.push({
    slug, name, w, h, d,
    cols: Number(values.columns) || 0,
    rows: Number(values.rows) || 0,
    frontM2, volM3, panelM2,
    surfRatio: panelM2 / frontM2,
    material: price.materialCost,
    hardware: price.hardwareCost,
    labor: price.laborCost ?? 0,
    margin: price.margin,
    total: price.total,
    perM2: price.total / frontM2,
    waste: price.nestingCost?.wasteMultiplier ?? 0,
    util: price.nestingCost?.avgUtilization ?? 0,
    sheets: price.nestingCost?.numSheets ?? 0,
    units: (build.drawerCount ?? 0) + (build.doorCount ?? 0),
  });
}

// Sắp theo diện tích mặt đứng tăng dần (nhỏ → to)
rows.sort((a, b) => a.frontM2 - b.frontM2);

const vnd = (n: number) => Math.round(n).toLocaleString('vi-VN');
const pad = (s: string | number, n: number) => String(s).padStart(n);
const padR = (s: string | number, n: number) => String(s).padEnd(n);

console.log('\n════════════════════════════════════════════════════════════════════════════════════════════════════════');
console.log('  GIÁ / m² MẶT ĐỨNG — 19 preset thật (catalog KV production), sắp nhỏ→to');
console.log('════════════════════════════════════════════════════════════════════════════════════════════════════════');
console.log(
  padR('Preset', 26) + pad('W×H×D', 14) + pad('Mặt(m²)', 9) + pad('Giá', 12) +
  pad('Giá/m²', 11) + pad('Ván/Mặt', 9) + pad('Hao', 6) + pad('Margin', 8),
);
console.log('─'.repeat(104));
for (const r of rows) {
  console.log(
    padR(r.slug.slice(0, 25), 26) +
    pad(`${r.w}×${r.h}×${r.d}`, 14) +
    pad(r.frontM2.toFixed(2), 9) +
    pad(vnd(r.total), 12) +
    pad(vnd(r.perM2), 11) +
    pad(r.surfRatio.toFixed(2) + '×', 9) +
    pad('×' + r.waste.toFixed(2), 6) +
    pad(r.margin.toFixed(2), 8),
  );
}

// ── Phân rã: nhỏ nhất vs to nhất ──
const small = rows[0];
const big = rows[rows.length - 1];
console.log('\n════════════════════════════════════════════════════════════════════════════════════════════════════════');
console.log('  PHÂN RÃ: tủ NHỎ nhất vs TO nhất (giá/m² mặt đứng)');
console.log('════════════════════════════════════════════════════════════════════════════════════════════════════════');
const breakdown = (r: Row) => {
  const preMargin = r.material + r.hardware + r.labor;
  console.log(`\n  ${r.name}  [${r.w}×${r.h}×${r.d}, ${r.cols}×${r.rows}]`);
  console.log(`    Mặt đứng:        ${r.frontM2.toFixed(2)} m²   |  Thể tích: ${r.volM3.toFixed(2)} m³  |  Tổng tấm: ${r.panelM2.toFixed(2)} m²  (gấp ${r.surfRatio.toFixed(2)}× mặt đứng)`);
  console.log(`    Vật liệu (đã hao): ${pad(vnd(r.material), 12)}   → /m² mặt: ${pad(vnd(r.material / r.frontM2), 10)}`);
  console.log(`    Phụ kiện:          ${pad(vnd(r.hardware), 12)}   → /m² mặt: ${pad(vnd(r.hardware / r.frontM2), 10)}  (${r.units} ngăn+cánh)`);
  console.log(`    Nhân công cắt:     ${pad(vnd(r.labor), 12)}   → /m² mặt: ${pad(vnd(r.labor / r.frontM2), 10)}  (${r.sheets} tấm)`);
  console.log(`    ── Cộng trước lãi:  ${pad(vnd(preMargin), 12)}   → /m² mặt: ${pad(vnd(preMargin / r.frontM2), 10)}`);
  console.log(`    × Margin ${r.margin.toFixed(2)}      = ${pad(vnd(r.total), 12)}   → /m² mặt: ${pad(vnd(r.perM2), 10)}  ◄ HEADLINE`);
  return { preMargin };
};
breakdown(small);
breakdown(big);

console.log('\n════════════════════════════════════════════════════════════════════════════════════════════════════════');
console.log('  KẾT LUẬN ĐỊNH LƯỢNG');
console.log('════════════════════════════════════════════════════════════════════════════════════════════════════════');
const ratio = small.perM2 / big.perM2;
console.log(`  Giá/m² mặt — nhỏ nhất: ${vnd(small.perM2)}đ   |   to nhất: ${vnd(big.perM2)}đ   →  nhỏ đắt gấp ${ratio.toFixed(2)}×`);
console.log(`  Tỉ lệ "tốn ván/mặt đứng" — nhỏ: ${small.surfRatio.toFixed(2)}×   |   to: ${big.surfRatio.toFixed(2)}×   →  chênh ${(small.surfRatio / big.surfRatio).toFixed(2)}×`);
console.log(`  Margin — nhỏ: ${small.margin.toFixed(2)}   |   to: ${big.margin.toFixed(2)}   (margin tủ to CAO hơn → KHÔNG phải thủ phạm)`);

// Tương quan surfRatio vs perM2
const n = rows.length;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const xs = rows.map((r) => r.surfRatio), ys = rows.map((r) => r.perM2);
const mx = mean(xs), my = mean(ys);
let num = 0, dx = 0, dy = 0;
for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
const corr = num / Math.sqrt(dx * dy);
console.log(`  Tương quan (surfRatio ↔ giá/m²): r = ${corr.toFixed(3)}  (1.0 = surfRatio giải thích hoàn toàn)`);

// ════════════════════════════════════════════════════════════════════════════
//  VERIFY P67 — code MỚI (đã sửa pricing.ts). Đối soát bảng giá khớp tổng:
//    total == round( Σ(dòng chịu-lãi) × margin + Σ(dòng afterMargin) + côngĐơn )
//  + xác nhận "Hao hụt cắt ván" CHÍNH XÁC là dòng afterMargin (không nhân lãi).
//  Giá ở BẢNG TRÊN giờ ĐÃ là giá MỚI (computePrice đã đổi) → so với projection đã duyệt.
// ════════════════════════════════════════════════════════════════════════════
console.log('\n════════════════════════════════════════════════════════════════════════════════════════════════════════');
console.log('  VERIFY P67 — đối soát bảng giá MỚI (mọi tủ phải khớp tổng + hao hụt nằm sau margin)');
console.log('════════════════════════════════════════════════════════════════════════════════════════════════════════');
let allOk = true;
for (const file of fs.readdirSync(path.join(DIR, 'presets')).sort()) {
  if (!file.endsWith('.json')) continue;
  const preset = JSON.parse(fs.readFileSync(path.join(DIR, 'presets', file), 'utf8'));
  let values = preset.values as ParamValues;
  if (tuKe.normalizeValues) values = tuKe.normalizeValues({ ...values });
  const build = tuKe.build(values);
  const price = computePrice(build, priceConfig);
  // P69 — tổng quát: mỗi dòng × (lineMargin ?? margin khung). hao hụt lineMargin=1, phụ kiện 1.2.
  const recon = Math.round(
    price.lines.reduce((s, l) => s + l.amount * (l.lineMargin ?? price.margin), 0) + (price.laborPerOrder ?? 0),
  );
  const wasteLine = price.lines.find((l) => l.label === 'Hao hụt cắt ván');
  const wasteIsAfter = !wasteLine || wasteLine.lineMargin === 1;
  // sai số làm tròn: lines lưu Math.round từng dòng, total round 1 lần → cho phép lệch ±vài đ/tấm
  const reconOk = Math.abs(recon - price.total) <= price.lines.length + 2;
  const ok = reconOk && wasteIsAfter;
  if (!ok) allOk = false;
  console.log(`  ${ok ? '✓' : '✗ LỖI'}  ${padR(preset.slug.slice(0, 34), 35)} total=${pad(vnd(price.total), 12)}  recon=${pad(vnd(recon), 12)}  hao hụt sau margin: ${wasteIsAfter ? 'ĐÚNG' : 'SAI'}`);
}
console.log('\n  ' + (allOk ? '✅ TẤT CẢ 19 tủ khớp tổng + hao hụt cộng SAU margin (không ăn lãi). Đúng yêu cầu.' : '❌ CÓ LỖI — xem dòng ✗ ở trên.'));
console.log('');
