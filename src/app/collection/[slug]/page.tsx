// =============================================================================
// /collection/[slug] — preset detail regrocery editorial pattern.
// Layout: breadcrumb · GIANT name · 2-col image+info · specs · big price · CTA.
// =============================================================================
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import tuKe from "../../../../products/tu-ke/dna";
import { findPreset } from "@/lib/presets-store";
import { catalogToPriceConfig, getProductionCatalog } from "@/lib/production-catalog";
import { computePrice, formatPrice } from "@/configurator/pricing";
import { buildCutlist } from "@/configurator/cutlist";
import { assetUrl } from "@/lib/asset-url";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PageWrapper from "@/components/PageWrapper";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const preset = await findPreset(slug);
  if (!preset) return { title: "Không tìm thấy" };
  return {
    title: preset.name,
    description: preset.description,
    openGraph: {
      title: `${preset.name} · KÊ. by màumè`,
      description: preset.description,
      type: "website",
    },
  };
}

export default async function PresetDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const preset = await findPreset(slug);
  if (!preset) notFound();

  const normalized = tuKe.normalizeValues
    ? tuKe.normalizeValues(preset.values)
    : preset.values;
  const result = tuKe.build(normalized);
  const priceConfig = catalogToPriceConfig(await getProductionCatalog());
  const price = computePrice(result, priceConfig);
  const cutlist = buildCutlist(result, priceConfig);

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: preset.name,
    description: preset.description,
    brand: { "@type": "Brand", name: "KÊ. by màumè" },
    category: `Tủ kệ · ${preset.category}`,
    offers: {
      "@type": "Offer",
      priceCurrency: "VND",
      price: price.total,
      availability: "https://schema.org/InStock",
    },
  };

  const thumbSrc = preset.thumbnail ?? assetUrl(`/presets/${preset.slug}.png`);
  const cleanName = preset.name.replace(/^KÊ\.\s*/, "");

  return (
    <PageWrapper>
      <Header />
      <main className="min-h-screen max-w-[1400px] mx-auto px-6 md:px-10 lg:px-12 py-10 md:py-16 lg:py-20">
        <script type="application/ld+json">{JSON.stringify(productSchema)}</script>

        {/* Breadcrumb editorial */}
        <nav className="editorial-caption mb-8 md:mb-12 flex flex-wrap items-center gap-2">
          <Link href="/" className="hover:opacity-60 transition-opacity">
            KÊ.
          </Link>
          <span className="opacity-40">/</span>
          <Link href="/collection" className="hover:opacity-60 transition-opacity">
            Bộ sưu tập
          </Link>
          <span className="opacity-40">/</span>
          <span className="opacity-60">{cleanName}</span>
        </nav>

        {/* GIANT title hero */}
        <div className="mb-12 md:mb-16">
          <p className="editorial-caption mb-4 md:mb-6 font-viet">{preset.usecase}</p>
          <h1 className="display-giant text-accent display-italic">
            {cleanName}
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 md:gap-12 lg:gap-16">
          {/* Cột trái: ảnh trên cream BG plain (regrocery exact) */}
          <div className="lg:col-span-7">
            <div className="relative aspect-[4/5] md:aspect-[4/4] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbSrc}
                alt={`${preset.name} — tủ kệ ${preset.usecase}`}
                width={1020}
                height={1000}
                className="absolute inset-0 w-full h-full object-contain p-4 md:p-8"
                loading="eager"
              />
            </div>
          </div>

          {/* Cột phải: info + CTA */}
          <div className="lg:col-span-5">
            <p className="text-base md:text-lg text-[var(--color-ink-2)] font-viet leading-relaxed">
              {preset.description}
            </p>

            {/* Specs */}
            <div className="mt-10 md:mt-12 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-[var(--color-line)] pt-8">
              <div>
                <p className="editorial-caption mb-2">Kích thước</p>
                <p className="text-lg font-viet tabular-nums text-accent">
                  {preset.values.width as number} × {preset.values.height as number} ×{" "}
                  {preset.values.depth as number}
                  <span className="text-sm text-accent/60 ml-1">mm</span>
                </p>
              </div>
              <div>
                <p className="editorial-caption mb-2">Cấu trúc</p>
                <p className="text-lg font-viet tabular-nums text-accent">
                  {preset.values.columns as number}×{preset.values.rows as number}
                  <span className="text-sm text-accent/60 ml-1">cột × tầng</span>
                </p>
              </div>
              <div>
                <p className="editorial-caption mb-2">Số tấm</p>
                <p className="text-lg font-viet tabular-nums text-accent">
                  {cutlist.totalPanels}
                  <span className="text-sm text-accent/60 ml-1">tấm</span>
                </p>
              </div>
              <div>
                <p className="editorial-caption mb-2">Cân nặng</p>
                <p className="text-lg font-viet tabular-nums text-accent">
                  ~{(cutlist.totalWeightKg ?? 0).toFixed(0)}
                  <span className="text-sm text-accent/60 ml-1">kg</span>
                </p>
              </div>
            </div>

            {/* Price */}
            <div className="mt-10 md:mt-12 border-t border-[var(--color-line)] pt-8">
              <p className="editorial-caption mb-3">Giá tham khảo</p>
              <p className="display-huge text-accent display-italic tabular-nums">
                {formatPrice(price.total)}
              </p>
              <p className="text-sm text-[var(--color-ink-2)] font-viet mt-3 leading-relaxed">
                Bạn có thể chỉnh kích thước · vật liệu · cấu hình → giá cập nhật ngay.
              </p>

              <Link
                href={`/design?preset=${preset.slug}`}
                className="mt-8 inline-flex items-center justify-center px-10 py-4 rounded-full bg-[var(--color-accent)] text-white text-sm font-medium tracking-wide hover:bg-[var(--color-accent-hover)] transition-colors"
              >
                Thiết kế tủ này →
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </PageWrapper>
  );
}
