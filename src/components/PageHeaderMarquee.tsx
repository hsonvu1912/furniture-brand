"use client";

// =============================================================================
// PageHeaderMarquee — giant gradient title chạy marquee horizontal vô tận.
// Pattern: title quoted "Title Title Title..." lặp 12 lần với em-space separator,
// nhân đôi span để loop seamless. Mỗi page có colorOffset khác → gradient lệch
// vị trí cho mỗi page nhận diện được.
// Port từ maume PageHeaderMarquee.
// =============================================================================
import Link from "next/link";

export default function PageHeaderMarquee({
  title,
  subtitle,
  colorOffset = 0,
  separatorEm = 2,
  href,
}: {
  title: string;
  subtitle?: React.ReactNode;
  colorOffset?: number;
  separatorEm?: number;
  href?: string;
}) {
  const full = Math.floor(separatorEm);
  const hasHalf = separatorEm % 1 >= 0.5;
  const sep = " ".repeat(full) + (hasHalf ? " " : "");
  const quoted = `“${title}”`;
  const text = Array(12).fill(quoted).join(sep) + sep;

  const marquee = (
    <div className="page-header-marquee">
      <span className="page-header-content" style={{ backgroundPositionX: `${colorOffset}%` }}>
        {text}
      </span>
      <span
        className="page-header-content"
        aria-hidden="true"
        style={{ backgroundPositionX: `${colorOffset}%` }}
      >
        {text}
      </span>
    </div>
  );

  return (
    <div className="mb-2 md:mb-5 overflow-hidden">
      {href ? (
        <Link href={href} className="block hover:opacity-70 transition-opacity">
          {marquee}
        </Link>
      ) : (
        marquee
      )}
      {subtitle && <p className="text-sm text-neutral-400 mt-2 font-viet">{subtitle}</p>}
    </div>
  );
}
