# P95 — Redesign YConfigurator theo ngôn ngữ thiết kế tủ x

Nguồn: workflow audit 7-agent (2026-06-18). Tủ x (`Configurator.tsx`) = BẤT BIẾN, chỉ học. Chỉ sửa
`src/configurator/YConfigurator.tsx` (FB) + mirror `maume/src/lib/ke/configurator/YConfigurator.tsx`.
KHÔNG đụng engine/dna/giá/logic — chỉ UI/className/cấu trúc + vài state UI thuần.

## Quyết định founder
- Phạm vi: **Pha 0–4**, GIỮ sidebar cuộn dọc (KHÔNG tab bar — Pha 5 bỏ).
- Giá + Đặt hàng: **NỔI trên viewport** (OrderBar như tủ x).
- Cảnh báo/toast: **tone cam (accent)**.
- Tinh chỉnh: **swatch vân gỗ thật** (swatchCss) + **toggle bật/tắt kích thước tổng** + **thêm email/địa chỉ** vào form đặt hàng.

## Ngôn ngữ thiết kế tủ x (codify)
- **Màu**: accent cam `#f74c25` = ink chủ đạo. Thang: `text-[var(--color-accent)]` nhấn · `/70` label · `/60` section-heading · `/55` panel · `/45` meta. Viền control `border-[var(--color-accent)]/12→/20` (KHÔNG `--color-line`). Surface con `bg-[var(--color-surface-2)]/35`; segmented nền `bg-[var(--color-surface-2)]`; input/active `bg-[var(--color-accent-bg)]` #fde7df. Hover CTA `hover:bg-[var(--color-accent-hover)]`. Panel tối `bg-[var(--color-ink)] text-white` nhưng nhãn con vẫn `text-[var(--color-accent)]/60`. Cảnh báo: `border-[var(--color-accent)]/40 bg-[var(--color-accent-bg)]/95 text-[var(--color-accent)]`. (KHÔNG có token `--color-bg-2`.)
- **Typography**: heading `.display-italic text-accent text-4xl lg:text-5xl leading-[0.95] tracking-tight` (Lora italic). Kicker `.editorial-caption` (11px uppercase tracking .15em accent). Label/prose tiếng Việt `font-viet leading-relaxed`. Section heading `text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]/60`. Giá `display-italic text-accent tabular-nums`.
- **Layout**: root `relative h-full w-full flex flex-col-reverse md:flex-row`. Sidebar `shrink-0 flex flex-col gap-5 max-md:gap-1.5 overflow-y-auto bg-[var(--color-bg)] p-5 max-md:px-3 max-md:py-2 text-[var(--color-ink)] max-md:h-[38dvh] md:h-full md:w-[340px] md:border-r md:border-[var(--color-accent)]/20`. Viewport `relative min-h-0 flex-1 max-md:h-[56dvh]`. Card `rounded-xl border border-[var(--color-accent)]/15 bg-[var(--color-surface-2)]/35 p-2.5`. Header `<header className="max-md:hidden pb-2 border-b border-[var(--color-accent)]/15">`.
- **Component**: segmented container `inline-flex w-full rounded-lg bg-[var(--color-surface-2)] p-0.5`, nút `flex-1 px-3 py-1.5 text-xs font-medium rounded-md`, active `bg-[var(--color-accent)] text-white shadow-sm`, inactive `text-[var(--color-accent)]/70 hover:text-[var(--color-accent)]` (font-weight CỐ ĐỊNH, +aria-pressed). Card/pill chọn = **FILL-active**: active `bg-[var(--color-accent)] text-white`, inactive `bg-[var(--color-surface-2)] text-[var(--color-accent)] hover:bg-[var(--color-accent-bg)]`. Swatch nút `h-4 w-6 rounded border border-black/10` + `swatchCss()`. CTA `rounded-full bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-white shadow-md hover:bg-[var(--color-accent-hover)]`. Nút tròn nổi `w-9 h-9 rounded-full bg-[var(--color-bg)]/90 backdrop-blur shadow-md text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white disabled:opacity-40` + SVG + aria-label. Modal: createPortal, overlay z-[100], panel `bg-[var(--color-bg)] rounded-lg max-w-md`.

## Checklist (đánh dấu khi xong)
- [ ] Pha 0 — token sweep: sidebar/viewport/root/card class chuẩn x; 5 H2→accent/60; link/prose→accent + font-viet; bug `--color-bg-2`→surface-2; panel giá nhãn→accent/60.
- [ ] Pha 1 — header editorial (`<header>` + editorial-caption + h1 display-italic + hint) ; giá display-italic; dialog title.
- [ ] Pha 2 — nút kích thước/thuộc tính/tay nắm OUTLINE→FILL; segmented chung/riêng chuẩn +aria-pressed; swatchHex→swatchCss vân gỗ; nút Xoá/cảnh báo ô bay→accent.
- [ ] Pha 3 — OrderBar nổi viewport (giá + nút Đặt hàng); OrderDialog editorial (portal z-100, summary, label accent, +email/địa chỉ); warning box→accent; toast→accent.
- [ ] Pha 4 — nút tròn nổi undo + toggle showTotalDims (state mới, truyền showOuter); hint pill !selectedId; nút Lưu preset→accent; EdgeAddButtons bỏ scale-110/font-bold; halo đọc accent.
- [ ] Verify FB tsc + browser DOM; mirror maume; tsc maume; → founder deploy 2 worker.

## Tái dùng từ tủ x (line ref Configurator.tsx)
aside 2168-9 · viewport 2364 · header 2172-89 · OrderBar 3830-76 · OrderDialog 3941-4076 · nút tròn nổi 2378-2409 · hint pill 2424-39 · segmented 3094-3107 · fill-active 3068-72 · swatchCss 84 · warning accent 2412-23/4059.
