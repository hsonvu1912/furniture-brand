// =============================================================
// SUBGRID — chia 1 ô thành nhiều "vách con" (sub-cells) 1D.
// Mỗi ô cha (lưới chính lưu value 'split') có 1 entry trong subCells map:
//   <r>_<c>=<dir><N>:<sizes>:<encodedCells>
// Trong đó:
//   dir   = 'H' (1×N, chia ngang theo cột con) hoặc 'V' (N×1, chia dọc theo tầng con).
//   N     = số slot (≥ 2).
//   sizes = chiều rộng (H) hoặc chiều cao (V) từng slot tính bằng mm, phân tách bằng ','.
//   cells = loại từng slot phân tách bằng ',' (mỗi slot 1 value như 'open-back', 'door',
//           'drawer', 'open-nobk').
// Entries phân tách bằng '|'.
// Vd: "0_1=H3:400,600,500:door,drawer,door|2_0=V2:300,300:open-back,door"
//   → ô (r=0,c=1) chia ngang 3 slot rộng 400/600/500mm = cánh / ngăn kéo / cánh.
//   → ô (r=2,c=0) chia dọc 2 slot cao 300/300mm = mở-có-hậu / cánh.
// =============================================================

import { CELL_MIN_DEFAULT, T_DEFAULT } from './subgrid-constants';

/** 1 entry sub-cells trong map. */
export interface SubEntry {
  dir: 'H' | 'V'; // hướng chia
  parentKind: string; // loại GỐC của cha (open-back / open-nobk) — quyết định hậu chung
  sizes: number[]; // mm — bề rộng (H) hoặc cao (V) từng slot
  cells: string[]; // loại từng slot (open-back, open-nobk, door, drawer)
}

/** Value reserve báo ô đang là container. Không dùng trong CELL_TYPES options. */
export const SPLIT = 'split';

/**
 * Parse chuỗi subCells thành Map<key, entry>.
 * Format mỗi entry: `<r>_<c>=<dir><N>[/<parentKind>]:<sizes>:<cells>`
 *   - parentKind optional, default 'open-back' (cho entries cũ không có field).
 * Key = "r_c" (vd "0_1"). Chuỗi trống → Map rỗng.
 */
export function parseSubCells(value: string): Map<string, SubEntry> {
  const out = new Map<string, SubEntry>();
  if (!value) return out;
  for (const seg of value.split('|')) {
    if (!seg) continue;
    const eq = seg.indexOf('=');
    if (eq < 0) continue;
    const key = seg.slice(0, eq);
    const rest = seg.slice(eq + 1);
    const colonA = rest.indexOf(':');
    if (colonA < 0) continue;
    const head = rest.slice(0, colonA); // vd "H3" hoặc "H3/open-back"
    const colonB = rest.indexOf(':', colonA + 1);
    if (colonB < 0) continue;
    const sizesStr = rest.slice(colonA + 1, colonB);
    const cellsStr = rest.slice(colonB + 1);
    const dirCh = head[0];
    if (dirCh !== 'H' && dirCh !== 'V') continue;
    const slashIdx = head.indexOf('/');
    const NStr = slashIdx >= 0 ? head.slice(1, slashIdx) : head.slice(1);
    const N = Number(NStr);
    const parentKind = slashIdx >= 0 ? head.slice(slashIdx + 1) : 'open-back';
    const sizes = sizesStr.split(',').map((s) => Number(s)).filter((n) => Number.isFinite(n));
    const cells = cellsStr.split(',');
    if (sizes.length !== N || cells.length !== N) continue;
    out.set(key, { dir: dirCh, parentKind, sizes, cells });
  }
  return out;
}

/** Encode Map → chuỗi. Map rỗng → "". */
export function encodeSubCells(map: Map<string, SubEntry>): string {
  const parts: string[] = [];
  for (const [key, e] of map) {
    parts.push(
      `${key}=${e.dir}${e.cells.length}/${e.parentKind}:${e.sizes.join(',')}:${e.cells.join(',')}`,
    );
  }
  return parts.join('|');
}

/** Khoá key duy nhất cho ô (r, c). */
export const subKey = (r: number, c: number): string => `${r}_${c}`;

/**
 * Loại các slot/entry vi phạm:
 *  - Cha không còn 'split' trong parentCells → drop entry.
 *  - Tổng size > kích thước cha → scale xuống bằng cách chia đều.
 *  - 1 slot < CELL_MIN → drop cả entry (cha về 'open-back', xử lý ngoài hàm này).
 *  - Loại slot vi phạm rule cha (vd drawer trong open-nobk cha) → fallback theo bảng.
 *
 * @param raw chuỗi subCells hiện tại.
 * @param parentCells lưới cha đã parse (string[][]).
 * @param colWidths bề rộng từng cột cha (mm).
 * @param rowHeights chiều cao từng tầng cha (mm).
 * @param parentTypeBefore lưới cha TRƯỚC khi reconcile (giữ "loại cha gốc" để xác định
 *        hậu chung — open-back / open-nobk — cho fallback drawer→door).
 * @param fallbackForType (parentType, slotType) → slot mới (vd drawer trong open-nobk → door).
 * @param cellMin tối thiểu 1 slot.
 * @param T độ dày vách giữa các slot (chừa khi tính max N).
 */
export function reconcileSubCells(
  raw: string,
  parentCells: string[][],
  colWidths: number[],
  rowHeights: number[],
  parentTypeBefore: string[][],
  fallbackForType: (parentType: string, slotType: string) => string,
  cellMin: number = CELL_MIN_DEFAULT,
  T: number = T_DEFAULT,
): string {
  const old = parseSubCells(raw);
  const out = new Map<string, SubEntry>();
  for (const [key, entry] of old) {
    const us = key.split('_');
    const r = Number(us[0]);
    const c = Number(us[1]);
    if (!Number.isFinite(r) || !Number.isFinite(c)) continue;
    // Cha không còn 'split' → drop
    if (parentCells[r]?.[c] !== SPLIT) continue;

    const cw = colWidths[c];
    const ch = rowHeights[r];
    if (!cw || !ch) continue;
    const span = entry.dir === 'H' ? cw : ch;
    // Min slot tính trên TỔNG span − vách giữa (entry.cells.length − 1 vách).
    const minTotal = entry.cells.length * cellMin + (entry.cells.length - 1) * T;
    if (span < minTotal) continue; // cha quá nhỏ — drop, cha tự reset ngoài

    // Chuẩn hoá sizes: scale theo tỉ lệ rồi clamp ≥ cellMin.
    const sumSizes = entry.sizes.reduce((s, n) => s + n, 0);
    const spaceForSlots = span - (entry.cells.length - 1) * T;
    let sizes = entry.sizes.map((s) =>
      Math.max(cellMin, Math.round((s / Math.max(sumSizes, 1)) * spaceForSlots)),
    );
    // Bù sai số: chỉnh slot cuối để tổng = spaceForSlots.
    const drift = spaceForSlots - sizes.reduce((s, n) => s + n, 0);
    sizes[sizes.length - 1] = Math.max(cellMin, sizes[sizes.length - 1] + drift);

    // Fallback loại slot theo parentKind đã lưu trong entry (loại GỐC của cha,
    // KHÔNG đọc từ parentCells vì cells[r][c] hiện đã là 'split').
    const cells = entry.cells.map((slotType) => fallbackForType(entry.parentKind, slotType));

    out.set(key, { ...entry, sizes, cells });
  }
  return encodeSubCells(out);
}
