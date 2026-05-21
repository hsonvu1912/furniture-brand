// =============================================================================
// PresetCard — 1 mẫu trong grid /collection. Hiển thị ảnh render 3D thật từ
// /public/presets/<slug>.png (Three.js capture). Pattern hover/typography port
// từ maume ProductCard: aspect-[4/5] · object-cover · group-hover:scale-105
// transition-transform duration-700 · brand uppercase tracking-wider · name
// underline-on-hover · price font-viet.
// =============================================================================
import Link from "next/link";

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
}

export default function PresetCard({ preset }: { preset: PresetCardData }) {
  return (
    <Link
      href={`/collection/${preset.slug}/`}
      className="group block"
      aria-label={`Xem ${preset.name}`}
    >
      {/* Image — render 3D thật, aspect-[4/5] object-cover crop center.
          Fallback gradient nếu file missing (giai đoạn dev). */}
      <div className="relative aspect-[4/5] overflow-hidden bg-neutral-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/presets/${preset.slug}.png`}
          alt={`${preset.name} — tủ kệ ${preset.usecase}`}
          width={1020}
          height={1000}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          loading="lazy"
        />
        {/* Category badge — pattern maume top-3 left-3 */}
        <div className="absolute top-3 left-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest bg-white/90 backdrop-blur-sm text-neutral-800 px-2 py-1">
            {preset.category}
          </span>
        </div>
      </div>

      {/* Info block — pattern maume `mt-3 space-y-1`: brand label uppercase
          tracking-wider + name underline-on-hover + meta line tabular-nums. */}
      <div className="mt-3 space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 font-viet">
          {preset.usecase}
        </p>
        <h3 className="text-sm font-bold text-black leading-snug group-hover:underline underline-offset-2">
          {preset.name}
        </h3>
        <p className="text-sm font-viet text-black tabular-nums">
          {preset.priceFormatted}
          <span className="text-neutral-400 ml-2 text-xs">
            {preset.columns}×{preset.rows} · {preset.totalPanels} tấm
          </span>
        </p>
      </div>
    </Link>
  );
}
