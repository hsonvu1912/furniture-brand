// =============================================================================
// /collection — regrocery exact header pattern: "ngăn / Bộ sưu tập" GIANT inline.
// Sidebar trái: category list small accent text + counts.
// Right: grid 3 cols asymmetric cards.
// =============================================================================
import type { Metadata } from "next";
import { Suspense } from "react";
import type { Preset } from "../../../products/tu-ke/presets";
// P88 — nhãn lọc khách-thấy (Tủ kệ / Mô-đun); build card-data DÙNG CHUNG với trang chủ (getDNA route).
import { PRODUCT_DISPLAY_LABELS } from "../../../products/registry";
import { PRESETS as TUY_PRESETS } from "../../../products/tu-y/presets";
import { listPresets } from "@/lib/presets-store";
import { catalogToPriceConfig, getProductionCatalog } from "@/lib/production-catalog";
import { buildPresetCardData } from "@/lib/preset-card";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PageWrapper from "@/components/PageWrapper";
import CollectionClient from "@/components/CollectionClient";

export const metadata: Metadata = {
  title: "Bộ sưu tập",
  description:
    "Tủ kệ module thiết kế sẵn theo loại: tủ TV, tủ trang trí, tủ sách, tủ tường, tủ ngăn kéo, tủ giày, tủ đầu giường. Chọn mẫu rồi chỉnh kích thước · màu · cấu hình theo ý bạn.",
};

export const dynamic = "force-dynamic";

export default async function CollectionPage() {
  const kvPresets = await listPresets();
  // P83.5 — gộp thư viện preset tu-y (TĨNH, chưa lưu KV) vào lưới chung, dedupe theo slug.
  const kvSlugs = new Set(kvPresets.map((p) => p.slug));
  const presets: Preset[] = [...kvPresets, ...TUY_PRESETS.filter((p) => !kvSlugs.has(p.slug))];
  const priceConfig = catalogToPriceConfig(await getProductionCatalog());
  const cards = buildPresetCardData(presets, priceConfig);

  return (
    <PageWrapper>
      <Header />
      <main className="min-h-screen max-w-[1400px] mx-auto px-6 md:px-10 lg:px-12 pt-8 md:pt-14 lg:pt-20 pb-20 md:pb-28">
        {/* Header inline: "ngăn / Bộ sưu tập" GIANT (regrocery pattern) */}
        <div className="mb-10 md:mb-16 lg:mb-20 flex items-baseline gap-3 md:gap-5 flex-wrap">
          <span className="font-lora display-giant text-accent leading-[0.95]">ngăn</span>
          <span className="display-giant text-accent/40 leading-[0.95]">/</span>
          <span className="display-giant text-accent display-italic leading-[0.95]">Bộ sưu tập</span>
        </div>

        <p className="text-base md:text-lg text-accent font-viet leading-relaxed max-w-2xl mb-10 md:mb-12">
          {presets.length} mẫu thiết kế sẵn — click vào mẫu để mở Configurator và
          chỉnh tiếp theo ý bạn.
        </p>

        <Suspense fallback={<div className="py-16 text-center editorial-caption">Đang tải…</div>}>
          <CollectionClient presets={cards} productLabels={PRODUCT_DISPLAY_LABELS} />
        </Suspense>
      </main>
      <Footer />
    </PageWrapper>
  );
}
