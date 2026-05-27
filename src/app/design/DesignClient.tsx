"use client";
// =============================================================================
// DesignClient — client wrapper cho Configurator. Three.js cần WebGL nên phải
// dynamic import ssr:false. Nhận initialValues + mode từ server component
// (đã đọc KV xong); engine bất biến.
// =============================================================================
import dynamic from "next/dynamic";
import tuKe from "../../../products/tu-ke/dna";
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

interface Props {
  initialValues: ParamValues | undefined;
  mode: "interactive" | "screenshot" | "public";
  presetMeta?: { slug?: string; name?: string };
  priceConfig?: PriceConfig;
  enabledMaterials?: string[];
}

export default function DesignClient({
  initialValues,
  mode,
  presetMeta,
  priceConfig,
  enabledMaterials,
}: Props) {
  return (
    <Configurator
      dna={tuKe}
      initialValues={initialValues}
      mode={mode}
      presetMeta={presetMeta}
      priceConfig={priceConfig}
      enabledMaterials={enabledMaterials}
    />
  );
}
