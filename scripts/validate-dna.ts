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
import { encodeCellGrid } from '../src/configurator/cellgrid';
import { buildCutlist } from '../src/configurator/cutlist';
import { computePrice, formatPrice } from '../src/configurator/pricing';
import type { BuildResult, ParamValues, Part, PriceConfig } from '../src/configurator/types';

// Khổ ván xưởng dùng (mm): thân tủ 18mm · ván hậu / đáy hộc 9mm.
// Mọi Part phải có thickness_mm thuộc tập này.
const BOARD_THICKNESSES = [9, 18];

// Mốc tham chiếu ca "Mặc định" — cấu hình mặc định mới (tủ showcase 1900×2200, 4 cột × 6 tầng).
const BASELINE = { total: 18_646_803, panels: 101, areaM2: 16.54 };

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
  console.log(
    `Kết quả: ${passed}/${cases.length} cấu hình ĐẠT · tự kiểm ${selfOk ? 'ĐẠT' : 'HỎNG'}`,
  );

  if (selfOk && passed === cases.length) {
    console.log('TẤT CẢ ĐẠT');
  } else {
    console.log('CÓ LỖI — xem dòng FAIL ở trên');
    process.exitCode = 1;
  }
}

main();
