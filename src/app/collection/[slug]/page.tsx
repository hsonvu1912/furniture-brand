// =============================================================================
// /collection/[slug] — SSG preset detail page với JSON-LD Product schema (SEO).
// generateStaticParams: pre-render 1 page mỗi preset (5 static routes total).
// =============================================================================
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PRESETS, findPreset } from "../../../../products/tu-ke/presets";
import tuKe from "../../../../products/tu-ke/dna";
import { computePrice, formatPrice } from "@/configurator/pricing";
import { buildCutlist } from "@/configurator/cutlist";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PageWrapper from "@/components/PageWrapper";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return PRESETS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const preset = findPreset(slug);
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
  const preset = findPreset(slug);
  if (!preset) notFound();

  const normalized = tuKe.normalizeValues
    ? tuKe.normalizeValues(preset.values)
    : preset.values;
  const result = tuKe.build(normalized);
  const price = computePrice(result, tuKe.priceConfig);
  const cutlist = buildCutlist(result);

  // JSON-LD Product schema cho SEO. Data tự tạo từ preset (static, trusted) —
  // dùng JSX text children pattern (Next 16 App Router) thay dangerouslySetInnerHTML.
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

  return (
    <PageWrapper>
      <Header />
      <main className="min-h-screen max-w-[1400px] mx-auto px-6 py-12 md:py-16">
        <script type="application/ld+json">{JSON.stringify(productSchema)}</script>

        {/* Breadcrumb */}
        <nav className="text-xs md:text-sm text-neutral-400 font-viet mb-6 md:mb-8">
          <Link href="/" className="hover:text-black transition-colors">
            Trang chủ
          </Link>{" "}
          ·{" "}
          <Link href="/collection" className="hover:text-black transition-colors">
            Bộ sưu tập
          </Link>{" "}
          · <span className="text-neutral-700">{preset.name}</span>
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
          {/* Cột trái: gradient panel mô phỏng (placeholder thumbnail lớn) */}
          <div className="md:col-span-7">
            <div className={`relative aspect-[4/5] md:aspect-[4/3] overflow-hidden bg-gradient-to-br ${preset.accent}`}>
              <div className="absolute inset-0 bg-white/10" />
              <div className="absolute inset-0 flex items-center justify-center p-12">
                <div
                  className="border-2 border-white/40 bg-white/5"
                  style={{
                    width: '70%',
                    aspectRatio: `${preset.values.width} / ${preset.values.height}`,
                    maxHeight: '80%',
                  }}
                  aria-hidden="true"
                />
              </div>
              <span className="absolute top-4 left-4 text-xs font-semibold tracking-widest text-white/90 uppercase">
                {preset.category}
              </span>
            </div>
          </div>

          {/* Cột phải: info + CTA */}
          <div className="md:col-span-5">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">{preset.name}</h1>
            <p className="text-sm md:text-base text-neutral-500 mt-1 font-viet">{preset.usecase}</p>

            <p className="mt-6 text-base md:text-lg text-neutral-700 font-viet leading-relaxed">
              {preset.description}
            </p>

            {/* Specs box */}
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-neutral-200 pt-6 text-sm">
              <div>
                <span className="block text-xs uppercase tracking-wide text-neutral-400 font-semibold">
                  Kích thước
                </span>
                <span className="font-viet tabular-nums">
                  {preset.values.width as number} × {preset.values.height as number} ×{" "}
                  {preset.values.depth as number} mm
                </span>
              </div>
              <div>
                <span className="block text-xs uppercase tracking-wide text-neutral-400 font-semibold">
                  Cấu trúc
                </span>
                <span className="font-viet tabular-nums">
                  {preset.values.columns as number} cột × {preset.values.rows as number} tầng
                </span>
              </div>
              <div>
                <span className="block text-xs uppercase tracking-wide text-neutral-400 font-semibold">
                  Số tấm
                </span>
                <span className="font-viet tabular-nums">{cutlist.totalPanels} tấm</span>
              </div>
              <div>
                <span className="block text-xs uppercase tracking-wide text-neutral-400 font-semibold">
                  Cân nặng
                </span>
                <span className="font-viet tabular-nums">
                  ~{(cutlist.totalWeightKg ?? 0).toFixed(0)} kg
                </span>
              </div>
            </div>

            {/* Price + CTA */}
            <div className="mt-8 border-t border-neutral-200 pt-6">
              <span className="block text-xs uppercase tracking-wide text-neutral-400 font-semibold">
                Giá tham khảo
              </span>
              <span className="block text-3xl md:text-4xl font-black gradient-text mt-1">
                {formatPrice(price.total)}
              </span>
              <p className="text-xs text-neutral-400 font-viet mt-1">
                Bạn có thể chỉnh kích thước · vật liệu · cấu hình → giá cập nhật ngay.
              </p>

              <Link
                href={`/design?preset=${preset.slug}`}
                className="mt-6 inline-block bg-black text-white px-8 py-3.5 text-sm font-semibold tracking-wide hover:bg-neutral-700 transition-all duration-300"
              >
                THIẾT KẾ TỦ NÀY →
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </PageWrapper>
  );
}
