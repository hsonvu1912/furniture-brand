// =============================================================================
// PageWrapper — outer container đồng bộ pattern maume: max-w-[1920px] mx-auto,
// bg cream #FDFBF7, shadow 2 bên để tạo cảm giác "page nổi" trên body bg neutral-100.
// Dùng cho landing/marketing pages. KHÔNG dùng cho /design (Configurator full-bleed).
// =============================================================================
export default function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div
      id="page-wrapper"
      className="relative z-10 bg-[#FDFBF7] max-w-[1920px] mx-auto shadow-[20px_0_60px_-15px_rgba(0,0,0,0.08),-20px_0_60px_-15px_rgba(0,0,0,0.08)]"
    >
      {children}
    </div>
  );
}
