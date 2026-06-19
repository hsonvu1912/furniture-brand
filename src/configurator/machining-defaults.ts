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
  // P75 — Häfele Metalla A 110° LỌT LÒNG có giảm chấn, mã 311.88.512 (chén)
  // + bát chữ thập trượt 311.98.700 (founder chốt 12/06/2026). Nguồn: trang chính
  // hãng hafele.com.vn P-01498310 (bát: vít cách 32, cách mép 37) + hafele.com.de
  // Metalla 310 A inset (chén sâu 12, K 3-7mm) + 3 đại lý VN (hệ vít chén 48/6).
  hingeCup: {
    cupDia: 35,
    cupDepth: 12, // chính hãng 12.00mm (cũ 13)
    cupInsetFromEdge: 22, // tâm chén → mép cánh = K + 17.5; K=4.5 (range Hafele 3-7)
    cupScrewDia: 2.5, // lỗ mồi cho vít gỗ Ø3.5 (cũ 4 = sai — đó là Ø vít, không phải lỗ)
    cupScrewDepth: 10,
    cupScrewOffset: 24, // hệ 48: 2 vít cách nhau 48mm
    cupScrewBackset: 6, // hệ /6: tâm vít lùi 6mm vào lòng cánh so với tâm chén
  },
  hingePlate: {
    plateInsetFromEdge: 37, // bản vẽ khoan Hafele: 37mm từ mép trước vách
    plateScrewSpan: 32, // system 32
    plateScrewDia: 2.5, // lỗ mồi cho vít ván dăm Ø3.5
    plateScrewDepth: 11,
  },
  // P76.1 — RAY ÂM Hafele EPC Plus mở 3/4 giảm chấn 433.03.001-.004 (founder chốt
  // 12/06/2026). Số đọc TRỰC TIẾP từ BẢN VẼ LẮP chính hãng (kèm sản phẩm trên
  // bepeu.vn, lưu /tmp/p76-epc/kt-ray-am.jpg): lỗ đầu cách mép trước ray 37; cụm
  // lỗ tại {0,128,224} từ lỗ đầu (ray <300: 2 cụm); mỗi cụm 2 lỗ ĐỨNG cách 12,
  // hàng dưới 10.2 so đáy ô; lòng trong hộc = lòng tủ − 42; lỗ Ø6 hậu hộc 7/11.
  // Còn [xưởng xác nhận]: độ lùi ray (0), sâu lỗ Ø6 (10), khe đáy hộc (bh −20).
  drawerSlide: {
    railScrewPilotDia: 2.5,
    railScrewPilotDepth: 11,
    railFirstScrewFromFront: 37, // bản vẽ (cũ 20 theo đại lý — SAI)
    railScrewRowFromCellBottom: 10.2, // bản vẽ
    railScrewRowSpacing: 12, // bản vẽ
    railSetbackFromFront: 0, // [xưởng xác nhận]
    boxInnerWidthOffset: 42, // bản vẽ 箱体内宽 = B − 42
    backPinHoleDia: 6,
    backPinHoleDepth: 10, // [xưởng xác nhận]
    backPinFromSideEdge: 7, // bản vẽ
    backPinFromBottom: 11, // bản vẽ
    screwDia: 4,
    screwDepth: 12,
  },
  // P74 — Connector 2-in-1 chốt KIM LOẠI (founder chốt 2026-06-12): thân Ø8×30
  // ren + pin Ø5, PAT 50×12×2. Lỗ cạnh Ø8 sâu 32; rãnh PAT 50×13 (vành chìm 2mm)
  // + rãnh giữa 24×9 sâu 8.5. 2 bộ/giao, tâm cách mép trước/sau 50mm.
  connector: {
    pinHoleDia: 8,
    pinHoleDepth: 32,
    slotLength: 50,
    slotWidth: 13,
    rimDepth: 2,
    channelLength: 24,
    channelWidth: 9,
    channelDepth: 8.5,
    perJoint: 2,
    insetFromFront: 50,
    insetFromBack: 50,
  },
  // P74 — Chốt lò xo tấm hậu: pin cạnh trên/dưới HẬU + lỗ đón trên MẶT tấm ngang
  // (trước P74 lỗ clip nằm sai trên mặt vách đứng).
  backFastener: {
    pinDia: 5,
    pinHoleDepth: 25,
    faceHoleDia: 8,
    faceHoleDepth: 10,
    pinsPerEdge: 2,
    marginFromCellEdge: 80,
  },
  foot: {
    mode: "pin", // P77 — chỉ pin Ø8 cấy (founder chốt); plate/screw đã bỏ khỏi type
    pinDia: 8,
    pinDepth: 12,
    insetFromEdge: 90, // P77 — đổi 45→90 khớp hành vi thật (P74 nâng để chân không đè rãnh connector)
    positionsPerDivider: 2,
  },
  handle: {
    // P77 — recessedDia/recessedInsetFromEdge giờ engine ĐỌC thật (trước hằng cứng).
    recessedDia: 35,
    recessedInsetFromEdge: 40,
    barSpacing: 64, // P77 — khoảng 2 vít thanh bar (1 nguồn; engine đọc, clamp trong thân thanh)
    barScrewDia: 4,
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
    // P74: confirmat/dowel/shelfPin trong KV cũ bị DROP (không spread sang spec
    // mới); backFastener shape cũ (mode/clipDia...) cũng vô hại — field mới đọc
    // từ DEFAULT vì KV cũ không có pinDia/faceHoleDia.
    connector: { ...DEFAULT_MACHINING_SPEC.connector, ...p.connector },
    backFastener: { ...DEFAULT_MACHINING_SPEC.backFastener, ...p.backFastener },
    foot: { ...DEFAULT_MACHINING_SPEC.foot, ...p.foot },
    handle: { ...DEFAULT_MACHINING_SPEC.handle, ...p.handle },
  };
}
