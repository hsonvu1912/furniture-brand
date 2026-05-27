// =============================================================================
// HomeFeatured — section "Bộ sưu tập" giant heading + grid 3 cols cards.
// =============================================================================
import Link from "next/link";
import { PRESETS } from "../../products/tu-ke/presets";
import tuKe from "../../products/tu-ke/dna";
import { catalogToPriceConfig, getProductionCatalog } from "@/lib/production-catalog";
import { computePrice, formatPrice } from "@/configurator/pricing";
import { buildCutlist } from "@/configurator/cutlist";
import type { PriceConfig } from "@/configurator/types";
import PresetCard, { type PresetCardData } from "./PresetCard";

function buildCardData(priceConfig: PriceConfig): PresetCardData[] {
  return PRESETS.map((preset) => {
    const normalized = tuKe.normalizeValues
      ? tuKe.normalizeValues(preset.values)
      : preset.values;
    const result = tuKe.build(normalized);
    const price = computePrice(result, priceConfig);
    const cutlist = buildCutlist(result, priceConfig);
    return {
      slug: preset.slug,
      name: preset.name,
      usecase: preset.usecase,
      category: preset.category,
      accent: preset.accent,
      priceFormatted: formatPrice(price.total),
      totalPanels: cutlist.totalPanels,
      columns: Number(preset.values.columns),
      rows: Number(preset.values.rows),
      width: Number(preset.values.width),
      height: Number(preset.values.height),
    };
  });
}

export default async function HomeFeatured() {
  const presets = buildCardData(catalogToPriceConfig(await getProductionCatalog()));

  return (
    <section className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-12 py-20 md:py-28 lg:py-32">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12 md:mb-16 lg:mb-20 gap-6">
        <h2 className="display-huge text-accent display-italic leading-[0.95]">
          Bộ sưu tập
        </h2>
        <Link
          href="/collection"
          className="pill-outline self-start md:self-end shrink-0"
        >
          Xem tất cả →
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-x-6 gap-y-12 md:gap-x-8 md:gap-y-16 lg:gap-x-10 lg:gap-y-20">
        {presets.map((preset) => (
          <PresetCard key={preset.slug} preset={preset} />
        ))}
      </div>
    </section>
  );
}
