// =============================================================================
// NESTING COST — wrapper "1-chỗ-sửa-tất" cho logic hao hụt + nhân công ván cốt.
//
// Tách khỏi nestBoards (core algorithm) để các thông số kinh doanh (sàn hao hụt
// 40%, nhân công 100k/ván, kerf 3mm) nằm 1 chỗ — sửa hệ số ở đây thì mọi caller
// (pricing.ts, scripts, future SSR) tự động hưởng. Founder không phải nhớ N chỗ.
//
// Quy ước:
//  - wasteMultiplier = max(MIN_WASTE_MULTIPLIER, 1 / utilization)
//    → Sàn 40% hao hụt cố định. Nếu nesting cho hao hụt thực > 40% (utilization
//      < 0.714) → dùng hệ số thực để giá phản ánh đúng chi phí ván cốt phải mua.
//  - numSheets = số tấm ván cốt (sheet stock, vd 1220×2440) nesting trả về
//    → laborCost = numSheets × DEFAULT_LABOR_PER_SHEET.
//  - Unplaced > 0: log warn, KHÔNG throw — UI vẫn cho giá (fallback ổn). User
//    đã nói "nesting phải không lỗi" → đây chỉ là safety net cho dev.
// =============================================================================

import { nestBoards } from './index';
import type { Part } from '@/configurator/types';
import type { CatalogBoard } from '@/lib/production-catalog';

/** Sàn hao hụt 40% — user yêu cầu cộng cố định vào tiền ván. */
export const MIN_WASTE_MULTIPLIER = 1.4;

/** Nhân công cắt 1 tấm ván cốt (VND). User chốt 100k/ván. */
export const DEFAULT_LABOR_PER_SHEET = 100_000;

/** Mạch cưa kerf (mm) — khoảng cách giữa các tấm khi cắt. */
export const DEFAULT_KERF_MM = 3;

/** Subset Part cần cho nesting — match `NestableInput` trong nestBoards. */
type NestableInput = Pick<
  Part,
  'id' | 'label' | 'length_mm' | 'width_mm' | 'thickness_mm' | 'material' | 'grain'
>;

/** Kết quả tính chi phí nesting — đầu vào cho pricing engine. */
export interface NestingCost {
  /** Tổng số TẤM VẬT LÝ cần xẻ (mỗi nửa/phần tư vẫn xuất phát từ 1 tấm gốc). Hiển thị. */
  numSheets: number;
  /** P64 — Tổng "tấm quy đổi" tính tiền công = Σ fraction (full=1, nửa=0.5, phần tư=0.25).
   *  laborCost = laborSheets × giá/tấm. */
  laborSheets: number;
  /** P64 — Đếm theo phần khổ: full (nguyên), half (nửa), quarter (phần tư). Cho nhãn. */
  boardBreakdown: { full: number; half: number; quarter: number };
  /** Tỉ lệ tận dụng trung bình từ nesting (0..1) — theo khổ ĐÃ CẮT. */
  avgUtilization: number;
  /** Hệ số nhân vào tiền ván = max(MIN_WASTE_MULTIPLIER, 1/util). */
  wasteMultiplier: number;
  /** Số tấm KHÔNG xếp được (kích thước > khổ ván). 0 = OK. */
  unplacedCount: number;
}

export interface NestingCostOptions {
  /** Override kerf — vắng dùng DEFAULT_KERF_MM. */
  kerfMm?: number;
  /** Override sàn hao hụt — vắng dùng MIN_WASTE_MULTIPLIER. */
  minWasteMultiplier?: number;
}

/**
 * Chạy nesting + quy đổi ra chi phí (số tấm ván + hệ số hao hụt).
 *
 * Caller: pricing.ts gọi với cutlist.parts + catalog.boards.
 * Nếu cutlist rỗng hoặc boards rỗng → trả về zero-cost (numSheets=0, multiplier=sàn).
 */
export function computeNestingCost(
  parts: NestableInput[],
  boards: CatalogBoard[],
  options?: NestingCostOptions,
): NestingCost {
  const kerfMm = options?.kerfMm ?? DEFAULT_KERF_MM;
  const minWaste = options?.minWasteMultiplier ?? MIN_WASTE_MULTIPLIER;

  if (parts.length === 0 || boards.length === 0) {
    return {
      numSheets: 0,
      laborSheets: 0,
      boardBreakdown: { full: 0, half: 0, quarter: 0 },
      avgUtilization: 0,
      wasteMultiplier: minWaste,
      unplacedCount: 0,
    };
  }

  const result = nestBoards(parts, boards, kerfMm);
  const numSheets = result.boards.length;
  // P64 — Tiền công theo phần khổ: full=1, nửa=0.5, phần tư=0.25 (founder: nửa=50k).
  const boardBreakdown = { full: 0, half: 0, quarter: 0 };
  let laborSheets = 0;
  for (const b of result.boards) {
    const f = b.fraction ?? 1;
    laborSheets += f;
    if (f <= 0.25) boardBreakdown.quarter++;
    else if (f <= 0.5) boardBreakdown.half++;
    else boardBreakdown.full++;
  }
  const avgUtilization = result.avgUtilization;
  // Guard chia 0 — utilization rất thấp (< 0.01) → coi như cap ở 1/0.01 = 100x
  // nhưng tỉnh táo dùng minWaste làm sàn (user yêu cầu sàn 40%).
  const wasteFromNesting = avgUtilization > 0.01 ? 1 / avgUtilization : minWaste;
  const wasteMultiplier = Math.max(minWaste, wasteFromNesting);

  if (result.unplaced.length > 0) {
    console.warn(
      `[nesting] ${result.unplaced.length} tấm không xếp được vào khổ ván — check DNA hoặc bổ sung khổ ván lớn hơn trong catalog`,
      result.unplaced.map((p) => `${p.label} (${p.length_mm}×${p.width_mm})`),
    );
  }

  return {
    numSheets,
    laborSheets,
    boardBreakdown,
    avgUtilization,
    wasteMultiplier,
    unplacedCount: result.unplaced.length,
  };
}
