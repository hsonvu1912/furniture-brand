// =============================================================================
// PresetCard — card preset: ảnh tủ large + title italic overlay + meta dưới.
// P34: CLIENT component — hỗ trợ ĐA ẢNH (thumbnails[]):
//   - Random ảnh CHÍNH lúc mount (client → tránh hydration mismatch).
//   - Rê chuột (group-hover) → crossfade sang ảnh THỨ 2 (random khác).
//   - 1 ảnh → không swap (hiển thị bình thường).
// P83.5: đa loại tủ — preset tu-y (y) link thẳng /design?product=tu-y, có huy hiệu
//   "y", và khi CHƯA có ảnh thật → ô placeholder gradient (không gọi ảnh 404).
// =============================================================================
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { assetUrl } from "@/lib/asset-url";

export interface PresetCardData {
  slug: string;
  name: string;
  usecase: string;
  category: string;
  accent: string;
  /** P83.5 — 'tu-ke' (x) | 'tu-y' (y). Quyết link + huy hiệu + meta. */
  productSlug?: string;
  priceFormatted: string;
  totalPanels: number;
  columns: number;
  rows: number;
  width: number;
  height: number;
  thumbnail?: string;
  /** P34: nhiều góc render. Ưu tiên hơn `thumbnail` cho hover-swap. */
  thumbnails?: string[];
}

export default function PresetCard({ preset }: { preset: PresetCardData }) {
  const cleanName = preset.name.replace(/^(kê|ngăn)\.?\s*/i, "");
  const isTuY = preset.productSlug === "tu-y";
  // P88.1 — CẢ x lẫn y vào TRANG CHI TIẾT /collection/[slug] (tủ y giờ có trang riêng);
  // từ đó bấm "Thiết kế tủ này" mới mở configurator. (Trước tủ y nhảy thẳng /design → bỏ qua
  // trang detail + không thấy ảnh decor.)
  const href = `/collection/${preset.slug}/`;

  // Có ảnh thật? (thumbnails[] đa góc / thumbnail 1 ảnh). KHÔNG có → placeholder gradient.
  const hasImg = (preset.thumbnails?.length ?? 0) > 0 || !!preset.thumbnail;
  const imgs =
    preset.thumbnails && preset.thumbnails.length > 0
      ? preset.thumbnails
      : preset.thumbnail
        ? [preset.thumbnail]
        : [assetUrl(`/presets/${preset.slug}.png`)];

  // SSR render index 0 (ổn định, tránh mismatch); client mount → random.
  const [primary, setPrimary] = useState(0);
  const [secondary, setSecondary] = useState(imgs.length > 1 ? 1 : 0);
  useEffect(() => {
    if (imgs.length <= 1) return;
    const p = Math.floor(Math.random() * imgs.length);
    let s = Math.floor(Math.random() * imgs.length);
    if (s === p) s = (s + 1) % imgs.length; // ảnh hover KHÁC ảnh chính
    setPrimary(p);
    setSecondary(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgs.length, preset.slug]);

  const hasSwap = hasImg && imgs.length > 1;
  const aspect = preset.width > 0 && preset.height > 0 ? `${preset.width} / ${preset.height}` : "1 / 1";

  return (
    <Link href={href} className="group block" aria-label={`Xem ${preset.name}`}>
      <div className="relative aspect-[4/5] overflow-hidden">
        {/* P88 — bỏ badge loại tủ trên card (founder chốt): card x/y nhìn như nhau;
            phân biệt loại chỉ qua BỘ LỌC ở /collection. */}
        {hasImg ? (
          <>
            {/* Ảnh chính — rê chuột thì mờ đi để lộ ảnh thứ 2 (nếu có nhiều ảnh). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgs[primary]}
              alt={`${preset.name} — tủ ${preset.usecase}`}
              width={1020}
              height={1000}
              className={`absolute inset-0 w-full h-full object-contain transition-[opacity,transform] duration-500 ease-out group-hover:scale-[1.02] ${
                hasSwap ? "group-hover:opacity-0" : ""
              }`}
              loading="lazy"
            />
            {hasSwap && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgs[secondary]}
                alt=""
                aria-hidden
                width={1020}
                height={1000}
                className="absolute inset-0 w-full h-full object-contain opacity-0 transition-[opacity,transform] duration-500 ease-out group-hover:opacity-100 group-hover:scale-[1.02]"
                loading="lazy"
              />
            )}
          </>
        ) : (
          // P83.5 — chưa có ảnh render → ô gradient + khung sơ đồ theo tỉ lệ phủ bì.
          <div className={`absolute inset-0 bg-gradient-to-br ${preset.accent} transition-transform duration-500 ease-out group-hover:scale-[1.02]`}>
            <div className="absolute inset-0 bg-white/10" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="border-2 border-white/60" style={{ width: "55%", aspectRatio: aspect, maxHeight: "70%" }} />
            </div>
          </div>
        )}
      </div>

      <h3 className="mt-3 display-italic text-accent text-2xl md:text-3xl leading-[1.0] tracking-tight">
        {cleanName}
      </h3>

      <div className="mt-2 flex items-baseline justify-between gap-3">
        <div>
          <p className="text-sm text-accent font-medium font-viet tabular-nums">{preset.priceFormatted}</p>
          <p className="text-[11px] text-accent/60 font-viet mt-0.5">{preset.usecase}</p>
        </div>
        <p className="text-[11px] text-accent/60 font-viet tabular-nums shrink-0">
          {isTuY
            ? `${preset.totalPanels} tấm`
            : `${preset.columns}×${preset.rows} · ${preset.totalPanels} tấm`}
        </p>
      </div>
    </Link>
  );
}
