// =============================================================================
// /collection/[slug] — preset detail (bản GALLERY, P47b).
// Layout: breadcrumb · GIANT name · 2-col (gallery ảnh render trái + info phải).
// Info: mô tả · thông số · MÀU CÓ SẴN (đọc từ catalogue admin) · giá · CTA Thiết kế.
// KHÔNG có 3D sống / đặt-hàng-theo-màu (đã gỡ ProductViewer + ProductBuyBox).
// =============================================================================
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Ngan } from "@/components/Brand";
// P88 — route engine theo loại tủ (x=tu-ke / y=tu-y), không cứng tu-ke + không redirect tủ y.
import { getDNA } from "../../../../products/registry";
import { categoryLabel } from "../../../../products/tu-ke/presets";
import { findPreset } from "@/lib/presets-store";
import {
  catalogToPriceConfig,
  getProductionCatalog,
  enabledMaterialsForDna,
} from "@/lib/production-catalog";
import { computePrice, formatPrice } from "@/configurator/pricing";
import { buildCutlist } from "@/configurator/cutlist";
import { resolveMaterial } from "@/configurator/materials";
import { assetUrl } from "@/lib/asset-url";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PageWrapper from "@/components/PageWrapper";
import ProductGallery from "@/components/ProductGallery";

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
      title: `${preset.name} · ngăn by màumè`,
      description: preset.description,
      type: "website",
    },
  };
}

export default async function PresetDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const preset = await findPreset(slug);
  if (!preset) notFound();
  // P88 — tủ y giờ CÓ trang chi tiết riêng (như tủ x), không redirect nữa.
  const isTuY = preset.productSlug === "tu-y";
  const dna = getDNA(preset.productSlug);
  const normalized = dna.normalizeValues ? dna.normalizeValues(preset.values) : preset.values;
  const result = dna.build(normalized);
  const catalog = await getProductionCatalog();
  const priceConfig = catalogToPriceConfig(catalog);
  const price = computePrice(result, priceConfig);
  const cutlist = buildCutlist(result, priceConfig);

  // P88 — Số ô tủ y = số module (parse values.modules JSON; guard hỏng → 0).
  const moduleCount = isTuY
    ? (() => {
        try {
          const m = (JSON.parse(String(preset.values.modules ?? "")) as { modules?: unknown[] }).modules;
          return Array.isArray(m) ? m.length : 0;
        } catch {
          return 0;
        }
      })()
    : 0;

  // P47b: MÀU CÓ SẴN — đúng các màu founder đã bật cho loại tủ này trong admin
  // catalogue (enabledFor). Hiển thị-only. Khách chọn màu khi vào /design.
  const enabledIds = enabledMaterialsForDna(catalog, preset.productSlug ?? "tu-ke");
  const availableColors = enabledIds.map((id) => {
    const c = catalog.colors.find((cc) => cc.id === id);
    const m = resolveMaterial(id);
    // P51: màu vân gỗ có ảnh texture → swatch hiện thumbnail ảnh thật.
    return { id, label: c?.label ?? id, hex: m.hex, textureUrl: m.textureUrl };
  });

  // Ảnh: thumbnails[] (đa góc, render từ admin) → thumbnail → fallback tĩnh.
  const galleryImages =
    preset.thumbnails && preset.thumbnails.length > 0
      ? preset.thumbnails
      : preset.thumbnail
        ? [preset.thumbnail]
        : [assetUrl(`/presets/${preset.slug}.png`)];

  const cleanName = preset.name.replace(/^(kê|ngăn)\.?\s*/i, "");

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: preset.name,
    description: preset.description,
    brand: { "@type": "Brand", name: "ngăn by màumè" },
    category: categoryLabel(preset.category),
    offers: {
      "@type": "Offer",
      priceCurrency: "VND",
      price: price.total,
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <PageWrapper>
      <Header />
      <main className="min-h-screen max-w-[1400px] mx-auto px-6 md:px-10 lg:px-12 py-10 md:py-16 lg:py-20">
        <script type="application/ld+json">{JSON.stringify(productSchema)}</script>

        {/* Breadcrumb editorial */}
        <nav className="editorial-caption mb-8 md:mb-12 flex flex-wrap items-center gap-2">
          <Link href="/" className="hover:opacity-60 transition-opacity">
            <Ngan />
          </Link>
          <span className="opacity-40">/</span>
          <Link href="/collection" className="hover:opacity-60 transition-opacity">
            Bộ sưu tập
          </Link>
          <span className="opacity-40">/</span>
          <span className="opacity-60">{cleanName}</span>
        </nav>

        {/* GIANT title hero */}
        <div className="mb-10 md:mb-14">
          <p className="editorial-caption mb-4 md:mb-6 font-viet">{preset.usecase}</p>
          <h1 className="display-giant text-accent display-italic">{cleanName}</h1>
        </div>

        {/* 2-col: gallery (ảnh render admin) trái · info phải */}
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
          <div className="lg:col-span-7">
            <ProductGallery
              images={galleryImages}
              alt={`${preset.name} — tủ kệ ${preset.usecase}`}
            />
          </div>

          <div className="lg:col-span-5 flex flex-col gap-8">
            {/* Mô tả */}
            <p className="text-base md:text-lg text-accent font-viet leading-relaxed">
              {preset.description}
            </p>

            {/* Thông số */}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-6">
              <div>
                <dt className="editorial-caption mb-1">Loại tủ</dt>
                <dd className="text-sm text-accent font-viet">
                  {categoryLabel(preset.category)}
                </dd>
              </div>
              <div>
                <dt className="editorial-caption mb-1">{isTuY ? "Kích thước phủ bì" : "Kích thước"}</dt>
                <dd className="text-sm text-accent font-viet tabular-nums">
                  {isTuY
                    ? `${result.size?.w ?? 0} × ${result.size?.h ?? 0} × ${result.size?.d ?? 0} mm`
                    : `${preset.values.width as number} × ${preset.values.height as number} × ${preset.values.depth as number} mm`}
                </dd>
              </div>
              <div>
                <dt className="editorial-caption mb-1">Số ô</dt>
                <dd className="text-sm text-accent font-viet tabular-nums">
                  {isTuY
                    ? `${moduleCount} ô`
                    : `${preset.values.columns as number} cột × ${preset.values.rows as number} tầng`}
                </dd>
              </div>
              {isTuY && (result.doorCount ?? 0) > 0 && (
                <div>
                  <dt className="editorial-caption mb-1">Số cánh</dt>
                  <dd className="text-sm text-accent font-viet tabular-nums">
                    {result.doorCount} cánh
                  </dd>
                </div>
              )}
              <div>
                <dt className="editorial-caption mb-1">Số tấm ván</dt>
                <dd className="text-sm text-accent font-viet tabular-nums">
                  {cutlist.totalPanels} tấm
                </dd>
              </div>
            </dl>

            {/* MÀU CÓ SẴN — đọc từ catalogue admin (hiển thị-only) */}
            {availableColors.length > 0 && (
              <div className="border-t border-line pt-6">
                <p className="editorial-caption mb-3">Màu có sẵn · {availableColors.length}</p>
                <div className="flex flex-wrap gap-2">
                  {availableColors.map((c) => (
                    <span
                      key={c.id}
                      title={c.label}
                      aria-label={c.label}
                      className="w-7 h-7 rounded-full border border-accent/15 shadow-sm bg-cover bg-center"
                      style={
                        c.textureUrl
                          ? { backgroundImage: `url(${c.textureUrl})` }
                          : { backgroundColor: c.hex }
                      }
                    />
                  ))}
                </div>
                <p className="text-[11px] text-accent/50 font-viet mt-3">
                  Chọn màu khung &amp; từng ô khi bấm “Thiết kế tủ này”.
                </p>
              </div>
            )}

            {/* Giá + CTA */}
            <div className="border-t border-line pt-6">
              <p className="display-large text-accent tabular-nums leading-none">
                {formatPrice(price.total)}
              </p>
              <p className="editorial-caption mt-2 mb-6">
                Giá tham khảo · chưa gồm vận chuyển &amp; lắp đặt
              </p>
              <Link
                href={isTuY ? `/design?product=tu-y&preset=${preset.slug}` : `/design?preset=${preset.slug}`}
                className="pill-outline text-base px-8 py-3"
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
