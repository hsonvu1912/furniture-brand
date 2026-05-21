// =============================================================================
// Trang chủ — landing brand "KÊ. by màumè" (match maume.asia / structure).
// Pattern maume:
//  [Header] [Hero gallery] [HomeFeatured "Bộ sưu tập"] [ValueProps "Vì sao KÊ."]
//  [BrandMarquee text gradient] [Footer]
// Configurator đã ở /design.
// =============================================================================
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import HomeFeatured from "@/components/HomeFeatured";
import ValueProps from "@/components/ValueProps";
import BrandMarquee from "@/components/BrandMarquee";
import PageWrapper from "@/components/PageWrapper";

export default function Home() {
  return (
    <PageWrapper>
      <Header />
      <main className="min-h-screen">
        <Hero />
        <HomeFeatured />
        <ValueProps />
      </main>
      <BrandMarquee />
      <Footer />
    </PageWrapper>
  );
}
