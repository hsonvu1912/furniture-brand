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
import type { NestedBoardLayout, NestedPlacement, NestingResult } from '@/lib/dxf/types';

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

/** P64 — Tìm rect KHÍT NHẤT (Best Short Side Fit): trong các rect chứa được (w,h),
 *  chọn rect để lại CẠNH NGẮN dư nhỏ nhất → xếp khít hơn First-Fit (ít tấm + dồn
 *  cụm → dễ cắt nửa/phần tư). Tie-break: ưu tiên rect gần GÓC TRÁI-DƯỚI (x+y nhỏ)
 *  để gom tấm về 1 góc khổ. */
export function findBestFit(pool: FreeRect[], w: number, h: number, allowRotate: boolean): FitResult | null {
  let best: FitResult | null = null;
  let bestShort = Infinity;
  let bestCorner = Infinity;
  const consider = (i: number, rotated: boolean, shortLeftover: number, corner: number): void => {
    if (shortLeftover < bestShort || (shortLeftover === bestShort && corner < bestCorner)) {
      best = { rectIdx: i, rotated };
      bestShort = shortLeftover;
      bestCorner = corner;
    }
  };
  for (let i = 0; i < pool.length; i++) {
    const r = pool[i];
    const corner = r.x + r.y;
    if (r.w >= w && r.h >= h) consider(i, false, Math.min(r.w - w, r.h - h), corner);
    if (allowRotate && r.w >= h && r.h >= w) consider(i, true, Math.min(r.w - h, r.h - w), corner);
  }
  return best;
}

/** Subset Part cần cho nesting — Part có nhiều field DXF/3D không cần. (P64.9: dùng
 *  sớm trong packOneBoard nên khai báo lên đây.) */
type NestableInput = Pick<
  Part,
  'id' | 'label' | 'length_mm' | 'width_mm' | 'thickness_mm' | 'material' | 'grain'
>;

/** P64.9 — Xếp 1 nhóm tấm vào 1 khổ (boardL×boardW) bằng best-fit guillotine.
 *  Trả placements nếu MỌI tấm vừa; null nếu khổ này KHÔNG chứa hết (1 tấm không vừa). */
/** 1 lần thử xếp theo 1 thứ tự `sorted` cho trước. */
function tryPackOrder(
  sorted: NestableInput[],
  boardL: number,
  boardW: number,
  kerf: number,
): NestedPlacement[] | null {
  let pool: FreeRect[] = [{ x: 0, y: 0, w: boardL, h: boardW }];
  const out: NestedPlacement[] = [];
  for (const p of sorted) {
    const padL = p.length_mm + kerf;
    const padW = p.width_mm + kerf;
    const fit = findBestFit(pool, padL, padW, p.grain === 'none');
    if (!fit) return null; // 1 tấm không vừa → thứ tự này loại
    const rect = pool[fit.rectIdx];
    out.push({
      partId: p.id, partLabel: p.label, partLength: p.length_mm, partWidth: p.width_mm,
      x: rect.x, y: rect.y, rotated: fit.rotated,
    });
    splitRect(pool, fit.rectIdx, fit.rotated ? padW : padL, fit.rotated ? padL : padW);
  }
  return out;
}

/** P64.10 — Xếp 1 nhóm tấm vào 1 khổ. THỬ NHIỀU thứ tự sắp (cạnh dài / diện tích /
 *  rộng / cao) — "xếp khéo": greedy 1 thứ tự dễ thất bại dù có lời giải; thử vài
 *  thứ tự bắt được nhiều ca vừa khổ hơn. Trả placements của thứ tự ĐẦU TIÊN vừa
 *  hết; null nếu mọi thứ tự đều không chứa hết. (Số tấm/board nhỏ → rẻ.) */
function packOneBoard(
  parts: NestableInput[],
  boardL: number,
  boardW: number,
  kerf: number,
): NestedPlacement[] | null {
  const orders: NestableInput[][] = [
    [...parts].sort((a, b) => Math.max(b.length_mm, b.width_mm) - Math.max(a.length_mm, a.width_mm)),
    [...parts].sort((a, b) => b.length_mm * b.width_mm - a.length_mm * a.width_mm),
    [...parts].sort((a, b) => b.width_mm - a.width_mm),
    [...parts].sort((a, b) => b.length_mm - a.length_mm),
  ];
  for (const sorted of orders) {
    const res = tryPackOrder(sorted, boardL, boardW, kerf);
    if (res) return res;
  }
  return null;
}

/** P64 — Cắt khổ ván giảm hao hụt. P64.9: thay vì xét bbox của bản đã xếp trên
 *  full-sheet (dễ bỏ lỡ khi best-fit trải tấm quá nửa), XẾP LẠI các tấm của board
 *  vào khổ NHỎ NHẤT (phần tư → nửa) mà chứa HẾT → bắt được nhiều ca cắt hơn. Khổ
 *  nào vừa thì thu board về khổ đó (toạ độ tấm cập nhật theo). Tối đa cắt tới 1/4. */
export function reclassifyBoard(
  layout: NestedBoardLayout,
  kerfMm: number,
  partOf: (id: string) => NestableInput | undefined,
): void {
  const L = layout.boardLength;
  const W = layout.boardWidth;
  const parts = layout.placements
    .map((pl) => partOf(pl.partId))
    .filter((p): p is NestableInput => !!p);
  // Khổ ứng viên theo diện tích TĂNG dần: phần tư (3 dạng) → nửa (2 dạng).
  const candidates: { l: number; w: number; f: number }[] = [
    { l: L / 4, w: W, f: 0.25 },
    { l: L, w: W / 4, f: 0.25 },
    { l: L / 2, w: W / 2, f: 0.25 },
    { l: L / 2, w: W, f: 0.5 },
    { l: L, w: W / 2, f: 0.5 },
  ];
  for (const c of candidates) {
    const placed = packOneBoard(parts, c.l, c.w, kerfMm);
    if (placed) {
      layout.placements = placed;
      layout.boardLength = c.l;
      layout.boardWidth = c.w;
      layout.fraction = c.f;
      break;
    }
  }
  if (layout.fraction === undefined) layout.fraction = 1; // không khổ nhỏ nào vừa → nguyên tấm
  const totalArea = layout.boardLength * layout.boardWidth;
  const usedArea = layout.placements.reduce((s, pl) => s + pl.partLength * pl.partWidth, 0);
  layout.utilization = totalArea > 0 ? usedArea / totalArea : 0;
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
  // P56 — Group by (FULL color material, thickness). KHÔNG gom theo prefix gốc ván: 2 màu
  // khác nhau KHÔNG cắt chung 1 tấm (bất khả thi vật lý) → mỗi màu nest RIÊNG để số tấm +
  // tận dụng (→ giá) đúng. Khổ ván tồn kho vẫn chọn theo prefix bên dưới (khổ tấm giống nhau
  // mọi màu cùng gốc). Tủ 1 màu: 1 nhóm — hành vi y như trước.
  const groups = new Map<string, NestableInput[]>();
  for (const p of parts) {
    const key = `${p.material}|${p.thickness_mm}`; // vd 'mfc_melamine/ml_xanh_navy|18'
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  const resultBoards: NestedBoardLayout[] = [];
  const unplaced: NestingResult['unplaced'] = [];

  for (const [key, groupParts] of groups) {
    // key = 'material|thickness'; material có thể chứa '/' → tách ở '|' CUỐI cùng.
    const sepIdx = key.lastIndexOf('|');
    const fullMaterial = key.slice(0, sepIdx);
    const thickness = Number(key.slice(sepIdx + 1));
    const prefix = fullMaterial.split('/')[0]; // khổ ván tồn kho chọn theo gốc ván
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

    let boardIdx = 0;
    const groupBoards: NestedBoardLayout[] = [];
    // P64.11 — Best-Fit Decreasing: GIỮ MỌI board đang mở (mỗi board 1 pool free-rect)
    // thay vì chỉ board hiện tại (Next-Fit cũ). Tấm xử lý sau LẤP được chỗ thừa của
    // board trước → ít khổ hơn (vd 2 tấm nhỏ cuối lấp khổ #4 thay vì sinh khổ #6).
    const open: { layout: NestedBoardLayout; pool: FreeRect[] }[] = [];

    const startNewBoard = (): { layout: NestedBoardLayout; pool: FreeRect[] } => {
      boardIdx++;
      const layout: NestedBoardLayout = {
        boardId: `${board.id}-${boardIdx}`,
        boardLength: board.lengthMm,
        boardWidth: board.widthMm,
        thicknessMm: board.thicknessMm,
        materialId: fullMaterial, // P56 — tấm mang ĐÚNG màu đang cắt (DXF + tách màu chuẩn)
        placements: [],
        utilization: 0,
      };
      const ob = { layout, pool: [{ x: 0, y: 0, w: board.lengthMm, h: board.widthMm }] };
      open.push(ob);
      resultBoards.push(layout);
      groupBoards.push(layout);
      return ob;
    };

    for (const p of sorted) {
      // Mỗi tấm padding kerf — phần kerf đảm bảo khoảng cách giữa các tấm khi cắt
      const padL = p.length_mm + kerfMm;
      const padW = p.width_mm + kerfMm;
      // P64.10 — Vòng xếp CHÍNH KHÔNG xoay (giữ ổn định; xoay chỉ ở reclassify).
      const allowRotate = false;

      // P64.11 — Tìm rect KHÍT NHẤT trên TẤT CẢ board đang mở (short side nhỏ nhất).
      let bestOb: { layout: NestedBoardLayout; pool: FreeRect[] } | null = null;
      let bestFit: FitResult | null = null;
      let bestShort = Infinity;
      for (const ob of open) {
        const f = findBestFit(ob.pool, padL, padW, allowRotate);
        if (!f) continue;
        const r = ob.pool[f.rectIdx];
        const short = f.rotated
          ? Math.min(r.w - padW, r.h - padL)
          : Math.min(r.w - padL, r.h - padW);
        if (short < bestShort) {
          bestShort = short;
          bestOb = ob;
          bestFit = f;
        }
      }
      if (!bestOb || !bestFit) {
        // Không board nào còn chỗ → mở board mới.
        const ob = startNewBoard();
        const f = findBestFit(ob.pool, padL, padW, allowRotate);
        if (!f) {
          // Board mới (full kích thước) cũng không vừa → tấm to hơn khổ ván.
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
        bestOb = ob;
        bestFit = f;
      }

      const rect = bestOb.pool[bestFit.rectIdx];
      const usedW = bestFit.rotated ? padW : padL;
      const usedH = bestFit.rotated ? padL : padW;
      bestOb.layout.placements.push({
        partId: p.id,
        partLabel: p.label,
        partLength: p.length_mm,
        partWidth: p.width_mm,
        x: rect.x,
        y: rect.y,
        rotated: bestFit.rotated,
      });
      splitRect(bestOb.pool, bestFit.rectIdx, usedW, usedH);
    }

    // Lưu free rects mỗi board (offcut tracking).
    for (const ob of open) ob.layout.freeRects = [...ob.pool];

    // P64 — Cắt khổ giảm hao hụt. P64.9: reclassifyBoard xếp LẠI tấm vào khổ nhỏ
    // nhất chứa hết → cần map partId→part (lấy grain để biết có xoay được không).
    const partMap = new Map(groupParts.map((p) => [p.id, p]));
    for (const layout of groupBoards) {
      reclassifyBoard(layout, kerfMm, (id) => partMap.get(id));
    }
  }

  // Bỏ board trống (không placement nào)
  const filtered = resultBoards.filter((b) => b.placements.length > 0);
  // P64.8 — Util TỔNG theo DIỆN TÍCH (area-weighted), KHÔNG phải trung bình cộng.
  // Lý do: sau khi cắt nửa/phần tư, các tấm KHÁC khổ nhau → trung bình cộng đơn giản
  // tính ngang trọng số tấm phần tư (nhỏ) với tấm nguyên (to) → SAI hệ số hao hụt.
  //   avgUtilization = Σ(diện tích phần dùng) / Σ(diện tích tấm ĐÃ CẮT)
  //   ⇒ wasteMultiplier = 1/util = (tổng khổ phải mua) / (tổng phần dùng) = hao hụt THẬT.
  // Khi mọi tấm cùng khổ (không cắt) → trùng đúng trung bình cộng cũ (không regression).
  let totalPartArea = 0;
  let totalBoardArea = 0;
  for (const b of filtered) {
    totalBoardArea += b.boardLength * b.boardWidth;
    totalPartArea += b.placements.reduce((s, pl) => s + pl.partLength * pl.partWidth, 0);
  }
  const avgUtilization = totalBoardArea > 0 ? totalPartArea / totalBoardArea : 0;

  return { boards: filtered, unplaced, avgUtilization };
}
