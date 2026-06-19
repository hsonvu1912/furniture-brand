"use client";
// =============================================================================
// DesignClient — client wrapper. Three.js cần WebGL nên dynamic import ssr:false.
// P83: phân nhánh theo ?product — tu-y → YConfigurator (Loại 2, module hộp rời);
// còn lại → Configurator (Loại 1, tu-ke) GIỮ NGUYÊN. 2 trình dựng TÁCH HẲN.
// =============================================================================
import dynamic from "next/dynamic";
import { useEffect } from "react";
import tuKe from "../../../products/tu-ke/dna";
import { PRESETS } from "../../../products/tu-ke/presets";
import tuY from "../../../products/tu-y/dna";
import { encodeCellGrid } from "@/configurator/cellgrid";
import type { ParamValues, PriceConfig } from "@/configurator/types";

const Configurator = dynamic(
  () => import("@/configurator/Configurator").then((m) => m.Configurator),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-[var(--color-ink-3)] font-viet">
        Đang tải trình dựng 3D…
      </div>
    ),
  },
);

const YConfigurator = dynamic(
  () => import("@/configurator/YConfigurator").then((m) => m.YConfigurator),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-[var(--color-ink-3)] font-viet">
        Đang tải trình dựng 3D…
      </div>
    ),
  },
);

interface Props {
  productSlug: string;
  initialValues: ParamValues | undefined;
  mode: "interactive" | "screenshot" | "public" | "record";
  presetMeta?: { slug?: string; name?: string };
  priceConfig?: PriceConfig;
  enabledMaterials?: string[];
}

export default function DesignClient({
  productSlug,
  initialValues,
  mode,
  presetMeta,
  priceConfig,
  enabledMaterials,
}: Props) {
  // Record mode (clip 15s) CHỈ cho tu-ke: phơi preset đã mã hoá lên window cho
  // Playwright. tu-y chưa có record flow.
  useEffect(() => {
    if (mode !== "record" || productSlug !== "tu-ke") return;
    const w = window as unknown as {
      __kePresets?: Record<string, ParamValues>;
      __keEncodeCells?: (typeGrid: string[][], colorGrid?: string[][]) => { cells: string; cellColors: string };
    };
    w.__kePresets = Object.fromEntries(PRESETS.map((p) => [p.slug, p.values]));
    w.__keEncodeCells = (typeGrid, colorGrid) => ({
      cells: encodeCellGrid(typeGrid),
      cellColors: encodeCellGrid(colorGrid ?? typeGrid.map((row) => row.map(() => "frame"))),
    });
    return () => {
      delete w.__kePresets;
      delete w.__keEncodeCells;
    };
  }, [mode, productSlug]);

  // tu-y (Loại 2) → trình dựng RIÊNG. mode 'admin' chỉ FB nội bộ; YConfigurator
  // nhận 'interactive'|'public'|'admin'.
  if (productSlug === "tu-y") {
    return (
      <YConfigurator
        dna={tuY}
        initialValues={initialValues}
        mode={mode === "interactive" ? "interactive" : "public"}
        presetMeta={presetMeta}
        priceConfig={priceConfig}
        enabledMaterials={enabledMaterials}
        homeHref="/"
      />
    );
  }

  return (
    <Configurator
      dna={tuKe}
      initialValues={initialValues}
      mode={mode}
      presetMeta={presetMeta}
      priceConfig={priceConfig}
      enabledMaterials={enabledMaterials}
      homeHref="/"
    />
  );
}
