// =============================================================================
// Trang chủ — landing brand "KÊ. by màumè". Configurator đã chuyển sang /design.
// Server component (KHÔNG `use client`) — Header lo phần stateful mobile-menu.
// =============================================================================
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import ValueProps from "@/components/ValueProps";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <ValueProps />
      </main>
      <Footer />
    </>
  );
}
