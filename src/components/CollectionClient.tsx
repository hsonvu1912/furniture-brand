"use client";

// =============================================================================
// CollectionClient — filter + sort PRESETS theo URL state. Grid editorial.
// =============================================================================
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import PresetCard, { type PresetCardData } from "./PresetCard";
import FilterBar from "./FilterBar";

export default function CollectionClient({ presets }: { presets: PresetCardData[] }) {
  const searchParams = useSearchParams();
  const cat = searchParams.get("cat") || "";
  const sort = searchParams.get("sort") || "default";

  const visible = useMemo(() => {
    let list = [...presets];
    if (cat) list = list.filter((p) => p.category === cat);
    if (sort === "price-asc") {
      list.sort((a, b) => parsePrice(a.priceFormatted) - parsePrice(b.priceFormatted));
    } else if (sort === "price-desc") {
      list.sort((a, b) => parsePrice(b.priceFormatted) - parsePrice(a.priceFormatted));
    }
    return list;
  }, [presets, cat, sort]);

  return (
    <>
      <FilterBar />
      {visible.length === 0 ? (
        <div className="py-24 text-center">
          <p className="editorial-caption mb-4">Không tìm thấy</p>
          <p className="display-large text-accent display-italic">
            Không có mẫu nào phù hợp.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 lg:gap-10">
          {visible.map((p) => (
            <PresetCard key={p.slug} preset={p} />
          ))}
        </div>
      )}
    </>
  );
}

function parsePrice(formatted: string): number {
  return Number(formatted.replace(/[^\d]/g, ""));
}
