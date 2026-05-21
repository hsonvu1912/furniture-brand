// =============================================================================
// HomeFeatured — section "Bộ sưu tập" trên landing (port pattern maume
// HomeFeatured "Available" section). Heading bold + caption + "Xem tất cả"
// link · grid 4 col desktop / 3 col tablet / 2 col mobile preset cards.
//
// Khác Hero: Hero là image gallery THUẦN (no info overlay), HomeFeatured là
// preset card FULL info (tên + usecase + giá + meta) để khách quyết định.
// =============================================================================
import Link from "next/link";
import { PRESETS } from "../../products/tu-ke/presets";
import tuKe from "../../products/tu-ke/dna";
import { computePrice, formatPrice } from "@/configurator/pricing";
import { buildCutlist } from "@/configurator/cutlist";
import PresetCard, { type PresetCardData } from "./PresetCard";

function buildCardData(): PresetCardData[] {
  return PRESETS.map((preset) => {
    const normalized = tuKe.normalizeValues
      ? tuKe.normalizeValues(preset.values)
      : preset.values;
    const result = tuKe.build(normalized);
    const price = computePrice(result, tuKe.priceConfig);
    const cutlist = buildCutlist(result);
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

export default function HomeFeatured() {
  const presets = buildCardData();

  return (
    <section className="max-w-[1400px] mx-auto px-6 py-20">
      <div className="flex items-baseline justify-between mb-10">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Bộ sưu tập</h2>
          <p className="text-sm text-neutral-400 mt-1 font-viet">
            {presets.length} mẫu thiết kế sẵn
          </p>
        </div>
        <Link
          href="/collection"
          className="text-sm font-medium text-neutral-500 hover:text-black transition-colors underline underline-offset-4"
        >
          Xem tất cả
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
        {presets.map((preset) => (
          <PresetCard key={preset.slug} preset={preset} />
        ))}
      </div>
    </section>
  );
}
