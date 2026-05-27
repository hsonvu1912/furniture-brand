// =============================================================================
// Hero — Rev4: bỏ grid 5 thumbnail (duplicate với HomeFeatured).
// Layout regrocery hero exact:
//   - Left: caption + GIANT italic typography + body + 2 pill CTAs
//   - Right: 1 featured product hero image lớn (lifestyle/showcase)
// =============================================================================
import Link from "next/link";
import { assetUrl } from "@/lib/asset-url";
import { PRESETS } from "../../products/tu-ke/presets";

export default function Hero() {
  // Featured hero = preset đầu tiên (có thể đổi sang Loft cho ấn tượng hơn)
  const featured = PRESETS.find((p) => p.slug === "loft") ?? PRESETS[0];

  return (
    <section className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-12 pt-8 md:pt-14 lg:pt-20 pb-12 md:pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 md:gap-12 lg:gap-16 items-end">
        {/* Left: typography + CTAs */}
        <div className="lg:col-span-7">
          <p className="editorial-caption mb-5 md:mb-7 font-viet">
            Tủ kệ thiết kế tham số — KÊ. by màumè
          </p>
          <h1 className="display-giant text-accent leading-[0.92]">
            tủ kệ <span className="display-italic">đo</span>
            <br />
            <span className="display-italic">từng milimet.</span>
          </h1>
          <p className="mt-8 md:mt-10 text-base md:text-lg text-accent/80 font-viet leading-relaxed max-w-xl">
            Chọn một mẫu sẵn, hoặc bắt đầu từ tờ giấy trắng. Xoay 3D, đổi vật liệu,
            xem giá ngay. Xưởng Việt Nam làm theo bản vẽ của bạn — không sai số.
          </p>
          <div className="mt-10 md:mt-12 flex flex-wrap items-center gap-3">
            <Link
              href="/design"
              className="pill-outline"
              style={{ backgroundColor: "var(--color-accent)", color: "white" }}
            >
              Bắt đầu thiết kế →
            </Link>
            <Link href="/collection" className="pill-outline">
              Xem 5 mẫu sẵn
            </Link>
          </div>
        </div>

        {/* Right: featured hero image */}
        <div className="lg:col-span-5">
          <Link
            href={`/collection/${featured.slug}/`}
            className="group block relative aspect-[3/4] lg:aspect-[4/5] overflow-hidden"
            aria-label={`Xem ${featured.name}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={assetUrl(`/presets/${featured.slug}.png`)}
              alt={`${featured.name} — ${featured.usecase}`}
              width={1020}
              height={1000}
              loading="eager"
              className="absolute inset-0 w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-700 ease-out"
            />
            {/* Caption overlay top-right */}
            <div className="absolute top-3 right-3 text-right">
              <p className="editorial-caption mb-1">Featured</p>
            </div>
            {/* Title overlay bottom */}
            <h2 className="absolute bottom-3 left-3 right-3 display-italic text-accent text-4xl md:text-5xl lg:text-6xl leading-[0.95] pointer-events-none">
              {featured.name.replace(/^KÊ\.\s*/, "")}
            </h2>
          </Link>
        </div>
      </div>
    </section>
  );
}
