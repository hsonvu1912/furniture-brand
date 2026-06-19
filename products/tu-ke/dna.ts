// =============================================================
// SẢN PHẨM: TỦ KỆ — products/tu-ke/dna.ts
// Một hệ tủ kệ LINH HOẠT: 1 file DNA customize ra nhiều loại kệ/tủ.
// Tham số: rộng/cao/sâu, số cột/tầng, chế độ rộng & cao (chia đều / từng
// cột-tầng), và LƯỚI loại từng ô (mở có hậu / mở không hậu / cánh / ngăn kéo).
// Vật liệu: plywood phủ màu trơn 2 mặt, KHÔNG dán cạnh — thân 18mm, ván hậu 9mm.
// Đây là MẪU CHUẨN cho mọi sản phẩm về sau.
//
// Hệ toạ độ scene (mm): X∈[-W/2,W/2], Y∈[0,H] (0=sàn), Z∈[-D/2,D/2] (trước +Z).
// Khung: nóc/đáy/kệ là tấm ngang DÀI (hết W); vách đứng là đoạn NGẮN 1 tầng
// (columns+1 vị trí, gồm 2 mép biên — không có "tấm hông" riêng).
// =============================================================
import {
  blocksToGrid,
  cellsToBlocks,
  encodeCellGrid,
  findBlockAt,
  hasSubSplit,
  isBlocksValue,
  parseCellGrid,
  parseSubSplit,
  type CellBlock,
} from '@/configurator/cellgrid';
import { resolveMachiningSpec } from '@/configurator/machining-defaults';
import { EDGE_BAND_COLORS, edgeHexForBand, resolveMaterial } from '@/configurator/materials';
import type {
  BuildOptions,
  BuildResult,
  CellCavity,
  EdgeBandingType,
  Fitting,
  Hardware,
  Machining,
  MachiningSide,
  MachiningSpec,
  PanelHole,
  ParamValues,
  Parameter,
  Part,
  ProductDNA,
  ResolveContext,
} from '@/configurator/types';

const DEFAULT_T = 18; // độ dày MẶC ĐỊNH thân tủ (mm) — mdf_son, plywood các loại
const MCA_T = 17; // MDF chống ẩm phủ melamine — An Cường/Minh Long ship 17mm physical
const T_BACK = 9; // độ dày ván hậu (mm) — đồng nhất mọi material

/**
 * Body thickness theo material — F2 fix Lỗi 2: dna.ts geometry khớp physical thickness.
 *   - mdf_chong_am_melamine/* → 17mm (An Cường + Minh Long bán 17mm physical)
 *   - mọi material khác → 18mm
 * Pure function — gọi từ build/resolveControls/normalizeValues để derive T trước
 * khi pass xuống helpers (minTotal, evenCell, starts, etc.).
 */
function bodyTFor(material: unknown): number {
  if (typeof material !== 'string') return DEFAULT_T;
  return material.startsWith('mdf_chong_am_melamine/') ? MCA_T : DEFAULT_T;
}
const FRONT_GAP = 4; // khe hở quanh cánh / mặt ngăn kéo (mm)
const WIDE_CELL = 600; // ô rộng hơn mức này → tách 2 cánh (≤ DOOR_MAX_WIDTH)
const CELL_MIN = 150; // thông thuỷ tối thiểu 1 ô (mm) — áp cho cả rộng lẫn cao
const TIER_MAX = 600; // cao tối đa 1 ô (mm) — even mode: chia đều tự thêm tầng nếu vượt
// P48.4: chiều cao tầng RỜI RẠC 4 nấc {15, 25, 35, 45 cm} — CHỈ áp cho manual mode.
// Even mode vẫn chia đều liên tục (preset cũ không vỡ). 1 tầng manual ∈ {150,250,350,450}.
// LƯU Ý: nấc đầu 150 nhưng khoảng cách giữa các nấc là 100 → KHÔNG cộng số học,
// phải dùng stepUp/stepDown đi theo INDEX (xem normalizeValues HEIGHT).
const ROW_HEIGHT_STEPS = [150, 250, 350, 450];
/** Snap giá trị về nấc gần nhất trong danh sách (dùng cho chiều cao tầng manual). */
const snapToStep = (v: number, steps: number[]): number =>
  steps.reduce((best, s) => (Math.abs(s - v) < Math.abs(best - v) ? s : best), steps[0]);
/** Đi 1 nấc LÊN trong ROW_HEIGHT_STEPS (kẹt ở nấc cao nhất). */
const stepUp = (v: number): number =>
  ROW_HEIGHT_STEPS[Math.min(ROW_HEIGHT_STEPS.indexOf(snapToStep(v, ROW_HEIGHT_STEPS)) + 1, ROW_HEIGHT_STEPS.length - 1)];
/** Đi 1 nấc XUỐNG trong ROW_HEIGHT_STEPS (kẹt ở nấc thấp nhất). */
const stepDown = (v: number): number =>
  ROW_HEIGHT_STEPS[Math.max(ROW_HEIGHT_STEPS.indexOf(snapToStep(v, ROW_HEIGHT_STEPS)) - 1, 0)];
const COL_MAX = 700; // P36 v3: rộng tối đa 1 cột (mm) — giảm từ 1200 xuống 700 theo yêu cầu
const DOOR_MAX_WIDTH = 1200; // ô rộng hơn mức này → không cho cánh (kể cả cánh đôi) → mở-có-hậu
const DOOR_MAX_HEIGHT = 600; // ô cao hơn mức này → không cho cánh → mở-có-hậu (P10.2: giảm từ 2400)
// P75: ô/sub-cell THẤP hơn mức này → không cho cánh (faceH = h−4 < 112 không đủ chỗ
// 2 bản lề Hafele cách nhau ≥52mm — chia ngang tầng 150 từng sinh bản lề NGOÀI cánh).
// h=116 giữ được cánh ở chia-ngang tầng 250 (faceH 112, bản lề nén [30, 82]).
const DOOR_MIN_HEIGHT = 116;
// P61 — Cánh (có hậu) cho ô GỘP. Gộp chỉ 2 ô liền kề → block luôn 1×2 hoặc 2×1.
// Giới hạn rộng/cao đủ lớn để nhận MỌI ca gộp 2 ô hợp lệ (2 cột max + 1 vách; 2 tầng cao max + 1 đợt).
// Dùng 18 (vách dày phổ biến) cho phần bù — chỉ là CAP, hình học thật dùng T thực.
const MERGED_DOOR_MAX_W = 2 * COL_MAX + 18; // ~1418mm — cánh đôi mỗi lá ~709mm
const MERGED_DOOR_MAX_H = 2 * ROW_HEIGHT_STEPS[ROW_HEIGHT_STEPS.length - 1] + 18; // ~918mm → 2 bản lề/lá
const HINGE_SHELF_KEEPOUT = 45; // vùng cấm Y quanh mối nối đợt ngang (kệ) để bản lề không vướng (mm)
const DRAWER_MAX_TOP = 1200; // đỉnh ô ≤ mức này mới cho ngăn kéo (tầm với + nhìn thấy đồ)
const DRAWER_MAX_HEIGHT = 400; // ô cao hơn mức này → không cho ngăn kéo (hộc quá cao)
const DRAWER_MAX_WIDTH = 900; // ô rộng hơn mức này → không cho ngăn kéo (ray quá dài) → fallback CÁNH
const FRONT_MIN_WIDTH = 250; // ô hẹp hơn mức này → không cho cánh/ngăn kéo (đủ chỗ ray/bản lề)
// P76 — RAY ÂM Hafele EPC Plus mở 3/4 giảm chấn theo NẤC CHIỀU SÂU TỦ (founder
// chốt 12/06/2026). Sâu 250: KHÔNG cỡ ray nào vừa (lòng 241 < 288) → cấm ngăn kéo.
// minInner = sâu lòng tối thiểu hãng yêu cầu (KÊ: lòng = D − T_BACK 9, đều đạt).
const DRAWER_MIN_DEPTH = 300; // sâu tủ dưới mức này → không cho ngăn kéo → fallback CÁNH
interface RailInfo {
  len: number; // chiều dài ray = chiều sâu thùng hộc (mm)
  sku: string; // mã Hafele
  hwId: string; // id dòng hardware trong catalog/BOM
  minInner: number; // sâu lòng tủ tối thiểu theo hãng
}
const RAIL_BY_DEPTH: Record<number, RailInfo> = {
  300: { len: 270, sku: '433.03.001', hwId: 'drawer-slide-270', minInner: 288 },
  350: { len: 300, sku: '433.03.002', hwId: 'drawer-slide-300', minInner: 318 },
  400: { len: 350, sku: '433.03.003', hwId: 'drawer-slide-350', minInner: 368 },
  450: { len: 400, sku: '433.03.004', hwId: 'drawer-slide-400', minInner: 418 },
};
// P76.1 — vị trí CỤM lỗ vít thân ray theo BẢN VẼ chính hãng: cụm tại {0, 128, 224}
// tính từ LỖ ĐẦU (lỗ đầu cách mép trước ray railFirstScrewFromFront=37). Bản vẽ:
// ray 250-270 chỉ dùng 2 cụm đầu, ray ≥300 đủ 3 cụm. Mỗi cụm = 2 lỗ ĐỨNG cách 12.
const RAIL_CLUSTER_OFFSETS = [0, 128, 224];
const railClustersFor = (railLen: number): number[] =>
  railLen < 300 ? RAIL_CLUSTER_OFFSETS.slice(0, 2) : RAIL_CLUSTER_OFFSETS;
const HOLE_R = 17.5; // bán kính lỗ tay nắm khoét (mm) — Ø35
const HOLE_INSET = 40; // tâm lỗ tay nắm cách mép tấm (mm)
// v3.4.2 — Strip handle (Nam Khang edge profile pull) — L-profile = 2 box.
// Placeholder dimensions; founder bổ sung chính xác qua admin sau.
//   TOP ARM (ngang): nằm trên đỉnh cánh, nhô ra TRƯỚC face
//   BELLY (đứng): áp mặt trước cánh, hạ xuống từ mép trên — "ngón vai" để bám tay
const STRIP_HANDLE_INSET = 0; // sát hết cỡ vào mép cánh (founder spec)
const STRIP_TOP_THICKNESS = 3; // độ dày phần ngang (Y, mm) — thin & tinh tế
const STRIP_TOP_DEPTH = 14; // chiều sâu phần ngang (Z, mm) — nhô ra trước (tỉ lệ Nam Khang thật)
const STRIP_BELLY_HEIGHT = 12; // cao phần đứng (Y, mm) — hạ xuống từ mép cánh
const STRIP_BELLY_DEPTH = 2.5; // dày phần đứng (Z, mm) — mỏng tinh tế
// BELLY nằm Ở MẶT TRƯỚC TOP ARM (cách door face = STRIP_TOP_DEPTH - STRIP_BELLY_DEPTH).
// Tạo "finger pocket" giữa belly và door face → người ta thò tay vào, kéo cánh ra.
const FOOT_H = 5; // chiều cao chân tủ "nút mỏng" (mm) — tủ được nhấc lên đúng mức này
const FOOT_DIA = 18; // đường kính chân tủ (mm)
// P74: 45 → 90 — lỗ chân Ø8 (mặt dưới đáy) tại z = ±(D/2-45) ĐÈ lên rãnh connector
// 2-in-1 (mặt trên đáy, dài 50 tâm cách mép 50 → z ∈ [D/2-75, D/2-25]); sâu chân 12
// + rãnh 10.5 > T=18 → thủng vào rãnh, kẹt PAT. Lùi vào 90mm: mép lỗ cách mép rãnh 11mm.
const FOOT_INSET = 90; // tâm chân cách mép trước / sau tủ (mm)
// Ngưỡng lật tay nắm xuống cạnh DƯỚI: nếu VỊ TRÍ tay-nắm-nếu-đặt-ở-trên (từ sàn)
// > mức này (với không tới) → đặt tay nắm cạnh DƯỚI. Founder chọn 1200 (1600 lớn
// quá, ít ô lật). Dùng chung strip + tròn + bar.
const LOW_HANDLE_FROM_GROUND = 1200;
// v3.5 — Bar handle (P45): thanh nắm đen mờ CĂN GIỮA ngang, tâm cách mép 75mm
// (= ½ của nấc 150mm — vị trí CỐ ĐỊNH cho mọi cánh, "đẹp" theo founder). Thanh đứng
// trên 2 trụ đỡ, nhô ra trước face. Khoan 2 lỗ vít cách nhau barSpacing (catalog).
const BAR_INSET = 60;       // tâm tay nắm cách mép (top/bottom) cánh (mm) — gần mép
const BAR_EDGE_MARGIN = 12; // (cánh) đầu tay nắm cách mép MỞ (đối diện bản lề) (mm)
// Tay nắm PROFILE CHỮ L: tiết diện dày · mặt trước MỎNG · L LUÔN hạ XUỐNG (CÙNG
// chiều mọi cái — không lật). VỊ TRÍ theo logic cũ: ô cao (đáy ≥1200mm từ sàn) →
// mép DƯỚI · else mép TRÊN · cánh → dồn sát mép ĐỐI DIỆN bản lề · ngăn kéo → giữa.
const BAR_LEN = 100;        // chiều dài tay nắm (mm)
const BAR_ARM_THICK = 8;    // dày cánh ngang (Y, mm)
const BAR_ARM_DEPTH = 22;   // cánh ngang nhô ra trước face (Z, mm) — giảm độ nhô
const BAR_LIP_HEIGHT = 13;  // môi đứng hạ xuống (Y, mm) — mặt trước (9 mỏng quá → 13)
const BAR_LIP_THICK = 8;    // dày môi đứng (Z, mm)
// (P74: bỏ PIN_*/BACK_SCREW_* — chốt kệ Ø5 + vít hậu Ø3 thay bằng connector 2-in-1
// và chốt lò xo hậu, thông số đọc từ spec.connector / spec.backFastener.)
// (P75: bỏ hằng HINGE_* — chén + bát bản lề đọc spec.hingeCup/hingePlate theo
// Hafele 311.88.512 + 311.98.700, admin chỉnh được. Hằng cũ ±32 còn SAI hệ 48/6.)
const SLIDE_SCREW_DIA = 4; // vít M4 cố định ray
const SLIDE_SCREW_DEPTH = 12;
const SLIDE_SCREW_INSET_FB = 37; // tâm cụm vít ray cách mép trước/sau vách
const SLIDE_SCREW_SPAN_Y = 16; // 2 lỗ trên/dưới ray cách tâm ray ±16mm theo trục cao
const FOOT_HOLE_DIA = 8; // Ø8 định vị chân tủ xuyên mặt dưới đáy
const FOOT_HOLE_DEPTH = 12;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Kích thước tủ tối thiểu để n ô đều thông thuỷ ≥ CELL_MIN (chế độ chia đều). */
const minTotal = (n: number, T: number) => n * CELL_MIN + (n - 1) * T + 2 * T;
/** minTotal làm tròn LÊN bội số `step` → giá trị slider luôn nằm trên lưới (không bị snap lệch). */
const stepMin = (n: number, step: number, T: number) => Math.ceil(minTotal(n, T) / step) * step;
/** Kích thước 1 ô khi chia đều n ô trong tổng `total` (mm). */
const evenCell = (total: number, n: number, T: number) => (total - 2 * T - (n - 1) * T) / n;

/** Vị trí mép (dưới/trái) của từng phần tử: phần tử 0 bắt đầu ở T, cách nhau T. */
function starts(sizes: number[], T: number): number[] {
  const out: number[] = [];
  let pos = T;
  for (const s of sizes) {
    out.push(pos);
    pos += s + T;
  }
  return out;
}

/** Chiều cao mỗi tầng — P36: RỜI RẠC {150,300,450}, LUÔN per-row (bỏ chế độ even).
 *  Mỗi tầng đọc `tierH_r`; tầng chưa set = snap của chia-đều (giữ ý preset cũ +
 *  tầng mới thêm). Thao tác "đều" (kéo tổng / San đều / đổi số tầng) chỉ là set
 *  mọi tierH_r bằng nhau trong normalizeValues — không còn cờ chế độ riêng. */
function computeRowHeights(values: ParamValues): number[] {
  const T = bodyTFor(values.color);
  const rows = values.rows as number;
  const fallback = snapToStep(evenCell(values.height as number, rows, T), ROW_HEIGHT_STEPS);
  return Array.from({ length: rows }, (_, r) => {
    const raw = values[`tierH_${r}`];
    return raw !== undefined ? snapToStep(Number(raw), ROW_HEIGHT_STEPS) : fallback;
  });
}

/** Bề rộng mỗi cột — P36 v2: LUÔN per-column (giống computeRowHeights). Mỗi cột đọc
 *  colW_c; cột chưa set = chia-đều (fallback). Liên tục (clamp CELL_MIN..COL_MAX). */
function computeColWidths(values: ParamValues): number[] {
  const T = bodyTFor(values.color);
  const columns = values.columns as number;
  const fallback = clamp(Math.round(evenCell(values.width as number, columns, T)), CELL_MIN, COL_MAX);
  return Array.from({ length: columns }, (_, c) => {
    const raw = values[`colW_${c}`];
    return raw !== undefined ? clamp(Math.round(Number(raw)), CELL_MIN, COL_MAX) : fallback;
  });
}

// 4 loại ô khách chọn trên lưới (value đầu tiên = mặc định).
const CELL_TYPES: { value: string; label: string }[] = [
  { value: 'open-back', label: 'Mở (có hậu)' },
  { value: 'open-nobk', label: 'Mở (không hậu)' },
  { value: 'door', label: 'Cánh' },
  { value: 'drawer', label: 'Ngăn kéo' },
];
const DEFAULT_CELL = CELL_TYPES[0].value;

// Danh sách VẬT LIỆU mà Tủ kệ HỖ TRỢ — chỉ ID (whitelist). Label đến từ catalog
// admin qua `ResolveContext.materialLabels` (single source of truth). Nếu catalog
// miss (vd local dev không KV) → `autoLabelFromId` sinh fallback đọc được.
//
// 62 ID (P49 gộp bỏ _edge_den; P51 +2 map vân gỗ):
// 9 mdf_son + 3 plywood_veneer + 17 PLY (11 PLY+ML + 6 PLY+AC) +
// 17 MDF chống ẩm (6 AC + 11 ML) + 16 MFC+ML (14 màu trơn + 2 map vân gỗ Minh Long).
// Thứ tự ảnh hưởng UI picker — giữ y nguyên thứ tự cũ để UX không đổi.
const MATERIAL_IDS: string[] = [
  'mdf_son/vang',
  'mdf_son/cam',
  'mdf_son/do',
  'mdf_son/nau',
  'mdf_son/xanh_la',
  'mdf_son/xanh',
  'mdf_son/xam_nhat',
  'mdf_son/xam',
  'mdf_son/den',
  'plywood_veneer/oak',
  'plywood_veneer/walnut',
  'plywood_veneer/ash',
  'plywood_melamine/ml_xanh_reu',
  'plywood_melamine/ml_do_san_ho',
  'plywood_melamine/ml_xam_am',
  'plywood_melamine/ml_den_espresso',
  'plywood_melamine/ml_xanh_mint',
  'plywood_melamine/ml_xanh_diu',
  'plywood_melamine/ml_xanh_teal_dam',
  'plywood_melamine/ml_caramel',
  'plywood_melamine/ml_olive',
  'plywood_melamine/ml_xanh_navy',
  'plywood_melamine/ml_hong_phan',
  // An Cường — plywood melamine (6 màu, lộ cạnh)
  'plywood_melamine/ac_vang_nghe',
  'plywood_melamine/ac_den_tuyen',
  'plywood_melamine/ac_trang_kem',
  'plywood_melamine/ac_nau_xam',
  'plywood_melamine/ac_xanh_muc',
  'plywood_melamine/ac_xanh_thien_thanh',
  // MDF+AC (An Cường) — MDF chống ẩm phủ melamine (6 màu). Màu cạnh: option "Dán cạnh".
  'mdf_chong_am_melamine/ac_vang_nghe',
  'mdf_chong_am_melamine/ac_den_tuyen',
  'mdf_chong_am_melamine/ac_trang_kem',
  'mdf_chong_am_melamine/ac_nau_xam',
  'mdf_chong_am_melamine/ac_xanh_muc',
  'mdf_chong_am_melamine/ac_xanh_thien_thanh',
  // MDF+ML (Minh Long) — MDF chống ẩm phủ melamine, đồng màu (11 màu)
  'mdf_chong_am_melamine/ml_xanh_reu',
  'mdf_chong_am_melamine/ml_do_san_ho',
  'mdf_chong_am_melamine/ml_xam_am',
  'mdf_chong_am_melamine/ml_den_espresso',
  'mdf_chong_am_melamine/ml_xanh_mint',
  'mdf_chong_am_melamine/ml_xanh_diu',
  'mdf_chong_am_melamine/ml_xanh_teal_dam',
  'mdf_chong_am_melamine/ml_caramel',
  'mdf_chong_am_melamine/ml_olive',
  'mdf_chong_am_melamine/ml_xanh_navy',
  'mdf_chong_am_melamine/ml_hong_phan',
  // MFC+ML (Minh Long) — Ván dăm phủ melamine (14 màu trơn + 2 map vân gỗ). Body 18mm chuẩn.
  // P49: id GỐC (bỏ hậu tố _edge_den) — màu cạnh do option "Dán cạnh" quyết định.
  'mfc_melamine/ml_xanh_reu',
  'mfc_melamine/ml_do_san_ho',
  'mfc_melamine/ml_xam_am',
  'mfc_melamine/ml_den_espresso',
  'mfc_melamine/ml_xanh_mint',
  'mfc_melamine/ml_xanh_diu',
  'mfc_melamine/ml_xanh_teal_dam',
  'mfc_melamine/ml_caramel',
  'mfc_melamine/ml_olive',
  'mfc_melamine/ml_xanh_navy',
  'mfc_melamine/ml_hong_phan',
  // P48.5 — 3 màu Minh Long bổ sung (ML 230 / 027 / 103).
  'mfc_melamine/ml_den_tuyen',
  'mfc_melamine/ml_do_booc_do',
  'mfc_melamine/ml_trang_kem',
  'mfc_melamine/ml_vang_kem_220', // P79 — ML 220 vàng kem nhạt
  // P51 — 2 map VÂN GỖ Minh Long (ảnh thật, render texture đúng tỷ lệ).
  'mfc_melamine/ml_van_go_sang',
  'mfc_melamine/ml_van_go_dam',
  // P59 — 2 map vân gỗ Minh Long bổ sung.
  'mfc_melamine/ml_van_go_soi',
  'mfc_melamine/ml_van_go_oc_cho',
];

/**
 * Sinh label đọc được từ id khi catalog miss (fallback safe).
 *   'mdf_son/vang' → 'Mdf son · Vang'
 *   'plywood_melamine/ml_xanh_navy' → 'Plywood melamine · Ml xanh navy'
 * Hàm THUẦN — chạy được trong test/validator script (không cần catalog).
 */
function autoLabelFromId(id: string): string {
  const cap = (s: string) =>
    s.length === 0 ? '' : s[0].toUpperCase() + s.slice(1).replace(/_/g, ' ');
  const parts = id.split('/');
  return parts.map(cap).join(' · ');
}

/**
 * Sinh option list cho param vật liệu. Ưu tiên label từ `ctx.materialLabels`
 * (catalog admin); thiếu → `autoLabelFromId(id)`. `withFrame` chèn 'frame' đầu
 * danh sách (cho cellColors: "Theo khung" + 41 vật liệu).
 */
function materialOptions(
  ctx?: ResolveContext,
  withFrame = false,
): { value: string; label: string }[] {
  const labelOf = (id: string) => ctx?.materialLabels?.[id] ?? autoLabelFromId(id);
  const opts = MATERIAL_IDS.map((id) => ({ value: id, label: labelOf(id) }));
  return withFrame ? [{ value: FRAME_COLOR, label: 'Theo khung' }, ...opts] : opts;
}
// Lưới "Vật liệu từng ô": ô mang giá trị này → ăn theo "Vật liệu khung" (không đặt riêng).
const FRAME_COLOR = 'frame';

// 3 BƯỚC khách thao tác (wizard). resolveControls gắn mỗi núm vào 1 step.id dưới đây.
const STEPS = [
  { id: 'size', label: 'Kích thước' },
  { id: 'cells', label: 'Thuộc tính ô' },
  { id: 'finish', label: 'Màu & vật liệu' },
];

// --- Cấu hình MẶC ĐỊNH của 2 lưới ô (P18: 4 tầng × 3 cột — khớp rows/columns
// mặc định mới). Default S4: kệ trống lớn — 12 ô mở-có-hậu, màu = khung (clean
// minimalist cho landing visitor). 4 tầng × ~450 = ~1890mm — chuẩn kệ module. ---
const DEFAULT_CELLS = encodeCellGrid([
  ['open-back', 'open-back', 'open-back'],
  ['open-back', 'open-back', 'open-back'],
  ['open-back', 'open-back', 'open-back'],
  ['open-back', 'open-back', 'open-back'],
]);
const DEFAULT_CELL_COLORS = encodeCellGrid([
  [FRAME_COLOR, FRAME_COLOR, FRAME_COLOR],
  [FRAME_COLOR, FRAME_COLOR, FRAME_COLOR],
  [FRAME_COLOR, FRAME_COLOR, FRAME_COLOR],
  [FRAME_COLOR, FRAME_COLOR, FRAME_COLOR],
]);

// --- Núm TĨNH (seed giá trị ban đầu; danh sách hiển thị do resolveControls sinh) ---
const parameters: Parameter[] = [
  { id: 'width', label: 'Chiều rộng', type: 'number', min: 600, max: 2400, step: 1, unit: 'mm', default: 1900 },
  { id: 'height', label: 'Chiều cao', type: 'number', min: 700, max: 2400, step: 1, unit: 'mm', default: 2200 },
  // P76 — 5 nấc {250,300,350,400,450} TINH GỌN THEO RAY ÂM Hafele (founder chốt
  // 12/06/2026): 300→ray 270 · 350→300 · 400→350 · 450→400; nấc 250 KHÔNG có ngăn
  // kéo (không cỡ ray nào vừa, lòng 241 < 288). Bỏ 500-600 (tủ kệ hiếm dùng, đỡ phí
  // ván) — normalizeValues degrade config cũ về 450.
  { id: 'depth', label: 'Chiều sâu', type: 'number', min: 250, max: 450, step: 50, unit: 'mm', default: 400 },
  { id: 'columns', label: 'Số cột', type: 'number', min: 1, max: 10, step: 1, unit: 'cột', default: 3 },
  { id: 'rows', label: 'Số tầng', type: 'number', min: 1, max: 10, step: 1, unit: 'tầng', default: 4 },
  {
    id: 'widthMode',
    label: 'Kích thước cột',
    type: 'option',
    default: 'even',
    options: [
      { value: 'even', label: 'Chia đều' },
      { value: 'manual', label: 'Từng cột' },
    ],
  },
  {
    id: 'heightMode',
    label: 'Kích thước tầng',
    type: 'option',
    default: 'even',
    options: [
      { value: 'even', label: 'Chia đều' },
      { value: 'manual', label: 'Từng tầng' },
    ],
  },
  { id: 'color', label: 'Màu khung', type: 'option', default: 'mfc_melamine/ml_trang_kem', options: materialOptions() },
  // P49 — Dán cạnh: option ĐỘC LẬP (tách khỏi id vật liệu). Áp cho khung + mọi vách/kệ/
  // nóc/đáy. Cánh + ngăn kéo LUÔN đồng màu (build() ép 'same'). resolveControls lọc
  // option theo ctx.enabledEdgeBands (admin bật loại nào) + ẩn khi khung là plywood lộ cạnh.
  {
    id: 'edgeBanding',
    label: 'Màu nẹp',
    type: 'option',
    default: 'black', // P58: mặc định /design = cạnh ĐEN (trước 'same')
    // P52: options sinh từ palette EDGE_BAND_COLORS (đồng màu + đen + trắng + 14 màu ML).
    // resolveControls lọc theo ctx.enabledEdgeBands (admin bật loại nào).
    options: EDGE_BAND_COLORS.map((c) => ({ value: c.id, label: c.label })),
  },
  // P45 — Loại tay nắm: set THEO PRESET trong admin (adminOnly → khách không thấy).
  // P68 — Bỏ 'auto' (suy theo cạnh) khỏi danh sách: gây tay nắm "nhảy" khi đổi màu cạnh.
  // Stray 'auto' (preset cũ chưa ghim) → build() fallback 'bar'.
  {
    id: 'handleType',
    label: 'Loại tay nắm',
    type: 'option',
    default: 'bar', // P58: mặc định /design = tay nắm Bar (profile L)
    adminOnly: true,
    options: [
      { value: 'round', label: 'Tròn' },
      { value: 'strip', label: 'Strip đen' },
      { value: 'bar', label: 'Bar' },
      { value: 'none', label: 'Không tay nắm' }, // P68 — cánh push-open / tủ không tay nắm
    ],
  },
  // 2 mục dưới CHỈ để seed mặc định cho 2 lưới ô — lưới hiển thị do resolveControls sinh.
  { id: 'cells', label: 'Thuộc tính từng ô', type: 'cellgrid', default: DEFAULT_CELLS },
  { id: 'cellColors', label: 'Vật liệu từng ô', type: 'cellgrid', default: DEFAULT_CELL_COLORS },
];

const paramById = (id: string): Parameter => {
  const p = parameters.find((x) => x.id === id);
  if (!p) throw new Error(`Tham số không tồn tại: ${id}`);
  return p;
};

/** 1 thanh trượt kích thước "từng cột/tầng" (mm, bước 10, khớp lưới step). */
function sizeSlider(id: string, label: string, value: number, max: number): Parameter {
  return {
    id,
    label,
    type: 'number',
    min: CELL_MIN,
    max,
    step: 1,
    unit: 'mm',
    default: Math.round(clamp(value, CELL_MIN, max)),
  };
}

/** Gắn nhãn nhóm cho 1 núm — Configurator gom các núm cùng group vào 1 khung có tiêu đề. */
const inGroup = (p: Parameter, group: string): Parameter => ({ ...p, group });

/** Chế độ chia đều: số TẦNG ít nhất để mỗi ô cao ≤ TIER_MAX (chặn trên bởi max núm 'rows'). */
function minRowsForEvenHeight(height: number, T: number): number {
  const max = maxRowsForHeight(height, T);
  let n = 1;
  while (n < max && evenCell(height, n, T) > TIER_MAX) n++;
  return n;
}

/**
 * Số TẦNG NHIỀU NHẤT để mỗi ô chia đều thông thuỷ ≥ CELL_MIN.
 *
 * Đảo công thức `minTotal(n)`:
 *   minTotal(n) = n*CELL_MIN + (n-1)*T + 2*T = n*(CELL_MIN+T) + T
 *   minTotal(n) ≤ height  ⇒  n ≤ (height - T) / (CELL_MIN + T)
 *
 * Với T=18, CELL_MIN=150: height 2400→14, 1200→7, 600→3.
 * Áp cả 2 mode (even + manual) — không cho user vượt giới hạn vật lý.
 */
function maxRowsForHeight(height: number, T: number): number {
  return Math.max(1, Math.floor((height - T) / (CELL_MIN + T)));
}

/** P13.1 — Số CỘT NHIỀU NHẤT để mỗi ô chia đều thông thuỷ ≥ CELL_MIN.
 *  Cùng công thức như maxRowsForHeight: n ≤ (width - T) / (CELL_MIN + T). */
function maxColsForWidth(width: number, T: number): number {
  return Math.max(1, Math.floor((width - T) / (CELL_MIN + T)));
}

/** Chế độ chia đều: số CỘT ít nhất để mỗi ô rộng ≤ COL_MAX (chặn trên bởi max núm 'columns'). */
function minColsForEvenWidth(width: number, T: number): number {
  const max = (paramById('columns').max as number) ?? 5;
  let n = 1;
  while (n < max && evenCell(width, n, T) > COL_MAX) n++;
  return n;
}

/**
 * Sinh danh sách núm theo trạng thái hiện tại:
 *  - chiều rộng/cao: "chia đều" → 1 núm tổng (min động); "từng cột/tầng" → mỗi cái 1 núm.
 *  - lưới loại ô: kích thước theo số cột × số tầng; tầng có đỉnh > 1200mm cấm "ngăn kéo".
 */
function resolveControls(values: ParamValues, ctx?: ResolveContext): Parameter[] {
  const T = bodyTFor(values.color); // F2: body thickness theo material khung
  const columns = values.columns as number;
  const rows = values.rows as number;
  const list: Parameter[] = [];

  // --- Nhóm "Chiều rộng": P36 v2 — GIỐNG Chiều cao. Tổng = thanh KÉO DUY NHẤT
  // (normalizeValues 'total' intent: tự thêm/bớt cột, cột mới mặc định, cột cũ giữ).
  // Rộng TỪNG cột chỉnh bằng CHẠM cột trên mô hình 3D (tab Chiều rộng) → slider
  // min/max (liên tục). BỎ "Số cột" + toggle "Chia đều/Từng cột" + per-col sliders.
  // colRange = [min, max] cho slider popup chỉnh rộng từng cột.
  const wp = paramById('width');
  list.push(inGroup({
    ...wp,
    min: CELL_MIN + 2 * T,
    readonly: false,
    // P47: BỎ sliderOnly → khách gõ rộng tổng trực tiếp (ô nhập commit on-blur/Enter) +
    // vẫn kéo slider được. NumberControl render cả ô nhập lẫn slider khi !sliderOnly.
    throttle: true, // P39: gom onChange ~60fps khi kéo Tổng rộng (hết lag — đây mới là
                    // cơ chế chống lag chính, KHÔNG phải bước step).
    step: 1,        // P42: nhảy 1mm/bước (mịn, theo yêu cầu) — throttle vẫn lo mượt.
    colRange: [CELL_MIN, COL_MAX],
  }, 'Chiều rộng'));

  // --- Nhóm "Chiều cao": P36 — RỜI RẠC {15/30/45cm}, per-row. Tổng = thanh KÉO
  // (normalizeValues 'total' intent: chia đều + bám nấc + tự co/giãn số tầng).
  // Số tầng = slider. Cao TỪNG tầng chỉnh bằng CHẠM tầng trên mô hình 3D (chỉ khi
  // đang ở tab Chiều cao) — KHÔNG còn control per-row trong sidebar, KHÔNG còn
  // toggle chế độ, KHÔNG còn nút 'Cao mỗi tầng'.
  const hp = paramById('height');
  // [1] Tổng — KÉO được (slider) DUY NHẤT của nhóm. Kéo → tự thêm/bớt tầng (tầng
  // mới 30cm), tầng cũ giữ nguyên. min = 1 tầng nhỏ nhất; normalizeValues snap kết quả.
  // rowSteps = các nấc HỢP LỆ cho từng tầng → UI popup "chỉnh cao từng tầng" (chạm 3D).
  // (P36 v2: BỎ slider "Số tầng" + nút "San đều" — thanh Tổng điều khiển luôn số tầng.)
  list.push(inGroup({
    ...hp,
    min: ROW_HEIGHT_STEPS[0] + 2 * T,
    readonly: false,
    sliderOnly: true,
    rowSteps: ROW_HEIGHT_STEPS,
  }, 'Chiều cao'));

  // P47b: chiều sâu CHỈ slider (nấc 50mm) — không nhập số (7 nấc rời rạc, gõ tự do rối).
  list.push({ ...paramById('depth'), sliderOnly: true });

  // --- Lưới loại ô (hiển thị như MẶT ĐỨNG tủ: ô đúng tỉ lệ thật + màu sơn) ---
  const rowHeights = computeRowHeights(values);
  const colWidths = computeColWidths(values);
  const rowBottomY = starts(rowHeights, T);
  // Tắt lựa chọn theo TẦNG: ngăn kéo (đỉnh > DRAWER_MAX_TOP hoặc ô cao > DRAWER_MAX_HEIGHT) ·
  // cánh (cao > DOOR_MAX_HEIGHT — thực tế bằng TIER_MAX nên hiếm khi kích hoạt từ UI).
  // P76: tủ sâu 250 → cấm ngăn kéo MỌI tầng (không cỡ ray âm nào vừa).
  const depthBansDrawer = (values.depth as number) < DRAWER_MIN_DEPTH;
  const disabledByRow = rowHeights.map((h, r) => {
    const out: string[] = [];
    if (depthBansDrawer || rowBottomY[r] + h > DRAWER_MAX_TOP || h > DRAWER_MAX_HEIGHT) {
      out.push('drawer');
    }
    if (h > DOOR_MAX_HEIGHT || h < DOOR_MIN_HEIGHT) out.push('door'); // P75: chặn cả quá lùn
    return out;
  });
  // Tắt lựa chọn theo CỘT: cột < 250 → cả cánh + ngăn kéo · cột > 900 → ngăn kéo ·
  // cột > 1200 → cánh (cả đơn lẫn đôi).
  const disabledByCol = colWidths.map((w) => {
    const out: string[] = [];
    if (w < FRONT_MIN_WIDTH) out.push('drawer', 'door');
    if (w > DRAWER_MAX_WIDTH) out.push('drawer');
    if (w > DOOR_MAX_WIDTH) out.push('door');
    return out;
  });

  // Lưới ô đang lưu (intent) — dùng để (a) khoá ô màu của ô "mở không hậu",
  // (b) tính cellSymbolByPosition cho UI lưới hiển thị đúng biến thể cánh.
  // P3 (blocks-aware): `cells` có thể là format legacy `"a,b;c,d"` HOẶC blocks
  // `"r,c,rs,cs,t|..."`. `cellsToBlocks` auto-detect; `blocksToGrid` expand về
  // 2D đầy đủ cho code legacy đang đọc typeGrid[r][c] hoạt động không đổi.
  const typeGrid = blocksToGrid(
    cellsToBlocks((values.cells as string) ?? '', rows, columns, DEFAULT_CELL),
    rows,
    columns,
    DEFAULT_CELL,
  );

  // cellSymbolByPosition — DNA chọn biến thể icon theo cw + hướng mở cánh:
  //   door + cw > WIDE_CELL  → 'door-double' (2 tam giác đỉnh giữa)
  //   door + cw ≤ WIDE_CELL  → 'door-L' (bản lề trái) hoặc 'door-R' (bản lề phải)
  //   các loại khác           → giữ value (engine vẽ icon mặc định)
  const cellSymbolByPosition = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: columns }, (_, c) => {
      const t = typeGrid[r]?.[c] ?? DEFAULT_CELL;
      if (t !== 'door') return t;
      if (colWidths[c] > WIDE_CELL) return 'door-double';
      return singleDoorHandleSign(c, columns) > 0 ? 'door-L' : 'door-R';
    }),
  );

  list.push({
    id: 'cells',
    label: 'Thuộc tính từng ô',
    type: 'cellgrid',
    options: CELL_TYPES,
    gridRows: rows,
    gridCols: columns,
    disabledByRow,
    disabledByCol,
    // Khi value bị cấm bởi disabled rules, reconcile dùng map này thay vì options[0].
    // Ngăn kéo vi phạm size → cánh (giữ gần ý định nhất), KHÔNG về mở-có-hậu.
    cellFallbackMap: { drawer: 'door' },
    cellSymbolByPosition,
    colSizes: colWidths,
    rowSizes: rowHeights,
    tint: resolveMaterial(values.color as string).hex,
    default: encodeCellGrid(
      Array.from({ length: rows }, () => Array.from({ length: columns }, () => DEFAULT_CELL)),
    ),
  });

  // --- Lưới VẬT LIỆU từng ô — "Theo khung" = ăn theo vật liệu khung ---
  // Ô "mở không hậu" không có tấm nào để phủ vật liệu → khoá ô đó trong lưới màu.
  const lockedCells = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: columns }, (_, c) => typeGrid[r]?.[c] === 'open-nobk'),
  );
  list.push({
    id: 'cellColors',
    label: 'Vật liệu từng ô (hậu / cánh / ngăn kéo)',
    type: 'cellgrid',
    cellVariant: 'color',
    options: materialOptions(ctx, true),
    gridRows: rows,
    gridCols: columns,
    colSizes: colWidths,
    rowSizes: rowHeights,
    lockedCells,
    tint: resolveMaterial(values.color as string).hex,
    default: encodeCellGrid(
      Array.from({ length: rows }, () => Array.from({ length: columns }, () => FRAME_COLOR)),
    ),
  });

  // Tab "Ô tủ" (P36) — placeholder 'info' để tab tồn tại; thao tác loại/màu/gộp/chia
  // thực hiện bằng CHẠM ô trên mô hình 3D (CellBar chỉ bật khi đang ở tab này).
  list.push({
    id: '_cellsTab',
    label: 'Chạm vào ô trên hình để đổi loại ô · màu · gộp · chia.',
    type: 'info',
    group: 'Ô tủ',
    default: '',
  });

  // Param 'color' lấy shape từ static parameters + REBUILD options với ctx labels
  // → label từ catalog (single source) hoặc autoLabelFromId nếu catalog miss.
  list.push(inGroup({ ...paramById('color'), options: materialOptions(ctx) }, 'Vật liệu khung'));

  // P49: "Dán cạnh" — option độc lập (đồng màu / đen / trắng). CHỈ hiện khi:
  //  (a) khung KHÔNG phải plywood lộ cạnh (noEdgeBanding) — plywood giữ lộ cạnh, ẩn option;
  //  (b) admin đã bật ≥1 loại (ctx.enabledEdgeBands). Luôn giữ value hiện tại trong options
  //      kể cả admin vừa tắt loại đó → tránh value "mồ côi" làm control rỗng/đổi ngầm.
  const frameExposed = resolveMaterial(values.color as string).noEdgeBanding === true;
  if (!frameExposed) {
    const allEdge = paramById('edgeBanding').options ?? [];
    const enabled = ctx?.enabledEdgeBands;
    const current = values.edgeBanding as string | undefined;
    const edgeOpts =
      enabled && enabled.length > 0
        ? allEdge.filter((o) => enabled.includes(o.value as EdgeBandingType) || o.value === current)
        : allEdge;
    list.push(inGroup({ ...paramById('edgeBanding'), options: edgeOpts }, 'Vật liệu khung'));
  }

  // P45: "Loại tay nắm" — CÙNG tab "Vật liệu" với màu khung, nhưng adminOnly nên
  // Configurator chỉ render khi mode='admin'. Giá trị vẫn vào values → lưu theo preset.
  list.push(inGroup(paramById('handleType'), 'Vật liệu khung'));

  // Gắn nhãn BƯỚC cho từng núm (wizard): lưới loại ô → 'cells'; lưới vật liệu + vật
  // liệu khung → 'finish'; còn lại (số cột/tầng, chế độ, rộng/cao/sâu) → 'size'.
  return list.map((p) => ({
    ...p,
    stepId:
      p.id === 'cells'
        ? 'cells'
        : p.id === 'cellColors' || p.id === 'color' || p.id === 'edgeBanding' || p.id === 'handleType'
          ? 'finish'
          : 'size',
  }));
}

/**
 * Chuẩn hoá value-set sau mỗi lần khách đổi 1 núm (Configurator gọi qua dna.normalizeValues).
 * Chế độ "chia đều": kéo chiều cao/rộng TỔNG làm 1 ô vượt cỡ tối đa → tự thêm tầng/cột.
 * Chế độ "từng cột/tầng" đã khoá ngay tại slider (sizeSlider max) nên không xử ở đây.
 *
 * CHÚ Ý: trước đây có nhánh "fallback chuỗi cells" tại đây để tránh reconcile nuốt
 * `drawer` thành `open-back`. Nay engine hỗ trợ `Parameter.cellFallbackMap` →
 * reconcile tự dispatch đúng. `values.cells` LUÔN giữ ý định gốc của khách (vd
 * `drawer`) — Configurator chỉ áp fallback khi tính `resolvedValues` cho build().
 * Nhờ vậy khi khách kéo kích thước về lại trị hợp lệ, ô tự "hiện lại" loại cũ.
 */
function normalizeValues(values: ParamValues): ParamValues {
  const v: ParamValues = { ...values };

  // P76 — Chiều sâu về 5 nấc {250..450} bội 50: config cũ 500-600 (URL/saved/preset
  // lạ) degrade về 450, lệch nấc snap về bội 50 gần nhất.
  {
    const d = Number(v.depth);
    if (Number.isFinite(d)) {
      v.depth = Math.max(250, Math.min(450, Math.round(d / 50) * 50));
    }
  }

  // P49/P52 — Migration "dán cạnh tách khỏi vật liệu" (chạy mỗi lần load/đổi giá trị):
  //   1) Khung/ô cũ dùng id "..._edge_den" (cạnh đen hardcode) → strip về id gốc.
  //   2) Khung cũ là _edge_den → ÉP edgeBanding='black' (đè cả default 'same'). Quan trọng:
  //      preset cũ KHÔNG lưu edgeBanding nhưng init seed 'same' → nếu chỉ kiểm 'undefined'
  //      sẽ bỏ sót và ra 'same'. `_edge_den` vốn = cạnh đen nên ép black là đúng ý gốc.
  //      Color đã strip nên lần normalize SAU (color sạch) không ép nữa → khách đổi được.
  //   3) Không _edge_den + chưa set edgeBanding → default 'same'.
  //   4) Khung plywood lộ cạnh (noEdgeBanding) → ép 'same' (không có khái niệm dán cạnh).
  {
    const EDGE_DEN = '_edge_den';
    const colorStr = typeof v.color === 'string' ? v.color : '';
    const colorWasEdgeDen = colorStr.endsWith(EDGE_DEN);
    if (colorWasEdgeDen) v.color = colorStr.slice(0, -EDGE_DEN.length);
    if (typeof v.cellColors === 'string' && v.cellColors.includes(EDGE_DEN)) {
      v.cellColors = (v.cellColors as string).split(EDGE_DEN).join('');
    }
    const eb = v.edgeBanding;
    if (colorWasEdgeDen) {
      v.edgeBanding = 'black'; // _edge_den = cạnh đen → ép, đè default 'same'
    } else if (eb === undefined || eb === null || eb === '') {
      v.edgeBanding = 'same';
    }
    if (resolveMaterial(v.color as string).noEdgeBanding === true) {
      v.edgeBanding = 'same';
    }
  }

  const T = bodyTFor(v.color); // F2: body thickness theo material khung
  // Rows clamp TĨNH 10 (height block lo reject-overflow phần vượt maxH).
  v.rows = Math.min(v.rows as number, paramById('rows').max as number);

  // WIDTH — P40 "mỏ neo có trí nhớ": kéo TỔNG chỉ co giãn cột MẶC ĐỊNH (đều nhau, dải
  //  mềm 300–450, cứng 150–700). Cột ĐÃ-SET neo theo VỊ TRÍ tuyệt đối p với rộng NHỚ
  //  trong `colSetW_p` (TÁCH khỏi rộng hiển thị `colW_c`).
  //   - Kéo NHỎ: cột set ngoài tầm bị ẩn (giữ nhớ); cột set còn hiện mà thiếu chỗ → co
  //     TẠM rộng hiển thị (giữ nhớ), từ phải sang.
  //   - Kéo TO (intent): mỗi lần dựng lại rộng cột set TỪ TRÍ NHỚ ⇒ tự KHÔI PHỤC đúng
  //     rộng + đúng vị trí. (non-intent giữ nguyên rộng hiển thị, không bật lại.)
  //   - Chọn số cột N: quét 1..max, tối ưu rộng-default gần dải + ổn định quanh N hiện tại.
  {
    const maxW = paramById('width').max as number;
    const maxCols = paramById('columns').max as number;
    const DEFAULT_COL = 300;
    const SOFT_MIN = 300;
    const SOFT_MAX = 450;
    const widthIntent = v['__widthIntent'] === 'total';
    delete v['__widthIntent'];

    // Trí nhớ cột đã-set: p (vị trí tuyệt đối) → rộng nhớ. Ưu tiên colSetW_ (mới);
    // migrate cờ cũ colSet_c (P39) → nhớ lấy từ colW hiện tại.
    const setMem = new Map<number, number>();
    for (const k of Object.keys(v)) {
      if (k.startsWith('colSetW_')) {
        const p = Number(k.slice(8));
        if (Number.isFinite(p)) setMem.set(p, clamp(Math.round(Number(v[k])), CELL_MIN, COL_MAX));
      }
    }
    for (const k of Object.keys(v)) {
      if (k.startsWith('colSet_')) {
        const p = Number(k.slice(7));
        const w = v[`colW_${p}`];
        if (Number.isFinite(p) && !setMem.has(p) && w !== undefined) {
          setMem.set(p, clamp(Math.round(Number(w)), CELL_MIN, COL_MAX));
        }
      }
    }
    const curN = clamp(v.columns as number, 1, maxCols);
    // (sum, cnt) cột set HIỂN THỊ (p < n) cho 1 số cột n.
    const setInfo = (n: number): { sum: number; cnt: number } => {
      let sum = 0, cnt = 0;
      for (const [p, w] of setMem) if (p < n) { sum += w; cnt++; }
      return { sum, cnt };
    };

    const target = widthIntent ? clamp(Number(v.width), minTotal(1, T), maxW) : 0;
    let N = curN;
    if (widthIntent) {
      // Quét N=1..maxCols chọn cấu hình tốt nhất: rộng default trong dải 300–450 (phạt
      // theo khoảng cách; <300 phạt gấp đôi → ưu tiên ít-rộng), tổng khớp target, ổn
      // định quanh N hiện tại (tránh nhảy cột lung tung khi kéo).
      let best = { n: curN, score: Infinity };
      for (let n = 1; n <= maxCols; n++) {
        const { sum: setSum, cnt: setCnt } = setInfo(n);
        const defCnt = n - setCnt;
        if (defCnt < 0) continue;
        let total: number;
        let bandPen: number;
        if (defCnt === 0) {
          total = setSum + (n + 1) * T;
          bandPen = 0;
        } else {
          const ideal = (target - (n + 1) * T - setSum) / defCnt;
          if (ideal < CELL_MIN) { total = setSum + defCnt * CELL_MIN + (n + 1) * T; bandPen = CELL_MIN - ideal; }
          else if (ideal > COL_MAX) { total = setSum + defCnt * COL_MAX + (n + 1) * T; bandPen = ideal - COL_MAX; }
          else {
            total = target;
            bandPen = ideal < SOFT_MIN ? (SOFT_MIN - ideal) * 2 : ideal > SOFT_MAX ? ideal - SOFT_MAX : 0;
          }
        }
        const score = Math.abs(total - target) * 50 + bandPen + 2 * Math.abs(n - curN);
        if (score < best.score) best = { n, score };
      }
      N = best.n;
    }

    // Materialize rộng từng cột 0..N-1.
    const { sum: setSum, cnt: setCnt } = setInfo(N);
    const defCnt = N - setCnt;
    // P47: phân bổ NGUYÊN từng-mm cho cột default → tổng = target CHÍNH XÁC (kéo 1mm
    // sạch, hết "dính rồi nhảy theo bội số cột"). base = phần chung; `remMm` mm dư cộng
    // vào `remMm` cột default ĐẦU (mỗi cột +1mm) → các cột default lệch nhau ≤1mm (mắt
    // không thấy) thay vì chia-rồi-làm-tròn (mất tổng). = largest-remainder.
    const availDef = widthIntent && defCnt > 0 ? target - (N + 1) * T - setSum : 0;
    const idealDef = defCnt > 0 ? availDef / defCnt : 0;
    const inBand = idealDef >= CELL_MIN && idealDef <= COL_MAX;
    const baseW =
      defCnt > 0
        ? inBand
          ? Math.floor(availDef / defCnt)
          : clamp(Math.round(idealDef), CELL_MIN, COL_MAX)
        : 0;
    const remMm = inBand ? availDef - baseW * defCnt : 0; // 0..defCnt-1 mm dư
    const widths: number[] = [];
    let defIdx = 0;
    for (let c = 0; c < N; c++) {
      if (widthIntent) {
        if (setMem.has(c)) {
          widths.push(setMem.get(c) as number); // cột SET = rộng NHỚ (khôi phục)
        } else {
          widths.push(baseW + (defIdx < remMm ? 1 : 0)); // +1mm cho `remMm` cột default đầu
          defIdx++;
        }
      } else {
        // non-intent: GIỮ rộng hiển thị hiện tại (không bật lại nhớ → không nhảy tổng).
        const raw = v[`colW_${c}`];
        widths.push(
          raw !== undefined
            ? clamp(Math.round(Number(raw)), CELL_MIN, COL_MAX)
            : setMem.has(c)
              ? (setMem.get(c) as number)
              : DEFAULT_COL,
        );
      }
    }
    // LAST-RESORT (intent): tổng > target vì cột SET quá to → co rộng HIỂN THỊ cột set
    // ngoài cùng PHẢI trước (xuống 150), GIỮ trí nhớ (kéo to lại tự khôi phục).
    if (widthIntent) {
      let deficit = widths.reduce((s, w) => s + w, 0) + (N + 1) * T - target;
      for (let c = N - 1; c >= 0 && deficit > 0; c--) {
        if (!setMem.has(c)) continue;
        const cut = Math.min(widths[c] - CELL_MIN, deficit);
        widths[c] -= cut;
        deficit -= cut;
      }
    }

    // Ghi keys: dọn colW_/colSet_/colSetW_ cũ; ghi colW_0..N-1 + colSetW_p (giữ TẤT CẢ
    // vị trí nhớ, kể cả cột ẩn p≥N → fallback khôi phục khi kéo to lại).
    for (const k of Object.keys(v)) {
      if (k.startsWith('colW_') || k.startsWith('colSet_') || k.startsWith('colSetW_')) delete v[k];
    }
    for (const [p, w] of setMem) v[`colSetW_${p}`] = w;
    widths.forEach((w, c) => { v[`colW_${c}`] = w; });
    v.columns = N;
    v.width = widths.reduce((s, w) => s + w, 0) + (N + 1) * T;
  }
  // HEIGHT — P44 "từng tầng một": kéo TỔNG → CHỈ tầng TRÊN CÙNG lớn/co theo nấc
  //  (15→25→35→45). Đầy 45 → 1 tầng MỚI xuất hiện ở NÓC (15cm) rồi lớn tiếp. Co tầng
  //  trên về 15 rồi kéo nữa → tầng đó BIẾN MẤT. ⇒ tầng xuất hiện/biến mất TỪNG CÁI MỘT,
  //  các tầng dưới + tầng ĐÃ-SET (tierSetH_r) ĐỨNG YÊN. Tầng set ẩn khi kéo nhỏ qua nó →
  //  hiện lại đúng cao+vị trí khi kéo to (trí nhớ, giống Chiều rộng).
  {
    const maxH = paramById('height').max as number;
    const maxRows = paramById('rows').max as number;
    const NAC = ROW_HEIGHT_STEPS[0];                          // 150mm = nấc thấp nhất
    const TOP_NAC = ROW_HEIGHT_STEPS[ROW_HEIGHT_STEPS.length - 1]; // 450 = nấc cao nhất
    const DEFAULT_TIER = ROW_HEIGHT_STEPS[1];                 // 25cm (fallback non-intent)
    const totalIntent = v['__heightIntent'] === 'total';
    delete v['__heightIntent'];

    // Trí nhớ tầng đã-set: position p -> nấc (đông cứng, giữ cả khi ẩn).
    const setMem = new Map<number, number>();
    for (const k of Object.keys(v)) {
      if (k.startsWith('tierSetH_')) {
        const p = Number(k.slice(9));
        if (Number.isFinite(p)) setMem.set(p, snapToStep(Number(v[k]), ROW_HEIGHT_STEPS));
      }
    }
    const curRows = clamp(v.rows as number, 1, maxRows);
    // Mảng tầng hiện tại {set, nac}. Tầng set = nấc nhớ (đứng yên); default = tierH_r.
    type Tier = { set: boolean; nac: number };
    const tiers: Tier[] = [];
    for (let r = 0; r < curRows; r++) {
      if (setMem.has(r)) tiers.push({ set: true, nac: setMem.get(r) as number });
      else {
        const ex = v[`tierH_${r}`];
        tiers.push({ set: false, nac: ex !== undefined ? snapToStep(Number(ex), ROW_HEIGHT_STEPS) : DEFAULT_TIER });
      }
    }

    if (totalIntent) {
      const target = clamp(Number(v.height), NAC + 2 * T, maxH);
      const totalOf = (): number => tiers.reduce((s, t) => s + t.nac, 0) + (tiers.length + 1) * T;
      // Tiến dần về target: mỗi vòng CHỈ thực hiện 1 bước (lớn/co tầng trên 1 nấc, hoặc
      //  thêm/bớt tầng ở nóc) NẾU bước đó đưa tổng GẦN target hơn. Đi nấc theo INDEX
      //  (stepUp/stepDown) — đúng cho nấc cách-đều-100 {150,250,350,450}, không nhảy cóc.
      for (let guard = 0; guard < 400; guard++) {
        const total = totalOf();
        const dist = Math.abs(target - total);
        if (dist === 0) break;
        const top = tiers[tiers.length - 1];
        let moved = false;
        if (target > total) {
          // cần CAO hơn: tầng trên lớn 1 nấc, nếu không thì thêm tầng ở nóc
          if (top && !top.set && top.nac < TOP_NAC) {
            const after = total - top.nac + stepUp(top.nac);
            if (Math.abs(target - after) < dist) { top.nac = stepUp(top.nac); moved = true; }
          }
          if (!moved && tiers.length < maxRows) {
            // tầng MỚI ở nóc: khôi phục tầng set ẩn ở vị trí này (nếu có), else 15cm
            const p = tiers.length;
            const nt = setMem.has(p) ? { set: true, nac: setMem.get(p) as number } : { set: false, nac: NAC };
            if (Math.abs(target - (total + nt.nac + T)) < dist) { tiers.push(nt); moved = true; }
          }
        } else {
          // cần THẤP hơn: tầng trên co 1 nấc, nếu không thì bỏ tầng nóc
          if (top && !top.set && top.nac > NAC) {
            const after = total - top.nac + stepDown(top.nac);
            if (Math.abs(target - after) < dist) { top.nac = stepDown(top.nac); moved = true; }
          }
          if (!moved && tiers.length > 1) {
            const rm = tiers[tiers.length - 1];
            if (Math.abs(target - (total - rm.nac - T)) < dist) { tiers.pop(); moved = true; }  // set → ẩn, memory giữ
          }
        }
        if (!moved) break; // không bước nào tới gần hơn ⇒ đã sát target nhất có thể
      }
    } else {
      // Non-intent (load / chỉnh 1 tầng / đổi rộng…): GIỮ tầng như đang có; reject-overflow.
      while (tiers.length > 1 && tiers.reduce((s, t) => s + t.nac, 0) + (tiers.length + 1) * T > maxH) {
        tiers.pop();
      }
    }

    const N = tiers.length;
    // Ghi keys: dọn tierH_/tierSetH_ cũ; ghi tierH_0..N-1 + tierSetH_p (giữ TẤT CẢ vị trí
    // nhớ, kể cả tầng ẩn p≥N → khôi phục khi kéo to lại).
    for (const k of Object.keys(v)) {
      if (k.startsWith('tierH_') || k.startsWith('tierSetH_')) delete v[k];
    }
    for (const [p, h] of setMem) v[`tierSetH_${p}`] = h;
    tiers.forEach((t, r) => { v[`tierH_${r}`] = t.nac; });
    v.rows = N;
    v.height = tiers.reduce((s, t) => s + t.nac, 0) + (N + 1) * T;
  }
  return v;
}

/**
 * Cảnh báo cho khách — CHỈ hiển thị, KHÔNG chặn build(). Ở chế độ "từng cột/tầng"
 * tổng tủ = cộng dồn các ô nên có thể vượt giới hạn rộng/cao tối đa của sản phẩm.
 */
function getWarnings(values: ParamValues): string[] {
  const out: string[] = [];
  const T = bodyTFor(values.color); // F2: body thickness theo material khung
  const colWidths = computeColWidths(values);
  const rowHeights = computeRowHeights(values);
  const W = colWidths.reduce((s, w) => s + w, 0) + (colWidths.length + 1) * T;
  const H = rowHeights.reduce((s, h) => s + h, 0) + (rowHeights.length + 1) * T;
  const maxW = paramById('width').max as number;
  const maxH = paramById('height').max as number;
  if (W > maxW) {
    out.push(
      `Tổng chiều rộng ${Math.round(W)}mm vượt giới hạn ${maxW}mm — giảm bớt cột hoặc ` +
        `độ rộng từng cột, hoặc liên hệ để đặt kích thước riêng.`,
    );
  }
  if (H > maxH) {
    out.push(
      `Tổng chiều cao ${Math.round(H)}mm vượt giới hạn ${maxH}mm — giảm bớt tầng hoặc ` +
        `độ cao từng tầng, hoặc liên hệ để đặt kích thước riêng.`,
    );
  }
  return out;
}

/**
 * Tạo 1 Part. size = [x,y,z] của hộp 3D; length/width/thickness suy ra bằng
 * cách sắp xếp 3 cạnh giảm dần (cạnh nhỏ nhất = độ dày ván).
 *
 * P49 — dán cạnh là option ĐỘC LẬP (không suy từ id vật liệu nữa). Caller truyền
 * `extra.edge = { banded, type, faceHex }`:
 *   - banded=true  → 4 cạnh dán; edgeColor=type; edgeHex theo type (đen/trắng;
 *                    'same' → undefined = renderer vẽ 1-tone cùng màu mặt).
 *   - banded=false → lộ cạnh (plywood) → edgeBanding all false, không set edgeColor/edgeHex
 *                    (renderer dùng material.edgeHex để vẽ 2-tone cạnh plywood thật).
 * Vắng `extra.edge` → giữ hành vi cũ (all false, không edgeColor) cho part không phải ván.
 */
function panel(
  id: string,
  label: string,
  material: string,
  size: [number, number, number],
  position: [number, number, number],
  extra?: {
    notes?: string;
    holes?: PanelHole[];
    machining?: Machining[];
    hingeOnLeft?: boolean;
    edge?: { banded: boolean; type: EdgeBandingType; faceHex: string };
  },
): Part {
  const [length_mm, width_mm, thickness_mm] = [...size].sort((a, b) => b - a);
  const banded = extra?.edge?.banded ?? false;
  const edgeColor = extra?.edge?.type;
  const edgeHex = extra?.edge && banded ? edgeHexForBand(extra.edge.faceHex, extra.edge.type) : undefined;
  return {
    id,
    label,
    material,
    size,
    position,
    length_mm,
    width_mm,
    thickness_mm,
    // P64.10 — Chiều vân: vật liệu CÓ vân gỗ (oak/walnut/ván vân gỗ) → 'length' (cố
    // định chiều, nesting KHÔNG xoay để giữ vân). Màu TRƠN (đen/trắng/MFC trơn, MDF
    // sơn) → 'none' → nesting được XOAY 90° tự do → xếp khít hơn, cắt nửa/phần tư
    // nhiều hơn. Quy tắc CHUNG theo vật liệu, áp cho mọi tủ.
    grain: resolveMaterial(material).grain === true ? 'length' : 'none',
    edgeBanding: banded
      ? { front: true, back: true, left: true, right: true }
      : { front: false, back: false, left: false, right: false },
    qty: 1,
    notes: extra?.notes,
    holes: extra?.holes,
    machining: extra?.machining,
    // P45: hướng bản lề tường minh (chỉ door set; vắng → renderer suy như cũ).
    ...(extra?.hingeOnLeft !== undefined ? { hingeOnLeft: extra.hingeOnLeft } : {}),
    // P49: màu cạnh đi theo Part (cutlist/pricing/renderer/DXF đọc trực tiếp).
    ...(edgeColor !== undefined ? { edgeColor } : {}),
    ...(edgeHex !== undefined ? { edgeHex } : {}),
  };
}

// =============================================================
// S10 — Helper sinh Machining entries cho panel(). Toạ độ x_mm/y_mm lưu trong
// FRAME PHYSICAL của tấm (gốc trái dưới scene, x theo length axis, y theo width
// axis). DXF generator chịu trách nhiệm flip cho side='back' khi render layer
// DRILL_BACK_*. Field `side` chỉ là metadata "lỗ này gia công từ mặt nào".
// =============================================================

/** Làm tròn 1 chữ số thập phân để gọn DXF output (xưởng VN không cần μm). */
const r1 = (v: number): number => Math.round(v * 10) / 10;

/** Tạo 1 MachiningDrill — `through` tự tính từ depth vs thickness_mm. */
function drill(
  purpose: Machining['purpose'],
  side: MachiningSide,
  x_mm: number,
  y_mm: number,
  diameter_mm: number,
  depth_mm: number,
  thickness_mm: number,
): Machining {
  return {
    op: 'drill',
    purpose,
    side,
    x_mm: r1(x_mm),
    y_mm: r1(y_mm),
    diameter_mm,
    depth_mm,
    through: depth_mm >= thickness_mm - 0.5,
  };
}

/** Tạo 1 MachiningPocket (hốc tròn — cup bản lề âm). */
function pocket(
  purpose: Machining['purpose'],
  side: MachiningSide,
  x_mm: number,
  y_mm: number,
  diameter_mm: number,
  depth_mm: number,
): Machining {
  return { op: 'pocket', purpose, side, x_mm: r1(x_mm), y_mm: r1(y_mm), diameter_mm, depth_mm };
}

/** P74 — Tạo 1 MachiningSlot (rãnh obround cho PAT connector 2-in-1). (x,y) = TÂM rãnh. */
function slot(
  purpose: Machining['purpose'],
  side: MachiningSide,
  x_mm: number,
  y_mm: number,
  length_mm: number,
  width_mm: number,
  depth_mm: number,
  along: 'length' | 'width',
): Machining {
  return {
    op: 'slot',
    purpose,
    side,
    x_mm: r1(x_mm),
    y_mm: r1(y_mm),
    length_mm,
    width_mm,
    depth_mm,
    along,
  };
}

/**
 * Chuyển toạ độ scene tuyệt đối sang frame physical của tấm.
 *   - Length axis = trục có size lớn nhất (theo grain='length')
 *   - Width axis  = trục có size lớn nhì
 *   - x_mm = sceneCoord[lengthAxis] - (partPos[lengthAxis] - size[lengthAxis]/2)
 *   - y_mm = sceneCoord[widthAxis]  - (partPos[widthAxis]  - size[widthAxis]/2)
 * Gọi TRƯỚC khi `p.position[1] += FOOT_H` shift toàn tủ (cùng scene frame).
 */
function panelCoord(
  partSize: [number, number, number],
  partPos: [number, number, number],
  scene: [number, number, number],
): { x_mm: number; y_mm: number } {
  const axes: { idx: 0 | 1 | 2; s: number }[] = [
    { idx: 0, s: partSize[0] },
    { idx: 1, s: partSize[1] },
    { idx: 2, s: partSize[2] },
  ];
  axes.sort((a, b) => b.s - a.s);
  const lAxis = axes[0].idx;
  const wAxis = axes[1].idx;
  return {
    x_mm: scene[lAxis] - (partPos[lAxis] - partSize[lAxis] / 2),
    y_mm: scene[wAxis] - (partPos[wAxis] - partSize[wAxis] / 2),
  };
}

/**
 * P74 — Trục scene (0=X, 1=Y, 2=Z) ứng với LENGTH axis của tấm, theo đúng quy ước
 * sort của panelCoord()/panel() (size lớn nhất; hoà → trục index nhỏ hơn thắng).
 * Dùng để quyết `along` của rãnh slot: rãnh chạy dọc chiều SÂU tủ (scene Z) →
 * along='length' nếu length axis là Z, ngược lại 'width'.
 */
function lengthAxisOf(s: [number, number, number]): 0 | 1 | 2 {
  const axes: { idx: 0 | 1 | 2; v: number }[] = [
    { idx: 0, v: s[0] },
    { idx: 1, v: s[1] },
    { idx: 2, v: s[2] },
  ];
  axes.sort((a, b) => b.v - a.v);
  return axes[0].idx;
}

/**
 * P76 — Chọn RAY ÂM Hafele EPC Plus theo nấc chiều sâu tủ (bảng RAIL_BY_DEPTH).
 * D lẻ nấc (config cũ) snap về bội 50 rồi kẹp [250, 450]. Trả null khi D < 300
 * (sâu 250 không cỡ ray nào vừa — engine đã degrade drawer→door từ trước,
 * null chỉ là phòng thủ).
 */
function railForDepth(D: number): RailInfo | null {
  const snap = Math.max(250, Math.min(450, Math.round(D / 50) * 50));
  return RAIL_BY_DEPTH[snap] ?? null;
}

/**
 * Số bản lề mỗi lá cánh, chia theo chiều cao mặt cánh (mm).
 * <900: 2 · 900–<1800: 3 · 1800–<2200: 4 · 2200–2400: 5.
 * P75: ngưỡng 3 bản lề hạ 1200→900 (khuyến cáo Hafele cho cánh cao/nặng —
 * cánh gộp dọc 2 tầng 450 có faceH 914 nay được 3 bản lề).
 */
function hingeCount(faceH: number): number {
  if (faceH < 900) return 2;
  if (faceH < 1800) return 3;
  if (faceH < 2200) return 4;
  return 5;
}

// P75.1 — vị trí bản lề theo CHUẨN NGÀNH (founder duyệt 12/06, tra Blum/Hettich):
//   • Tâm bản lề cách mép trên/dưới cánh trong dải 60–100mm (Hettich processing
//     instructions; xưởng Mỹ dùng 76 cố định; VN quen 70–100).
//   • "Khoảng cách giữa các bản lề càng LỚN càng tốt" (Blum + Hettich), mục tiêu
//     X ≥ 280mm (Hettich Sensys) khi cánh đủ cao — KHÔNG dồn bản lề vào giữa.
//   • Cánh cực lùn (ngoài chuẩn, < 232mm): nén margin để không chồng lỗ, sàn X = 52
//     (chén Ø35 + vít ±24 hệ 48/6), margin sàn cứng 30 (mép chén cách mép cánh 12.5).
const HINGE_X_TARGET = 280; // Hettich: X tối thiểu khuyến nghị giữa 2 bản lề
const HINGE_X_PHYS = 52; // sàn vật lý không chồng lỗ (chén + vít 48/6)
const HINGE_MARGIN_MIN = 60; // cận dưới dải chuẩn 60–100
const HINGE_MARGIN_MAX = 100; // cận trên dải chuẩn
const HINGE_MARGIN_ABS = 30; // sàn cứng cho cánh ngoại lệ cực lùn

/** Khoảng cách tâm bản lề → mép trên/dưới cánh theo chuẩn (xem block trên). */
function hingeEndMargin(faceH: number): number {
  const m = Math.min(
    HINGE_MARGIN_MAX,
    Math.max(HINGE_MARGIN_MIN, (faceH - HINGE_X_TARGET) / 2),
  );
  // Cánh cực lùn: dải 60–100 không đủ chỗ → nén tới sàn vật lý X=52.
  if (faceH - 2 * m < HINGE_X_PHYS) {
    return Math.max(HINGE_MARGIN_ABS, (faceH - HINGE_X_PHYS) / 2);
  }
  return m;
}

/**
 * Toạ độ Y (mm, từ ĐÁY cánh) của tâm từng bản lề, chia ĐỀU khoảng giữa.
 * Ví dụ (2 bản lề): faceH 914 → mép 100, X 714 · 446 → 83, X 280 · 346 → 60, X 226
 * · 246 → 60, X 126 · 146 → 47, X 52 (ngoại lệ) · 112 → 30, X 52.
 */
function hingeYOnDoor(faceH: number, count: number): number[] {
  if (count <= 1) return [faceH / 2];
  const margin = hingeEndMargin(faceH);
  const span = faceH - 2 * margin;
  return Array.from({ length: count }, (_, i) => margin + (span * i) / (count - 1));
}

/**
 * Cánh ĐƠN — lỗ tay nắm ở mép PHẢI (trả +1) hay TRÁI (-1).
 * Ghép cặp cột tính từ bên PHẢI: trong cặp, cột trái → tay nắm phải, cột phải → trái
 * (2 tay nắm quay vào nhau). Số cột lẻ → cột ngoài cùng bên TRÁI là cột thừa, tay nắm
 * hướng vào trong (phải).
 */
function singleDoorHandleSign(col: number, columns: number): number {
  const hasLeftover = columns % 2 === 1;
  if (hasLeftover && col === 0) return 1; // cột thừa bên trái → tay nắm hướng vào (phải)
  const offset = hasLeftover ? 1 : 0;
  return (col - offset) % 2 === 0 ? 1 : -1; // chẵn = cột trái của cặp → phải; lẻ → trái
}

/** Sinh hình học + phụ kiện từ giá trị tham số khách chọn. */
function build(params: ParamValues, opts?: BuildOptions): BuildResult {
  // S10.1: resolve spec từ catalog (admin override) hoặc DEFAULT_MACHINING_SPEC.
  // Toàn bộ helpers/closures bên dưới đọc `spec.<section>.<field>` thay vì
  // hardcoded constants — Bug fixes (Bug 1-4 trong CNC-WORKSHOP-SPEC.md §10)
  // áp dụng ở B4 refactor.
  const spec: MachiningSpec = resolveMachiningSpec(opts?.priceConfig?.machiningSpec);
  // P74 — 2 spec dùng xuyên suốt: connector 2-in-1 (vách↔tấm ngang) + chốt lò xo hậu.
  const conn = spec.connector;
  const bf = spec.backFastener;
  // P77 — tay nắm TRÒN đọc spec.handle (trước dùng hằng HOLE_R/HOLE_INSET → admin
  // chỉnh vô hiệu, giống bug chén bản lề P75). Default 35/40 = giá trị cũ → DXF
  // không đổi. (HOLE_INSET hằng GIỮ cho handleTopFromFloor — ngưỡng logic trên/dưới.)
  const handleHoleR = (spec.handle.recessedDia ?? 35) / 2;
  const handleInset = spec.handle.recessedInsetFromEdge ?? 40;
  const D = params.depth as number;
  const rail = railForDepth(D); // P76: ray âm Hafele theo nấc sâu (1 cỡ cho cả tủ; null khi D=250)
  const columns = params.columns as number;
  const rows = params.rows as number;
  const frameMaterial = params.color as string;
  // F2: body thickness theo material khung — MCA=17, mdf_son/plywood=18.
  // Mọi panel thân + spacing math dùng T này (cells override color cho back, không thay đổi geometry).
  const T = bodyTFor(frameMaterial);
  // P49 — Màu dán cạnh (option độc lập). Plywood lộ cạnh (noEdgeBanding) → ép 'same'
  // + không thực dán (banded=false ở hậu xử lý). edgeType áp cho khung/vách/kệ/nóc/đáy/
  // lưng; cánh + ngăn kéo LUÔN 'same' (gán ở cuối build()).
  const frameExposed = resolveMaterial(frameMaterial).noEdgeBanding === true;
  const edgeType: EdgeBandingType = frameExposed
    ? 'same'
    : ((((params.edgeBanding as string) || 'same').trim() as EdgeBandingType));
  // P45/P68 — Loại tay nắm = THUỘC TÍNH PRESET (admin chọn), ĐỘC LẬP với màu cạnh:
  //   'round' → tay nắm tròn khoét lỗ Ø35  | 'strip' → nẹp L gắn cạnh (đen)
  //   'bar'   → thanh bar đen mờ CĂN GIỮA + 2 vít (mặc định thương hiệu)
  // P68 — BỎ coupling 'auto'→cạnh: trước đây 'auto' suy tay nắm theo màu cạnh (đen→strip)
  // → khách đổi màu dán cạnh thì tay nắm "nhảy" loại. Nay 'auto'/giá trị lạ/trống → 'bar'
  // cố định. Tay nắm KHÔNG còn phụ thuộc edgeType (edgeType vẫn dùng cho dán cạnh tấm).
  const handleTypeVal = ((params.handleType as string) || 'bar').trim();
  const handleKind: 'round' | 'strip' | 'bar' | 'none' =
    handleTypeVal === 'bar' ? 'bar'
    : handleTypeVal === 'strip' ? 'strip'
    : handleTypeVal === 'round' ? 'round'
    : handleTypeVal === 'none' ? 'none' // P68 — không tay nắm (cánh push-open)
    : 'bar';
  const useStripHandle = handleKind === 'strip'; // giữ biến cũ → ít churn ở 4 site bên dưới
  // Đếm cánh + ngăn kéo để tính số tay nắm cuối hàm.
  let doorCount = 0;
  let drawerCount = 0;
  const cavities: CellCavity[] = []; // P65 — hốc ô mở cho props (chỉ thumbnail)
  // Fittings (chân tủ + strip handle) — hoist trước cells loop để strip handle push được.
  const fittings: Fitting[] = [];
  // Màu từng ô (lưới "Màu từng ô"): FRAME_COLOR (hoặc trống) → ăn theo màu khung.
  // P3 v2 blocks + sub-split aware:
  //   - Parse cellColors qua cellsToBlocks (auto-detect format).
  //   - Mỗi block.t có thể primitive ('frame', 'mfc/oak') HOẶC sub-split ('frame>mfc/oak').
  //   - cellMaterial(r, c, subIdx?) trả về material cho 1 sub-cell cụ thể (subIdx) hoặc
  //     primary color của cell (default = sub 0 nếu sub-split, primitive nếu không).
  const colorBlocks = cellsToBlocks(
    (params.cellColors as string) ?? '',
    params.rows as number,
    params.columns as number,
    FRAME_COLOR,
  );
  const cellMaterial = (r: number, c: number, subIdx?: 0 | 1): string => {
    const block = colorBlocks.find(
      (b) => r >= b.r && r < b.r + b.rs && c >= b.c && c < b.c + b.cs,
    );
    if (!block) return frameMaterial;
    const parsed = parseSubSplit(block.t);
    let v: string;
    if (parsed.primitive !== undefined) {
      v = parsed.primitive;
    } else {
      v = parsed.split.subs[subIdx ?? 0];
    }
    return !v || v === FRAME_COLOR ? frameMaterial : v;
  };

  const rowHeights = computeRowHeights(params);
  const colWidths = computeColWidths(params);
  // Chiều cao/rộng tủ = tổng các ô + các tấm ngăn + 2 tấm biên.
  const H = rowHeights.reduce((s, h) => s + h, 0) + (rows + 1) * T;
  const W = colWidths.reduce((s, w) => s + w, 0) + (columns + 1) * T;

  const rowBottomY = starts(rowHeights, T); // mép dưới mỗi tầng
  const rowCenterY = (r: number) => rowBottomY[r] + rowHeights[r] / 2;

  // Tâm các vách đứng k = 0..columns (toạ độ scene, trục X).
  const vachX: number[] = [];
  for (let k = 0, x = T / 2 - W / 2; k <= columns; k++) {
    vachX.push(x);
    if (k < columns) x += T + colWidths[k];
  }
  const colCenterX = (c: number) => vachX[c] + T / 2 + colWidths[c] / 2;

  // Loại từng ô (lưới đã được Configurator chuẩn hoá đúng rows × columns).
  // Fallback chuỗi (build() phòng hờ — UI lưới đã ẩn sẵn các lựa chọn vi phạm):
  //   drawer vượt ngưỡng (đỉnh / cao / rộng) → door
  //   door vượt ngưỡng (rộng > DOOR_MAX_WIDTH hoặc cao > DOOR_MAX_HEIGHT) → DEFAULT_CELL (mở-có-hậu)
  //   cột < FRONT_MIN_WIDTH → DEFAULT_CELL (cả cánh & ngăn kéo đều không lắp được)
  // P3 blocks-aware: cells có thể là blocks format → cellsToBlocks + blocksToGrid.
  // Đồng thời giữ `cellsBlocks` để vách + kệ đoạn dùng block adjacency.
  const cellsRaw = (params.cells as string) ?? '';
  const cellsBlocks: CellBlock[] = cellsToBlocks(cellsRaw, rows, columns, DEFAULT_CELL);
  const grid = blocksToGrid(cellsBlocks, rows, columns, DEFAULT_CELL);
  /** True nếu 2 ô [r1,c1] và [r2,c2] cùng thuộc 1 block — dùng để biết vách/kệ
   *  ở ranh giới đó có thật (2 block khác) hay là biên ảo bên trong 1 block lớn (skip). */
  const sameBlock = (r1: number, c1: number, r2: number, c2: number): boolean => {
    const a = findBlockAt(cellsBlocks, r1, c1);
    const b = findBlockAt(cellsBlocks, r2, c2);
    return !!a && a === b;
  };
  /** Toggle dual-path Kệ: chỉ segment khi cells THỰC SỰ ở blocks format (có rs>1
   *  thì mới có chance kệ bị nuốt). Legacy uniform → wide panel (giữ baseline 33
   *  validator cases). */
  const useBlockShelves = isBlocksValue(cellsRaw) && cellsBlocks.some((b) => b.rs > 1);
  /** Áp fallback rule cho type theo physical dimensions (w, h, top-from-floor).
   *  Dùng cho cả PRIMITIVE cell và SUB-CELL (sau split) — đảm bảo engine luôn
   *  graceful degrade khi user split tạo sub-cell quá nhỏ cho type.
   *
   *  Rules:
   *   - drawer/door + w < FRONT_MIN_WIDTH (250) → DEFAULT_CELL (open-back)
   *   - drawer + D < DRAWER_MIN_DEPTH (300, P76 ray âm) | top > DRAWER_MAX_TOP (1200)
   *     | h > DRAWER_MAX_HEIGHT (400) | w > DRAWER_MAX_WIDTH (900) → door
   *   - door + w > DOOR_MAX_WIDTH (1200) | h > DOOR_MAX_HEIGHT (600) | h < DOOR_MIN_HEIGHT (116) → DEFAULT_CELL
   *
   *  Áp dụng SEQUENTIAL — drawer có thể fallback drawer → door → open-back.
   */
  const applyTypeFallback = (
    rawType: string,
    w: number,
    h: number,
    topFromFloor: number,
  ): string => {
    let t = rawType;
    if ((t === 'drawer' || t === 'door') && w < FRONT_MIN_WIDTH) return DEFAULT_CELL;
    if (
      t === 'drawer' &&
      (D < DRAWER_MIN_DEPTH || // P76: tủ sâu 250 không có cỡ ray âm nào vừa
        topFromFloor > DRAWER_MAX_TOP ||
        h > DRAWER_MAX_HEIGHT ||
        w > DRAWER_MAX_WIDTH)
    ) {
      t = 'door';
    }
    // P75: thêm chặn cánh QUÁ LÙN (h < DOOR_MIN_HEIGHT) — trước chỉ chặn quá cao/hẹp,
    // chia ngang tầng 150 lọt lưới sinh cánh 62mm với bản lề ngoài cánh.
    if (t === 'door' && (w > DOOR_MAX_WIDTH || h > DOOR_MAX_HEIGHT || h < DOOR_MIN_HEIGHT)) {
      return DEFAULT_CELL;
    }
    return t;
  };
  const cellType = (r: number, c: number): string => {
    const raw = grid[r]?.[c] ?? DEFAULT_CELL;
    return applyTypeFallback(raw, colWidths[c], rowHeights[r], rowBottomY[r] + rowHeights[r]);
  };

  // P61 — CÁNH (có hậu) cho ô GỘP. Kích thước thông thuỷ + tâm khoang gộp (gồm
  // cả bề dày vách giữa đã bị nuốt). Dùng vachX/rowBottomY giống segment kệ (:1754).
  const mergedDims = (block: CellBlock) => {
    const left = vachX[block.c] + T / 2; // mặt trong vách ngoài-trái (k=block.c)
    const right = vachX[block.c + block.cs] - T / 2; // mặt trong vách ngoài-phải (k=block.c+cs)
    const blockW = right - left;
    const centerX = (left + right) / 2;
    const bot = rowBottomY[block.r];
    const top = rowBottomY[block.r + block.rs - 1] + rowHeights[block.r + block.rs - 1];
    const blockH = top - bot;
    const centerY = (bot + top) / 2;
    return { blockW, blockH, centerX, centerY };
  };
  // Trả block nếu (r,c) thuộc 1 ô GỘP đặt type 'door' (cánh có hậu) hợp lệ kích thước; else null.
  // KHÔNG đi qua applyTypeFallback (vốn cap 600/ô) — dùng dims gộp riêng.
  const mergedDoorBlock = (r: number, c: number): CellBlock | null => {
    const block = findBlockAt(cellsBlocks, r, c);
    if (!block) return null;
    if (block.rs === 1 && block.cs === 1) return null; // chưa gộp
    if (hasSubSplit(block.t)) return null;
    if (block.t !== 'door') return null;
    const { blockW, blockH } = mergedDims(block);
    if (blockW < FRONT_MIN_WIDTH || blockW > MERGED_DOOR_MAX_W) return null;
    if (blockH > MERGED_DOOR_MAX_H) return null;
    return block;
  };
  const isMergedDoorCell = (r: number, c: number): boolean => mergedDoorBlock(r, c) !== null;
  const isMergedDoorTopLeft = (r: number, c: number): boolean => {
    const b = mergedDoorBlock(r, c);
    return !!b && b.r === r && b.c === c;
  };

  // Ghi chú cho 1 vách đứng (k, r): chỉ ra bản lề / ray gắn vào vách này, kèm
  // toạ độ Y (mm từ đáy vách). Gộp từ ô bên TRÁI (mép phải vách k) và ô bên PHẢI
  // (mép trái vách k). Đáy vách so với đáy cánh chênh FRONT_GAP/2 → cộng bù vào Y.
  const dividerNote = (k: number, r: number): string | undefined => {
    const out: string[] = [];
    const off = FRONT_GAP / 2;
    const inspect = (c: number, side: 'L' | 'R'): void => {
      const t = cellType(r, c);
      // P61 — CÁNH ô GỘP: ghi chú bản lề gắn trong renderMergedDoor (post-pass) cùng part vách.
      if (mergedDoorBlock(r, c)) return;
      if (t === 'door') {
        const faceH = rowHeights[r] - FRONT_GAP;
        const n = hingeCount(faceH);
        const ys = hingeYOnDoor(faceH, n).map((y) => Math.round(y + off));
        if (colWidths[c] > WIDE_CELL) {
          // cánh đôi: lá trái bản lề mép trái (vách k = k của ô),
          //          lá phải bản lề mép phải (vách k = k của ô + 1).
          const leaf = side === 'L' ? 'phải' : 'trái'; // mép vách so với ô (ô là láng giềng)
          out.push(`Bản lề ô (T${r + 1},C${c + 1}) lá ${leaf} — ${n} cái: Y = ${ys.join(', ')}mm`);
        } else {
          const sign = singleDoorHandleSign(c, columns); // +1: tay nắm phải → bản lề trái
          // side='L' nghĩa là vách là MÉP PHẢI của ô c → cần sign < 0
          // side='R' nghĩa là vách là MÉP TRÁI của ô c → cần sign > 0
          if ((side === 'L' && sign < 0) || (side === 'R' && sign > 0)) {
            out.push(`Bản lề ô (T${r + 1},C${c + 1}) cánh đơn — ${n} cái: Y = ${ys.join(', ')}mm`);
          }
        }
      } else if (t === 'drawer' && rail) {
        out.push(
          `Ray âm ${rail.len}mm (${rail.sku}) ô (T${r + 1},C${c + 1}) — thân ray bắt sát đáy ô, hàng vít xem DXF`,
        );
      }
    };
    if (k > 0) inspect(k - 1, 'L'); // ô bên trái: vách là mép phải của ô đó
    if (k < columns) inspect(k, 'R'); // ô bên phải: vách là mép trái của ô đó
    return out.length ? out.join(' | ') : undefined;
  };

  // --- P74 — Machining trên VÁCH ĐỨNG (connector 2-in-1 thay confirmat/shelfPin/clip) ---
  // Convention: 'front' của vách = mặt PHẢI (X+ scene). 'back' = mặt TRÁI.
  // Lỗ từ ô láng giềng:
  //   - neighborSide='L' (ô bên TRÁI vách = vách là mép phải của ô c) → mặt vách hướng ô = TRÁI = 'back'
  //   - neighborSide='R' (ô bên PHẢI vách = vách là mép trái của ô c) → mặt vách hướng ô = PHẢI = 'front'
  // Vách [T, rowH, D] position [vachX[k], yC, 0] — panelCoord() tự nhận length/width axis.
  //
  // Operations:
  //   Connector 2-in-1 (P74): lỗ chốt Ø8×32 trên CẠNH TRÊN + DƯỚI vách — chốt kim
  //   loại vặn vào cạnh, đầu pin thả vào rãnh PAT trên MẶT tấm ngang (đáy/nóc/kệ).
  //   Rãnh phía NHẬN do post-pass connector cuối build() phát (suy từ hình học part).
  //   (Lỗ MẶT vách giờ toàn bộ do post-pass: bát bản lề P75 emitHingePlates, vít ray
  //    âm P76 emitDrawerRailScrews — suy từ part cánh/hộc, đúng cả ô chia/gộp.
  //    Bỏ P74: shelfPin line 32mm — kệ CỐ ĐỊNH bằng connector; clip hậu bỏ.)
  const dividerMachining = (k: number, r: number): Machining[] => {
    const out: Machining[] = [];

    // === Connector 2-in-1 — lỗ chốt Ø8 sâu 32 trên CẠNH TRÊN + DƯỚI vách ===
    // 2 bộ mỗi giao (perJoint): 1 gần mép trước + 1 gần mép sau, tâm giữa bề dày cạnh.
    // Position dọc cạnh top/bottom (cạnh dài D) = scene Z + D/2.
    const emitConnectorEdge = (edge: 'top' | 'bottom'): void => {
      const zFrontPos = D - conn.insetFromFront; // tâm lỗ 1 (gần mép trước)
      const zBackPos = conn.insetFromBack; // tâm lỗ 2 (gần mép sau)
      for (const pos of [zFrontPos, zBackPos]) {
        out.push({
          op: 'edge_drill',
          purpose: 'connector',
          edge,
          position_mm: pos,
          depth_mm: conn.pinHoleDepth,
          diameter_mm: conn.pinHoleDia,
          thicknessOffset_mm: T / 2, // giữa cạnh
        });
      }
    };
    // Vách k=0..columns đều có cạnh DƯỚI liên kết đáy/kệ + cạnh TRÊN liên kết nóc/kệ.
    // (Vách fused nhiều tầng: filter dưới chỉ giữ edge ngoài cùng — xem fusedMach.)
    emitConnectorEdge('bottom');
    emitConnectorEdge('top');
    return out;
  };

  // --- v3.4.2 — Strip handle = L-profile (2 Fitting box) cho material edge đen ---
  // Profile theo founder spec (Nam Khang edge pull):
  //  • TOP ARM: thanh ngang trên đỉnh cánh, nhô ra trước face (Z+)
  //  • BELLY: thanh đứng áp face cánh, hạ xuống từ mép trên — chỗ bám tay
  // Position:
  //  • X: ĐỐI DIỆN bản lề (handleSign): +1 = handle phải · -1 = trái
  //  • Y: top edge (default) hoặc bottom edge (lowHandle) — mirror for ngược
  //  • Length: ~35% door width, clamp [80, 160]mm
  // Drawer dùng singleDoorHandleSign(col, columns) → same direction as door in column.
  // Returns 2 fittings (top + belly) để fittings.push(...result).
  const makeStripHandle = (
    id: string,
    doorPos: [number, number, number],
    doorSize: [number, number, number], // [w, h, t]
    lowHandle: boolean,
    handleSign: 1 | -1,
  ): Fitting[] => {
    const [w, fH, t] = doorSize;
    const length = Math.max(80, Math.min(160, w * 0.35));
    const xOffset = handleSign * (w / 2 - length / 2 - STRIP_HANDLE_INSET);
    // yEdge: mép cánh (top hay bottom). ySign: hướng OUTWARD từ cánh (+1 trên, -1 dưới).
    const yEdge = lowHandle ? -fH / 2 : fH / 2;
    const ySign = lowHandle ? -1 : 1;
    // TOP ARM: nằm ngang trên đỉnh, tâm Y = mép cánh + STRIP_TOP_THICKNESS/2 ra ngoài.
    // Z: nhô FORWARD từ face cánh — back face TOP ARM = doorFront (flush).
    const topArm: Fitting = {
      id: `${id}-top`,
      kind: 'handle-strip',
      size: [length, STRIP_TOP_THICKNESS, STRIP_TOP_DEPTH],
      position: [
        doorPos[0] + xOffset,
        doorPos[1] + yEdge + ySign * (STRIP_TOP_THICKNESS / 2),
        doorPos[2] + t / 2 + STRIP_TOP_DEPTH / 2,
      ],
      color: '#1a1a1a',
    };
    // BELLY: nằm Ở MẶT TRƯỚC TOP ARM (cách door face = TOP_DEPTH - BELLY_DEPTH/2).
    // Hướng RA NGOÀI cánh tủ → tạo finger pocket cho người dùng nắm + kéo (founder spec).
    // Y: hạ xuống từ mép cánh (ngược chiều ySign).
    const belly: Fitting = {
      id: `${id}-belly`,
      kind: 'handle-strip',
      size: [length, STRIP_BELLY_HEIGHT, STRIP_BELLY_DEPTH],
      position: [
        doorPos[0] + xOffset,
        doorPos[1] + yEdge - ySign * (STRIP_BELLY_HEIGHT / 2),
        doorPos[2] + t / 2 + STRIP_TOP_DEPTH - STRIP_BELLY_DEPTH / 2,
      ],
      color: '#1a1a1a',
    };
    return [topArm, belly];
  };

  // --- P45 — Bar handle = PROFILE CHỮ L (đen mờ): LUÔN mép TRÊN + lip hạ XUỐNG.
  //  sign: 0 = CĂN GIỮA (ngăn kéo) · ±1 = dồn về mép đối diện bản lề (cánh). ---
  const barLenFor = (w: number): number => Math.min(BAR_LEN, w - 60); // kẹp ô hẹp
  // dx tâm tay nắm: cánh → sát mép MỞ (đối diện bản lề); ngăn kéo (sign 0) → giữa.
  const barDx = (w: number, sign: number): number =>
    sign === 0 ? 0 : sign * Math.max(0, w / 2 - barLenFor(w) / 2 - BAR_EDGE_MARGIN);

  // 2 lỗ vít (gần 2 đầu) trên đường INSET từ mép (top/bottom theo lowHandle); lệch theo sign.
  const barScrewHoles = (w: number, fH: number, sign: number, lowHandle: boolean): PanelHole[] => {
    const len = barLenFor(w);
    const r = (spec.handle.barScrewDia ?? 4) / 2;
    const dy = lowHandle ? BAR_INSET - fH / 2 : fH / 2 - BAR_INSET; // ô cao → mép dưới
    const cx = barDx(w, sign);
    // P77 — khoảng 2 vít đọc spec.handle.barSpacing (trước dùng len/2±18 cứng → admin
    // chỉnh vô hiệu). CLAMP trong thân thanh (len) để founder nhập to vít không lọt ra
    // ngoài thanh nắm. Default 64 = hành vi cũ với thanh 100mm.
    const sx = Math.max(20, Math.min((spec.handle.barSpacing ?? 64) / 2, len / 2 - 12));
    return [
      { dx: cx - sx, dy, r },
      { dx: cx + sx, dy, r },
    ];
  };

  // Profile chữ L: ARM ngang (nhô ra trước) + LIP đứng hạ XUỐNG (CÙNG chiều mọi
  // tay nắm — KHÔNG lật). VỊ TRÍ: ô cao → mép DƯỚI, else mép TRÊN (logic cũ). dx
  // theo sign (cánh: dồn mép mở; ngăn kéo sign 0: giữa).
  const makeBarHandle = (
    id: string,
    doorPos: [number, number, number],
    doorSize: [number, number, number],
    sign: number,
    lowHandle: boolean,
  ): Fitting[] => {
    const [w, fH, t] = doorSize;
    const length = barLenFor(w);
    const yEdge = lowHandle ? -fH / 2 : fH / 2;
    const ySign = lowHandle ? -1 : 1;
    const yLine = doorPos[1] + yEdge - ySign * BAR_INSET; // INSET vào trong từ mép (top/bottom)
    const faceZ = doorPos[2] + t / 2;
    const xC = doorPos[0] + barDx(w, sign);
    // ARM: cánh ngang trên đường 75mm, nhô ra TRƯỚC face (Z+).
    const arm: Fitting = {
      id: `${id}-arm`,
      kind: 'handle-bar',
      size: [length, BAR_ARM_THICK, BAR_ARM_DEPTH],
      position: [xC, yLine, faceZ + BAR_ARM_DEPTH / 2],
      color: '#1a1a1a',
    };
    // LIP: môi đứng ở mép TRƯỚC arm, hạ XUỐNG → chữ L hướng xuống (hốc luồn ngón dưới).
    const lip: Fitting = {
      id: `${id}-lip`,
      kind: 'handle-bar',
      size: [length, BAR_LIP_HEIGHT, BAR_LIP_THICK],
      position: [xC, yLine - BAR_LIP_HEIGHT / 2, faceZ + BAR_ARM_DEPTH - BAR_LIP_THICK / 2],
      color: '#1a1a1a',
    };
    return [arm, lip];
  };

  // Note tay nắm theo handleKind (cho cut-list — người đọc).
  const handleNote = (vWord: string, extra: string): string =>
    (handleKind === 'strip'
      ? `Tay nắm strip đen gắn cạnh ${vWord}`
      : handleKind === 'bar'
        ? `Tay nắm bar đen căn giữa · cách mép ${vWord} 75mm · 2 vít`
        : handleKind === 'none'
          ? `Không tay nắm` // P68 — cánh push-open: không khoét, không nẹp
          : `Khoét lỗ tay nắm Ø35 cạnh ${vWord}`) + ` · ${extra}`;

  // --- S10 — Machining trên CÁNH + MẶT NGĂN KÉO ---
  // 'front' = mặt khách nhìn (Z+ scene). Tay nắm Ø35 xuyên → through=true.
  // Chén bản lề Ø35×12 ở side='back' (mặt TRONG cánh) — spec.hingeCup (Hafele
  // 311.88.512, hệ vít 48/6: ±cupScrewOffset theo trục Y + lùi cupScrewBackset).
  // hingeSign: +1=mép TRÁI cánh, −1=mép PHẢI, 0=không có bản lề (mặt ngăn kéo).
  const frontFaceMachining = (
    doorSize: [number, number, number],
    doorPos: [number, number, number],
    faceH: number,
    faceW: number,
    hingeSign: 1 | -1 | 0,
    handleHoles: PanelHole[], // P45: 0..n lỗ tay nắm (round=1 Ø35, bar=2 vít, strip=0)
    ysOverride?: number[], // P61: Y bản lề CHUNG cho cánh ô gộp (đã né đợt ngang); vắng → tự tính
  ): Machining[] => {
    const out: Machining[] = [];
    for (const hole of handleHoles) {
      const sceneHandle: [number, number, number] = [
        doorPos[0] + hole.dx,
        doorPos[1] + hole.dy,
        doorPos[2],
      ];
      const h = panelCoord(doorSize, doorPos, sceneHandle);
      out.push(drill('handle', 'front', h.x_mm, h.y_mm, hole.r * 2, T, T));
    }

    if (hingeSign !== 0) {
      const ys = ysOverride ?? hingeYOnDoor(faceH, hingeCount(faceH));
      // P75 — đọc spec.hingeCup (admin chỉnh được; trước dùng hằng cứng HINGE_* nên
      // chỉnh admin vô hiệu). Hafele 311.88.512: chén Ø35×12, vít hệ 48/6.
      const hc = spec.hingeCup;
      // Tâm chén cách mép cánh cupInsetFromEdge theo trục X scene (chiều rộng cánh):
      //   hingeSign=+1 → mép TRÁI: xCup = doorPos.x - faceW/2 + inset
      //   hingeSign=-1 → mép PHẢI: xCup = doorPos.x + faceW/2 - inset
      const xCupScene = doorPos[0] + hingeSign * (-faceW / 2 + hc.cupInsetFromEdge);
      // Vít chén LÙI cupScrewBackset (6mm) vào LÒNG cánh so với tâm chén (hệ /6).
      const xScrewScene = xCupScene + hingeSign * hc.cupScrewBackset;
      for (const ydoor of ys) {
        const yScene = doorPos[1] - faceH / 2 + ydoor;
        const cup = panelCoord(doorSize, doorPos, [xCupScene, yScene, doorPos[2]]);
        out.push(pocket('hinge', 'back', cup.x_mm, cup.y_mm, hc.cupDia, hc.cupDepth));
        for (const dy of [-hc.cupScrewOffset, hc.cupScrewOffset]) {
          const sc = panelCoord(doorSize, doorPos, [xScrewScene, yScene + dy, doorPos[2]]);
          out.push(drill('hinge', 'back', sc.x_mm, sc.y_mm, hc.cupScrewDia, hc.cupScrewDepth, T));
        }
      }
    }
    return out;
  };

  // ===========================================================
  // S10/P74 — Machining tấm ngang (toạ độ DXF có cấu trúc cho CNC)
  // Tấm ngang [W, T, D] position [0, py, 0]: length=X, width=Z → x_mm = sceneX+W/2,
  // y_mm = sceneZ+D/2. Convention 'front' cho từng tấm xem trong comment dưới.
  // P74: rãnh connector + lỗ đón chốt hậu trên tấm ngang do POST-PASS cuối build()
  // phát (suy từ hình học part cuối) — ở đây chỉ còn lỗ chân tủ trên đáy.
  // ===========================================================
  // P77 — vị trí chân đọc spec.foot.insetFromEdge (trước dùng hằng FOOT_INSET → admin
  // chỉnh vô hiệu). CLAMP ≥ FOOT_INSET_SAFE: lỗ chân Ø8 KHÔNG đè rãnh connector trên
  // đáy (rãnh tâm cách mép 50, dài 50 → mép rãnh ≤75; chân tại inset I, mép lỗ ≈ I−4
  // cần > 75) — đây là lý do P74 nâng 45→90; clamp chống cả KV cũ leak 45.
  const FOOT_INSET_SAFE = 85;
  const footInset = Math.max(FOOT_INSET_SAFE, spec.foot.insetFromEdge ?? FOOT_INSET);
  const footZ = D / 2 - footInset; // hoist sớm cho bottomMachining (lỗ Ø8 định vị)
  // P77 — số chân mỗi vách (positionsPerDivider): 2 → trước+sau (±footZ, default chắc
  // chắn); 1 → 1 chân giữa (z=0). Đọc spec thay vì hardcode 2.
  const footZs = (spec.foot.positionsPerDivider ?? 2) <= 1 ? [0] : [footZ, -footZ];
  const xpH = (xs: number) => xs + W / 2; // panel x_mm cho tấm ngang
  const ypH = (zs: number) => zs + D / 2; // panel y_mm cho tấm ngang

  const parts: Part[] = [];
  let hinges = 0;
  let slides = 0;

  // --- Tấm ngang DÀI (chạy hết W): đáy + nóc + kệ giữa ---
  // P74 — connector 2-in-1:
  //   - Mặt NHẬN (rãnh PAT vành 50×13 sâu 2 + rãnh giữa 24×9 sâu 8.5, chạy dọc chiều
  //     sâu tủ) + lỗ đón chốt lò xo hậu Ø8: do POST-PASS cuối build() phát.
  //   - Convention mặt: đáy + kệ → 'front' = mặt TRÊN, 'back' = mặt DƯỚI (foot ở 'back');
  //     nóc → 'front' = mặt DƯỚI, 'back' = mặt TRÊN (giữ quy ước S10 cũ).
  //   - Đáy giữ foot Ø8 định vị (mặt dưới = side 'back').

  // Tấm đáy: foot Ø8 mặt DƯỚI ('back') — chân tủ định vị. Rãnh connector mặt TRÊN (post-pass).
  const bottomMachining: Machining[] = [];
  for (const xv of vachX) {
    for (const fz of footZs) {
      bottomMachining.push(drill('foot', 'back', xpH(xv), ypH(fz), spec.foot.pinDia, spec.foot.pinDepth, T));
    }
  }
  parts.push(
    panel('bottom', 'Tấm đáy', frameMaterial, [W, T, D], [0, T / 2, 0], {
      notes: `Mặt dưới: ${2 * (columns + 1)} lỗ chân Ø${spec.foot.pinDia} (cách mép trước/sau ${FOOT_INSET}mm)`,
      machining: bottomMachining,
    }),
  );

  // Tấm nóc: rãnh connector mặt DƯỚI ('front') — post-pass phát.
  parts.push(
    panel('top', 'Tấm nóc', frameMaterial, [W, T, D], [0, H - T / 2, 0]),
  );

  // Kệ giữa (P74: kệ CỐ ĐỊNH bằng connector 2-in-1 — không còn kệ trượt chốt Ø5).
  // Rãnh nhận trên CẢ 2 MẶT kệ (vách tầng dưới cắm lên mặt dưới, vách tầng trên
  // đứng xuống mặt trên) — post-pass phát theo hình học vách thực tế.
  //
  // P3 dual-path: legacy uniform → 1 panel rộng W (preserve baseline). Blocks
  // có rs>1 (gộp dọc) → segment per-col, skip segment khi 2 ô trên/dưới cùng
  // block (kệ đó là biên trong block, không hiện thực).
  const shelfNote = `Kệ cố định — liên kết vách bằng connector 2-in-1 (rãnh PAT 2 mặt, xem DXF/CSV)`;
  for (let g = 0; g < rows - 1; g++) {
    const y = rowBottomY[g] + rowHeights[g] + T / 2;
    if (!useBlockShelves) {
      // Legacy wide panel (giữ panel count + giá baseline cho 33 validator cases).
      parts.push(
        panel(`shelf-${g}`, 'Kệ', frameMaterial, [W, T, D], [0, y, 0], {
          notes: shelfNote,
        }),
      );
    } else {
      // Segment per-col: nhóm các col liên tiếp KHÔNG bị skip thành 1 tấm gộp
      // (giảm panel count khi user merge ngang). Skip segment nếu cùng block.
      let c = 0;
      while (c < columns) {
        if (sameBlock(g, c, g + 1, c)) {
          c++; // segment c bị block lớn nuốt — không có kệ
          continue;
        }
        // Mở rộng segment liên tiếp các col đều KHÔNG bị nuốt
        const cStart = c;
        while (c < columns && !sameBlock(g, c, g + 1, c)) c++;
        const cEnd = c - 1; // index col cuối của segment
        // Bề rộng segment = từ outer surface vách trái (vach[cStart]) → outer
        // surface vách phải (vach[cEnd+1]). Match legacy wide kệ semantic: kệ
        // EXTEND INTO bordering vach surfaces (cả internal vach lẫn outer walls).
        // segW = sum(colWidths) + (cs+1)*T (innerW = sum(colWidths) + (cs-1)*T,
        // cộng thêm 2*T cho 2 vách biên trái + phải).
        const segLeft = vachX[cStart] - T / 2; // outer surface left của vach[cStart]
        const segRight = vachX[cEnd + 1] + T / 2; // outer surface right của vach[cEnd+1]
        const segW = segRight - segLeft;
        const segCenterX = (segLeft + segRight) / 2;
        parts.push(
          panel(
            `shelf-${g}-c${cStart}-${cEnd}`,
            'Kệ',
            frameMaterial,
            [segW, T, D],
            [segCenterX, y, 0],
            { notes: shelfNote },
          ),
        );
      }
    }
  }

  // --- Vách đứng: đoạn ngắn 1 tầng, columns+1 vị trí (gồm 2 mép biên) ---
  // Mỗi vách có note vị trí bản lề / ray (nếu ô láng giềng cần gắn vào vách này).
  // S10: kèm machining[] có cấu trúc cho cùng bản lề/ray (plate Ø4 chuẩn Blum/Hettich).
  //
  // P3 block adjacency:
  //  - Col-wise skip: vách k (0 < k < columns) bị SKIP cho row r khi 2 ô láng
  //    giềng [r, k-1] và [r, k] cùng thuộc 1 block (merged).
  //  - Row-wise FUSE (P4.10/P4.11): vách k chỉ fuse khi BOUNDARY g không có kệ
  //    chạm vào TỪ BẤT KỲ PHÍA NÀO. Rule: boundary g BROKEN iff AT LEAST 1 phía
  //    có kệ (kệ structurally đâm vào vách, tách 2 pieces). Continuous iff CẢ 2
  //    phía đều KHÔNG có kệ. Edge wall (k=0 hoặc k=columns) chỉ tính phía duy
  //    nhất tồn tại.
  /** Helper: ở row boundary g (giữa row g và g+1), kệ có "phải có" ở col c không?
   *  Kệ có khi 2 ô [g, c] và [g+1, c] thuộc 2 block khác nhau. */
  const keOnSide = (g: number, c: number): boolean => {
    if (c < 0 || c >= columns) return false;
    return !sameBlock(g, c, g + 1, c);
  };
  /** Boundary g BROKEN cho vach k iff BẤT KỲ phía nào có kệ (kệ đâm vào vach). */
  const isVachBoundaryBroken = (k: number, g: number): boolean => {
    const left = keOnSide(g, k - 1);
    const right = keOnSide(g, k);
    if (k === 0) return right;
    if (k === columns) return left;
    return left || right;
  };

  // P61 — NÉ va chạm bản lề ↔ đợt ngang (kệ) của cột BÊN CẠNH trên 2 vách ngoài
  // của ô gộp. baseYs/return: Y tâm bản lề tính từ ĐÁY cánh (0..faceH). Mối nối kệ
  // ở mặt ngoài vách rơi vào vùng cấm ±HINGE_SHELF_KEEPOUT → đẩy bản lề ra ngoài,
  // clamp trong [100, faceH-100]; không đẩy được → giữ nguyên (graceful).
  const avoidShelfCollisions = (
    block: CellBlock,
    baseYs: number[],
    faceH: number,
  ): number[] => {
    const yBase = rowBottomY[block.r] + FRONT_GAP / 2; // đáy cánh (scene)
    const joints: number[] = []; // mối nối kệ, quy về toạ độ đáy cánh
    const neighborCols = [block.c - 1, block.c + block.cs]; // cột ngoài bên trái / phải
    for (const nc of neighborCols) {
      if (nc < 0 || nc >= columns) continue;
      for (let g = block.r; g < block.r + block.rs - 1; g++) {
        if (keOnSide(g, nc)) joints.push(rowBottomY[g] + rowHeights[g] + T / 2 - yBase);
      }
    }
    if (joints.length === 0) return baseYs;
    // P75.1: biên né = margin chuẩn của chính cánh đó (cũ hardcode 100 — lệch khi
    // margin động 60–100).
    const margin = hingeEndMargin(faceH);
    const lo = margin;
    const hi = faceH - margin;
    const out = baseYs.map((y) => {
      let ny = y;
      for (const j of joints) {
        if (Math.abs(ny - j) < HINGE_SHELF_KEEPOUT) {
          const up = Math.min(Math.max(j + HINGE_SHELF_KEEPOUT, lo), hi);
          const down = Math.min(Math.max(j - HINGE_SHELF_KEEPOUT, lo), hi);
          if (Math.abs(up - j) >= HINGE_SHELF_KEEPOUT) ny = up;
          else if (Math.abs(down - j) >= HINGE_SHELF_KEEPOUT) ny = down;
          // else: vùng quá chật → giữ nguyên
        }
      }
      return ny;
    });
    out.sort((a, b) => a - b); // giữ tăng dần
    return out;
  };
  // Bộ Y bản lề CHUNG cho cánh ô gộp (cache theo block) → cup (trên cánh) + plate
  // (trên vách) dùng CÙNG 1 bộ Y đã né → luôn khớp nhau.
  const mergedHingeYCache = new Map<CellBlock, number[]>();
  const mergedHingeY = (block: CellBlock): number[] => {
    const cached = mergedHingeYCache.get(block);
    if (cached) return cached;
    const { blockH } = mergedDims(block);
    const faceH = blockH - FRONT_GAP;
    const adj = avoidShelfCollisions(block, hingeYOnDoor(faceH, hingeCount(faceH)), faceH);
    mergedHingeYCache.set(block, adj);
    return adj;
  };

  for (let k = 0; k <= columns; k++) {
    // Compute per-row whether vach (k, r) exists (= không bị col-wise skip).
    const vachExists: boolean[] = [];
    for (let r = 0; r < rows; r++) {
      const skipped = k > 0 && k < columns && sameBlock(r, k - 1, r, k);
      vachExists.push(!skipped);
    }
    // Group consecutive rows where vachExists[r]=true AND boundary continuous.
    let r = 0;
    while (r < rows) {
      if (!vachExists[r]) {
        r++;
        continue;
      }
      const rStart = r;
      let rEnd = r;
      while (
        rEnd + 1 < rows &&
        vachExists[rEnd + 1] &&
        !isVachBoundaryBroken(k, rEnd)
      ) {
        rEnd++;
      }
      // Render 1 fused vach part covering rStart..rEnd.
      let fusedHeight = 0;
      for (let rr = rStart; rr <= rEnd; rr++) fusedHeight += rowHeights[rr];
      fusedHeight += (rEnd - rStart) * T; // T between fused rows (no kệ at those boundaries)
      const fusedCenterY = rowBottomY[rStart] + fusedHeight / 2;
      // Combine notes from each row.
      const notesArr: string[] = [];
      for (let rr = rStart; rr <= rEnd; rr++) {
        const n = dividerNote(k, rr);
        if (n) notesArr.push(rStart === rEnd ? n : `(T${rr + 1}) ${n}`);
      }
      // Combine machining: each row's machining ops translate Y by row's offset
      // within fused part. Connector edge_drill (P74) chỉ giữ ở rStart (bottom edge)
      // và rEnd (top edge) — internal boundaries không có kệ chạm vào nên KHÔNG
      // có joint.
      const fusedMach: Machining[] = [];
      for (let rr = rStart; rr <= rEnd; rr++) {
        const rowOps = dividerMachining(k, rr);
        const yOffset = rowBottomY[rr] - rowBottomY[rStart];
        for (const op of rowOps) {
          if (op.op === 'edge_drill' && op.purpose === 'connector') {
            // Internal boundary: bỏ. Outer (rStart bottom, rEnd top): giữ.
            if (op.edge === 'bottom' && rr !== rStart) continue;
            if (op.edge === 'top' && rr !== rEnd) continue;
            fusedMach.push(op); // edge_drill position_mm theo z không đổi
          } else if (op.op === 'drill' || op.op === 'pocket') {
            fusedMach.push({ ...op, y_mm: op.y_mm + yOffset });
          } else {
            fusedMach.push(op);
          }
        }
      }
      const idSuffix = rStart === rEnd ? `r${rStart}` : `r${rStart}-${rEnd}`;
      const extra: { notes?: string; machining?: Machining[] } = {};
      if (notesArr.length) extra.notes = notesArr.join(' | ');
      if (fusedMach.length) extra.machining = fusedMach;
      parts.push(
        panel(
          `divider-c${k}-${idSuffix}`,
          'Vách đứng',
          frameMaterial,
          [T, fusedHeight, D],
          [vachX[k], fusedCenterY, 0],
          Object.keys(extra).length ? extra : undefined,
        ),
      );
      r = rEnd + 1;
    }
  }

  // --- Từng ô: tấm lưng (per-ô, trừ "mở không hậu") + mặt trước (cánh/ngăn kéo) ---
  // Cánh/hộc CHÌM trong ô; mặt ngoài phẳng cạnh trước khung. Tay nắm = lỗ khoét Ø35.
  //
  // P3 v2 SUB-CELL EXPANSION: ô có thể có sub-split (block.t = "a>b" V hoặc "a^b" H)
  // → render 2 sub-cell trong cùng ô + 1 vách phụ chìm bên trong. Tấm lưng VẪN 1 panel
  // per ô (không chia theo sub-cell, "tự chừa" cho vách phụ qua depth = D - T_BACK).
  const backZ = -(D - T_BACK) / 2;
  const frontZ = D / 2 - T / 2;
  const topHoleY = (h: number) => h / 2 - handleInset; // tâm lỗ — gần cạnh trên (P77: spec)

  /** 1 sub-cell logical — render bằng helper bên dưới. `subId` = '', '-L', '-R',
   *  '-B', '-T' (tạo unique part id). */
  interface LogicalSubCell {
    subId: string;
    /** Index sub-cell trong block: undefined cho primitive, 0 = L/B, 1 = R/T. */
    subIdx?: 0 | 1;
    type: string; // primitive type của sub-cell
    xC: number; yC: number;
    cw: number; ch: number;
    faceH: number;
    /** Y bottom của sub-cell trong scene (không gồm FOOT_H). Cần cho handle
     *  position check: H-split TOP sub có bottom CAO HƠN cell bottom. */
    bottomY: number;
  }

  /** Tính danh sách sub-cells cho ô [r, c]: 1 sub-cell nếu primitive, 2 nếu sub-split.
   *  Sub-cell có cw/ch điều chỉnh theo vách phụ T = body thickness. */
  const subCellsFor = (r: number, c: number): LogicalSubCell[] => {
    const block = cellsBlocks.find(
      (b) => r >= b.r && r < b.r + b.rs && c >= b.c && c < b.c + b.cs,
    );
    const rawT = block?.t ?? DEFAULT_CELL;
    const parsed = parseSubSplit(rawT);
    const xC = colCenterX(c);
    const yC = rowCenterY(r);
    const cw = colWidths[c];
    const ch = rowHeights[r];
    const yBot = rowBottomY[r];
    if (parsed.primitive !== undefined) {
      // Primitive — apply per-cell fallback (legacy cellType logic) cho từng cell.
      return [{
        subId: '',
        type: cellType(r, c),
        xC, yC, cw, ch,
        faceH: ch - FRONT_GAP,
        bottomY: yBot,
      }];
    }
    // Sub-split: tách 2 sub-cell. Đơn vị T = body thickness vách phụ.
    // P5.5: apply applyTypeFallback theo SUB-CELL dimensions (subW/subH + sub topY)
    // để engine graceful degrade khi sub-cell quá nhỏ cho type. Vd: drawer trong
    // sub-cell narrow → fallback door, hoặc door trong sub-cell quá thấp → open-back.
    const { axis, subs } = parsed.split;
    if (axis === 'V') {
      const subW = (cw - T) / 2;
      const subFaceH = ch - FRONT_GAP;
      const subTop = yBot + ch; // top-from-floor giống cả 2 sub V
      return [
        {
          subId: '-L', subIdx: 0,
          type: applyTypeFallback(subs[0], subW, ch, subTop),
          xC: xC - (subW + T) / 2, yC, cw: subW, ch, faceH: subFaceH,
          bottomY: yBot, // V-split: cả 2 sub cùng row level → cùng bottom
        },
        {
          subId: '-R', subIdx: 1,
          type: applyTypeFallback(subs[1], subW, ch, subTop),
          xC: xC + (subW + T) / 2, yC, cw: subW, ch, faceH: subFaceH,
          bottomY: yBot,
        },
      ];
    } else {
      const subH = (ch - T) / 2;
      // H-split: B sub có top = yBot + subH (giữa cell), T sub có top = yBot + ch (top cell).
      const topB = yBot + subH;
      const topT = yBot + ch;
      return [
        {
          subId: '-B', subIdx: 0,
          type: applyTypeFallback(subs[0], cw, subH, topB),
          xC, yC: yBot + subH / 2, cw, ch: subH, faceH: subH - FRONT_GAP,
          bottomY: yBot, // B sub bottom = cell bottom
        },
        {
          subId: '-T', subIdx: 1,
          type: applyTypeFallback(subs[1], cw, subH, topT),
          xC, yC: yBot + ch - subH / 2, cw, ch: subH, faceH: subH - FRONT_GAP,
          // T sub bottom = cell bottom + subH + T/2 (giữa vách phụ ngang). Sub-T
          // có thể CAO HƠN ngưỡng 1200 dù cell mẹ thấp → handle position check
          // mới catch được case này (P9.1).
          bottomY: yBot + subH + T,
        },
      ];
    }
  };

  // P61 — Render CÁNH (có hậu) cho 1 ô GỘP, gọi 1 lần ở ô góc trên-trái. Dựng 1
  // tấm lưng full khoang + cánh ĐÔI (rộng > WIDE_CELL) hoặc ĐƠN. Cup bản lề dùng
  // mergedHingeY(block) (Y CHUNG, đã né đợt ngang) → khớp plate trên vách ngoài.
  const renderMergedDoor = (block: CellBlock): void => {
    const { blockW, blockH, centerX, centerY } = mergedDims(block);
    const faceH = blockH - FRONT_GAP;
    const cm = cellMaterial(block.r, block.c);
    const idBase = `r${block.r}-c${block.c}`;
    // Tấm lưng full khoang (CÓ HẬU). Cánh che → màu khung (theo rule per-ô :1988).
    parts.push(
      panel(`back-${idBase}`, 'Tấm lưng', frameMaterial, [blockW, blockH, T_BACK], [centerX, centerY, backZ]),
    );
    const handleTopFromFloor = rowBottomY[block.r] + FOOT_H + faceH - HOLE_INSET;
    const lowHandle = handleTopFromFloor > LOW_HANDLE_FROM_GROUND;
    const holeDy = lowHandle ? handleInset - faceH / 2 : faceH / 2 - handleInset;
    const vWord = lowHandle ? 'dưới' : 'trên';
    const nHinges = hingeCount(faceH);
    const ys = mergedHingeY(block); // Y CHUNG cup + plate
    if (blockW > WIDE_CELL) {
      // 2 cánh mở đôi — bản lề mép NGOÀI 2 lá (2 vách khác nhau), tay nắm quay vào nhau.
      const leafW = blockW / 2 - 6;
      const grip = leafW / 2 - handleInset;
      // Lá A (trái): bản lề mép TRÁI → hingeSign=+1; tay nắm phải.
      const leafASize: [number, number, number] = [leafW, faceH, T];
      const leafAPos: [number, number, number] = [centerX - blockW / 4, centerY, frontZ];
      const leafARoundHole: PanelHole | null =
        handleKind === 'round' ? { dx: grip, dy: holeDy, r: handleHoleR } : null;
      const leafAMachHoles: PanelHole[] =
        handleKind === 'round' ? [leafARoundHole!]
        : handleKind === 'bar' ? barScrewHoles(leafW, faceH, 1, lowHandle) : [];
      parts.push(
        panel(`door-${idBase}-a`, 'Cánh tủ', cm, leafASize, leafAPos, {
          notes: handleNote(vWord, `${nHinges} bản lề mép trái · cánh ô gộp`),
          holes: leafARoundHole ? [leafARoundHole] : undefined,
          machining: frontFaceMachining(leafASize, leafAPos, faceH, leafW, 1, leafAMachHoles, ys),
          hingeOnLeft: true,
        }),
      );
      if (handleKind === 'strip') fittings.push(...makeStripHandle(`hstrip-da-${idBase}`, leafAPos, leafASize, lowHandle, 1));
      else if (handleKind === 'bar') fittings.push(...makeBarHandle(`hbar-da-${idBase}`, leafAPos, leafASize, 1, lowHandle));
      doorCount += 1;
      // Lá B (phải): bản lề mép PHẢI → hingeSign=-1; tay nắm trái.
      const leafBSize: [number, number, number] = [leafW, faceH, T];
      const leafBPos: [number, number, number] = [centerX + blockW / 4, centerY, frontZ];
      const leafBRoundHole: PanelHole | null =
        handleKind === 'round' ? { dx: -grip, dy: holeDy, r: handleHoleR } : null;
      const leafBMachHoles: PanelHole[] =
        handleKind === 'round' ? [leafBRoundHole!]
        : handleKind === 'bar' ? barScrewHoles(leafW, faceH, -1, lowHandle) : [];
      parts.push(
        panel(`door-${idBase}-b`, 'Cánh tủ', cm, leafBSize, leafBPos, {
          notes: handleNote(vWord, `${nHinges} bản lề mép phải · cánh ô gộp`),
          holes: leafBRoundHole ? [leafBRoundHole] : undefined,
          machining: frontFaceMachining(leafBSize, leafBPos, faceH, leafW, -1, leafBMachHoles, ys),
          hingeOnLeft: false,
        }),
      );
      if (handleKind === 'strip') fittings.push(...makeStripHandle(`hstrip-db-${idBase}`, leafBPos, leafBSize, lowHandle, -1));
      else if (handleKind === 'bar') fittings.push(...makeBarHandle(`hbar-db-${idBase}`, leafBPos, leafBSize, -1, lowHandle));
      doorCount += 1;
      hinges += 2 * nHinges;
    } else {
      // 1 cánh đơn — bản lề 1 mép theo quy tắc ghép cặp cột.
      const faceW = blockW - FRONT_GAP;
      const sign = singleDoorHandleSign(block.c, columns);
      const hingeSide = sign > 0 ? 'trái' : 'phải';
      const singleSize: [number, number, number] = [faceW, faceH, T];
      const singlePos: [number, number, number] = [centerX, centerY, frontZ];
      const singleRoundHole: PanelHole | null =
        handleKind === 'round' ? { dx: sign * (faceW / 2 - handleInset), dy: holeDy, r: handleHoleR } : null;
      const singleMachHoles: PanelHole[] =
        handleKind === 'round' ? [singleRoundHole!]
        : handleKind === 'bar' ? barScrewHoles(faceW, faceH, sign, lowHandle) : [];
      parts.push(
        panel(`door-${idBase}`, 'Cánh tủ', cm, singleSize, singlePos, {
          notes: handleNote(vWord, `${nHinges} bản lề mép ${hingeSide} · cánh ô gộp`),
          holes: singleRoundHole ? [singleRoundHole] : undefined,
          machining: frontFaceMachining(singleSize, singlePos, faceH, faceW, sign as 1 | -1, singleMachHoles, ys),
          hingeOnLeft: sign > 0,
        }),
      );
      if (handleKind === 'strip') fittings.push(...makeStripHandle(`hstrip-d-${idBase}`, singlePos, singleSize, lowHandle, sign as 1 | -1));
      else if (handleKind === 'bar') fittings.push(...makeBarHandle(`hbar-d-${idBase}`, singlePos, singleSize, sign, lowHandle));
      doorCount += 1;
      hinges += nHinges;
    }
    // (P75: lỗ bát trên vách do post-pass emitHingePlates chung phát — suy từ chén.)
  };

  for (let r = 0; r < rows; r++) {
    const yC = rowCenterY(r);
    for (let c = 0; c < columns; c++) {
      // P61 — ô thuộc CÁNH GỘP: dựng 1 lần ở ô góc trên-trái; ô khác của block bỏ qua.
      if (isMergedDoorCell(r, c)) {
        if (isMergedDoorTopLeft(r, c)) renderMergedDoor(mergedDoorBlock(r, c)!);
        continue;
      }
      const xC = colCenterX(c);
      const cw = colWidths[c];
      const ch = rowHeights[r];
      const cm = cellMaterial(r, c); // màu ô này — phủ tấm hậu + cánh/ngăn kéo
      const subList = subCellsFor(r, c);
      const isSplit = subList.length > 1;

      const block = cellsBlocks.find(
        (b) => r >= b.r && r < b.r + b.rs && c >= b.c && c < b.c + b.cs,
      );

      // P65 — gom HỐC cho props: ô mở ĐƠN/CHIA → từng hốc con riêng; ô GỘP (mở) → 1
      // hốc TO ở góc trên-trái (props to). Ô gộp-CÁNH đã `continue` phía trên → không tới đây.
      const cavMerged = block && (block.rs > 1 || block.cs > 1) && !mergedDoorBlock(r, c);
      if (cavMerged) {
        if (r === block!.r && c === block!.c) {
          let mw = T * (block!.cs - 1);
          for (let cc = block!.c; cc < block!.c + block!.cs; cc++) mw += colWidths[cc];
          let mh = T * (block!.rs - 1);
          for (let rr = block!.r; rr < block!.r + block!.rs; rr++) mh += rowHeights[rr];
          cavities.push({
            col: 2000 + block!.c, row: block!.r, type: 'open-nobk',
            cx: (colCenterX(block!.c) + colCenterX(block!.c + block!.cs - 1)) / 2,
            floorY: rowBottomY[block!.r], cz: 0,
            w: mw, h: mh, d: D - T_BACK - FRONT_GAP,
          });
        }
      } else {
        subList.forEach((s, si) => {
          if (s.type === 'open-back' || s.type === 'open-nobk') {
            cavities.push({
              col: c * 10 + si, row: r, type: s.type,
              cx: s.xC, floorY: s.yC - s.ch / 2, cz: 0,
              w: s.cw, h: s.ch, d: D - T_BACK - FRONT_GAP,
            });
          }
        });
      }
      const subAxis = block && hasSubSplit(block.t)
        ? (parseSubSplit(block.t).split?.axis ?? null)
        : null;

      // tấm lưng riêng cho ô — mọi sub-cell open-nobk → bỏ tấm lưng; còn lại → 1 panel.
      const anyNeedsBack = subList.some((s) => s.type !== 'open-nobk');
      if (anyNeedsBack) {
        // Cánh/ngăn kéo che hậu → MÀU KHUNG; mở-có-hậu → cellMaterial.
        const anyFront = subList.some((s) => s.type === 'door' || s.type === 'drawer');
        const backMaterial = anyFront ? frameMaterial : cm;
        parts.push(
          panel(`back-r${r}-c${c}`, 'Tấm lưng', backMaterial,
            [cw, ch, T_BACK], [xC, yC, backZ]),
        );
      }

      // Vách phụ — chỉ khi ô có sub-split. Depth chừa tấm hậu (D - T_BACK), Z = T_BACK/2
      // để mặt sau vách phụ đụng front face tấm hậu. Vật liệu = frame (không lộ).
      //
      // P5.10 edge direction: edge_drill ở 'top'/'bottom' (vuông góc length axis).
      //   V-split: length = ch (vertical) → 'top'/'bottom' = ends meeting nóc/đáy/kệ.
      //   H-split: length = cw (horizontal) → 'top'/'bottom' = ends meeting vách đứng 2 bên.
      // P74: pilot confirmat → lỗ chốt connector 2-in-1 Ø8×32. Rãnh PAT phía NHẬN
      // (trên nóc/đáy/kệ cho V-split; trên MẶT vách đứng 2 bên cho H-split) do
      // post-pass connector cuối build() phát — không cần xưởng dóng template nữa.
      if (isSplit && subAxis) {
        const subVDepth = D - T_BACK;
        const subZ = T_BACK / 2;
        const connectorEdge = (
          edge: 'top' | 'bottom',
          posFromFront: number,
        ): Machining => ({
          op: 'edge_drill',
          purpose: 'connector',
          edge,
          position_mm: posFromFront,
          depth_mm: conn.pinHoleDepth,
          diameter_mm: conn.pinHoleDia,
          thicknessOffset_mm: T / 2,
        });
        // 2 chốt mỗi đầu: 1 gần mép trước, 1 gần mép sau. P74.1: inset đo từ mép TỦ
        // (không phải mép vách phụ) → chốt/rãnh THẲNG HÀNG cữ vách chính dù vách phụ
        // thụt T_BACK phía sau (founder chốt 12/06). Position theo cạnh: 0 = đầu SAU.
        const pinsAtEdge = (edge: 'top' | 'bottom'): Machining[] => [
          connectorEdge(edge, subVDepth - conn.insetFromFront), // gần mép trước (z = D/2 - inset)
          connectorEdge(edge, conn.insetFromBack - T_BACK), // gần mép sau TỦ (z = -D/2 + inset)
        ];
        if (subAxis === 'V') {
          parts.push(
            panel(`subv-r${r}-c${c}`, 'Vách phụ', frameMaterial,
              [T, ch, subVDepth], [xC, yC, subZ], {
                notes:
                  `Vách phụ ĐỨNG trong ô (T${r + 1},C${c + 1}) — kéo từ KỆ/ĐÁY (đầu dưới) lên KỆ/NÓC (đầu trên), ` +
                  `chừa ${T_BACK}mm sau cho tấm hậu. ` +
                  `Cấu trúc giống vách đứng chính (kết cấu chịu lực). ` +
                  `Connector 2-in-1: lỗ chốt Ø${conn.pinHoleDia}×${conn.pinHoleDepth} trên 2 cạnh top/bottom ` +
                  `(mỗi cạnh 2 lỗ, tâm cách mép trước/sau TỦ ${conn.insetFromFront}/${conn.insetFromBack}mm — thẳng hàng cữ vách chính). ` +
                  `Rãnh PAT nhận nằm trên nóc/đáy/kệ (xem DXF tấm đó).`,
                machining: [...pinsAtEdge('top'), ...pinsAtEdge('bottom')],
              }),
          );
        } else { // H
          parts.push(
            panel(`subh-r${r}-c${c}`, 'Vách phụ', frameMaterial,
              [cw, T, subVDepth], [xC, yC, subZ], {
                notes:
                  `Vách phụ NGANG trong ô (T${r + 1},C${c + 1}) — kéo từ VÁCH ĐỨNG TRÁI sang VÁCH ĐỨNG PHẢI, ` +
                  `chừa ${T_BACK}mm sau cho tấm hậu. ` +
                  `Cấu trúc giống vách đứng chính. ` +
                  `Connector 2-in-1: lỗ chốt Ø${conn.pinHoleDia}×${conn.pinHoleDepth} trên 2 cạnh top/bottom ` +
                  `(= 2 đầu trái/phải; mỗi đầu 2 lỗ, tâm cách mép trước/sau TỦ ${conn.insetFromFront}/${conn.insetFromBack}mm — thẳng hàng cữ vách chính). ` +
                  `Rãnh PAT nhận nằm trên MẶT vách đứng 2 bên (xem DXF vách).`,
                machining: [...pinsAtEdge('top'), ...pinsAtEdge('bottom')],
              }),
          );
        }
      }

      // Render từng sub-cell (mặt trước cho cánh/ngăn kéo, open-back/open-nobk bỏ qua).
      for (const sub of subList) {
        const type = sub.type;
        // Shadow outer xC/yC/cw/faceH/cm với giá trị sub-cell → existing drawer/door
        // code dưới hoạt động ko sửa (just adapter trick). Material: PER SUB-CELL
        // qua cellMaterial(..., sub.subIdx) — bug fix cho color split.
        // eslint-disable-next-line @typescript-eslint/no-shadow
        const xC = sub.xC;
        // eslint-disable-next-line @typescript-eslint/no-shadow
        const yC = sub.yC;
        // eslint-disable-next-line @typescript-eslint/no-shadow
        const cw = sub.cw;
        // eslint-disable-next-line @typescript-eslint/no-shadow
        const faceH = sub.faceH;
        // eslint-disable-next-line @typescript-eslint/no-shadow
        const cm = cellMaterial(r, c, sub.subIdx);
        const idSuffix = `r${r}-c${c}${sub.subId}`;

      if (type === 'drawer' && rail) {
        // P76 — Thùng hộc cho RAY ÂM Hafele EPC Plus (thay ray bi 2 bên hông):
        //   • Thành hộc (hông + hậu) = VÁN THÂN T (17 MCA / 18 mdf·plywood) — ray âm
        //     chuẩn thành dày; đáy giữ ván 9 (P62 cũ toàn bộ 9 — founder duyệt đổi).
        //   • Khe hông mỗi bên = spec.sideGapPerSide (4mm — ray nằm DƯỚI đáy, không
        //     cần 13mm như ray bi).
        //   • Sâu thùng bd = ĐÚNG chiều dài ray (chốt đuôi ray cắm lỗ Ø6 hậu hộc).
        //   • Mặt trước thùng chạm SÁT mặt sau mặt ngăn kéo (frontZ − T/2) — nới
        //     so với cũ (−T) để D=300 lòng 291 vừa ray 270 + hậu.
        const TD_WALL = T; // thành hộc = ván thân
        const TD_BOT = T_BACK; // đáy hộc = ván 9
        // P76.1 — bản vẽ chính hãng: LÒNG TRONG hộc = lòng tủ − 42 (boxInnerWidthOffset)
        // → bw (ngoài) = cw − 42 + 2×thành; thành 17 → khe 4/bên, thành 18 → khe 3.
        const bw = cw - spec.drawerSlide.boxInnerWidthOffset + 2 * TD_WALL;
        const bh = faceH - 20; // chiều cao thành hộc [xưởng xác nhận khe nhấc hộc ray âm]
        const bFront = frontZ - T / 2; // mặt trước thùng — sát mặt sau false front
        const bd = rail.len; // sâu thùng = chiều dài ray âm
        const bBack = bFront - bd;
        const bzC = (bFront + bBack) / 2;
        const sideX = (bw - TD_WALL) / 2; // tâm hông: mặt ngoài = bw/2, lùi TD_WALL/2

        // mặt trước (false front) — lắp chìm, có tay nắm.
        // v3.4: strip handle (no hole) khi frame edge đen; else round Ø35 hole.
        const drawerRoundHole: PanelHole | null =
          handleKind === 'round' ? { dx: 0, dy: topHoleY(faceH), r: HOLE_R } : null;
        const drawerSize: [number, number, number] = [cw - FRONT_GAP, faceH, T];
        const drawerPos: [number, number, number] = [xC, yC, frontZ];
        const drawerMachHoles: PanelHole[] =
          handleKind === 'round'
            ? [drawerRoundHole!]
            : handleKind === 'bar'
              ? barScrewHoles(cw - FRONT_GAP, faceH, 0, false)
              : [];
        const ffMach = frontFaceMachining(drawerSize, drawerPos, faceH, cw - FRONT_GAP, 0, drawerMachHoles);
        // 4 vít M4 ở MẶT SAU mặt ngăn kéo (side='back') — 4 góc cách mép 80mm
        const ffScrewMargin = 80;
        for (const sx of [-sideX, sideX]) {
          for (const sy of [yC + faceH / 2 - ffScrewMargin, yC - faceH / 2 + ffScrewMargin]) {
            const sc = panelCoord(drawerSize, drawerPos, [xC + sx, sy, frontZ]);
            ffMach.push(
              drill(
                'drawerSlide', // tạm dùng purpose này — DXF generator group screws theo Ø layer
                'back',
                sc.x_mm,
                sc.y_mm,
                spec.drawerSlide.screwDia,
                spec.drawerSlide.screwDepth,
                T,
              ),
            );
          }
        }
        parts.push(
          panel(`drawer-${idSuffix}`, 'Mặt ngăn kéo', cm, drawerSize, drawerPos, {
            notes:
              (handleKind === 'strip'
                ? `Tay nắm strip đen (Nam Khang) gắn cạnh TRÊN · `
                : handleKind === 'bar'
                  ? `Tay nắm bar đen căn giữa, cách mép trên 75mm (2 vít) · `
                  : `Khoét lỗ tay nắm Ø35 — giữa cạnh trên · `) +
              `Thùng hộc ${Math.round(bw)}×${Math.round(bh)}×${Math.round(bd)}mm ` +
              `(rộng×cao×sâu) · Ray âm ${rail.len}mm (Hafele ${rail.sku}) · ` +
              `4 lỗ Ø${spec.drawerSlide.screwDia} mặt sau bắt vào hông hộc (cách mép 80mm)`,
            holes: drawerRoundHole ? [drawerRoundHole] : undefined,
            machining: ffMach,
          }),
        );

        // S10.1 Bug 6: thùng hộc cần liên kết. Note text giải thích — machining
        // detail (edge drill cho dowel hộc) defer to future enhancement vì xưởng
        // VN thường tự dóng template cho thùng hộc, không cần CNC.
        // P74: dowel spec bỏ khỏi MachiningSpec — giữ số liệu literal (Ø8×30 chuẩn
        // xưởng VN), thùng hộc vẫn do xưởng tự khoan theo cữ, không CNC.
        const boxNote =
          `P76 thùng hộc ray âm: thành (hông+hậu) ván thân ${TD_WALL}mm, đáy ${TD_BOT}mm. ` +
          `Sâu thùng = chiều ray ${rail.len}mm (${rail.sku}). ` +
          `Liên kết thùng: 2 chốt gỗ Ø8×30mm + 2 vít M${spec.drawerSlide.screwDia} mỗi giao điểm — xưởng tự khoan theo cữ. ` +
          `Khóa nhựa ray bắt dưới đáy phía trước: xưởng tự bắt theo ray.`;
        parts.push(
          panel(`drawerL-${idSuffix}`, 'Hông hộc', cm, [TD_WALL, bh, bd], [xC - sideX, yC, bzC], {
            notes: boxNote,
          }),
        );
        parts.push(
          panel(`drawerR-${idSuffix}`, 'Hông hộc', cm, [TD_WALL, bh, bd], [xC + sideX, yC, bzC], {
            notes: boxNote,
          }),
        );
        // Hậu hộc — 2 lỗ Ø6 đón CHỐT ĐUÔI RAY ÂM (khoan mặt SAU, cách mép sườn 7 /
        // mép dưới 11 theo hướng dẫn Hafele). 'back' = mặt hướng về hậu tủ.
        const bkW = bw - 2 * TD_WALL;
        const bkSize: [number, number, number] = [bkW, bh, TD_WALL];
        const bkPos: [number, number, number] = [xC, yC, bBack + TD_WALL / 2];
        const ds = spec.drawerSlide;
        const bkMach: Machining[] = [];
        for (const sx of [-1, 1]) {
          const pinScene: [number, number, number] = [
            xC + sx * (bkW / 2 - ds.backPinFromSideEdge),
            yC - bh / 2 + ds.backPinFromBottom,
            bkPos[2],
          ];
          const pc = panelCoord(bkSize, bkPos, pinScene);
          bkMach.push(
            drill('drawerRailPin', 'back', pc.x_mm, pc.y_mm, ds.backPinHoleDia, ds.backPinHoleDepth, TD_WALL),
          );
        }
        parts.push(
          panel(`drawerBk-${idSuffix}`, 'Hậu hộc', cm, bkSize, bkPos, {
            notes:
              `${boxNote} | 2 lỗ Ø${ds.backPinHoleDia}×${ds.backPinHoleDepth} mặt sau đón chốt đuôi ray ` +
              `(cách sườn ${ds.backPinFromSideEdge} / mép dưới ${ds.backPinFromBottom})`,
            machining: bkMach,
          }),
        );
        // Đáy hộc: chạy từ mặt trước thùng tới mặt TRƯỚC hậu hộc (P76 fix lệch cũ
        // tâm bzC làm đáy ăn nửa vào hậu).
        parts.push(
          panel(
            `drawerBot-${idSuffix}`,
            'Đáy hộc',
            cm,
            [bkW, TD_BOT, bd - TD_WALL],
            [xC, yC - bh / 2 + TD_BOT / 2, bzC + TD_WALL / 2],
            { notes: boxNote },
          ),
        );
        slides += 1;
        drawerCount += 1;
        if (handleKind === 'strip') {
          // P9.2: drawer V-split sub → mini cánh đôi inward; H-split B/T cùng
          // cột → singleDoorHandleSign như cells. Drawer trên cạnh TRÊN
          // (lowHandle = false hardcoded vì drawer luôn pull-up).
          let drawerHandleSign: 1 | -1;
          if (sub.subId === '-L') drawerHandleSign = 1;
          else if (sub.subId === '-R') drawerHandleSign = -1;
          else drawerHandleSign = singleDoorHandleSign(c, columns) as 1 | -1;
          fittings.push(
            ...makeStripHandle(`hstrip-d-${idSuffix}`, drawerPos, drawerSize, false, drawerHandleSign),
          );
        } else if (handleKind === 'bar') {
          // Ngăn kéo không có bản lề → CĂN GIỮA (sign 0). L luôn hạ xuống.
          fittings.push(...makeBarHandle(`hbar-d-${idSuffix}`, drawerPos, drawerSize, 0, false));
        }
      } else if (type === 'door') {
        // P9.1: handle position dựa trên VỊ TRÍ TAY NẮM TRÊN TỪ SÀN, không phải
        // đáy ô. Nếu tay nắm ở cạnh TRÊN cao quá 1200mm → switch sang cạnh DƯỚI.
        //   handleTopFromFloor = sub.bottomY + FOOT_H + faceH - HOLE_INSET
        // sub.bottomY catch case H-split TOP sub có bottom cao hơn cell bottom.
        const handleTopFromFloor = sub.bottomY + FOOT_H + faceH - HOLE_INSET;
        const lowHandle = handleTopFromFloor > LOW_HANDLE_FROM_GROUND;
        const holeDy = lowHandle ? handleInset - faceH / 2 : faceH / 2 - handleInset;
        const vWord = lowHandle ? 'dưới' : 'trên';
        const nHinges = hingeCount(faceH);
        if (cw > WIDE_CELL) {
          // ô rộng → 2 cánh: bản lề mép NGOÀI, 2 lỗ tay nắm quay vào nhau (giáp nhau).
          const leafW = cw / 2 - 6;
          const grip = leafW / 2 - handleInset;
          // Lá A (trái): bản lề mép TRÁI cánh → hingeSign=+1; tay nắm phải lá A → dx=+grip.
          const leafASize: [number, number, number] = [leafW, faceH, T];
          const leafAPos: [number, number, number] = [xC - cw / 4, yC, frontZ];
          // v3.4: strip handle (no hole) khi frame edge đen; else round Ø35.
          const leafARoundHole: PanelHole | null =
            handleKind === 'round' ? { dx: grip, dy: holeDy, r: handleHoleR } : null;
          const leafAMachHoles: PanelHole[] =
            handleKind === 'round'
              ? [leafARoundHole!]
              : handleKind === 'bar'
                ? barScrewHoles(leafW, faceH, 1, lowHandle)
                : [];
          parts.push(
            panel(`door-${idSuffix}-a`, 'Cánh tủ', cm, leafASize, leafAPos, {
              notes: handleNote(vWord, `${nHinges} bản lề mép trái`),
              holes: leafARoundHole ? [leafARoundHole] : undefined,
              machining: frontFaceMachining(leafASize, leafAPos, faceH, leafW, 1, leafAMachHoles),
              hingeOnLeft: true,
            }),
          );
          if (handleKind === 'strip') {
            // Leaf A: hinge mép TRÁI (+1) → handle bên PHẢI (+1 đối diện hinge).
            fittings.push(
              ...makeStripHandle(`hstrip-da-${idSuffix}`, leafAPos, leafASize, lowHandle, 1),
            );
          } else if (handleKind === 'bar') {
            fittings.push(...makeBarHandle(`hbar-da-${idSuffix}`, leafAPos, leafASize, 1, lowHandle));
          }
          doorCount += 1;
          // Lá B (phải): bản lề mép PHẢI cánh → hingeSign=-1; tay nắm trái lá B → dx=-grip.
          const leafBSize: [number, number, number] = [leafW, faceH, T];
          const leafBPos: [number, number, number] = [xC + cw / 4, yC, frontZ];
          const leafBRoundHole: PanelHole | null =
            handleKind === 'round' ? { dx: -grip, dy: holeDy, r: handleHoleR } : null;
          const leafBMachHoles: PanelHole[] =
            handleKind === 'round'
              ? [leafBRoundHole!]
              : handleKind === 'bar'
                ? barScrewHoles(leafW, faceH, -1, lowHandle)
                : [];
          parts.push(
            panel(`door-${idSuffix}-b`, 'Cánh tủ', cm, leafBSize, leafBPos, {
              notes: handleNote(vWord, `${nHinges} bản lề mép phải`),
              holes: leafBRoundHole ? [leafBRoundHole] : undefined,
              machining: frontFaceMachining(leafBSize, leafBPos, faceH, leafW, -1, leafBMachHoles),
              hingeOnLeft: false,
            }),
          );
          if (handleKind === 'strip') {
            // Leaf B: hinge mép PHẢI (-1) → handle bên TRÁI (-1 đối diện hinge).
            fittings.push(
              ...makeStripHandle(`hstrip-db-${idSuffix}`, leafBPos, leafBSize, lowHandle, -1),
            );
          } else if (handleKind === 'bar') {
            fittings.push(...makeBarHandle(`hbar-db-${idSuffix}`, leafBPos, leafBSize, -1, lowHandle));
          }
          doorCount += 1;
          hinges += 2 * nHinges;
        } else {
          // #3: cánh đơn — tay nắm trái/phải theo quy tắc ghép cặp cột (quay vào nhau).
          const faceW = cw - FRONT_GAP;
          // P9.2: V-split sub-cell L/R là mini "cánh đôi" trong cùng cột → 2 sub
          // hướng vào trong nhau (L hinge trái + handle phải, R hinge phải +
          // handle trái), không dùng cột parent. H-split B/T cùng column → dùng
          // singleDoorHandleSign(c) như cells. Primitive cũng theo cells logic.
          let sign: number;
          if (sub.subId === '-L') sign = 1;        // V-split left → hinge trái, handle phải
          else if (sub.subId === '-R') sign = -1;  // V-split right → hinge phải, handle trái
          else sign = singleDoorHandleSign(c, columns); // primitive / H-split
          const sWord = sign > 0 ? 'phải' : 'trái';
          const hingeSide = sign > 0 ? 'trái' : 'phải';
          // hingeSign = sign (+1 = bản lề mép trái cánh, -1 = mép phải)
          const singleSize: [number, number, number] = [faceW, faceH, T];
          const singlePos: [number, number, number] = [xC, yC, frontZ];
          const singleRoundHole: PanelHole | null =
            handleKind === 'round'
              ? { dx: sign * (faceW / 2 - handleInset), dy: holeDy, r: handleHoleR }
              : null;
          const singleMachHoles: PanelHole[] =
            handleKind === 'round'
              ? [singleRoundHole!]
              : handleKind === 'bar'
                ? barScrewHoles(faceW, faceH, sign, lowHandle)
                : [];
          parts.push(
            panel(`door-${idSuffix}`, 'Cánh tủ', cm, singleSize, singlePos, {
              notes: handleNote(vWord, `${nHinges} bản lề mép ${hingeSide}`),
              holes: singleRoundHole ? [singleRoundHole] : undefined,
              machining: frontFaceMachining(
                singleSize,
                singlePos,
                faceH,
                faceW,
                sign as 1 | -1,
                singleMachHoles,
              ),
              hingeOnLeft: sign > 0,
            }),
          );
          if (handleKind === 'strip') {
            // Single door: handle theo sign quy ước (đối diện bản lề).
            fittings.push(
              ...makeStripHandle(
                `hstrip-d-${idSuffix}`,
                singlePos,
                singleSize,
                lowHandle,
                sign as 1 | -1,
              ),
            );
          } else if (handleKind === 'bar') {
            fittings.push(...makeBarHandle(`hbar-d-${idSuffix}`, singlePos, singleSize, sign, lowHandle));
          }
          doorCount += 1;
          hinges += nHinges;
        }
      }
      // 'open-back' / 'open-nobk' → không có mặt trước
      } // end for sub
    }
  }

  // ===========================================================
  // P75 — POST-PASS bát bản lề (Hafele 311.98.700): MỘT đường duy nhất cho MỌI
  // loại cánh (đơn / đôi / gộp P61 / sub-cell V-H). Suy từ chính part cánh: đọc
  // tâm CHÉN (pocket 'hinge') đã khoan trên cánh → quy về cao độ scene → tìm
  // part vách sát mép bản lề (theo hingeOnLeft) → khoan 2 lỗ mồi vít bát
  // (cách nhau plateScrewSpan, z = D/2 − plateInsetFromEdge) ĐÚNG cao độ chén.
  // Chén↔bát khớp tuyệt đối mọi đường code; thay cho emitPlate per-ô cũ (sót
  // cánh sub-cell → chén mồ côi) + emitMergedHingePlates (P61).
  // ===========================================================
  {
    const hp = spec.hingePlate;
    const zPlate = D / 2 - hp.plateInsetFromEdge;
    const dividerParts = parts.filter((p) => p.label === 'Vách đứng');
    for (const door of parts) {
      if (door.label !== 'Cánh tủ') continue;
      // Tâm chén theo frame part cánh → cao độ scene. panelCoord map x_mm→trục
      // length, y_mm→trục width (sort size giảm dần) — đảo ngược cho trục đứng (1).
      const lAxis = lengthAxisOf(door.size);
      const onLeft = door.hingeOnLeft === true; // mọi part cánh đều set (P45)
      // Mặt trong vách nhận bát cách mép cánh ≤4mm (khe 2mm cánh đơn, 3mm lá đôi).
      const xEdge = door.position[0] + (onLeft ? -door.size[0] / 2 : door.size[0] / 2);
      const gapTo = (dv: Part): number =>
        onLeft ? xEdge - (dv.position[0] + T / 2) : dv.position[0] - T / 2 - xEdge;
      const side: MachiningSide = onLeft ? 'front' : 'back';
      let plateCount = 0;
      for (const m of door.machining ?? []) {
        if (m.op !== 'pocket' || m.purpose !== 'hinge') continue;
        const coordY = lAxis === 1 ? m.x_mm : m.y_mm;
        const yHinge = door.position[1] - door.size[1] / 2 + coordY;
        // Vách có thể bị chẻ per-row → tìm part theo TỪNG bản lề (y-range chứa nó).
        const host = dividerParts.find((dv) => {
          const g = gapTo(dv);
          if (g < -0.1 || g > 6) return false;
          return (
            yHinge >= dv.position[1] - dv.size[1] / 2 - 0.5 &&
            yHinge <= dv.position[1] + dv.size[1] / 2 + 0.5
          );
        });
        if (!host) continue; // không nên xảy ra (vách ngoài luôn tồn tại)
        const ops: Machining[] = [];
        for (const dy of [-hp.plateScrewSpan / 2, hp.plateScrewSpan / 2]) {
          const { x_mm, y_mm } = panelCoord(host.size, host.position, [
            host.position[0],
            yHinge + dy,
            zPlate,
          ]);
          ops.push(drill('hinge', side, x_mm, y_mm, hp.plateScrewDia, hp.plateScrewDepth, T));
        }
        host.machining = [...(host.machining ?? []), ...ops];
        plateCount += 1;
        if (plateCount === 1) {
          const note = `Bát bản lề (Hafele 311.98.700) cho cánh ${door.id} — mặt ${onLeft ? 'phải' : 'trái'}, cách mép trước ${hp.plateInsetFromEdge}mm`;
          host.notes = host.notes ? `${host.notes} | ${note}` : note;
        }
      }
    }
  }

  // ===========================================================
  // P76 — POST-PASS vít RAY ÂM ngăn kéo (Hafele EPC Plus 433.03.001-.004)
  // Suy từ part 'Đáy hộc': tìm mặt ĐỠ ngay dưới hộc (đáy/kệ/vách phụ ngang) làm
  // mốc ĐÁY Ô + 2 vách kề (vách chính hoặc vách phụ đứng) → khoan lỗ mồi vít thân
  // ray trên MẶT vách THEO BẢN VẼ chính hãng (P76.1): mỗi cụm 2 LỖ ĐỨNG (hàng dưới
  // = đáy ô + 10.2, hàng trên +12); cụm tại {0,128,224} từ lỗ đầu (lỗ đầu cách mép
  // trước ray 37); ray <300 dùng 2 cụm, ≥300 đủ 3. Đúng cả ô chia/gộp.
  // ===========================================================
  if (rail) {
    const ds = spec.drawerSlide;
    const EPS = 0.5;
    const supports = parts.filter(
      (p) => p.id === 'bottom' || p.id.startsWith('shelf-') || p.id.startsWith('subh-'),
    );
    const vertHosts = parts.filter(
      (p) => p.label === 'Vách đứng' || p.id.startsWith('subv-'),
    );
    const zOffsets = railClustersFor(rail.len).map((c) => ds.railFirstScrewFromFront + c);
    for (const bot of parts) {
      if (!bot.id.startsWith('drawerBot-')) continue;
      const [sx, sy, sz] = bot.position;
      const boxBottomY = sy - bot.size[1] / 2; // mặt dưới đáy hộc = mặt dưới thành hộc
      const outerHalfW = bot.size[0] / 2 + T; // nửa bw (đáy hẹp hơn thùng 2×TD_WALL)
      const sideGap = (ds.boxInnerWidthOffset - 2 * T) / 2; // khe hông suy từ công thức bản vẽ
      const zRayFront = sz + bot.size[2] / 2 - ds.railSetbackFromFront; // mép trước ray
      // Đáy ô = top-surface CAO NHẤT của mặt đỡ nằm dưới hộc tại x này.
      let cellFloorY = Number.NEGATIVE_INFINITY;
      for (const sp of supports) {
        const topY = sp.position[1] + sp.size[1] / 2;
        if (topY > boxBottomY + EPS) continue;
        if (
          sx < sp.position[0] - sp.size[0] / 2 - EPS ||
          sx > sp.position[0] + sp.size[0] / 2 + EPS
        ) {
          continue;
        }
        if (topY > cellFloorY) cellFloorY = topY;
      }
      if (!Number.isFinite(cellFloorY)) continue; // không nên xảy ra (hộc luôn có mặt đỡ)
      const rowYs = [
        cellFloorY + ds.railScrewRowFromCellBottom,
        cellFloorY + ds.railScrewRowFromCellBottom + ds.railScrewRowSpacing,
      ];
      for (const sxSign of [-1, 1] as const) {
        const vx = sx + sxSign * (outerHalfW + sideGap + T / 2); // tâm vách kề
        const host = vertHosts.find(
          (dv) =>
            Math.abs(dv.position[0] - vx) < 1.5 &&
            rowYs[0] >= dv.position[1] - dv.size[1] / 2 - EPS &&
            rowYs[1] <= dv.position[1] + dv.size[1] / 2 + EPS,
        );
        if (!host) continue;
        const side: MachiningSide = sxSign === -1 ? 'front' : 'back'; // vách trái → mặt phải
        const ops: Machining[] = [];
        for (const off of zOffsets) {
          for (const railY of rowYs) {
            const { x_mm, y_mm } = panelCoord(host.size, host.position, [
              vx,
              railY,
              zRayFront - off,
            ]);
            ops.push(
              drill('drawerSlide', side, x_mm, y_mm, ds.railScrewPilotDia, ds.railScrewPilotDepth, T),
            );
          }
        }
        host.machining = [...(host.machining ?? []), ...ops];
        const note = `Ray âm ${rail.len}mm (${rail.sku}) hộc ${bot.id.replace('drawerBot-', '')} — ${zOffsets.length} cụm × 2 lỗ đứng Ø${ds.railScrewPilotDia} (hàng dưới cách đáy ô ${ds.railScrewRowFromCellBottom}, hàng trên +${ds.railScrewRowSpacing}; lỗ đầu cách mép trước ray ${ds.railFirstScrewFromFront} — theo bản vẽ Hafele)`;
        host.notes = host.notes ? `${host.notes} | ${note}` : note;
      }
    }
  }

  // ===========================================================
  // P74 — POST-PASS connector 2-in-1 + chốt lò xo hậu
  // Chạy SAU khi mọi part khung đã dựng, TRƯỚC FOOT_H shift (machining dùng scene Y gốc).
  // Nguyên tắc: phía CHỐT (edge_drill Ø8×32 / Ø5×25) đã phát trên CẠNH vách / vách phụ /
  // tấm hậu tại chỗ dựng part; post-pass này phát phía NHẬN — rãnh PAT trên MẶT tấm
  // ngang (vách↔đáy/nóc/kệ), rãnh PAT trên MẶT vách đứng (vách phụ ngang↔vách), lỗ đón
  // chốt lò xo hậu trên MẶT tấm ngang — suy từ HÌNH HỌC part cuối cùng → tự đúng cho
  // vách fused nhiều tầng, kệ segment, block gộp (cùng pattern emitMergedHingePlates P61).
  // ===========================================================
  {
    const EPS = 0.5;
    const horizParts = parts.filter(
      (p) => p.id === 'bottom' || p.id === 'top' || p.id.startsWith('shelf-'),
    );
    const vertParts = parts.filter(
      (p) => p.id.startsWith('divider-') || p.id.startsWith('subv-'),
    );
    const subhParts = parts.filter((p) => p.id.startsWith('subh-'));
    const backParts = parts.filter((p) => p.id.startsWith('back-'));

    // Mặt tấm ngang ↔ side: đáy + kệ → 'front' = mặt TRÊN; nóc → 'front' = mặt DƯỚI.
    const horizFaceSide = (id: string, face: 'up' | 'down'): MachiningSide =>
      id === 'top' ? (face === 'up' ? 'back' : 'front') : (face === 'up' ? 'front' : 'back');

    const pushMach = (p: Part, ops: Machining[]): void => {
      if (!ops.length) return;
      p.machining = [...(p.machining ?? []), ...ops];
    };

    /** Tấm ngang có mặt chạm cạnh ngang ở cao độ edgeY, phủ scene X sx.
     *  end='down' → mặt TRÊN tấm = edgeY (cạnh đứng trên tấm); 'up' → mặt DƯỚI tấm = edgeY. */
    const findHorizAt = (end: 'down' | 'up', edgeY: number, sx: number): Part | undefined =>
      horizParts.find((hp) => {
        const surfY =
          end === 'down' ? hp.position[1] + hp.size[1] / 2 : hp.position[1] - hp.size[1] / 2;
        if (Math.abs(surfY - edgeY) > EPS) return false;
        return (
          sx > hp.position[0] - hp.size[0] / 2 - EPS && sx < hp.position[0] + hp.size[0] / 2 + EPS
        );
      });

    /** 1 bộ rãnh PAT trên mặt `side` của part, tâm tại scene (sx,sy,sz): vành chìm
     *  slotLength×slotWidth sâu rimDepth + rãnh giữa channelLength×channelWidth sâu
     *  channelDepth, trục dài chạy dọc chiều SÂU tủ (scene Z). */
    const patSlots = (
      host: Part,
      side: MachiningSide,
      scene: [number, number, number],
    ): Machining[] => {
      const { x_mm, y_mm } = panelCoord(host.size, host.position, scene);
      const along: 'length' | 'width' = lengthAxisOf(host.size) === 2 ? 'length' : 'width';
      return [
        slot('connector', side, x_mm, y_mm, conn.slotLength, conn.slotWidth, conn.rimDepth, along),
        slot('connector', side, x_mm, y_mm, conn.channelLength, conn.channelWidth, conn.channelDepth, along),
      ];
    };

    // Đếm để append note tóm tắt per tấm ngang (key = part id).
    const noteCount = new Map<string, { slots: number; backHoles: number }>();
    const bump = (id: string, field: 'slots' | 'backHoles'): void => {
      const cur = noteCount.get(id) ?? { slots: 0, backHoles: 0 };
      cur[field] += 1;
      noteCount.set(id, cur);
    };

    // Tâm chốt/rãnh theo chiều sâu: đo từ mép TỦ (D/2), KHÔNG từ mép part — vách phụ
    // thụt T_BACK phía sau vẫn thẳng hàng cữ với vách chính (P74.1, founder chốt 12/06).
    const zF = D / 2 - conn.insetFromFront;
    const zB = -D / 2 + conn.insetFromBack;

    // (a) VÁCH ĐỨNG + VÁCH PHỤ ĐỨNG: cạnh DƯỚI/TRÊN → rãnh PAT trên tấm ngang dưới/trên.
    // Vị trí khớp 1:1 với edge_drill connector đã phát trên cạnh.
    for (const dv of vertParts) {
      const [sx, sy] = dv.position;
      const dyS = dv.size[1];
      for (const end of ['down', 'up'] as const) {
        const edgeY = end === 'down' ? sy - dyS / 2 : sy + dyS / 2;
        const host = findHorizAt(end, edgeY, sx);
        if (!host) continue; // cạnh không chạm tấm ngang nào (không xảy ra với khung chuẩn)
        const side = horizFaceSide(host.id, end === 'down' ? 'up' : 'down');
        pushMach(host, [
          ...patSlots(host, side, [sx, host.position[1], zF]),
          ...patSlots(host, side, [sx, host.position[1], zB]),
        ]);
        bump(host.id, 'slots');
        bump(host.id, 'slots');
      }
    }

    // (b) VÁCH PHỤ NGANG (subh): 2 đầu trái/phải → rãnh PAT trên MẶT vách đứng 2 bên.
    // Mặt vách hướng về subh: vách TRÁI → mặt phải = 'front'; vách PHẢI → mặt trái = 'back'.
    // zF/zB dùng chung hằng số tủ ở trên (thẳng hàng cữ vách chính).
    for (const sh of subhParts) {
      const [sx, sy] = sh.position;
      const w = sh.size[0];
      for (const end of ['left', 'right'] as const) {
        const vx = end === 'left' ? sx - w / 2 - T / 2 : sx + w / 2 + T / 2; // tâm vách bên
        const host = vertParts.find(
          (dp) =>
            !dp.id.startsWith('subv-') &&
            Math.abs(dp.position[0] - vx) < EPS &&
            sy > dp.position[1] - dp.size[1] / 2 - EPS &&
            sy < dp.position[1] + dp.size[1] / 2 + EPS,
        );
        if (!host) continue;
        const side: MachiningSide = end === 'left' ? 'front' : 'back';
        pushMach(host, [
          ...patSlots(host, side, [vx, sy, zF]),
          ...patSlots(host, side, [vx, sy, zB]),
        ]);
      }
    }

    // (c) TẤM HẬU: chốt lò xo Ø{pinDia}×{pinHoleDepth} trên cạnh TRÊN + DƯỚI hậu
    //     + lỗ đón Ø{faceHoleDia}×{faceHoleDepth} trên mặt tấm ngang chạm cạnh đó.
    // Tâm lỗ đón = tâm bề dày hậu (scene Z = sz, sát mép sau tủ — Ø8 trên vành 4.5mm
    // sẽ hở ~0.5mm ra mép sau: chốt vẫn giữ 3 phía, xưởng muốn kín → giảm faceHoleDia admin).
    for (const bp of backParts) {
      const [sx, sy, sz] = bp.position;
      const w = bp.size[0];
      const h = bp.size[1];
      const tBack = bp.size[2];
      const nPins = Math.max(1, bf.pinsPerEdge);
      const span = w - 2 * bf.marginFromCellEdge;
      const pinXs: number[] = [];
      for (let i = 0; i < nPins; i++) {
        pinXs.push(nPins === 1 || span <= 0 ? sx : sx - span / 2 + (span * i) / (nPins - 1));
      }
      const edgeOps: Machining[] = [];
      for (const end of ['down', 'up'] as const) {
        const edgeY = end === 'down' ? sy - h / 2 : sy + h / 2;
        const host = findHorizAt(end, edgeY, sx);
        if (!host) continue;
        const side = horizFaceSide(host.id, end === 'down' ? 'up' : 'down');
        // Frame tấm hậu [w, h, tBack]: nếu w ≥ h → length axis = w (bản vẽ nằm ngang),
        // cạnh trên/dưới vật lý = edge 'top'/'bottom'. Nếu h > w → length axis = h (bản
        // vẽ xoay 90°, x_mm chạy theo chiều CAO từ đáy lên) → cạnh dưới vật lý = đầu
        // x=0 = edge 'left', cạnh trên = 'right'. Position dọc cạnh luôn đo từ mép TRÁI.
        const edge: 'top' | 'bottom' | 'left' | 'right' =
          w >= h ? (end === 'down' ? 'bottom' : 'top') : end === 'down' ? 'left' : 'right';
        for (const px of pinXs) {
          edgeOps.push({
            op: 'edge_drill',
            purpose: 'backScrew',
            edge,
            position_mm: r1(px - (sx - w / 2)),
            depth_mm: bf.pinHoleDepth,
            diameter_mm: bf.pinDia,
            thicknessOffset_mm: tBack / 2,
          });
          const { x_mm, y_mm } = panelCoord(host.size, host.position, [px, 0, sz]);
          pushMach(host, [drill('backScrew', side, x_mm, y_mm, bf.faceHoleDia, bf.faceHoleDepth, T)]);
          bump(host.id, 'backHoles');
        }
      }
      if (edgeOps.length) {
        pushMach(bp, edgeOps);
        bp.notes =
          (bp.notes ? `${bp.notes} | ` : '') +
          `Chốt lò xo Ø${bf.pinDia}×${bf.pinHoleDepth} cạnh trên/dưới (${edgeOps.length} chốt) — cắm vào lỗ đón trên tấm ngang`;
      }
    }

    // Append note tóm tắt cho tấm ngang nhận rãnh/lỗ.
    for (const hp of horizParts) {
      const cnt = noteCount.get(hp.id);
      if (!cnt) continue;
      const bits: string[] = [];
      if (cnt.slots > 0) {
        bits.push(
          `${cnt.slots} bộ rãnh connector 2-in-1 (vành ${conn.slotLength}×${conn.slotWidth} sâu ${conn.rimDepth} + rãnh ${conn.channelLength}×${conn.channelWidth} sâu ${conn.channelDepth}, dọc chiều sâu)`,
        );
      }
      if (cnt.backHoles > 0) {
        bits.push(`${cnt.backHoles} lỗ đón chốt hậu Ø${bf.faceHoleDia}×${bf.faceHoleDepth}`);
      }
      hp.notes = (hp.notes ? `${hp.notes} | ` : '') + bits.join(' + ');
    }
  }

  // --- Chân tủ: positionsPerDivider cái mỗi vách (P77 — footZs đọc spec; default 2:
  //     trước + sau, nơi lực dồn xuống nhiều nhất). Khớp 1:1 lỗ Ø8 bottomMachining.
  // (`fittings` đã hoist trước cells loop để strip handle push được)
  for (let k = 0; k <= columns; k++) {
    footZs.forEach((fz, i) => {
      fittings.push({
        id: `foot-c${k}-${i}`, kind: 'foot',
        size: [FOOT_DIA, FOOT_H, FOOT_DIA], position: [vachX[k], FOOT_H / 2, fz],
      });
    });
  }
  // Nhấc cả tủ lên đúng chiều cao chân → chân nằm gọn giữa sàn (y=0) và đáy tủ.
  for (const p of parts) p.position[1] += FOOT_H;
  // v3.4.1 fix: strip handle fittings ăn theo cánh → cũng phải shift up cùng tủ.
  // (foot fittings KHÔNG shift — chân nằm dưới sàn, không thuộc thân tủ.)
  for (const f of fittings) {
    if (f.kind === 'handle-strip') f.position[1] += FOOT_H;
  }

  const hardware: Hardware[] = [];
  if (hinges > 0) hardware.push({ id: 'hinge', label: 'Bản lề giảm chấn', qty: hinges });
  if (slides > 0) {
    // P76: id theo CỠ ray (4 mã Hafele, giá khác nhau) — 1 tủ 1 nấc sâu → đúng 1 mã.
    if (rail) {
      hardware.push({
        id: rail.hwId,
        label: `Ray âm EPC Plus ${rail.len}mm — Hafele ${rail.sku} (bộ)`,
        qty: slides,
        notes: `Mở 3/4, giảm chấn. Hàng vít thân ray xem DXF vách; khóa nhựa trước xưởng tự bắt.`,
      });
    }
  }
  // P45 — Tay nắm vào BOM theo handleKind (round CŨNG được tính — fix gap cũ).
  const handleQty = doorCount + drawerCount;
  if (handleQty > 0) {
    if (handleKind === 'strip') {
      hardware.push({
        id: 'handle_strip_black',
        label: 'Tay nắm strip đen (Nam Khang edge profile)',
        qty: handleQty,
        notes: `Gắn cạnh ${handleQty} cánh/mặt ngăn kéo — kích thước theo admin catalog.`,
      });
    } else if (handleKind === 'bar') {
      hardware.push({
        id: 'handle_bar',
        label: 'Tay nắm bar đen (profile L, căn giữa)',
        qty: handleQty,
        notes: `${handleQty} cánh/mặt ngăn kéo · profile chữ L, căn giữa, cách mép 75mm · 2 vít/cái.`,
      });
    } else if (handleKind === 'round') {
      hardware.push({
        id: 'handle',
        label: 'Tay nắm tròn (khoét lỗ Ø35)',
        qty: handleQty,
        notes: `Khoét Ø35 trên ${handleQty} cánh/mặt ngăn kéo.`,
      });
    }
    // P68 — handleKind === 'none' → KHÔNG đẩy tay nắm nào vào BOM (cánh push-open / không
    // tay nắm). Trước đây nhánh 'else' là catch-all → mọi loại lạ bị tính tay nắm TRÒN.
  }
  // foot count = footFittings only (strip handle fittings không tính chân).
  const footFittings = fittings.filter((f) => f.kind === 'foot');
  hardware.push({
    id: 'foot',
    label: 'Chân tủ (nút mỏng)',
    qty: footFittings.length,
    notes: `2 cái mỗi vách đứng (1 trước + 1 sau), bắt vào mặt dưới tấm đáy — ${columns + 1} vách.`,
  });

  // P74 — connector 2-in-1 + chốt lò xo hậu: đếm từ machining ĐÃ PHÁT (sau fused
  // filter + post-pass) → đúng số joint thực tế, mọi cấu hình gộp/chia.
  // 1 edge_drill 'connector' = 1 bộ (chốt Ø8×30 + PAT); 1 edge_drill 'backScrew' = 1 chốt lò xo.
  let connectorSets = 0;
  let backPinCount = 0;
  for (const p of parts) {
    for (const m of p.machining ?? []) {
      if (m.op !== 'edge_drill') continue;
      if (m.purpose === 'connector') connectorSets += 1;
      else if (m.purpose === 'backScrew') backPinCount += 1;
    }
  }
  if (connectorSets > 0) {
    hardware.push({
      id: 'connector_2in1',
      label: 'Connector 2-in-1 (chốt Ø8×30 + PAT)',
      qty: connectorSets,
      notes: `${conn.perJoint} bộ mỗi giao vách↔tấm ngang (tâm cách mép trước/sau ${conn.insetFromFront}/${conn.insetFromBack}mm) — chốt vặn vào cạnh vách, PAT khoá trong rãnh mặt tấm.`,
    });
  }
  if (backPinCount > 0) {
    hardware.push({
      id: 'back_clip',
      label: `Chốt lò xo tấm hậu Ø${bf.pinDia}×${bf.pinHoleDepth}`,
      qty: backPinCount,
      notes: `${bf.pinsPerEdge} chốt mỗi cạnh trên/dưới tấm hậu, cắm vào lỗ đón Ø${bf.faceHoleDia} trên tấm ngang.`,
    });
  }

  // P13.6: gridLines — vị trí center + chiều thông thuỷ mỗi cột/tầng cho dim per-cell.
  const colCenters: number[] = [];
  for (let c = 0; c < columns; c++) colCenters.push(colCenterX(c));
  const rowCenters: number[] = [];
  for (let r = 0; r < rows; r++) rowCenters.push(rowCenterY(r));
  const gridLines = {
    colCenters,
    colWidths: [...colWidths],
    rowCenters,
    rowHeights: [...rowHeights],
  };

  // P49 — Gán màu dán cạnh cho MỌI Part ở 1 nơi (thay vì rải khắp 17 chỗ panel()):
  //   • Cánh (id 'door-*') + ngăn kéo (id 'drawer*', gồm mặt/hông/đáy hộc) → LUÔN 'same'
  //     (đồng màu — theo yêu cầu founder, khách không đổi được cạnh cánh/ngăn kéo).
  //   • Khung/vách/kệ/nóc/đáy/lưng + còn lại → edgeType khách chọn (same/black/white).
  //   • Vật liệu lộ cạnh (plywood noEdgeBanding) → KHÔNG thực dán (banded=false): renderer
  //     dùng material.edgeHex vẽ 2-tone cạnh plywood thật; cutlist/pricing bỏ qua.
  const edgedParts: Part[] = parts.map((p) => {
    const ap = resolveMaterial(p.material);
    // Lộ cạnh (plywood noEdgeBanding): KHÔNG dán → edgeColor vắng để renderer fallback
    // material.edgeHex (vẽ 2-tone cạnh plywood thật); cutlist/pricing bỏ qua (banded=false).
    if (ap.noEdgeBanding === true) {
      return {
        ...p,
        edgeColor: undefined,
        edgeHex: undefined,
        edgeBanding: { front: false, back: false, left: false, right: false },
      };
    }
    // Cánh (door-*) + ngăn kéo (drawer*) LUÔN 'same'; còn lại theo edgeType khách chọn.
    const isDoorOrDrawer = p.id.startsWith('door-') || p.id.startsWith('drawer');
    const type: EdgeBandingType = isDoorOrDrawer ? 'same' : edgeType;
    return {
      ...p,
      edgeColor: type,
      edgeHex: edgeHexForBand(ap.hex, type), // 'same' → undefined (1-tone); đen/trắng → hex
      edgeBanding: { front: true, back: true, left: true, right: true },
    };
  });

  // P60 — metrics cho pricing margin theo thể tích + phụ trội phức tạp.
  return { parts: edgedParts, hardware, fittings, gridLines, size: { w: W, h: H, d: D }, drawerCount, doorCount, cavities };
}

const tuKe: ProductDNA = {
  slug: 'tu-ke',
  name: 'Tủ kệ Module',
  parameters,
  steps: STEPS,
  resolveControls,
  normalizeValues,
  getWarnings,
  build,
  priceConfig: { margin: 1.6, laborPerOrder: 300_000 },
};

export default tuKe;
