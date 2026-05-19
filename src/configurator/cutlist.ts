// =============================================================
// CUTLIST — BuildResult → bảng cắt cho xưởng. Thư viện chung.
// build() sinh mỗi tấm là 1 Part riêng (vì mỗi Part = 1 hộp 3D ở 1 vị trí);
// cutlist GỘP các tấm giống hệt nhau lại thành 1 dòng có số lượng.
// KHÔNG có cột dán cạnh — sản phẩm tủ kệ để lộ cạnh plywood.
// =============================================================
import type { BuildResult, Part } from './types';

/** Một dòng bảng cắt — nhóm các tấm trùng kích thước/vật liệu/vân. */
export interface CutlistRow {
  label: string;
  qty: number;
  length_mm: number;
  width_mm: number;
  thickness_mm: number;
  material: string;
  grain: Part['grain'];
  notes?: string;
}

/** Một dòng phụ kiện. */
export interface HardwareRow {
  label: string;
  qty: number;
  notes?: string; // ghi chú vị trí / cách lắp (vd chân tủ bắt ở đâu)
}

/** Bảng cắt hoàn chỉnh. */
export interface Cutlist {
  panels: CutlistRow[];
  hardware: HardwareRow[];
  totalPanels: number; // tổng số tấm phải cắt
  totalAreaM2: number; // tổng diện tích ván
}

/** Khoá gộp: 2 tấm gộp được khi mọi thông tin cắt trùng nhau. */
function mergeKey(p: Part): string {
  return [p.label, p.length_mm, p.width_mm, p.thickness_mm, p.material, p.grain, p.notes ?? '']
    .join('|');
}

/** Sinh bảng cắt từ kết quả build(). */
export function buildCutlist(build: BuildResult): Cutlist {
  const panelMap = new Map<string, CutlistRow>();
  for (const part of build.parts) {
    const key = mergeKey(part);
    const existing = panelMap.get(key);
    if (existing) {
      existing.qty += part.qty;
    } else {
      panelMap.set(key, {
        label: part.label,
        qty: part.qty,
        length_mm: part.length_mm,
        width_mm: part.width_mm,
        thickness_mm: part.thickness_mm,
        material: part.material,
        grain: part.grain,
        notes: part.notes,
      });
    }
  }
  const panels = [...panelMap.values()];

  const hardwareMap = new Map<string, HardwareRow>();
  for (const hw of build.hardware) {
    const existing = hardwareMap.get(hw.id);
    if (existing) existing.qty += hw.qty;
    else hardwareMap.set(hw.id, { label: hw.label, qty: hw.qty, notes: hw.notes });
  }

  const totalPanels = panels.reduce((sum, row) => sum + row.qty, 0);
  const totalAreaM2 = panels.reduce(
    (sum, row) => sum + ((row.length_mm * row.width_mm) / 1_000_000) * row.qty,
    0,
  );

  return { panels, hardware: [...hardwareMap.values()], totalPanels, totalAreaM2 };
}
