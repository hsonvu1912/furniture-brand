// =============================================================================
// generate-combinations.ts v2 — Sinh ~4500 cấu hình tủ Kê, mỗi cấu hình chạy
// nesting → derive wastePercent thực tế, sau đó tính 3 scenarios áp tiền công
// 100k/tấm (A/B/C) → xuất HTML report giúp founder chọn công thức pricing.
//
// MỤC TIÊU: trả lời 2 câu hỏi BUSINESS:
//   1. "Tiền công 100k/tấm nên áp vào giá thành thế nào để có LỢI NHẤT?"
//   2. "Hao hụt CNC cộng thế nào vào giá thành?" (data-driven từ nesting có sẵn)
//
// KHÔNG sửa pricing.ts hay dna.priceConfig của website — chỉ tầng phân tích.
//
// Chạy: pnpm generate-combos
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { encodeCellGrid } from '../src/configurator/cellgrid';
import tuKe from '../products/tu-ke/dna';
import { computePrice, formatPrice } from '../src/configurator/pricing';
import { buildCutlist } from '../src/configurator/cutlist';
import { nestBoards } from '../src/lib/nesting';
import type { CatalogBoard } from '../src/lib/production-catalog';
import type { ParamValues } from '../src/configurator/types';

// === BUSINESS CONSTANTS — chỉnh tại đây để fine-tune ========================
const CNC_PER_PANEL = 100_000;   // VND/tấm — xưởng báo (CNC + lắp + đóng gói)
const MARGIN = 1.6;              // hệ số nhân lãi chung
const MARGIN_LABOR_C = 1.2;      // hệ số markup cho gia công trong scenario C (balanced)
const LABOR_PER_ORDER = 300_000; // tiền công cố định/đơn (khớp dna.priceConfig hiện tại)
const KERF_MM = 3;               // đường cắt CNC (mm) — từ test-dxf.ts

// === MATERIAL REFERENCE — 1 loại duy nhất (kết quả về tỷ lệ độc lập material) ===
const MATERIAL_REF = {
  id: 'plywood_veneer/oak',
  catalog: 'plywood_veneer',
  label: 'Plywood veneer oak',
  ratePerM2: 560_000, // VND/m² ván (khớp pricing.ts MATERIAL_RATE_PER_M2.plywood_veneer[18])
};

// Ván stock (1220×2440mm) — chỉ giữ cho plywood_veneer 18mm + 9mm (đủ cho thân + hậu)
const SAMPLE_BOARDS: CatalogBoard[] = [
  { id: 'plywood-1220x2440-18', label: 'Plywood 1220×2440 18mm', materialId: 'plywood_veneer', lengthMm: 2440, widthMm: 1220, thicknessMm: 18 },
  { id: 'plywood-1220x2440-9', label: 'Plywood 1220×2440 9mm', materialId: 'plywood_veneer', lengthMm: 2440, widthMm: 1220, thicknessMm: 9 },
];

// === TECH CONSTANTS (từ dna.ts) =============================================
const T_DEFAULT = 18;   // độ dày thân (mm) cho plywood_veneer
const CELL_MIN = 150;   // thông thuỷ tối thiểu 1 ô (mm)

// === GRID SWEEP =============================================================
const WIDTHS = [800, 1200, 1600, 2000, 2400];
const HEIGHTS = [800, 1200, 1600, 2000, 2400];
const DEPTHS = [350, 450];
const COLUMNS = [1, 2, 3, 4, 5];
const ROWS = [1, 2, 3, 4, 5, 6];

// === TYPES ==================================================================
interface Combo {
  width: number;
  height: number;
  depth: number;
  columns: number;
  rows: number;
  totalPanels: number;
  netAreaM2: number;    // diện tích panel NET (đã cắt)
  utilization: number;  // 0..1 từ nesting
  wastePercent: number; // = (1 - utilization) * 100
  grossAreaM2: number;  // diện tích VÁN STOCK thực mua = netArea / utilization
  unplacedCount: number; // số panels không vừa khổ ván — flag nếu > 0
  // Costs (baseline)
  materialCostReal: number; // grossArea × rate (đã bù waste)
  hardwareCost: number;
  cncCost: number;          // 100k × totalPanels
  factoryCost: number;      // materialCostReal + hardwareCost + cncCost
  // 3 scenarios
  sellA: number; sellB: number; sellC: number;
  profitA: number; profitB: number; profitC: number;
  sellPerM2_A: number; sellPerM2_B: number; sellPerM2_C: number;
}

interface Stats {
  count: number;
  min: number;
  q1: number;
  median: number;
  mean: number;
  q3: number;
  max: number;
  stddev: number;
}

// === HELPERS ================================================================

function minTotal(n: number, T: number): number {
  return n * CELL_MIN + (n - 1) * T + 2 * T;
}

function generateCells(rows: number, cols: number): string {
  const grid: string[][] = [];
  for (let r = 0; r < rows; r++) {
    let type: string;
    if (rows === 1) type = 'open-back';
    else if (r === 0) type = 'drawer';
    else if (r === rows - 1) type = 'door';
    else type = 'open-back';
    grid.push(Array(cols).fill(type));
  }
  return encodeCellGrid(grid);
}

function generateCellColors(rows: number, cols: number): string {
  return encodeCellGrid(Array.from({ length: rows }, () => Array(cols).fill('frame')));
}

function computeCombo(w: number, h: number, d: number, cols: number, rows: number): Combo | null {
  if (w < minTotal(cols, T_DEFAULT)) return null;
  if (h < minTotal(rows, T_DEFAULT)) return null;

  const values: ParamValues = {
    width: w, height: h, depth: d, columns: cols, rows: rows,
    widthMode: 'even', heightMode: 'even',
    color: MATERIAL_REF.id,
    cells: generateCells(rows, cols),
    cellColors: generateCellColors(rows, cols),
  };

  try {
    const normalized = tuKe.normalizeValues ? tuKe.normalizeValues(values) : values;
    const build = tuKe.build(normalized);
    const cutlist = buildCutlist(build);
    if (cutlist.totalPanels === 0 || cutlist.totalAreaM2 <= 0) return null;

    // === NESTING — derive waste% data-driven ===
    const partsForNesting = cutlist.parts ?? [];
    const nesting = nestBoards(partsForNesting, SAMPLE_BOARDS, KERF_MM);
    // Fallback: nếu nesting fail (utilization = 0) hoặc parts unplaced → dùng 25% waste default
    const utilization = nesting.avgUtilization > 0 ? nesting.avgUtilization : 0.75;
    const wastePercent = (1 - utilization) * 100;
    const grossAreaM2 = cutlist.totalAreaM2 / utilization;

    // === COSTS ===
    const priceRaw = computePrice(build, { margin: 1, laborPerOrder: 0 });
    const materialCostReal = grossAreaM2 * MATERIAL_REF.ratePerM2;
    const hardwareCost = priceRaw.hardwareCost;
    const cncCost = CNC_PER_PANEL * cutlist.totalPanels;
    const factoryCost = materialCostReal + hardwareCost + cncCost;

    // === 3 SCENARIOS ===
    const sellA = Math.round((materialCostReal + hardwareCost) * MARGIN + cncCost + LABOR_PER_ORDER);
    const sellB = Math.round((materialCostReal + hardwareCost + cncCost) * MARGIN + LABOR_PER_ORDER);
    const sellC = Math.round((materialCostReal + hardwareCost) * MARGIN + cncCost * MARGIN_LABOR_C + LABOR_PER_ORDER);

    return {
      width: w, height: h, depth: d, columns: cols, rows: rows,
      totalPanels: cutlist.totalPanels,
      netAreaM2: Number(cutlist.totalAreaM2.toFixed(3)),
      utilization: Number(utilization.toFixed(4)),
      wastePercent: Number(wastePercent.toFixed(2)),
      grossAreaM2: Number(grossAreaM2.toFixed(3)),
      unplacedCount: nesting.unplaced.length,
      materialCostReal: Math.round(materialCostReal),
      hardwareCost: Math.round(hardwareCost),
      cncCost,
      factoryCost: Math.round(factoryCost),
      sellA, sellB, sellC,
      profitA: sellA - Math.round(factoryCost),
      profitB: sellB - Math.round(factoryCost),
      profitC: sellC - Math.round(factoryCost),
      sellPerM2_A: Math.round(sellA / grossAreaM2),
      sellPerM2_B: Math.round(sellB / grossAreaM2),
      sellPerM2_C: Math.round(sellC / grossAreaM2),
    };
  } catch {
    return null;
  }
}

function computeStats(values: number[]): Stats {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  const variance = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
  const pct = (p: number) => sorted[Math.min(Math.floor(p * n), n - 1)];
  return {
    count: n,
    min: sorted[0],
    q1: pct(0.25),
    median: pct(0.5),
    mean: Math.round(mean),
    q3: pct(0.75),
    max: sorted[n - 1],
    stddev: Math.round(Math.sqrt(variance)),
  };
}

function histogram(values: number[], bins: number): { labels: string[]; counts: number[] } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = (max - min) / bins;
  const counts = Array(bins).fill(0);
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / step), bins - 1);
    counts[idx]++;
  }
  const labels = counts.map((_, i) => (min + i * step).toFixed(1));
  return { labels, counts };
}

function histogramVND(values: number[], bins: number): { labels: string[]; counts: number[] } {
  const h = histogram(values, bins);
  return { labels: h.labels.map((l) => (Number(l) / 1_000_000).toFixed(2) + 'M'), counts: h.counts };
}

// === RECOMMENDATION LOGIC ===================================================

interface Recommendation {
  best: 'A' | 'B' | 'C';
  reason: string;
}

function recommend(profitA: Stats, profitB: Stats, profitC: Stats, sellA: Stats, sellB: Stats): Recommendation {
  // Logic đơn giản: B luôn lãi cao nhất tuyệt đối; recommend B unless giá B cao hơn A > 15%
  const sellRatio = (sellB.median - sellA.median) / sellA.median * 100;
  if (sellRatio > 15) {
    return {
      best: 'C',
      reason: `B đắt hơn A ${sellRatio.toFixed(1)}% (vượt ngưỡng 15% có thể mất volume). C cân bằng: lãi extra ${formatPrice(profitC.median - profitA.median)}/đơn vs A, chỉ đắt hơn ${((sellRatio * 0.5)).toFixed(1)}%.`,
    };
  }
  return {
    best: 'B',
    reason: `Sell/m² của B chỉ đắt hơn A ${sellRatio.toFixed(1)}% (≤ 15% — thị trường thường chấp nhận được). Lãi extra ${formatPrice(profitB.median - profitA.median)}/đơn = ${formatPrice((profitB.mean - profitA.mean) * profitA.count)} tổng dataset.`,
  };
}

// === RENDER HTML ============================================================

function renderHtml(combos: Combo[]): string {
  const wasteStats = computeStats(combos.map((c) => c.wastePercent));
  const utilStats = computeStats(combos.map((c) => c.utilization * 100));

  // Per scenario stats
  const sellA = computeStats(combos.map((c) => c.sellA));
  const sellB = computeStats(combos.map((c) => c.sellB));
  const sellC = computeStats(combos.map((c) => c.sellC));
  const profitA = computeStats(combos.map((c) => c.profitA));
  const profitB = computeStats(combos.map((c) => c.profitB));
  const profitC = computeStats(combos.map((c) => c.profitC));
  const sellPerM2A = computeStats(combos.map((c) => c.sellPerM2_A));
  const sellPerM2B = computeStats(combos.map((c) => c.sellPerM2_B));
  const sellPerM2C = computeStats(combos.map((c) => c.sellPerM2_C));

  const reco = recommend(profitA, profitB, profitC, sellA, sellB);
  const totalUnplaced = combos.reduce((sum, c) => sum + c.unplacedCount, 0);

  // Charts data
  const wasteHist = histogram(combos.map((c) => c.wastePercent), 25);
  const profitHistA = histogramVND(combos.map((c) => c.profitA), 25);
  const profitHistB = histogramVND(combos.map((c) => c.profitB), 25);
  const profitHistC = histogramVND(combos.map((c) => c.profitC), 25);

  // Top 5 profit theo scenario được recommend
  const sortedByBest = [...combos].sort((a, b) => (b[`profit${reco.best}`] as number) - (a[`profit${reco.best}`] as number));
  const top5 = sortedByBest.slice(0, 5);

  const recoColor = { A: '#888', B: '#C8421B', C: '#D89B3F' }[reco.best];

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>Tối ưu tiền công + hao hụt — tủ Kê (${combos.length} cấu hình)</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 1200px; margin: 0 auto; padding: 24px; color: #222; line-height: 1.5; background: #fafafa; }
  h1 { margin: 0 0 8px; font-size: 28px; }
  h2 { margin: 32px 0 12px; font-size: 20px; border-bottom: 2px solid #ddd; padding-bottom: 6px; }
  h3 { margin: 24px 0 8px; font-size: 16px; }
  .meta { color: #666; font-size: 14px; }
  .reco-final { background: linear-gradient(135deg, ${recoColor}15, ${recoColor}30); padding: 24px; border-radius: 12px; margin: 20px 0; border: 2px solid ${recoColor}; }
  .reco-final h2 { border: 0; margin-top: 0; }
  .reco-row { display: flex; gap: 16px; flex-wrap: wrap; margin: 16px 0; }
  .reco-card { background: white; padding: 16px 20px; border-radius: 8px; flex: 1; min-width: 240px; border: 1px solid #eee; }
  .reco-card.best { border: 2px solid ${recoColor}; box-shadow: 0 4px 12px ${recoColor}40; }
  .reco-label { font-size: 13px; color: #888; margin-bottom: 6px; text-transform: uppercase; font-weight: 600; }
  .reco-value { font-size: 24px; font-weight: 700; color: #1a1a1a; }
  .reco-sub { font-size: 13px; color: #666; margin-top: 8px; }
  .reco-note { background: white; padding: 14px 18px; border-radius: 8px; margin-top: 12px; border-left: 4px solid ${recoColor}; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
  th, td { padding: 8px 12px; text-align: right; font-size: 13px; }
  th { background: #f0f0f0; font-weight: 600; }
  td:first-child, th:first-child { text-align: left; }
  tr:hover { background: #f9f9f9; }
  .chart-wrap { background: white; padding: 16px; border-radius: 8px; margin: 12px 0; height: 380px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
  details { margin: 16px 0; }
  summary { cursor: pointer; padding: 12px; background: #eee; border-radius: 6px; font-weight: 600; }
  .formula { background: #f5f5f5; padding: 12px; border-radius: 6px; font-family: 'SF Mono', Menlo, monospace; font-size: 13px; line-height: 1.7; white-space: pre-wrap; }
  .scenario-A { color: #888; }
  .scenario-B { color: #C8421B; font-weight: 600; }
  .scenario-C { color: #D89B3F; }
  .warn { background: #FFEDED; border: 1px solid #FFB8B8; padding: 12px; border-radius: 6px; color: #A02020; margin: 12px 0; }
</style>
</head>
<body>

<h1>💰 Tối ưu tiền công + hao hụt — tủ Kê</h1>
<div class="meta">
  ${combos.length.toLocaleString('vi-VN')} cấu hình | 1 vật liệu (${MATERIAL_REF.label}, ${formatPrice(MATERIAL_REF.ratePerM2)}/m² ván)
  | Nesting MVP (Guillotine FFD), kerf ${KERF_MM}mm, ván stock 1220×2440
  | Hằng số: <code>CNC_PER_PANEL=${CNC_PER_PANEL.toLocaleString('vi-VN')}₫</code> · <code>MARGIN=${MARGIN}</code> · <code>MARGIN_LABOR_C=${MARGIN_LABOR_C}</code> · <code>LABOR=${LABOR_PER_ORDER.toLocaleString('vi-VN')}₫/đơn</code>
</div>

${totalUnplaced > 0 ? `<div class="warn">⚠ Có ${totalUnplaced} tấm KHÔNG VỪA khổ ván 1220×2440 trong toàn dataset (tấm to hơn ván stock). Đã skip combo đó hoặc waste = default 25%.</div>` : ''}

<div class="reco-final">
  <h2>🎯 KHUYẾN NGHỊ: dùng Scenario <span style="color:${recoColor}">${reco.best}</span></h2>
  <div class="reco-note">${reco.reason}</div>
  <div class="reco-row">
    <div class="reco-card ${reco.best === 'A' ? 'best' : ''}">
      <div class="reco-label" style="color: #888;">SCENARIO A — Conservative</div>
      <div class="reco-sub" style="margin-top:4px;">100k/tấm cộng SAU margin (KHÔNG markup gia công)</div>
      <hr style="margin: 12px 0; border: none; border-top: 1px solid #eee;">
      <div class="reco-label">Sell/m² ván median</div>
      <div class="reco-value">${formatPrice(sellPerM2A.median)}</div>
      <div class="reco-sub">Profit/đơn median: <strong>${formatPrice(profitA.median)}</strong></div>
    </div>
    <div class="reco-card ${reco.best === 'B' ? 'best' : ''}">
      <div class="reco-label" style="color: #C8421B;">SCENARIO B — Aggressive</div>
      <div class="reco-sub" style="margin-top:4px;">100k/tấm cộng TRƯỚC margin (markup 1.6× full)</div>
      <hr style="margin: 12px 0; border: none; border-top: 1px solid #eee;">
      <div class="reco-label">Sell/m² ván median</div>
      <div class="reco-value" style="color: #C8421B;">${formatPrice(sellPerM2B.median)}</div>
      <div class="reco-sub">Profit/đơn median: <strong>${formatPrice(profitB.median)}</strong> (+${formatPrice(profitB.median - profitA.median)} vs A)</div>
    </div>
    <div class="reco-card ${reco.best === 'C' ? 'best' : ''}">
      <div class="reco-label" style="color: #D89B3F;">SCENARIO C — Balanced</div>
      <div class="reco-sub" style="margin-top:4px;">100k/tấm × ${MARGIN_LABOR_C} (markup nhỏ trên gia công)</div>
      <hr style="margin: 12px 0; border: none; border-top: 1px solid #eee;">
      <div class="reco-label">Sell/m² ván median</div>
      <div class="reco-value" style="color: #D89B3F;">${formatPrice(sellPerM2C.median)}</div>
      <div class="reco-sub">Profit/đơn median: <strong>${formatPrice(profitC.median)}</strong> (+${formatPrice(profitC.median - profitA.median)} vs A)</div>
    </div>
  </div>
</div>

<h2>📉 Hao hụt nesting (data-driven từ project)</h2>
<table>
  <thead><tr><th>Chỉ số</th><th>Min</th><th>Q1</th><th>Median</th><th>Mean</th><th>Q3</th><th>Max</th></tr></thead>
  <tbody>
    <tr><td><strong>Utilization (%)</strong></td><td>${utilStats.min.toFixed(1)}%</td><td>${utilStats.q1.toFixed(1)}%</td><td><strong>${utilStats.median.toFixed(1)}%</strong></td><td>${utilStats.mean.toFixed(1)}%</td><td>${utilStats.q3.toFixed(1)}%</td><td>${utilStats.max.toFixed(1)}%</td></tr>
    <tr><td><strong>Hao hụt (%)</strong></td><td>${wasteStats.min.toFixed(1)}%</td><td>${wasteStats.q1.toFixed(1)}%</td><td><strong>${wasteStats.median.toFixed(1)}%</strong></td><td>${wasteStats.mean.toFixed(1)}%</td><td>${wasteStats.q3.toFixed(1)}%</td><td>${wasteStats.max.toFixed(1)}%</td></tr>
  </tbody>
</table>
<div class="meta" style="margin: 8px 0;">
  → Bạn phải mua ván nhiều hơn diện tích panel <strong>${(100/utilStats.median*100 - 100).toFixed(0)}%</strong> để bù waste. Vd panel cần 5m² → mua ~${(5 / (utilStats.median/100)).toFixed(1)}m² ván stock.
  ${utilStats.median < 60 ? `<br>⚠ Utilization median ${utilStats.median.toFixed(0)}% là MVP — nesting heuristic FFD có thể tối ưu hơn trong tương lai để giảm waste.` : ''}
</div>
<div class="chart-wrap"><canvas id="wasteChart"></canvas></div>

<h2>📐 Công thức 3 scenarios</h2>
<div class="formula">factoryCost = materialCostReal + hardwareCost + cncCost
              = (netArea / utilization) × ${formatPrice(MATERIAL_REF.ratePerM2)} + hardwareCost + ${formatPrice(CNC_PER_PANEL)} × totalPanels

<span class="scenario-A">A — Conservative:  sellA = (materialCostReal + hardwareCost) × ${MARGIN} + cncCost + ${formatPrice(LABOR_PER_ORDER)}</span>
<span class="scenario-B">B — Aggressive:   sellB = (materialCostReal + hardwareCost + cncCost) × ${MARGIN} + ${formatPrice(LABOR_PER_ORDER)}</span>
<span class="scenario-C">C — Balanced:     sellC = (materialCostReal + hardwareCost) × ${MARGIN} + cncCost × ${MARGIN_LABOR_C} + ${formatPrice(LABOR_PER_ORDER)}</span></div>

<h2>📊 So sánh 3 scenarios</h2>
<table>
  <thead><tr><th>Chỉ số</th><th class="scenario-A">A (Conservative)</th><th class="scenario-B">B (Aggressive)</th><th class="scenario-C">C (Balanced)</th></tr></thead>
  <tbody>
    <tr><td>Median sell/m² ván stock</td><td>${formatPrice(sellPerM2A.median)}</td><td><strong>${formatPrice(sellPerM2B.median)}</strong></td><td>${formatPrice(sellPerM2C.median)}</td></tr>
    <tr><td>Median sell/đơn</td><td>${formatPrice(sellA.median)}</td><td><strong>${formatPrice(sellB.median)}</strong></td><td>${formatPrice(sellC.median)}</td></tr>
    <tr><td>Median profit/đơn</td><td>${formatPrice(profitA.median)}</td><td><strong>${formatPrice(profitB.median)}</strong></td><td>${formatPrice(profitC.median)}</td></tr>
    <tr><td>Mean profit/đơn</td><td>${formatPrice(profitA.mean)}</td><td><strong>${formatPrice(profitB.mean)}</strong></td><td>${formatPrice(profitC.mean)}</td></tr>
    <tr><td>Profit extra vs A (median)</td><td>—</td><td><strong>+${formatPrice(profitB.median - profitA.median)}</strong></td><td>+${formatPrice(profitC.median - profitA.median)}</td></tr>
    <tr><td>Sell đắt hơn A (%)</td><td>—</td><td><strong>+${((sellB.median - sellA.median) / sellA.median * 100).toFixed(1)}%</strong></td><td>+${((sellC.median - sellA.median) / sellA.median * 100).toFixed(1)}%</td></tr>
  </tbody>
</table>

<div class="chart-wrap"><canvas id="profitBarChart"></canvas></div>

<h2>📈 Phân bố profit/đơn theo 3 scenarios</h2>
<div class="chart-wrap"><canvas id="profitHistChart"></canvas></div>

<h2>🏆 Top 5 cấu hình profit cao nhất (theo scenario ${reco.best})</h2>
<table>
  <thead><tr>
    <th>#</th><th>WxHxD</th><th>cols×rows</th><th>Tấm</th>
    <th>Net m²</th><th>Util%</th><th>Gross m²</th>
    <th>Factory cost</th><th>Sell ${reco.best}</th><th><strong>Profit ${reco.best}</strong></th>
  </tr></thead>
  <tbody>
    ${top5.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${c.width}×${c.height}×${c.depth}</td>
      <td>${c.columns}×${c.rows}</td>
      <td>${c.totalPanels}</td>
      <td>${c.netAreaM2.toFixed(2)}</td>
      <td>${(c.utilization * 100).toFixed(0)}%</td>
      <td>${c.grossAreaM2.toFixed(2)}</td>
      <td>${formatPrice(c.factoryCost)}</td>
      <td>${formatPrice(c[`sell${reco.best}`] as number)}</td>
      <td><strong>${formatPrice(c[`profit${reco.best}`] as number)}</strong></td>
    </tr>`).join('')}
  </tbody>
</table>

<details>
  <summary>Bảng đầy đủ — ${combos.length.toLocaleString('vi-VN')} cấu hình</summary>
  <table id="fullTable">
    <thead><tr>
      <th data-sort="num">W</th><th data-sort="num">H</th><th data-sort="num">D</th>
      <th data-sort="num">cols</th><th data-sort="num">rows</th>
      <th data-sort="num">Tấm</th>
      <th data-sort="num">Net m²</th><th data-sort="num">Util%</th><th data-sort="num">Gross m²</th>
      <th data-sort="num">Vốn</th>
      <th data-sort="num" class="scenario-A">Sell A</th>
      <th data-sort="num" class="scenario-B">Sell B</th>
      <th data-sort="num" class="scenario-C">Sell C</th>
      <th data-sort="num" class="scenario-A">Profit A</th>
      <th data-sort="num" class="scenario-B">Profit B</th>
      <th data-sort="num" class="scenario-C">Profit C</th>
    </tr></thead>
    <tbody>
      ${combos.map((c) => `<tr>
        <td>${c.width}</td><td>${c.height}</td><td>${c.depth}</td>
        <td>${c.columns}</td><td>${c.rows}</td>
        <td>${c.totalPanels}</td>
        <td>${c.netAreaM2.toFixed(2)}</td>
        <td>${(c.utilization * 100).toFixed(0)}%</td>
        <td>${c.grossAreaM2.toFixed(2)}</td>
        <td>${c.factoryCost.toLocaleString('vi-VN')}</td>
        <td class="scenario-A">${c.sellA.toLocaleString('vi-VN')}</td>
        <td class="scenario-B">${c.sellB.toLocaleString('vi-VN')}</td>
        <td class="scenario-C">${c.sellC.toLocaleString('vi-VN')}</td>
        <td class="scenario-A">${c.profitA.toLocaleString('vi-VN')}</td>
        <td class="scenario-B">${c.profitB.toLocaleString('vi-VN')}</td>
        <td class="scenario-C">${c.profitC.toLocaleString('vi-VN')}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</details>

<script>
const wasteHist = ${JSON.stringify(wasteHist)};
new Chart(document.getElementById('wasteChart'), {
  type: 'bar',
  data: { labels: wasteHist.labels.map(l => l + '%'), datasets: [{ label: 'Số cấu hình', data: wasteHist.counts, backgroundColor: '#F5A088', borderColor: '#C8421B', borderWidth: 1 }] },
  options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Phân bố hao hụt nesting (%)' } } }
});

// Bar chart 3 scenarios profit median + mean
new Chart(document.getElementById('profitBarChart'), {
  type: 'bar',
  data: {
    labels: ['Median profit/đơn', 'Mean profit/đơn'],
    datasets: [
      { label: 'A — Conservative', data: [${profitA.median}, ${profitA.mean}], backgroundColor: '#888' },
      { label: 'B — Aggressive', data: [${profitB.median}, ${profitB.mean}], backgroundColor: '#C8421B' },
      { label: 'C — Balanced', data: [${profitC.median}, ${profitC.mean}], backgroundColor: '#D89B3F' }
    ]
  },
  options: { responsive: true, maintainAspectRatio: false,
    plugins: { title: { display: true, text: 'Profit/đơn — 3 scenarios so sánh' } },
    scales: { y: { ticks: { callback: v => (v/1_000_000).toFixed(1) + 'M' } } }
  }
});

// Histogram 3 scenarios profit (overlay)
const histA = ${JSON.stringify(profitHistA)};
const histB = ${JSON.stringify(profitHistB)};
const histC = ${JSON.stringify(profitHistC)};
new Chart(document.getElementById('profitHistChart'), {
  type: 'line',
  data: {
    labels: histB.labels,
    datasets: [
      { label: 'A', data: histA.counts, borderColor: '#888', backgroundColor: '#88888830', fill: true },
      { label: 'B', data: histB.counts, borderColor: '#C8421B', backgroundColor: '#C8421B30', fill: true },
      { label: 'C', data: histC.counts, borderColor: '#D89B3F', backgroundColor: '#D89B3F30', fill: true }
    ]
  },
  options: { responsive: true, maintainAspectRatio: false,
    plugins: { title: { display: true, text: 'Phân bố profit/đơn — 3 scenarios overlay' } },
    scales: { y: { beginAtZero: true, title: { display: true, text: 'Số cấu hình' } },
              x: { title: { display: true, text: 'Profit/đơn (triệu VND)' } } }
  }
});

// Sort
document.querySelectorAll('#fullTable th[data-sort]').forEach((th, idx) => {
  let asc = true;
  th.style.cursor = 'pointer';
  th.addEventListener('click', () => {
    const tbody = document.querySelector('#fullTable tbody');
    const rows = [...tbody.querySelectorAll('tr')];
    const type = th.dataset.sort;
    rows.sort((a, b) => {
      const av = a.children[idx].textContent.replace(/[.,%]/g, '').trim();
      const bv = b.children[idx].textContent.replace(/[.,%]/g, '').trim();
      if (type === 'num') return asc ? (+av - +bv) : (+bv - +av);
      return asc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    asc = !asc;
    rows.forEach(r => tbody.appendChild(r));
  });
});
</script>

</body>
</html>`;
}

// === MAIN ===================================================================

function main() {
  const totalRaw = WIDTHS.length * HEIGHTS.length * DEPTHS.length * COLUMNS.length * ROWS.length;
  console.log(`Generating up to ${totalRaw.toLocaleString('vi-VN')} combinations (1 material: ${MATERIAL_REF.label})...`);
  console.log('(Nesting làm chậm hơn v1 — ước ~10-30s tùy số combos)\n');

  const combos: Combo[] = [];
  let processed = 0;
  let invalid = 0;
  const startTime = Date.now();

  for (const w of WIDTHS) {
    for (const h of HEIGHTS) {
      for (const d of DEPTHS) {
        for (const cols of COLUMNS) {
          for (const rows of ROWS) {
            processed++;
            const combo = computeCombo(w, h, d, cols, rows);
            if (combo) combos.push(combo);
            else invalid++;
            if (processed % 250 === 0) {
              const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
              console.log(`  [${processed}/${totalRaw}] processed (${invalid} invalid, ${combos.length} valid) — ${elapsed}s`);
            }
          }
        }
      }
    }
  }

  const elapsedMs = Date.now() - startTime;
  console.log(`\n✓ ${combos.length.toLocaleString('vi-VN')} valid combinations (${invalid} invalid skipped) in ${(elapsedMs / 1000).toFixed(1)}s`);

  if (combos.length === 0) {
    console.error('ERROR: 0 valid combinations.');
    process.exit(1);
  }

  const outDir = path.join(process.cwd(), 'out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const html = renderHtml(combos);
  const outPath = path.join(outDir, 'combinations-report.html');
  fs.writeFileSync(outPath, html, 'utf8');
  const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`✓ ${outPath} written (${sizeKB} KB)`);

  // Console summary
  const wasteStats = computeStats(combos.map((c) => c.wastePercent));
  const utilStats = computeStats(combos.map((c) => c.utilization * 100));
  const sellA = computeStats(combos.map((c) => c.sellA));
  const sellB = computeStats(combos.map((c) => c.sellB));
  const profitA = computeStats(combos.map((c) => c.profitA));
  const profitB = computeStats(combos.map((c) => c.profitB));
  const profitC = computeStats(combos.map((c) => c.profitC));
  const sellPerM2A = computeStats(combos.map((c) => c.sellPerM2_A));
  const sellPerM2B = computeStats(combos.map((c) => c.sellPerM2_B));
  const sellPerM2C = computeStats(combos.map((c) => c.sellPerM2_C));
  const reco = recommend(profitA, profitB, profitC, sellA, sellB);
  const totalUnplaced = combos.reduce((sum, c) => sum + c.unplacedCount, 0);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  KHUYẾN NGHỊ ÁP TIỀN CÔNG 100k/TẤM');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Hao hụt nesting median:  ${wasteStats.median.toFixed(1)}% (utilization ${utilStats.median.toFixed(1)}%)`);
  if (totalUnplaced > 0) console.log(`  ⚠ ${totalUnplaced} tấm không vừa khổ ván 1220×2440 trong toàn dataset`);
  console.log('');
  console.log(`  Scenario A (Conservative):  sell/m²ván ${formatPrice(sellPerM2A.median)} · profit ${formatPrice(profitA.median)}/đơn`);
  console.log(`  Scenario B (Aggressive):    sell/m²ván ${formatPrice(sellPerM2B.median)} · profit ${formatPrice(profitB.median)}/đơn  ← lãi tuyệt đối max`);
  console.log(`  Scenario C (Balanced):      sell/m²ván ${formatPrice(sellPerM2C.median)} · profit ${formatPrice(profitC.median)}/đơn`);
  console.log('');
  console.log(`  → KHUYẾN NGHỊ: ${reco.best}`);
  console.log(`    ${reco.reason}`);
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Mở report: open ${outPath}\n`);
}

main();
