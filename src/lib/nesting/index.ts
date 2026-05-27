// =============================================================================
// Nesting — S10. Guillotine First-Fit Decreasing (FFD) bin-packing 2D.
// Input: parts: Part[] (từ Cutlist.parts raw) + boards: CatalogBoard[] (từ
// production-catalog.boards) + kerfMm. Group parts theo (catalog-material,
// thickness), pick board lớn nhất phù hợp, sort FFD theo max dimension, fit
// vào free rects, split guillotine khi đặt được tấm.
//
// Kerf: mỗi tấm đặt cần +kerfMm cả 2 trục → space giữa 2 tấm = kerf (đường cưa).
// Rotation: chỉ áp dụng nếu `grain === 'none'` (giữ chiều vân gỗ với board).
// =============================================================================

import type { Part } from '@/configurator/types';
import type { CatalogBoard } from '@/lib/production-catalog';
import type { NestedBoardLayout, NestingResult } from '@/lib/dxf/types';

export interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FitResult {
  rectIdx: number;
  rotated: boolean;
}

/** Tìm rect đầu tiên trong pool đủ chứa (w, h). Optionally thử xoay. */
export function findFirstFit(pool: FreeRect[], w: number, h: number, allowRotate: boolean): FitResult | null {
  for (let i = 0; i < pool.length; i++) {
    const r = pool[i];
    if (r.w >= w && r.h >= h) return { rectIdx: i, rotated: false };
    if (allowRotate && r.w >= h && r.h >= w) return { rectIdx: i, rotated: true };
  }
  return null;
}

/**
 * Guillotine split — sau khi đặt 1 tấm vào góc trái-dưới của rect, chia phần
 * còn lại thành 2 rect mới. Chọn split theo trục SHORTER (Shorter Axis Split,
 * SAS heuristic) — giữ rect lớn hơn nguyên vẹn → utilization tốt hơn cho FFD.
 */
export function splitRect(pool: FreeRect[], idx: number, usedW: number, usedH: number): void {
  const r = pool[idx];
  pool.splice(idx, 1);
  const rightW = r.w - usedW;
  const topH = r.h - usedH;
  // Split theo trục có "phần dư" lớn hơn → cắt vuông góc với trục đó.
  if (rightW > topH) {
    // Vertical split: cắt dọc → 1 rect bên phải full chiều cao + 1 rect trên trong cột đã dùng
    if (rightW > 0) pool.push({ x: r.x + usedW, y: r.y, w: rightW, h: r.h });
    if (topH > 0) pool.push({ x: r.x, y: r.y + usedH, w: usedW, h: topH });
  } else {
    // Horizontal split: cắt ngang → 1 rect trên full chiều rộng + 1 rect bên phải trong hàng dùng
    if (topH > 0) pool.push({ x: r.x, y: r.y + usedH, w: r.w, h: topH });
    if (rightW > 0) pool.push({ x: r.x + usedW, y: r.y, w: rightW, h: usedH });
  }
}

/** Pick board lớn nhất theo diện tích trong số board phù hợp materialId + thickness. */
function pickBestBoard(
  boards: CatalogBoard[],
  materialPrefix: string,
  thicknessMm: number,
): CatalogBoard | null {
  const candidates = boards.filter(
    (b) => b.materialId === materialPrefix && b.thicknessMm === thicknessMm,
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (a.lengthMm * a.widthMm > b.lengthMm * b.widthMm ? a : b));
}

/** Field subset cần cho nesting — Part có nhiều field DXF/3D không cần. */
type NestableInput = Pick<
  Part,
  'id' | 'label' | 'length_mm' | 'width_mm' | 'thickness_mm' | 'material' | 'grain'
>;

/**
 * Nest tất cả parts lên khổ ván trong catalog.
 *  - Parts nhóm theo (catalog-material-prefix, thickness) — vd "mdf_son" + 18.
 *  - Mỗi nhóm chọn board lớn nhất phù hợp, xếp FFD theo guillotine.
 *  - Parts không vừa board nào (kích thước > khổ) → vào unplaced.
 *  - Boards rỗng (admin chưa nhập) → mọi part vào unplaced.
 */
export function nestBoards(
  parts: NestableInput[],
  boards: CatalogBoard[],
  kerfMm: number,
): NestingResult {
  // Group by (catalog prefix, thickness)
  const groups = new Map<string, NestableInput[]>();
  for (const p of parts) {
    const prefix = p.material.split('/')[0];
    const key = `${prefix}|${p.thickness_mm}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  const resultBoards: NestedBoardLayout[] = [];
  const unplaced: NestingResult['unplaced'] = [];

  for (const [key, groupParts] of groups) {
    const [prefix, thicknessStr] = key.split('|');
    const thickness = Number(thicknessStr);
    const board = pickBestBoard(boards, prefix, thickness);
    if (!board) {
      for (const p of groupParts) {
        unplaced.push({
          id: p.id,
          label: p.label,
          length_mm: p.length_mm,
          width_mm: p.width_mm,
          thickness_mm: p.thickness_mm,
          material: p.material,
        });
      }
      continue;
    }

    // FFD: sort parts theo MAX dimension desc
    const sorted = [...groupParts].sort(
      (a, b) => Math.max(b.length_mm, b.width_mm) - Math.max(a.length_mm, a.width_mm),
    );

    let currentLayout: NestedBoardLayout | null = null;
    let pool: FreeRect[] = [];
    let boardIdx = 0;
    const groupBoards: NestedBoardLayout[] = [];

    const startNewBoard = (): void => {
      // Save free rects of PREVIOUS board before reset pool (offcut tracking).
      if (currentLayout) currentLayout.freeRects = [...pool];
      boardIdx++;
      currentLayout = {
        boardId: `${board.id}-${boardIdx}`,
        boardLength: board.lengthMm,
        boardWidth: board.widthMm,
        thicknessMm: board.thicknessMm,
        materialId: board.materialId,
        placements: [],
        utilization: 0,
      };
      pool = [{ x: 0, y: 0, w: board.lengthMm, h: board.widthMm }];
      resultBoards.push(currentLayout);
      groupBoards.push(currentLayout);
    };

    startNewBoard();

    for (const p of sorted) {
      // Mỗi tấm padding kerf — phần kerf đảm bảo khoảng cách giữa các tấm khi cắt
      const padL = p.length_mm + kerfMm;
      const padW = p.width_mm + kerfMm;
      const allowRotate = p.grain === 'none';

      let fit = findFirstFit(pool, padL, padW, allowRotate);
      if (!fit) {
        // Hết chỗ trên board hiện tại → mở board mới
        startNewBoard();
        fit = findFirstFit(pool, padL, padW, allowRotate);
        if (!fit) {
          // Cả board mới (fresh, full kích thước) cũng không vừa → tấm to hơn khổ ván
          unplaced.push({
            id: p.id,
            label: p.label,
            length_mm: p.length_mm,
            width_mm: p.width_mm,
            thickness_mm: p.thickness_mm,
            material: p.material,
          });
          continue;
        }
      }

      const rect = pool[fit.rectIdx];
      const usedW = fit.rotated ? padW : padL;
      const usedH = fit.rotated ? padL : padW;
      currentLayout!.placements.push({
        partId: p.id,
        partLabel: p.label,
        partLength: p.length_mm,
        partWidth: p.width_mm,
        x: rect.x,
        y: rect.y,
        rotated: fit.rotated,
      });
      splitRect(pool, fit.rectIdx, usedW, usedH);
    }

    // Save final pool to last board of this group (offcut tracking).
    // Use groupBoards[last] vì currentLayout closure-mutated bị TS narrow sai.
    const lastInGroup = groupBoards[groupBoards.length - 1];
    if (lastInGroup) lastInGroup.freeRects = [...pool];

    // Tính utilization (không trừ kerf — tỉ lệ thực tế của diện tích phần ván dùng)
    for (const layout of groupBoards) {
      const totalArea = layout.boardLength * layout.boardWidth;
      const usedArea = layout.placements.reduce(
        (s, pl) => s + pl.partLength * pl.partWidth,
        0,
      );
      layout.utilization = totalArea > 0 ? usedArea / totalArea : 0;
    }
  }

  // Bỏ board trống (không placement nào)
  const filtered = resultBoards.filter((b) => b.placements.length > 0);
  const avgUtilization =
    filtered.length === 0
      ? 0
      : filtered.reduce((s, b) => s + b.utilization, 0) / filtered.length;

  return { boards: filtered, unplaced, avgUtilization };
}
