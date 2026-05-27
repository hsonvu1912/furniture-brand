// =============================================================================
// /collection — regrocery exact header pattern: "kê_ / Bộ sưu tập" GIANT inline.
// Sidebar trái: category list small accent text + counts.
// Right: grid 3 cols asymmetric cards.
// =============================================================================
import type { Metadata } from "next";
import { Suspense } from "react";
import type { Preset } from "../../../products/tu-ke/presets";
import tuKe from "../../../products/tu-ke/dna";
import { listPresets } from "@/lib/presets-store";
import { catalogToPriceConfig, getProductionCatalog } from "@/lib/production-catalog";
import { computePrice, formatPrice } from "@/configurator/pricing";
import { buildCutlist } from "@/configurator/cutlist";
import type { PriceConfig } from "@/configurator/types";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PageWrapper from "@/components/PageWrapper";
import CollectionClient from "@/components/CollectionClient";
import type { PresetCardData } from "@/components/PresetCard";

export const metadata: Metadata = {
  title: "Bộ sưu tập",
  description:
    "5 mẫu tủ kệ thiết kế sẵn: Compact / Studio / Loft / Tall / Wide. Mỗi mẫu mở Configurator để bạn chỉnh tiếp theo ý mình.",
};

export const dynamic = "force-dynamic";

function buildPresetCardData(
  presets: Preset[],
  priceConfig: PriceConfig,
): PresetCardData[] {
  return presets.map((preset) => {
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
      thumbnail: preset.thumbnail,
    };
  });
}

export default async function CollectionPage() {
  const presets = await listPresets();
  const priceConfig = catalogToPriceConfig(await getProductionCatalog());
  const cards = buildPresetCardData(presets, priceConfig);

  return (
    <PageWrapper>
      <Header />
      <main className="min-h-screen max-w-[1400px] mx-auto px-6 md:px-10 lg:px-12 pt-8 md:pt-14 lg:pt-20 pb-20 md:pb-28">
        {/* Header inline: "kê_ / Bộ sưu tập" GIANT (regrocery pattern) */}
        <div className="mb-10 md:mb-16 lg:mb-20 flex items-baseline gap-3 md:gap-5 flex-wrap">
          <span className="display-giant text-accent leading-[0.95]">kê_</span>
          <span className="display-giant text-accent/40 leading-[0.95]">/</span>
          <span className="display-giant text-accent display-italic leading-[0.95]">Bộ sưu tập</span>
        </div>

        <p className="text-base md:text-lg text-accent font-viet leading-relaxed max-w-2xl mb-10 md:mb-12">
          {presets.length} mẫu thiết kế sẵn — click vào mẫu để mở Configurator và
          chỉnh tiếp theo ý bạn.
        </p>

        <Suspense fallback={<div className="py-16 text-center editorial-caption">Đang tải…</div>}>
          <CollectionClient presets={cards} />
        </Suspense>
      </main>
      <Footer />
    </PageWrapper>
  );
}
