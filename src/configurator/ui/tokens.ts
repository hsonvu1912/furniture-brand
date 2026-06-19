// =============================================================================
// configurator/ui/tokens.ts — chuỗi className DÙNG CHUNG cho 2 config (P96).
// Không tạo token CSS mới (globals .ke-theme đã chung) — chỉ gom các chuỗi
// className lặp ≥3 lần để primitive tiêu thụ, tránh drift giữa tủ x ↔ tủ y.
// =============================================================================

/** Sidebar (drawer) — desktop 340px, mobile bottom-sheet 38dvh, viền cam-mờ. */
export const SIDEBAR =
  'shrink-0 flex flex-col gap-5 max-md:gap-1.5 overflow-y-auto bg-[var(--color-bg)] p-5 max-md:px-3 max-md:py-2 text-[var(--color-ink)] max-md:h-[38dvh] md:h-full md:w-[340px] md:border-r md:border-[var(--color-accent)]/20';

/** Viewport 3D — chừa min-h-0 + mobile 56dvh (panel 38 + canvas 56 = 1 dvh). */
export const VIEWPORT = 'relative min-h-0 flex-1 max-md:h-[56dvh]';

/** Thẻ nhóm điều khiển. */
export const CARD = 'rounded-xl border border-[var(--color-accent)]/15 bg-[var(--color-surface-2)]/35 p-2.5';

/** Tiêu đề mục — P96 (founder chốt): chữ THƯỜNG font-viet đậm-vừa, accent (khớp nhãn param tủ x),
 *  thay kiểu IN HOA cam-mờ cũ. Đồng bộ tiêu-đề-mục 2 config. */
export const SECTION_HEADING = 'text-xs md:text-sm font-medium text-[var(--color-accent)] font-viet';

/** Segmented control — vỏ nền surface-2 (chuẩn). */
export const SEGMENTED_WRAP = 'inline-flex w-full rounded-lg bg-[var(--color-surface-2)] p-0.5';
/** Segmented vỏ nền --color-bg (giữ baseline tủ x: tier-steps Cao/Rộng). */
export const SEGMENTED_WRAP_BG = 'inline-flex w-full rounded-lg bg-[var(--color-bg)] p-0.5';

/** Hộp cảnh báo/toast (tone cam). Bóng do mỗi nơi tự đặt (WarningBox shadow-lg, Toast shadow). */
export const WARNING_BOX =
  'rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent-bg)]/95 text-[var(--color-accent)] backdrop-blur';

/** Hint pill nổi trên 3D — P96: thêm biến thể md (to hơn trên desktop) + nowrap (chuẩn tủ x). */
export const HINT_PILL =
  'whitespace-nowrap rounded-full bg-[var(--color-bg)]/85 px-3 md:px-4 py-1 md:py-1.5 text-[10px] md:text-[11px] uppercase tracking-[0.15em] text-[var(--color-accent)]/70 shadow-sm backdrop-blur';

/** CTA pill (nút Đặt hàng / hành động chính). */
export const CTA_PILL =
  'rounded-full bg-[var(--color-accent)] text-white shadow-md transition hover:bg-[var(--color-accent-hover)]';
