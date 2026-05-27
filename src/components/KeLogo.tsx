// =============================================================================
// KeLogo — wordmark "kê_" + "by màumè" (regrocery "re_" pattern, simple text).
// Color accent orange-red, không gradient. Hover: opacity drop.
// =============================================================================
type Size = "sm" | "md" | "lg" | "giant";

const SIZE: Record<Size, { ke: string; by: string; gap: string }> = {
  sm: { ke: "text-xl", by: "text-[10px]", gap: "ml-1.5" },
  md: { ke: "text-2xl md:text-3xl", by: "text-xs md:text-sm", gap: "ml-1.5 md:ml-2" },
  lg: { ke: "text-5xl md:text-6xl", by: "text-base md:text-lg", gap: "ml-2 md:ml-3" },
  giant: { ke: "text-[8rem] md:text-[14rem] lg:text-[22rem]", by: "text-2xl md:text-3xl", gap: "ml-4" },
};

export default function KeLogo({ size = "md" }: { size?: Size }) {
  const s = SIZE[size];
  return (
    <span className="inline-flex items-baseline leading-none w-fit text-accent">
      <span className={`${s.ke} font-medium tracking-tight transition-opacity hover:opacity-60`}>
        kê_
      </span>
      <span className={`${s.by} ${s.gap} font-medium tracking-tight opacity-70`}>
        by màumè
      </span>
    </span>
  );
}
