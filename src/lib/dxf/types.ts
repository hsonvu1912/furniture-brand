// =============================================================================
// DXF types — S10. Type cho DXF generator + nesting layout (1 board = nhiều
// placements). Đặt tách riêng để type import sạch giữa furniture-brand + maume.
// =============================================================================

import type { Part } from '@/configurator/types';

/** 1 tấm đã xếp lên 1 board cụ thể trong nesting output. */
export interface NestedPlacement {
  partId: string;
  partLabel: string;
  partLength: number; // length_mm gốc
  partWidth: number; // width_mm gốc
  /** Toạ độ góc TRÁI DƯỚI của tấm trên board (mm). */
  x: number;
  y: number;
  /** True nếu tấm được xoay 90° (length theo trục Y board, width theo X). */
  rotated: boolean;
}

/** 1 board (khổ ván) với placements + tỉ lệ tận dụng. */
export interface NestedBoardLayout {
  boardId: string; // id từ catalog (vd "mdf-18mm-1220x2440")
  boardLength: number; // mm — cạnh dài board
  boardWidth: number; // mm — cạnh ngắn board
  thicknessMm: number; // độ dày ván
  materialId: string; // catalog material id
  placements: NestedPlacement[];
  /** Tổng diện tích phần đã đặt / diện tích board (tính theo khổ ĐÃ CẮT), 0..1. */
  utilization: number;
  /** P64 — Phần khổ ván dùng: 1 = nguyên tấm · 0.5 = NỬA khổ (cắt đôi) · 0.25 =
   *  PHẦN TƯ khổ. Khi <1, boardLength/boardWidth đã thu về khổ đã cắt. Tiền công
   *  cắt = fraction × (giá/tấm). Vắng = 1 (nguyên tấm). */
  fraction?: number;
  /** (tùy chọn) Free rects còn lại sau khi nest — dùng cho offcut pool reuse. */
  freeRects?: { x: number; y: number; w: number; h: number }[];
}

/** Kết quả nesting toàn cutlist — group theo material+thickness. */
export interface NestingResult {
  boards: NestedBoardLayout[];
  /** Tấm KHÔNG xếp được (lớn hơn mọi board phù hợp). */
  unplaced: Pick<Part, 'id' | 'label' | 'length_mm' | 'width_mm' | 'thickness_mm' | 'material'>[];
  /** Tỉ lệ tận dụng trung bình của tất cả board. */
  avgUtilization: number;
}
