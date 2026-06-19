// =============================================================
// CELLGRID — codec lưới ô có 2 format:
//
//  1) UNIFORM (legacy, mặc định): chuỗi `rows × cols` ô vuông cùng kích thước.
//     Quy ước: hàng ngăn ';', ô ngăn ',', mỗi ô là 1 option value.
//     Vd: "open-back,door;drawer,open-back"  (2 hàng × 2 cột).
//
//  2) BLOCKS (Phase 2+, opt-in qua `Parameter.cellLayoutMode='blocks'`): danh
//     sách khối hình chữ nhật bất kỳ trên lưới `rows × cols` cho phép SPLIT
//     (sub-cell) + MERGE (Excel-like) bỏ vách giữa.
//     Quy ước: khối ngăn '|', field ngăn ','. Mỗi khối: `r,c,rs,cs,t`
//     (row, col, rowSpan, colSpan, type/option value).
//     Vd: "0,0,1,2,door|0,2,1,1,open-back|1,0,1,3,drawer"  (1 ô door rộng 2,
//     1 ô open-back, 1 ô drawer kéo cả 3 cột).
//
// AUTO-DETECT: chuỗi có '|' → blocks; không → uniform legacy. Đơn cũ trong
// Google Sheets vẫn parse được (Apps Script đọc raw text, không vỡ).
// =============================================================

/** Giải mã chuỗi lưới → mảng 2D [hàng][cột]. Chuỗi rỗng → []. */
export function parseCellGrid(value: string): string[][] {
  if (!value) return [];
  return value.split(';').map((row) => row.split(','));
}

/** Mã hoá lưới 2D → chuỗi. */
export function encodeCellGrid(grid: string[][]): string {
  return grid.map((row) => row.join(',')).join(';');
}

/**
 * Chuẩn hoá lưới về đúng kích thước rows × cols:
 *  - giữ ô cũ ở vùng giao nhau; ô mới (do mở rộng) lấy `fallback`;
 *  - ô mang option bị cấm theo hàng (`disabledByRow`) HOẶC theo cột (`disabledByCol`)
 *    → đổi về `cellFallback[value]` nếu có map, ngược lại `fallback`.
 * Dùng khi số hàng/cột đổi, hoặc khi quy tắc cấm (vd ngăn kéo) thay đổi.
 *
 * `cellFallback` cho phép từng value có 1 fallback riêng — vd `{drawer: 'door'}` để
 * ngăn kéo vi phạm size chuyển sang cánh thay vì option đầu tiên (mở-có-hậu).
 */
export function reconcileCellGrid(
  value: string,
  rows: number,
  cols: number,
  fallback: string,
  disabledByRow: string[][] = [],
  disabledByCol: string[][] = [],
  cellFallback: Record<string, string> = {},
): string[][] {
  const old = parseCellGrid(value);
  const out: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const rowBan = disabledByRow[r] ?? [];
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      const cell = old[r]?.[c] ?? fallback;
      const banned = rowBan.includes(cell) || (disabledByCol[c] ?? []).includes(cell);
      row.push(banned ? (cellFallback[cell] ?? fallback) : cell);
    }
    out.push(row);
  }
  return out;
}

// =============================================================
// BLOCK LIST CODEC (Phase 2+) — irregular grid với rowSpan/colSpan
// Hỗ trợ Split (chia ô thành sub-cells) + Merge (gộp ô Excel-like).
// Format: "r,c,rs,cs,t|r,c,rs,cs,t|...". Block ngăn '|', field ngăn ','.
// =============================================================

/** 1 khối hình chữ nhật phủ `rs × cs` ô tính từ góc trên-trái [r, c]. `t` là
 *  option value (vd "open-back", "door", "mfc/oak").
 *
 *  P4 cross-merge: khi 2+ ô gộp thành block lớn, `pre` lưu type của các ô con
 *  TRƯỚC merge (length = rs × cs, row-major: pre[dr*cs + dc] = type ô (r+dr, c+dc)).
 *  Unmerge phân phối pre lại cho từng sub block 1×1 → cells trở về thuộc tính cũ.
 *  Vắng pre → unmerge dùng `t` cho mọi sub. Encoded inline trong t qua `~`:
 *  vd `"0,0,1,2,open-nobk~drawer~door"` = merged 1×2, type 'open-nobk', pre=['drawer','door']. */
export interface CellBlock {
  r: number; // hàng góc trên-trái (0-based)
  c: number; // cột góc trên-trái (0-based)
  rs: number; // rowSpan ≥ 1
  cs: number; // colSpan ≥ 1
  t: string; // option value (loại ô / màu ô)
  pre?: string[]; // backup types trước merge (length = rs×cs row-major)
}

const BLOCK_SEPARATOR = '|';
const FIELD_SEPARATOR = ',';
const PRE_SEPARATOR = '~'; // P4 lossless merge: tách actualT và pre[] trong field t

/** Đoán xem chuỗi là block-list (có '|', '>' hoặc '^') hay uniform legacy.
 *  Chuỗi rỗng → false (caller phải tự xử fallback).
 *
 *  Markers:
 *   - '|' = ≥2 blocks (multi-block).
 *   - '>' = V-split intra-cell (xem SUB_V) — sub-split GUARANTEES blocks format.
 *   - '^' = H-split intra-cell (xem SUB_H).
 *
 *  Primitive types (open-back/open-nobk/door/drawer + catalog colors) KHÔNG
 *  chứa các ký tự này → safe để discriminate.
 *
 *  CONVENTION: 1-block PRIMITIVE (vd `"0,0,1,1,open-back"`) vẫn ambiguous với
 *  5-cell legacy row → encode lại bằng `encodeCellGrid` khi `isUniformBlocks`
 *  rút về 1 block không sub-split. */
export function isBlocksValue(value: string): boolean {
  if (!value) return false;
  // Inline '>' và '^' để tránh forward reference với SUB_V/SUB_H declared sau.
  if (value.includes(BLOCK_SEPARATOR) || value.includes('>') || value.includes('^')) {
    return true;
  }
  // Single-block heuristic: chuỗi không có ';' (legacy row separator) HOẶC duy
  // nhất 1 row trong legacy. Kiểm tra format `r,c,rs,cs,t` — 4 trường đầu là
  // số nguyên non-negative. Legacy primitive types (open-back/door/...) KHÔNG
  // bắt đầu bằng digit nên discriminate được. Nếu khớp → blocks single-block.
  // Vd "0,0,1,2,open-back" → blocks (cs=2 merged). "open-back,door" → legacy.
  if (!value.includes(';')) {
    const fields = value.split(',');
    if (fields.length >= 5) {
      const numeric = fields.slice(0, 4).every((f) => /^\d+$/.test(f.trim()));
      if (numeric) return true;
    }
  }
  return false;
}

/** Giải mã chuỗi block-list. Chuỗi rỗng → []. Field `t` cho phép chứa dấu '/'
 *  (vd "mfc/oak") nhưng KHÔNG được chứa ',' (đụng FIELD_SEPARATOR). Engine
 *  hiện tại không gặp case này; nếu sau có thì phải escape.
 *  P4 lossless: chuỗi t có thể chứa `~` để encode pre data — `actualT~pre0~pre1...`.
 *  parseBlocks split t bằng `~` để extract actualT + pre array. */
export function parseBlocks(value: string): CellBlock[] {
  if (!value) return [];
  return value.split(BLOCK_SEPARATOR).map((s) => {
    const f = s.split(FIELD_SEPARATOR);
    const tRaw = f.slice(4).join(FIELD_SEPARATOR);
    const tParts = tRaw.split(PRE_SEPARATOR);
    const actualT = tParts[0];
    const pre = tParts.length > 1 ? tParts.slice(1) : undefined;
    return {
      r: Number(f[0]) || 0,
      c: Number(f[1]) || 0,
      rs: Math.max(1, Number(f[2]) || 1),
      cs: Math.max(1, Number(f[3]) || 1),
      t: actualT,
      ...(pre ? { pre } : {}),
    };
  });
}

/** Mã hoá list blocks → chuỗi. List rỗng → "". Nếu block có `pre`, append qua `~`. */
export function encodeBlocks(blocks: CellBlock[]): string {
  return blocks
    .map((b) => {
      const tField =
        b.pre && b.pre.length > 0
          ? `${b.t}${PRE_SEPARATOR}${b.pre.join(PRE_SEPARATOR)}`
          : b.t;
      return `${b.r},${b.c},${b.rs},${b.cs},${tField}`;
    })
    .join(BLOCK_SEPARATOR);
}

/** Quy đổi grid 2D → list blocks 1×1 (uniform, chưa split/merge). Hàng/cột
 *  thiếu (jagged) → bỏ qua. Block list trả về sắp theo thứ tự duyệt
 *  row-major (r=0 c=0, r=0 c=1, ..., r=1 c=0...). */
export function gridToBlocks(grid: string[][]): CellBlock[] {
  const out: CellBlock[] = [];
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      out.push({ r, c, rs: 1, cs: 1, t: row[c] });
    }
  }
  return out;
}

/** Quy đổi list blocks → grid 2D đầy đủ `rows × cols`. Ô không thuộc block nào
 *  → `fallback`. Block vượt biên (r+rs > rows) bị crop (giữ phần trong). Nếu
 *  2 block chồng nhau, block sau ghi đè (last-wins; invariant nên không xảy ra). */
export function blocksToGrid(
  blocks: CellBlock[],
  rows: number,
  cols: number,
  fallback: string,
): string[][] {
  const grid: string[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => fallback),
  );
  for (const b of blocks) {
    for (let dr = 0; dr < b.rs; dr++) {
      for (let dc = 0; dc < b.cs; dc++) {
        const r = b.r + dr;
        const c = b.c + dc;
        if (r >= 0 && r < rows && c >= 0 && c < cols) grid[r][c] = b.t;
      }
    }
  }
  return grid;
}

/** Entry point auto-detect dùng cho UI logic: chuỗi (cả 2 format) → list
 *  blocks. Empty/missing → list 1×1 fill `fallback` cho cả `rows × cols`.
 *  Đây là điểm DUY NHẤT để code UI mới (Phase 3+) cần gọi khi muốn thao tác
 *  trên blocks; downstream build pipeline vẫn dùng `parseCellGrid` đến khi
 *  Phase 3 chuyển đổi. */
export function cellsToBlocks(
  value: string,
  rows: number,
  cols: number,
  fallback: string,
): CellBlock[] {
  if (!value) {
    const grid = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => fallback),
    );
    return gridToBlocks(grid);
  }
  if (isBlocksValue(value)) return parseBlocks(value);
  return gridToBlocks(parseCellGrid(value));
}

/** Reverse helper: blocks → chuỗi uniform legacy (để ghi ngược ParamValues khi
 *  list chưa có split/merge). Trả về chuỗi format cũ `"a,b;c,d"` tương thích
 *  Apps Script Sheet log. Nếu blocks có span ≥ 2 thì grid sẽ "lát" cùng `t`
 *  vào nhiều ô — KHÔNG bảo toàn block boundary; dùng `encodeBlocks` khi cần. */
export function blocksToCells(
  blocks: CellBlock[],
  rows: number,
  cols: number,
  fallback: string,
): string {
  return encodeCellGrid(blocksToGrid(blocks, rows, cols, fallback));
}

/** True nếu mọi block đều 1×1 — đủ điều kiện ghi format legacy uniform mà
 *  KHÔNG mất thông tin. Configurator Phase 2 dùng cờ này để giữ định dạng cũ
 *  cho preset chưa chỉnh (Apps Script không cần biết về format mới). */
export function isUniformBlocks(blocks: CellBlock[]): boolean {
  return blocks.every((b) => b.rs === 1 && b.cs === 1);
}

/** Tìm block phủ ô [row, col]. Trả về undefined nếu không có block nào (chỉ
 *  xảy ra khi blocks list bị thủng — invariant nói KHÔNG xảy ra với grid hợp
 *  lệ). Dùng cho UI: click ô [r,c] → tìm block để biết type/màu hiện tại. */
export function findBlockAt(
  blocks: CellBlock[],
  row: number,
  col: number,
): CellBlock | undefined {
  return blocks.find(
    (b) => row >= b.r && row < b.r + b.rs && col >= b.c && col < b.c + b.cs,
  );
}

/** Trục split — 'vertical' chia ô bằng vách đứng phụ, 'horizontal' chia ô bằng
 *  vách ngang phụ. KHÔNG đụng outer grid (rows × cols giữ nguyên). */
export type SplitAxis = 'vertical' | 'horizontal';

// =============================================================
// SUB-SPLIT CODEC (Phase 3 v2) — INTRA-CELL split (không đụng outer grid).
// Ô [r, c] có thể có 1 vách phụ chia thành 2 sub-cell:
//   - V-split: vách phụ ĐỨNG ở giữa cell → 2 sub-cell trái + phải
//   - H-split: vách phụ NGANG ở giữa cell → 2 sub-cell dưới + trên
// Encoding inside `block.t`:
//   "open-back"            → primitive (không split)
//   "open-back>door"       → V-split: L=open-back, R=door
//   "drawer^open-back"     → H-split: B=drawer, T=open-back
// Convention: '>' V-divider, '^' H-divider. Mỗi cell tối đa 1 split (không nested).
//
// Tấm hậu cell KHÔNG bị chia bởi sub-split (vẫn 1 panel rộng cell). Vách phụ
// chỉ kéo từ vách đứng chính sang vách đứng chính (V) hoặc từ vách trái sang
// vách phải (H), nằm chìm trong cell.
// =============================================================

const SUB_V = '>';
const SUB_H = '^';

/** Thông tin sub-split parsed từ `block.t`. */
export interface SubSplit {
  /** 'V' = vách phụ đứng (2 sub-cell L/R); 'H' = vách phụ ngang (2 sub-cell B/T). */
  axis: 'V' | 'H';
  /** Type của 2 sub-cell. V-split: [Left, Right]; H-split: [Bottom, Top]. */
  subs: [string, string];
}

/** Parse `t` thành primitive type hoặc sub-split. Trả về `{ primitive }` cho
 *  cell không split, `{ split }` cho cell có sub-split. */
export function parseSubSplit(
  t: string,
): { primitive: string; split?: undefined } | { primitive?: undefined; split: SubSplit } {
  const iV = t.indexOf(SUB_V);
  if (iV >= 0) {
    return { split: { axis: 'V', subs: [t.slice(0, iV), t.slice(iV + 1)] } };
  }
  const iH = t.indexOf(SUB_H);
  if (iH >= 0) {
    return { split: { axis: 'H', subs: [t.slice(0, iH), t.slice(iH + 1)] } };
  }
  return { primitive: t };
}

/** Encode sub-split thành chuỗi t. */
export function encodeSubSplit(split: SubSplit): string {
  const sep = split.axis === 'V' ? SUB_V : SUB_H;
  return `${split.subs[0]}${sep}${split.subs[1]}`;
}

/** True nếu `t` đã chứa sub-split (không cho split tiếp — max 1 split / cell). */
export function hasSubSplit(t: string): boolean {
  return t.includes(SUB_V) || t.includes(SUB_H);
}

/** SPLIT INTRA-CELL: chia ô [r, c] thành 2 sub-cell trong CÙNG ô (KHÔNG đụng
 *  outer grid). Sub-cell mặc định = `defaultSub` (open-back theo user).
 *
 *  Yêu cầu:
 *   - Block tại [r,c] là 1×1 (không phải cross-grid merged) — else throw
 *   - Block.t chưa có sub-split — else throw (max 1 split / cell)
 *
 *  Caller phải tự check min size 150×150 thông thuỷ TRƯỚC khi gọi (codec
 *  KHÔNG biết về kích thước vật lý mm).
 *
 *  Trả về list blocks mới với block target có t = "defaultSub>defaultSub"
 *  (V-split) hoặc "defaultSub^defaultSub" (H-split). KHÔNG mutate input. */
export function splitBlockIntra(
  blocks: CellBlock[],
  row: number,
  col: number,
  axis: SplitAxis,
  defaultSub: string,
): CellBlock[] {
  const target = findBlockAt(blocks, row, col);
  if (!target) throw new Error(`splitBlockIntra: không có block tại (${row}, ${col})`);
  if (target.rs !== 1 || target.cs !== 1) {
    throw new Error(
      `splitBlockIntra: block (${row}, ${col}) là ${target.rs}×${target.cs} cross-grid merged — cần unmerge trước (P4)`,
    );
  }
  if (hasSubSplit(target.t)) {
    throw new Error(
      `splitBlockIntra: block (${row}, ${col}) đã có sub-split — unsplit trước (P4 unsplit)`,
    );
  }
  const newSubT = encodeSubSplit({
    axis: axis === 'vertical' ? 'V' : 'H',
    subs: [defaultSub, defaultSub],
  });
  return blocks.map((b) => (b === target ? { ...b, t: newSubT } : b));
}

/** UNSPLIT: bỏ sub-split của ô [r,c] — giữ type của sub-cell `keepIdx` (0 = L/B
 *  hoặc 1 = R/T). `keepIdx` cho phép user chọn giữ side nào khi gộp:
 *   - V-split L (keepIdx=0): "Gộp →" giữ type của L
 *   - V-split R (keepIdx=1): "Gộp ←" giữ type của R
 *   - H-split B (keepIdx=0): "Gộp ↑" giữ type của B
 *   - H-split T (keepIdx=1): "Gộp ↓" giữ type của T */
export function unsplitBlockIntra(
  blocks: CellBlock[],
  row: number,
  col: number,
  keepIdx: 0 | 1 = 0,
): CellBlock[] {
  const target = findBlockAt(blocks, row, col);
  if (!target) return blocks;
  const parsed = parseSubSplit(target.t);
  if (parsed.primitive !== undefined) return blocks; // chưa split, no-op
  return blocks.map((b) => (b === target ? { ...b, t: parsed.split.subs[keepIdx] } : b));
}

/** Hướng MERGE — relative tới ô được click. */
export type MergeDirection = 'up' | 'down' | 'left' | 'right';

/** UNMERGE CROSS-GRID: tách 1 block cross-merged (rs>1 hoặc cs>1) thành rs × cs
 *  block 1×1 riêng lẻ. P4 lossless: nếu block có `pre`, RESTORE từng sub-cell
 *  về type cũ (trước merge); else fill bằng block.t. Đảo lại cross-grid merge.
 *  No-op nếu block tại (r,c) là 1×1 hoặc có sub-split (cần unsplitBlockIntra trước). */
export function unmergeBlocks(
  blocks: CellBlock[],
  row: number,
  col: number,
): CellBlock[] {
  const target = findBlockAt(blocks, row, col);
  if (!target) return blocks;
  if (target.rs === 1 && target.cs === 1) return blocks;
  if (hasSubSplit(target.t)) return blocks;
  const total = target.rs * target.cs;
  const useRestore = target.pre && target.pre.length === total;
  const expanded: CellBlock[] = [];
  for (let dr = 0; dr < target.rs; dr++) {
    for (let dc = 0; dc < target.cs; dc++) {
      const idx = dr * target.cs + dc;
      const subT = useRestore ? target.pre![idx] : target.t;
      expanded.push({
        r: target.r + dr,
        c: target.c + dc,
        rs: 1,
        cs: 1,
        t: subT,
      });
    }
  }
  return blocks.filter((b) => b !== target).concat(expanded);
}

/** Helper: trả về mảng pre row-major của block (length = rs*cs). Nếu block có
 *  pre sẵn → return pre; else fill với block.t (single primitive). */
function expandPre(b: CellBlock): string[] {
  const total = b.rs * b.cs;
  if (b.pre && b.pre.length === total) return b.pre;
  return Array(total).fill(b.t);
}

/** Helper: với rectangle bao trùm [newR..newR+newRs-1][newC..newC+newCs-1],
 *  collect pre row-major từ src + neighbor (mỗi (R,C) thuộc 1 trong 2 block). */
function collectMergedPre(
  src: CellBlock,
  neighbor: CellBlock,
  newR: number,
  newC: number,
  newRs: number,
  newCs: number,
): string[] {
  const srcPre = expandPre(src);
  const neighborPre = expandPre(neighbor);
  const out: string[] = [];
  for (let dr = 0; dr < newRs; dr++) {
    for (let dc = 0; dc < newCs; dc++) {
      const R = newR + dr;
      const C = newC + dc;
      if (R >= src.r && R < src.r + src.rs && C >= src.c && C < src.c + src.cs) {
        const idx = (R - src.r) * src.cs + (C - src.c);
        out.push(srcPre[idx]);
      } else {
        const idx = (R - neighbor.r) * neighbor.cs + (C - neighbor.c);
        out.push(neighborPre[idx]);
      }
    }
  }
  return out;
}

/** MERGE CROSS-GRID: gộp block tại [srcR, srcC] với block hàng xóm theo `direction`.
 *  Yêu cầu:
 *   - Cả 2 block là primitive (KHÔNG sub-split). Sub-split phải unsplit trước.
 *   - 2 block phải có axis-perpendicular size khớp (vd up/down → cùng c và cs;
 *     left/right → cùng r và rs) để kết quả vẫn là hình chữ nhật.
 *  Kết quả: 1 block lớn bao trùm cả 2, type = `srcBlock.t` (giữ type của ô user
 *  click), `pre` collect các types/pre của 2 ô con để unmerge restore.
 *  2 block cũ bị xoá khỏi list. Throw nếu không đủ điều kiện. */
export function mergeBlocks(
  blocks: CellBlock[],
  srcR: number,
  srcC: number,
  direction: MergeDirection,
): CellBlock[] {
  const src = findBlockAt(blocks, srcR, srcC);
  if (!src) throw new Error(`mergeBlocks: không có block tại (${srcR}, ${srcC})`);
  if (hasSubSplit(src.t)) {
    throw new Error(`mergeBlocks: block (${srcR}, ${srcC}) đã sub-split — unsplit trước`);
  }
  // Tìm vị trí ô láng giềng dựa trên direction.
  let nR: number;
  let nC: number;
  if (direction === 'up') {
    nR = src.r - 1;
    nC = srcC;
  } else if (direction === 'down') {
    nR = src.r + src.rs;
    nC = srcC;
  } else if (direction === 'left') {
    nR = srcR;
    nC = src.c - 1;
  } else {
    nR = srcR;
    nC = src.c + src.cs;
  }
  const neighbor = findBlockAt(blocks, nR, nC);
  if (!neighbor) {
    throw new Error(`mergeBlocks: không có ô láng giềng theo hướng ${direction}`);
  }
  if (hasSubSplit(neighbor.t)) {
    throw new Error(
      `mergeBlocks: ô láng giềng đã sub-split — unsplit trước (hoặc chọn hướng khác)`,
    );
  }
  // Kiểm tra axis-perpendicular size khớp.
  if (direction === 'up' || direction === 'down') {
    if (src.c !== neighbor.c || src.cs !== neighbor.cs) {
      throw new Error(
        `mergeBlocks: ô láng giềng có chiều rộng khác (src cs=${src.cs}, neighbor cs=${neighbor.cs}) — không thành hình chữ nhật`,
      );
    }
  } else {
    if (src.r !== neighbor.r || src.rs !== neighbor.rs) {
      throw new Error(
        `mergeBlocks: ô láng giềng có chiều cao khác (src rs=${src.rs}, neighbor rs=${neighbor.rs}) — không thành hình chữ nhật`,
      );
    }
  }
  // Tính block lớn bao trùm cả 2.
  const newR = Math.min(src.r, neighbor.r);
  const newC = Math.min(src.c, neighbor.c);
  const newRs = Math.max(src.r + src.rs, neighbor.r + neighbor.rs) - newR;
  const newCs = Math.max(src.c + src.cs, neighbor.c + neighbor.cs) - newC;
  const pre = collectMergedPre(src, neighbor, newR, newC, newRs, newCs);
  const merged: CellBlock = { r: newR, c: newC, rs: newRs, cs: newCs, t: src.t, pre };
  // Loại bỏ src + neighbor, thêm merged.
  return blocks.filter((b) => b !== src && b !== neighbor).concat([merged]);
}

/** Đổi type của 1 sub-cell trong ô đã split. `subIdx` = 0 (L/B) | 1 (R/T). */
export function setSubCellType(
  blocks: CellBlock[],
  row: number,
  col: number,
  subIdx: 0 | 1,
  next: string,
): CellBlock[] {
  const target = findBlockAt(blocks, row, col);
  if (!target) return blocks;
  const parsed = parseSubSplit(target.t);
  if (parsed.primitive !== undefined) return blocks; // chưa split, caller dùng setCell thường
  const newSubs: [string, string] = [...parsed.split.subs];
  newSubs[subIdx] = next;
  const newT = encodeSubSplit({ axis: parsed.split.axis, subs: newSubs });
  return blocks.map((b) => (b === target ? { ...b, t: newT } : b));
}
