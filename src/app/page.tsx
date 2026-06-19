// =============================================================================
// Trang chủ — Rev4 restructure: bỏ duplicate, thêm Story/HowItWorks/Quote sections.
// Sequence editorial: Hero · Marquee · Story · Featured (5 cards) · HowItWorks ·
// Quote · CategoryList (theo phòng) · ValueProps · Footer.
// =============================================================================
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import HomeFeatured from "@/components/HomeFeatured";
import CategoryList from "@/components/CategoryList";
import ValueProps from "@/components/ValueProps";
import BrandMarquee from "@/components/BrandMarquee";
import StorySection from "@/components/StorySection";
import HowItWorks from "@/components/HowItWorks";
import QuoteSection from "@/components/QuoteSection";
import PageWrapper from "@/components/PageWrapper";
import { listPresets } from "@/lib/presets-store";
import { catalogToPriceConfig, getProductionCatalog } from "@/lib/production-catalog";

export const dynamic = "force-dynamic";

export default async function Home() {
  // P33: fetch preset (KV) + catalog Ở PAGE-LEVEL (getCloudflareContext còn
  // context ở đây) → truyền xuống HomeFeatured. Nếu để HomeFeatured tự fetch
  // (child async lồng trong page sync) → mất context → listPresets fallback →
  // ảnh trang chủ không cập nhật khi Lưu preset.
  const presets = await listPresets();
  const priceConfig = catalogToPriceConfig(await getProductionCatalog());
  // Featured hero = "Tủ trang trí cao" (bản lớn ấn tượng) — preset KV để lấy
  // thumbnail mới nhất. Fallback presets[0] nếu preset này bị đổi/xoá sau này.
  const featured = presets.find((p) => p.slug === "tu-trang-tri-cao") ?? presets[0];

  return (
    <PageWrapper>
      <Header />
      <main className="min-h-screen">
        <Hero featured={featured} />
        <BrandMarquee />
        <StorySection />
        <HomeFeatured presets={presets} priceConfig={priceConfig} />
        <HowItWorks />
        <QuoteSection />
        <CategoryList />
        <ValueProps />
      </main>
      <Footer />
    </PageWrapper>
  );
}
