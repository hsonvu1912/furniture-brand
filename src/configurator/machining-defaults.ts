// =============================================================================
// DEFAULT_MACHINING_SPEC — S10.1 (additive). Hằng số phụ kiện CNC mặc định theo
// chuẩn "VN cheap common" (xem doc `docs/CNC-WORKSHOP-SPEC.md`).
//
// 1 nơi duy nhất define defaults — cả production-catalog.ts (admin form seed) lẫn
// products/<slug>/dna.ts (engine consume) đều import từ đây. Tránh duplicate.
//
// Engine flow:
//   1. dna.build(values, opts)
//   2. opts?.priceConfig?.machiningSpec (admin catalog) → resolveSpec()
//   3. resolveSpec deep-merge với DEFAULT_MACHINING_SPEC → MachiningSpec đầy đủ
//   4. dna.build() helpers (drillCup, drillPlate,...) đọc spec.<section>.<field>
// =============================================================================

import type { MachiningSpec } from "./types";

export const DEFAULT_MACHINING_SPEC: MachiningSpec = {
  hingeCup: {
    cupDia: 35,
    cupDepth: 13,
    cupInsetFromEdge: 22, // Blum chuẩn
    cupScrewDia: 4,
    cupScrewDepth: 12,
    cupScrewOffset: 24, // Blum 48mm spacing → ±24mm
  },
  hingePlate: {
    plateInsetFromEdge: 37,
    plateScrewSpan: 32, // chuẩn 32mm-system
    plateScrewDia: 4,
    plateScrewDepth: 12,
  },
  drawerSlide: {
    screwDia: 4,
    screwDepth: 12,
    clusterInsetFromEdge: 37,
    clusterScrewSpan: 32, // sửa Bug 2: S10 cũ dùng 16, sai
    gapPerSide: 13,
  },
  confirmat: {
    screwDia: 6.3,
    screwLength: 50,
    pilotDia: 5,
    pilotDepth: 38,
    counterboreDia: 7,
    counterboreDepth: 13,
    perJoint: 2,
    insetFromFront: 50,
    insetFromBack: 50,
  },
  dowel: {
    dowelDia: 8,
    pilotDepthEach: 15,
    perJoint: 2,
  },
  shelfPin: {
    mode: "line32mm",
    pinDia: 5,
    pinDepth: 11,
    columnInsetFromFront: 37,
    columnInsetFromBack: 37,
    lineStartFromBottom: 64,
    lineSpacing: 32,
    lineEndFromTop: 64,
  },
  backFastener: {
    mode: "clip", // founder chọn 2026-05-24
    clipDia: 8,
    clipDepth: 12,
    clipInsetFromBackEdge: 15,
    clipsPerEdge: 2,
    clipMarginFromCellEnd: 80,
    // Fallback values cho mode 'screw'
    screwDia: 3.5,
    screwDepth: 15,
    marginFromCellEdge: 30,
  },
  foot: {
    mode: "pin",
    pinDia: 8,
    pinDepth: 12,
    insetFromEdge: 45,
    positionsPerDivider: 2,
  },
  handle: {
    mode: "recessed",
    recessedDia: 35,
    recessedInsetFromEdge: 40,
  },
};

/**
 * Deep-merge spec from catalog với DEFAULT_MACHINING_SPEC. Giữ DEFAULT cho mọi
 * field thiếu — engine luôn nhận spec đầy đủ, không null check.
 */
export function resolveMachiningSpec(partial?: Partial<MachiningSpec>): MachiningSpec {
  const p = partial ?? {};
  return {
    hingeCup: { ...DEFAULT_MACHINING_SPEC.hingeCup, ...p.hingeCup },
    hingePlate: { ...DEFAULT_MACHINING_SPEC.hingePlate, ...p.hingePlate },
    drawerSlide: { ...DEFAULT_MACHINING_SPEC.drawerSlide, ...p.drawerSlide },
    confirmat: { ...DEFAULT_MACHINING_SPEC.confirmat, ...p.confirmat },
    dowel: { ...DEFAULT_MACHINING_SPEC.dowel, ...p.dowel },
    shelfPin: { ...DEFAULT_MACHINING_SPEC.shelfPin, ...p.shelfPin },
    backFastener: { ...DEFAULT_MACHINING_SPEC.backFastener, ...p.backFastener },
    foot: { ...DEFAULT_MACHINING_SPEC.foot, ...p.foot },
    handle: { ...DEFAULT_MACHINING_SPEC.handle, ...p.handle },
  };
}
