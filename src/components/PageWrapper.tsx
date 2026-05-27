// =============================================================================
// PageWrapper — outer container max-w-[1920px] mx-auto, bg off-white.
// Editorial style: bỏ shadow đậm (regrocery không có), chỉ giữ container.
// KHÔNG dùng cho /design (Configurator full-bleed).
// =============================================================================
export default function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div
      id="page-wrapper"
      className="relative z-10 bg-[var(--color-bg)] max-w-[1920px] mx-auto"
    >
      {children}
    </div>
  );
}
