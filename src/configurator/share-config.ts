// =============================================================================
// share-config.ts — mã hoá/giải mã CẤU HÌNH configurator để Chia sẻ + Lưu để sau.
// `values` (ParamValues) là TOÀN BỘ cấu hình (x: lưới ô; y: JSON modules). Gói cùng
// product → 1 chuỗi base64 URL-safe nhét vào /design?c=<mã>. UTF-8 safe (btoa chỉ
// nuốt Latin1 nên phải qua encodeURIComponent — tránh crash khi values có tiếng Việt).
// =============================================================================
import type { ParamValues } from './types';

export interface SharedConfig {
  /** 'tu-ke' (x) | 'tu-y' (y). */
  p: string;
  /** ParamValues đầy đủ. */
  v: ParamValues;
}

/** Object → chuỗi base64 (UTF-8 safe). Trả '' nếu lỗi (không chặn UI). */
export function encodeConfig(product: string, values: ParamValues): string {
  try {
    const json = JSON.stringify({ p: product, v: values } satisfies SharedConfig);
    // encodeURIComponent → %XX cho byte UTF-8; unescape → byte-string Latin1 cho btoa.
    return btoa(unescape(encodeURIComponent(json)));
  } catch (err) {
    console.error('[share-config] encode lỗi:', err);
    return '';
  }
}

/** Chuỗi base64 → SharedConfig. Trả null nếu hỏng/không hợp lệ. */
export function decodeConfig(encoded: string | undefined | null): SharedConfig | null {
  if (!encoded) return null;
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const obj = JSON.parse(json) as SharedConfig;
    if (!obj || typeof obj !== 'object' || !obj.v || typeof obj.v !== 'object') return null;
    return { p: obj.p === 'tu-y' ? 'tu-y' : 'tu-ke', v: obj.v };
  } catch (err) {
    console.error('[share-config] decode lỗi:', err);
    return null;
  }
}

/** Build URL /design tuyệt đối (cho clipboard) từ cấu hình hiện tại. */
export function buildShareUrl(product: string, values: ParamValues, origin?: string): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const code = encodeConfig(product, values);
  return `${base}/design?c=${encodeURIComponent(code)}`;
}

/** "Lưu để sau" (MVP): đẩy cấu hình + link vào localStorage (key ngan-saved-designs). */
export const SAVED_DESIGNS_KEY = 'ngan-saved-designs';
export interface SavedDesign {
  product: string;
  name: string;
  url: string;
  values: ParamValues;
  ts: number;
}
export function saveDesignLocal(product: string, values: ParamValues, name?: string, ts = 0): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: SavedDesign = {
      product,
      name: name || (product === 'tu-y' ? 'Tủ mô-đun' : 'Tủ kệ') + ' tự thiết kế',
      url: buildShareUrl(product, values),
      values,
      ts: ts || Date.now(),
    };
    const raw = window.localStorage.getItem(SAVED_DESIGNS_KEY);
    const list: SavedDesign[] = raw ? (JSON.parse(raw) as SavedDesign[]) : [];
    list.unshift(entry);
    window.localStorage.setItem(SAVED_DESIGNS_KEY, JSON.stringify(list.slice(0, 30)));
  } catch (err) {
    console.error('[share-config] saveDesignLocal lỗi:', err);
  }
}
