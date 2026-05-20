// =============================================================================
// KeLogo — wordmark "KÊ. by màumè". Gradient màumè full (cả 2 dòng).
// Dùng trong Header (md), Footer (sm). Wrap `.logo-link` để hover animation
// chạy gradient-shift (định nghĩa ở globals.css).
// `w-fit` để subtext "by màumè" KHÔNG stretch theo width container — gọn lại
// đúng width của text dài nhất.
// =============================================================================
type Size = "sm" | "md" | "lg";

const SIZE: Record<Size, { ke: string; by: string; gap: string }> = {
  sm: { ke: "text-2xl", by: "text-[10px]", gap: "-mt-0.5" },
  md: { ke: "text-3xl md:text-4xl", by: "text-xs md:text-sm", gap: "-mt-1" },
  lg: { ke: "text-6xl md:text-7xl", by: "text-base md:text-lg", gap: "-mt-2" },
};

export default function KeLogo({ size = "md" }: { size?: Size }) {
  const s = SIZE[size];
  return (
    <span className="inline-flex flex-col items-start leading-none w-fit">
      <span className={`${s.ke} font-extrabold tracking-tight gradient-text logo-hover`}>
        KÊ.
      </span>
      <span className={`${s.by} ${s.gap} font-medium tracking-tight gradient-text logo-hover self-end`}>
        by màumè
      </span>
    </span>
  );
}
