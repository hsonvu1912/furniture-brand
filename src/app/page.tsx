// =============================================================================
// Trang chủ — landing brand "KÊ. by màumè". Configurator đã chuyển sang /design.
// PageWrapper bọc toàn bộ landing (max-w-[1920px] + shadow 2 bên) đồng bộ pattern
// maume. Server component (KHÔNG `use client`) — Header lo phần stateful mobile-menu.
// =============================================================================
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import ValueProps from "@/components/ValueProps";
import BrandMarquee from "@/components/BrandMarquee";
import PageWrapper from "@/components/PageWrapper";

export default function Home() {
  return (
    <PageWrapper>
      <Header />
      <main className="min-h-screen">
        <Hero />
        <ValueProps />
        <BrandMarquee />
      </main>
      <Footer />
    </PageWrapper>
  );
}
