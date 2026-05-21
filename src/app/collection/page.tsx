// =============================================================================
// /collection — SSG list page. Server component: import PRESETS + compute
// metrics build-time → pass static data sang CollectionClient (client) để filter
// + sort theo URL params.
// =============================================================================
import type { Metadata } from "next";
import { Suspense } from "react";
import { PRESETS } from "../../../products/tu-ke/presets";
import tuKe from "../../../products/tu-ke/dna";
import { computePrice, formatPrice } from "@/configurator/pricing";
import { buildCutlist } from "@/configurator/cutlist";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PageWrapper from "@/components/PageWrapper";
import CollectionClient from "@/components/CollectionClient";
import PageHeaderMarquee from "@/components/PageHeaderMarquee";
import type { PresetCardData } from "@/components/PresetCard";

export const metadata: Metadata = {
  title: "Bộ sưu tập",
  description:
    "5 mẫu tủ kệ thiết kế sẵn: Compact / Studio / Loft / Tall / Wide. Mỗi mẫu mở Configurator để bạn chỉnh tiếp theo ý mình.",
};

function buildPresetCardData(): PresetCardData[] {
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

export default function CollectionPage() {
  const presets = buildPresetCardData();

  return (
    <PageWrapper>
      <Header />
      <main className="min-h-screen max-w-[1400px] mx-auto px-6 pt-3 md:pt-5 pb-16 md:pb-20">
        <PageHeaderMarquee
          title="Bộ sưu tập"
          colorOffset={20}
          subtitle={`${PRESETS.length} mẫu thiết kế sẵn — click để mở Configurator chỉnh tiếp.`}
        />
        <Suspense fallback={<div className="py-16 text-center text-neutral-400">Đang tải…</div>}>
          <CollectionClient presets={presets} />
        </Suspense>
      </main>
      <Footer />
    </PageWrapper>
  );
}
