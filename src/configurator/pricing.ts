// =============================================================
// PRICING — BuildResult → giá VND. Thư viện chung, mọi sản phẩm dùng.
// PriceConfig (types.ts) chỉ giữ margin + laborPerOrder (chính sách giá
// của từng sản phẩm). Đơn giá vật liệu/phụ kiện là dữ liệu CHUNG → để ở đây.
// =============================================================
import type { BuildResult, PriceConfig } from './types';

// Đơn giá ván — VND mỗi m² mặt, theo catalog vật liệu VÀ độ dày (mm).
// Ván dày hơn = đắt hơn → giá phụ thuộc cả hai.
const MATERIAL_RATE_PER_M2: Record<string, Record<number, number>> = {
  mdf_son: { 18: 700_000, 9: 350_000 },
  plywood_veneer: { 18: 560_000, 9: 280_000 }, // tạm rẻ hơn MDF ~20% — founder chỉnh sau
};
const DEFAULT_MATERIAL_RATE = 700_000; // khi không tra được catalog/độ dày

// Đơn giá phụ kiện — VND mỗi cái, theo Hardware.id.
const HARDWARE_UNIT_PRICE: Record<string, number> = {
  hinge: 18_000,
  handle: 30_000,
  'drawer-slide': 90_000,
  foot: 5_000, // chân tủ nút mỏng — tạm, founder chỉnh sau
};
const DEFAULT_HARDWARE_PRICE = 20_000;

// Tên tiếng Việt cho catalog vật liệu (chỉ để hiển thị dòng giá).
const CATALOG_LABEL: Record<string, string> = {
  mdf_son: 'Ván MDF sơn màu',
  plywood_veneer: 'Ván plywood veneer',
};

/** Một dòng trong bảng phân tích giá. */
export interface PriceLine {
  label: string;
  detail: string; // vd "2.34 m² × 700.000₫"
  amount: number; // VND
}

/** Kết quả tính giá — total + chi tiết để hiện bảng. */
export interface PriceBreakdown {
  currency: 'VND';
  materialCost: number;
  hardwareCost: number;
  margin: number;
  laborPerOrder: number;
  total: number;
  lines: PriceLine[];
}

/**
 * Tính giá 1 cấu hình.
 * total = (vật liệu + phụ kiện) × margin + laborPerOrder.
 * Tiền công cộng SAU margin — công là phí cố định, không nhân lãi.
 */
export function computePrice(build: BuildResult, config: PriceConfig): PriceBreakdown {
  const lines: PriceLine[] = [];

  // --- Vật liệu tấm: gộp diện tích theo (catalog, độ dày) — vì giá phụ thuộc cả hai ---
  const areaByMaterial = new Map<
    string,
    { catalog: string; thickness: number; area: number }
  >();
  for (const part of build.parts) {
    const catalog = part.material.split('/')[0];
    const thickness = part.thickness_mm;
    const area = ((part.length_mm * part.width_mm) / 1_000_000) * part.qty;
    const key = `${catalog}|${thickness}`;
    const entry = areaByMaterial.get(key);
    if (entry) entry.area += area;
    else areaByMaterial.set(key, { catalog, thickness, area });
  }

  let materialCost = 0;
  for (const { catalog, thickness, area } of areaByMaterial.values()) {
    const rate = MATERIAL_RATE_PER_M2[catalog]?.[thickness] ?? DEFAULT_MATERIAL_RATE;
    const amount = area * rate;
    materialCost += amount;
    lines.push({
      label: `${CATALOG_LABEL[catalog] ?? catalog} ${thickness}mm`,
      detail: `${area.toFixed(2)} m² × ${formatPrice(rate)}`,
      amount: Math.round(amount),
    });
  }

  // --- Phụ kiện: gộp số lượng theo id ---
  const hardwareById = new Map<string, { label: string; qty: number }>();
  for (const hw of build.hardware) {
    const cur = hardwareById.get(hw.id) ?? { label: hw.label, qty: 0 };
    cur.qty += hw.qty;
    hardwareById.set(hw.id, cur);
  }

  let hardwareCost = 0;
  for (const [id, { label, qty }] of hardwareById) {
    const unit = HARDWARE_UNIT_PRICE[id] ?? DEFAULT_HARDWARE_PRICE;
    const amount = unit * qty;
    hardwareCost += amount;
    lines.push({ label, detail: `${qty} × ${formatPrice(unit)}`, amount });
  }

  const margin = config.margin;
  const laborPerOrder = config.laborPerOrder ?? 0;
  const total = Math.round((materialCost + hardwareCost) * margin + laborPerOrder);

  return {
    currency: 'VND',
    materialCost: Math.round(materialCost),
    hardwareCost,
    margin,
    laborPerOrder,
    total,
    lines,
  };
}

/** Định dạng tiền VND, vd 1234567 → "1.234.567₫". */
export function formatPrice(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')}₫`;
}
