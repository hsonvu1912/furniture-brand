// =============================================================================
// Hero — landing hero. Typography đồng bộ maume (text-5xl md:text-7xl heading,
// text-lg md:text-xl subheading, buttons px-8 py-3.5 font-semibold tracking-wide).
// Layout 2 cột desktop: text 60% trái + gradient panel 40% phải (aspect-[4/5]
// mô phỏng vị trí hero image của maume). Mobile 1 cột text-only, panel hidden.
// =============================================================================
import Link from "next/link";

export default function Hero() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 py-20">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center">
        <div className="md:col-span-7">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1] gradient-text">
            KÊ.
          </h1>
          <p className="mt-6 text-lg md:text-xl text-neutral-700 font-viet leading-relaxed max-w-xl">
            Tủ kệ tham số. Bạn chỉnh — 3D đổi ngay — giá hiện ngay — xưởng làm sẵn.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/design"
              className="inline-block bg-black text-white px-8 py-3.5 text-sm font-semibold tracking-wide hover:bg-neutral-700 transition-all duration-300"
            >
              THIẾT KẾ TỰ DO
            </Link>
            <Link
              href="/collection"
              className="inline-block border border-neutral-300 bg-white text-neutral-800 px-8 py-3.5 text-sm font-semibold tracking-wide hover:border-neutral-800 transition-all duration-300"
            >
              XEM BỘ SƯU TẬP
            </Link>
          </div>
        </div>

        {/* Gradient panel — chỉ hiện desktop. Mô phỏng vị trí hero image của maume.
            Sau S5 có ảnh preset render thì thay panel này bằng <img>. */}
        <div className="hidden md:block md:col-span-5">
          <div className="aspect-[4/5] rounded-sm gradient-bg relative overflow-hidden">
            <div className="absolute inset-0 bg-white/10" />
          </div>
        </div>
      </div>
    </section>
  );
}
