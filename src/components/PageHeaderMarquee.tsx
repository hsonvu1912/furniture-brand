"use client";

// =============================================================================
// PageHeaderMarquee — GIANT gradient marquee (regrocery hero scale).
// Cỡ chữ massive 48-144px qua CSS .page-header-content clamp.
// =============================================================================
import Link from "next/link";

export default function PageHeaderMarquee({
  title,
  subtitle,
  colorOffset = 0,
  separatorEm = 1.5,
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
  const sep = " ".repeat(full) + (hasHalf ? " " : "");
  const text = Array(8).fill(title).join(sep) + sep;

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
    <div className="mb-10 md:mb-14 lg:mb-16 overflow-hidden">
      {href ? (
        <Link href={href} className="block hover:opacity-70 transition-opacity">
          {marquee}
        </Link>
      ) : (
        marquee
      )}
      {subtitle && (
        <p className="text-base md:text-lg text-accent mt-4 md:mt-6 font-viet max-w-2xl leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
