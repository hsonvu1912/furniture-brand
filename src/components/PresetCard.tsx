// =============================================================================
// PresetCard — regrocery exact pattern (re-analyzed Rev3).
// Card đơn giản: ảnh tủ large top trên cream BG · title BIG italic overlay
// bottom (chữ overlap with image) · price + meta dưới card.
// KHÔNG pastel bg · KHÔNG mix-blend · KHÔNG border.
// =============================================================================
import Link from "next/link";
import { assetUrl } from "@/lib/asset-url";

export interface PresetCardData {
  slug: string;
  name: string;
  usecase: string;
  category: string;
  accent: string;
  priceFormatted: string;
  totalPanels: number;
  columns: number;
  rows: number;
  width: number;
  height: number;
  thumbnail?: string;
}

export default function PresetCard({ preset }: { preset: PresetCardData }) {
  const cleanName = preset.name.replace(/^KÊ\.\s*/, "");
  return (
    <Link
      href={`/collection/${preset.slug}/`}
      className="group block"
      aria-label={`Xem ${preset.name}`}
    >
      {/* Image container: cream bg (= page bg), no border. Ảnh tủ large.
          Title overlay bottom-left, chữ có thể đè vào ảnh (regrocery style). */}
      <div className="relative aspect-[4/5] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preset.thumbnail ?? assetUrl(`/presets/${preset.slug}.png`)}
          alt={`${preset.name} — tủ kệ ${preset.usecase}`}
          width={1020}
          height={1000}
          className="absolute inset-0 w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-700 ease-out"
          loading="lazy"
        />
        {/* Title overlay bottom — italic GIANT, can overlap with image */}
        <h3 className="absolute bottom-3 left-3 right-3 display-italic text-accent text-3xl md:text-4xl lg:text-5xl leading-[0.95] tracking-tight pointer-events-none">
          {cleanName}
        </h3>
      </div>

      {/* Meta line below card */}
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <div>
          <p className="text-sm text-accent font-medium font-viet tabular-nums">
            {preset.priceFormatted}
          </p>
          <p className="text-[11px] text-accent/60 font-viet mt-0.5">
            {preset.usecase}
          </p>
        </div>
        <p className="text-[11px] text-accent/60 font-viet tabular-nums shrink-0">
          {preset.columns}×{preset.rows} · {preset.totalPanels} tấm
        </p>
      </div>
    </Link>
  );
}
