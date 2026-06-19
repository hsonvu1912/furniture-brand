// =============================================================================
// CategoryList — centered giant list. P46: phân loại theo LOẠI TỦ công năng
// (7 danh mục), import từ nguồn duy nhất presets.ts.
// =============================================================================
import Link from "next/link";
import { CATEGORIES } from "../../products/tu-ke/presets";

export default function CategoryList() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-12 py-20 md:py-28 lg:py-36 text-center">
      <p className="editorial-caption mb-8 md:mb-12">Khám phá theo loại tủ</p>
      <ul className="space-y-1 md:space-y-2 lg:space-y-3">
        {CATEGORIES.map((c) => (
          <li key={c.value}>
            <Link
              href={`/collection?cat=${c.value}`}
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
