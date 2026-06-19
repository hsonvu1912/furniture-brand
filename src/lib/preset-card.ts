// =============================================================================
// preset-card (P88) — DÙNG CHUNG: Preset (KV) → PresetCardData (giá · thông số ·
// ảnh) cho TRANG CHỦ + /collection. Build theo ĐÚNG loại tủ qua getDNA(productSlug)
// → tủ x (tu-ke) và tủ y (tu-y) đều ra giá + thông số ĐÚNG (KHÔNG hardcode tu-ke).
// 1 NGUỒN để 2 trang không bao giờ lệch (trước trang chủ copy cũ → sai giá tủ y).
// =============================================================================
import type { Preset } from "../../products/tu-ke/presets";
import { getDNA } from "../../products/registry";
import { computePrice, formatPrice } from "@/configurator/pricing";
import { buildCutlist } from "@/configurator/cutlist";
import type { PriceConfig } from "@/configurator/types";
import type { PresetCardData } from "@/components/PresetCard";

/** Preset[] → PresetCardData[] — build engine theo loại tủ; thông số tủ y lấy từ build.size. */
export function buildPresetCardData(
  presets: Preset[],
  priceConfig: PriceConfig,
): PresetCardData[] {
  return presets.map((preset) => {
    const dna = getDNA(preset.productSlug);
    const normalized = dna.normalizeValues ? dna.normalizeValues(preset.values) : preset.values;
    const result = dna.build(normalized);
    const price = computePrice(result, priceConfig);
    const cutlist = buildCutlist(result, priceConfig);
    return {
      slug: preset.slug,
      name: preset.name,
      usecase: preset.usecase,
      category: preset.category,
      accent: preset.accent,
      productSlug: preset.productSlug ?? "tu-ke",
      priceFormatted: formatPrice(price.total),
      totalPanels: cutlist.totalPanels,
      // tu-ke có columns×rows; tu-y không → 0 (PresetCard ẩn meta lưới cho y).
      columns: Number(preset.values.columns) || 0,
      rows: Number(preset.values.rows) || 0,
      // Kích thước phủ bì: ưu tiên values (tu-ke) → build.size (tu-y).
      width: Number(preset.values.width) || result.size?.w || 0,
      height: Number(preset.values.height) || result.size?.h || 0,
      thumbnail: preset.thumbnail,
      thumbnails: preset.thumbnails, // P34: đa góc → hover-swap + random
    };
  });
}
