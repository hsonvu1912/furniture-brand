// =============================================================================
// HomeFeatured — section "Bộ sưu tập" giant heading + grid 3 cols cards.
// =============================================================================
import Link from "next/link";
import type { Preset } from "../../products/tu-ke/presets";
import type { PriceConfig } from "@/configurator/types";
// P88 — DÙNG CHUNG với /collection: build card-data theo ĐÚNG loại tủ (getDNA) →
// tủ y ra giá + thông số đúng (trước copy cũ hardcode tu-ke → sai giá/grid tủ y).
import { buildPresetCardData } from "@/lib/preset-card";
import PresetCard from "./PresetCard";

// P33: nhận presets (KV, KÈM thumbnail) + priceConfig TỪ PAGE (trang chủ fetch ở
// page-level — nơi getCloudflareContext còn context).
export default function HomeFeatured({
  presets: rawPresets,
  priceConfig,
}: {
  presets: Preset[];
  priceConfig: PriceConfig;
}) {
  const presets = buildPresetCardData(rawPresets, priceConfig);

  return (
    <section className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-12 py-20 md:py-28 lg:py-32">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12 md:mb-16 lg:mb-20 gap-6">
        <h2 className="display-huge text-accent display-italic leading-[0.95]">
          Bộ sưu tập
        </h2>
        <Link
          href="/collection"
          className="pill-outline self-start md:self-end shrink-0"
        >
          Xem tất cả →
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-x-6 gap-y-12 md:gap-x-8 md:gap-y-16 lg:gap-x-10 lg:gap-y-20">
        {presets.map((preset) => (
          <PresetCard key={preset.slug} preset={preset} />
        ))}
      </div>
    </section>
  );
}
