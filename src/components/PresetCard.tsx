// =============================================================================
// PresetCard — 1 mẫu trong grid /collection. Thumbnail gradient placeholder
// (defer ảnh thật tới S6), name, usecase tagline, meta (giá · tấm · cột×tầng),
// CTA "Thiết kế tủ này" link /design?preset=<slug>.
//
// Pattern card maume ProductCard: aspect-[4/5] thumbnail + name + meta dưới.
// =============================================================================
import Link from "next/link";

export interface PresetCardData {
  slug: string;
  name: string;
  usecase: string;
  category: string;
  accent: string; // tailwind gradient classes, vd "from-[#F5A088] to-[#F5D78E]"
  priceFormatted: string;
  totalPanels: number;
  columns: number;
  rows: number;
  width: number;
  height: number;
}

export default function PresetCard({ preset }: { preset: PresetCardData }) {
  return (
    <Link
      href={`/collection/${preset.slug}/`}
      className="group block"
      aria-label={`Xem ${preset.name}`}
    >
      {/* Thumbnail — gradient placeholder, aspect-[4/5] đồng bộ maume ProductCard */}
      <div className={`relative aspect-[4/5] overflow-hidden bg-gradient-to-br ${preset.accent}`}>
        {/* Overlay làm gradient nhạt hơn để text panel readable */}
        <div className="absolute inset-0 bg-white/10" />
        {/* Tỉ lệ tủ schematic — outline hình hộp theo aspect rộng/cao thật */}
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div
            className="border border-white/40 bg-white/5"
            style={{
              width: '70%',
              aspectRatio: `${preset.width} / ${preset.height}`,
              maxHeight: '75%',
            }}
            aria-hidden="true"
          />
        </div>
        {/* Category badge */}
        <span className="absolute top-3 left-3 text-[10px] font-semibold tracking-widest text-white/90 uppercase">
          {preset.category}
        </span>
      </div>

      {/* Meta block dưới ảnh */}
      <div className="mt-3">
        <h3 className="text-base md:text-lg font-bold tracking-tight text-neutral-900 group-hover:gradient-text transition-all">
          {preset.name}
        </h3>
        <p className="text-xs md:text-sm text-neutral-500 font-viet mt-0.5">{preset.usecase}</p>
        <div className="mt-2 flex items-baseline justify-between gap-2 text-xs text-neutral-600 font-viet tabular-nums">
          <span className="font-semibold text-neutral-900">{preset.priceFormatted}</span>
          <span>
            {preset.columns}×{preset.rows} · {preset.totalPanels} tấm
          </span>
        </div>
      </div>
    </Link>
  );
}
