// =============================================================
// VALIDATOR — scripts/validate-dna.ts
// Chạy build() của products/tu-ke/dna.ts qua nhiều cấu hình (min / giữa /
// max + các ca biên), kiểm tra hình học · giá · bảng cắt; in PASS/FAIL và
// thoát mã ≠ 0 nếu có lỗi.   Chạy:  pnpm validate
//
// Engine src/configurator/ chỉ được ĐỌC (import) — validator KHÔNG sửa engine.
// Cả chuỗi import (dna → cellgrid · materials · types; pricing; cutlist) đều là
// hàm THUẦN, không React/Three.js → chạy được bằng tsx ngoài Next.
// =============================================================
import tuKe from '../products/tu-ke/dna';
import tuY from '../products/tu-y/dna';
import {
  encodeModules,
  findFloating,
  nextModuleId,
  overlaps,
  placeAtEdge,
  removeModule,
  updateModule,
  type YComposition,
} from '../products/tu-y/modules';
import { generatePartDXF } from '../src/lib/dxf/generator';
import {
  blocksToCells,
  blocksToGrid,
  cellsToBlocks,
  encodeBlocks,
  encodeCellGrid,
  encodeSubSplit,
  findBlockAt,
  gridToBlocks,
  hasSubSplit,
  isBlocksValue,
  isUniformBlocks,
  parseBlocks,
  parseCellGrid,
  parseSubSplit,
  reconcileCellGrid,
  mergeBlocks,
  setSubCellType,
  splitBlockIntra,
  unmergeBlocks,
  unsplitBlockIntra,
  type CellBlock,
  type SubSplit,
} from '../src/configurator/cellgrid';
import { buildCutlist } from '../src/configurator/cutlist';
import { computePrice, formatPrice, computeMargin, DEFAULT_MARGIN_TIERS } from '../src/configurator/pricing';
import { computePresetKpi } from '../src/configurator/preset-pricing';
import type { BuildResult, Machining, ParamValues, Part, PriceConfig } from '../src/configurator/types';
import { nestBoards } from '../src/lib/nesting';
import { computeNestingCost } from '../src/lib/nesting/cost';
import type { CatalogBoard } from '../src/lib/production-catalog';

// Khổ ván xưởng dùng (mm): thân tủ 18mm (mdf_son/plywood) hoặc 17mm (MCA An Cường
// + Minh Long ship physical 17mm) · ván hậu / đáy hộc 9mm.
// Mọi Part phải có thickness_mm thuộc tập này.
const BOARD_THICKNESSES = [9, 17, 18];

// Mốc tham chiếu ca "Mặc định" — default 1900×2200, 3 cột × 4 tầng, khung MFC trắng + cạnh đen
// + tay nắm bar (P58). Total dùng giá fallback của validator (mfc chưa có rate → 700k), KHÁC
// giá site thật (KV 261k) — chỉ là mốc tự-nhất-quán của validator.
// P74: 5.341.280 → 5.613.280 — BOM thêm connector_2in1 (3k/bộ) + back_clip (1k/chốt) fallback.
const BASELINE = { total: 5_613_280, panels: 33, areaM2: 4.44 };

/** Một lỗi bắt được — tên check + mô tả cụ thể để truy ra tấm/cấu hình. */
interface Issue {
  check: string;
  detail: string;
}

// -------------------------------------------------------------
// NĂM NHÓM KIỂM TRA — chạy trên kết quả build()
// -------------------------------------------------------------
function checkBuild(build: BuildResult, priceConfig: PriceConfig): Issue[] {
  const issues: Issue[] = [];

  if (build.parts.length === 0) {
    issues.push({ check: 'không có tấm', detail: 'build() trả về 0 tấm' });
  }

  for (const p of build.parts) {
    // (2) Không cạnh ≤ 0 — mọi cạnh hộp 3D phải dương; số lượng phải dương.
    if (p.size.some((edge) => edge <= 0)) {
      issues.push({ check: 'cạnh ≤ 0', detail: `tấm "${p.id}" size=[${p.size.join(', ')}]` });
    }
    if (p.qty <= 0) {
      issues.push({ check: 'qty ≤ 0', detail: `tấm "${p.id}" qty=${p.qty}` });
    }

    // (1) size ↔ length/width/thickness — 3 cạnh size sắp giảm dần phải khớp l/w/t.
    const sorted = [...p.size].sort((a, b) => b - a);
    if (sorted[0] !== p.length_mm || sorted[1] !== p.width_mm || sorted[2] !== p.thickness_mm) {
      issues.push({
        check: 'size↔l/w/t',
        detail:
          `tấm "${p.id}": size giảm dần [${sorted.join(', ')}] ` +
          `≠ l/w/t [${p.length_mm}, ${p.width_mm}, ${p.thickness_mm}]`,
      });
    }

    // (3) Độ dày đúng quy ước — thickness_mm thuộc {9, 18}.
    if (!BOARD_THICKNESSES.includes(p.thickness_mm)) {
      issues.push({
        check: 'độ dày ván',
        detail: `tấm "${p.id}" dày ${p.thickness_mm}mm — ngoài {${BOARD_THICKNESSES.join(', ')}}`,
      });
    }
  }

  // (5) Bảng cắt không rỗng.
  const cutlist = buildCutlist(build);
  if (cutlist.panels.length === 0 || cutlist.totalPanels <= 0) {
    issues.push({
      check: 'bảng cắt rỗng',
      detail: `panels=${cutlist.panels.length}, totalPanels=${cutlist.totalPanels}`,
    });
  }

  // (4) Tổng tiền > 0.
  const price = computePrice(build, priceConfig);
  if (price.total <= 0) {
    issues.push({ check: 'giá ≤ 0', detail: `total=${price.total}` });
  }

  return issues;
}

// -------------------------------------------------------------
// TỰ KIỂM — nuôi build() GIẢ có lỗi đã biết: mỗi check phải bắt được.
// Bảo đảm validator có "răng" (không phải check rỗng luôn báo PASS).
// -------------------------------------------------------------
function fakePart(over: Partial<Part>): Part {
  return {
    id: 'fake',
    label: 'Tấm giả',
    material: 'mdf_son/nau',
    size: [100, 50, 18],
    position: [0, 0, 0],
    length_mm: 100,
    width_mm: 50,
    thickness_mm: 18,
    grain: 'length',
    edgeBanding: { front: false, back: false, left: false, right: false },
    qty: 1,
    ...over,
  };
}
const fakeBuild = (parts: Part[]): BuildResult => ({ parts, hardware: [] });

function selfTest(): boolean {
  const ok: PriceConfig = { margin: 1.6, laborPerOrder: 300_000 };
  const probes: { name: string; build: BuildResult; config: PriceConfig; want: string }[] = [
    {
      name: 'sai size↔l/w/t',
      build: fakeBuild([fakePart({ length_mm: 999 })]),
      config: ok,
      want: 'size↔l/w/t',
    },
    {
      name: 'cạnh ≤ 0',
      build: fakeBuild([
        fakePart({ size: [0, 50, 18], length_mm: 50, width_mm: 18, thickness_mm: 0 }),
      ]),
      config: ok,
      want: 'cạnh ≤ 0',
    },
    {
      name: 'độ dày sai',
      build: fakeBuild([
        fakePart({ size: [100, 50, 12], length_mm: 100, width_mm: 50, thickness_mm: 12 }),
      ]),
      config: ok,
      want: 'độ dày ván',
    },
    { name: 'qty ≤ 0', build: fakeBuild([fakePart({ qty: 0 })]), config: ok, want: 'qty ≤ 0' },
    { name: 'bảng cắt rỗng', build: fakeBuild([]), config: ok, want: 'bảng cắt rỗng' },
    {
      name: 'giá ≤ 0',
      build: fakeBuild([]),
      config: { margin: 1, laborPerOrder: 0 },
      want: 'giá ≤ 0',
    },
  ];

  let pass = 0;
  for (const probe of probes) {
    const caught = checkBuild(probe.build, probe.config).some((i) => i.check === probe.want);
    if (caught) pass++;
    else console.log(`  LỖI tự kiểm "${probe.name}" — check "${probe.want}" không bắt được`);
  }
  console.log(`Tự kiểm validator: ${pass}/${probes.length} check có hiệu lực`);
  return pass === probes.length;
}

// -------------------------------------------------------------
// BỘ CẤU HÌNH THỬ
// -------------------------------------------------------------
type Overrides = Record<string, number | string>;

interface Case {
  name: string;
  overrides: Overrides;
  raw?: boolean; // true → KHÔNG chạy normalizeValues (ép build() nhận input thô)
}

/** Giá trị mặc định của mọi tham số tĩnh (giống Configurator seed ban đầu). */
function defaults(): ParamValues {
  const v: ParamValues = {};
  for (const p of tuKe.parameters) v[p.id] = p.default;
  return v;
}

function param(id: string) {
  const p = tuKe.parameters.find((x) => x.id === id);
  if (!p) throw new Error(`Không có tham số "${id}"`);
  return p;
}
function lo(id: string): number {
  const m = param(id).min;
  if (m === undefined) throw new Error(`Tham số "${id}" không có min`);
  return m;
}
function hi(id: string): number {
  const m = param(id).max;
  if (m === undefined) throw new Error(`Tham số "${id}" không có max`);
  return m;
}
/** Điểm giữa khoảng, làm tròn về bội số step. */
function mid(id: string): number {
  const step = param(id).step ?? 1;
  return Math.round((lo(id) + hi(id)) / 2 / step) * step;
}

/** Núm "rộng từng cột" cho n cột, mỗi cột bề rộng w. */
function colW(n: number, w: number): Overrides {
  const o: Overrides = {};
  for (let c = 0; c < n; c++) o[`colW_${c}`] = w;
  return o;
}
/** Núm "cao từng tầng" cho n tầng, mỗi tầng cao h. */
function tierH(n: number, h: number): Overrides {
  const o: Overrides = {};
  for (let r = 0; r < n; r++) o[`tierH_${r}`] = h;
  return o;
}

const DIMS = ['width', 'height', 'depth', 'columns', 'rows'];

function buildCases(): Case[] {
  const cases: Case[] = [];

  // Ca gốc — mọi tham số mặc định.
  cases.push({ name: 'Mặc định', overrides: {} });

  // min / giữa / max từng chiều (giá trị đọc động từ tuKe.parameters).
  for (const id of DIMS) {
    cases.push({ name: `${id}: min ${lo(id)}`, overrides: { [id]: lo(id) } });
    cases.push({ name: `${id}: giữa ${mid(id)}`, overrides: { [id]: mid(id) } });
    cases.push({ name: `${id}: max ${hi(id)}`, overrides: { [id]: hi(id) } });
  }

  // Toàn bộ min / giữa / max cùng lúc.
  const allOf = (pick: (id: string) => number): Overrides =>
    Object.fromEntries(DIMS.map((id): [string, number] => [id, pick(id)]));
  cases.push({ name: 'Toàn bộ min', overrides: allOf(lo) });
  cases.push({ name: 'Toàn bộ giữa', overrides: allOf(mid) });
  cases.push({ name: 'Toàn bộ max', overrides: allOf(hi) });

  // Chế độ "từng cột" — rộng đặt đều min / đều max / hỗn hợp.
  cases.push({
    name: 'Rộng từng cột — đều min',
    overrides: { widthMode: 'manual', columns: 3, ...colW(3, 150) },
  });
  cases.push({
    name: 'Rộng từng cột — đều max',
    overrides: { widthMode: 'manual', columns: 3, ...colW(3, 1200) },
  });
  cases.push({
    name: 'Rộng từng cột — hỗn hợp',
    overrides: { widthMode: 'manual', columns: 3, colW_0: 150, colW_1: 600, colW_2: 1200 },
  });

  // Chế độ "từng tầng" — cao đặt đều min / đều max / hỗn hợp.
  cases.push({
    name: 'Cao từng tầng — đều min',
    overrides: { heightMode: 'manual', rows: 4, ...tierH(4, 150) },
  });
  cases.push({
    name: 'Cao từng tầng — đều max',
    overrides: { heightMode: 'manual', rows: 4, ...tierH(4, 2400) },
  });
  cases.push({
    name: 'Cao từng tầng — hỗn hợp',
    overrides: { heightMode: 'manual', rows: 4, tierH_0: 150, tierH_1: 600, tierH_2: 1200, tierH_3: 2400 },
  });

  // Cả hai chiều cùng chế độ "từng".
  cases.push({
    name: 'Cả rộng + cao đều "từng"',
    overrides: {
      widthMode: 'manual',
      heightMode: 'manual',
      columns: 2,
      rows: 2,
      ...colW(2, 400),
      ...tierH(2, 400),
    },
  });

  // BIÊN: tủ nhỏ nhất + nhiều cột/tầng nhất, chạy THÔ (bỏ normalizeValues)
  // → ép build() tự lo: ô vẫn phải dương (chốt an toàn trong computeCol/RowHeights).
  cases.push({
    name: 'BIÊN: tủ min + cột/tầng max (thô)',
    overrides: {
      width: lo('width'),
      height: lo('height'),
      depth: lo('depth'),
      columns: hi('columns'),
      rows: hi('rows'),
    },
    raw: true,
  });

  // Phủ đủ 4 loại ô + cột rộng >600mm ép tách 2 cánh.
  // 2000mm / 3 cột → ô ~642mm (>WIDE_CELL 600) → ô "cánh" tách 2 lá.
  // 1200mm / 3 tầng → ô ~376mm (≤400) · đỉnh tầng trên cùng ≤1200 → ngăn kéo hợp lệ.
  cases.push({
    name: 'Phủ 4 loại ô + cánh đôi',
    overrides: {
      width: 2000,
      height: 1200,
      columns: 3,
      rows: 3,
      cells: encodeCellGrid([
        ['open-back', 'open-nobk', 'door'],
        ['drawer', 'door', 'open-back'],
        ['open-nobk', 'drawer', 'door'],
      ]),
    },
  });

  // Ngăn kéo đặt ô KHÔNG hợp lệ (ô quá cao) → build() phải tự hạ về CÁNH
  // (cột ≥ 250mm) hoặc "mở có hậu" (cột < 250mm hoặc cánh cũng vi phạm), không nổ lỗi.
  cases.push({
    name: 'Ngăn kéo ô không hợp lệ → dự phòng',
    overrides: {
      width: 1200,
      height: 1800,
      columns: 2,
      rows: 3,
      cells: encodeCellGrid([
        ['drawer', 'drawer'],
        ['door', 'open-back'],
        ['drawer', 'door'],
      ]),
    },
  });

  // Phủ cả 2 bảng đơn giá (mdf_son + plywood_veneer).
  cases.push({ name: 'Vật liệu khung: veneer óc chó', overrides: { color: 'plywood_veneer/walnut' } });
  cases.push({ name: 'Vật liệu khung: MDF đen', overrides: { color: 'mdf_son/den' } });
  // F2 verify: MDF+AC → body thickness 17mm (không phải 18mm), back vẫn 9mm.
  cases.push({ name: 'Vật liệu khung: MDF+AC Vàng nghệ (body 17mm)', overrides: { color: 'mdf_chong_am_melamine/ac_vang_nghe' } });

  // Lưới "vật liệu từng ô" trộn nhiều catalog.
  cases.push({
    name: 'Vật liệu từng ô trộn veneer + MDF',
    overrides: {
      columns: 2,
      rows: 2,
      cellColors: encodeCellGrid([
        ['plywood_veneer/oak', 'mdf_son/do'],
        ['frame', 'plywood_veneer/ash'],
      ]),
    },
  });

  return cases;
}

// -------------------------------------------------------------
// PIPELINE TEST — mô phỏng đầy đủ chuỗi Configurator: normalize → reconcile → build
// Bắt các bug "build() đúng nhưng UI sai" (vd: reconcile nuốt drawer thành open-back
// trước khi build() có cơ hội fallback sang door — hot-fix 2026-05-20).
// -------------------------------------------------------------
type CountConstraint = number | { min?: number; max?: number };

interface PipelineCase {
  name: string;
  overrides: Overrides;
  /** Số part theo label sau khi full pipeline. Mỗi label kiểm: exact (số) hoặc range ({min, max}). */
  expect: Record<string, CountConstraint>;
}

/** Mô phỏng chính xác Configurator: setParam → normalize → reconcile từng cellgrid → build. */
function runPipeline(overrides: Overrides): BuildResult {
  let v: ParamValues = { ...defaults(), ...overrides };
  if (tuKe.normalizeValues) v = tuKe.normalizeValues(v);
  const controls = tuKe.resolveControls?.(v) ?? tuKe.parameters;
  // P36: seed từ TẤT CẢ normalized values (rows, tierH_r... không còn là control)
  // — khớp đúng Configurator.resolvedValues. Nếu chỉ lấy từ controls sẽ thiếu rows → NaN.
  const resolved: ParamValues = { ...v };
  for (const c of controls) {
    if (c.type === 'cellgrid') {
      const raw = String(v[c.id] ?? c.default);
      // P75 fix drift: cells dạng BLOCK LIST (split/merge) pass-through nguyên văn —
      // khớp Configurator ~L1518 + route ke-dxf P73 (trước đây validator reconcile
      // cả blocks → nát thành default, test sub-split không bao giờ có cánh).
      resolved[c.id] = isBlocksValue(raw)
        ? raw
        : encodeCellGrid(
            reconcileCellGrid(
              raw,
              c.gridRows ?? 0,
              c.gridCols ?? 0,
              c.options?.[0]?.value ?? '',
              c.disabledByRow,
              c.disabledByCol,
              c.cellFallbackMap,
            ),
          );
    } else {
      resolved[c.id] = v[c.id] ?? c.default;
    }
  }
  return tuKe.build(resolved);
}

function countByLabel(build: BuildResult): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of build.parts) out[p.label] = (out[p.label] ?? 0) + 1;
  return out;
}

function matchConstraint(actual: number, c: CountConstraint): boolean {
  if (typeof c === 'number') return actual === c;
  if (c.min !== undefined && actual < c.min) return false;
  if (c.max !== undefined && actual > c.max) return false;
  return true;
}

function describeConstraint(c: CountConstraint): string {
  if (typeof c === 'number') return `= ${c}`;
  const parts: string[] = [];
  if (c.min !== undefined) parts.push(`≥ ${c.min}`);
  if (c.max !== undefined) parts.push(`≤ ${c.max}`);
  return parts.join(', ');
}

function buildPipelineCases(): PipelineCase[] {
  const cases: PipelineCase[] = [];

  // 1ô grid mẫu — set widthMode/heightMode manual để cố định cw, h.
  // Default cells: 'open-back'. Set ô (0,0) theo test scenario.
  const grid = (cell: string) => encodeCellGrid([[cell]]);

  // (1) P36 v3: COL_MAX=700 — cột nhập 1000mm bị CLAMP về 700mm. 700 < DRAWER_MAX_WIDTH(900)
  //     → ngăn kéo GIỮ NGUYÊN (1 cột không bao giờ vượt 900 nên fallback drawer→door qua
  //     chiều rộng chỉ còn khả dụng cho ô GỘP). Kiểm clamp + drawer giữ.
  cases.push({
    name: 'Drawer colW=1000 (clamp→700) → vẫn ngăn kéo (700<900)',
    overrides: {
      widthMode: 'manual', heightMode: 'manual',
      columns: 1, rows: 1, colW_0: 1000, tierH_0: 350,
      cells: grid('drawer'),
    },
    expect: { 'Mặt ngăn kéo': 1, 'Cánh tủ': 0 },
  });

  // (2) Ngăn kéo cột 700mm (vượt WIDE_CELL 600 nhưng < DRAWER_MAX_WIDTH 900) →
  //     drawer GIỮ NGUYÊN (KHÔNG fallback). WIDE_CELL chỉ áp cho CÁNH, không phải ngăn kéo.
  cases.push({
    name: 'Drawer cw=700 → giữ drawer (700<900)',
    overrides: {
      widthMode: 'manual', heightMode: 'manual',
      columns: 1, rows: 1, colW_0: 700, tierH_0: 350,
      cells: grid('drawer'),
    },
    expect: { 'Mặt ngăn kéo': 1, 'Cánh tủ': 0 },
  });

  // (3) Ngăn kéo cao 600mm > DRAWER_MAX_HEIGHT(400) → fallback CÁNH ĐƠN (cw=500 < 600).
  cases.push({
    name: 'Drawer h=600 → cánh đơn (drawer→door, h>400)',
    overrides: {
      widthMode: 'manual', heightMode: 'manual',
      columns: 1, rows: 1, colW_0: 500, tierH_0: 600,
      cells: grid('drawer'),
    },
    expect: { 'Mặt ngăn kéo': 0, 'Cánh tủ': 1, 'Tấm lưng': 1 },
  });

  // (4) BOUNDARY: cánh cw=1200mm = DOOR_MAX_WIDTH chính xác → cánh đôi VẪN HỢP LỆ
  //     (kiểm "off-by-one" tại biên). Slider clamp luôn giữ cw ≤ COL_MAX=1200 nên
  //     ở UI fallback door→open-back qua chiều rộng KHÔNG BAO GIỜ kích hoạt; logic
  //     đó chỉ là defensive net cho call build() raw.
  cases.push({
    name: 'Door cw=1200 (biên DOOR_MAX_WIDTH) → cánh đôi vẫn hợp lệ',
    overrides: {
      widthMode: 'manual', heightMode: 'manual',
      columns: 1, rows: 1, colW_0: 1200, tierH_0: 350,
      cells: grid('door'),
    },
    expect: { 'Mặt ngăn kéo': 0, 'Cánh tủ': 2, 'Tấm lưng': 1 },
  });

  // (5) Ô đỉnh > DRAWER_MAX_TOP(1200): 3 tầng × 500mm → đỉnh tầng cao ~1554mm.
  //     Drawer ô (2,0) cao 500 > 400 cũng vi phạm → fallback CÁNH ĐƠN (cw 500 < 600).
  cases.push({
    name: 'Drawer ở tầng cao đỉnh>1200 → cánh đơn',
    overrides: {
      widthMode: 'manual', heightMode: 'manual',
      columns: 1, rows: 3, colW_0: 500,
      tierH_0: 500, tierH_1: 500, tierH_2: 500,
      cells: encodeCellGrid([['open-back'], ['open-back'], ['drawer']]),
    },
    // Toàn bộ tủ: 3 ô — 2 mở-có-hậu (back=2) + 1 cánh (drawer→door, có lưng) → back=3
    expect: { 'Mặt ngăn kéo': 0, 'Cánh tủ': 1, 'Tấm lưng': 3 },
  });

  // (6) Sanity — default config: P18 default rows=4 × columns=3 = 12 ô mở-có-hậu.
  cases.push({
    name: 'Sanity: default config → 12 ô mở-có-hậu (4×3)',
    overrides: {},
    expect: { 'Mặt ngăn kéo': 0, 'Cánh tủ': 0, 'Tấm lưng': 12 },
  });

  return cases;
}

function runPipelineCase(c: PipelineCase): Issue[] {
  try {
    const build = runPipeline(c.overrides);
    const counts = countByLabel(build);
    const issues: Issue[] = [];
    for (const [label, want] of Object.entries(c.expect)) {
      const got = counts[label] ?? 0;
      if (!matchConstraint(got, want)) {
        issues.push({
          check: 'pipeline count',
          detail: `"${label}" thực tế ${got}, kỳ vọng ${describeConstraint(want)}`,
        });
      }
    }
    return issues;
  } catch (err) {
    return [{ check: 'ngoại lệ', detail: err instanceof Error ? err.message : String(err) }];
  }
}

// -------------------------------------------------------------
// CHẠY
// -------------------------------------------------------------
/** Chạy 1 cấu hình giống Configurator: seed default → ghép override → normalize → build. */
function runCase(c: Case): { issues: Issue[]; build?: BuildResult } {
  try {
    let values: ParamValues = { ...defaults(), ...c.overrides };
    if (!c.raw && tuKe.normalizeValues) values = tuKe.normalizeValues(values);
    const build = tuKe.build(values);
    return { issues: checkBuild(build, tuKe.priceConfig), build };
  } catch (err) {
    return {
      issues: [{ check: 'ngoại lệ', detail: err instanceof Error ? err.message : String(err) }],
    };
  }
}

// =============================================================
// CODEC TESTS — Phase 2 (block list ↔ uniform legacy).
// Mục tiêu: chứng minh `cellsToBlocks` đi qua legacy/blocks/empty đều cho ra
// list `CellBlock` cuối cùng tương đương `parseCellGrid` cũ. Đảm bảo migration
// không thay đổi semantic — preset legacy load qua codec mới CUTLIST KHÔNG ĐỔI.
// =============================================================
interface CodecCase {
  name: string;
  /** Returns null nếu PASS, chuỗi mô tả lỗi nếu FAIL. */
  run: () => string | null;
}

function gridsEqual(a: string[][], b: string[][]): boolean {
  if (a.length !== b.length) return false;
  for (let r = 0; r < a.length; r++) {
    if ((a[r]?.length ?? 0) !== (b[r]?.length ?? 0)) return false;
    for (let c = 0; c < a[r].length; c++) if (a[r][c] !== b[r][c]) return false;
  }
  return true;
}

function blocksEqual(a: CellBlock[], b: CellBlock[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x.r !== y.r || x.c !== y.c || x.rs !== y.rs || x.cs !== y.cs || x.t !== y.t) return false;
  }
  return true;
}

function buildCodecCases(): CodecCase[] {
  return [
    // ----- A) IDENTITY — gridToBlocks → blocksToGrid restores grid -----
    {
      name: 'A1: 1×1 grid identity',
      run: () => {
        const grid = [['open-back']];
        const back = blocksToGrid(gridToBlocks(grid), 1, 1, '?');
        return gridsEqual(grid, back) ? null : `expected ${JSON.stringify(grid)}, got ${JSON.stringify(back)}`;
      },
    },
    {
      name: 'A2: 2×2 uniform same value',
      run: () => {
        const grid = [
          ['open-back', 'open-back'],
          ['open-back', 'open-back'],
        ];
        const back = blocksToGrid(gridToBlocks(grid), 2, 2, '?');
        return gridsEqual(grid, back) ? null : 'mismatch';
      },
    },
    {
      name: 'A3: 2×2 mixed cells',
      run: () => {
        const grid = [
          ['open-back', 'door'],
          ['drawer', 'open-nobk'],
        ];
        const back = blocksToGrid(gridToBlocks(grid), 2, 2, '?');
        return gridsEqual(grid, back) ? null : 'mismatch';
      },
    },
    {
      name: 'A4: 4×3 mixed cells (default tủ kệ shape)',
      run: () => {
        const grid = [
          ['open-back', 'door', 'open-back'],
          ['open-back', 'door', 'open-back'],
          ['drawer', 'drawer', 'drawer'],
          ['open-back', 'open-back', 'open-back'],
        ];
        const back = blocksToGrid(gridToBlocks(grid), 4, 3, '?');
        return gridsEqual(grid, back) ? null : 'mismatch';
      },
    },
    {
      name: 'A5: 1×5 single row',
      run: () => {
        const grid = [['a', 'b', 'c', 'd', 'e']];
        const back = blocksToGrid(gridToBlocks(grid), 1, 5, '?');
        return gridsEqual(grid, back) ? null : 'mismatch';
      },
    },
    {
      name: 'A6: 5×1 single col',
      run: () => {
        const grid = [['a'], ['b'], ['c'], ['d'], ['e']];
        const back = blocksToGrid(gridToBlocks(grid), 5, 1, '?');
        return gridsEqual(grid, back) ? null : 'mismatch';
      },
    },
    {
      name: 'A7: 6×4 large mixed (loft-like)',
      run: () => {
        const grid: string[][] = [];
        const opts = ['open-back', 'door', 'drawer', 'open-nobk'];
        for (let r = 0; r < 6; r++) {
          const row: string[] = [];
          for (let c = 0; c < 4; c++) row.push(opts[(r * 4 + c) % opts.length]);
          grid.push(row);
        }
        const back = blocksToGrid(gridToBlocks(grid), 6, 4, '?');
        return gridsEqual(grid, back) ? null : 'mismatch';
      },
    },

    // ----- B) LEGACY ↔ blocks roundtrip — preset format → blocks → format -----
    {
      name: 'B1: legacy "a,b;c,d" roundtrip via encodeBlocks/parseBlocks',
      run: () => {
        const legacy = 'open-back,door;drawer,open-back';
        const grid = parseCellGrid(legacy);
        const enc = encodeBlocks(gridToBlocks(grid));
        const back = blocksToGrid(parseBlocks(enc), 2, 2, '?');
        return gridsEqual(grid, back) ? null : `enc=${enc}`;
      },
    },
    {
      name: 'B2: 3-cell row roundtrip',
      run: () => {
        const legacy = 'open-back,door,drawer';
        const grid = parseCellGrid(legacy);
        const enc = encodeBlocks(gridToBlocks(grid));
        const back = blocksToGrid(parseBlocks(enc), 1, 3, '?');
        return gridsEqual(grid, back) ? null : 'mismatch';
      },
    },
    {
      name: 'B3: material slash "mfc/oak,plywood/walnut" roundtrip',
      run: () => {
        const legacy = 'mfc/oak,plywood/walnut;frame,mfc/oak';
        const grid = parseCellGrid(legacy);
        const enc = encodeBlocks(gridToBlocks(grid));
        const back = blocksToGrid(parseBlocks(enc), 2, 2, '?');
        return gridsEqual(grid, back) ? null : `enc=${enc}, back=${JSON.stringify(back)}`;
      },
    },
    {
      name: 'B4: legacy → blocks → legacy via blocksToCells identical',
      run: () => {
        const legacy = 'open-back,door,drawer;open-nobk,open-back,door';
        const grid = parseCellGrid(legacy);
        const back = blocksToCells(gridToBlocks(grid), 2, 3, '?');
        return back === legacy ? null : `expected "${legacy}", got "${back}"`;
      },
    },

    // ----- C) cellsToBlocks auto-detect -----
    {
      name: 'C1: empty string → uniform fallback rows×cols',
      run: () => {
        const blocks = cellsToBlocks('', 2, 3, 'open-back');
        if (blocks.length !== 6) return `expected 6 blocks, got ${blocks.length}`;
        if (!blocks.every((b) => b.t === 'open-back' && b.rs === 1 && b.cs === 1)) {
          return 'không phải toàn uniform fallback';
        }
        return null;
      },
    },
    {
      name: 'C2: legacy "a,b" auto-detect → 2 blocks 1×1',
      run: () => {
        const blocks = cellsToBlocks('open-back,door', 1, 2, '?');
        const want: CellBlock[] = [
          { r: 0, c: 0, rs: 1, cs: 1, t: 'open-back' },
          { r: 0, c: 1, rs: 1, cs: 1, t: 'door' },
        ];
        return blocksEqual(blocks, want) ? null : `got ${JSON.stringify(blocks)}`;
      },
    },
    {
      // CONVENTION: blocks format yêu cầu ≥2 blocks (≥1 dấu '|'); 1 block đơn
      // lẻ ambiguous với 5-cell legacy row → ép encode lại bằng legacy. Test
      // 2-block 1×2 + 1×1 phủ 1 hàng 3 cột.
      name: 'C3: blocks "0,0,1,2,door|0,2,1,1,open-back" auto-detect',
      run: () => {
        const blocks = cellsToBlocks('0,0,1,2,door|0,2,1,1,open-back', 1, 3, '?');
        const want: CellBlock[] = [
          { r: 0, c: 0, rs: 1, cs: 2, t: 'door' },
          { r: 0, c: 2, rs: 1, cs: 1, t: 'open-back' },
        ];
        return blocksEqual(blocks, want) ? null : `got ${JSON.stringify(blocks)}`;
      },
    },
    {
      name: 'C4: mixed blocks "0,0,1,1,a|0,1,2,1,b|1,0,1,1,c"',
      run: () => {
        const blocks = cellsToBlocks('0,0,1,1,a|0,1,2,1,b|1,0,1,1,c', 2, 2, '?');
        const want: CellBlock[] = [
          { r: 0, c: 0, rs: 1, cs: 1, t: 'a' },
          { r: 0, c: 1, rs: 2, cs: 1, t: 'b' },
          { r: 1, c: 0, rs: 1, cs: 1, t: 'c' },
        ];
        return blocksEqual(blocks, want) ? null : `got ${JSON.stringify(blocks)}`;
      },
    },
    {
      name: 'C5: isBlocksValue detects "|" correctly',
      run: () => {
        if (isBlocksValue('')) return 'empty marked as blocks';
        if (isBlocksValue('a,b;c,d')) return 'legacy "a,b;c,d" marked as blocks';
        if (!isBlocksValue('0,0,1,1,a|0,1,1,1,b')) return 'blocks not detected';
        return null;
      },
    },

    // ----- D) Block ops — span ≥ 2, overlap, crop -----
    {
      name: 'D1: 2×2 block fills 4 cells',
      run: () => {
        const grid = blocksToGrid([{ r: 0, c: 0, rs: 2, cs: 2, t: 'big' }], 2, 2, '?');
        const want = [
          ['big', 'big'],
          ['big', 'big'],
        ];
        return gridsEqual(grid, want) ? null : `got ${JSON.stringify(grid)}`;
      },
    },
    {
      name: 'D2: 1×3 horizontal span',
      run: () => {
        const grid = blocksToGrid([{ r: 0, c: 0, rs: 1, cs: 3, t: 'wide' }], 1, 3, '?');
        const want = [['wide', 'wide', 'wide']];
        return gridsEqual(grid, want) ? null : 'mismatch';
      },
    },
    {
      name: 'D3: 3×1 vertical span',
      run: () => {
        const grid = blocksToGrid([{ r: 0, c: 0, rs: 3, cs: 1, t: 'tall' }], 3, 1, '?');
        const want = [['tall'], ['tall'], ['tall']];
        return gridsEqual(grid, want) ? null : 'mismatch';
      },
    },
    {
      name: 'D4: overlap last-wins',
      run: () => {
        const blocks: CellBlock[] = [
          { r: 0, c: 0, rs: 2, cs: 2, t: 'A' },
          { r: 1, c: 1, rs: 1, cs: 1, t: 'B' },
        ];
        const grid = blocksToGrid(blocks, 2, 2, '?');
        const want = [
          ['A', 'A'],
          ['A', 'B'],
        ];
        return gridsEqual(grid, want) ? null : `got ${JSON.stringify(grid)}`;
      },
    },
    {
      name: 'D5: crop block beyond bounds',
      run: () => {
        // Block 3×3 từ (0,0) trên grid 2×2 → chỉ điền 4 ô trong, không lỗi.
        const grid = blocksToGrid([{ r: 0, c: 0, rs: 3, cs: 3, t: 'X' }], 2, 2, '?');
        const want = [
          ['X', 'X'],
          ['X', 'X'],
        ];
        return gridsEqual(grid, want) ? null : 'mismatch';
      },
    },
    {
      name: 'D6: findBlockAt locates spanning block',
      run: () => {
        const blocks: CellBlock[] = [
          { r: 0, c: 0, rs: 2, cs: 2, t: 'merged' },
          { r: 0, c: 2, rs: 1, cs: 1, t: 'small' },
        ];
        const a = findBlockAt(blocks, 1, 1);
        const b = findBlockAt(blocks, 0, 2);
        const c = findBlockAt(blocks, 5, 5);
        if (a?.t !== 'merged') return `(1,1) expected 'merged', got ${a?.t}`;
        if (b?.t !== 'small') return `(0,2) expected 'small', got ${b?.t}`;
        if (c !== undefined) return `(5,5) expected undefined`;
        return null;
      },
    },
    {
      name: 'D7: isUniformBlocks true for 1×1 only, false with any span',
      run: () => {
        const u: CellBlock[] = [
          { r: 0, c: 0, rs: 1, cs: 1, t: 'a' },
          { r: 0, c: 1, rs: 1, cs: 1, t: 'b' },
        ];
        const m: CellBlock[] = [{ r: 0, c: 0, rs: 1, cs: 2, t: 'a' }];
        if (!isUniformBlocks(u)) return 'uniform mistaken as non-uniform';
        if (isUniformBlocks(m)) return 'span 1×2 mistaken as uniform';
        return null;
      },
    },

    // ----- E) Integration with reconcileCellGrid (pad + ban rules) -----
    {
      name: 'E1: cellsToBlocks(legacy) preserves reconcile output',
      run: () => {
        // Lấy preset compact-like, chạy reconcile → grid; sau đó qua block API
        // → grid. Hai grid phải bằng nhau (chứng minh migration không thay đổi
        // semantic cho preset legacy).
        const legacy = encodeCellGrid([
          ['open-back', 'door'],
          ['drawer', 'open-back'],
        ]);
        const recRows = reconcileCellGrid(legacy, 2, 2, 'open-back');
        const blocks = cellsToBlocks(legacy, 2, 2, 'open-back');
        const back = blocksToGrid(blocks, 2, 2, 'open-back');
        return gridsEqual(recRows, back) ? null : `reconcile=${JSON.stringify(recRows)}, blocks=${JSON.stringify(back)}`;
      },
    },
    {
      name: 'E2: empty value through cellsToBlocks matches reconcileCellGrid',
      run: () => {
        const recRows = reconcileCellGrid('', 3, 3, 'open-back');
        const blocks = cellsToBlocks('', 3, 3, 'open-back');
        const back = blocksToGrid(blocks, 3, 3, 'open-back');
        return gridsEqual(recRows, back) ? null : 'mismatch';
      },
    },
    {
      name: 'E3: preset legacy → blocks → reconstructed grid identical to parseCellGrid',
      run: () => {
        // Lấy 5 preset-like grids và đảm bảo identity hoàn toàn — Phase 2 verify
        // "cutlist totals NO CHANGE" thực chất nằm ở đây.
        const presets = [
          'open-back,open-back;open-back,open-back', // compact
          'door,drawer,open-back;open-back,open-back,open-back;door,door,drawer', // studio-ish
          'open-back,open-back,open-back,open-back;door,door,door,door', // wide
        ];
        for (const p of presets) {
          const original = parseCellGrid(p);
          const rows = original.length;
          const cols = original[0]?.length ?? 0;
          const blocks = cellsToBlocks(p, rows, cols, 'open-back');
          const back = blocksToGrid(blocks, rows, cols, 'open-back');
          if (!gridsEqual(original, back)) return `preset "${p}" not identity`;
        }
        return null;
      },
    },

    // ----- F) Sub-split codec (Phase 3 v2) — INTRA-CELL split -----
    {
      name: 'F1: parseSubSplit primitive (không split)',
      run: () => {
        const r = parseSubSplit('open-back');
        if (r.primitive !== 'open-back') return `primitive expected 'open-back', got ${r.primitive}`;
        if ((r as { split?: SubSplit }).split !== undefined) return 'split phải undefined';
        return null;
      },
    },
    {
      name: 'F2: parseSubSplit V-split "open-back>door"',
      run: () => {
        const r = parseSubSplit('open-back>door');
        if (r.split?.axis !== 'V') return `axis V expected, got ${r.split?.axis}`;
        if (r.split.subs[0] !== 'open-back' || r.split.subs[1] !== 'door') {
          return `subs ['open-back','door'] expected, got ${JSON.stringify(r.split.subs)}`;
        }
        return null;
      },
    },
    {
      name: 'F3: parseSubSplit H-split "drawer^open-back"',
      run: () => {
        const r = parseSubSplit('drawer^open-back');
        if (r.split?.axis !== 'H') return `axis H expected`;
        if (r.split.subs[0] !== 'drawer' || r.split.subs[1] !== 'open-back') return 'subs mismatch';
        return null;
      },
    },
    {
      name: 'F4: encodeSubSplit roundtrip',
      run: () => {
        const sV = encodeSubSplit({ axis: 'V', subs: ['door', 'drawer'] });
        const sH = encodeSubSplit({ axis: 'H', subs: ['open-back', 'open-nobk'] });
        if (sV !== 'door>drawer') return `V expected 'door>drawer', got '${sV}'`;
        if (sH !== 'open-back^open-nobk') return `H expected 'open-back^open-nobk', got '${sH}'`;
        // Roundtrip
        const rV = parseSubSplit(sV);
        if (rV.split?.subs[0] !== 'door' || rV.split.subs[1] !== 'drawer') return 'V roundtrip fail';
        return null;
      },
    },
    {
      name: 'F5: hasSubSplit detects > và ^',
      run: () => {
        if (hasSubSplit('open-back')) return 'primitive marked as split';
        if (!hasSubSplit('open-back>door')) return 'V not detected';
        if (!hasSubSplit('drawer^open-back')) return 'H not detected';
        return null;
      },
    },
    {
      name: 'F6: splitBlockIntra V — block.t = "open-back>open-back"',
      run: () => {
        const before = cellsToBlocks('open-back', 1, 1, 'open-back');
        const after = splitBlockIntra(before, 0, 0, 'vertical', 'open-back');
        const target = findBlockAt(after, 0, 0);
        if (!target) return 'no block at (0,0)';
        if (target.t !== 'open-back>open-back') return `expected 'open-back>open-back', got '${target.t}'`;
        // Outer grid topology KHÔNG đổi: blocks list vẫn 1 block, rs=cs=1
        if (after.length !== 1) return `expected 1 block, got ${after.length}`;
        if (target.rs !== 1 || target.cs !== 1) return `rs/cs changed: ${target.rs}/${target.cs}`;
        return null;
      },
    },
    {
      name: 'F7: splitBlockIntra H — outer grid không đổi',
      run: () => {
        const before = cellsToBlocks('door', 1, 1, 'open-back');
        const after = splitBlockIntra(before, 0, 0, 'horizontal', 'open-back');
        const target = findBlockAt(after, 0, 0);
        if (target?.t !== 'open-back^open-back') return `expected 'open-back^open-back', got '${target?.t}'`;
        return null;
      },
    },
    {
      name: 'F8: splitBlockIntra throw khi block đã sub-split',
      run: () => {
        // Block đã sub-split (t = "open-back>door") — encoded ở blocks format.
        const before: CellBlock[] = [{ r: 0, c: 0, rs: 1, cs: 1, t: 'open-back>door' }];
        try {
          splitBlockIntra(before, 0, 0, 'vertical', 'open-back');
          return 'expected throw';
        } catch (e) {
          const msg = (e as Error).message;
          return msg.includes('sub-split') ? null : `wrong error: ${msg}`;
        }
      },
    },
    {
      name: 'F9: splitBlockIntra throw khi cross-merged (rs>1 OR cs>1)',
      run: () => {
        const merged: CellBlock[] = [{ r: 0, c: 0, rs: 1, cs: 2, t: 'open-back' }];
        try {
          splitBlockIntra(merged, 0, 0, 'vertical', 'open-back');
          return 'expected throw';
        } catch (e) {
          const msg = (e as Error).message;
          return msg.includes('cross-grid') || msg.includes('merged') ? null : `wrong error: ${msg}`;
        }
      },
    },
    {
      name: 'F10: unsplitBlockIntra — giữ sub-cell đầu tiên',
      run: () => {
        const before: CellBlock[] = [{ r: 0, c: 0, rs: 1, cs: 1, t: 'door>drawer' }];
        const after = unsplitBlockIntra(before, 0, 0);
        const t = findBlockAt(after, 0, 0)?.t;
        return t === 'door' ? null : `expected 'door', got '${t}'`;
      },
    },
    {
      name: 'F11: setSubCellType — đổi 1 sub-cell',
      run: () => {
        const before: CellBlock[] = [{ r: 0, c: 0, rs: 1, cs: 1, t: 'open-back>open-back' }];
        const after = setSubCellType(before, 0, 0, 1, 'door');
        const t = findBlockAt(after, 0, 0)?.t;
        return t === 'open-back>door' ? null : `expected 'open-back>door', got '${t}'`;
      },
    },
    {
      name: 'F12: parseBlocks/encodeBlocks roundtrip với sub-split trong t',
      run: () => {
        const blocks: CellBlock[] = [
          { r: 0, c: 0, rs: 1, cs: 1, t: 'open-back>door' },
          { r: 0, c: 1, rs: 1, cs: 1, t: 'drawer^open-back' },
        ];
        const encoded = encodeBlocks(blocks);
        const parsed = parseBlocks(encoded);
        if (parsed.length !== 2) return `${parsed.length} blocks (expected 2)`;
        if (parsed[0].t !== 'open-back>door') return `block 0 t mismatch: ${parsed[0].t}`;
        if (parsed[1].t !== 'drawer^open-back') return `block 1 t mismatch: ${parsed[1].t}`;
        return null;
      },
    },

    // ----- G) Build integration — sub-cell rendering (Phase 3 v2) -----
    {
      name: 'G1: legacy preset không sub-split → build identical baseline',
      run: () => {
        // Baseline: rows=3 → kệ count = 2 (rows-1) wide panels. Vách = (cols+1)*rows.
        const v: ParamValues = {
          ...defaults(),
          columns: 2,
          rows: 3,
          widthMode: 'manual',
          heightMode: 'manual',
          colW_0: 600,
          colW_1: 600,
          tierH_0: 500,
          tierH_1: 500,
          tierH_2: 500,
        };
        v.cells = encodeCellGrid([
          ['open-back', 'open-back'],
          ['open-back', 'open-back'],
          ['open-back', 'open-back'],
        ]);
        const result = tuKe.build(v);
        const keCount = result.parts.filter((p) => p.label === 'Kệ').length;
        if (keCount !== 2) return `expected kệ=2 wide panels (legacy), got ${keCount}`;
        const ke = result.parts.find((p) => p.label === 'Kệ');
        if (!ke) return 'no Kệ found';
        if (ke.length_mm < 500) return `kệ length=${ke.length_mm} — phải là wide W`;
        return null;
      },
    },
    {
      name: 'G2: V-split open-back → 1 Vách phụ + Tấm lưng vẫn 1 (NOT chia)',
      run: () => {
        // 1×1 cell với block.t = "open-back>open-back" (V-split).
        const v: ParamValues = {
          ...defaults(),
          columns: 1,
          rows: 1,
          widthMode: 'manual',
          heightMode: 'manual',
          colW_0: 800,
          tierH_0: 500,
        };
        // Blocks format with sub-split inside t.
        v.cells = encodeBlocks([{ r: 0, c: 0, rs: 1, cs: 1, t: 'open-back>open-back' }]);
        const result = tuKe.build(v);
        const vachPhuCount = result.parts.filter((p) => p.label === 'Vách phụ').length;
        const tamLungCount = result.parts.filter((p) => p.label === 'Tấm lưng').length;
        if (vachPhuCount !== 1) return `vách phụ count = ${vachPhuCount}, expected 1`;
        if (tamLungCount !== 1) return `tấm lưng = ${tamLungCount}, expected 1 (KHÔNG chia per sub-cell)`;
        // P74: vách phụ phải có connector edge_drill 4 lỗ chốt (2 cạnh × 2 vị trí)
        const vp = result.parts.find((p) => p.label === 'Vách phụ');
        const edges = (vp?.machining ?? []).filter(
          (m) => m.purpose === 'connector' && m.op === 'edge_drill',
        );
        if (edges.length < 4) return `vách phụ connector edge = ${edges.length}, expected ≥4`;
        // P74.1: chốt đo từ mép TỦ (thẳng hàng cữ vách chính) — vách phụ sâu D-9,
        // position từ đầu SAU: sau = insetFromBack - 9 = 41; trước = (D-9) - 50.
        const D = Number(v.depth);
        const want = [41, D - 9 - 50].sort((a, b) => a - b).join(',');
        const got = [...new Set(edges.map((m) => (m.op === 'edge_drill' ? m.position_mm : 0)))]
          .sort((a, b) => a - b)
          .join(',');
        if (got !== want) return `vị trí chốt vách phụ = {${got}}, kỳ vọng {${want}} (thẳng hàng cữ tủ)`;
        return null;
      },
    },
    {
      name: 'G3: H-split open-back → vách phụ ngang (chiều cw, không phải T) ngang',
      run: () => {
        const v: ParamValues = {
          ...defaults(),
          columns: 1,
          rows: 1,
          widthMode: 'manual',
          heightMode: 'manual',
          colW_0: 600,
          tierH_0: 800,
        };
        v.cells = encodeBlocks([{ r: 0, c: 0, rs: 1, cs: 1, t: 'open-back^open-back' }]);
        const result = tuKe.build(v);
        const vp = result.parts.find((p) => p.label === 'Vách phụ');
        if (!vp) return 'no Vách phụ found';
        // H-split vách phụ: size = [cw, T, D - T_BACK]. length_mm phải ≈ colW_0 = 600.
        if (vp.length_mm < 500) return `vách phụ length = ${vp.length_mm}mm, expected ≈ 600 (cw)`;
        return null;
      },
    },
    {
      name: 'G4: ALL sub-cell open-nobk → KHÔNG có tấm lưng',
      run: () => {
        const v: ParamValues = {
          ...defaults(),
          columns: 1,
          rows: 1,
          widthMode: 'manual',
          heightMode: 'manual',
          colW_0: 600,
          tierH_0: 500,
        };
        v.cells = encodeBlocks([{ r: 0, c: 0, rs: 1, cs: 1, t: 'open-nobk>open-nobk' }]);
        const result = tuKe.build(v);
        const tamLungCount = result.parts.filter((p) => p.label === 'Tấm lưng').length;
        return tamLungCount === 0 ? null : `tấm lưng = ${tamLungCount}, expected 0 (both sub open-nobk)`;
      },
    },
    {
      name: 'G5: V-split door>door → 2 cánh tủ parts (sub-cell rendering)',
      run: () => {
        // 1×1 cell rộng 700mm split V → 2 sub-cell ~341mm mỗi cái (< WIDE_CELL 600) → 2 cánh đơn.
        const v: ParamValues = {
          ...defaults(),
          columns: 1,
          rows: 1,
          widthMode: 'manual',
          heightMode: 'manual',
          colW_0: 700,
          tierH_0: 500,
        };
        v.cells = encodeBlocks([{ r: 0, c: 0, rs: 1, cs: 1, t: 'door>door' }]);
        const result = tuKe.build(v);
        const doorCount = result.parts.filter((p) => p.label === 'Cánh tủ').length;
        return doorCount === 2 ? null : `door count = ${doorCount}, expected 2`;
      },
    },

    // ----- H) mergeBlocks (Phase 4) — cross-grid merge + unsplit keepIdx -----
    {
      name: 'H1: unsplitBlockIntra keepIdx=0 → giữ sub L/B',
      run: () => {
        const before: CellBlock[] = [{ r: 0, c: 0, rs: 1, cs: 1, t: 'door>drawer' }];
        const after = unsplitBlockIntra(before, 0, 0, 0);
        const t = findBlockAt(after, 0, 0)?.t;
        return t === 'door' ? null : `expected 'door', got '${t}'`;
      },
    },
    {
      name: 'H2: unsplitBlockIntra keepIdx=1 → giữ sub R/T',
      run: () => {
        const before: CellBlock[] = [{ r: 0, c: 0, rs: 1, cs: 1, t: 'door>drawer' }];
        const after = unsplitBlockIntra(before, 0, 0, 1);
        const t = findBlockAt(after, 0, 0)?.t;
        return t === 'drawer' ? null : `expected 'drawer', got '${t}'`;
      },
    },
    {
      name: 'H3: mergeBlocks right — 2 ô 1×1 → 1 ô 1×2',
      run: () => {
        const before: CellBlock[] = [
          { r: 0, c: 0, rs: 1, cs: 1, t: 'open-back' },
          { r: 0, c: 1, rs: 1, cs: 1, t: 'open-nobk' },
        ];
        const after = mergeBlocks(before, 0, 0, 'right');
        if (after.length !== 1) return `expected 1 block, got ${after.length}`;
        const m = after[0];
        if (m.r !== 0 || m.c !== 0 || m.rs !== 1 || m.cs !== 2) {
          return `wrong dims: ${JSON.stringify(m)}`;
        }
        if (m.t !== 'open-back') return `expected t='open-back' (src), got '${m.t}'`;
        return null;
      },
    },
    {
      name: 'H4: mergeBlocks down — 2 ô 1×1 → 1 ô 2×1',
      run: () => {
        const before: CellBlock[] = [
          { r: 0, c: 0, rs: 1, cs: 1, t: 'a' },
          { r: 1, c: 0, rs: 1, cs: 1, t: 'b' },
        ];
        const after = mergeBlocks(before, 0, 0, 'down');
        const m = after.find((b) => b.r === 0 && b.c === 0);
        if (m?.rs !== 2 || m?.cs !== 1) return `wrong: ${JSON.stringify(m)}`;
        if (m.t !== 'a') return `t mismatch`;
        return null;
      },
    },
    {
      name: 'H5: mergeBlocks left — neighbor bên trái',
      run: () => {
        const before: CellBlock[] = [
          { r: 0, c: 0, rs: 1, cs: 1, t: 'a' },
          { r: 0, c: 1, rs: 1, cs: 1, t: 'b' },
        ];
        const after = mergeBlocks(before, 0, 1, 'left');
        const m = after[0];
        if (m.cs !== 2 || m.t !== 'b') return `expected cs=2, t='b' (src), got cs=${m.cs}, t='${m.t}'`;
        return null;
      },
    },
    {
      name: 'H6: mergeBlocks up — neighbor bên trên',
      run: () => {
        const before: CellBlock[] = [
          { r: 0, c: 0, rs: 1, cs: 1, t: 'a' },
          { r: 1, c: 0, rs: 1, cs: 1, t: 'b' },
        ];
        const after = mergeBlocks(before, 1, 0, 'up');
        const m = after[0];
        if (m.rs !== 2 || m.t !== 'b') return `expected rs=2, t='b' (src), got rs=${m.rs}, t='${m.t}'`;
        return null;
      },
    },
    {
      name: 'H7: mergeBlocks throw khi sub-split (cần unsplit trước)',
      run: () => {
        const before: CellBlock[] = [
          { r: 0, c: 0, rs: 1, cs: 1, t: 'open-back>door' },
          { r: 0, c: 1, rs: 1, cs: 1, t: 'open-back' },
        ];
        try {
          mergeBlocks(before, 0, 0, 'right');
          return 'expected throw';
        } catch (e) {
          const msg = (e as Error).message;
          return msg.includes('sub-split') ? null : `wrong error: ${msg}`;
        }
      },
    },
    {
      name: 'H8: mergeBlocks throw khi axis-perpendicular size không khớp',
      run: () => {
        // src 1×1 + neighbor below 1×2 → cùng col=0, src.cs=1 nhưng neighbor.cs=2 → không match.
        const before: CellBlock[] = [
          { r: 0, c: 0, rs: 1, cs: 1, t: 'a' },
          { r: 1, c: 0, rs: 1, cs: 2, t: 'b' },
        ];
        try {
          mergeBlocks(before, 0, 0, 'down');
          return 'expected throw';
        } catch (e) {
          const msg = (e as Error).message;
          return msg.includes('hình chữ nhật') || msg.includes('rộng khác') || msg.includes('cao khác')
            ? null
            : `wrong error: ${msg}`;
        }
      },
    },
    {
      name: 'H9: mergeBlocks throw khi không có ô láng giềng (biên)',
      run: () => {
        const before: CellBlock[] = [{ r: 0, c: 0, rs: 1, cs: 1, t: 'a' }];
        try {
          mergeBlocks(before, 0, 0, 'left');
          return 'expected throw';
        } catch (e) {
          const msg = (e as Error).message;
          return msg.includes('láng giềng') ? null : `wrong error: ${msg}`;
        }
      },
    },
    {
      name: 'H10: merge giữa 2 block 1×2 (đã merged trước) → 1 block 2×2',
      run: () => {
        // 2 block 1×2 (đã merged row-wise) cùng col → có thể merge tiếp xuống.
        const before: CellBlock[] = [
          { r: 0, c: 0, rs: 1, cs: 2, t: 'wide-top' },
          { r: 1, c: 0, rs: 1, cs: 2, t: 'wide-bot' },
        ];
        const after = mergeBlocks(before, 0, 0, 'down');
        if (after.length !== 1) return `expected 1 block, got ${after.length}`;
        const m = after[0];
        if (m.r !== 0 || m.c !== 0 || m.rs !== 2 || m.cs !== 2) {
          return `wrong dims: ${JSON.stringify(m)}`;
        }
        return null;
      },
    },

    // ----- I) Build integration với cross-grid merge -----
    {
      name: 'I1: build với cross-merge 1×2 (rs=1, cs=2) → vách giữa biến mất',
      run: () => {
        // Baseline 1×2: vách = 3 (k=0, 1, 2), kệ = 0 (rows=1).
        // Sau merge: 1 block cs=2 → vách k=1 SKIP (sameBlock) → vách = 2.
        const v: ParamValues = {
          ...defaults(),
          columns: 2,
          rows: 1,
          widthMode: 'manual',
          heightMode: 'manual',
          colW_0: 400,
          colW_1: 400,
          tierH_0: 500,
        };
        v.cells = encodeBlocks([{ r: 0, c: 0, rs: 1, cs: 2, t: 'open-back' }]);
        const result = tuKe.build(v);
        const vachCount = result.parts.filter((p) => p.label === 'Vách đứng').length;
        return vachCount === 2 ? null : `expected vách=2 (no vách giữa), got ${vachCount}`;
      },
    },
    {
      name: 'H11: unmergeBlocks — block 1×2 → 2 block 1×1 cùng type',
      run: () => {
        const before: CellBlock[] = [{ r: 0, c: 0, rs: 1, cs: 2, t: 'open-nobk' }];
        const after = unmergeBlocks(before, 0, 0);
        if (after.length !== 2) return `expected 2 blocks, got ${after.length}`;
        const ok = after.every((b) => b.rs === 1 && b.cs === 1 && b.t === 'open-nobk');
        if (!ok) return `not all 1×1 same type: ${JSON.stringify(after)}`;
        return null;
      },
    },
    {
      name: 'H12: unmergeBlocks — block 2×2 → 4 block 1×1',
      run: () => {
        const before: CellBlock[] = [{ r: 0, c: 0, rs: 2, cs: 2, t: 'a' }];
        const after = unmergeBlocks(before, 1, 1);
        return after.length === 4 ? null : `expected 4 blocks, got ${after.length}`;
      },
    },
    {
      name: 'H13: unmergeBlocks no-op khi block đã 1×1',
      run: () => {
        const before: CellBlock[] = [{ r: 0, c: 0, rs: 1, cs: 1, t: 'a' }];
        const after = unmergeBlocks(before, 0, 0);
        return after.length === 1 && after[0].rs === 1 ? null : 'should be no-op';
      },
    },
    {
      name: 'H14: merge → override → unmerge restore types (lossless)',
      run: () => {
        // 2 ô khác type, merge → override 'open-nobk', unmerge → restore types cũ.
        let blocks: CellBlock[] = [
          { r: 0, c: 0, rs: 1, cs: 1, t: 'drawer' },
          { r: 0, c: 1, rs: 1, cs: 1, t: 'door' },
        ];
        blocks = mergeBlocks(blocks, 0, 0, 'right');
        // Verify pre đã populated
        const merged = findBlockAt(blocks, 0, 0);
        if (!merged?.pre || merged.pre.length !== 2) return `pre missing: ${JSON.stringify(merged)}`;
        if (merged.pre[0] !== 'drawer' || merged.pre[1] !== 'door') {
          return `pre wrong: ${JSON.stringify(merged.pre)}`;
        }
        // Override t (mô phỏng Configurator) — pre preserved.
        blocks = blocks.map((b) =>
          b === merged ? { ...b, t: 'open-nobk' } : b,
        );
        // Unmerge → restore.
        blocks = unmergeBlocks(blocks, 0, 0);
        if (blocks.length !== 2) return `expected 2 blocks, got ${blocks.length}`;
        const b00 = findBlockAt(blocks, 0, 0);
        const b01 = findBlockAt(blocks, 0, 1);
        if (b00?.t !== 'drawer') return `(0,0) expected 'drawer', got '${b00?.t}'`;
        if (b01?.t !== 'door') return `(0,1) expected 'door', got '${b01?.t}'`;
        return null;
      },
    },
    {
      name: 'H15: merge → unmerge → re-merge → unmerge: pre data ổn định',
      run: () => {
        let blocks: CellBlock[] = [
          { r: 0, c: 0, rs: 1, cs: 1, t: 'open-back' },
          { r: 0, c: 1, rs: 1, cs: 1, t: 'open-nobk' },
        ];
        blocks = mergeBlocks(blocks, 0, 0, 'right');
        blocks = blocks.map((b) =>
          b.rs > 1 || b.cs > 1 ? { ...b, t: 'open-nobk' } : b,
        );
        blocks = unmergeBlocks(blocks, 0, 0);
        // Re-merge
        blocks = mergeBlocks(blocks, 0, 0, 'right');
        blocks = blocks.map((b) =>
          b.rs > 1 || b.cs > 1 ? { ...b, t: 'open-nobk' } : b,
        );
        blocks = unmergeBlocks(blocks, 0, 0);
        const b00 = findBlockAt(blocks, 0, 0);
        const b01 = findBlockAt(blocks, 0, 1);
        if (b00?.t !== 'open-back') return `(0,0) expected 'open-back', got '${b00?.t}'`;
        if (b01?.t !== 'open-nobk') return `(0,1) expected 'open-nobk', got '${b01?.t}'`;
        return null;
      },
    },
    {
      name: 'H16: merge 2×2 (4 cells khác type) → unmerge restore tất cả',
      run: () => {
        // Bước 1: merge 2 cell row 0 → 1×2 block với pre=[a,b].
        // Bước 2: merge 2 cell row 1 → 1×2 block với pre=[c,d].
        // Bước 3: merge 2 row đó → 2×2 block với pre=[a,b,c,d].
        // Bước 4: unmerge → 4 block 1×1 với types đúng vị trí.
        let blocks: CellBlock[] = [
          { r: 0, c: 0, rs: 1, cs: 1, t: 'a' },
          { r: 0, c: 1, rs: 1, cs: 1, t: 'b' },
          { r: 1, c: 0, rs: 1, cs: 1, t: 'c' },
          { r: 1, c: 1, rs: 1, cs: 1, t: 'd' },
        ];
        blocks = mergeBlocks(blocks, 0, 0, 'right'); // row 0 → 1×2 pre=[a,b]
        blocks = mergeBlocks(blocks, 1, 0, 'right'); // row 1 → 1×2 pre=[c,d]
        blocks = mergeBlocks(blocks, 0, 0, 'down');  // gộp dọc → 2×2 pre=[a,b,c,d]
        const big = findBlockAt(blocks, 0, 0);
        if (!big || big.rs !== 2 || big.cs !== 2) return `big block wrong: ${JSON.stringify(big)}`;
        const expectedPre = ['a', 'b', 'c', 'd'];
        if (!big.pre || big.pre.length !== 4) return `pre missing/wrong length`;
        for (let i = 0; i < 4; i++) {
          if (big.pre[i] !== expectedPre[i]) return `pre[${i}] = '${big.pre[i]}', expected '${expectedPre[i]}'`;
        }
        // Unmerge → 4 block 1×1.
        blocks = unmergeBlocks(blocks, 0, 0);
        if (blocks.length !== 4) return `expected 4 blocks, got ${blocks.length}`;
        const cells = [
          [0, 0, 'a'], [0, 1, 'b'], [1, 0, 'c'], [1, 1, 'd'],
        ] as const;
        for (const [r, c, want] of cells) {
          const b = findBlockAt(blocks, r, c);
          if (b?.t !== want) return `(${r},${c}) expected '${want}', got '${b?.t}'`;
        }
        return null;
      },
    },
    {
      name: 'H17: encode/parse blocks với pre data — roundtrip',
      run: () => {
        const original: CellBlock[] = [
          { r: 0, c: 0, rs: 1, cs: 2, t: 'open-nobk', pre: ['drawer', 'door'] },
          { r: 1, c: 0, rs: 1, cs: 1, t: 'open-back' },
        ];
        const encoded = encodeBlocks(original);
        const parsed = parseBlocks(encoded);
        if (parsed.length !== 2) return `length mismatch`;
        if (parsed[0].pre?.[0] !== 'drawer' || parsed[0].pre?.[1] !== 'door') {
          return `pre roundtrip: ${JSON.stringify(parsed[0].pre)}`;
        }
        if (parsed[0].t !== 'open-nobk') return `t mismatch: ${parsed[0].t}`;
        if (parsed[1].pre !== undefined) return `parsed[1] should have no pre`;
        return null;
      },
    },
    {
      name: 'I2: build với cross-merge 2×1 (rs=2, cs=1) → kệ segment bỏ qua col bị merge',
      run: () => {
        // 2 col × 2 row. Col 0 có merged block 2×1, col 1 vẫn 2 ô 1×1.
        // Kệ giữa row 0/1: col 0 cùng block → skip; col 1 khác block → render segment.
        const v: ParamValues = {
          ...defaults(),
          columns: 2,
          rows: 2,
          widthMode: 'manual',
          heightMode: 'manual',
          colW_0: 400,
          colW_1: 400,
          tierH_0: 400,
          tierH_1: 400,
        };
        v.cells = encodeBlocks([
          { r: 0, c: 0, rs: 2, cs: 1, t: 'open-back' }, // merged 2 row col 0
          { r: 0, c: 1, rs: 1, cs: 1, t: 'open-back' },
          { r: 1, c: 1, rs: 1, cs: 1, t: 'open-back' },
        ]);
        const result = tuKe.build(v);
        const keCount = result.parts.filter((p) => p.label === 'Kệ').length;
        return keCount === 1 ? null : `expected kệ=1 segment (chỉ col 1), got ${keCount}`;
      },
    },
  ];
}

function runCodecTests(): { passed: number; total: number } {
  const cases = buildCodecCases();
  console.log(`\nChạy block-list codec qua ${cases.length} cấu hình:`);
  let passed = 0;
  for (const c of cases) {
    const err = c.run();
    if (err === null) {
      passed++;
      console.log(`  PASS  ${c.name}`);
    } else {
      console.log(`  FAIL  ${c.name}: ${err}`);
    }
  }
  return { passed, total: cases.length };
}

// =============================================================
// EDGE-BANDING TESTS — P49. Dán cạnh là option độc lập (same/black/white):
// khung/vách theo lựa chọn khách, cánh/ngăn kéo LUÔN 'same', plywood lộ cạnh.
// =============================================================
// =============================================================
// NESTING ĐA-MÀU — P56. Khoá vĩnh viễn: 2 màu khác nhau KHÔNG bao giờ cắt chung
// 1 tấm (bất khả thi vật lý) → mỗi màu nest riêng → số tấm + giá đúng. Tủ 1 màu
// giữ nguyên hành vi. Dùng nestBoards trực tiếp với khổ ván mẫu.
// =============================================================
// =============================================================
// MARGIN theo THỂ TÍCH — P60. Khoá: margin nội suy theo m³, plateau 2 đầu.
// P72: ĐÃ BỎ phụ trội theo số ngăn/cánh — test (d) khoá field thừa bị bỏ qua.
// =============================================================
function runMarginTests(): { passed: number; total: number } {
  const results: { name: string; ok: boolean; detail?: string }[] = [];
  const T = (name: string, ok: boolean, detail?: string) => results.push({ name, ok, detail });
  const cfg = {
    margin: 1.6,
    marginTiers: DEFAULT_MARGIN_TIERS,
  } as unknown as PriceConfig;
  const near = (a: number, b: number) => Math.abs(a - b) < 0.001;

  // (a) Tủ nhỏ (≤ anchor đầu 0.15 m³) → margin đáy 1.25 (phễu).
  T('Nhỏ 0.10 m³ → ×1.25 (phễu)', near(computeMargin(0.1, cfg), 1.25));
  // (b) Tủ to (≥ anchor cuối 2.5 m³) → plateau 2.10.
  T('To 3.0 m³ → ×2.10 (plateau)', near(computeMargin(3.0, cfg), 2.1));
  // (c) Nội suy giữa anchor: 0.6 m³ giữa 0.4(1.40)–0.8(1.60) → 1.50.
  T('Giữa 0.60 m³ → ×1.50 (nội suy)', near(computeMargin(0.6, cfg), 1.5));
  // (d) P72 — KV cũ còn complexityBonus* → engine BỎ QUA (margin thuần theo thể tích).
  const cfgStray = {
    ...cfg,
    complexityBonusPerUnit: 0.006,
    complexityBonusMax: 0.12,
  } as unknown as PriceConfig;
  T('P72: bonus thừa trong config → bị bỏ qua', near(computeMargin(0.6, cfgStray), 1.5));

  const passed = results.filter((r) => r.ok).length;
  console.log('\nChạy margin theo thể tích (P60/P72) qua probe:');
  for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);
  return { passed, total: results.length };
}

// P61 — CÁNH (có hậu) cho ô GỘP. Build TRỰC TIẾP (blocks format không qua
// runPipeline vì reconcileCellGrid mangle). Kiểm: số lá + 1 tấm lưng + bản lề
// đúng vách ngoài + cup khớp plate + KHÔNG vướng đợt ngang.
// P77 — tay nắm + chân tủ ĐỌC spec (trước hằng cứng). Build trực tiếp với
// machiningSpec override để chứng minh hết hằng + clamp an toàn.
function runHandleFootSpecTests(): { passed: number; total: number } {
  const results: { name: string; ok: boolean; detail?: string }[] = [];
  const T = (name: string, ok: boolean, detail?: string) => results.push({ name, ok, detail });
  const doorCfg = (handleType: string): ParamValues => ({
    ...defaults(),
    columns: 1, rows: 1, widthMode: 'manual', heightMode: 'manual',
    colW_0: 400, tierH_0: 450, handleType, cells: 'door',
  });
  const buildSpec = (v: ParamValues, machiningSpec: unknown): BuildResult =>
    tuKe.build(v, { priceConfig: { ...tuKe.priceConfig, machiningSpec } } as Parameters<typeof tuKe.build>[1]);
  const handleDias = (b: BuildResult) =>
    b.parts
      .filter((p) => p.label === 'Cánh tủ')
      .flatMap((p) => p.machining ?? [])
      .filter((m) => m.purpose === 'handle')
      .map((m) => (m.op === 'drill' ? m.diameter_mm : -1));

  // 1. Tay nắm TRÒN — Ø lỗ đọc spec.handle.recessedDia (đổi 32 → lỗ Ø32; default 35).
  {
    const dias = handleDias(buildSpec(doorCfg('round'), { handle: { recessedDia: 32 } }));
    T('P77: tay nắm tròn đọc recessedDia=32 → lỗ Ø32',
      dias.length > 0 && dias.every((d) => Math.abs(d - 32) < 0.1), `Ø=${[...new Set(dias)].join(',')}`);
    const def = handleDias(tuKe.build(doorCfg('round')));
    T('P77: default tay nắm tròn vẫn Ø35',
      def.length > 0 && def.every((d) => Math.abs(d - 35) < 0.1), `Ø=${[...new Set(def)].join(',')}`);
  }

  // 2. Tay nắm BAR — barSpacing to (200) phải CLAMP trong thân thanh (2 vít cách ≤ chiều thanh).
  {
    const b = buildSpec(doorCfg('bar'), { handle: { barSpacing: 200 } });
    const door = b.parts.find((p) => p.label === 'Cánh tủ');
    const barLen = Math.min(100, door ? Math.max(door.size[0], door.size[1]) - 60 : 0);
    // 2 lỗ vít 'handle' trên cánh: khoảng cách theo trục dài cánh.
    const xs = (door?.machining ?? [])
      .filter((m): m is Extract<Machining, { op: 'drill' }> => m.op === 'drill' && m.purpose === 'handle')
      .map((m) => (door!.size[0] >= door!.size[1] ? m.x_mm : m.y_mm))
      .sort((a, b2) => a - b2);
    const span = xs.length >= 2 ? xs[xs.length - 1] - xs[0] : 0;
    T('P77: tay nắm bar — barSpacing 200 clamp trong thân thanh',
      xs.length === 2 && span > 0 && span <= barLen, `span=${span.toFixed(0)} len=${barLen}`);
  }

  // 3. Chân tủ — insetFromEdge nhỏ (45) phải CLAMP ≥85 (lỗ chân không đè rãnh connector).
  {
    const v: ParamValues = { ...defaults(), depth: 300 };
    const b = buildSpec(v, { foot: { insetFromEdge: 45 } });
    const bottom = b.parts.find((p) => p.label === 'Tấm đáy');
    const D = 300;
    const insets = (bottom?.machining ?? [])
      .filter((m): m is Extract<Machining, { op: 'drill' }> => m.op === 'drill' && m.purpose === 'foot')
      .map((m) => Math.min(m.y_mm, D - m.y_mm)); // khoảng cách lỗ tới mép trước/sau
    T('P77: chân tủ insetFromEdge=45 → clamp ≥85 (không đè rãnh)',
      insets.length > 0 && insets.every((i) => i >= 84.5), `inset=${[...new Set(insets.map((i) => i.toFixed(0)))].join(',')}`);
    // không đè rãnh connector: mọi cặp foot×slot trên đáy không giao.
    const mach = bottom?.machining ?? [];
    let overlap = false;
    for (const f of mach) {
      if (f.op !== 'drill' || f.purpose !== 'foot') continue;
      for (const s of mach) {
        if (s.op !== 'slot') continue;
        const dx = Math.abs(f.x_mm - s.x_mm), dy = Math.abs(f.y_mm - s.y_mm);
        const longH = s.length_mm / 2 + f.diameter_mm / 2, wideH = s.width_mm / 2 + f.diameter_mm / 2;
        if (s.along === 'width' ? dx < wideH && dy < longH : dx < longH && dy < wideH) overlap = true;
      }
    }
    T('P77: chân không đè rãnh connector (D=300, ca chật)', !overlap);
  }

  // 4. Chân tủ — positionsPerDivider=1 → 1 chân/vách (z giữa), BOM khớp machining.
  {
    const b = buildSpec({ ...defaults() }, { foot: { positionsPerDivider: 1 } });
    const bottom = b.parts.find((p) => p.label === 'Tấm đáy');
    const footHoles = (bottom?.machining ?? []).filter((m) => m.purpose === 'foot').length;
    const footBom = b.hardware.find((h) => h.id === 'foot')?.qty ?? 0;
    const cols = Number(defaults().columns);
    T('P77: positionsPerDivider=1 → 1 chân/vách + BOM khớp',
      footHoles === cols + 1 && footBom === footHoles, `lỗ=${footHoles} bom=${footBom} vách=${cols + 1}`);
  }

  const passed = results.filter((r) => r.ok).length;
  console.log('\nChạy TAY NẮM + CHÂN TỦ đọc spec (P77) qua probe:');
  for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : ' — ' + (r.detail ?? '')}`);
  return { passed, total: results.length };
}

function runMergedDoorTests(): { passed: number; total: number } {
  const results: { name: string; ok: boolean; detail?: string }[] = [];
  const T = (name: string, ok: boolean, detail?: string) => results.push({ name, ok, detail });
  const baseManual = (extra: Record<string, number | string>): ParamValues => ({
    ...defaults(),
    widthMode: 'manual',
    heightMode: 'manual',
    ...extra,
  });
  const cupCount = (parts: BuildResult['parts']) =>
    parts
      .filter((p) => p.label === 'Cánh tủ')
      .reduce(
        (s, d) => s + (d.machining?.filter((m) => m.purpose === 'hinge' && m.op === 'pocket').length ?? 0),
        0,
      );
  const platePairs = (parts: BuildResult['parts']) => sumPurpose(parts, 'Vách đứng', 'hinge') / 2;
  const vachWithHinge = (parts: BuildResult['parts']) =>
    parts.filter(
      (p) => p.label === 'Vách đứng' && (p.machining ?? []).some((m) => m.purpose === 'hinge'),
    ).length;

  // --- Test 1: cánh ĐÔI gộp ngang 1×2 (rộng > 600) ---
  {
    const v = baseManual({ columns: 2, rows: 1, colW_0: 600, colW_1: 600, tierH_0: 500 });
    v.cells = encodeBlocks([{ r: 0, c: 0, rs: 1, cs: 2, t: 'door' }]);
    const b = tuKe.build(v);
    const doors = b.parts.filter((p) => p.label === 'Cánh tủ');
    const backs = b.parts.filter((p) => p.label === 'Tấm lưng');
    T(
      'Gộp ngang 1×2 rộng → 2 lá cánh + ĐÚNG 1 tấm lưng',
      doors.length === 2 && backs.length === 1,
      `lá=${doors.length} lưng=${backs.length}`,
    );
    T('Cánh đôi gộp → bản lề trên 2 vách ngoài KHÁC NHAU', vachWithHinge(b.parts) === 2, `vách có bản lề=${vachWithHinge(b.parts)}`);
    T(
      'Cánh đôi gộp → cup cánh KHỚP cụm plate vách (4=4)',
      cupCount(b.parts) === platePairs(b.parts) && cupCount(b.parts) === 4,
      `cup=${cupCount(b.parts)} plate=${platePairs(b.parts)}`,
    );
  }

  // --- Test 2: cánh ĐƠN gộp ngang 1×2 (hẹp ≤ 600) ---
  {
    const v = baseManual({ columns: 2, rows: 1, colW_0: 260, colW_1: 260, tierH_0: 500 });
    v.cells = encodeBlocks([{ r: 0, c: 0, rs: 1, cs: 2, t: 'door' }]);
    const b = tuKe.build(v);
    const doors = b.parts.filter((p) => p.label === 'Cánh tủ');
    const backs = b.parts.filter((p) => p.label === 'Tấm lưng');
    T('Gộp ngang 1×2 hẹp → 1 lá cánh + 1 tấm lưng', doors.length === 1 && backs.length === 1, `lá=${doors.length} lưng=${backs.length}`);
    T('Cánh đơn gộp → bản lề trên 1 vách', vachWithHinge(b.parts) === 1, `vách có bản lề=${vachWithHinge(b.parts)}`);
    T('Cánh đơn gộp → cup khớp plate', cupCount(b.parts) === platePairs(b.parts), `cup=${cupCount(b.parts)} plate=${platePairs(b.parts)}`);
  }

  // --- Test 3: cánh gộp DỌC 2×1 (rộng) + đợt ngang cột bên cạnh → KHÔNG vướng ---
  // P75: tierH ghi 450 TƯỜNG MINH (440 cũ bị snap nấc {150,250,350,450} → mốc đợt
  // trong test lệch 10mm); đo theo TÂM bản lề (= điểm giữa cặp vít bát cách nhau 32)
  // đúng thiết kế keepout P61 — đo theo từng vít sẽ trừ oan 16mm.
  {
    const v = baseManual({ depth: 400, columns: 2, rows: 2, colW_0: 650, colW_1: 400, tierH_0: 450, tierH_1: 450 });
    v.cells = encodeBlocks([
      { r: 0, c: 0, rs: 2, cs: 1, t: 'door' },
      { r: 0, c: 1, rs: 1, cs: 1, t: 'open-back' },
      { r: 1, c: 1, rs: 1, cs: 1, t: 'open-back' },
    ]);
    const b = tuKe.build(v);
    const doors = b.parts.filter((p) => p.label === 'Cánh tủ');
    T('Gộp dọc 2×1 (cột 650) → 2 lá cánh (đôi)', doors.length === 2, `lá=${doors.length}`);
    // faceH = 450+18+450−4 = 914 ≥ 900 → P75 mỗi lá 3 bản lề.
    const cups = cupCount(b.parts);
    T('Cánh gộp cao 914 → 3 bản lề mỗi lá (P75 ngưỡng 900)', cups === 6, `cup=${cups}`);
    // đợt ngang cột 1 tại ranh giới tầng g=0 (post-shift FOOT_H=5): joint = T + 450 + T/2 + 5.
    const Tb = 18;
    const joint = Tb + 450 + Tb / 2 + 5;
    // Gom cặp vít (cách nhau 32) → tâm bản lề — gom TRONG TỪNG part vách (2 lá
    // nằm trên 2 vách khác nhau, trộn chung sẽ ghép cặp chéo part).
    const centers: number[] = [];
    for (const p of b.parts.filter((p) => p.label === 'Vách đứng')) {
      const ys: number[] = [];
      for (const m of p.machining ?? []) {
        if (m.purpose === 'hinge' && m.op === 'drill') {
          // Vách size=[T,height,D]: trục đứng = x_mm nếu height≥D, ngược lại y_mm.
          const local = p.size[1] >= p.size[2] ? m.x_mm : m.y_mm;
          ys.push(local + p.position[1] - p.size[1] / 2);
        }
      }
      ys.sort((a, b2) => a - b2);
      for (let i = 0; i + 1 < ys.length; i += 2) centers.push((ys[i] + ys[i + 1]) / 2);
    }
    const minClear = centers.length ? Math.min(...centers.map((y) => Math.abs(y - joint))) : -1;
    T(
      'Bản lề cánh gộp dọc KHÔNG vướng đợt ngang (tâm ≥45mm)',
      centers.length > 0 && minClear >= 45,
      `min tâm cách đợt=${minClear.toFixed(0)}mm (n=${centers.length})`,
    );
  }

  const passed = results.filter((r) => r.ok).length;
  console.log('\nChạy CÁNH ô GỘP (P61) qua probe:');
  for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : ' — ' + (r.detail ?? '')}`);
  return { passed, total: results.length };
}

function runNestingTests(): { passed: number; total: number } {
  const results: { name: string; ok: boolean; detail?: string }[] = [];
  const T = (name: string, ok: boolean, detail?: string) => results.push({ name, ok, detail });

  const BOARD = [
    { id: 'mfc18', materialId: 'mfc_melamine', label: 'MFC18', lengthMm: 2440, widthMm: 1220, thicknessMm: 18 },
  ] as unknown as CatalogBoard[];
  const KERF = 3;
  type NP = Pick<Part, 'id' | 'label' | 'length_mm' | 'width_mm' | 'thickness_mm' | 'material' | 'grain'>;
  const mk = (mat: string, n: number, tag: string): NP[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `${tag}-${i}`, label: `${tag}${i}`, length_mm: 700, width_mm: 350,
      thickness_mm: 18, material: mat, grain: 'length' as const,
    }));
  const matsPerSheet = (parts: NP[], r: ReturnType<typeof nestBoards>) => {
    const byId = new Map(parts.map((p) => [p.id, p.material]));
    return r.boards.map((b) => new Set(b.placements.map((pl) => byId.get(pl.partId))));
  };

  // (a) 1 màu (regression): xếp được, không tấm nào trộn (hiển nhiên), không unplaced.
  {
    const parts = mk('mfc_melamine/ml_xanh_navy', 12, 'navy');
    const r = nestBoards(parts, BOARD, KERF);
    const noMix = matsPerSheet(parts, r).every((s) => s.size <= 1);
    T('1 màu: xếp được, không trộn, không unplaced', noMix && r.boards.length > 0 && r.unplaced.length === 0);
  }
  // (b) LÕI FIX: 2 màu cùng gốc → KHÔNG tấm nào chứa 2 màu.
  {
    const parts = [...mk('mfc_melamine/ml_xanh_navy', 6, 'navy'), ...mk('mfc_melamine/ml_do_san_ho', 6, 'coral')];
    const r = nestBoards(parts, BOARD, KERF);
    const mixed = matsPerSheet(parts, r).filter((s) => s.size > 1).length;
    T('2 màu cùng gốc: KHÔNG tấm nào trộn 2 màu', mixed === 0, `${mixed}/${r.boards.length} tấm trộn`);
  }
  // (c) 2 màu mỗi màu 1 part → 2 tấm RIÊNG (không nhồi chung 1 tấm như lỗi cũ).
  {
    const parts = [...mk('mfc_melamine/ml_xanh_navy', 1, 'navy'), ...mk('mfc_melamine/ml_do_san_ho', 1, 'coral')];
    const r = nestBoards(parts, BOARD, KERF);
    T('2 màu × 1 part: tách 2 tấm riêng', r.boards.length === 2, `numSheets=${r.boards.length}`);
  }
  // (d) materialId mỗi tấm = full màu (cho DXF + tách màu chuẩn).
  {
    const parts = mk('mfc_melamine/ml_olive', 3, 'olive');
    const r = nestBoards(parts, BOARD, KERF);
    T('materialId tấm = full màu', r.boards.length > 0 && r.boards.every((b) => b.materialId === 'mfc_melamine/ml_olive'));
  }

  const passed = results.filter((r) => r.ok).length;
  console.log('\nChạy nesting đa-màu (P56) qua probe:');
  for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${!r.ok && r.detail ? ` — ${r.detail}` : ''}`);
  return { passed, total: results.length };
}

// P64 — Cắt khổ nửa/phần tư giảm hao hụt. Kiểm reclassify + laborSheets quy đổi.
function runNestSplitTests(): { passed: number; total: number } {
  const results: { name: string; ok: boolean; detail?: string }[] = [];
  const T = (name: string, ok: boolean, detail?: string) => results.push({ name, ok, detail });
  const BOARD = [
    { id: 'b18', materialId: 'mfc_melamine', label: 'b', lengthMm: 2440, widthMm: 1220, thicknessMm: 18 },
  ] as unknown as CatalogBoard[];
  const KERF = 3;
  type NP = Pick<Part, 'id' | 'label' | 'length_mm' | 'width_mm' | 'thickness_mm' | 'material' | 'grain'>;
  const mk = (n: number, L: number, W: number): NP[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `p${i}`, label: `p${i}`, length_mm: L, width_mm: W,
      thickness_mm: 18, material: 'mfc_melamine/x', grain: 'length' as const,
    }));

  // (a) 1 tấm nhỏ (600×400) → cắt PHẦN TƯ khổ (fraction 0.25, diện tích = 1/4 khổ full).
  {
    const b = nestBoards(mk(1, 600, 400), BOARD, KERF).boards[0];
    const quarterArea = (2440 * 1220) / 4;
    T('1 tấm nhỏ → PHẦN TƯ khổ (0.25)', !!b && b.fraction === 0.25 && Math.abs(b.boardLength * b.boardWidth - quarterArea) < 1, `fraction=${b?.fraction} khổ=${b?.boardLength}×${b?.boardWidth}`);
  }
  // (b) 1 tấm dài full-length cao nửa (2400×600) → NỬA khổ (cắt theo rộng).
  {
    const b = nestBoards(mk(1, 2400, 600), BOARD, KERF).boards[0];
    T('Tấm dài, cao nửa → NỬA khổ (0.5)', !!b && b.fraction === 0.5, `fraction=${b?.fraction}`);
  }
  // (c) Tiền công quy đổi: 1 tấm nhỏ → laborSheets 0.25 < numSheets 1.
  {
    const cost = computeNestingCost(mk(1, 600, 400), BOARD, { kerfMm: KERF });
    T('Tiền công quy đổi theo phần khổ (0.25 < 1)', cost.laborSheets === 0.25 && cost.numSheets === 1 && cost.boardBreakdown.quarter === 1, `laborSheets=${cost.laborSheets} qtr=${cost.boardBreakdown.quarter}`);
  }
  // (d) Tấm lấp gần hết khổ → giữ NGUYÊN (fraction 1, không cắt nhầm).
  {
    const r = nestBoards(mk(8, 1200, 595), BOARD, KERF);
    const full = r.boards.filter((b) => (b.fraction ?? 1) === 1).length;
    T('Tấm lấp gần hết → giữ NGUYÊN khổ', full >= 1, `fractions=[${r.boards.map((b) => b.fraction).join(',')}]`);
  }
  // (e) util tính theo khổ ĐÃ CẮT (tấm nhỏ trên phần tư → util > 8% của khổ full).
  {
    const b = nestBoards(mk(1, 600, 400), BOARD, KERF).boards[0];
    T('util tính theo khổ đã cắt (>25%)', !!b && b.utilization > 0.25, `util=${((b?.utilization ?? 0) * 100).toFixed(0)}%`);
  }
  // (f) P64.8 — Util TỔNG theo DIỆN TÍCH (area-weighted), KHÁC trung bình cộng khi
  //     khổ khác nhau. 1 tấm nguyên (util cao) + 1 tấm phần tư (util thấp) màu khác.
  {
    const A = Array.from({ length: 4 }, (_, i) => ({
      id: `A${i}`, label: `A${i}`, length_mm: 1200, width_mm: 595,
      thickness_mm: 18, material: 'mfc_melamine/a', grain: 'length' as const,
    }));
    const B = [{
      id: 'B0', label: 'B0', length_mm: 500, width_mm: 400,
      thickness_mm: 18, material: 'mfc_melamine/b', grain: 'length' as const,
    }];
    const r = nestBoards([...A, ...B], BOARD, KERF);
    let tp = 0, tb = 0;
    for (const bd of r.boards) {
      tb += bd.boardLength * bd.boardWidth;
      tp += bd.placements.reduce((s, pl) => s + pl.partLength * pl.partWidth, 0);
    }
    const aw = tb > 0 ? tp / tb : 0; // area-weighted (đúng)
    const simple = r.boards.reduce((s, bd) => s + bd.utilization, 0) / r.boards.length; // trung bình cộng (sai cũ)
    T(
      'Util tổng = theo DIỆN TÍCH (≠ trung bình cộng khi khổ khác nhau)',
      Math.abs(r.avgUtilization - aw) < 0.001 && r.avgUtilization > simple + 0.01,
      `theo-diện-tích=${(aw * 100).toFixed(0)}% · trung-bình-cộng=${(simple * 100).toFixed(0)}% · dùng=${(r.avgUtilization * 100).toFixed(0)}%`,
    );
  }

  // (g) P64.11 — Best-Fit GIỮ mọi board mở → tấm cuối lấp chỗ thừa board #1 thay
  //     vì sinh board #3. Board 1000×1000: A 990×600 (→#1) · B 990×990 (→#2 đầy) ·
  //     C 990×380 (vừa chỗ thừa #1). Next-Fit cũ ra 3 board; Best-Fit ra 2.
  {
    const SQ = [{ id: 'sq', materialId: 'mfc_melamine', label: 'sq', lengthMm: 1000, widthMm: 1000, thicknessMm: 18 }] as unknown as CatalogBoard[];
    const np = (id: string, L: number, W: number): NP => ({ id, label: id, length_mm: L, width_mm: W, thickness_mm: 18, material: 'mfc_melamine/z', grain: 'length' as const });
    const r = nestBoards([np('A', 990, 600), np('B', 990, 990), np('C', 990, 380)], SQ, KERF);
    T('Best-Fit lấp chỗ thừa board cũ → KHÔNG sinh board thừa (2 ≠ 3)', r.boards.length === 2, `số board=${r.boards.length}`);
  }

  const passed = results.filter((r) => r.ok).length;
  console.log('\nChạy CẮT KHỔ nửa/phần tư (P64) qua probe:');
  for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${!r.ok && r.detail ? ` — ${r.detail}` : ''}`);
  return { passed, total: results.length };
}

function runEdgeBandingTests(): { passed: number; total: number } {
  const results: { name: string; ok: boolean; detail?: string }[] = [];
  const T = (name: string, ok: boolean, detail?: string) => results.push({ name, ok, detail });

  const MELAMINE = 'mfc_melamine/ml_xanh_reu'; // dán cạnh được (không noEdgeBanding)
  const PLYWOOD = 'plywood_melamine/ac_vang_nghe'; // lộ cạnh (noEdgeBanding)
  const isDoorDrawer = (id: string) => id.startsWith('door-') || id.startsWith('drawer');
  // Lưới 4×3 ô nhỏ (cell ~377mm) đảm bảo cánh + ngăn kéo KHÔNG bị fallback open-back.
  const cellsMixed = encodeCellGrid([
    ['door', 'drawer', 'open-back'],
    ['drawer', 'door', 'open-nobk'],
    ['door', 'drawer', 'door'],
    ['open-back', 'door', 'drawer'],
  ]);
  const baseMixed = { columns: 3, rows: 4, width: 1200, height: 1600, cells: cellsMixed };

  // (a) Khung melamine + cạnh ĐEN → carcass edgeColor='black' + edgeHex='#000000';
  //     cánh/ngăn kéo edgeColor='same' (edgeHex undefined).
  {
    const b = runPipeline({ ...baseMixed, color: MELAMINE, edgeBanding: 'black' });
    const carcass = b.parts.filter((p) => !isDoorDrawer(p.id));
    const dd = b.parts.filter((p) => isDoorDrawer(p.id));
    const carcassOk =
      carcass.length > 0 && carcass.every((p) => p.edgeColor === 'black' && p.edgeHex === '#000000');
    const ddOk = dd.length > 0 && dd.every((p) => p.edgeColor === 'same' && p.edgeHex === undefined);
    T(
      'Khung melamine + cạnh ĐEN: carcass=black, cánh/ngăn kéo=same',
      carcassOk && ddOk,
      `carcass ${carcass.length} ok=${carcassOk}, door/drawer ${dd.length} ok=${ddOk}`,
    );
  }

  // (b) Khung melamine + ĐỒNG MÀU → carcass edgeColor='same', edgeHex undefined (1-tone).
  {
    const b = runPipeline({ ...baseMixed, color: MELAMINE, edgeBanding: 'same' });
    const carcass = b.parts.filter((p) => !isDoorDrawer(p.id));
    const ok = carcass.length > 0 && carcass.every((p) => p.edgeColor === 'same' && p.edgeHex === undefined);
    T('Khung melamine + ĐỒNG MÀU: edgeHex undefined (1-tone)', ok);
  }

  // (c) Khung melamine + TRẮNG → carcass edgeHex='#FFFFFF'; cánh vẫn 'same'.
  {
    const b = runPipeline({ ...baseMixed, color: MELAMINE, edgeBanding: 'white' });
    const carcass = b.parts.filter((p) => !isDoorDrawer(p.id));
    const dd = b.parts.filter((p) => isDoorDrawer(p.id));
    const ok =
      carcass.length > 0 &&
      carcass.every((p) => p.edgeColor === 'white' && p.edgeHex === '#FFFFFF') &&
      dd.every((p) => p.edgeColor === 'same');
    T('Khung melamine + TRẮNG: carcass=white, cánh=same', ok);
  }

  // (c2) P52 — khung melamine + cạnh MÀU ML (ml_xanh_reu) → carcass edgeColor='ml_xanh_reu'
  //      + edgeHex='#587060' (hex màu ML); cánh/ngăn kéo vẫn 'same'.
  {
    const b = runPipeline({ ...baseMixed, color: MELAMINE, edgeBanding: 'ml_xanh_reu' });
    const carcass = b.parts.filter((p) => !isDoorDrawer(p.id));
    const dd = b.parts.filter((p) => isDoorDrawer(p.id));
    const ok =
      carcass.length > 0 &&
      carcass.every((p) => p.edgeColor === 'ml_xanh_reu' && p.edgeHex === '#587060') &&
      dd.every((p) => p.edgeColor === 'same');
    T('Khung melamine + cạnh ML xanh rêu → carcass=#587060, cánh=same', ok);
  }

  // (d) Khung PLYWOOD lộ cạnh → carcass KHÔNG dán (edgeColor vắng, 4 cạnh false);
  //     build không crash kể cả khi input edgeBanding='black'.
  {
    let crashed = false;
    let b: BuildResult | null = null;
    try {
      b = runPipeline({ ...baseMixed, color: PLYWOOD, edgeBanding: 'black' });
    } catch {
      crashed = true;
    }
    const carcass = b ? b.parts.filter((p) => !isDoorDrawer(p.id)) : [];
    const ok =
      !crashed &&
      b !== null &&
      carcass.length > 0 &&
      carcass.every(
        (p) =>
          p.edgeColor === undefined &&
          !(p.edgeBanding.front || p.edgeBanding.back || p.edgeBanding.left || p.edgeBanding.right),
      );
    T('Khung plywood: carcass lộ cạnh (không dán), không crash', ok, crashed ? 'CRASH' : undefined);
  }

  // (e) P52 — PRESET CŨ tải vào /design: color "..._edge_den" + edgeBanding='same' (init seed
  //     mặc định, KHÔNG phải khách chọn) → PHẢI ÉP 'black' (đè 'same'), strip id gốc. Đây là
  //     đúng luồng thật (init defaults() có sẵn eb='same') — bug cũ ra 'same' vì chỉ kiểm undefined.
  {
    const v = tuKe.normalizeValues!({ ...defaults(), color: 'mfc_melamine/ml_xanh_reu_edge_den' });
    const ok = v.color === 'mfc_melamine/ml_xanh_reu' && v.edgeBanding === 'black';
    T('Preset cũ _edge_den + eb=same(default) → ép black', ok, `color=${v.color} eb=${v.edgeBanding}`);
  }

  // (f) Plywood ép edgeBanding='same' (kể cả input 'black').
  {
    const v = tuKe.normalizeValues!({ ...defaults(), color: PLYWOOD, edgeBanding: 'black' });
    T('Plywood ép edgeBanding=same', v.edgeBanding === 'same', `eb=${v.edgeBanding}`);
  }

  // (g) resolveControls: khung melamine HIỆN option "Dán cạnh"; khung plywood ẨN.
  {
    const cMel = tuKe.resolveControls!(tuKe.normalizeValues!({ ...defaults(), color: MELAMINE }));
    const cPly = tuKe.resolveControls!(tuKe.normalizeValues!({ ...defaults(), color: PLYWOOD }));
    const hasMel = cMel.some((p) => p.id === 'edgeBanding');
    const hasPly = cPly.some((p) => p.id === 'edgeBanding');
    T('resolveControls: melamine hiện / plywood ẩn Dán cạnh', hasMel && !hasPly, `mel=${hasMel} ply=${hasPly}`);
  }

  // (h) ctx.enabledEdgeBands=['same'] → option "Dán cạnh" chỉ còn 'same'.
  {
    const ctrl = tuKe.resolveControls!(
      tuKe.normalizeValues!({ ...defaults(), color: MELAMINE, edgeBanding: 'same' }),
      { enabledEdgeBands: ['same'] },
    );
    const eb = ctrl.find((p) => p.id === 'edgeBanding');
    const vals = eb?.options?.map((o) => o.value) ?? [];
    const ok = vals.length === 1 && vals[0] === 'same';
    T('ctx.enabledEdgeBands=[same] → chỉ hiện same', ok, `options=[${vals.join(',')}]`);
  }

  console.log(`\nChạy dán cạnh (P49) qua ${results.length} probe:`);
  let passed = 0;
  for (const r of results) {
    if (r.ok) {
      passed++;
      console.log(`  PASS  ${r.name}`);
    } else {
      console.log(`  FAIL  ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
    }
  }
  return { passed, total: results.length };
}

// =============================================================
// PRESET KPI (P81) — computePresetKpi (hàm chung dùng cho BẢNG danh sách admin) PHẢI
// khớp pipeline chuẩn (runPipeline → computePrice) cho mọi cấu hình, kể cả có chia/gộp
// ô. Lệch → bảng hiện giá khác editor → mất tin cậy. Cũng khoá công thức KPI P80/P81.
// =============================================================
function runPresetKpiTests(): { passed: number; total: number } {
  const results: { name: string; ok: boolean; detail?: string }[] = [];
  const T = (name: string, ok: boolean, detail?: string) => results.push({ name, ok, detail });

  const cases: { name: string; ov: Overrides }[] = [
    { name: 'KPI mặc định == pipeline', ov: {} },
    { name: 'KPI tủ nhỏ == pipeline', ov: { width: 900, height: 1200, columns: 2, rows: 2 } },
    {
      name: 'KPI lưới cánh+ngăn kéo == pipeline',
      ov: {
        columns: 3,
        rows: 3,
        width: 1400,
        height: 1500,
        cells: encodeCellGrid([
          ['door', 'door', 'door'],
          ['drawer', 'drawer', 'drawer'],
          ['open-back', 'open-back', 'open-back'],
        ]),
      },
    },
  ];

  for (const c of cases) {
    const kpi = computePresetKpi(tuKe, c.ov as ParamValues);
    const ref = runPipeline(c.ov);
    const refPrice = computePrice(ref, tuKe.priceConfig);
    const sizeOk =
      kpi.w === (ref.size?.w ?? 0) && kpi.h === (ref.size?.h ?? 0) && kpi.d === (ref.size?.d ?? 0);
    const priceOk = kpi.total === refPrice.total;
    T(
      c.name,
      sizeOk && priceOk,
      `size ${kpi.w}×${kpi.h}×${kpi.d} · ${formatPrice(kpi.total)} vs ref ${formatPrice(refPrice.total)}`,
    );
  }

  // Công thức KPI: lãi gộp = giá bán − giá vốn (khớp PricePanel P80); đơn giá/m² mặt
  // đứng = giá bán ÷ (rộng × cao build.size).
  const k = computePresetKpi(tuKe, {} as ParamValues);
  const refK = computePrice(runPipeline({}), tuKe.priceConfig);
  const costRef = refK.lines.reduce((s, l) => s + l.amount, 0) + (refK.laborPerOrder ?? 0);
  T(
    'Lãi gộp = giá bán − tổng giá vốn',
    k.grossProfit === k.total - k.costTotal && k.costTotal === costRef,
    `lãi ${formatPrice(k.grossProfit)} (${k.grossPct.toFixed(0)}%) · vốn ${formatPrice(k.costTotal)}`,
  );
  const areaExp = (k.w * k.h) / 1_000_000;
  T(
    'Đơn giá/m² mặt đứng = giá bán ÷ (rộng×cao)',
    areaExp > 0 && k.pricePerM2Front != null && Math.abs(k.pricePerM2Front - k.total / areaExp) < 1,
    `${k.pricePerM2Front != null ? formatPrice(k.pricePerM2Front) : '—'}/m² · ${areaExp.toFixed(2)} m²`,
  );

  const passed = results.filter((r) => r.ok).length;
  console.log('\nChạy PRESET KPI (P81) — khớp pipeline + công thức:');
  for (const r of results)
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
  return { passed, total: results.length };
}

// =============================================================
// TU-Y (Loại 2) TESTS — P83. SECTION RIÊNG, KHÔNG đụng BASELINE x.
// P83.2: build ĐỦ (4 cỡ + hướng + 3 thuộc tính + cánh/bản lề + hậu + connector
// + chân + dán cạnh + multi-module). Số riêng cho tu-y (geometry khác hẳn x);
// kiểm hình học + cup↔plate + engine giá/cutlist/DXF CHẠY ĐƯỢC trên output tu-y.
// =============================================================
function tuyAllMach(b: BuildResult): Machining[] {
  return b.parts.flatMap((p) => p.machining ?? []);
}
function tuyDrawable(m: Machining): boolean {
  if (m.op === 'slot') return m.length_mm > 0 && m.width_mm > 0 && m.depth_mm > 0 && m.length_mm >= m.width_mm;
  if (m.op === 'drill' || m.op === 'pocket') return m.diameter_mm > 0 && m.depth_mm > 0;
  if (m.op === 'edge_drill') return m.diameter_mm > 0 && m.depth_mm > 0;
  return true;
}

function runTuYTests(): { passed: number; total: number } {
  const results: { name: string; ok: boolean; detail?: string }[] = [];
  const T = (name: string, ok: boolean, detail?: string) => results.push({ name, ok, detail });
  const sz = (p: Part) => `[${p.size.join(',')}]`;
  const comp = (c: YComposition) => ({ modules: encodeModules(c) }) as ParamValues;
  const ONE = (mod: Partial<YComposition['modules'][number]>): ParamValues =>
    comp({ modules: [{ id: 'a', gx: 0, gy: 0, gw: 2, gh: 2, attribute: 'open-nobk', ...mod }] });
  const hwQty = (b: BuildResult, id: string) => b.hardware.find((h) => h.id === id)?.qty ?? 0;

  // --- Case 1: 1 module 36×36 OPEN-NOBK (hộp trần) ---
  {
    const b = tuY.build({});
    // Kết cấu giống x: vách LỌT GIỮA → [18, innerH=324, 360]; nóc/đáy FULL rộng → [360,18,360].
    const verticals = b.parts.filter((p) => p.size[0] === 18 && p.size[1] === 324);
    const horizontals = b.parts.filter((p) => p.size[1] === 18 && p.size[0] === 360);
    T('open-nobk: 4 ván (không hậu)', b.parts.length === 4, `có ${b.parts.length} ván`);
    T('open-nobk: 2 vách [18,324,360] (lọt giữa nóc/đáy)', verticals.length === 2, verticals.map(sz).join(' '));
    T('open-nobk: nóc+đáy [360,18,360] (full rộng)', horizontals.length === 2, horizontals.map(sz).join(' '));
    T('open-nobk: dày 18 toàn bộ', b.parts.every((p) => p.thickness_mm === 18));
    T('open-nobk: size phủ bì 360×360×360', b.size?.w === 360 && b.size?.h === 360 && b.size?.d === 360, JSON.stringify(b.size));
    // 4 góc × 2 (trước+sau) = 8 connector; tựa sàn → 4 chân.
    T('open-nobk: connector_2in1 = 8', hwQty(b, 'connector_2in1') === 8, `qty ${hwQty(b, 'connector_2in1')}`);
    T('open-nobk: chân = 4', hwQty(b, 'foot') === 4, `qty ${hwQty(b, 'foot')}`);
    T('open-nobk: KHÔNG bản lề/hậu', hwQty(b, 'hinge') === 0 && hwQty(b, 'back_clip') === 0);
    T('open-nobk: 1 cavity open-nobk', b.cavities?.length === 1 && b.cavities[0].type === 'open-nobk');
  }

  // --- Case 2: OPEN-BACK → +1 tấm hậu 9mm + chốt lò xo hậu ---
  {
    const b = tuY.build(ONE({ attribute: 'open-back' }));
    const back = b.parts.find((p) => p.id.startsWith('back-'));
    T('open-back: 5 ván (có hậu)', b.parts.length === 5, `có ${b.parts.length} ván`);
    T('open-back: hậu dày 9mm', back?.thickness_mm === 9, back ? sz(back) : 'KHÔNG có hậu');
    T('open-back: back_clip > 0', hwQty(b, 'back_clip') > 0, `qty ${hwQty(b, 'back_clip')}`);
    T('open-back: cavity open-back', b.cavities?.[0]?.type === 'open-back');
  }

  // --- Case 3: DOOR (cánh đơn) — cup↔plate khớp, bản lề vào BOM, hậu giấu ---
  {
    const b = tuY.build(ONE({ attribute: 'door' }));
    const doorParts = b.parts.filter((p) => p.id.startsWith('door-'));
    const doorMach = doorParts.flatMap((p) => p.machining ?? []);
    const sideParts = b.parts.filter((p) => p.id.endsWith('-left') || p.id.endsWith('-right'));
    const sideMach = sideParts.flatMap((p) => p.machining ?? []);
    const cupPockets = doorMach.filter((m) => m.op === 'pocket' && m.purpose === 'hinge').length;
    const cupScrews = doorMach.filter((m) => m.op === 'drill' && m.purpose === 'hinge').length;
    const plateScrews = sideMach.filter((m) => m.op === 'drill' && m.purpose === 'hinge').length;
    T('door: đúng 1 lá cánh (lòng ≤600)', doorParts.length === 1, `có ${doorParts.length} lá`);
    T('door: bản lề vào BOM', hwQty(b, 'hinge') > 0, `qty ${hwQty(b, 'hinge')}`);
    T('door: cup chén = số bản lề', cupPockets === hwQty(b, 'hinge'), `${cupPockets} cup vs ${hwQty(b, 'hinge')} bản lề`);
    T('door: cup↔plate khớp (plate = 2×cup)', plateScrews === 2 * cupPockets && cupScrews === 2 * cupPockets, `cup ${cupPockets} · cupVít ${cupScrews} · plate ${plateScrews}`);
    T('door: có hậu giấu (màu khung)', b.parts.some((p) => p.id.startsWith('back-')));
    T('door: doorCount = 1', b.doorCount === 1, `doorCount ${b.doorCount}`);
    T('door: tay nắm bar mặc định', hwQty(b, 'handle_bar') === 1, `qty ${hwQty(b, 'handle_bar')}`);
    // Tay nắm bar phải nhấc +FOOT_H CÙNG cánh (regression: bar fitting bỏ quên shift).
    const door = doorParts[0];
    const barArm = (b.fittings ?? []).find((f) => f.kind === 'handle-bar' && f.id.endsWith('-arm'));
    if (door && barArm) {
      const expectedY = door.position[1] + door.size[1] / 2 - 60; // BAR_INSET=60 từ mép trên
      T('door: tay nắm bar khớp cao độ cánh (đã nhấc FOOT_H)', Math.abs(barArm.position[1] - expectedY) < 0.5, `barY ${barArm.position[1]} vs kỳ vọng ${expectedY}`);
    } else {
      T('door: tay nắm bar khớp cao độ cánh (đã nhấc FOOT_H)', false, 'thiếu door/bar fitting');
    }
  }

  // --- Case 4: DOOR rộng 72cm (gw4) → 2 lá cánh ---
  {
    const b = tuY.build(ONE({ gw: 4, attribute: 'door' }));
    const doorParts = b.parts.filter((p) => p.id.startsWith('door-'));
    T('door rộng 72cm: 2 lá cánh', doorParts.length === 2, `có ${doorParts.length} lá`);
    T('door rộng: 2 lá bản lề ngược chiều', doorParts.filter((p) => p.hingeOnLeft).length === 1, 'mỗi bên 1 lá');
    T('door rộng: doorCount = 2', b.doorCount === 2);
  }

  // --- P92: tay nắm "quay vào nhau" (cánh liền kề) + CẤM cánh ô có cạnh 18cm ---
  {
    // 2 ô cánh đơn cạnh nhau (gw2 gh2): ô trái bản lề trái (tay nắm PHẢI), ô phải bản lề
    // phải (tay nắm TRÁI) → 2 tay nắm quay vào nhau (giống tủ x).
    const pair = tuY.build(comp({ modules: [
      { id: 'a', gx: 0, gy: 0, gw: 2, gh: 2, attribute: 'door' },
      { id: 'b', gx: 2, gy: 0, gw: 2, gh: 2, attribute: 'door' },
    ] }));
    const da = pair.parts.find((p) => p.id === 'door-ma-a');
    const db = pair.parts.find((p) => p.id === 'door-mb-a');
    T('P92 cặp cánh: ô trái bản lề trái (tay nắm phải)', da?.hingeOnLeft === true);
    T('P92 cặp cánh: ô phải bản lề phải (tay nắm trái) → quay vào nhau', db?.hingeOnLeft === false);

    // 4 ô cánh đơn 1 hàng → ghép cặp [+ − + −]
    const four = tuY.build(comp({ modules: [0, 2, 4, 6].map((gx, i) => ({ id: `m${i}`, gx, gy: 0, gw: 2, gh: 2, attribute: 'door' as const })) }));
    const signs = ['m0', 'm1', 'm2', 'm3'].map((id) => (four.parts.find((p) => p.id === `door-m${id}-a`)?.hingeOnLeft ? '+' : '-')).join('');
    T('P92 4 cánh: 2 cặp quay vào nhau (+−+−)', signs === '+-+-', signs);

    // Cánh đơn ĐỨNG MỘT MÌNH → +1 (bản lề trái) như cũ — tương thích ngược.
    const lone = tuY.build(ONE({ attribute: 'door' }));
    T('P92 cánh lẻ: +1 (bản lề trái) như cũ', lone.parts.find((p) => p.id === 'door-ma-a')?.hingeOnLeft === true);

    // CẤM cánh ô có cạnh 18cm: 18×36 (gw1) và 36×18 (gh1) → render open-back, KHÔNG cánh.
    const narrow = tuY.build(ONE({ gw: 1, gh: 2, attribute: 'door' }));
    const short = tuY.build(ONE({ gw: 2, gh: 1, attribute: 'door' }));
    T('P92 cấm cánh 18×36 (gw1): không có tấm cánh + doorCount 0', narrow.parts.every((p) => !p.id.startsWith('door-')) && narrow.doorCount === 0);
    T('P92 cấm cánh 18×36: vẫn có hậu (render open-back)', narrow.parts.some((p) => p.id.startsWith('back-')));
    T('P92 cấm cánh 36×18 (gh1): không có tấm cánh + doorCount 0', short.parts.every((p) => !p.id.startsWith('door-')) && short.doorCount === 0);
  }

  // --- Case 5: handleType none/round đổi tay nắm BOM ---
  {
    const bn = tuY.build({ ...ONE({ attribute: 'door' }), handleType: 'none' });
    const br = tuY.build({ ...ONE({ attribute: 'door' }), handleType: 'round' });
    T('handle none: KHÔNG có tay nắm BOM', hwQty(bn, 'handle_bar') === 0 && hwQty(bn, 'handle') === 0 && hwQty(bn, 'handle_strip_black') === 0);
    T('handle round: tay nắm tròn BOM', hwQty(br, 'handle') === 1, `qty ${hwQty(br, 'handle')}`);
  }

  // --- Case 6: MCA An Cường → thân 17mm, hậu vẫn 9mm ---
  {
    const b = tuY.build(comp({ modules: [{ id: 'a', gx: 0, gy: 0, gw: 2, gh: 2, attribute: 'open-back', color: 'mdf_chong_am_melamine/mca_trang' }] }));
    const body = b.parts.filter((p) => !p.id.startsWith('back-'));
    const back = b.parts.find((p) => p.id.startsWith('back-'));
    T('MCA: thân ván 17mm', body.every((p) => p.thickness_mm === 17), `dày ${body.map((p) => p.thickness_mm).join(',')}`);
    T('MCA: hậu vẫn 9mm', back?.thickness_mm === 9);
  }

  // --- Case 7: HƯỚNG quay ngang (36×18 = gw2 gh1) — vách lọt giữa [18,144,360] ---
  {
    const b = tuY.build(ONE({ gw: 2, gh: 1 }));
    const verticals = b.parts.filter((p) => p.id.endsWith('-left') || p.id.endsWith('-right'));
    T('quay ngang: phủ bì 360×180', b.size?.w === 360 && b.size?.h === 180, JSON.stringify(b.size));
    // H=180, innerH = 180 − 2×18 = 144 → vách lọt giữa cao 144.
    T('quay ngang: vách [18,144,360] (lọt giữa)', verticals.every((p) => p.size[1] === 144), verticals.map(sz).join(' '));
  }

  // --- Case 8: STACK 2 tầng — chỉ tầng SÀN (gy0) có chân ---
  {
    const b = tuY.build(
      comp({
        modules: [
          { id: 'lo', gx: 0, gy: 0, gw: 2, gh: 2, attribute: 'door' },
          { id: 'hi', gx: 0, gy: 2, gw: 2, gh: 2, attribute: 'open-back' },
        ],
      }),
    );
    T('stack: phủ bì cao 720', b.size?.h === 720, JSON.stringify(b.size));
    T('stack: chỉ 4 chân (tầng sàn)', hwQty(b, 'foot') === 4, `qty ${hwQty(b, 'foot')}`);
    T('stack: module_link_tbd placeholder', hwQty(b, 'module_link_tbd') === 1, `qty ${hwQty(b, 'module_link_tbd')}`);
  }

  // --- Case 8b: VÁT GÓC (chamfer) thay khe — 2 module kề CHẠM NHAU (không dời), ---
  //     ván thân có chamfer_mm (render bo cạnh), cánh KHÔNG. Vị trí/size bất biến. ---
  {
    const b = tuY.build(
      comp({
        modules: [
          { id: 'a', gx: 0, gy: 0, gw: 2, gh: 2, attribute: 'door' },
          { id: 'b', gx: 2, gy: 0, gw: 2, gh: 2, attribute: 'open-nobk' },
        ],
      }),
    );
    const aRight = b.parts.find((p) => p.id === 'ma-right');
    const bLeft = b.parts.find((p) => p.id === 'mb-left');
    const ok = !!aRight && !!bLeft;
    // KHÔNG dời vị trí → vách phải A (mép phải) CHẠM vách trái B (mép trái), gap=0.
    const gap = ok ? bLeft!.position[0] - bLeft!.size[0] / 2 - (aRight!.position[0] + aRight!.size[0] / 2) : -1;
    T('chamfer: 2 module kề CHẠM NHAU (gap=0, không dời)', ok && Math.abs(gap) < 0.01, `gap ${gap.toFixed(2)}mm`);
    const carcass = b.parts.filter((p) => !p.id.startsWith('door-'));
    const doors = b.parts.filter((p) => p.id.startsWith('door-'));
    T('chamfer: MỌI ván thân có chamfer_mm > 0', carcass.length > 0 && carcass.every((p) => (p.chamfer_mm ?? 0) > 0), `${carcass.filter((p) => p.chamfer_mm).length}/${carcass.length}`);
    T('chamfer: CÁNH KHÔNG vát (chamfer_mm vắng)', doors.length > 0 && doors.every((p) => p.chamfer_mm === undefined), `${doors.length} cánh`);
    T('chamfer: KHÔNG đổi size ván ([18,324,360])', !!aRight && aRight.size[0] === 18 && aRight.size[1] === 324, aRight ? sz(aRight) : 'no part');
  }

  // --- Case 9: getWarnings — module "bay" cảnh báo ---
  {
    const floating = comp({
      modules: [
        { id: 'g', gx: 0, gy: 0, gw: 1, gh: 2, attribute: 'open-nobk' },
        { id: 'f', gx: 3, gy: 2, gw: 1, gh: 2, attribute: 'open-nobk' }, // không tựa
      ],
    });
    const w = tuY.getWarnings?.(floating) ?? [];
    T('warning: module bay được cảnh báo', w.some((s) => s.includes('bay')), w.join(' | '));
  }

  // --- Case 10: Engine CHUNG — mọi cấu hình: thickness∈{9,17,18}, giá>0, cutlist, DXF, machining drawable ---
  {
    const scenarios: { name: string; v: ParamValues }[] = [
      { name: 'open-nobk', v: ONE({ attribute: 'open-nobk' }) },
      { name: 'open-back', v: ONE({ attribute: 'open-back' }) },
      { name: 'door đơn', v: ONE({ attribute: 'door' }) },
      { name: 'door đôi 72', v: ONE({ gw: 4, attribute: 'door' }) },
      { name: 'door strip', v: { ...ONE({ attribute: 'door' }), handleType: 'strip' } },
      {
        name: '4 module hỗn hợp',
        v: comp({
          modules: [
            { id: '1', gx: 0, gy: 0, gw: 2, gh: 2, attribute: 'door' },
            { id: '2', gx: 2, gy: 0, gw: 1, gh: 2, attribute: 'open-back' },
            { id: '3', gx: 3, gy: 0, gw: 3, gh: 2, attribute: 'door' },
            { id: '4', gx: 0, gy: 2, gw: 4, gh: 1, attribute: 'open-nobk' },
          ],
        }),
      },
    ];
    let thickOk = true;
    let priceOk = true;
    let cutOk = true;
    let dxfOk = true;
    let drawOk = true;
    let detail = '';
    for (const s of scenarios) {
      const b = tuY.build(s.v);
      if (!b.parts.every((p) => [9, 17, 18].includes(p.thickness_mm))) {
        thickOk = false;
        detail = `${s.name}: dày lạ`;
      }
      try {
        if (!(computePrice(b, tuY.priceConfig).total > 0)) {
          priceOk = false;
          detail = `${s.name}: giá ≤0`;
        }
      } catch (e) {
        priceOk = false;
        detail = `${s.name}: price throw ${e}`;
      }
      try {
        const cut = buildCutlist(b);
        if (cut.panels.length === 0 || cut.totalPanels <= 0) {
          cutOk = false;
          detail = `${s.name}: cutlist rỗng`;
        }
      } catch (e) {
        cutOk = false;
        detail = `${s.name}: cutlist throw ${e}`;
      }
      try {
        for (const p of b.parts) {
          const dxf = generatePartDXF(p);
          if (!dxf || !dxf.includes('SECTION')) {
            dxfOk = false;
            detail = `${s.name}: DXF rỗng ${p.id}`;
          }
        }
      } catch (e) {
        dxfOk = false;
        detail = `${s.name}: DXF throw ${e}`;
      }
      const bad = tuyAllMach(b).find((m) => !tuyDrawable(m));
      if (bad) {
        drawOk = false;
        detail = `${s.name}: machining lỗi ${JSON.stringify(bad)}`;
      }
    }
    T('engine: thickness ∈ {9,17,18}', thickOk, detail);
    T('engine: computePrice > 0 mọi cấu hình', priceOk, detail);
    T('engine: buildCutlist mọi cấu hình', cutOk, detail);
    T('engine: generatePartDXF mọi tấm', dxfOk, detail);
    T('engine: machining drawable (no Ø0/depth0, slot≥)', drawOk, detail);
  }

  // --- Case 10b: GIÁ tủ y (P84) — moduleCounts + hao hụt 15% + nhân công theo loại ô ---
  {
    // 2 module: 36×36 open-nobk (cells=4) + 72×36 door (cells=8).
    const b = tuY.build(
      comp({
        modules: [
          { id: 'a', gx: 0, gy: 0, gw: 2, gh: 2, attribute: 'open-nobk' },
          { id: 'b', gx: 2, gy: 0, gw: 4, gh: 2, attribute: 'door' },
        ],
      }),
    );
    T('giá: moduleCounts đúng (4-open-nobk:1, 8-door:1)',
      b.moduleCounts?.['4-open-nobk'] === 1 && b.moduleCounts?.['8-door'] === 1, JSON.stringify(b.moduleCounts));
    // (a) config mặc định (vắng tuYWasteRatio) → hao hụt 15%, dòng giá vốn (lineMargin:1).
    const pDefault = computePrice(b, tuY.priceConfig);
    const wasteLine = pDefault.lines.find((l) => l.label.startsWith('Hao hụt ván'));
    T('giá: dòng "Hao hụt ván (15%)" lineMargin=1',
      !!wasteLine && wasteLine.label.includes('15%') && wasteLine.lineMargin === 1 && wasteLine.amount > 0,
      wasteLine ? `${wasteLine.label} m=${wasteLine.lineMargin} +${wasteLine.amount}` : 'thiếu');
    T('giá: chưa điền công → dòng cảnh báo ⚠', pDefault.lines.some((l) => l.label.startsWith('⚠')));
    // (b) config có bảng công → laborCost = Σ (50k + 120k = 170k); hết cảnh báo.
    const pLabor = computePrice(b, { ...tuY.priceConfig, tuYWasteRatio: 0.15, tuYCellLabor: { '4-open-nobk': 50_000, '8-door': 120_000 } });
    const laborLine = pLabor.lines.find((l) => l.label === 'Nhân công (theo loại ô)');
    T('giá: nhân công theo ô = Σ 170k', !!laborLine && laborLine.amount === 170_000, laborLine ? `${laborLine.amount}` : 'thiếu');
    T('giá: có bảng công → hết cảnh báo', !pLabor.lines.some((l) => l.label.startsWith('⚠')));
    // (c) admin chỉnh hao hụt 20% → nhãn + tiền tăng so 15%.
    const w20 = computePrice(b, { ...tuY.priceConfig, tuYWasteRatio: 0.2 }).lines.find((l) => l.label.startsWith('Hao hụt ván'));
    T('giá: hao hụt admin-chỉnh 20% (nhãn + tiền tăng)',
      !!w20 && w20.label.includes('20%') && !!wasteLine && w20.amount > wasteLine.amount, w20?.label);
    // margin PHẲNG: mặc định 2.2 (không theo thể tích); admin chỉnh được.
    T('giá: margin tủ y PHẲNG mặc định 2.2', pDefault.margin === 2.2, `margin ${pDefault.margin}`);
    const p25 = computePrice(b, { ...tuY.priceConfig, tuYMargin: 2.5 });
    T('giá: margin tủ y admin-chỉnh (2.5) + total tăng', p25.margin === 2.5 && p25.total > pDefault.total, `margin ${p25.margin}`);
    T('giá: total > 0', pDefault.total > 0 && pLabor.total > 0);
  }

  // --- Case 10c: MÀU per-ô (P85) — mode chung/riêng cho khung·cánh·nẹp ---
  {
    const mk = (mode: string) =>
      tuY.build({
        modules: encodeModules({
          modules: [
            { id: 'a', gx: 0, gy: 0, gw: 2, gh: 2, attribute: 'door', color: 'mdf_son/den', doorColor: 'mfc_melamine/ml_xanh_reu', edgeColor: 'black' },
            { id: 'b', gx: 2, gy: 0, gw: 2, gh: 2, attribute: 'open-nobk' },
          ],
        }),
        colorMode: mode,
        color: 'mfc_melamine/ml_trang_kem',
        edgeBanding: 'white',
      } as ParamValues);
    const mat = (b: BuildResult, id: string) => b.parts.find((p) => p.id === id)?.material;
    const edge = (b: BuildResult, id: string) => b.parts.find((p) => p.id === id)?.edgeColor;
    // RIÊNG — ô a override khung/cánh/nẹp; ô b ăn theo mặc định.
    const r = mk('rieng');
    T('màu riêng: khung ô a = mdf_son/den', mat(r, 'ma-left') === 'mdf_son/den', String(mat(r, 'ma-left')));
    T('màu riêng: cánh ô a = ml_xanh_reu', mat(r, 'door-ma-a') === 'mfc_melamine/ml_xanh_reu', String(mat(r, 'door-ma-a')));
    T('màu riêng: nẹp THÂN ô a = black', edge(r, 'ma-left') === 'black', String(edge(r, 'ma-left')));
    T('màu riêng: viền CÁNH ô a vẫn same', edge(r, 'door-ma-a') === 'same', String(edge(r, 'door-ma-a')));
    T('màu riêng: ô b (không override) = mặc định trắng kem', mat(r, 'mb-left') === 'mfc_melamine/ml_trang_kem', String(mat(r, 'mb-left')));
    T('màu riêng: nẹp ô b = nẹp chung (white)', edge(r, 'mb-left') === 'white', String(edge(r, 'mb-left')));
    // CHUNG — bỏ qua mọi override: tất cả màu mặc định, cánh=khung, nẹp=chung.
    const c = mk('chung');
    T('màu chung: khung ô a = mặc định (bỏ override)', mat(c, 'ma-left') === 'mfc_melamine/ml_trang_kem', String(mat(c, 'ma-left')));
    T('màu chung: cánh ô a = mặc định (bỏ override)', mat(c, 'door-ma-a') === 'mfc_melamine/ml_trang_kem', String(mat(c, 'door-ma-a')));
    T('màu chung: nẹp ô a = nẹp chung white (bỏ override)', edge(c, 'ma-left') === 'white', String(edge(c, 'ma-left')));
  }

  // --- Case 10d: CAVITY props thumbnail (P86) — mỗi ô MỞ 1 hốc; (col,row) DUY NHẤT
  //     mỗi ô (nếu trùng → StagingProps trùng React-key + seed → chỉ 1 đồ render). ---
  {
    const b = tuY.build(
      comp({
        modules: [
          { id: 'a', gx: 0, gy: 0, gw: 2, gh: 2, attribute: 'open-nobk' },
          { id: 'b', gx: 2, gy: 0, gw: 2, gh: 2, attribute: 'open-back' },
          { id: 'c', gx: 0, gy: 2, gw: 2, gh: 2, attribute: 'open-nobk' },
          { id: 'd', gx: 2, gy: 2, gw: 2, gh: 2, attribute: 'door' },
        ],
      }),
    );
    const cav = b.cavities ?? [];
    T('cavity: 3 ô mở → 3 hốc (ô cánh KHÔNG có hốc)', cav.length === 3, `có ${cav.length}`);
    const keys = cav.map((c) => `${c.col},${c.row}`);
    T('cavity: (col,row) DUY NHẤT mỗi ô', new Set(keys).size === cav.length, keys.join(' | '));
    T('cavity: col/row theo lưới gx/gy (không còn 0,0 cứng)', cav.some((c) => c.col !== 0 || c.row !== 0), keys.join(' | '));
    T('cavity: floorY > 0 (đã + FOOT_H)', cav.every((c) => c.floorY > 0));
  }

  // --- Case 11: build KHÔNG bao giờ ra 0 ván dù modules JSON hỏng (fallback) ---
  {
    const b = tuY.build({ modules: 'không-phải-json' });
    T('JSON hỏng → fallback 1 module 4 ván', b.parts.length === 4, `có ${b.parts.length} ván`);
    T('id ván không trùng (4 module hỗn hợp)', new Set(tuY.build({}).parts.map((p) => p.id)).size === 4);
  }

  // --- Case 12: PLACEMENT HELPERS (YConfigurator) — thuần, P83.3 ---
  {
    const base: YComposition = { modules: [{ id: 'm0', gx: 0, gy: 0, gw: 2, gh: 2, attribute: 'open-nobk' }] };
    // overlaps
    T('overlaps: ô kề KHÔNG đè', !overlaps(base.modules, { id: 'x', gx: 2, gy: 0, gw: 2, gh: 2, attribute: 'open-nobk' }));
    T('overlaps: ô chồng → true', overlaps(base.modules, { id: 'x', gx: 1, gy: 0, gw: 2, gh: 2, attribute: 'open-nobk' }));
    // placeAtEdge phải → gx=2, cùng gy; id m1
    const right = placeAtEdge(base, 'm0', 'right', { gw: 2, gh: 2 }, 'door');
    T('placeAtEdge phải: +1 ô tại gx=2', !!right && right.modules.length === 2 && right.modules[1].gx === 2 && right.modules[1].gy === 0);
    T('placeAtEdge phải: id m1 + thuộc tính door', !!right && right.modules[1].id === 'm1' && right.modules[1].attribute === 'door');
    // placeAtEdge dưới → gy<0 → null
    T('placeAtEdge dưới sàn → null', placeAtEdge(base, 'm0', 'bottom', { gw: 2, gh: 2 }, 'open-nobk') === null);
    // placeAtEdge trên → gy=2 (stack)
    const top = placeAtEdge(base, 'm0', 'top', { gw: 2, gh: 2 }, 'open-nobk');
    T('placeAtEdge trên: ô tầng 2 (gy=2)', !!top && top.modules[1].gy === 2);
    // placeAtEdge vào chỗ đã có ô → null (đè)
    const two: YComposition = right!;
    T('placeAtEdge đè ô có sẵn → null', placeAtEdge(two, 'm1', 'left', { gw: 2, gh: 2 }, 'open-nobk') === null);
    // updateModule: đổi cỡ gây đè → null; đổi thuộc tính OK
    T('updateModule đổi cỡ gây đè → null', updateModule(two, 'm0', { gw: 4 }) === null);
    const upd = updateModule(two, 'm0', { attribute: 'door' });
    T('updateModule đổi thuộc tính OK', !!upd && upd.modules[0].attribute === 'door');
    // removeModule
    T('removeModule: bớt 1 ô', removeModule(two, 'm1')?.modules.length === 1);
    T('removeModule id lạ → null', removeModule(two, 'mZ') === null);
    // findFloating: stack đỡ → rỗng; ô bay → có
    const stack: YComposition = { modules: [{ id: 'a', gx: 0, gy: 0, gw: 2, gh: 2, attribute: 'open-nobk' }, { id: 'b', gx: 0, gy: 2, gw: 2, gh: 2, attribute: 'open-nobk' }] };
    T('findFloating: stack có đỡ → rỗng', findFloating(stack).length === 0);
    const fly: YComposition = { modules: [{ id: 'a', gx: 0, gy: 0, gw: 1, gh: 2, attribute: 'open-nobk' }, { id: 'f', gx: 3, gy: 2, gw: 1, gh: 2, attribute: 'open-nobk' }] };
    T('findFloating: ô bay → [f]', findFloating(fly).join(',') === 'f');
    // nextModuleId
    T('nextModuleId: m0,m1 → m2', nextModuleId(two) === 'm2');
    T('nextModuleId: rỗng → m0', nextModuleId({ modules: [] }) === 'm0');
  }

  const passed = results.filter((r) => r.ok).length;
  console.log('\nChạy TU-Y (Loại 2, P83.2) qua probe:');
  for (const r of results)
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${!r.ok && r.detail ? ` — ${r.detail}` : r.detail ? `  (${r.detail})` : ''}`);
  return { passed, total: results.length };
}

function main(): void {
  console.log('=== VALIDATOR — products/tu-ke/dna.ts ===\n');

  const selfOk = selfTest();
  console.log('');

  const cases = buildCases();
  let passed = 0;
  let totalParts = 0;
  let baselineLine = '';

  console.log(`Chạy build() qua ${cases.length} cấu hình:`);
  for (const c of cases) {
    const { issues, build } = runCase(c);
    totalParts += build?.parts.length ?? 0;

    if (issues.length === 0) {
      passed++;
      console.log(`  PASS  ${c.name}`);
    } else {
      console.log(`  FAIL  ${c.name}`);
      for (const i of issues) console.log(`          [${i.check}] ${i.detail}`);
    }

    // Mốc tham chiếu cho ca "Mặc định" — tín hiệu mềm, không tính là lỗi.
    if (c.name === 'Mặc định' && build) {
      const price = computePrice(build, tuKe.priceConfig).total;
      const cut = buildCutlist(build);
      const khop =
        price === BASELINE.total &&
        cut.totalPanels === BASELINE.panels &&
        Math.abs(cut.totalAreaM2 - BASELINE.areaM2) < 0.01;
      baselineLine =
        `Ca "Mặc định": ${formatPrice(price)} · ${cut.totalPanels} tấm · ` +
        `${cut.totalAreaM2.toFixed(2)} m²  ` +
        (khop
          ? '(khớp mốc HANDOFF)'
          : `[!] LỆCH mốc HANDOFF ${formatPrice(BASELINE.total)} / ${BASELINE.panels} tấm / ${BASELINE.areaM2} m²`);
    }
  }

  console.log('');
  if (baselineLine) console.log(baselineLine);
  console.log(`Đã kiểm ${totalParts} tấm qua ${cases.length} cấu hình.`);

  // ---- PIPELINE TESTS — chạy full chain (normalize → reconcile → build) ----
  const pCases = buildPipelineCases();
  console.log(`\nChạy pipeline qua ${pCases.length} cấu hình:`);
  let pPassed = 0;
  for (const c of pCases) {
    const issues = runPipelineCase(c);
    if (issues.length === 0) {
      pPassed++;
      console.log(`  PASS  ${c.name}`);
    } else {
      console.log(`  FAIL  ${c.name}`);
      for (const i of issues) console.log(`          [${i.check}] ${i.detail}`);
    }
  }

  // ---- MACHINING TESTS — S10 (additive, kiểm machining[] có cấu trúc) ----
  const mCases = buildMachiningCases();
  console.log(`\nChạy machining qua ${mCases.length} cấu hình:`);
  let mPassed = 0;
  for (const c of mCases) {
    const issue = runMachiningCase(c);
    if (issue === null) {
      mPassed++;
      console.log(`  PASS  ${c.name}`);
    } else {
      console.log(`  FAIL  ${c.name}: ${issue}`);
    }
  }

  // ---- CODEC TESTS — Phase 2 (block list ↔ uniform legacy) ----
  const codec = runCodecTests();

  // ---- EDGE-BANDING TESTS — P49 (dán cạnh option độc lập) ----
  const edge = runEdgeBandingTests();

  // ---- NESTING ĐA-MÀU — P56 (mỗi màu nest riêng, không trộn tấm) ----
  const nest = runNestingTests();

  // ---- CẮT KHỔ nửa/phần tư — P64 ----
  const nestSplit = runNestSplitTests();

  // ---- MARGIN THEO THỂ TÍCH — P60 ----
  const marg = runMarginTests();

  // ---- CÁNH Ô GỘP — P61 ----
  const merged = runMergedDoorTests();

  // ---- TAY NẮM + CHÂN TỦ đọc spec — P77 ----
  const hf = runHandleFootSpecTests();

  // ---- PRESET KPI (bảng admin) khớp pipeline — P81 ----
  const kpi = runPresetKpiTests();

  // ---- TU-Y (Loại 2) — P83, SECTION riêng (KHÔNG đụng BASELINE x) ----
  const tuy = runTuYTests();

  console.log('');
  console.log(
    `Kết quả: ${passed}/${cases.length} build · ${pPassed}/${pCases.length} pipeline · ` +
      `${mPassed}/${mCases.length} machining · ${codec.passed}/${codec.total} codec · ` +
      `${edge.passed}/${edge.total} dán cạnh · ${nest.passed}/${nest.total} nesting · ${nestSplit.passed}/${nestSplit.total} cắt khổ · ` +
      `${marg.passed}/${marg.total} margin · ${merged.passed}/${merged.total} cánh gộp · ${hf.passed}/${hf.total} tay nắm+chân · ${kpi.passed}/${kpi.total} preset KPI · ${tuy.passed}/${tuy.total} tu-y · tự kiểm ${selfOk ? 'ĐẠT' : 'HỎNG'}`,
  );

  if (
    selfOk &&
    passed === cases.length &&
    pPassed === pCases.length &&
    mPassed === mCases.length &&
    codec.passed === codec.total &&
    edge.passed === edge.total &&
    nest.passed === nest.total &&
    nestSplit.passed === nestSplit.total &&
    marg.passed === marg.total &&
    merged.passed === merged.total &&
    hf.passed === hf.total &&
    kpi.passed === kpi.total &&
    tuy.passed === tuy.total
  ) {
    console.log('TẤT CẢ ĐẠT');
  } else {
    console.log('CÓ LỖI — xem dòng FAIL ở trên');
    process.exitCode = 1;
  }
}

// =============================================================
// MACHINING TESTS — S10. Kiểm machining[] có cấu trúc gắn lên Part đúng số/lượng/side.
// =============================================================
interface MachiningCase {
  name: string;
  overrides: Overrides;
  check: (build: BuildResult) => string | null;
}

function sumPurpose(parts: BuildResult['parts'], label: string, purpose: string): number {
  return parts
    .filter((p) => p.label === label)
    .reduce(
      (sum, p) => sum + (p.machining?.filter((m) => m.purpose === purpose).length ?? 0),
      0,
    );
}

/** Type guard: machining có side (drill + pocket, không phải edge_drill). */
function hasSide(m: { op: string }): m is { op: 'drill' | 'pocket'; side: 'front' | 'back'; purpose: string; through?: boolean } {
  return m.op === 'drill' || m.op === 'pocket';
}

/** P75 — cao độ scene các tâm CHÉN bản lề trên mọi part cánh (sorted). */
function cupSceneYs(parts: BuildResult['parts']): number[] {
  const out: number[] = [];
  for (const d of parts) {
    if (d.label !== 'Cánh tủ') continue;
    for (const m of d.machining ?? []) {
      if (m.op !== 'pocket' || m.purpose !== 'hinge') continue;
      // Frame cánh: trục dài = max(faceW, faceH) → toạ độ đứng là x_mm nếu cao > rộng.
      const coordY = d.size[1] > d.size[0] ? m.x_mm : m.y_mm;
      out.push(d.position[1] - d.size[1] / 2 + coordY);
    }
  }
  return out.sort((a, b) => a - b);
}

/** P75 — cao độ scene tâm các BÁT bản lề: gom cặp vít hinge theo (part vách, side)
 *  rồi lấy trung điểm từng cặp (2 cánh đối diện chung 1 vách nằm 2 side khác nhau). */
function plateCenterYs(parts: BuildResult['parts']): number[] {
  const centers: number[] = [];
  for (const p of parts) {
    if (p.label !== 'Vách đứng') continue;
    const bySide = new Map<string, number[]>();
    for (const m of p.machining ?? []) {
      if (m.op !== 'drill' || m.purpose !== 'hinge') continue;
      const local = p.size[1] >= p.size[2] ? m.x_mm : m.y_mm;
      const y = local + p.position[1] - p.size[1] / 2;
      const arr = bySide.get(m.side) ?? [];
      arr.push(y);
      bySide.set(m.side, arr);
    }
    for (const ys of bySide.values()) {
      ys.sort((a, b) => a - b);
      for (let i = 0; i + 1 < ys.length; i += 2) centers.push((ys[i] + ys[i + 1]) / 2);
    }
  }
  return centers.sort((a, b) => a - b);
}

/** P75 — so khớp chén↔bát: null nếu khớp 1:1 trong ±0.5mm, ngược lại mô tả lỗi. */
function cupPlateMismatch(parts: BuildResult['parts']): string | null {
  const cups = cupSceneYs(parts);
  const plates = plateCenterYs(parts);
  if (cups.length === 0) return 'không có chén bản lề nào';
  if (cups.length !== plates.length)
    return `chén=${cups.length} ≠ bát=${plates.length} (cánh mồ côi bản lề)`;
  for (let i = 0; i < cups.length; i++) {
    if (Math.abs(cups[i] - plates[i]) > 0.5)
      return `chén Y=${cups[i].toFixed(1)} lệch bát Y=${plates[i].toFixed(1)}`;
  }
  return null;
}

function buildMachiningCases(): MachiningCase[] {
  // Cấu hình 3 cột × 2 tầng với 1 ô cánh đơn ở (T1,C0).
  const cellsDoor = encodeCellGrid([
    ['door', 'open-back', 'open-back'],
    ['open-back', 'open-back', 'open-back'],
  ]);
  // Cấu hình 3 cột × 2 tầng với 1 ô ngăn kéo ở (T1,C0).
  const cellsDrawer = encodeCellGrid([
    ['drawer', 'open-back', 'open-back'],
    ['open-back', 'open-back', 'open-back'],
  ]);
  return [
    {
      // P74: đáy = foot Ø8 (mặt dưới 'back') + rãnh connector mặt TRÊN ('front')
      // do post-pass phát. Không còn confirmat counterbore.
      name: 'Đáy: foot Ø8 (back) + rãnh connector 2-in-1 (front)',
      overrides: {},
      check: (b) => {
        const bottom = b.parts.find((p) => p.label === 'Tấm đáy');
        if (!bottom) return 'không tìm thấy tấm đáy';
        const mach = bottom.machining ?? [];
        const ft = mach.filter((m) => m.purpose === 'foot').length;
        if (ft < 4) return `foot trên đáy = ${ft}, kỳ vọng ≥ 4`;
        const footBack = mach.filter((m) => m.purpose === 'foot' && hasSide(m) && m.side === 'back').length;
        if (footBack !== ft) return `foot phải có side='back' hết (${footBack}/${ft})`;
        const slots = mach.filter((m) => m.op === 'slot' && m.purpose === 'connector');
        // Mỗi vách × 2 vị trí × 2 rãnh lồng nhau (vành + giữa) — tối thiểu 2 vách → 8 op
        if (slots.length < 8) return `rãnh connector trên đáy = ${slots.length}, kỳ vọng ≥ 8`;
        const slotUp = slots.filter((m) => m.op === 'slot' && m.side === 'front').length;
        if (slotUp !== slots.length) return `rãnh đáy phải ở mặt 'front' (mặt trên) hết (${slotUp}/${slots.length})`;
        if (mach.some((m) => (m.purpose as string) === 'confirmat')) return 'đáy còn confirmat (P74 phải bỏ)';
        return null;
      },
    },
    {
      // P74: nóc = rãnh connector mặt DƯỚI ('front' theo quy ước nóc) — post-pass.
      name: 'Nóc: rãnh connector 2-in-1 mặt dưới',
      overrides: {},
      check: (b) => {
        const top = b.parts.find((p) => p.label === 'Tấm nóc');
        if (!top) return 'không tìm thấy tấm nóc';
        const mach = top.machining ?? [];
        const slots = mach.filter((m) => m.op === 'slot' && m.purpose === 'connector');
        if (slots.length < 8) return `rãnh connector trên nóc = ${slots.length}, kỳ vọng ≥ 8`;
        const slotDown = slots.filter((m) => m.op === 'slot' && m.side === 'front').length;
        if (slotDown !== slots.length) return `rãnh nóc phải ở mặt 'front' (mặt dưới) hết (${slotDown}/${slots.length})`;
        return null;
      },
    },
    {
      // P74 ĐẢO test cũ: kệ giữa CỐ ĐỊNH bằng connector → PHẢI có rãnh ở CẢ 2 MẶT
      // (vách tầng dưới cắm lên mặt dưới 'back', vách tầng trên đứng xuống mặt trên
      // 'front') — hết thời kệ trượt rỗng machining.
      name: 'Kệ giữa: rãnh connector cả 2 mặt (kệ cố định)',
      overrides: { rows: 3 },
      check: (b) => {
        const shelves = b.parts.filter((p) => p.label === 'Kệ');
        if (shelves.length === 0) return 'không tìm thấy kệ giữa';
        for (const sh of shelves) {
          const slots = (sh.machining ?? []).filter(
            (m) => m.op === 'slot' && m.purpose === 'connector',
          );
          const up = slots.filter((m) => m.op === 'slot' && m.side === 'front').length;
          const down = slots.filter((m) => m.op === 'slot' && m.side === 'back').length;
          if (up < 8 || down < 8)
            return `kệ ${sh.id}: rãnh connector front=${up}/back=${down}, kỳ vọng ≥8 mỗi mặt`;
        }
        return null;
      },
    },
    {
      // P74: vách KHÔNG còn lỗ mặt nào ngoài bản lề/ray — shelfPin line 32mm + clip
      // hậu trên mặt vách đã bỏ. Config mặc định không cánh/ngăn kéo/sub-split →
      // machining vách CHỈ được phép là edge_drill connector.
      name: 'Vách: mặt sạch — chỉ edge_drill connector (hết shelfPin/clip)',
      overrides: {},
      check: (b) => {
        const dividers = b.parts.filter((p) => p.label === 'Vách đứng');
        if (dividers.length === 0) return 'không tìm thấy vách đứng';
        for (const d of dividers) {
          for (const m of d.machining ?? []) {
            if (m.op !== 'edge_drill') return `vách ${d.id} còn op mặt ${m.op}/${m.purpose} (phải sạch)`;
            if (m.purpose !== 'connector') return `vách ${d.id} edge purpose=${m.purpose}, kỳ vọng connector`;
          }
        }
        return null;
      },
    },
    {
      // P74: mỗi vách part có ĐÚNG 4 lỗ chốt connector Ø8×32 (2 cạnh × 2 lỗ; vách
      // fused nhiều tầng chỉ giữ cạnh ngoài cùng → vẫn 4).
      name: 'Vách: connector edge_drill Ø8×32 (top + bottom)',
      overrides: {},
      check: (b) => {
        const dividers = b.parts.filter((p) => p.label === 'Vách đứng');
        let edgeCount = 0;
        for (const d of dividers) {
          for (const m of d.machining ?? []) {
            if (m.op === 'edge_drill' && m.purpose === 'connector') {
              if (m.diameter_mm !== 8) return `lỗ chốt Ø${m.diameter_mm}, kỳ vọng 8`;
              if (m.depth_mm !== 32) return `lỗ chốt sâu ${m.depth_mm}, kỳ vọng 32`;
              edgeCount++;
            }
          }
        }
        if (edgeCount !== dividers.length * 4)
          return `connector edge = ${edgeCount}, kỳ vọng ${dividers.length * 4} (4 mỗi vách part)`;
        return null;
      },
    },
    {
      // P74 LOCK 1:1 — mỗi edge_drill connector (1 chốt) có đúng 1 bộ rãnh nhận
      // (2 op slot: vành + rãnh giữa) trên tấm đối diện → tổng op slot toàn tủ
      // = 2 × tổng chốt. Bắt drift giữa phía chốt (dựng part) và phía rãnh (post-pass).
      name: 'Lock: tổng rãnh slot = 2 × tổng chốt connector (toàn tủ)',
      overrides: { rows: 3 },
      check: (b) => {
        let pins = 0;
        let slotOps = 0;
        for (const p of b.parts) {
          for (const m of p.machining ?? []) {
            if (m.op === 'edge_drill' && m.purpose === 'connector') pins++;
            if (m.op === 'slot' && m.purpose === 'connector') slotOps++;
          }
        }
        if (pins === 0) return 'không có chốt connector nào';
        if (slotOps !== pins * 2) return `slot op = ${slotOps}, kỳ vọng ${pins * 2} (2 op/chốt)`;
        return null;
      },
    },
    {
      // P74 LOCK — chốt lò xo hậu ↔ lỗ đón 1:1. Mặc định mọi ô open-back → mỗi tấm
      // hậu 2 cạnh × 2 chốt = 4; mỗi chốt 1 lỗ đón Ø8 trên tấm ngang.
      name: 'Lock: chốt lò xo hậu = lỗ đón trên tấm ngang',
      overrides: { rows: 3 },
      check: (b) => {
        let pins = 0;
        let faceHoles = 0;
        for (const p of b.parts) {
          for (const m of p.machining ?? []) {
            if (m.purpose !== 'backScrew') continue;
            if (m.op === 'edge_drill') pins++;
            else if (m.op === 'drill') faceHoles++;
          }
        }
        const backs = b.parts.filter((p) => p.label === 'Tấm lưng').length;
        if (backs === 0) return 'không có tấm lưng (config mặc định phải có)';
        if (pins !== backs * 4) return `chốt hậu = ${pins}, kỳ vọng ${backs * 4} (2 cạnh × 2 chốt/tấm)`;
        if (faceHoles !== pins) return `lỗ đón = ${faceHoles} ≠ chốt = ${pins}`;
        return null;
      },
    },
    {
      // P74 LOCK — BOM khớp machining: connector_2in1 qty = tổng chốt connector;
      // back_clip qty = tổng chốt lò xo hậu.
      name: 'Lock: BOM connector_2in1 + back_clip khớp số chốt',
      overrides: { rows: 3 },
      check: (b) => {
        let pins = 0;
        let backPins = 0;
        for (const p of b.parts) {
          for (const m of p.machining ?? []) {
            if (m.op !== 'edge_drill') continue;
            if (m.purpose === 'connector') pins++;
            else if (m.purpose === 'backScrew') backPins++;
          }
        }
        const connHw = b.hardware?.find((h) => h.id === 'connector_2in1');
        const clipHw = b.hardware?.find((h) => h.id === 'back_clip');
        if ((connHw?.qty ?? 0) !== pins) return `BOM connector_2in1 = ${connHw?.qty ?? 0}, machining = ${pins}`;
        if ((clipHw?.qty ?? 0) !== backPins) return `BOM back_clip = ${clipHw?.qty ?? 0}, machining = ${backPins}`;
        return null;
      },
    },
    {
      // P74 LOCK — lỗ chân tủ không đè rãnh connector trên đáy (lý do FOOT_INSET
      // 45→90): kiểm hình học thật giữa mọi cặp foot × slot trên tấm đáy.
      name: 'Lock: foot không đè rãnh connector trên đáy',
      overrides: {},
      check: (b) => {
        const bottom = b.parts.find((p) => p.label === 'Tấm đáy');
        if (!bottom) return 'không tìm thấy tấm đáy';
        const mach = bottom.machining ?? [];
        for (const f of mach) {
          if (f.op !== 'drill' || f.purpose !== 'foot') continue;
          for (const s of mach) {
            if (s.op !== 'slot') continue;
            const dx = Math.abs(f.x_mm - s.x_mm);
            const dy = Math.abs(f.y_mm - s.y_mm);
            const longHalf = s.length_mm / 2 + f.diameter_mm / 2;
            const wideHalf = s.width_mm / 2 + f.diameter_mm / 2;
            const overlap =
              s.along === 'width' ? dx < wideHalf && dy < longHalf : dx < longHalf && dy < wideHalf;
            if (overlap) return `foot (${f.x_mm},${f.y_mm}) đè rãnh (${s.x_mm},${s.y_mm})`;
          }
        }
        return null;
      },
    },
    {
      // P75 — Hafele 311.88.512: chén Ø35 sâu 12, vít hệ 48/6 (±24 dọc cánh + lùi 6
      // vào lòng cánh), lỗ mồi Ø2.5.
      name: 'Cánh đơn — handle + chén Ø35×12 + vít hệ 48/6 lỗ mồi Ø2.5',
      // width=1000 → cw≈315mm < WIDE_CELL=600 → cánh ĐƠN (không phải cánh đôi).
      // P58: ghim handleType='round' (núm tròn = ĐÚNG 1 lỗ khoan handle).
      overrides: { width: 1000, height: 1100, cells: cellsDoor, handleType: 'round' },
      check: (b) => {
        const doors = b.parts.filter((p) => p.label === 'Cánh tủ');
        if (doors.length === 0) return 'không tìm thấy cánh tủ';
        const mach = doors[0].machining ?? [];
        const handle = mach.filter((m) => m.purpose === 'handle').length;
        const cups = mach.filter(
          (m) => m.purpose === 'hinge' && m.op === 'pocket' && m.diameter_mm === 35,
        );
        const screws = mach.filter(
          (m) =>
            m.purpose === 'hinge' && m.op === 'drill' && m.side === 'back' && m.diameter_mm === 2.5,
        );
        if (handle !== 1) return `cánh phải có ĐÚNG 1 handle (có ${handle})`;
        if (cups.length < 2) return `cánh phải có ≥2 chén Ø35 (có ${cups.length})`;
        const badDepth = cups.find((m) => m.op === 'pocket' && m.depth_mm !== 12);
        if (badDepth) return `chén phải sâu 12mm (Hafele), có ${badDepth.op === 'pocket' ? badDepth.depth_mm : '?'}`;
        if (screws.length !== cups.length * 2)
          return `vít chén lỗ mồi Ø2.5 = ${screws.length}, kỳ vọng ${cups.length * 2} (2 vít/chén)`;
        // Hệ 48/6: với mỗi chén phải có 2 vít lệch ĐÚNG ±24 theo trục dọc cánh và
        // 6mm theo trục ngang (lùi vào lòng cánh).
        for (const cup of cups) {
          if (cup.op !== 'pocket') continue;
          const mates = screws.filter((s) => {
            if (s.op !== 'drill') return false;
            const dx = Math.abs(s.x_mm - cup.x_mm);
            const dy = Math.abs(s.y_mm - cup.y_mm);
            // trục dọc cánh có thể là x hoặc y theo frame part → chấp nhận 2 chiều
            return (
              (Math.abs(dx - 24) < 0.6 && Math.abs(dy - 6) < 0.6) ||
              (Math.abs(dy - 24) < 0.6 && Math.abs(dx - 6) < 0.6)
            );
          });
          if (mates.length !== 2)
            return `chén tại (${cup.x_mm},${cup.y_mm}) phải có đúng 2 vít hệ 48/6 (thấy ${mates.length})`;
        }
        return null;
      },
    },
    {
      name: 'Vách bên cạnh cánh — có lỗ mồi vít bát Ø2.5 (post-pass P75)',
      overrides: { width: 1000, height: 1100, cells: cellsDoor },
      check: (b) => {
        const total = sumPurpose(b.parts, 'Vách đứng', 'hinge');
        if (total < 4) return `vách phải có ≥4 lỗ vít bát (có ${total})`;
        return null;
      },
    },
    {
      // P76.1 theo BẢN VẼ chính hãng: mỗi ray = các CỤM lỗ tại {0,128,224} từ lỗ
      // đầu (37 từ mép trước ray), mỗi cụm 2 lỗ ĐỨNG cách 12; hàng dưới = đáy ô
      // + 10.2. D default 400 → ray 350 (≥300) → 3 cụm × 2 = 6 lỗ/ray.
      name: 'P76: vách cạnh ngăn kéo — cụm vít ray theo bản vẽ (2 hàng cách 12)',
      // height=700 + rows=2 → rowHeight≈323mm < DRAWER_MAX_HEIGHT=400 → drawer hợp lệ
      overrides: { height: 700, cells: cellsDrawer },
      check: (b) => {
        const railSides: { y: number; z: number }[][] = [];
        for (const p of b.parts) {
          if (p.label !== 'Vách đứng') continue;
          const bySide = new Map<string, { y: number; z: number }[]>();
          for (const m of p.machining ?? []) {
            if (m.op !== 'drill' || m.purpose !== 'drawerSlide') continue;
            if (m.diameter_mm !== 2.5) return `lỗ vít ray Ø${m.diameter_mm}, kỳ vọng 2.5`;
            // Vách [T,h,D]: trục đứng = x_mm nếu h≥D, ngược lại y_mm; trục sâu = còn lại.
            const vert = p.size[1] >= p.size[2] ? m.x_mm : m.y_mm;
            const depth = p.size[1] >= p.size[2] ? m.y_mm : m.x_mm;
            const arr = bySide.get(m.side) ?? [];
            arr.push({ y: vert + p.position[1] - p.size[1] / 2, z: depth });
            bySide.set(m.side, arr);
          }
          for (const arr of bySide.values()) if (arr.length) railSides.push(arr);
        }
        if (railSides.length !== 2) return `kỳ vọng 2 mặt vách có vít ray, có ${railSides.length}`;
        for (const arr of railSides) {
          if (arr.length !== 6) return `mỗi ray phải 3 cụm × 2 lỗ = 6 (D400→ray 350), có ${arr.length}`;
          // 2 hàng đứng: dưới = đáy ô + 10.2 (tầng 1: 18+5+10.2 = 33.2), trên +12.
          const ys = [...new Set(arr.map((a) => Math.round(a.y * 10) / 10))].sort((x, y2) => x - y2);
          if (ys.length !== 2) return `phải đúng 2 hàng đứng, có ${ys.length} (${ys.join(',')})`;
          if (Math.abs(ys[0] - (18 + 5 + 10.2)) > 0.5)
            return `hàng dưới = ${ys[0]}, kỳ vọng ${18 + 5 + 10.2}`;
          if (Math.abs(ys[1] - ys[0] - 12) > 0.5) return `2 hàng cách ${(ys[1] - ys[0]).toFixed(1)}, kỳ vọng 12`;
          // Cụm theo chiều sâu: 3 vị trí z, khoảng cách 128 rồi 96 (bản vẽ).
          const zs = [...new Set(arr.map((a) => Math.round(a.z * 10) / 10))].sort((x, y2) => x - y2);
          if (zs.length !== 3) return `phải 3 cụm theo chiều sâu, có ${zs.length}`;
          const gaps = [zs[1] - zs[0], zs[2] - zs[1]].sort((x, y2) => x - y2);
          if (Math.abs(gaps[0] - 96) > 0.5 || Math.abs(gaps[1] - 128) > 0.5)
            return `khoảng cách cụm = ${gaps.map((g) => g.toFixed(0)).join('/')}, kỳ vọng 96/128`;
        }
        return null;
      },
    },
    {
      // P76 — Hộc ray âm: thành (hông+hậu) = ván THÂN (17/18); đáy giữ 9; sâu thùng
      // = đúng chiều ray (D 400 default → ray 350); mặt ngăn kéo giữ T.
      name: 'P76: hộc ray âm — thành ván thân, đáy 9, sâu thùng = chiều ray',
      overrides: { height: 700, cells: cellsDrawer },
      check: (b) => {
        const walls = b.parts.filter((p) => p.label === 'Hông hộc' || p.label === 'Hậu hộc');
        const bots = b.parts.filter((p) => p.label === 'Đáy hộc');
        if (walls.length < 3 || bots.length < 1) return `thiếu part hộc (thành=${walls.length} đáy=${bots.length})`;
        const badWall = walls.find((p) => p.thickness_mm !== 18 && p.thickness_mm !== 17);
        if (badWall) return `${badWall.label} dày ${badWall.thickness_mm}, kỳ vọng ván thân 17/18`;
        const badBot = bots.find((p) => p.thickness_mm !== 9);
        if (badBot) return `đáy hộc dày ${badBot.thickness_mm}, kỳ vọng 9`;
        // depth default 400 → ray 350 → hông hộc sâu (size lớn nhất ngoài bh) = 350.
        const side = b.parts.find((p) => p.id.startsWith('drawerL-'));
        if (!side) return 'không thấy hông hộc';
        const bd = side.size[2];
        if (Math.abs(bd - 350) > 0.5) return `sâu thùng = ${bd}, kỳ vọng 350 (= ray, D=400)`;
        const front = b.parts.find((p) => p.label === 'Mặt ngăn kéo');
        if (front && front.thickness_mm !== 18) return `mặt ngăn kéo dày ${front.thickness_mm}mm, kỳ vọng 18`;
        return null;
      },
    },
    {
      // P76 — 2 lỗ Ø6 đón chốt đuôi ray trên HẬU HỘC (cách sườn 7 / mép dưới 11).
      name: 'P76: hậu hộc — 2 lỗ Ø6 chốt đuôi ray tại 7/11',
      overrides: { height: 700, cells: cellsDrawer },
      check: (b) => {
        const bk = b.parts.find((p) => p.label === 'Hậu hộc');
        if (!bk) return 'không thấy hậu hộc';
        const pins = (bk.machining ?? []).filter((m) => m.purpose === 'drawerRailPin');
        if (pins.length !== 2) return `kỳ vọng 2 lỗ chốt đuôi ray, có ${pins.length}`;
        for (const m of pins) {
          if (m.op !== 'drill') return 'lỗ chốt phải là drill';
          if (m.diameter_mm !== 6) return `lỗ chốt Ø${m.diameter_mm}, kỳ vọng 6`;
          // Hậu hộc [w,h,T]: frame theo sort — kiểm khoảng cách tới mép qua min coord.
          const w = Math.max(bk.size[0], bk.size[1]);
          const h = Math.min(bk.size[0], bk.size[1]);
          const along = Math.min(m.x_mm, w - m.x_mm);
          const up = Math.min(m.y_mm, h - m.y_mm);
          if (Math.abs(along - 7) > 0.6 && Math.abs(up - 7) > 0.6)
            return `lỗ chốt không cách sườn 7 (along=${along.toFixed(1)} up=${up.toFixed(1)})`;
          if (Math.abs(along - 11) > 0.6 && Math.abs(up - 11) > 0.6)
            return `lỗ chốt không cách mép dưới 11 (along=${along.toFixed(1)} up=${up.toFixed(1)})`;
        }
        return null;
      },
    },
    {
      // P76 LOCK — mỗi nấc sâu BOM đúng 1 mã ray; sâu 250 drawer degrade thành cánh.
      name: 'P76 Lock: depth 300/350/400/450 → đúng mã ray; 250 → không ngăn kéo',
      overrides: { height: 700, cells: cellsDrawer, depth: 300 },
      check: (b) => {
        const hw = b.hardware.find((h) => h.id.startsWith('drawer-slide'));
        if (!hw || hw.id !== 'drawer-slide-270')
          return `depth 300 → kỳ vọng drawer-slide-270, có ${hw?.id ?? 'không'}`;
        if (!(hw.label.includes('433.03.001'))) return `label thiếu mã 433.03.001: ${hw.label}`;
        return null;
      },
    },
    {
      name: 'P76 Lock: depth 450 → ray 400 (433.03.004), sâu thùng 400',
      overrides: { height: 700, cells: cellsDrawer, depth: 450 },
      check: (b) => {
        const hw = b.hardware.find((h) => h.id.startsWith('drawer-slide'));
        if (!hw || hw.id !== 'drawer-slide-400')
          return `depth 450 → kỳ vọng drawer-slide-400, có ${hw?.id ?? 'không'}`;
        const side = b.parts.find((p) => p.id.startsWith('drawerL-'));
        if (!side || Math.abs(side.size[2] - 400) > 0.5)
          return `sâu thùng = ${side?.size[2]}, kỳ vọng 400`;
        return null;
      },
    },
    {
      name: 'P76 Lock: depth 250 → drawer degrade thành CÁNH, 0 part hộc, BOM không ray',
      overrides: { height: 700, cells: cellsDrawer, depth: 250 },
      check: (b) => {
        const boxes = b.parts.filter((p) => p.label === 'Hông hộc');
        if (boxes.length !== 0) return `sâu 250 vẫn có ${boxes.length} hông hộc`;
        const hw = b.hardware.find((h) => h.id.startsWith('drawer-slide'));
        if (hw) return `sâu 250 BOM vẫn có ray ${hw.id}`;
        const doors = b.parts.filter((p) => p.label === 'Cánh tủ');
        if (doors.length === 0) return 'drawer phải degrade thành cánh (0 cánh)';
        return null;
      },
    },
    {
      // P76 LOCK — BOM × machining: qty ray × 2 ray × railScrewsPerRail = tổng lỗ
      // drawerSlide trên vách; + hộc không vượt mặt trong tấm hậu (D=300 chật nhất).
      name: 'P76 Lock: BOM ray khớp vít vách + hộc không đâm tấm hậu (D=300)',
      overrides: { height: 700, cells: cellsDrawer, depth: 300 },
      check: (b) => {
        const hw = b.hardware.find((h) => h.id.startsWith('drawer-slide'));
        if (!hw) return 'BOM thiếu ray';
        const total = sumPurpose(b.parts, 'Vách đứng', 'drawerSlide');
        // D=300 → ray 270 < 300 → 2 cụm × 2 lỗ = 4 lỗ/ray (bản vẽ).
        if (total !== hw.qty * 2 * 4)
          return `vít ray = ${total}, kỳ vọng ${hw.qty * 2 * 4} (qty×2 ray×2 cụm×2 lỗ)`;
        // Hộc: mặt sau thùng ≥ mặt trong tấm hậu (z = −D/2 + T_BACK).
        const side = b.parts.find((p) => p.id.startsWith('drawerL-'));
        if (!side) return 'không thấy hông hộc';
        const rear = side.position[2] - side.size[2] / 2;
        const backInner = -300 / 2 + 9;
        if (rear < backInner - 0.01)
          return `hộc đâm tấm hậu: mặt sau thùng z=${rear.toFixed(1)} < ${backInner}`;
        return null;
      },
    },
    {
      // P76 LOCK — drawer trong ô CHIA DỌC: vít ray theo đáy SUB + bắt cả vào VÁCH PHỤ.
      name: 'P76 Lock: drawer chia dọc — vít ray đúng đáy sub, có trên vách phụ',
      overrides: {
        columns: 1, rows: 1, widthMode: 'manual', heightMode: 'manual',
        colW_0: 600, tierH_0: 350,
        cells: encodeBlocks([{ r: 0, c: 0, rs: 1, cs: 1, t: 'drawer>drawer' }]),
      },
      check: (b) => {
        const boxes = b.parts.filter((p) => p.label === 'Hông hộc');
        if (boxes.length !== 4) return `kỳ vọng 2 hộc (4 hông), có ${boxes.length}`;
        const subv = b.parts.find((p) => p.id.startsWith('subv-'));
        if (!subv) return 'không thấy vách phụ';
        const subvScrews = (subv.machining ?? []).filter(
          (m) => m.op === 'drill' && m.purpose === 'drawerSlide',
        ).length;
        // Vách phụ giữa nhận ray của CẢ 2 hộc; D default 400 → ray 350 → 3 cụm × 2 lỗ.
        if (subvScrews !== 12) return `vách phụ phải có 12 lỗ vít ray (2 hộc × 6), có ${subvScrews}`;
        return null;
      },
    },
    // ===== P75 — LOCK bản lề Hafele: chén↔bát khớp MỌI loại cánh + gap an toàn =====
    {
      name: 'P75 Lock: chén↔bát khớp — cánh ĐƠN (primitive)',
      overrides: { width: 1000, height: 1100, cells: cellsDoor },
      check: (b) => cupPlateMismatch(b.parts),
    },
    {
      name: 'P75 Lock: chén↔bát khớp — cánh ĐÔI (ô rộng 700)',
      overrides: {
        columns: 1, rows: 1, widthMode: 'manual', heightMode: 'manual',
        colW_0: 700, tierH_0: 450, cells: 'door',
      },
      check: (b) => cupPlateMismatch(b.parts),
    },
    {
      name: 'P75 Lock: chén↔bát khớp — cánh CHIA DỌC (door>door) — fix chén mồ côi',
      overrides: {
        columns: 1, rows: 1, widthMode: 'manual', heightMode: 'manual',
        colW_0: 600, tierH_0: 450,
        cells: encodeBlocks([{ r: 0, c: 0, rs: 1, cs: 1, t: 'door>door' }]),
      },
      check: (b) => {
        const doors = b.parts.filter((p) => p.label === 'Cánh tủ');
        if (doors.length !== 2) return `kỳ vọng 2 cánh sub-cell, có ${doors.length}`;
        return cupPlateMismatch(b.parts);
      },
    },
    {
      name: 'P75 Lock: chén↔bát khớp — cánh CHIA NGANG (door^door)',
      overrides: {
        columns: 1, rows: 1, widthMode: 'manual', heightMode: 'manual',
        colW_0: 400, tierH_0: 450,
        cells: encodeBlocks([{ r: 0, c: 0, rs: 1, cs: 1, t: 'door^door' }]),
      },
      check: (b) => {
        const doors = b.parts.filter((p) => p.label === 'Cánh tủ');
        if (doors.length !== 2) return `kỳ vọng 2 cánh sub-cell, có ${doors.length}`;
        return cupPlateMismatch(b.parts);
      },
    },
    {
      // Cánh thấp nấc 250 (faceH 246): công thức cũ cho gap 46 (vít đè chén kề);
      // P75.1 chuẩn ngành: mép 60 (cận dưới dải Hettich 60–100) → 2 bản lề cách 126.
      name: 'P75 Lock: cánh thấp 246 — mép 60, 2 bản lề cách nhau 126 (chuẩn ngành)',
      overrides: {
        columns: 1, rows: 1, widthMode: 'manual', heightMode: 'manual',
        colW_0: 400, tierH_0: 250, cells: 'door',
      },
      check: (b) => {
        const cups = cupSceneYs(b.parts);
        if (cups.length !== 2) return `kỳ vọng 2 chén, có ${cups.length}`;
        const gap = cups[1] - cups[0];
        if (Math.abs(gap - 126) > 0.5) return `gap bản lề = ${gap.toFixed(1)}, kỳ vọng 126`;
        return cupPlateMismatch(b.parts);
      },
    },
    {
      // P75.1: cánh tầng 450 (faceH 446) → mép 83, X = 280 đúng khuyến nghị Hettich.
      name: 'P75 Lock: cánh 446 — X = 280 (mục tiêu Hettich)',
      overrides: {
        columns: 1, rows: 1, widthMode: 'manual', heightMode: 'manual',
        colW_0: 400, tierH_0: 450, cells: 'door',
      },
      check: (b) => {
        const cups = cupSceneYs(b.parts);
        if (cups.length !== 2) return `kỳ vọng 2 chén, có ${cups.length}`;
        const gap = cups[1] - cups[0];
        if (Math.abs(gap - 280) > 0.5) return `X = ${gap.toFixed(1)}, kỳ vọng 280`;
        return cupPlateMismatch(b.parts);
      },
    },
    {
      // P75: chia ngang tầng 150 → cánh cao thực 62mm < DOOR_MIN_HEIGHT 116 →
      // degrade ô mở (trước đây sinh bản lề NGOÀI cánh y=−38). Tầng 250 (cao 112)
      // GIỮ cánh với bản lề nén [30, 82] — gap 52 = sàn vật lý.
      name: 'P75 Lock: cánh lùn — tầng 150 chia ngang degrade, tầng 250 giữ (gap 52)',
      overrides: {
        columns: 1, rows: 1, widthMode: 'manual', heightMode: 'manual',
        colW_0: 400, tierH_0: 150,
        cells: encodeBlocks([{ r: 0, c: 0, rs: 1, cs: 1, t: 'door^door' }]),
      },
      check: (b) => {
        const doors = b.parts.filter((p) => p.label === 'Cánh tủ');
        if (doors.length !== 0) return `tầng 150 chia ngang phải 0 cánh (degrade), có ${doors.length}`;
        // mọi machining hinge cũng phải biến mất
        const cups = cupSceneYs(b.parts);
        if (cups.length !== 0) return `vẫn còn ${cups.length} chén bản lề sau degrade`;
        return null;
      },
    },
    {
      name: 'P75 Lock: cánh lùn tầng 250 chia ngang — giữ cánh, gap 52, không thủng mép',
      overrides: {
        columns: 1, rows: 1, widthMode: 'manual', heightMode: 'manual',
        colW_0: 400, tierH_0: 250,
        cells: encodeBlocks([{ r: 0, c: 0, rs: 1, cs: 1, t: 'door^door' }]),
      },
      check: (b) => {
        const doors = b.parts.filter((p) => p.label === 'Cánh tủ');
        if (doors.length !== 2) return `kỳ vọng 2 cánh (faceH 112 ≥ sàn), có ${doors.length}`;
        for (const d of doors) {
          const faceH = d.size[1]; // part cánh luôn dựng [faceW, faceH, T]
          const ys: number[] = [];
          for (const m of d.machining ?? []) {
            if (m.op !== 'pocket' || m.purpose !== 'hinge') continue;
            ys.push(d.size[1] > d.size[0] ? m.x_mm : m.y_mm);
          }
          ys.sort((a, b2) => a - b2);
          if (ys.length !== 2) return `cánh ${d.id}: kỳ vọng 2 chén, có ${ys.length}`;
          const gap = ys[1] - ys[0];
          if (gap < 51.5) return `cánh ${d.id}: gap ${gap.toFixed(1)} < 52 (chồng lỗ)`;
          // Chén Ø35 không thủng mép cánh: tâm ≥ 18 từ mỗi mép.
          if (ys[0] < 18 || ys[1] > faceH - 18)
            return `cánh ${d.id}: chén thủng mép (Y=${ys.map((y) => y.toFixed(0)).join(',')} / faceH=${faceH.toFixed(0)})`;
        }
        return cupPlateMismatch(b.parts);
      },
    },
  ];
}

function runMachiningCase(c: MachiningCase): string | null {
  try {
    const build = runPipeline(c.overrides);
    return c.check(build);
  } catch (e) {
    return (e as Error).message;
  }
}

main();
