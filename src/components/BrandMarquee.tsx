// =============================================================================
// BrandMarquee — landing footer area gradient text marquee infinite. Port pattern
// từ maume BrandMarquee. KÊ chưa có brand list bên thứ 3 → dùng category names
// (Compact · Studio · Loft · Tall · Wide · Custom...) hoặc keywords liên quan
// product.
// =============================================================================

const KEYWORDS = [
  "Tủ kệ tham số",
  "Compact",
  "Studio",
  "Loft",
  "Tall",
  "Wide",
  "Custom kích thước",
  "Xưởng Việt Nam",
  "Cánh · Ngăn kéo · Kệ mở",
  "MDF sơn · Plywood veneer",
  "Cut-list xưởng",
  "3D realtime",
];

export default function BrandMarquee() {
  const text = KEYWORDS.join(" · ") + " · ";
  return (
    <section className="overflow-hidden py-12 md:py-16 border-t border-neutral-200">
      <div className="marquee-track">
        <span className="marquee-content">{text}</span>
        <span className="marquee-content" aria-hidden>
          {text}
        </span>
      </div>
    </section>
  );
}
