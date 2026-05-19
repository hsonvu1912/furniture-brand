// =============================================================
// CELLGRID — mã hoá / giải mã / chuẩn hoá lưới "loại ô".
// Núm Parameter type 'cellgrid' lưu cả lưới trong MỘT chuỗi (vì ParamValues
// chỉ chứa số/chuỗi đơn). Quy ước: hàng ngăn bằng ';', ô ngăn bằng ',',
// mỗi ô là 1 option value (vd "open-back").
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
 *    → đổi về `fallback`.
 * Dùng khi số hàng/cột đổi, hoặc khi quy tắc cấm (vd ngăn kéo) thay đổi.
 */
export function reconcileCellGrid(
  value: string,
  rows: number,
  cols: number,
  fallback: string,
  disabledByRow: string[][] = [],
  disabledByCol: string[][] = [],
): string[][] {
  const old = parseCellGrid(value);
  const out: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const rowBan = disabledByRow[r] ?? [];
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      const cell = old[r]?.[c] ?? fallback;
      const banned = rowBan.includes(cell) || (disabledByCol[c] ?? []).includes(cell);
      row.push(banned ? fallback : cell);
    }
    out.push(row);
  }
  return out;
}
