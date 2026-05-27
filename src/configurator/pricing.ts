// =============================================================
// PRICING — BuildResult → giá VND. Thư viện chung, mọi sản phẩm dùng.
// Đơn giá vật liệu/phụ kiện MẶC ĐỊNH là hằng số trong file này. Từ S9, nếu
// PriceConfig có materialRates/hardwarePrices (bơm từ catalog admin qua KV) thì
// computePrice ưu tiên dùng các giá trị đó; hằng số dưới là lớp fallback.
//
// Edge-banding upgrade (additive): nếu config có edgeBandingPricePerM +
// edgeBandingMmByBoardType cho boardType của Part (VÀ material không có
// noEdgeBanding=true) → cộng 1 dòng "Dán cạnh đồng màu" = chu vi tổng × giá/m.
// Vắng config → KHÔNG cộng (tương thích ngược với S9).
// =============================================================
import { resolveMaterial } from './materials';
import type { BuildResult, PriceConfig } from './types';
import {
  computeNestingCost,
  DEFAULT_LABOR_PER_SHEET,
  type NestingCost,
} from '@/lib/nesting/cost';

/**
 * Default margin anchors IKEA-style — ít panel margin thấp, nhiều panel margin cao.
 * Anchor = "tại panel count = X, margin = Y". Engine linear interpolate giữa các anchor liền kề.
 * Tier cuối có maxPanels (vd 150) → beyond = plateau (margin giữ ở giá trị cuối).
 */
export const DEFAULT_MARGIN_TIERS: { maxPanels: number | null; margin: number }[] = [
  { maxPanels: 20, margin: 1.3 },
  { maxPanels: 40, margin: 1.5 },
  { maxPanels: 80, margin: 1.7 },
  { maxPanels: 150, margin: 2.0 }, // plateau beyond 150
];

/**
 * IKEA-style margin scaling theo panel count (proxy cho complexity).
 * Linear interpolate giữa các anchor liền kề để smooth, tránh price jump khi cross threshold.
 *
 * Quy ước:
 *  - panelCount ≤ first anchor → flat first margin (entry-level plateau)
 *  - panelCount ≥ last anchor → flat last margin (premium plateau)
 *  - Giữa 2 anchor liền kề → linear interpolation
 *
 * Backward compat:
 *  - Vắng marginTiers → fallback flat config.margin (legacy)
 *  - Last tier maxPanels=null → treated as "extend last numeric tier" (legacy KV)
 */
export function computeMargin(panelCount: number, config: PriceConfig): number {
  const tiers = config.marginTiers;
  if (!tiers || tiers.length === 0) return config.margin;

  // Normalize: if last tier has null maxPanels (legacy catch-all), treat as 2× previous tier max.
  const normalized = tiers.map((t, i) => {
    if (t.maxPanels !== null) return t;
    const prevMax = i > 0 ? tiers[i - 1].maxPanels ?? 100 : 100;
    return { maxPanels: prevMax * 2, margin: t.margin };
  });

  const sorted = [...normalized].sort((a, b) => (a.maxPanels ?? 0) - (b.maxPanels ?? 0));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (panelCount <= (first.maxPanels ?? 0)) return first.margin;
  if (panelCount >= (last.maxPanels ?? 0)) return last.margin;

  for (let i = 0; i < sorted.length - 1; i++) {
    const lower = sorted[i];
    const upper = sorted[i + 1];
    const lowerMax = lower.maxPanels!;
    const upperMax = upper.maxPanels!;
    if (panelCount <= upperMax) {
      const ratio = (panelCount - lowerMax) / (upperMax - lowerMax);
      return lower.margin + ratio * (upper.margin - lower.margin);
    }
  }
  return last.margin;
}

// Đơn giá ván — VND mỗi m² mặt, theo catalog vật liệu VÀ độ dày (mm).
// Ván dày hơn = đắt hơn → giá phụ thuộc cả hai.
const MATERIAL_RATE_PER_M2: Record<string, Record<number, number>> = {
  mdf_son: { 18: 700_000, 9: 350_000 },
  plywood_veneer: { 18: 560_000, 9: 280_000 }, // tạm rẻ hơn MDF ~20% — founder chỉnh sau
  plywood_melamine: { 18: 496_527, 9: 373_263 }, // founder báo 2026-05-21
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

// --- Cân nặng: mật độ ván + cân phụ kiện (tạm — founder chỉnh sau khi có số chính xác) ---

// Mật độ vật liệu (kg / m³) — cân nặng tấm = thể tích × mật độ. Theo catalog.
const MATERIAL_DENSITY_KG_PER_M3: Record<string, number> = {
  mdf_son: 720, // MDF sơn màu — thường 700-800
  plywood_veneer: 600, // plywood phủ veneer — thường 550-650
  plywood_melamine: 600, // plywood phủ melamine 2 mặt — cùng base plywood
};
const DEFAULT_MATERIAL_DENSITY = 700;

// Cân nặng phụ kiện (kg / cái — drawer-slide là bộ đôi).
const HARDWARE_WEIGHT_KG: Record<string, number> = {
  hinge: 0.06, // bản lề giảm chấn ~60g
  'drawer-slide': 0.55, // ray ngăn kéo (bộ)
  foot: 0.005, // chân tủ nút mỏng ~5g
  handle: 0.04, // tay nắm (phòng hờ — chưa dùng)
};
const DEFAULT_HARDWARE_WEIGHT = 0.05;

/** Mật độ (kg/m³) của vật liệu — tra theo catalog (vd "mdf_son/nau" → "mdf_son"). */
export function materialDensityKgPerM3(material: string): number {
  const catalog = material.split('/')[0];
  return MATERIAL_DENSITY_KG_PER_M3[catalog] ?? DEFAULT_MATERIAL_DENSITY;
}

/** Cân nặng (kg) 1 cái / bộ phụ kiện theo `Hardware.id`. */
export function hardwareWeightKg(id: string): number {
  return HARDWARE_WEIGHT_KG[id] ?? DEFAULT_HARDWARE_WEIGHT;
}

// Tên tiếng Việt cho catalog vật liệu (chỉ để hiển thị dòng giá).
const CATALOG_LABEL: Record<string, string> = {
  mdf_son: 'Ván MDF sơn màu',
  plywood_veneer: 'Ván plywood veneer',
  plywood_melamine: 'Plywood phủ melamine 2 mặt (lộ cạnh)',
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
  materialCost: number; // đã NHÂN wasteMultiplier nếu có nesting
  hardwareCost: number;
  margin: number;
  laborPerOrder: number; // labor cũ — chỉ > 0 khi KHÔNG có nesting (fallback)
  laborCost?: number; // labor mới — numSheets × laborPerSheet (khi có nesting)
  nestingCost?: NestingCost; // chi tiết hao hụt + số ván cốt (khi có nesting)
  total: number;
  lines: PriceLine[];
}

/**
 * Tính giá 1 cấu hình.
 *
 * 2 chế độ tuỳ `config.boards`:
 *   - VẮNG boards (legacy): total = (vật liệu + phụ kiện) × margin + laborPerOrder.
 *     Công cộng SAU margin (phí cố định, không nhân lãi).
 *   - CÓ boards (nesting-based): chạy nesting → wasteMultiplier = max(1.4, 1/util)
 *     → materialCost × wasteMultiplier; laborCost = numSheets × laborPerSheet (100k).
 *     total = (vật liệu_hao_hụt + phụ kiện + nhân_công_cắt) × margin.
 *     Bỏ laborPerOrder; margin (lợi nhuận) áp lên TOÀN BỘ chi phí.
 */
export function computePrice(build: BuildResult, config: PriceConfig): PriceBreakdown {
  const lines: PriceLine[] = [];

  // --- Vật liệu tấm: gộp diện tích theo (mã màu đầy đủ, độ dày) — giá theo TỪNG MÀU ---
  const areaByMaterial = new Map<
    string,
    { material: string; catalog: string; thickness: number; area: number }
  >();
  for (const part of build.parts) {
    const catalog = part.material.split('/')[0];
    const thickness = part.thickness_mm;
    const area = ((part.length_mm * part.width_mm) / 1_000_000) * part.qty;
    const key = `${part.material}|${thickness}`;
    const entry = areaByMaterial.get(key);
    if (entry) entry.area += area;
    else areaByMaterial.set(key, { material: part.material, catalog, thickness, area });
  }

  let materialCost = 0;
  for (const { material, catalog, thickness, area } of areaByMaterial.values()) {
    // Thang fallback: đơn giá theo MÃ MÀU → theo loại ván → hằng số mặc định.
    const rate =
      config.materialRates?.[material]?.[thickness] ??
      config.materialRates?.[catalog]?.[thickness] ??
      MATERIAL_RATE_PER_M2[catalog]?.[thickness] ??
      DEFAULT_MATERIAL_RATE;
    const amount = area * rate;
    materialCost += amount;
    lines.push({
      label: `${config.materialLabels?.[material] ?? CATALOG_LABEL[catalog] ?? catalog} ${thickness}mm`,
      detail: `${area.toFixed(2)} m² × ${formatPrice(rate)}`,
      amount: Math.round(amount),
    });
  }

  // --- Dán cạnh đồng màu (additive): chỉ cộng khi config có cấu hình ---
  // Tính chu vi BẢN VẼ (trước khi trừ độ dày dán cạnh trong cutlist) cho mọi
  // Part có dán cạnh. Tổng mét × giá/m → 1 dòng cộng vào materialCost (chịu margin).
  const ebPricePerM = config.edgeBandingPricePerM ?? 0;
  if (ebPricePerM > 0 && config.edgeBandingMmByBoardType) {
    let totalEbM = 0;
    for (const part of build.parts) {
      const m = resolveMaterial(part.material);
      if (m.noEdgeBanding) continue; // lộ cạnh → không tính
      const catalog = part.material.split('/')[0];
      const ebMm = config.edgeBandingMmByBoardType[catalog];
      if (!ebMm || ebMm <= 0) continue; // boardType chưa cấu hình dán cạnh
      totalEbM += ((2 * (part.length_mm + part.width_mm)) / 1000) * part.qty;
    }
    if (totalEbM > 0) {
      const ebAmount = totalEbM * ebPricePerM;
      materialCost += ebAmount;
      lines.push({
        label: 'Dán cạnh đồng màu',
        detail: `${totalEbM.toFixed(2)} m × ${formatPrice(ebPricePerM)}`,
        amount: Math.round(ebAmount),
      });
    }
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
    const unit =
      config.hardwarePrices?.[id] ?? HARDWARE_UNIT_PRICE[id] ?? DEFAULT_HARDWARE_PRICE;
    const amount = unit * qty;
    hardwareCost += amount;
    lines.push({ label, detail: `${qty} × ${formatPrice(unit)}`, amount });
  }

  // --- Nesting-based pricing (additive, kích hoạt khi config.boards có data) ---
  // Logic 40% hao hụt + 100k/ván cốt nằm 1 chỗ duy nhất: src/lib/nesting/cost.ts.
  // Lưu ý dùng build.parts RAW (kích thước thiết kế) thay vì cutlist.parts (đã trừ
  // dán cạnh) — tránh circular import pricing↔cutlist; diff dán cạnh 0.4mm/cạnh
  // ~0.5% nesting sai số, không vượt sàn 40% nên không ảnh hưởng giá.
  let nestingCost: NestingCost | undefined;
  let laborCost = 0;
  if (config.boards && config.boards.length > 0) {
    nestingCost = computeNestingCost(build.parts, config.boards, {
      kerfMm: config.kerfMm,
      minWasteMultiplier: config.wasteMultiplierMin,
    });
    const wasteAmount = materialCost * (nestingCost.wasteMultiplier - 1);
    materialCost *= nestingCost.wasteMultiplier;
    const wasteDetail =
      nestingCost.avgUtilization > 0
        ? `Nesting util ${(nestingCost.avgUtilization * 100).toFixed(0)}% → ×${nestingCost.wasteMultiplier.toFixed(2)}`
        : `Sàn ×${nestingCost.wasteMultiplier.toFixed(2)} (chưa chạy nesting)`;
    lines.push({
      label: 'Hao hụt cắt ván',
      detail: wasteDetail,
      amount: Math.round(wasteAmount),
    });
    const laborPerSheet = config.laborPerSheet ?? DEFAULT_LABOR_PER_SHEET;
    laborCost = nestingCost.numSheets * laborPerSheet;
    if (nestingCost.numSheets > 0) {
      lines.push({
        label: `Nhân công cắt ván (${nestingCost.numSheets} tấm)`,
        detail: `${nestingCost.numSheets} × ${formatPrice(laborPerSheet)}`,
        amount: laborCost,
      });
    }
  }

  // Margin scale theo panel count (IKEA-style) — vắng marginTiers → flat config.margin.
  const margin = computeMargin(build.parts.length, config);
  // laborPerOrder cũ CHỈ áp dụng khi không có nesting (fallback backward compat).
  // Khi có nesting: laborCost (per sheet) đã thay thế, vào CHUNG với margin.
  const laborPerOrder = nestingCost ? 0 : (config.laborPerOrder ?? 0);
  const total = Math.round(
    (materialCost + hardwareCost + laborCost) * margin + laborPerOrder,
  );

  return {
    currency: 'VND',
    materialCost: Math.round(materialCost),
    hardwareCost,
    margin,
    laborPerOrder,
    laborCost: nestingCost ? laborCost : undefined,
    nestingCost,
    total,
    lines,
  };
}

/** Định dạng tiền VND, vd 1234567 → "1.234.567₫". */
export function formatPrice(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')}₫`;
}
