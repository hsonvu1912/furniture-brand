// =============================================================================
// Offcut + batch nesting simulation v3 — comprehensive HTML dashboard.
// All sections visualized: KPIs, multi-seed variance, pool evolution, saved chart,
// top 10 SVG layouts, per-batch table, warm-up split, color distribution.
// =============================================================================
import fs from 'fs';
import tuKe from '../products/tu-ke/dna';
import { encodeCellGrid } from '../src/configurator/cellgrid';
import { nestBoards } from '../src/lib/nesting';
import { nestWithOffcutPool, type OffcutSheet } from '../src/lib/nesting/with-offcuts';
import type { CatalogBoard } from '../src/lib/production-catalog';
import type { ParamValues, Part } from '../src/configurator/types';
import type { NestedBoardLayout } from '../src/lib/dxf/types';

// --- CONFIG ---
const N_ORDERS = 1000;
const SEEDS = [42, 123, 999, 2025, 7777];
const BATCH_SIZES = [7, 14, 30];
const MIN_OFFCUT_DIM = 100;
const AGE_LIMIT = 30;
const KERF_MM = 3;
const SAME_FRAME_PROB = 0.7;
const WARMUP_ORDERS = 50;
const CANCEL_RATE = 0.05;
const DAMAGE_RATE = 0.03;
const STORAGE_COST_VND_PER_M2_MONTH = 10_000;
const COST_PER_M2 = 261_000;

const COLORS = [
  { id: 'mfc_melamine/ml_xanh_navy_edge_den', weight: 60, hex: '#1e3a5f', name: 'xanh navy' },
  { id: 'mfc_melamine/ml_den_espresso_edge_den', weight: 25, hex: '#2a2018', name: 'đen espresso' },
  { id: 'mfc_melamine/ml_xam_am_edge_den', weight: 10, hex: '#8a8580', name: 'xám ấm' },
  { id: 'mfc_melamine/ml_xanh_reu_edge_den', weight: 3, hex: '#5a6b3f', name: 'xanh rêu' },
  { id: 'mfc_melamine/ml_caramel_edge_den', weight: 2, hex: '#9c6f3a', name: 'caramel' },
];
const COLOR_TOTAL = COLORS.reduce((s, c) => s + c.weight, 0);
const COLOR_BY_ID = new Map(COLORS.map((c) => [c.id, c]));

const STOCK_BOARDS: CatalogBoard[] = [
  { id: 'mfc-18', label: 'MFC 1220×2440 18mm', materialId: 'mfc_melamine', lengthMm: 2440, widthMm: 1220, thicknessMm: 18 },
  { id: 'mfc-9', label: 'MFC 1220×2440 9mm', materialId: 'mfc_melamine', lengthMm: 2440, widthMm: 1220, thicknessMm: 9 },
];

// --- Random ---
function makeRng(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pickWeightedColor(rng: () => number): string {
  const r = rng() * COLOR_TOTAL;
  let acc = 0;
  for (const c of COLORS) { acc += c.weight; if (r < acc) return c.id; }
  return COLORS[COLORS.length - 1].id;
}

// --- Order generator ---
const CELL_TYPES = ['door', 'door', 'open-back', 'open-back', 'open-back', 'drawer'];
function randomOrder(rng: () => number): ParamValues {
  const columns = Math.floor(rng() * 4) + 2;
  const rows = Math.floor(rng() * 5) + 2;
  const frameColor = pickWeightedColor(rng);
  const cellsGrid: string[][] = [];
  const cellColorsGrid: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const cRow: string[] = []; const ccRow: string[] = [];
    for (let c = 0; c < columns; c++) {
      cRow.push(CELL_TYPES[Math.floor(rng() * CELL_TYPES.length)]);
      if (rng() < SAME_FRAME_PROB) ccRow.push('frame');
      else { const others = COLORS.filter((x) => x.id !== frameColor); ccRow.push(others[Math.floor(rng() * others.length)].id); }
    }
    cellsGrid.push(cRow); cellColorsGrid.push(ccRow);
  }
  return {
    width: Math.floor(rng() * 1601) + 800, height: Math.floor(rng() * 1701) + 700, depth: Math.floor(rng() * 301) + 300,
    columns, rows, widthMode: 'even', heightMode: 'even', color: frameColor,
    cells: encodeCellGrid(cellsGrid), cellColors: encodeCellGrid(cellColorsGrid),
  };
}

// --- Helpers ---
const SHEET_AREA_M2 = (2440 * 1220) / 1_000_000;
function sumPartArea(parts: Part[]): number { return parts.reduce((s, p) => s + (p.length_mm * p.width_mm) / 1_000_000, 0); }
function avg(arr: number[]): number { return arr.reduce((s, v) => s + v, 0) / arr.length; }
function std(arr: number[]): number { const m = avg(arr); return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length); }

interface OrderData { values: ParamValues; parts: Part[]; frameColor: string; cancelled: boolean }

interface BatchDetail {
  batchIdx: number;
  orderRange: [number, number]; // [startIdx, endIdx]
  totalParts: number;
  stockBoards: NestedBoardLayout[]; // ván cốt mới mua
  offcutBoards: NestedBoardLayout[]; // ván dư đã reuse
  reusedAreaM2: number;
  stockAreaM2: number;
  wastePct: number;
  poolBefore: number;
  poolAfter: number;
}

interface SimResult {
  stockSheets: number;
  stockAreaM2: number;
  partsAreaTotal: number;
  partsOnStock: number;
  partsOnOffcut: number;
  damageExtraSheets: number;
  cancelLossSheets: number;
  poolFinalCount: number;
  poolFinalAreaM2: number;
  poolPeakAreaM2: number;
  poolAreaTimeSeries: number[];
  warmupStockArea: number; // first N orders
  steadyStockArea: number;
  warmupPartsOnStock: number;
  steadyPartsOnStock: number;
  batchDetails?: BatchDetail[]; // chỉ populate khi tracking enabled
}

// --- Runners ---
function runPerOrder(orders: OrderData[], useOffcut: boolean, rng: () => number): SimResult {
  let pool: OffcutSheet[] = []; let stockSheets = 0; let partsOnStock = 0; let partsOnOffcut = 0;
  let damageExtra = 0; let cancelLoss = 0; let poolPeak = 0;
  const poolSeries: number[] = [];
  let warmupStockSh = 0, warmupParts = 0, steadyStockSh = 0, steadyParts = 0;
  const partsTotal = orders.reduce((s, o) => s + sumPartArea(o.parts), 0);

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    let oSheets = 0, oPartsOnStock = 0, oPartsOnOffcut = 0;
    if (useOffcut) {
      const out = nestWithOffcutPool(order.parts, STOCK_BOARDS, pool, { kerfMm: KERF_MM, minOffcutDim: MIN_OFFCUT_DIM, currentOrderIdx: i, ageLimit: AGE_LIMIT });
      const stockBoards = out.result.boards.filter((b) => b.boardId.startsWith('stock:'));
      oSheets = stockBoards.length;
      oPartsOnStock = stockBoards.reduce((s, b) => s + b.placements.reduce((ss, p) => ss + p.partLength * p.partWidth, 0), 0) / 1_000_000;
      oPartsOnOffcut = out.reusedAreaM2;
      pool = out.newPool;
    } else {
      const result = nestBoards(order.parts, STOCK_BOARDS, KERF_MM);
      oSheets = result.boards.length; oPartsOnStock = sumPartArea(order.parts);
    }
    for (let s = 0; s < oSheets; s++) if (rng() < DAMAGE_RATE) damageExtra++;
    if (order.cancelled) cancelLoss += oSheets;
    stockSheets += oSheets; partsOnStock += oPartsOnStock; partsOnOffcut += oPartsOnOffcut;
    if (i < WARMUP_ORDERS) { warmupStockSh += oSheets; warmupParts += oPartsOnStock; }
    else { steadyStockSh += oSheets; steadyParts += oPartsOnStock; }
    const pArea = pool.reduce((s, o) => s + (o.lengthMm * o.widthMm) / 1_000_000, 0);
    poolSeries.push(pArea);
    if (pArea > poolPeak) poolPeak = pArea;
  }
  const total = stockSheets + damageExtra;
  return {
    stockSheets: total, stockAreaM2: total * SHEET_AREA_M2, partsAreaTotal: partsTotal, partsOnStock, partsOnOffcut,
    damageExtraSheets: damageExtra, cancelLossSheets: cancelLoss,
    poolFinalCount: pool.length, poolFinalAreaM2: pool.reduce((s, o) => s + (o.lengthMm * o.widthMm) / 1_000_000, 0),
    poolPeakAreaM2: poolPeak, poolAreaTimeSeries: poolSeries,
    warmupStockArea: warmupStockSh * SHEET_AREA_M2, steadyStockArea: steadyStockSh * SHEET_AREA_M2,
    warmupPartsOnStock: warmupParts, steadyPartsOnStock: steadyParts,
  };
}

function runBatch(orders: OrderData[], batchSize: number, useOffcut: boolean, rng: () => number, trackDetail = false): SimResult {
  let pool: OffcutSheet[] = []; let stockSheets = 0; let partsOnStock = 0; let partsOnOffcut = 0;
  let damageExtra = 0; let cancelLoss = 0; let poolPeak = 0;
  const poolSeries: number[] = [];
  let warmupStockSh = 0, warmupParts = 0, steadyStockSh = 0, steadyParts = 0;
  const partsTotal = orders.reduce((s, o) => s + sumPartArea(o.parts), 0);
  let batchIdx = 0;
  const batchDetails: BatchDetail[] = [];

  for (let i = 0; i < orders.length; i += batchSize) {
    const batch = orders.slice(i, i + batchSize);
    const allParts = batch.flatMap((o) => o.parts);
    let bSheets = 0, bPartsOnStock = 0, bPartsOnOffcut = 0;
    let stockBoardsArr: NestedBoardLayout[] = []; let offcutBoardsArr: NestedBoardLayout[] = [];
    const poolBefore = pool.reduce((s, o) => s + (o.lengthMm * o.widthMm) / 1_000_000, 0);

    if (useOffcut) {
      const out = nestWithOffcutPool(allParts, STOCK_BOARDS, pool, { kerfMm: KERF_MM, minOffcutDim: MIN_OFFCUT_DIM, currentOrderIdx: batchIdx, ageLimit: Math.ceil(AGE_LIMIT / batchSize) });
      stockBoardsArr = out.result.boards.filter((b) => b.boardId.startsWith('stock:'));
      offcutBoardsArr = out.result.boards.filter((b) => b.boardId.startsWith('offcut:'));
      bSheets = stockBoardsArr.length;
      bPartsOnStock = stockBoardsArr.reduce((s, b) => s + b.placements.reduce((ss, p) => ss + p.partLength * p.partWidth, 0), 0) / 1_000_000;
      bPartsOnOffcut = out.reusedAreaM2;
      pool = out.newPool;
    } else {
      const result = nestBoards(allParts, STOCK_BOARDS, KERF_MM);
      bSheets = result.boards.length; bPartsOnStock = sumPartArea(allParts); stockBoardsArr = result.boards;
    }
    for (let s = 0; s < bSheets; s++) if (rng() < DAMAGE_RATE) damageExtra++;
    const cancelledInBatch = batch.filter((o) => o.cancelled).length;
    cancelLoss += Math.round(bSheets * (cancelledInBatch / batch.length));

    stockSheets += bSheets; partsOnStock += bPartsOnStock; partsOnOffcut += bPartsOnOffcut;
    if (i < WARMUP_ORDERS) { warmupStockSh += bSheets; warmupParts += bPartsOnStock; }
    else { steadyStockSh += bSheets; steadyParts += bPartsOnStock; }
    const pArea = pool.reduce((s, o) => s + (o.lengthMm * o.widthMm) / 1_000_000, 0);
    for (let k = 0; k < batch.length; k++) poolSeries.push(pArea);
    if (pArea > poolPeak) poolPeak = pArea;

    if (trackDetail) {
      const stockArea = bSheets * SHEET_AREA_M2;
      batchDetails.push({
        batchIdx, orderRange: [i, i + batch.length - 1], totalParts: allParts.length,
        stockBoards: stockBoardsArr, offcutBoards: offcutBoardsArr, reusedAreaM2: bPartsOnOffcut,
        stockAreaM2: stockArea, wastePct: stockArea > 0 ? (1 - bPartsOnStock / stockArea) * 100 : 0,
        poolBefore, poolAfter: pArea,
      });
    }
    batchIdx++;
  }
  const total = stockSheets + damageExtra;
  return {
    stockSheets: total, stockAreaM2: total * SHEET_AREA_M2, partsAreaTotal: partsTotal, partsOnStock, partsOnOffcut,
    damageExtraSheets: damageExtra, cancelLossSheets: cancelLoss,
    poolFinalCount: pool.length, poolFinalAreaM2: pool.reduce((s, o) => s + (o.lengthMm * o.widthMm) / 1_000_000, 0),
    poolPeakAreaM2: poolPeak, poolAreaTimeSeries: poolSeries,
    warmupStockArea: warmupStockSh * SHEET_AREA_M2, steadyStockArea: steadyStockSh * SHEET_AREA_M2,
    warmupPartsOnStock: warmupParts, steadyPartsOnStock: steadyParts,
    batchDetails: trackDetail ? batchDetails : undefined,
  };
}

function trueWastePct(result: SimResult): number {
  return result.stockAreaM2 > 0 ? (1 - result.partsOnStock / result.stockAreaM2) * 100 : 0;
}
function storageCostVnd(result: SimResult): number {
  const avgPool = result.poolAreaTimeSeries.reduce((s, v) => s + v, 0) / result.poolAreaTimeSeries.length;
  return avgPool * (N_ORDERS / 30) * STORAGE_COST_VND_PER_M2_MONTH;
}
function netSavingVnd(actual: SimResult, baseline: SimResult): { gross: number; storage: number; net: number } {
  const gross = (baseline.stockAreaM2 - actual.stockAreaM2) * COST_PER_M2;
  const storage = storageCostVnd(actual);
  const baselineCancel = baseline.cancelLossSheets * SHEET_AREA_M2 * COST_PER_M2;
  const actualCancel = actual.cancelLossSheets * SHEET_AREA_M2 * COST_PER_M2;
  return { gross, storage, net: gross - storage - (actualCancel - baselineCancel) };
}

// --- Run multi-seed for aggregates ---
console.log(`Simulating ${N_ORDERS} orders × ${SEEDS.length} seeds = ${N_ORDERS * SEEDS.length} runs...`);
const t0 = Date.now();

interface Aggregated {
  name: string; batchSize: number; useOffcut: boolean;
  seeds: SimResult[];
  avgWaste: number; stdWaste: number;
  warmupWaste: number; steadyWaste: number;
  avgSheets: number; avgGrossSaving: number; avgStorageCost: number; avgNetSaving: number;
  avgPoolPeak: number; avgPoolFinal: number;
}

const strategies = [
  { name: 'A. Per-order baseline', run: (o: OrderData[], r: () => number) => runPerOrder(o, false, r), batchSize: 1, useOffcut: false },
  { name: 'B. Per-order + offcut', run: (o: OrderData[], r: () => number) => runPerOrder(o, true, r), batchSize: 1, useOffcut: true },
  ...BATCH_SIZES.flatMap((bs) => [
    { name: `C. Batch-${bs}`, run: (o: OrderData[], r: () => number) => runBatch(o, bs, false, r), batchSize: bs, useOffcut: false },
    { name: `D. Batch-${bs} + offcut`, run: (o: OrderData[], r: () => number) => runBatch(o, bs, true, r), batchSize: bs, useOffcut: true },
  ]),
];

const allBaselines: SimResult[] = [];
const aggregated: Aggregated[] = [];

for (const strategy of strategies) {
  const seedResults: SimResult[] = [];
  for (const seed of SEEDS) {
    const rng = makeRng(seed);
    const orders: OrderData[] = [];
    for (let i = 0; i < N_ORDERS; i++) {
      const values = randomOrder(rng);
      const build = tuKe.build(values);
      orders.push({ values, parts: build.parts, frameColor: values.color as string, cancelled: rng() < CANCEL_RATE });
    }
    seedResults.push(strategy.run(orders, rng));
  }
  if (strategy.name === 'A. Per-order baseline') allBaselines.push(...seedResults);
  const wasteVals = seedResults.map(trueWastePct);
  const warmupW = avg(seedResults.map((r) => r.warmupStockArea > 0 ? (1 - r.warmupPartsOnStock / r.warmupStockArea) * 100 : 0));
  const steadyW = avg(seedResults.map((r) => r.steadyStockArea > 0 ? (1 - r.steadyPartsOnStock / r.steadyStockArea) * 100 : 0));
  aggregated.push({
    name: strategy.name, batchSize: strategy.batchSize, useOffcut: strategy.useOffcut,
    seeds: seedResults,
    avgWaste: avg(wasteVals), stdWaste: std(wasteVals),
    warmupWaste: warmupW, steadyWaste: steadyW,
    avgSheets: avg(seedResults.map((r) => r.stockSheets)),
    avgGrossSaving: 0, avgStorageCost: 0, avgNetSaving: 0,
    avgPoolPeak: avg(seedResults.map((r) => r.poolPeakAreaM2)),
    avgPoolFinal: avg(seedResults.map((r) => r.poolFinalAreaM2)),
  });
}
for (const a of aggregated) {
  const savings = a.seeds.map((r, idx) => netSavingVnd(r, allBaselines[idx]));
  a.avgGrossSaving = avg(savings.map((s) => s.gross));
  a.avgStorageCost = avg(savings.map((s) => s.storage));
  a.avgNetSaving = avg(savings.map((s) => s.net));
}

// --- Re-run best strategy WITH per-batch tracking for visualization ---
const bestStrategy = aggregated.filter((a) => a.name.startsWith('D.')).reduce((best, a) => a.avgNetSaving > best.avgNetSaving ? a : best);
console.log(`\nRe-running best strategy (${bestStrategy.name}) with detail tracking (seed 42)...`);
const detailRng = makeRng(42);
const detailOrders: OrderData[] = [];
const trackRng = makeRng(42);
for (let i = 0; i < N_ORDERS; i++) {
  const values = randomOrder(trackRng);
  const build = tuKe.build(values);
  detailOrders.push({ values, parts: build.parts, frameColor: values.color as string, cancelled: trackRng() < CANCEL_RATE });
}
const detailResult = runBatch(detailOrders, bestStrategy.batchSize, true, detailRng, true);
const batchDetails = detailResult.batchDetails!;

const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\nDone in ${elapsed}s\n`);
console.log(`Strategy                       | Waste % (±std)  | Warmup waste | Steady waste | Net saving`);
console.log(`-------------------------------|-----------------|--------------|--------------|------------`);
for (const a of aggregated) {
  console.log(`${a.name.padEnd(30)} | ${a.avgWaste.toFixed(1).padStart(5)}% ± ${a.stdWaste.toFixed(2).padStart(4)}  | ${a.warmupWaste.toFixed(1).padStart(11)}% | ${a.steadyWaste.toFixed(1).padStart(11)}% | ${(a.avgNetSaving / 1_000_000).toFixed(0).padStart(7)}M`);
}

// --- Render HTML ---
const fmtVnd = (n: number) => `${(n / 1_000_000).toFixed(0)}M₫`;
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const fmtM2 = (n: number) => `${n.toFixed(0)} m²`;

// Pool evolution chart
const chartW = 1100; const chartH = 200;
const seed0 = bestStrategy.seeds[0];
const maxPool = Math.max(...seed0.poolAreaTimeSeries);
const poolPath = seed0.poolAreaTimeSeries.map((v, i) => {
  const x = (i / (seed0.poolAreaTimeSeries.length - 1)) * chartW;
  const y = chartH - (v / maxPool) * (chartH - 20);
  return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
}).join(' ');

// Saved per-batch bar chart
const maxSaved = Math.max(...batchDetails.map((b) => (b.reusedAreaM2)));
const savedBars = batchDetails.map((b, i) => {
  const x = (i / batchDetails.length) * chartW;
  const w = chartW / batchDetails.length;
  const h = maxSaved > 0 ? (b.reusedAreaM2 / maxSaved) * (chartH - 20) : 0;
  return `<rect x="${x.toFixed(1)}" y="${(chartH - h).toFixed(1)}" width="${(w - 0.5).toFixed(2)}" height="${h.toFixed(1)}" fill="#4ade80"/>`;
}).join('');

// Sheets per batch line chart
const maxSheets = Math.max(...batchDetails.map((b) => b.stockBoards.length));
const sheetsPath = batchDetails.map((b, i) => {
  const x = (i / (batchDetails.length - 1)) * chartW;
  const y = chartH - (b.stockBoards.length / maxSheets) * (chartH - 20);
  return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
}).join(' ');

// Top 10 batches by reuse
const topBatches = [...batchDetails].sort((a, b) => b.reusedAreaM2 - a.reusedAreaM2).slice(0, 10);

// Render SVG board layout for a batch
function renderBoardSvg(board: NestedBoardLayout, color: string, isOffcut: boolean): string {
  const sw = 800; const sh = (board.boardWidth / board.boardLength) * sw;
  const placements = board.placements.map((p) => {
    const w = p.rotated ? p.partWidth : p.partLength;
    const h = p.rotated ? p.partLength : p.partWidth;
    const x = (p.x / board.boardLength) * sw;
    const y = ((board.boardWidth - p.y - h) / board.boardWidth) * sh;
    const rw = (w / board.boardLength) * sw;
    const rh = (h / board.boardWidth) * sh;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" fill="${color}" fill-opacity="0.7" stroke="#222" stroke-width="0.5"/>`;
  }).join('');
  return `
    <svg viewBox="0 0 ${sw} ${sh.toFixed(1)}" style="background: white; border: 2px solid ${isOffcut ? '#10b981' : '#475569'}; border-radius: 4px; width: 100%; max-width: 400px;">
      <rect width="${sw}" height="${sh.toFixed(1)}" fill="white"/>
      ${placements}
    </svg>
    <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">${isOffcut ? '♻️ Offcut' : '📦 Stock'} ${board.boardLength}×${board.boardWidth}×${board.thicknessMm}mm · util ${(board.utilization * 100).toFixed(0)}% · ${board.placements.length} parts</div>
  `;
}

// Batch details (top 10) — render up to 3 boards per batch
const topBatchHtml = topBatches.map((b) => {
  const orderColors = detailOrders.slice(b.orderRange[0], b.orderRange[1] + 1).map((o) => COLOR_BY_ID.get(o.frameColor)?.hex ?? '#888');
  const colorChips = orderColors.slice(0, 30).map((h) => `<span style="display:inline-block;width:8px;height:8px;background:${h};margin-right:2px;border-radius:1px;"></span>`).join('');
  const boardsToShow = [...b.offcutBoards, ...b.stockBoards].slice(0, 4);
  const boardHtml = boardsToShow.map((bd) => {
    const isOffcut = bd.boardId.startsWith('offcut:');
    const colorHex = COLOR_BY_ID.get(bd.materialId)?.hex ?? '#888';
    return `<div style="flex: 1; min-width: 380px;">${renderBoardSvg(bd, colorHex, isOffcut)}</div>`;
  }).join('');
  return `
  <details style="background: #1e293b; padding: 14px; border-radius: 8px; margin-bottom: 12px;">
    <summary style="cursor: pointer; font-weight: 600; color: #fff;">
      Batch #${b.batchIdx + 1} (orders ${b.orderRange[0] + 1}-${b.orderRange[1] + 1}) — ${b.totalParts} parts · ${b.stockBoards.length} stock + ${b.offcutBoards.length} offcut · reused <strong style="color:#4ade80">${fmtM2(b.reusedAreaM2)}</strong> · waste ${fmtPct(b.wastePct)}
    </summary>
    <div style="margin-top: 12px;">
      <div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">Frame colors trong batch (đầu): ${colorChips}</div>
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">${boardHtml}</div>
    </div>
  </details>`;
}).join('');

// Per-batch table (first 30 batches)
const batchTableRows = batchDetails.slice(0, 30).map((b) => `
  <tr>
    <td>#${b.batchIdx + 1}</td>
    <td>${b.orderRange[0] + 1}-${b.orderRange[1] + 1}</td>
    <td>${b.totalParts}</td>
    <td>${b.stockBoards.length}</td>
    <td>${b.offcutBoards.length}</td>
    <td>${fmtM2(b.reusedAreaM2)}</td>
    <td>${fmtPct(b.wastePct)}</td>
    <td>${fmtM2(b.poolBefore)} → ${fmtM2(b.poolAfter)}</td>
  </tr>
`).join('');

let html = `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8"><title>Offcut Sim v3 — comprehensive</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, sans-serif; padding: 24px; background: #0f172a; color: #e2e8f0; margin: 0; line-height: 1.5; }
  h1 { margin: 0 0 8px; font-size: 26px; color: #fff; }
  h2 { font-size: 14px; color: #94a3b8; margin: 32px 0 12px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #334155; padding-bottom: 8px; }
  .meta { color: #94a3b8; margin-bottom: 16px; font-size: 13px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; background: #334155; margin-right: 6px; }
  .table { width: 100%; background: #1e293b; border-radius: 8px; overflow: hidden; font-size: 13px; border-collapse: collapse; }
  .table th { background: #0f172a; padding: 10px 12px; text-align: left; color: #94a3b8; font-weight: 500; text-transform: uppercase; font-size: 11px; }
  .table td { padding: 10px 12px; border-top: 1px solid #334155; }
  .table tr:hover { background: #334155; }
  .winner { color: #10b981; font-weight: 700; }
  .bad { color: #ef4444; }
  .insight { background: #1e293b; padding: 16px; border-radius: 8px; border-left: 4px solid #fbbf24; margin: 14px 0; font-size: 13px; }
  .insight strong { color: #fbbf24; }
  .col-dist { display: flex; gap: 4px; margin-bottom: 16px; }
  .col-bar { padding: 12px; border-radius: 4px; font-size: 12px; color: #fff; text-align: center; }
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin: 16px 0; }
  .kpi { background: #1e293b; padding: 14px 16px; border-radius: 8px; border-left: 4px solid #10b981; }
  .kpi.alert { border-left-color: #fbbf24; }
  .kpi.bad { border-left-color: #ef4444; }
  .kpi-l { font-size: 11px; color: #94a3b8; text-transform: uppercase; }
  .kpi-v { font-size: 24px; font-weight: 700; color: #fff; margin-top: 4px; }
  .kpi-s { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .chart-box { background: #1e293b; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
  .chart-title { font-size: 13px; color: #94a3b8; margin-bottom: 8px; font-weight: 600; }
  svg.chart { width: 100%; height: ${chartH}px; background: #0f172a; border-radius: 4px; }
</style></head><body>
<h1>Offcut + Batch Nesting Simulation v3</h1>
<div class="meta">
  <span class="badge">${N_ORDERS} orders</span>
  <span class="badge">${SEEDS.length} seeds</span>
  <span class="badge">Skew colors</span>
  <span class="badge">Cancel ${(CANCEL_RATE * 100).toFixed(0)}%</span>
  <span class="badge">Damage ${(DAMAGE_RATE * 100).toFixed(0)}%</span>
  <span class="badge">Storage ${STORAGE_COST_VND_PER_M2_MONTH / 1000}k₫/m²/tháng</span>
  <span class="badge">Merge offcut</span>
  <span class="badge">Warmup ${WARMUP_ORDERS}</span>
  <span class="badge">Runtime ${elapsed}s</span>
</div>

<h2>1. Color distribution (skew)</h2>
<div class="col-dist">
${COLORS.map((c) => `<div class="col-bar" style="background: ${c.hex}; flex-grow: ${c.weight};">${c.name} ${c.weight}%</div>`).join('')}
</div>

<h2>2. Best strategy KPIs — ${bestStrategy.name}</h2>
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-l">Net saving (sau cost)</div><div class="kpi-v winner">${fmtVnd(bestStrategy.avgNetSaving)}</div><div class="kpi-s">${fmtVnd(bestStrategy.avgNetSaving / N_ORDERS)}/đơn</div></div>
  <div class="kpi"><div class="kpi-l">Waste % (mean ± std)</div><div class="kpi-v">${fmtPct(bestStrategy.avgWaste)} ± ${bestStrategy.stdWaste.toFixed(2)}</div><div class="kpi-s">${SEEDS.length} seeds</div></div>
  <div class="kpi"><div class="kpi-l">Gross saving</div><div class="kpi-v">${fmtVnd(bestStrategy.avgGrossSaving)}</div><div class="kpi-s">trước storage</div></div>
  <div class="kpi bad"><div class="kpi-l">Storage cost</div><div class="kpi-v">−${fmtVnd(bestStrategy.avgStorageCost)}</div><div class="kpi-s">warehouse offcut</div></div>
  <div class="kpi alert"><div class="kpi-l">Warm-up waste</div><div class="kpi-v">${fmtPct(bestStrategy.warmupWaste)}</div><div class="kpi-s">${WARMUP_ORDERS} đơn đầu</div></div>
  <div class="kpi"><div class="kpi-l">Steady-state waste</div><div class="kpi-v">${fmtPct(bestStrategy.steadyWaste)}</div><div class="kpi-s">đơn ${WARMUP_ORDERS + 1}-${N_ORDERS}</div></div>
  <div class="kpi"><div class="kpi-l">Pool peak</div><div class="kpi-v">${fmtM2(bestStrategy.avgPoolPeak)}</div><div class="kpi-s">~${Math.ceil(bestStrategy.avgPoolPeak / SHEET_AREA_M2)} sheets</div></div>
  <div class="kpi"><div class="kpi-l">Pool final</div><div class="kpi-v">${fmtM2(bestStrategy.avgPoolFinal)}</div><div class="kpi-s">~${Math.ceil(bestStrategy.avgPoolFinal / SHEET_AREA_M2)} sheets</div></div>
</div>

<h2>3. So sánh tất cả strategies</h2>
<table class="table">
  <thead><tr><th>Strategy</th><th>Waste mean ± std</th><th>Warm-up</th><th>Steady</th><th>Sheets</th><th>Gross saving</th><th>Storage</th><th>Net saving</th><th>Wait</th></tr></thead>
  <tbody>
${aggregated.map((a) => {
  const waitDays = a.batchSize === 1 ? 'instant' : `${a.batchSize} ngày`;
  const wasteClass = a.avgWaste <= 30 ? 'winner' : a.avgWaste >= 50 ? 'bad' : '';
  const netClass = a.avgNetSaving > 800_000_000 ? 'winner' : a.avgNetSaving < 0 ? 'bad' : '';
  return `<tr>
    <td><strong>${a.name}</strong></td>
    <td class="${wasteClass}">${fmtPct(a.avgWaste)} ± ${a.stdWaste.toFixed(2)}</td>
    <td>${fmtPct(a.warmupWaste)}</td>
    <td>${fmtPct(a.steadyWaste)}</td>
    <td>${Math.round(a.avgSheets)}</td>
    <td>${a.avgGrossSaving > 0 ? fmtVnd(a.avgGrossSaving) : '—'}</td>
    <td>${a.avgStorageCost > 0 ? fmtVnd(a.avgStorageCost) : '—'}</td>
    <td class="${netClass}">${fmtVnd(a.avgNetSaving)}</td>
    <td>${waitDays}</td>
  </tr>`;
}).join('')}
  </tbody>
</table>

<h2>4. Per-seed variance (transparency over ${SEEDS.length} runs)</h2>
<table class="table">
  <thead><tr><th>Strategy</th>${SEEDS.map((s) => `<th>Seed ${s}</th>`).join('')}<th>Mean</th><th>Std</th></tr></thead>
  <tbody>
${aggregated.map((a) => {
  const wv = a.seeds.map(trueWastePct);
  return `<tr>
    <td><strong>${a.name}</strong></td>
    ${wv.map((v) => `<td>${fmtPct(v)}</td>`).join('')}
    <td>${fmtPct(a.avgWaste)}</td>
    <td>${a.stdWaste.toFixed(2)}</td>
  </tr>`;
}).join('')}
  </tbody>
</table>

<h2>5. Pool evolution chart (best strategy ${bestStrategy.name}, seed 42)</h2>
<div class="chart-box">
  <div class="chart-title">Pool size (m²) qua ${N_ORDERS} orders. Peak ${fmtM2(maxPool)}.</div>
  <svg class="chart" viewBox="0 0 ${chartW} ${chartH}" preserveAspectRatio="none">
    <line x1="0" y1="${chartH - (chartH - 20) * (bestStrategy.avgPoolFinal / maxPool)}" x2="${chartW}" y2="${chartH - (chartH - 20) * (bestStrategy.avgPoolFinal / maxPool)}" stroke="#475569" stroke-dasharray="4 4" stroke-width="1"/>
    <path d="${poolPath}" fill="none" stroke="#4ade80" stroke-width="2"/>
    <text x="10" y="18" font-size="11" fill="#94a3b8">peak ${fmtM2(maxPool)}</text>
    <text x="${chartW - 10}" y="18" text-anchor="end" font-size="11" fill="#94a3b8">final ${fmtM2(bestStrategy.avgPoolFinal)}</text>
  </svg>
</div>

<h2>6. Reused area per batch (best strategy)</h2>
<div class="chart-box">
  <div class="chart-title">${batchDetails.length} batches × bar = m² parts đặt trên offcut.</div>
  <svg class="chart" viewBox="0 0 ${chartW} ${chartH}" preserveAspectRatio="none">
    ${savedBars}
    <text x="10" y="18" font-size="11" fill="#94a3b8">max ${fmtM2(maxSaved)} reused / batch</text>
  </svg>
</div>

<h2>7. Stock sheets per batch</h2>
<div class="chart-box">
  <div class="chart-title">Số ván cốt mới mua per batch (max ${maxSheets}).</div>
  <svg class="chart" viewBox="0 0 ${chartW} ${chartH}" preserveAspectRatio="none">
    <path d="${sheetsPath}" fill="none" stroke="#fbbf24" stroke-width="2"/>
    <text x="10" y="18" font-size="11" fill="#94a3b8">avg ${(batchDetails.reduce((s, b) => s + b.stockBoards.length, 0) / batchDetails.length).toFixed(1)} sheets/batch</text>
  </svg>
</div>

<h2>8. Top 10 batches by offcut reuse (with SVG layouts)</h2>
${topBatchHtml}

<h2>9. Per-batch details (first 30 batches)</h2>
<table class="table">
  <thead><tr><th>Batch</th><th>Orders</th><th>Parts</th><th>Stock sheets</th><th>Offcut sheets</th><th>Reused</th><th>Waste %</th><th>Pool (before → after)</th></tr></thead>
  <tbody>${batchTableRows}</tbody>
</table>

<h2>10. ROI summary</h2>
<div class="insight">
  💰 <strong>Saving cho ${N_ORDERS} đơn</strong>: ${fmtVnd(bestStrategy.avgNetSaving)} net (gross ${fmtVnd(bestStrategy.avgGrossSaving)} − storage ${fmtVnd(bestStrategy.avgStorageCost)})<br>
  💵 <strong>Per đơn</strong>: ${fmtVnd(bestStrategy.avgNetSaving / N_ORDERS)} saving. Nếu giá đơn TB 10M → giảm ${((bestStrategy.avgNetSaving / N_ORDERS / 10_000_000) * 100).toFixed(1)}% giá thành.<br>
  📅 <strong>Lead time</strong>: ${bestStrategy.batchSize} ngày queue + 5-7 ngày sản xuất → tổng ${bestStrategy.batchSize + 7} ngày.<br>
  📦 <strong>Warehouse</strong>: peak ${fmtM2(bestStrategy.avgPoolPeak)} ≈ ${Math.ceil(bestStrategy.avgPoolPeak / SHEET_AREA_M2)} ván storage (~2 pallets).<br>
  📈 <strong>Steady-state vs Warm-up</strong>: waste ${fmtPct(bestStrategy.steadyWaste)} (steady) vs ${fmtPct(bestStrategy.warmupWaste)} (warm-up 50 đơn đầu). Pool đầy đủ → hiệu quả ổn định.
</div>

<h2>11. Lỗ hổng đã fix vs còn lại</h2>
<div class="insight">
  <strong>✓ Đã fix:</strong> Waste formula đúng, multi-seed (${SEEDS.length}), warm-up split, skew distribution, merge offcut, cancel/damage/storage cost, per-batch SVG layouts, pool/sheets/reuse charts, ROI breakdown.<br>
  <strong>⚠ Chưa fix:</strong> Real orders từ Google Sheet (cần user export), MaxRects algorithm (Guillotine FFD chưa optimal), DXF export per batch cho CNC operator, customer behavior survey để validate 70% same-frame.
</div>
</body></html>`;

fs.writeFileSync('/Users/hsonvu/CLAUDE/simulate-offcuts.html', html);
console.log(`\n✓ HTML: /Users/hsonvu/CLAUDE/simulate-offcuts.html (${(html.length / 1024).toFixed(0)} KB)`);
console.log(`✓ Open: http://localhost:8765/simulate-offcuts.html`);
