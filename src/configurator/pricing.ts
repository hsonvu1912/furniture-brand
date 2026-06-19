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
import type { BuildResult, EdgeBandingType, PriceConfig } from './types';

import {
  computeNestingCost,
  DEFAULT_LABOR_PER_SHEET,
  type NestingCost,
} from '@/lib/nesting/cost';

/**
 * P60 — Default margin anchors theo THỂ TÍCH tủ (m³): tủ nhỏ margin thấp (phễu),
 * tủ to margin cao (lợi nhuận). Anchor = "tại thể tích = X m³, margin = Y". Engine nội
 * suy tuyến tính giữa anchor liền kề; ngoài anchor đầu/cuối = plateau.
 */
export const DEFAULT_MARGIN_TIERS: { vol: number; margin: number }[] = [
  { vol: 0.15, margin: 1.25 },
  { vol: 0.40, margin: 1.40 },
  { vol: 0.80, margin: 1.60 },
  { vol: 1.50, margin: 1.85 },
  { vol: 2.50, margin: 2.10 }, // plateau beyond 2.5 m³
];

/**
 * P60 — Margin theo THỂ TÍCH tủ (m³): nội suy tuyến tính giữa các anchor `vol`;
 * ngoài anchor đầu/cuối = plateau. Vắng marginTiers → fallback flat config.margin.
 * P72 — BỎ phụ trội phức tạp theo số ngăn/cánh (founder: ngăn kéo không đẩy margin
 * nữa — chi phí ngăn kéo đã nằm đủ ở vật liệu + ray ×hardwareMargin). Margin giờ
 * CHỈ phụ thuộc thể tích.
 */
export function computeMargin(volumeM3: number, config: PriceConfig): number {
  const tiers = config.marginTiers;
  if (!tiers || tiers.length === 0) return config.margin;

  const sorted = [...tiers].sort((a, b) => a.vol - b.vol);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  let base = last.margin;
  if (volumeM3 <= first.vol) base = first.margin;
  else if (volumeM3 < last.vol) {
    for (let i = 0; i < sorted.length - 1; i++) {
      const lo = sorted[i];
      const hi = sorted[i + 1];
      if (volumeM3 <= hi.vol) {
        const ratio = (volumeM3 - lo.vol) / (hi.vol - lo.vol);
        base = lo.margin + ratio * (hi.margin - lo.margin);
        break;
      }
    }
  }
  return base;
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
  handle_strip_black: 70_000, // P77 — tay nắm strip đen (fallback; thiếu trước đây → rơi về 20k)
  handle_bar: 50_000, // P45 — tay nắm bar (fallback; giá thật ở catalog admin)
  // P76 — ray âm Hafele EPC Plus theo cỡ (fallback; giá thật ở catalog admin)
  'drawer-slide-270': 243_000,
  'drawer-slide-300': 195_000,
  'drawer-slide-350': 226_000,
  'drawer-slide-400': 277_000,
  foot: 5_000, // chân tủ nút mỏng — tạm, founder chỉnh sau
  connector_2in1: 3_000, // P74 — bộ chốt Ø8×30 + PAT (fallback; giá thật ở catalog admin)
  back_clip: 1_000, // P74 — chốt lò xo tấm hậu Ø5×25
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

// Cân nặng phụ kiện (kg / cái — ray là bộ đôi 2 thanh).
const HARDWARE_WEIGHT_KG: Record<string, number> = {
  hinge: 0.06, // bản lề giảm chấn ~60g
  'drawer-slide-270': 0.8, // P76 — ray âm EPC Plus (bộ)
  'drawer-slide-300': 0.85,
  'drawer-slide-350': 0.9,
  'drawer-slide-400': 0.95,
  foot: 0.005, // chân tủ nút mỏng ~5g
  handle: 0.04, // tay nắm tròn (P45: round nay đã vào BOM)
  handle_strip_black: 0.05, // P77 — tay nắm strip đen
  handle_bar: 0.08, // P45 — tay nắm bar ~80g
  connector_2in1: 0.015, // P74 — bộ chốt + PAT ~15g
  back_clip: 0.005, // P74 — chốt lò xo ~5g
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
  amount: number; // VND — giá VỐN của dòng (trước khi nhân hệ số lãi)
  /** P67/P69 — Hệ số lãi RIÊNG cho dòng (multiplier). Vắng = nhân margin KHUNG (theo m³).
   *  • =1  → giá vốn, KHÔNG lãi (hao hụt cắt ván — P67).
   *  • >1  → lãi riêng (phụ kiện ×1.2 — P69).
   *  Panel gom nhóm theo giá trị này. total = Σ(amount × (lineMargin ?? marginKhung)) + côngĐơn. */
  lineMargin?: number;
}

/** Kết quả tính giá — total + chi tiết để hiện bảng. */
export interface PriceBreakdown {
  currency: 'VND';
  materialCost: number; // đã NHÂN wasteMultiplier nếu có nesting
  hardwareCost: number;
  margin: number; // margin KHUNG (vật liệu+công) theo m³
  hardwareMargin?: number; // P69 — hệ số lãi phụ kiện (mặc định 1.2)
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

  // --- Dán cạnh (P49): GOM Part theo loại cạnh đã chọn → mỗi loại 1 dòng giá ---
  // Part dán cạnh = build() set edgeBanding ≥1 cạnh true (lộ cạnh plywood = all-false →
  // bỏ qua). Mét tính theo chu vi BẢN VẼ (trước khi trừ trong cutlist) × qty. Mỗi loại
  // nhân pricePerM riêng (config.edgeBands[type]). Cộng vào materialCost (chịu margin).
  if (config.edgeBands) {
    const meterByType: Partial<Record<EdgeBandingType, number>> = {};
    for (const part of build.parts) {
      const eb = part.edgeBanding;
      const banded = !!eb && (eb.front || eb.back || eb.left || eb.right);
      if (!banded) continue;
      const type = (part.edgeColor ?? 'same') as EdgeBandingType;
      const m = ((2 * (part.length_mm + part.width_mm)) / 1000) * part.qty;
      meterByType[type] = (meterByType[type] ?? 0) + m;
    }
    // P52: iterate mọi loại cạnh THỰC SỰ có part (không hardcode 3) → mỗi loại 1 dòng.
    for (const type of Object.keys(meterByType) as EdgeBandingType[]) {
      const meters = meterByType[type] ?? 0;
      const band = config.edgeBands[type];
      if (meters <= 0 || !band || band.pricePerM <= 0) continue;
      const ebAmount = meters * band.pricePerM;
      materialCost += ebAmount;
      lines.push({
        label: `Dán cạnh ${band.label ?? type}`,
        detail: `${meters.toFixed(2)} m × ${formatPrice(band.pricePerM)}`,
        amount: Math.round(ebAmount),
      });
    }
  } else {
    // Fallback config CŨ (KV chưa migrate edgeBands): 1 dòng theo boardType + giá đơn.
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
  }

  // --- Phụ kiện: gộp số lượng theo id ---
  const hardwareById = new Map<string, { label: string; qty: number }>();
  for (const hw of build.hardware) {
    const cur = hardwareById.get(hw.id) ?? { label: hw.label, qty: 0 };
    cur.qty += hw.qty;
    hardwareById.set(hw.id, cur);
  }

  // P69 — Hệ số lãi RIÊNG cho phụ kiện (mặc định 1.2). Phụ kiện = hàng mua sẵn → lãi mỏng,
  // KHÔNG nhân margin khung (theo m³). Mỗi dòng phụ kiện gắn lineMargin = hardwareMargin.
  const hardwareMargin = config.hardwareMargin ?? 1.2;
  let hardwareCost = 0;
  for (const [id, { label, qty }] of hardwareById) {
    const unit =
      config.hardwarePrices?.[id] ?? HARDWARE_UNIT_PRICE[id] ?? DEFAULT_HARDWARE_PRICE;
    const amount = unit * qty;
    hardwareCost += amount;
    lines.push({ label, detail: `${qty} × ${formatPrice(unit)}`, amount, lineMargin: hardwareMargin });
  }

  // --- Nesting-based pricing (additive, kích hoạt khi config.boards có data) ---
  // Logic 40% hao hụt + 100k/ván cốt nằm 1 chỗ duy nhất: src/lib/nesting/cost.ts.
  // Lưu ý dùng build.parts RAW (kích thước thiết kế) thay vì cutlist.parts (đã trừ
  // dán cạnh) — tránh circular import pricing↔cutlist; diff dán cạnh 0.4mm/cạnh
  // ~0.5% nesting sai số, không vượt sàn 40% nên không ảnh hưởng giá.
  let nestingCost: NestingCost | undefined;
  let laborCost = 0;
  // P67 — Hao hụt cắt ván tách riêng để cộng ở GIÁ VỐN (không nhân margin). Khai báo ngoài
  // if để công thức `total` dùng được; dòng hao hụt trong `lines` đánh dấu afterMargin=true.
  let wasteAmount = 0;
  if (build.moduleCounts) {
    // P84 TỦ Y — hao hụt ván CỐ ĐỊNH (admin %, mặc định 15%) + nhân công theo LOẠI Ô
    // (admin bảng config.tuYCellLabor). BỎ nesting (x dùng nesting). Hao hụt áp lên
    // materialCost (ván + dán cạnh, như x); marginBase trừ wasteAmount → hao hụt KHÔNG
    // ăn lãi; nhân công vào marginBase → CÓ ăn lãi (như công-cắt của x).
    const ratio = config.tuYWasteRatio ?? 0.15;
    wasteAmount = materialCost * ratio;
    materialCost *= 1 + ratio;
    lines.push({
      label: `Hao hụt ván (${Math.round(ratio * 100)}%)`,
      detail: `×${(1 + ratio).toFixed(2)}`,
      amount: Math.round(wasteAmount),
      lineMargin: 1, // giá vốn, không ăn lãi (ván vứt đi)
    });
    let cellsTotal = 0;
    for (const [k, n] of Object.entries(build.moduleCounts)) {
      laborCost += n * (config.tuYCellLabor?.[k] ?? 0);
      cellsTotal += n;
    }
    if (laborCost > 0) {
      lines.push({ label: 'Nhân công (theo loại ô)', detail: `${cellsTotal} ô`, amount: Math.round(laborCost) });
    } else {
      lines.push({ label: '⚠ Chưa điền công tủ y', detail: 'Vào Admin · Giá & lãi để điền', amount: 0 });
    }
  } else if (config.boards && config.boards.length > 0) {
    nestingCost = computeNestingCost(build.parts, config.boards, {
      kerfMm: config.kerfMm,
      minWasteMultiplier: config.wasteMultiplierMin,
    });
    wasteAmount = materialCost * (nestingCost.wasteMultiplier - 1);
    materialCost *= nestingCost.wasteMultiplier;
    const wasteDetail =
      nestingCost.avgUtilization > 0
        ? `Nesting util ${(nestingCost.avgUtilization * 100).toFixed(0)}% → ×${nestingCost.wasteMultiplier.toFixed(2)}`
        : `Sàn ×${nestingCost.wasteMultiplier.toFixed(2)} (chưa chạy nesting)`;
    lines.push({
      label: 'Hao hụt cắt ván',
      detail: wasteDetail,
      amount: Math.round(wasteAmount),
      lineMargin: 1, // P67 — giá vốn, KHÔNG nhân lãi (không ăn lãi trên ván vứt đi)
    });
    const laborPerSheet = config.laborPerSheet ?? DEFAULT_LABOR_PER_SHEET;
    // P64 — Tiền công theo PHẦN KHỔ: nguyên=1, nửa=0.5, phần tư=0.25 (founder: nửa=50k).
    laborCost = Math.round(nestingCost.laborSheets * laborPerSheet);
    if (nestingCost.numSheets > 0) {
      const bd = nestingCost.boardBreakdown;
      const seg: string[] = [];
      if (bd.full) seg.push(`${bd.full} nguyên`);
      if (bd.half) seg.push(`${bd.half} nửa`);
      if (bd.quarter) seg.push(`${bd.quarter} phần tư`);
      lines.push({
        label: `Nhân công cắt ván (${nestingCost.numSheets} tấm: ${seg.join(' · ')})`,
        detail: `${nestingCost.laborSheets.toFixed(2)} tấm quy đổi × ${formatPrice(laborPerSheet)}`,
        amount: laborCost,
      });
    }
  }

  // P60 — margin KHUNG theo THỂ TÍCH tủ (m³), vắng marginTiers → flat config.margin.
  // P72 — bỏ phụ trội theo số ngăn/cánh: margin chỉ còn phụ thuộc thể tích.
  // P84 — TỦ Y: margin PHẲNG (admin config.tuYMargin, mặc định 2.2) thay vì theo thể tích.
  const volM3 = build.size ? (build.size.w * build.size.h * build.size.d) / 1_000_000_000 : 0;
  const margin = build.moduleCounts ? (config.tuYMargin ?? 2.2) : computeMargin(volM3, config);
  // laborPerOrder cũ CHỈ áp dụng khi không có nesting (fallback backward compat).
  // Khi có nesting: laborCost (per sheet) đã thay thế, vào CHUNG với margin.
  const laborPerOrder = (nestingCost || build.moduleCounts) ? 0 : (config.laborPerOrder ?? 0);
  // P67 — Hao hụt cắt ván = ván mua rồi BỎ ĐI → cộng GIÁ VỐN sau margin (không ăn lãi phần phế).
  // P69 — Phụ kiện (mua sẵn, lãi mỏng) KHÔNG nhân margin khung mà nhân hardwareMargin (~1.2).
  // marginBase chỉ còn vật liệu NET (materialCost gồm hao hụt → trừ wasteAmount) + nhân công cắt.
  // Vắng nesting (wasteAmount=0) + hardwareMargin=margin → công thức Y HỆT cũ (tương thích ngược).
  const marginBase = materialCost - wasteAmount + laborCost;
  const total = Math.round(
    marginBase * margin + hardwareCost * hardwareMargin + wasteAmount + laborPerOrder,
  );

  return {
    currency: 'VND',
    materialCost: Math.round(materialCost),
    hardwareCost,
    margin,
    hardwareMargin,
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
