// =============================================================================
// QuoteSection — editorial pull quote GIANT (regrocery hero text pattern).
// 1 dòng quote signature trên BG cream, tagline + signature dưới.
// =============================================================================

export default function QuoteSection() {
  return (
    <section className="border-t border-b border-accent/20 py-20 md:py-28 lg:py-36">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-12 text-center">
        <p className="editorial-caption mb-8 md:mb-12">Lời từ khách</p>
        <blockquote className="display-huge text-accent display-italic leading-[1.05] max-w-5xl mx-auto">
          “Tôi đo phòng xong, KÊ. tính ra <br className="hidden md:inline" />
          chiếc tủ đúng từng centimet.”
        </blockquote>
        <p className="mt-10 md:mt-12 editorial-caption">
          Linh · Studio 28m² · Tp. HCM
        </p>
      </div>
    </section>
  );
}
