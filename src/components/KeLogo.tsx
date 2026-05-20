// =============================================================================
// KeLogo — wordmark "KÊ. by màumè". Cabinet Grotesk Black (weight 900) cho
// "KÊ.", Medium (500) cho "by màumè". Layout HORIZONTAL baseline-align: "KÊ."
// lớn bên trái + "by màumè" nhỏ ngay bên cạnh phải (cùng đường base). Gradient
// màumè full cả 2. Hover animation chạy gradient-shift.
// =============================================================================
type Size = "sm" | "md" | "lg";

const SIZE: Record<Size, { ke: string; by: string; gap: string }> = {
  sm: { ke: "text-2xl", by: "text-[10px]", gap: "ml-1" },
  md: { ke: "text-3xl md:text-4xl", by: "text-xs md:text-sm", gap: "ml-1.5 md:ml-2" },
  lg: { ke: "text-6xl md:text-7xl", by: "text-base md:text-lg", gap: "ml-2 md:ml-3" },
};

export default function KeLogo({ size = "md" }: { size?: Size }) {
  const s = SIZE[size];
  return (
    <span className="inline-flex items-baseline leading-none w-fit">
      <span className={`${s.ke} font-black tracking-tight gradient-text logo-hover`}>
        KÊ.
      </span>
      <span className={`${s.by} ${s.gap} font-medium tracking-tight gradient-text logo-hover`}>
        by màumè
      </span>
    </span>
  );
}
