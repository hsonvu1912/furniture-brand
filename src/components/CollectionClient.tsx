"use client";

// =============================================================================
// CollectionClient — filter + sort PRESETS theo URL state. Grid editorial.
// P83.5: thêm bộ chọn LOẠI TỦ (Tất cả / x / y) — lọc theo productSlug qua ?product=.
// =============================================================================
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import PresetCard, { type PresetCardData } from "./PresetCard";
import FilterBar from "./FilterBar";

export default function CollectionClient({
  presets,
  productLabels,
}: {
  presets: PresetCardData[];
  productLabels?: Record<string, string>;
}) {
  const searchParams = useSearchParams();
  const cat = searchParams.get("cat") || "";
  const sort = searchParams.get("sort") || "default";
  const product = searchParams.get("product") || ""; // '' = tất cả

  const visible = useMemo(() => {
    let list = [...presets];
    if (product) list = list.filter((p) => (p.productSlug ?? "tu-ke") === product);
    if (cat) list = list.filter((p) => p.category === cat);
    if (sort === "price-asc") {
      list.sort((a, b) => parsePrice(a.priceFormatted) - parsePrice(b.priceFormatted));
    } else if (sort === "price-desc") {
      list.sort((a, b) => parsePrice(b.priceFormatted) - parsePrice(a.priceFormatted));
    }
    return list;
  }, [presets, product, cat, sort]);

  const labels = productLabels ?? { "tu-ke": "Tủ kệ", "tu-y": "Mô-đun" };
  const hasTuY = presets.some((p) => p.productSlug === "tu-y");

  function productHref(slug: string): string {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) params.set("product", slug);
    else params.delete("product");
    const qs = params.toString();
    return qs ? `/collection?${qs}` : "/collection";
  }
  const chip = (slug: string, label: string) => {
    const active = product === slug;
    return (
      <Link
        href={productHref(slug)}
        className={`rounded-full border px-3 py-1 text-xs font-viet transition ${
          active ? "border-accent bg-accent text-white" : "border-accent/25 text-accent hover:border-accent/60"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <>
      {/* Bộ chọn loại tủ — chỉ hiện khi có ≥1 mẫu tủ y (tránh thừa khi chỉ có x). */}
      {hasTuY && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-accent/50 font-viet">Loại tủ</span>
          {chip("", "Tất cả")}
          {chip("tu-ke", labels["tu-ke"] ?? "Tủ kệ")}
          {chip("tu-y", labels["tu-y"] ?? "Mô-đun")}
        </div>
      )}
      <FilterBar />
      {visible.length === 0 ? (
        <div className="py-24 text-center">
          <p className="editorial-caption mb-4">Không tìm thấy</p>
          <p className="display-large text-accent display-italic">Không có mẫu nào phù hợp.</p>
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
