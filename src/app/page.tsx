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

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <PageWrapper>
      <Header />
      <main className="min-h-screen">
        <Hero />
        <BrandMarquee />
        <StorySection />
        <HomeFeatured />
        <HowItWorks />
        <QuoteSection />
        <CategoryList />
        <ValueProps />
      </main>
      <Footer />
    </PageWrapper>
  );
}
