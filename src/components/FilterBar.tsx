"use client";

// =============================================================================
// FilterBar — regrocery pattern: text chips with underline-decoration for active.
// Mobile: sort dropdown. URL state sync.
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
    <div className="border-y border-[var(--color-line)] py-5 mb-10 md:mb-14">
      {/* Desktop + tablet */}
      <div className="hidden md:flex flex-wrap items-baseline gap-x-6 lg:gap-x-8 gap-y-3">
        <span className="editorial-caption mr-2">Loại</span>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => toggleCat(c.value)}
            className={`text-base md:text-lg whitespace-nowrap transition-opacity ${
              cat === c.value
                ? "text-accent font-medium underline underline-offset-[6px] decoration-2"
                : "text-accent/50 hover:text-accent/80"
            }`}
            aria-pressed={cat === c.value}
          >
            {c.label}
          </button>
        ))}

        <span className="w-px h-4 bg-[var(--color-line)] mx-3" aria-hidden />

        <span className="editorial-caption mr-2">Sắp xếp</span>
        {SORTS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setSort(s.value)}
            className={`text-base md:text-lg whitespace-nowrap transition-opacity ${
              sort === s.value
                ? "text-accent font-medium underline underline-offset-[6px] decoration-2"
                : "text-accent/50 hover:text-accent/80"
            }`}
            aria-pressed={sort === s.value}
          >
            {s.label}
          </button>
        ))}

        {(cat || (sort && sort !== "default")) && (
          <button
            type="button"
            onClick={() => {
              router.replace(pathname, { scroll: false });
            }}
            className="text-xs italic text-accent/60 hover:text-accent transition-colors ml-auto"
          >
            ← Reset
          </button>
        )}
      </div>

      {/* Mobile */}
      <div className="md:hidden flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
          <span className="editorial-caption mr-1">Loại</span>
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => toggleCat(c.value)}
              className={`text-base whitespace-nowrap ${
                cat === c.value
                  ? "text-accent font-medium underline underline-offset-[6px] decoration-2"
                  : "text-accent/50"
              }`}
              aria-pressed={cat === c.value}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-baseline gap-3">
          <span className="editorial-caption mr-1">Sắp xếp</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="text-base text-accent bg-transparent border-b border-[var(--color-accent)]/30 focus:border-accent focus:outline-none py-1"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {(cat || (sort && sort !== "default")) && (
            <button
              type="button"
              onClick={() => router.replace(pathname, { scroll: false })}
              className="text-xs italic text-accent/60 hover:text-accent transition-colors ml-auto"
            >
              ← Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
