// =============================================================================
// BrandMarquee — GIANT marquee accent orange-red (regrocery exact pattern
// "refill rethink reuse"). Cỡ chữ massive clamp 56-176px qua CSS class.
// =============================================================================

const KEYWORDS = [
  "tủ kệ",
  "thiết kế",
  "tham số",
  "3D realtime",
  "cut-list xưởng",
  "tủ TV",
  "tủ sách",
  "tủ trang trí",
  "tủ giày",
  "tủ đầu giường",
  "custom kích thước",
  "MDF sơn",
  "plywood veneer",
  "melamine",
];

export default function BrandMarquee() {
  const text = KEYWORDS.join(" · ") + " · ";
  return (
    <section className="overflow-hidden py-10 md:py-14 border-y border-[var(--color-line)]">
      <div className="marquee-track">
        <span className="marquee-content">{text}</span>
        <span className="marquee-content" aria-hidden>
          {text}
        </span>
      </div>
    </section>
  );
}
