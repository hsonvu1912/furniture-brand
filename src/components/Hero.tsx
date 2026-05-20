// =============================================================================
// Hero — heading lớn gradient-text "KÊ." + mô tả ngắn + 2 CTA. Founder chốt
// KHÔNG cần tagline phụ → giữ minimal: heading + 1 dòng mô tả + 2 nút.
// =============================================================================
import Link from "next/link";

export default function Hero() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 py-16 md:py-28 lg:py-36">
      <div className="max-w-3xl">
        <h1 className="text-6xl md:text-8xl lg:text-9xl font-extrabold tracking-tight leading-[0.95] gradient-text">
          KÊ.
        </h1>
        <p className="mt-6 md:mt-8 text-lg md:text-2xl text-neutral-700 font-viet max-w-xl leading-relaxed">
          Tủ kệ tham số. Bạn chỉnh — 3D đổi ngay — giá hiện ngay — xưởng làm sẵn.
        </p>
        <div className="mt-8 md:mt-10 flex flex-wrap gap-3 md:gap-4">
          <Link
            href="/design"
            className="inline-flex items-center justify-center rounded-full bg-black text-white px-6 md:px-8 py-3 md:py-4 text-sm md:text-base font-medium hover:bg-neutral-800 transition-colors"
          >
            Thiết kế tự do →
          </Link>
          <Link
            href="/collection"
            className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-6 md:px-8 py-3 md:py-4 text-sm md:text-base font-medium text-neutral-800 hover:border-neutral-800 transition-colors"
          >
            Xem bộ sưu tập
          </Link>
        </div>
      </div>
    </section>
  );
}
