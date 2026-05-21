"use client";

// =============================================================================
// FilterBar — inline toggle chips theo pattern maume ShopClient (không sidebar).
// 5 chip category (Compact/Studio/Loft/Tall/Wide) + sort (Mới / Giá ↑↓).
// URL state sync /collection?cat=studio&sort=price-asc — pure client state.
//
// Pattern maume: text button toggles, active = text-black font-semibold,
// inactive = text-neutral-400. Click cùng chip lần 2 → bỏ filter (toggle off).
// =============================================================================
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

const CATEGORIES = [
  { value: "compact", label: "Compact" },
  { value: "studio", label: "Studio" },
  { value: "loft", label: "Loft" },
  { value: "tall", label: "Tall" },
  { value: "wide", label: "Wide" },
] as const;

const SORTS = [
  { value: "default", label: "Mặc định" },
  { value: "price-asc", label: "Giá ↑" },
  { value: "price-desc", label: "Giá ↓" },
] as const;

export default function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cat = searchParams.get("cat") || "";
  const sort = searchParams.get("sort") || "default";

  const updateUrl = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value) params.delete(key);
      else params.set(key, value);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  function toggleCat(next: string) {
    updateUrl("cat", cat === next ? "" : next);
  }
  function setSort(next: string) {
    updateUrl("sort", next === "default" ? "" : next);
  }

  return (
    <div className="border-y border-neutral-200 py-4 mb-8 md:mb-10">
      <div className="flex flex-wrap items-baseline gap-x-2 md:gap-x-4 gap-y-3">
        {/* Category chips */}
        <span className="text-xs uppercase tracking-widest text-neutral-400 font-semibold">
          Loại
        </span>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => toggleCat(c.value)}
            className={`text-sm whitespace-nowrap transition-colors ${
              cat === c.value
                ? "text-black font-semibold"
                : "text-neutral-400 hover:text-neutral-700"
            }`}
            aria-pressed={cat === c.value}
          >
            {c.label}
          </button>
        ))}

        {/* Divider */}
        <span className="w-px h-4 bg-neutral-200 mx-2 hidden md:inline-block" aria-hidden />

        {/* Sort */}
        <span className="text-xs uppercase tracking-widest text-neutral-400 font-semibold ml-auto md:ml-0">
          Sắp xếp
        </span>
        {SORTS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setSort(s.value)}
            className={`text-sm whitespace-nowrap transition-colors ${
              sort === s.value
                ? "text-black font-semibold"
                : "text-neutral-400 hover:text-neutral-700"
            }`}
            aria-pressed={sort === s.value}
          >
            {s.label}
          </button>
        ))}

        {/* Reset link khi có filter active */}
        {(cat || (sort && sort !== "default")) && (
          <button
            type="button"
            onClick={() => {
              router.replace(pathname, { scroll: false });
            }}
            className="text-xs italic text-neutral-400 hover:text-black transition-colors ml-auto"
          >
            ← Reset
          </button>
        )}
      </div>
    </div>
  );
}
