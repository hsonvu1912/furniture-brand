'use client';
// =============================================================================
// configurator/ui — BỘ UI DÙNG CHUNG cho 2 config (tủ x + tủ y) — P96.
// "Chrome" (vỏ thiết kế): shell, header, card, segmented, pill, swatch, order bar,
// order dialog, floating buttons, hint, warning, toast, save preset. CẢ 2 config
// import từ đây → sửa 1 chỗ cả 2 đổi (hết drift). KHÔNG chứa logic sản phẩm
// (tab/slider/CellBar của x; Tetris/nút "+"/màu per-ô của y giữ ở từng file).
// =============================================================================
import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { swatchCss } from '../materials';
import { formatPrice } from '../pricing';
import type { ParamValues } from '../types';
import * as T from './tokens';

// ─── Shell MUUTO: chủ-sở-hữu-layout DUY NHẤT (P96) ───────────────────────────
// Cấu trúc: TopBar / [canvas TRÁI · sidebar accordion PHẢI]. KHÔNG còn thanh đáy:
// giá · hoàn tác · kích thước · đặt hàng · lưu · chia sẻ đều NỔI TRONG canvas 3D
// (ViewportChrome). chrome=false (screenshot/record) → canvas full-bleed (giữ thumbnail).
export interface ToolSpec {
  key: string;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
}
/** Dữ liệu thương mại nổi trên canvas (giá + đặt hàng + lưu + chia sẻ). */
export interface CommerceData {
  priceTotal: number;
  summary?: ReactNode;
  buildPayload: () => Record<string, unknown>;
  /** Trả URL chia sẻ (đã encode cấu hình). Có → hiện nút Chia sẻ. */
  onShare?: () => string;
  /** Lưu cấu hình (vd localStorage). Có → hiện nút Lưu. */
  onSave?: () => void;
  orderTitle?: string;
}
export function ConfigShell({
  chrome = true,
  brand,
  backHref,
  kicker,
  title,
  viewport,
  sidebar,
  tools,
  commerce,
}: {
  chrome?: boolean;
  brand?: ReactNode;
  backHref?: string;
  kicker?: string;
  title?: string;
  viewport: ReactNode;
  sidebar?: ReactNode;
  tools?: ToolSpec[];
  commerce?: CommerceData;
}) {
  // Screenshot/record: không chrome → canvas chiếm full (KHÔNG bọc config-muuto để
  // giữ tông màu trung thực khi chụp thumbnail).
  if (!chrome) return <div className="relative h-full w-full">{viewport}</div>;

  return (
    <div className="config-muuto flex h-full w-full flex-col bg-[var(--color-bg)] text-[var(--color-ink)]">
      <TopBar brand={brand} backHref={backHref} kicker={kicker} title={title} />
      {/* Hàng giữa: canvas TRÁI (desktop) / TRÊN (mobile) · sidebar PHẢI / DƯỚI. */}
      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="relative min-h-0 flex-1 max-md:h-[56dvh]">
          {viewport}
          {/* Mọi control nổi TRONG canvas (giá/tools/đặt hàng/lưu/chia sẻ). */}
          <ViewportChrome tools={tools} commerce={commerce} />
        </div>
        {sidebar && <aside className={T.SIDEBAR}>{sidebar}</aside>}
      </div>
    </div>
  );
}

// ─── ViewportChrome: cụm control NỔI trên canvas 3D ──────────────────────────
// Trái-trên: giá + (hoàn tác · kích thước). Phải-trên: chia sẻ · lưu · đặt hàng.
// Khối giá pointer-events-none (không chặn xoay canvas); cụm nút bật pointer-events.
function ViewportChrome({ tools, commerce }: { tools?: ToolSpec[]; commerce?: CommerceData }) {
  const [orderOpen, setOrderOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };
  const handleShare = async () => {
    if (!commerce?.onShare) return;
    const url = commerce.onShare();
    try {
      await navigator.clipboard.writeText(url);
      flash('Đã copy link chia sẻ');
    } catch {
      flash('Không copy được link');
    }
  };
  const handleSave = () => {
    if (!commerce?.onSave) return;
    commerce.onSave();
    flash('Đã lưu thiết kế');
  };
  return (
    <>
      {/* Trái-trên: giá + tools (hoàn tác/kích thước) — xếp dọc, tự đặt offset. */}
      <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-col gap-2 md:left-5 md:top-5 md:gap-3">
        {commerce && (
          <div className="leading-tight [text-shadow:0_1px_8px_rgba(255,255,255,0.95)]">
            <p className="muuto-label text-[8px] text-[var(--color-ink-3)] md:text-[9px]">Giá tham khảo</p>
            <p className="tabular-nums text-lg font-medium leading-none text-[var(--color-ink)] md:text-3xl">{formatPrice(commerce.priceTotal)}</p>
          </div>
        )}
        {tools && tools.length > 0 && (
          <div className="pointer-events-auto flex items-center gap-2">
            {tools.map((t) => (
              <FloatingIconButton key={t.key} onClick={t.onClick} active={t.active} disabled={t.disabled} ariaLabel={t.label} title={t.title ?? t.label}>
                {t.icon}
              </FloatingIconButton>
            ))}
          </div>
        )}
      </div>
      {/* Phải-trên: chia sẻ · lưu · đặt hàng. */}
      {commerce && (
        <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5 md:right-5 md:top-5 md:gap-2">
          {commerce.onShare && (
            <FloatingIconButton onClick={handleShare} ariaLabel="Chia sẻ" title="Chia sẻ link cấu hình">{IconShare}</FloatingIconButton>
          )}
          {commerce.onSave && (
            <FloatingIconButton onClick={handleSave} ariaLabel="Lưu để sau" title="Lưu thiết kế để sau">{IconBookmark}</FloatingIconButton>
          )}
          <button type="button" onClick={() => setOrderOpen(true)}
            className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-[11px] font-medium tracking-wide text-white shadow-md transition hover:bg-[var(--color-accent-hover)] md:px-6 md:py-2.5 md:text-sm">
            {commerce.orderTitle ?? 'Đặt hàng'}
          </button>
        </div>
      )}
      {/* Toast Chia sẻ/Lưu — nổi dưới cụm nút phải. */}
      {toast && (
        <div className="pointer-events-none absolute right-3 top-14 z-30 whitespace-nowrap rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-[11px] text-white shadow-lg md:right-5 md:top-[4.25rem]">
          {toast}
        </div>
      )}
      {orderOpen && commerce && (
        <OrderDialog priceTotal={commerce.priceTotal} summary={commerce.summary} buildPayload={commerce.buildPayload} title={commerce.orderTitle ?? 'Đặt hàng'} onClose={() => setOrderOpen(false)} />
      )}
    </>
  );
}
/** Icon Chia sẻ (3 nút nối) + Lưu (bookmark) — dùng trong ViewportChrome. */
export const IconShare = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
  </svg>
);
export const IconBookmark = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

/** <aside> chuẩn (desktop 340px PHẢI, mobile bottom-sheet). */
export function Sidebar({ children }: { children: ReactNode }) {
  return <aside className={T.SIDEBAR}>{children}</aside>;
}

// ─── TopBar (MUUTO) — 3 phần TÁCH BẠCH: [nút back] · logo ngăn (lớn) · | tên tủ ──
//   • Back = control riêng (icon tròn ghost) → trang chủ, KHÔNG dính tên tủ.
//   • Logo ngăn = wordmark Lora LỚN (thương hiệu).
//   • Tên tủ = ngữ cảnh sau vạch ngăn (tự mô tả: "Tủ kệ tự thiết kế"…).
export function TopBar({ brand, backHref, kicker, title }: { brand?: ReactNode; backHref?: string; kicker?: string; title?: string }) {
  return (
    <header className={T.TOPBAR}>
      {backHref && (
        <a
          href={backHref}
          aria-label="Về trang chủ"
          title="Về trang chủ"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--color-ink-2)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </a>
      )}
      {brand && (
        <a href={backHref ?? undefined} className="shrink-0 font-lora text-[26px] md:text-[34px] leading-none text-[var(--color-ink)]" aria-label="ngăn — trang chủ">
          {brand}
        </a>
      )}
      {(title || kicker) && (
        <>
          {/* Dấu gạch dọc cao bằng khối tên 2 dòng → cân đối với logo lớn. */}
          <span aria-hidden className="h-7 w-px shrink-0 bg-[var(--color-line)]" />
          <span className="flex min-w-0 flex-col justify-center leading-tight">
            {kicker && <span className="muuto-label text-[8px] text-[var(--color-ink-3)] md:text-[9px]">{kicker}</span>}
            {title && <span className="truncate text-[13px] font-medium text-[var(--color-ink)] md:text-[15px]">{title}</span>}
          </span>
        </>
      )}
    </header>
  );
}

// ─── Accordion (mở-một-panel cho tủ x; nhiều panel độc lập cho tủ y) ──────────
export function AccordionItem({ title, open, onToggle, children, badge }: {
  title: ReactNode; open: boolean; onToggle: () => void; children: ReactNode; badge?: ReactNode;
}) {
  return (
    <div className={T.ACCORDION_ITEM}>
      <button type="button" onClick={onToggle} aria-expanded={open} className={T.ACCORDION_HEADER}>
        <span className="flex items-center gap-2">{title}{badge}</span>
        <span aria-hidden className="text-base leading-none text-[var(--color-ink-3)]">{open ? '−' : '+'}</span>
      </button>
      {/* acc-body: grid 0fr→1fr (animation mượt, tự co theo nội dung). Con luôn mounted. */}
      <div className="acc-body" data-open={open ? 'true' : 'false'}>
        <div className="acc-inner">
          <div className="pb-3 max-md:pb-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Header editorial ────────────────────────────────────────────────────────
export function EditorialHeader({ homeHref, kicker, title, hint }: { homeHref?: string; kicker: string; title: string; hint?: ReactNode }) {
  return (
    <header className="max-md:hidden border-b border-[var(--color-accent)]/15 pb-3">
      {homeHref && (
        <a href={homeHref} className="text-[11px] font-medium tracking-wide text-[var(--color-accent)]/60 hover:text-[var(--color-accent)]">
          ← Trang chủ
        </a>
      )}
      <p className="editorial-caption mb-2 mt-1">{kicker}</p>
      <h1 className="display-italic text-accent text-4xl lg:text-5xl leading-[0.95] tracking-tight">{title}</h1>
      {hint && <p className="mt-2 text-xs font-viet leading-relaxed text-[var(--color-accent)]/70">{hint}</p>}
    </header>
  );
}

// ─── Section card + heading ──────────────────────────────────────────────────
export function SectionCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`${T.CARD} ${className}`}>{children}</section>;
}
export function SectionHeading({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h2 className={`${T.SECTION_HEADING} ${className}`}>{children}</h2>;
}

// ─── Segmented (toggle 2-n lựa chọn) ─────────────────────────────────────────
export function Segmented<V extends string>({ options, value, onChange, ariaLabel, bg = 'surface-2', className = '', numeric = false }: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
  ariaLabel?: string;
  /** Q1/P96 — 'bg' giữ baseline tủ x (tier-steps Cao/Rộng dùng nền --color-bg). */
  bg?: 'surface-2' | 'bg';
  /** P96 — class phụ nối vào VỎ (vd 'max-w-xs' cap rộng cho ParamControl toggle). */
  className?: string;
  /** P96 — nhãn là số ('NN cm') → tabular-nums căn cột digit (NumberControl nấc). */
  numeric?: boolean;
}) {
  return (
    <div className={`${bg === 'bg' ? T.SEGMENTED_WRAP_BG : T.SEGMENTED_WRAP} ${className}`.trim()} role="group" aria-label={ariaLabel}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(o.value)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${numeric ? 'tabular-nums ' : ''}${on ? 'bg-[var(--color-accent)] text-white shadow-sm' : 'text-[var(--color-accent)]/70 hover:text-[var(--color-accent)]'}`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── PillButton (nút chọn FILL-active) ───────────────────────────────────────
export function PillButton({ active, onClick, disabled, children, className = '', title }: {
  active?: boolean; onClick?: () => void; disabled?: boolean; children: ReactNode; className?: string; title?: string;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className={`rounded-lg px-2 py-1.5 transition ${
        disabled
          ? 'cursor-not-allowed bg-[var(--color-surface-2)]/50 text-[var(--color-accent)]/30'
          : active
            ? 'bg-[var(--color-accent)] text-white shadow-sm'
            : 'bg-[var(--color-surface-2)] text-[var(--color-accent)] hover:bg-[var(--color-accent-bg)]'
      } ${className}`}>
      {children}
    </button>
  );
}

// ─── SwatchButton (ô màu vân gỗ thật) ────────────────────────────────────────
export function SwatchButton({ material, fallbackBg, active, onClick, title, size = 'md' }: {
  material: string; fallbackBg: string; active?: boolean; onClick?: () => void; title?: string; size?: 'sm' | 'md';
}) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={`${size === 'sm' ? 'h-7 w-7' : 'h-8 w-8'} rounded-md border-2 ${active ? 'border-[var(--color-accent)]' : 'border-[var(--color-accent)]/25'}`}
      style={swatchCss(material, fallbackBg)} />
  );
}

// ─── SwatchOption: ô màu + NHÃN — DÙNG CHUNG cả 2 config (P96, founder chốt "có tên hết").
//     swatchStyle do caller tính: swatchCss(vật liệu) HOẶC hex/gradient (màu nẹp). Active = fill cam.
export function SwatchOption({ swatchStyle, label, active, onClick, title, className = '' }: {
  swatchStyle: CSSProperties; label: string; active?: boolean; onClick?: () => void; title?: string; className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition ${active ? 'bg-[var(--color-accent)] text-white shadow-sm' : 'bg-[var(--color-surface-2)] text-[var(--color-accent)] hover:bg-[var(--color-accent-bg)]'} ${className}`.trim()}
    >
      <span className="h-5 w-7 shrink-0 rounded border border-[var(--color-accent)]/25" style={swatchStyle} />
      <span className="text-[11px] leading-tight">{label}</span>
    </button>
  );
}

// ─── Nút tròn nổi viewport (undo / toggle / home) ────────────────────────────
export function FloatingIconButton({ onClick, active, disabled, ariaLabel, title, children }: {
  onClick?: () => void; active?: boolean; disabled?: boolean; ariaLabel: string; title?: string; children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel} aria-pressed={active} title={title}
      className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-md backdrop-blur transition disabled:opacity-40 ${
        active ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white' : 'border-[var(--color-line)] bg-[var(--color-bg)]/90 text-[var(--color-ink)] hover:bg-[var(--color-accent)] hover:text-white hover:border-[var(--color-accent)]'
      }`}>
      {children}
    </button>
  );
}
/** Icon SVG dùng chung cho FloatingIconButton (đồng bộ 2 tủ). */
export const IconUndo = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" />
  </svg>
);
export const IconRuler = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8h18v8H3z" /><path d="M7 8v3M11 8v4M15 8v3M19 8v3" />
  </svg>
);

// ─── Hint pill nổi 3D ────────────────────────────────────────────────────────
export function HintPill({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 md:top-6 z-20 -translate-x-1/2 max-sm:top-auto max-sm:bottom-2">
      <p className={T.HINT_PILL}>{children}</p>
    </div>
  );
}

// ─── Warning box (tone cam) — P96: chuẩn tủ x (cap rộng, md:top-20, shadow-lg, leading).
//     Có title → ⚠ ở tiêu đề + dòng trần (tủ x); không title → ⚠ mỗi dòng (tủ y). ──────────
export function WarningBox({ warnings, title }: { warnings: string[]; title?: string }) {
  if (!warnings.length) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-16 md:top-20 z-20 -translate-x-1/2 w-[min(360px,calc(100%-32px))]">
      <div className={`${T.WARNING_BOX} p-3 text-xs leading-relaxed shadow-lg`}>
        {title && <p className="mb-0.5 font-semibold">{title}</p>}
        {warnings.map((w, i) => (
          <p key={i} className={i > 0 ? 'mt-1' : undefined}>{title ? w : `⚠ ${w}`}</p>
        ))}
      </div>
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────
export function Toast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  if (!message) return null;
  return (
    <div className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2">
      <button onClick={onDismiss} className={`${T.WARNING_BOX} px-4 py-2 text-xs shadow`}>{message} ✕</button>
    </div>
  );
}

// ─── SavePresetButton (admin) ────────────────────────────────────────────────
export function SavePresetButton({ values, onSave, className = '' }: {
  values: ParamValues; onSave?: (values: ParamValues) => void | Promise<void>; className?: string;
}) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const handleClick = async () => {
    setStatus('saving');
    try {
      if (onSave) await onSave(values);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (err) {
      console.error('[ngăn admin] Save preset error:', err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2500);
    }
  };
  return (
    <button type="button" onClick={handleClick} disabled={status === 'saving'}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        status === 'saved' || status === 'error'
          ? 'border border-[var(--color-accent)]/40 bg-[var(--color-accent-bg)] text-[var(--color-accent)]'
          : status === 'saving'
            ? 'cursor-wait border border-[var(--color-accent)]/40 bg-[var(--color-surface-2)] text-[var(--color-accent)]/80'
            : 'border border-[var(--color-accent)]/40 bg-[var(--color-surface-2)] text-[var(--color-accent)] hover:bg-[var(--color-accent-bg)]'
      } ${className}`}>
      {status === 'saved' ? '✓ Đã lưu' : status === 'error' ? '✕ Lỗi lưu' : status === 'saving' ? '⏳ Đang lưu…' : '💾 Lưu preset'}
    </button>
  );
}

// (CommerceBar thanh-đáy đã bỏ — giá/đặt hàng/lưu/chia sẻ giờ NỔI trên canvas qua ViewportChrome.)

// ─── OrderBar (giá nổi góc-trái + nút Đặt hàng góc-phải + OrderDialog) ────────
// Layout THEO TỦ X (founder chốt): giá trái (text-shadow), nút phải. summary +
// buildPayload do từng sản phẩm cấp (nội dung khác nhau); form + POST chung.
export function OrderBar({ priceTotal, summary, buildPayload, title = 'Đặt hàng' }: {
  priceTotal: number;
  summary?: ReactNode;
  buildPayload: () => Record<string, unknown>;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="pointer-events-none absolute left-14 top-3 z-20 leading-tight md:left-6 md:top-6 [text-shadow:0_2px_8px_rgba(253,251,247,0.95)]">
        <p className="mb-1 text-[9px] font-medium uppercase tracking-[0.2em] text-[var(--color-accent)]/70 md:mb-1.5 md:text-[10px]">Giá tham khảo</p>
        <p className="display-italic text-accent text-base leading-none tabular-nums md:text-3xl lg:text-4xl">{formatPrice(priceTotal)}</p>
      </div>
      <button type="button" onClick={() => setOpen(true)}
        className="absolute right-3 top-3 z-20 rounded-full bg-[var(--color-accent)] px-4 py-2 text-[11px] font-medium tracking-wide text-white shadow-md transition-all hover:bg-[var(--color-accent-hover)] md:right-6 md:top-6 md:px-6 md:py-3 md:text-sm">
        {title}
      </button>
      {open && <OrderDialog priceTotal={priceTotal} summary={summary} buildPayload={buildPayload} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}

// ─── OrderDialog (modal portal — form chung + payload riêng) ──────────────────
export function OrderDialog({ priceTotal, summary, buildPayload, title = 'Đặt hàng', onClose }: {
  priceTotal: number;
  summary?: ReactNode;
  buildPayload: () => Record<string, unknown>;
  title?: string;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', note: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const field = 'w-full rounded border border-[var(--color-accent)]/30 px-3 py-3 focus:border-[var(--color-accent)] focus:outline-none md:py-2';
  const lbl = 'mb-1 block text-xs uppercase tracking-wide text-[var(--color-accent)]/70';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setErrorMsg('Vui lòng nhập tên và số điện thoại');
      setStatus('error');
      return;
    }
    setStatus('sending');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: form, ...buildPayload() }),
      });
      const data = (await res.json()) as { success?: boolean; orderId?: number; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error || 'Gửi đơn thất bại');
      setStatus('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi không xác định');
      setStatus('error');
    }
  }

  return createPortal(
    // config-muuto: portal render NGOÀI cây configurator → bọc lại để modal thừa hưởng theme đơn sắc.
    <div className="config-muuto fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-[var(--color-ink)]/40 p-4 backdrop-blur-sm md:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-[var(--color-bg)] shadow-xl" onClick={(e) => e.stopPropagation()}>
        {status === 'success' ? (
          <div className="p-6 text-center">
            <div className="mb-3 text-4xl">✅</div>
            <h2 className="mb-2 text-xl font-bold">Đã gửi đơn!</h2>
            <p className="mb-4 text-sm text-[var(--color-accent)]/80">
              Maumè đã nhận đơn. Chúng tôi sẽ liên hệ qua số <strong>{form.phone}</strong> trong 24h để xác nhận.
            </p>
            <button onClick={onClose} className="rounded bg-[var(--color-accent)] px-4 py-2 text-sm text-white hover:bg-[var(--color-accent-hover)]">Đóng</button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="display-italic text-accent text-2xl leading-none">{title}</h2>
              <button type="button" onClick={onClose} aria-label="Đóng" className="text-2xl leading-none text-[var(--color-accent)]/60 hover:text-[var(--color-accent)]">×</button>
            </div>
            <div className="mb-4 space-y-1 rounded bg-[var(--color-surface-2)] p-3 text-xs">
              {summary}
              <p><strong>Giá tham khảo:</strong> <span className="font-bold">{formatPrice(priceTotal)}</span></p>
            </div>
            <div className="space-y-3 text-sm">
              <label className="block"><span className={lbl}>Họ tên <span className="text-[var(--color-accent)]">*</span></span>
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} placeholder="Nguyễn Văn A" /></label>
              <label className="block"><span className={lbl}>Số điện thoại <span className="text-[var(--color-accent)]">*</span></span>
                <input type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} placeholder="09xx xxx xxx" /></label>
              <label className="block"><span className={lbl}>Email</span>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} placeholder="ban@example.com" /></label>
              <label className="block"><span className={lbl}>Địa chỉ giao hàng</span>
                <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={field} placeholder="Số nhà, đường, quận, TP" /></label>
              <label className="block"><span className={lbl}>Ghi chú</span>
                <textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={field} placeholder="Deadline, yêu cầu đặc biệt…" /></label>
            </div>
            {errorMsg && <p className="mt-3 rounded border border-[var(--color-accent)]/40 bg-[var(--color-accent-bg)] px-3 py-2 text-xs text-[var(--color-accent)]">{errorMsg}</p>}
            <button type="submit" disabled={status === 'sending'}
              className="mt-5 w-full rounded-full bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50">
              {status === 'sending' ? 'Đang gửi…' : 'Gửi đơn'}
            </button>
            <p className="mt-2 text-[11px] text-[var(--color-accent)]/60">Bằng cách gửi, bạn đồng ý maumè liên hệ qua SĐT để xác nhận đơn.</p>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
