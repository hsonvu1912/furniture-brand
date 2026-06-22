// =============================================================================
// configurator/ui/tokens.ts — chuỗi className DÙNG CHUNG cho 2 config (P96).
// Không tạo token CSS mới (globals .config-muuto đã chung) — chỉ gom các chuỗi
// className lặp ≥3 lần để primitive tiêu thụ, tránh drift giữa tủ x ↔ tủ y.
// MUUTO redesign: panel PHẢI (border-l), viền mảnh trắng, nhãn IN HOA, +toolbar/commerce/topbar.
// =============================================================================

/** Sidebar (drawer) — desktop 340px BÊN PHẢI (border-l), mobile bottom-sheet 40dvh. */
export const SIDEBAR =
  'shrink-0 flex flex-col gap-3 max-md:gap-1.5 overflow-y-auto bg-[var(--color-bg)] p-4 max-md:px-3 max-md:py-2 text-[var(--color-ink)] max-md:h-[40dvh] md:h-full md:w-[340px] md:border-l md:border-[var(--color-line)]';

/** Viewport 3D — chừa min-h-0 + mobile 50dvh (panel 40 + canvas 50 + chrome ~10 = 1 dvh). */
export const VIEWPORT = 'relative min-h-0 flex-1 max-md:h-[50dvh]';

/** Thẻ nhóm điều khiển — viền mảnh, nền trắng (MUUTO). */
export const CARD = 'rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3';

/** Tiêu đề mục — MUUTO: IN HOA giãn chữ (.muuto-label), màu ink. Đồng bộ 2 config. */
export const SECTION_HEADING = 'muuto-label text-[var(--color-ink)]';

/** Segmented control — vỏ nền surface-2 (xám nhạt). */
export const SEGMENTED_WRAP = 'inline-flex w-full rounded-md bg-[var(--color-surface-2)] p-0.5';
/** Segmented vỏ nền --color-bg (giữ baseline tủ x: tier-steps Cao/Rộng). */
export const SEGMENTED_WRAP_BG = 'inline-flex w-full rounded-md bg-[var(--color-surface-2)] p-0.5';

/** Hộp cảnh báo/toast — đơn sắc: viền + nền sáng + chữ ink. */
export const WARNING_BOX =
  'rounded-lg border border-[var(--color-ink)]/25 bg-[var(--color-bg)]/95 text-[var(--color-ink)] backdrop-blur';

/** Hint pill nổi trên 3D — đơn sắc, IN HOA giãn chữ. */
export const HINT_PILL =
  'whitespace-nowrap rounded-full border border-[var(--color-line)] bg-[var(--color-bg)]/90 px-3 md:px-4 py-1 md:py-1.5 text-[10px] md:text-[11px] uppercase tracking-[0.12em] text-[var(--color-ink-2)] shadow-sm backdrop-blur';

/** CTA pill (nút Đặt hàng) — nền đen, chữ trắng (MUUTO black button). */
export const CTA_PILL =
  'rounded-full bg-[var(--color-accent)] text-white shadow-sm transition hover:bg-[var(--color-accent-hover)]';

// ─── MUUTO chrome (mới) ──────────────────────────────────────────────────────

/** Top bar full-width: brand + breadcrumb tên sản phẩm. */
export const TOPBAR =
  'flex shrink-0 items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-bg)] px-4 md:px-6 h-12 md:h-16';

/** Hàng accordion (mỗi mục) — phân cách viền mảnh. */
export const ACCORDION_ITEM = 'border-b border-[var(--color-line)]';

/** Header accordion (bấm mở/đóng) — IN HOA + icon +/−. */
export const ACCORDION_HEADER =
  'flex w-full items-center justify-between gap-2 py-3 max-md:py-2.5 text-left muuto-label text-[var(--color-ink)] transition hover:text-[var(--color-accent-hover)]';
