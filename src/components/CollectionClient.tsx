"use client";

// =============================================================================
// CollectionClient — filter + sort PRESETS theo URL state. FilterBar quản lý
// URL params; component đọc params, filter list, render grid.
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
    // Sort price (default = thứ tự gốc trong PRESETS)
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
        <div className="py-16 text-center text-neutral-400 font-viet">
          Không có mẫu nào phù hợp.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10 md:gap-y-12">
          {visible.map((p) => (
            <PresetCard key={p.slug} preset={p} />
          ))}
        </div>
      )}
    </>
  );
}

/** Parse "8.160.145₫" → 8160145 (số nguyên VND) để sort. */
function parsePrice(formatted: string): number {
  return Number(formatted.replace(/[^\d]/g, ""));
}
