// =============================================================================
// Multi-order nesting với offcut pool reuse.
// Wrapper trên nestBoards() — không modify core. Logic 2 phase:
//   1. Ưu tiên fit parts vào matching offcuts (best-fit, sort area ASC)
//   2. Phần còn lại nest stock board mới → leftover rects → add vào pool
//
// Pool key = (material full color string, thickness). KHÔNG match cross-color
// vì offcut MFC xanh navy không thể dùng cho cánh MFC đen (mặt nhìn thấy).
// =============================================================================
import {
  findFirstFit,
  nestBoards,
  splitRect,
  type FreeRect,
} from './index';
import type { Part } from '@/configurator/types';
import type { CatalogBoard } from '@/lib/production-catalog';
import type { NestedBoardLayout, NestedPlacement, NestingResult } from '@/lib/dxf/types';

type NestableInput = Pick<
  Part,
  'id' | 'label' | 'length_mm' | 'width_mm' | 'thickness_mm' | 'material' | 'grain'
>;

export interface OffcutSheet {
  id: string;
  material: string; // FULL color string vd 'mfc_melamine/ml_xanh_navy_edge_den'
  thicknessMm: number;
  lengthMm: number;
  widthMm: number;
  createdAtOrderIdx: number;
  sourceBoardId: string;
}

export interface NestWithOffcutOptions {
  kerfMm: number;
  /** Min dimension (mm) để giữ offcut. Smaller → discard. */
  minOffcutDim: number;
  currentOrderIdx: number;
  /** Offcut age limit (orders). Created > N orders ago → expire. */
  ageLimit: number;
}

export interface NestWithOffcutResult {
  result: NestingResult;
  /** Pool sau khi process order này (carry-over chưa dùng + new offcuts). */
  newPool: OffcutSheet[];
  /** IDs offcuts đã reuse trong order này. */
  reusedSheetIds: string[];
  /** Tổng m² parts đặt trên offcut (savings). */
  reusedAreaM2: number;
  /** Tổng m² stock board mới mua. */
  stockAreaM2: number;
}

/**
 * Merge adjacent free rects để có rect lớn hơn (giảm fragmentation).
 * Đơn giản: 2 rects share full edge (same x range with adjacent y, hoặc ngược lại) → merge.
 * Lặp đến khi không merge được nữa.
 */
function mergeFreeRects(rects: FreeRect[]): FreeRect[] {
  const result = [...rects];
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i];
        const b = result[j];
        // Horizontal merge: same y, h, adjacent x
        if (a.y === b.y && a.h === b.h) {
          if (a.x + a.w === b.x) {
            result[i] = { x: a.x, y: a.y, w: a.w + b.w, h: a.h };
            result.splice(j, 1);
            changed = true;
            break outer;
          }
          if (b.x + b.w === a.x) {
            result[i] = { x: b.x, y: b.y, w: a.w + b.w, h: a.h };
            result.splice(j, 1);
            changed = true;
            break outer;
          }
        }
        // Vertical merge: same x, w, adjacent y
        if (a.x === b.x && a.w === b.w) {
          if (a.y + a.h === b.y) {
            result[i] = { x: a.x, y: a.y, w: a.w, h: a.h + b.h };
            result.splice(j, 1);
            changed = true;
            break outer;
          }
          if (b.y + b.h === a.y) {
            result[i] = { x: b.x, y: b.y, w: a.w, h: a.h + b.h };
            result.splice(j, 1);
            changed = true;
            break outer;
          }
        }
      }
    }
  }
  return result;
}

/** Thử fit parts vào 1 board duy nhất (không tạo board mới). Return placements + leftover + free rects. */
function tryFitOnSingleBoard(
  parts: NestableInput[],
  boardW: number,
  boardH: number,
  kerfMm: number,
): { fitted: NestedPlacement[]; leftover: NestableInput[]; pool: FreeRect[] } {
  let pool: FreeRect[] = [{ x: 0, y: 0, w: boardW, h: boardH }];
  const fitted: NestedPlacement[] = [];
  const leftover: NestableInput[] = [];
  // FFD: sort by max dim DESC (same as nestBoards)
  const sorted = [...parts].sort(
    (a, b) => Math.max(b.length_mm, b.width_mm) - Math.max(a.length_mm, a.width_mm),
  );
  for (const p of sorted) {
    const padL = p.length_mm + kerfMm;
    const padW = p.width_mm + kerfMm;
    const allowRotate = p.grain === 'none';
    const fit = findFirstFit(pool, padL, padW, allowRotate);
    if (!fit) {
      leftover.push(p);
      continue;
    }
    const rect = pool[fit.rectIdx];
    const usedW = fit.rotated ? padW : padL;
    const usedH = fit.rotated ? padL : padW;
    fitted.push({
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
  // Merge adjacent free rects sau khi fit xong (giảm fragmentation cho offcut quality).
  pool = mergeFreeRects(pool);
  return { fitted, leftover, pool };
}

/**
 * Multi-order nesting: ưu tiên tái sử dụng offcut từ pool, fallback stock board.
 *
 * Steps per (material, thickness) group:
 *   1. Filter pool by full color + thickness match
 *   2. Sort offcuts by area ASC (best-fit: nhỏ nhất trước)
 *   3. Try fit remaining parts on each offcut → mark used
 *   4. Residual parts → nestBoards on stock → extract freeRects → add to new pool
 *
 * Pool eviction: carry-over offcuts với age <= ageLimit; new offcuts với min dim >= minOffcutDim.
 */
export function nestWithOffcutPool(
  parts: NestableInput[],
  stockBoards: CatalogBoard[],
  pool: OffcutSheet[],
  options: NestWithOffcutOptions,
): NestWithOffcutResult {
  const { kerfMm, minOffcutDim, currentOrderIdx, ageLimit } = options;
  const usedPoolIds = new Set<string>();
  const orderBoards: NestedBoardLayout[] = [];
  const unplaced: NestingResult['unplaced'] = [];
  let reusedAreaM2 = 0;
  let stockAreaM2 = 0;

  // Group by (full color material, thickness) — color exact match required.
  const groups = new Map<string, NestableInput[]>();
  for (const p of parts) {
    const key = `${p.material}|${p.thickness_mm}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  for (const [key, groupParts] of groups) {
    const [material, thicknessStr] = key.split('|');
    const thickness = Number(thicknessStr);
    let remaining = [...groupParts];

    // PHASE 1: thử offcut pool (best-fit, sort area ASC)
    const matching = pool
      .filter(
        (o) =>
          o.material === material &&
          o.thicknessMm === thickness &&
          !usedPoolIds.has(o.id),
      )
      .sort((a, b) => a.lengthMm * a.widthMm - b.lengthMm * b.widthMm);

    for (const offcut of matching) {
      if (remaining.length === 0) break;
      const { fitted, leftover, pool: leftRects } = tryFitOnSingleBoard(
        remaining,
        offcut.lengthMm,
        offcut.widthMm,
        kerfMm,
      );
      if (fitted.length === 0) continue;
      usedPoolIds.add(offcut.id);
      const layout: NestedBoardLayout = {
        boardId: `offcut:${offcut.id}`,
        boardLength: offcut.lengthMm,
        boardWidth: offcut.widthMm,
        thicknessMm: offcut.thicknessMm,
        materialId: offcut.material,
        placements: fitted,
        utilization:
          fitted.reduce((s, p) => s + p.partLength * p.partWidth, 0) /
          (offcut.lengthMm * offcut.widthMm),
        freeRects: leftRects,
      };
      orderBoards.push(layout);
      reusedAreaM2 +=
        fitted.reduce((s, p) => s + p.partLength * p.partWidth, 0) / 1_000_000;
      remaining = leftover;
    }

    // PHASE 2: nest residual on stock boards
    if (remaining.length > 0) {
      // Build virtual stockBoards với materialId = full color để pickBestBoard match.
      // pickBestBoard match by materialPrefix = first split of part.material.
      // Trick: stockBoards passed in có materialId = prefix (vd 'mfc_melamine'),
      // còn parts có material = full color. nestBoards groups by prefix → match OK.
      const stockResult = nestBoards(remaining, stockBoards, kerfMm);
      for (const b of stockResult.boards) {
        // Override materialId thành full color (đại diện cho order) để pool track đúng.
        b.materialId = material;
        b.boardId = `stock:o${currentOrderIdx}:${b.boardId}`;
        orderBoards.push(b);
        stockAreaM2 += (b.boardLength * b.boardWidth) / 1_000_000;
      }
      unplaced.push(...stockResult.unplaced);
    }
  }

  // Build new pool:
  //   - Carry over offcuts not used + within age
  //   - Add new offcuts từ stock boards mới (filter min dim)
  const newPool: OffcutSheet[] = [];
  for (const o of pool) {
    if (usedPoolIds.has(o.id)) continue;
    if (currentOrderIdx - o.createdAtOrderIdx > ageLimit) continue;
    newPool.push(o);
  }
  for (const board of orderBoards) {
    if (!board.boardId.startsWith('stock:')) continue; // chỉ stock board mới gen offcut
    if (!board.freeRects) continue;
    // Merge adjacent free rects để offcut to hơn (giảm fragmentation, dễ reuse).
    const merged = mergeFreeRects(board.freeRects);
    for (let i = 0; i < merged.length; i++) {
      const fr = merged[i];
      if (Math.min(fr.w, fr.h) < minOffcutDim) continue;
      newPool.push({
        id: `o${currentOrderIdx}-${board.boardId}-${i}`,
        material: board.materialId,
        thicknessMm: board.thicknessMm,
        lengthMm: fr.w,
        widthMm: fr.h,
        createdAtOrderIdx: currentOrderIdx,
        sourceBoardId: board.boardId,
      });
    }
  }

  const avgUtilization =
    orderBoards.length === 0
      ? 0
      : orderBoards.reduce((s, b) => s + b.utilization, 0) / orderBoards.length;

  return {
    result: { boards: orderBoards, unplaced, avgUtilization },
    newPool,
    reusedSheetIds: [...usedPoolIds],
    reusedAreaM2,
    stockAreaM2,
  };
}
