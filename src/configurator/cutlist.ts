// =============================================================
// CUTLIST — BuildResult → bảng cắt cho xưởng. Thư viện chung.
// build() sinh mỗi tấm là 1 Part riêng (vì mỗi Part = 1 hộp 3D ở 1 vị trí);
// cutlist GỘP các tấm giống hệt nhau lại thành 1 dòng có số lượng.
//
// Edge-banding upgrade (additive, sau S10):
//  - Material có dán cạnh (resolveMaterial.noEdgeBanding !== true): kích thước
//    CẮT = bản vẽ TRỪ 2× độ dày dán cạnh mỗi chiều (xưởng dán xong = bản vẽ).
//  - Material lộ cạnh (vd plywood An Cường): kích thước cắt = bản vẽ.
//  - totalEdgeBandingM = tổng mét dán cạnh = sum(chu vi bản vẽ × qty) / 1000.
//  - Vắng `config.edgeBandingMmByBoardType` → coi như 0mm (không trừ kích thước,
//    không tính chu vi) → hành vi cũ tương thích ngược.
// =============================================================
import { hardwareWeightKg, materialDensityKgPerM3 } from './pricing';
import { resolveMaterial } from './materials';
import type { BuildResult, Part, PriceConfig } from './types';

/** Lấy ghi chú đặc biệt của vật liệu (vd plywood_melamine: cạnh lộ — không dán nẹp). */
function materialNote(material: string): string {
  const m = resolveMaterial(material);
  return m.noEdgeBanding ? 'Cạnh lộ — không dán nẹp (xưởng giữ raw plywood)' : '';
}

/** Ghép part.notes + materialNote (nếu có), tránh duplicate. */
function partFullNotes(part: Part): string | undefined {
  const mNote = materialNote(part.material);
  if (!mNote) return part.notes;
  if (!part.notes) return mNote;
  return `${mNote} · ${part.notes}`;
}

/** Một dòng bảng cắt — nhóm các tấm trùng kích thước/vật liệu/vân. */
export interface CutlistRow {
  label: string;
  qty: number;
  length_mm: number;
  width_mm: number;
  thickness_mm: number;
  weight_kg: number; // cân nặng cả dòng (đã nhân qty), kg
  material: string;
  grain: Part['grain'];
  notes?: string;
}

/** Một dòng phụ kiện. */
export interface HardwareRow {
  label: string;
  qty: number;
  weight_kg: number; // cân nặng cả dòng (đã nhân qty), kg
  notes?: string; // ghi chú vị trí / cách lắp (vd chân tủ bắt ở đâu)
}

/** Bảng cắt hoàn chỉnh. */
export interface Cutlist {
  panels: CutlistRow[];
  hardware: HardwareRow[];
  totalPanels: number; // tổng số tấm phải cắt
  totalAreaM2: number; // tổng diện tích ván
  totalWeightKg: number; // tổng cân toàn tủ (ván + phụ kiện), kg
  // (S10, tùy chọn) Mỗi Part NGUYÊN BẢN từ build() — không gộp, giữ position +
  // holes + machining riêng cho từng tấm. Dùng cho xuất DXF (cần toạ độ lỗ
  // theo từng instance) và nesting (cần kích thước thực mỗi tấm). UI cutlist
  // text vẫn đọc `panels` (đã gộp) — không thay đổi hành vi cũ.
  // ⚠️ Edge-banding upgrade: parts[].length_mm / .width_mm đã được TRỪ 2×ebMm
  // cho material có dán cạnh (kích thước CẮT thực tế cho CNC).
  parts?: Part[];
  // Tổng mét dán cạnh cho toàn cấu hình (chỉ Part có dán cạnh; design perimeter).
  // pricing.ts đọc field này để cộng giá dán cạnh thành 1 dòng riêng.
  totalEdgeBandingM?: number;
}

/**
 * Độ dày dán cạnh (mm) áp cho 1 Part — quyết định lượng TRỪ kích thước cắt.
 * P49: dán cạnh là option độc lập → đọc theo Part:
 *   - Part lộ cạnh (build() set edgeBanding all-false, vd plywood) → 0.
 *   - Part dán cạnh → thicknessMm của loại cạnh đã chọn (config.edgeBands[edgeColor]).
 *   - Fallback config CŨ (KV chưa migrate edgeBands) → edgeBandingMmByBoardType theo catalog.
 */
function edgeBandingMmFor(part: Part, config?: PriceConfig): number {
  const eb = part.edgeBanding;
  const banded = !!eb && (eb.front || eb.back || eb.left || eb.right);
  if (!banded) return 0;
  const type = part.edgeColor ?? 'same';
  const fromBands = config?.edgeBands?.[type]?.thicknessMm;
  if (fromBands && fromBands > 0) return fromBands;
  const catalog = part.material.split('/')[0];
  return config?.edgeBandingMmByBoardType?.[catalog] ?? 0;
}

/** Khoá gộp: 2 tấm gộp được khi mọi thông tin cắt trùng nhau. */
function mergeKey(p: Part): string {
  return [p.label, p.length_mm, p.width_mm, p.thickness_mm, p.material, p.grain, partFullNotes(p) ?? '']
    .join('|');
}

/**
 * Sinh bảng cắt từ kết quả build().
 * `config` (tùy chọn, S9): nếu có materialDensities/hardwareWeights thì cân nặng
 * tính theo catalog đó; vắng mặt → dùng mật độ/cân mặc định trong pricing.ts.
 *
 * Edge-banding upgrade: nếu config.edgeBandingMmByBoardType có khai báo cho
 * material của Part (và material không noEdgeBanding) → Part.perimeter set theo
 * chu vi BẢN VẼ, kích thước cắt (length_mm/width_mm trong panels & parts) TRỪ
 * 2×ebMm để xưởng dán xong = bản vẽ.
 */
export function buildCutlist(build: BuildResult, config?: PriceConfig): Cutlist {
  // Bước 1: tính kích thước CẮT + perimeter cho mỗi Part theo dán cạnh.
  // Trả về bản sao Part đã adjust (KHÔNG mutate build.parts gốc — render 3D đọc bản gốc).
  let totalEdgeBandingMm = 0;
  const adjustedParts: Part[] = build.parts.map((part) => {
    const ebMm = edgeBandingMmFor(part, config);
    if (ebMm <= 0) {
      // Lộ cạnh hoặc chưa cấu hình → giữ nguyên (không set perimeter).
      return part;
    }
    // perimeter dựa trên kích thước BẢN VẼ (trước khi trừ) — đây là phần dán
    // cạnh thực tế quấn quanh tấm (~ chu vi bản vẽ).
    const perimeter = 2 * (part.length_mm + part.width_mm);
    totalEdgeBandingMm += perimeter * part.qty;
    return {
      ...part,
      length_mm: part.length_mm - 2 * ebMm,
      width_mm: part.width_mm - 2 * ebMm,
      perimeter,
    };
  });

  // Bước 2: gộp panels (theo kích thước CẮT đã adjust).
  const panelMap = new Map<string, CutlistRow>();
  for (const part of adjustedParts) {
    const key = mergeKey(part);
    const volumeM3 =
      (part.length_mm * part.width_mm * part.thickness_mm) / 1_000_000_000;
    const catalog = part.material.split('/')[0];
    const density =
      config?.materialDensities?.[catalog] ?? materialDensityKgPerM3(part.material);
    const partWeight = volumeM3 * density * part.qty;
    const existing = panelMap.get(key);
    if (existing) {
      existing.qty += part.qty;
      existing.weight_kg += partWeight;
    } else {
      panelMap.set(key, {
        label: part.label,
        qty: part.qty,
        length_mm: part.length_mm,
        width_mm: part.width_mm,
        thickness_mm: part.thickness_mm,
        weight_kg: partWeight,
        material: part.material,
        grain: part.grain,
        notes: partFullNotes(part),
      });
    }
  }
  const panels = [...panelMap.values()];

  const hardwareMap = new Map<string, HardwareRow>();
  for (const hw of build.hardware) {
    const hwWeight =
      (config?.hardwareWeights?.[hw.id] ?? hardwareWeightKg(hw.id)) * hw.qty;
    const existing = hardwareMap.get(hw.id);
    if (existing) {
      existing.qty += hw.qty;
      existing.weight_kg += hwWeight;
    } else {
      hardwareMap.set(hw.id, {
        label: hw.label,
        qty: hw.qty,
        weight_kg: hwWeight,
        notes: hw.notes,
      });
    }
  }
  const hardware = [...hardwareMap.values()];

  const totalPanels = panels.reduce((sum, row) => sum + row.qty, 0);
  const totalAreaM2 = panels.reduce(
    (sum, row) => sum + ((row.length_mm * row.width_mm) / 1_000_000) * row.qty,
    0,
  );
  const totalWeightKg =
    panels.reduce((s, r) => s + r.weight_kg, 0) +
    hardware.reduce((s, r) => s + r.weight_kg, 0);

  return {
    panels,
    hardware,
    totalPanels,
    totalAreaM2,
    totalWeightKg,
    parts: adjustedParts, // S10: raw Part[] với kích thước CẮT (đã trừ dán cạnh)
    totalEdgeBandingM: totalEdgeBandingMm / 1000,
  };
}
