// =============================================================================
// preset-pricing.ts (P81) — Tính KPI giá cho 1 preset NGOÀI Configurator (vd bảng
// danh sách admin). Chạy ĐÚNG pipeline editor để số khớp y hệt lúc mở preset:
//   merge defaults → normalizeValues → resolveControls(ctx) → reconcile ô → build →
//   computePrice. Khác đi sẽ lệch ở preset có chia/gộp ô (cellgrid).
//
// Hàm THUẦN, không React — dùng được cả ở list page (client) lẫn validator (node).
// KPI khớp PricePanel P80: giá bán = total; lãi gộp = total − Σ giá vốn; đơn giá/m²
// mặt đứng = total ÷ (rộng × cao build.size).
// =============================================================================
import { computePrice } from './pricing';
import { reconcileCellGrid, encodeCellGrid, isBlocksValue } from './cellgrid';
import type {
  EdgeBandingType,
  ParamValues,
  PriceConfig,
  ProductDNA,
  ResolveContext,
} from './types';

export interface PresetKpi {
  total: number; // giá bán tạm tính (VND)
  costTotal: number; // tổng giá vốn (VND)
  grossProfit: number; // lãi gộp = total − costTotal (chưa gồm vận chuyển)
  grossPct: number; // % lãi gộp trên giá bán
  w: number; // rộng phủ bì đã lắp ráp (mm) — build.size.w
  h: number; // cao phủ bì (mm)
  d: number; // sâu phủ bì (mm)
  frontAreaM2: number; // diện tích mặt đứng = w×h (m²)
  pricePerM2Front: number | null; // đơn giá/m² mặt đứng; null khi diện tích ≤ 0
}

/**
 * Tính KPI giá của 1 preset đúng như Configurator hiển thị.
 * @param dna         ProductDNA (vd tuKe)
 * @param values      preset.values (giá trị đã lưu)
 * @param priceConfig catalog→PriceConfig (giá live KV); vắng → dna.priceConfig
 */
export function computePresetKpi(
  dna: ProductDNA,
  values: ParamValues,
  priceConfig?: PriceConfig,
): PresetKpi {
  // 1) Seed defaults rồi đè values — KHỚP Configurator init (initialValues + override).
  const merged: ParamValues = {};
  for (const p of dna.parameters) merged[p.id] = p.default;
  Object.assign(merged, values);

  // 2) normalizeValues — KHỚP Configurator nạp preset (width→tổng cột, rows→cao tầng…).
  const v = dna.normalizeValues ? dna.normalizeValues(merged) : merged;

  // 3) resolveControls với ctx từ priceConfig — KHỚP Configurator (label vật liệu +
  //    loại dán cạnh đang bật). Không lọc enabledMaterials (chỉ ảnh hưởng option picker,
  //    không đổi build/giá ngoài fallback ô rỗng hiếm gặp).
  const ctx: ResolveContext | undefined = priceConfig
    ? {
        materialLabels: priceConfig.materialLabels,
        enabledEdgeBands: priceConfig.edgeBands
          ? (Object.keys(priceConfig.edgeBands) as EdgeBandingType[]).filter(
              (t) => priceConfig.edgeBands![t]?.enabled,
            )
          : undefined,
      }
    : undefined;
  const controls = dna.resolveControls?.(v, ctx) ?? dna.parameters;

  // 4) resolvedValues — reconcile cellgrid (áp disabled rules + cellFallbackMap),
  //    blocks pass-through — KHỚP Configurator.resolvedValues.
  const full: ParamValues = { ...v };
  for (const control of controls) {
    if (control.type === 'cellgrid') {
      const raw = String(v[control.id] ?? control.default);
      full[control.id] = isBlocksValue(raw)
        ? raw
        : encodeCellGrid(
            reconcileCellGrid(
              raw,
              control.gridRows ?? 0,
              control.gridCols ?? 0,
              control.options?.[0]?.value ?? '',
              control.disabledByRow,
              control.disabledByCol,
              control.cellFallbackMap,
            ),
          );
    } else {
      full[control.id] = v[control.id] ?? control.default;
    }
  }

  // 5) build + price — KHỚP Configurator (priceConfig ?? dna.priceConfig).
  const build = dna.build(full);
  const price = computePrice(build, priceConfig ?? dna.priceConfig);

  // 6) KPI — KHỚP PricePanel P80.
  const costTotal =
    price.lines.reduce((s, l) => s + l.amount, 0) + (price.laborPerOrder ?? 0);
  const grossProfit = price.total - costTotal;
  const grossPct = price.total > 0 ? (grossProfit / price.total) * 100 : 0;
  const w = build.size?.w ?? 0;
  const h = build.size?.h ?? 0;
  const d = build.size?.d ?? 0;
  const frontAreaM2 = (w * h) / 1_000_000;
  const pricePerM2Front = frontAreaM2 > 0 ? price.total / frontAreaM2 : null;

  return { total: price.total, costTotal, grossProfit, grossPct, w, h, d, frontAreaM2, pricePerM2Front };
}
