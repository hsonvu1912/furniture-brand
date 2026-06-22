// =============================================================================
// /design — Configurator full-screen. Server component đọc preset từ KV theo
// ?preset=<slug>; pass initialValues + mode xuống DesignClient (client) vì
// Three.js cần API trình duyệt nên Configurator phải dynamic import ssr:false.
// =============================================================================
import { findPreset } from "@/lib/presets-store";
import {
  catalogToPriceConfig,
  enabledMaterialsForDna,
  getProductionCatalog,
} from "@/lib/production-catalog";
import { decodeConfig } from "@/configurator/share-config";
import DesignClient from "./DesignClient";

interface PageProps {
  searchParams: Promise<{ preset?: string; mode?: string; product?: string; c?: string }>;
}

export default async function DesignPage({ searchParams }: PageProps) {
  const { preset: slug, mode: modeParam, product: productParam, c } = await searchParams;
  // MUUTO — ?c=<mã> là cấu hình CHIA SẺ (đã encode values+product). Ưu tiên hơn preset;
  // hỏng/vắng → null → fallback preset KV. (decodeConfig không đụng window → an toàn server.)
  const shared = decodeConfig(c);
  const preset = await findPreset(slug);
  // P83: chọn trình dựng theo ?c=/?product= HOẶC theo loại tủ của preset đã nạp (robust:
  // /design?preset=y-* vẫn ra trình dựng y dù thiếu &product). Vắng cả → tu-ke.
  const productSlug =
    shared?.p === "tu-y" || productParam === "tu-y" || preset?.productSlug === "tu-y" ? "tu-y" : "tu-ke";
  const initialValues = shared?.v ?? preset?.values;
  // Default 'public' cho user end (ẩn ExportConfig dev tool). Override:
  //   ?mode=interactive  → dev/founder testing (hiện cả ExportConfigButton)
  //   ?mode=screenshot   → capture thumbnail
  const mode =
    modeParam === "screenshot"
      ? "screenshot"
      : modeParam === "record"
        ? "record"
        : modeParam === "interactive"
          ? "interactive"
          : "public";
  const presetMeta = preset ? { slug: preset.slug, name: preset.name } : undefined;
  // Catalog từ KV → PriceConfig (giá live) + danh sách màu được bật cho "tu-ke"
  // (màu tắt sẽ bị Configurator ẩn khỏi bảng chọn).
  const catalog = await getProductionCatalog();
  const priceConfig = catalogToPriceConfig(catalog);
  const enabledMaterials = enabledMaterialsForDna(catalog, productSlug);

  return (
    <main className="h-[100dvh] w-screen">
      <DesignClient
        productSlug={productSlug}
        initialValues={initialValues}
        mode={mode}
        presetMeta={presetMeta}
        priceConfig={priceConfig}
        enabledMaterials={enabledMaterials}
      />
    </main>
  );
}
