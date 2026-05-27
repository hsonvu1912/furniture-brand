// =============================================================================
// CategoryList — centered giant list. Context khác với HomeFeatured/Hero:
// phân loại theo USE CASE (phòng/dùng) thay vì preset names.
// =============================================================================
import Link from "next/link";

const CATEGORIES = [
  { query: "cat=studio", label: "Tủ phòng khách" },
  { query: "cat=compact", label: "Tủ phòng nhỏ" },
  { query: "cat=loft", label: "Tủ phòng ngủ" },
  { query: "cat=tall", label: "Tủ góc cầu thang" },
  { query: "cat=wide", label: "Tủ TV thấp" },
];

export default function CategoryList() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-12 py-20 md:py-28 lg:py-36 text-center">
      <p className="editorial-caption mb-8 md:mb-12">Khám phá theo không gian</p>
      <ul className="space-y-1 md:space-y-2 lg:space-y-3">
        {CATEGORIES.map((c) => (
          <li key={c.label}>
            <Link
              href={`/collection?${c.query}`}
              className="display-huge text-accent display-italic inline-block hover:opacity-60 transition-opacity leading-[1]"
            >
              {c.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-12 md:mt-16">
        <Link href="/design" className="pill-outline">
          Hoặc thiết kế riêng →
        </Link>
      </div>
    </section>
  );
}
