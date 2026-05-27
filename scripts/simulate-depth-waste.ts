// =============================================================================
// simulate-depth-waste — Monte Carlo chọn bộ giá trị `depth` tối ưu cho khách.
//
// Bối cảnh: depth hiện cho khách kéo tự do 300–700mm (bước 1mm). Bộ giá trị rời
// rạc giảm waste khổ ván nhưng bó khách. Script này test 10 candidate sets:
// generate 10k đơn random một lần (fair comparison), snap depth theo từng set,
// build cutlist thật, nest lên khổ 1220×2440 (kerf 3mm), tính util + sheets +
// waste VND. Output bảng ranking.
//
// Chạy: pnpm tsx scripts/simulate-depth-waste.ts
// =============================================================================
import tuKe from '../products/tu-ke/dna';
import { encodeCellGrid } from '../src/configurator/cellgrid';
import { nestBoards } from '../src/lib/nesting';
import type { CatalogBoard } from '../src/lib/production-catalog';
import type { ParamValues } from '../src/configurator/types';

const N_ORDERS = 10_000;
const SEED = 42;
const KERF = 3;
// Giá ván trung bình VND/m² (MFC 18mm khoảng 261k/m² theo catalog) — để quy
// waste ra tiền cho dễ so sánh.
const COST_PER_M2 = 261_000;

const STOCK_BOARDS: CatalogBoard[] = [
  { id: 'b18', label: '1220×2440 18mm', materialId: 'mfc_melamine', lengthMm: 2440, widthMm: 1220, thicknessMm: 18 },
  { id: 'b9', label: '1220×2440 9mm', materialId: 'mfc_melamine', lengthMm: 2440, widthMm: 1220, thicknessMm: 9 },
];

interface CandidateSet {
  name: string;
  values: number[] | null; // null = baseline (không snap)
}

const CANDIDATE_SETS: CandidateSet[] = [
  { name: 'BASELINE (step 1mm, free 300–700)', values: null },
  { name: '{300, 400, 600} — 3 giá trị tối thiểu', values: [300, 400, 600] },
  { name: '{300, 400, 500, 600} — đề xuất 4 giá trị', values: [300, 400, 500, 600] },
  { name: '{300, 400, 500, 600, 700} — thêm 700 closet', values: [300, 400, 500, 600, 700] },
  { name: '{300, 350, 400, 500, 600} — có 350 phổ thông', values: [300, 350, 400, 500, 600] },
  { name: '{300, 400, 600, 700}', values: [300, 400, 600, 700] },
  { name: '{350, 400, 500, 600}', values: [350, 400, 500, 600] },
  { name: 'Step 50mm (300–700)', values: [300, 350, 400, 450, 500, 550, 600, 650, 700] },
  { name: 'Step 100mm (300–700)', values: [300, 400, 500, 600, 700] },
  { name: '{350, 450, 600} — sanity check (kém)', values: [350, 450, 600] },
];

// --- RNG deterministic (sfc32-ish) ---
function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Order generator — pattern y hệt simulate-offcut-pool.ts ---
const CELL_TYPES = ['door', 'door', 'open-back', 'open-back', 'open-back', 'drawer'];
function randomOrder(rng: () => number): ParamValues {
  const columns = Math.floor(rng() * 4) + 2; // 2–5
  const rows = Math.floor(rng() * 5) + 2; // 2–6
  const cellsGrid: string[][] = [];
  const cellColorsGrid: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const cRow: string[] = [];
    const ccRow: string[] = [];
    for (let c = 0; c < columns; c++) {
      cRow.push(CELL_TYPES[Math.floor(rng() * CELL_TYPES.length)]);
      ccRow.push('frame'); // simplified — màu khung khắp ô (đỡ nhánh case)
    }
    cellsGrid.push(cRow);
    cellColorsGrid.push(ccRow);
  }
  return {
    width: Math.floor(rng() * 1601) + 800, // 800–2400
    height: Math.floor(rng() * 1701) + 700, // 700–2400
    depth: Math.floor(rng() * 401) + 300, // 300–700
    columns,
    rows,
    widthMode: 'even',
    heightMode: 'even',
    color: 'mfc_melamine/ml_xanh_navy_edge_den', // 1 màu cố định để FAIR (không bị bias màu khác giá ván)
    cells: encodeCellGrid(cellsGrid),
    cellColors: encodeCellGrid(cellColorsGrid),
  };
}

// --- Snap depth về candidate gần nhất ---
function snapDepth(d: number, candidates: number[]): number {
  let best = candidates[0];
  let bestDist = Math.abs(d - best);
  for (const c of candidates) {
    const dist = Math.abs(d - c);
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best;
}

// --- Stats ---
function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}
function std(arr: number[]): number {
  if (arr.length === 0) return 0;
  const m = avg(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

interface OrderResult {
  util: number;
  sheets: number;
  wasteAreaM2: number; // tổng diện tích waste (board total − parts placed)
  partsCount: number;
}

const SHEET_AREA_M2 = (1220 * 2440) / 1_000_000;

function evaluate(order: ParamValues): OrderResult | null {
  let built;
  try {
    // tuKe có thể có normalizeValues
    const normalized = tuKe.normalizeValues ? tuKe.normalizeValues(order) : order;
    built = tuKe.build(normalized);
  } catch {
    return null; // order vi phạm constraints → bỏ qua
  }
  if (built.parts.length === 0) return null;
  const result = nestBoards(built.parts, STOCK_BOARDS, KERF);
  if (result.boards.length === 0) return null;
  const totalBoardArea = result.boards.reduce((s, b) => s + (b.boardLength * b.boardWidth) / 1_000_000, 0);
  const usedArea = result.boards.reduce(
    (s, b) => s + b.placements.reduce((ss, p) => ss + (p.partLength * p.partWidth) / 1_000_000, 0),
    0,
  );
  return {
    util: totalBoardArea > 0 ? usedArea / totalBoardArea : 0,
    sheets: result.boards.length,
    wasteAreaM2: totalBoardArea - usedArea,
    partsCount: built.parts.length,
  };
}

// --- Main ---
console.log(`\n=== SIMULATE DEPTH WASTE ===`);
console.log(`N orders: ${N_ORDERS}, seed: ${SEED}, kerf: ${KERF}mm`);
console.log(`Stock board: 1220×2440 (${SHEET_AREA_M2.toFixed(2)} m²), cost ~${COST_PER_M2.toLocaleString()}đ/m²\n`);

console.log('Generating orders...');
const t0 = Date.now();
const rng = makeRng(SEED);
const baseOrders: ParamValues[] = [];
for (let i = 0; i < N_ORDERS; i++) baseOrders.push(randomOrder(rng));
console.log(`Done ${baseOrders.length} orders in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

interface SetSummary {
  name: string;
  values: number[] | null;
  validOrders: number;
  avgUtil: number;
  stdUtil: number;
  avgSheets: number;
  totalSheets: number;
  totalWasteM2: number;
  wasteCostVnd: number; // tổng tiền waste cho 10k đơn
  depthHist: Record<number, number>;
}

const summary: SetSummary[] = [];

for (const set of CANDIDATE_SETS) {
  const tStart = Date.now();
  process.stdout.write(`Testing ${set.name.padEnd(48)} `);
  const utils: number[] = [];
  const sheets: number[] = [];
  let totalWaste = 0;
  let totalSheets = 0;
  let valid = 0;
  const depthHist: Record<number, number> = {};

  for (const baseOrder of baseOrders) {
    const order = set.values
      ? { ...baseOrder, depth: snapDepth(baseOrder.depth as number, set.values) }
      : baseOrder;
    const d = order.depth as number;
    depthHist[d] = (depthHist[d] || 0) + 1;
    const r = evaluate(order);
    if (!r) continue;
    valid++;
    utils.push(r.util);
    sheets.push(r.sheets);
    totalWaste += r.wasteAreaM2;
    totalSheets += r.sheets;
  }

  const sum: SetSummary = {
    name: set.name,
    values: set.values,
    validOrders: valid,
    avgUtil: avg(utils),
    stdUtil: std(utils),
    avgSheets: avg(sheets),
    totalSheets,
    totalWasteM2: totalWaste,
    wasteCostVnd: totalWaste * COST_PER_M2,
    depthHist,
  };
  summary.push(sum);
  console.log(`✓ ${((Date.now() - tStart) / 1000).toFixed(1)}s · util ${(sum.avgUtil * 100).toFixed(2)}%`);
}

// Sort: lower waste VND = better
summary.sort((a, b) => a.wasteCostVnd - b.wasteCostVnd);

console.log(`\n=== RANKING (theo tổng waste cost ${N_ORDERS} đơn — thấp = tốt) ===\n`);
console.log(
  'Bộ giá trị'.padEnd(50) +
    ' Util%   Sheets  Waste m²    Waste VND       Diff vs best',
);
console.log('─'.repeat(120));
const bestCost = summary[0].wasteCostVnd;
for (const s of summary) {
  const diff = s.wasteCostVnd - bestCost;
  const diffStr = diff === 0 ? '— (best)' : `+${(diff / 1_000_000).toFixed(1)}M`;
  console.log(
    s.name.padEnd(50) +
      ` ${(s.avgUtil * 100).toFixed(2)}%  ${s.avgSheets.toFixed(2)}    ${s.totalWasteM2.toFixed(1).padStart(8)}    ${(s.wasteCostVnd / 1_000_000).toFixed(1).padStart(6)}M     ${diffStr}`,
  );
}

// Per-order savings: chia waste diff cho N_ORDERS
console.log(`\n=== PER-ORDER SAVINGS so với BASELINE ===\n`);
const baseline = summary.find((s) => s.values === null)!;
const sortedBySavings = [...summary]
  .filter((s) => s.values !== null)
  .sort((a, b) => a.wasteCostVnd - b.wasteCostVnd);
for (const s of sortedBySavings) {
  const savePerOrder = (baseline.wasteCostVnd - s.wasteCostVnd) / N_ORDERS;
  const sign = savePerOrder >= 0 ? 'tiết kiệm' : 'tăng waste';
  console.log(
    `${s.name.padEnd(50)} ${sign} ${Math.abs(savePerOrder).toFixed(0).padStart(7)}đ/đơn (${((Math.abs(savePerOrder) / (baseline.wasteCostVnd / N_ORDERS)) * 100).toFixed(1)}%)`,
  );
}

// Histogram depth — xem khách bị "dồn" về đâu sau khi snap
console.log(`\n=== DEPTH DISTRIBUTION (top 3 set khuyên dùng) ===\n`);
const top3 = summary.slice(0, 3);
for (const s of top3) {
  console.log(`▸ ${s.name}`);
  const entries = Object.entries(s.depthHist).sort((a, b) => Number(a[0]) - Number(b[0]));
  for (const [d, n] of entries) {
    const pct = (n / N_ORDERS) * 100;
    const bar = '█'.repeat(Math.round(pct / 2));
    console.log(`  ${d.padStart(4)}mm  ${pct.toFixed(1).padStart(5)}% ${bar}`);
  }
  console.log('');
}

console.log(`\nDone. Total ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
