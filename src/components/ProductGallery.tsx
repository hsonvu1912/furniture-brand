// =============================================================================
// ProductGallery — P34: gallery cho trang product (chi tiết preset).
// Ảnh LỚN + dải thumbnail nhỏ bấm chọn để xem đủ các góc render.
// 1 ảnh → chỉ hiện ảnh lớn (không strip).
// =============================================================================
"use client";
import { useState } from "react";

export default function ProductGallery({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const [active, setActive] = useState(0);
  const imgs = images.length > 0 ? images : [];
  const hasStrip = imgs.length > 1;

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      {/* Ảnh lớn chính */}
      <div className="relative aspect-[4/5] md:aspect-[4/4] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgs[active]}
          alt={alt}
          width={1020}
          height={1000}
          className="absolute inset-0 w-full h-full object-contain p-4 md:p-8"
          loading="eager"
        />
      </div>

      {/* Dải thumbnail bấm chọn */}
      {hasStrip && (
        <div className="flex flex-wrap gap-2 md:gap-3">
          {imgs.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Xem góc ${i + 1}`}
              aria-pressed={i === active}
              className={`relative aspect-square w-16 md:w-20 overflow-hidden rounded-lg border-2 transition ${
                i === active
                  ? "border-[var(--color-accent)]"
                  : "border-[var(--color-accent)]/15 hover:border-[var(--color-accent)]/40"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                aria-hidden
                width={160}
                height={160}
                className="absolute inset-0 w-full h-full object-contain p-1"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
