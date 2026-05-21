// =============================================================================
// Hero — landing image gallery (pattern maume HeroGallery, adapt cho KÊ).
// 5 preset thumbnail grid TĨNH (founder chốt: không marquee, click vào thumbnail
// → /collection/<slug>). KHÔNG có text overlay "KÊ." — brand đã ở Header.
// Layout:
//  - Desktop (lg+): 5 cols single row
//  - Tablet (md): 3 cols, wide preset col-span-2 (1 row + 1 row mỗi 3 + 2)
//  - Mobile (sm): 2 cols, wide preset col-span-2 (3 rows: 2+2+1full)
// Pattern aspect-[4/5] · object-cover · group-hover scale-105 transition-700.
// =============================================================================
import Link from "next/link";
import { PRESETS } from "../../products/tu-ke/presets";
import { assetUrl } from "@/lib/asset-url";

export default function Hero() {
  return (
    <section className="max-w-[1400px] mx-auto px-3 md:px-6 pt-3 md:pt-5">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        {PRESETS.map((preset, i) => {
          // Mobile (2-col): 5 thumbnail → 2+2+1, item cuối full row
          // Tablet (3-col): 5 thumbnail → 3+2, item 3-4 row 2 vẫn 1-col, item 5 col-span-3
          // Desktop (5-col): single row, không cần span
          const isLast = i === PRESETS.length - 1;
          const spanClass = isLast
            ? "col-span-2 md:col-span-3 lg:col-span-1"
            : "";
          return (
            <Link
              key={preset.slug}
              href={`/collection/${preset.slug}/`}
              className={`group block relative aspect-[4/5] overflow-hidden bg-neutral-100 ${spanClass}`}
              aria-label={`Xem ${preset.name}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={assetUrl(`/presets/${preset.slug}.png`)}
                alt={`${preset.name} — ${preset.usecase}`}
                width={1020}
                height={1000}
                loading={i < 3 ? "eager" : "lazy"}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              />
              {/* Category label nhẹ trên hover */}
              <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="inline-block text-[10px] font-semibold uppercase tracking-widest bg-white/90 backdrop-blur-sm text-neutral-800 px-2 py-1">
                  {preset.name}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
