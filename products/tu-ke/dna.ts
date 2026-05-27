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
import { encodeCellGrid, parseCellGrid } from '@/configurator/cellgrid';
import { resolveMachiningSpec } from '@/configurator/machining-defaults';
import { resolveMaterial } from '@/configurator/materials';
import type {
  BuildOptions,
  BuildResult,
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
const TIER_MAX = 2400; // cao tối đa 1 ô (mm) — manual: khoá slider; chia đều: tự thêm tầng
const COL_MAX = 1200; // rộng tối đa 1 ô (mm) — manual: khoá slider; chia đều: tự thêm cột
const DOOR_MAX_WIDTH = 1200; // ô rộng hơn mức này → không cho cánh (kể cả cánh đôi) → mở-có-hậu
const DOOR_MAX_HEIGHT = 2400; // ô cao hơn mức này → không cho cánh → mở-có-hậu
const DRAWER_MAX_TOP = 1200; // đỉnh ô ≤ mức này mới cho ngăn kéo (tầm với + nhìn thấy đồ)
const DRAWER_MAX_HEIGHT = 400; // ô cao hơn mức này → không cho ngăn kéo (hộc quá cao)
const DRAWER_MAX_WIDTH = 900; // ô rộng hơn mức này → không cho ngăn kéo (ray quá dài) → fallback CÁNH
const FRONT_MIN_WIDTH = 250; // ô hẹp hơn mức này → không cho cánh/ngăn kéo (đủ chỗ ray/bản lề)
const SLIDE_GAP = 13; // khe mỗi bên giữa thùng hộc và vách ô — chừa ray trượt
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
const FOOT_INSET = 45; // tâm chân cách mép trước / sau tủ (mm)
const LOW_HANDLE_FROM_GROUND = 1200; // đáy ô ≥ mức này (từ sàn) → tay nắm cánh nằm sát cạnh DƯỚI
const PIN_DIA = 5; // chốt âm gắn kệ vào vách đứng — Ø5
const PIN_DEPTH = 11; // chốt âm sâu 11mm
const PIN_INSET_FB = 50; // chốt cách cạnh TRƯỚC / SAU của tấm 50mm
const BACK_SCREW_MARGIN = 30; // vít cố định tấm hậu — cách mép trái/phải tấm hậu 30mm
const BACK_SCREW_DIA = 3; // vít hậu Ø3
const BACK_SCREW_DEPTH_SOLO = 9; // vít hậu KHÔNG xuyên (đáy/nóc) — sâu 9mm
// --- S10 hằng số machining (chuẩn Blum/Hettich cho bản lề âm + ray ngăn kéo) ---
const HINGE_CUP_DIA = 35; // Ø cup bản lề âm (chuẩn công nghiệp 35mm)
const HINGE_CUP_DEPTH = 13; // sâu cup
const HINGE_CUP_INSET = 22; // tâm cup cách mép cánh (chuẩn Blum 21-22mm cho cup 35mm)
const HINGE_SCREW_DIA = 4; // vít M4 cố định bản lề
const HINGE_SCREW_DEPTH = 12;
const HINGE_SCREW_OFFSET = 32; // 2 lỗ vít cup cách tâm cup ±32mm trên trục cánh
const HINGE_PLATE_INSET_FB = 37; // tâm plate (lỗ vít trên vách) cách mép trước vách
const HINGE_PLATE_SPAN = 32; // 2 lỗ vít plate cách nhau 32mm theo trục cánh
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

/** Chiều cao mỗi tầng — chế độ "chia đều" (từ chiều cao tổng) hoặc "từng tầng" (núm tierH_*). */
function computeRowHeights(values: ParamValues): number[] {
  const T = bodyTFor(values.color);
  const rows = values.rows as number;
  if (values.heightMode === 'manual') {
    // tierH_* chưa kéo → mặc định = chia đều (khớp seed thanh trượt & build()).
    const seed = evenCell(values.height as number, rows, T);
    return Array.from({ length: rows }, (_, r) =>
      clamp(Number(values[`tierH_${r}`] ?? seed), CELL_MIN, TIER_MAX),
    );
  }
  const h = evenCell(Math.max(values.height as number, minTotal(rows, T)), rows, T);
  return Array.from({ length: rows }, () => h);
}

/** Bề rộng mỗi cột — chế độ "chia đều" (từ chiều rộng tổng) hoặc "từng cột" (núm colW_*). */
function computeColWidths(values: ParamValues): number[] {
  const T = bodyTFor(values.color);
  const columns = values.columns as number;
  if (values.widthMode === 'manual') {
    // colW_* chưa kéo → mặc định = chia đều (khớp seed thanh trượt & build()).
    const seed = evenCell(values.width as number, columns, T);
    return Array.from({ length: columns }, (_, c) =>
      clamp(Number(values[`colW_${c}`] ?? seed), CELL_MIN, COL_MAX),
    );
  }
  const w = evenCell(Math.max(values.width as number, minTotal(columns, T)), columns, T);
  return Array.from({ length: columns }, () => w);
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
// 74 ID: 9 mdf_son + 3 plywood_veneer + 17 PLY (11 PLY+ML + 6 PLY+AC) +
// 34 MDF chống ẩm (6 AC đồng + 6 AC cạnh đen + 11 ML đồng + 11 ML cạnh đen) +
// 11 MFC+ML (Minh Long ván dăm phủ melamine — CHỈ cạnh đen, không có đồng màu).
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
  // MDF+AC (An Cường) — MDF chống ẩm phủ melamine, DÁN CẠNH ĐỒNG MÀU
  'mdf_chong_am_melamine/ac_vang_nghe',
  'mdf_chong_am_melamine/ac_den_tuyen',
  'mdf_chong_am_melamine/ac_trang_kem',
  'mdf_chong_am_melamine/ac_nau_xam',
  'mdf_chong_am_melamine/ac_xanh_muc',
  'mdf_chong_am_melamine/ac_xanh_thien_thanh',
  // MDF+AC (An Cường) — MDF chống ẩm phủ melamine, DÁN CẠNH ĐEN
  'mdf_chong_am_melamine/ac_vang_nghe_edge_den',
  'mdf_chong_am_melamine/ac_den_tuyen_edge_den',
  'mdf_chong_am_melamine/ac_trang_kem_edge_den',
  'mdf_chong_am_melamine/ac_nau_xam_edge_den',
  'mdf_chong_am_melamine/ac_xanh_muc_edge_den',
  'mdf_chong_am_melamine/ac_xanh_thien_thanh_edge_den',
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
  // MDF+ML (Minh Long) — MDF chống ẩm phủ melamine, DÁN CẠNH ĐEN (11 variant)
  'mdf_chong_am_melamine/ml_xanh_reu_edge_den',
  'mdf_chong_am_melamine/ml_do_san_ho_edge_den',
  'mdf_chong_am_melamine/ml_xam_am_edge_den',
  'mdf_chong_am_melamine/ml_den_espresso_edge_den',
  'mdf_chong_am_melamine/ml_xanh_mint_edge_den',
  'mdf_chong_am_melamine/ml_xanh_diu_edge_den',
  'mdf_chong_am_melamine/ml_xanh_teal_dam_edge_den',
  'mdf_chong_am_melamine/ml_caramel_edge_den',
  'mdf_chong_am_melamine/ml_olive_edge_den',
  'mdf_chong_am_melamine/ml_xanh_navy_edge_den',
  'mdf_chong_am_melamine/ml_hong_phan_edge_den',
  // MFC+ML (Minh Long) — Ván dăm phủ melamine, CHỈ dán cạnh ĐEN (11 variant).
  // Body 18mm chuẩn (KHÔNG dùng 17mm như MDF Minh Long).
  'mfc_melamine/ml_xanh_reu_edge_den',
  'mfc_melamine/ml_do_san_ho_edge_den',
  'mfc_melamine/ml_xam_am_edge_den',
  'mfc_melamine/ml_den_espresso_edge_den',
  'mfc_melamine/ml_xanh_mint_edge_den',
  'mfc_melamine/ml_xanh_diu_edge_den',
  'mfc_melamine/ml_xanh_teal_dam_edge_den',
  'mfc_melamine/ml_caramel_edge_den',
  'mfc_melamine/ml_olive_edge_den',
  'mfc_melamine/ml_xanh_navy_edge_den',
  'mfc_melamine/ml_hong_phan_edge_den',
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

// --- Cấu hình MẶC ĐỊNH của 2 lưới ô (2 tầng × 3 cột — khớp rows/columns mặc định) ---
// Default S4: kệ trống lớn — 6 ô đều mở-có-hậu, tất cả màu = khung (clean
// minimalist cho landing visitor lần đầu vào /design).
const DEFAULT_CELLS = encodeCellGrid([
  ['open-back', 'open-back', 'open-back'],
  ['open-back', 'open-back', 'open-back'],
]);
const DEFAULT_CELL_COLORS = encodeCellGrid([
  [FRAME_COLOR, FRAME_COLOR, FRAME_COLOR],
  [FRAME_COLOR, FRAME_COLOR, FRAME_COLOR],
]);

// --- Núm TĨNH (seed giá trị ban đầu; danh sách hiển thị do resolveControls sinh) ---
const parameters: Parameter[] = [
  { id: 'width', label: 'Chiều rộng', type: 'number', min: 600, max: 2400, step: 1, unit: 'mm', default: 1900 },
  { id: 'height', label: 'Chiều cao', type: 'number', min: 700, max: 2400, step: 1, unit: 'mm', default: 2200 },
  // Bước 100mm rời rạc {300, 400, 500, 600} — chọn từ mô phỏng 10K đơn
  // (scripts/simulate-depth-waste.ts): tiết kiệm 23.9% waste khổ ván so với
  // slider tự do 300–700. Tổ hợp "khít" khổ 1220: 4×300 · 3×400 · 2×600 ·
  // 1×500+1×400+1×300 — tận dụng ván khi xưởng gom đơn cùng khổ.
  { id: 'depth', label: 'Chiều sâu', type: 'number', min: 300, max: 600, step: 100, unit: 'mm', default: 400 },
  { id: 'columns', label: 'Số cột', type: 'number', min: 1, max: 5, step: 1, unit: 'cột', default: 3 },
  { id: 'rows', label: 'Số tầng', type: 'number', min: 1, max: 6, step: 1, unit: 'tầng', default: 2 },
  {
    id: 'widthMode',
    label: 'Chế độ chiều rộng',
    type: 'option',
    default: 'even',
    options: [
      { value: 'even', label: 'Chia đều' },
      { value: 'manual', label: 'Từng cột' },
    ],
  },
  {
    id: 'heightMode',
    label: 'Chế độ chiều cao',
    type: 'option',
    default: 'even',
    options: [
      { value: 'even', label: 'Chia đều' },
      { value: 'manual', label: 'Từng tầng' },
    ],
  },
  { id: 'color', label: 'Vật liệu khung', type: 'option', default: 'mdf_son/den', options: materialOptions() },
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

  // --- Nhóm "Chiều rộng": số cột + chế độ + (1 núm tổng | mỗi cột 1 núm) ---
  // chia đều: số cột có min ĐỘNG (đủ cột để mỗi ô rộng ≤ COL_MAX).
  const columnsParam =
    values.widthMode === 'even'
      ? { ...paramById('columns'), min: minColsForEvenWidth(values.width as number, T) }
      : paramById('columns');
  list.push(inGroup(columnsParam, 'Chiều rộng'));
  list.push(inGroup(paramById('widthMode'), 'Chiều rộng'));
  if (values.widthMode === 'manual') {
    const split = evenCell(values.width as number, columns, T);
    for (let c = 0; c < columns; c++) {
      list.push(inGroup(sizeSlider(`colW_${c}`, `Rộng cột ${c + 1}`, split, COL_MAX), 'Chiều rộng'));
    }
  } else {
    const wp = paramById('width');
    list.push(inGroup({ ...wp, min: stepMin(columns, wp.step ?? 50, T) }, 'Chiều rộng'));
  }

  // --- Nhóm "Chiều cao": số tầng + chế độ + (1 núm tổng | mỗi tầng 1 núm) ---
  // - max ĐỘNG (cả 2 mode): không cho rows vượt physical fit (mỗi ô ≥ CELL_MIN).
  // - min ĐỘNG (chỉ "chia đều"): đủ tầng để mỗi ô cao ≤ TIER_MAX.
  const heightTotal = values.height as number;
  const dynMaxRows = maxRowsForHeight(heightTotal, T);
  const rowsParam =
    values.heightMode === 'even'
      ? { ...paramById('rows'), min: minRowsForEvenHeight(heightTotal, T), max: dynMaxRows }
      : { ...paramById('rows'), max: dynMaxRows };
  list.push(inGroup(rowsParam, 'Chiều cao'));
  list.push(inGroup(paramById('heightMode'), 'Chiều cao'));
  if (values.heightMode === 'manual') {
    const split = evenCell(values.height as number, rows, T);
    for (let r = 0; r < rows; r++) {
      list.push(inGroup(sizeSlider(`tierH_${r}`, `Cao tầng ${r + 1}`, split, TIER_MAX), 'Chiều cao'));
    }
  } else {
    const hp = paramById('height');
    list.push(inGroup({ ...hp, min: stepMin(rows, hp.step ?? 50, T) }, 'Chiều cao'));
  }

  list.push(paramById('depth'));

  // --- Lưới loại ô (hiển thị như MẶT ĐỨNG tủ: ô đúng tỉ lệ thật + màu sơn) ---
  const rowHeights = computeRowHeights(values);
  const colWidths = computeColWidths(values);
  const rowBottomY = starts(rowHeights, T);
  // Tắt lựa chọn theo TẦNG: ngăn kéo (đỉnh > DRAWER_MAX_TOP hoặc ô cao > DRAWER_MAX_HEIGHT) ·
  // cánh (cao > DOOR_MAX_HEIGHT — thực tế bằng TIER_MAX nên hiếm khi kích hoạt từ UI).
  const disabledByRow = rowHeights.map((h, r) => {
    const out: string[] = [];
    if (rowBottomY[r] + h > DRAWER_MAX_TOP || h > DRAWER_MAX_HEIGHT) out.push('drawer');
    if (h > DOOR_MAX_HEIGHT) out.push('door');
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
  const typeGrid = parseCellGrid((values.cells as string) ?? '');

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

  // Param 'color' lấy shape từ static parameters + REBUILD options với ctx labels
  // → label từ catalog (single source) hoặc autoLabelFromId nếu catalog miss.
  list.push({ ...paramById('color'), options: materialOptions(ctx) });

  // Gắn nhãn BƯỚC cho từng núm (wizard): lưới loại ô → 'cells'; lưới vật liệu + vật
  // liệu khung → 'finish'; còn lại (số cột/tầng, chế độ, rộng/cao/sâu) → 'size'.
  return list.map((p) => ({
    ...p,
    stepId:
      p.id === 'cells' ? 'cells' : p.id === 'cellColors' || p.id === 'color' ? 'finish' : 'size',
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
  const T = bodyTFor(v.color); // F2: body thickness theo material khung
  // Clamp rows xuống dynamic max (mọi mode) — khi user shrink height nhỏ hơn,
  // rows cũ có thể vượt physical fit → auto giảm xuống max mới.
  v.rows = Math.min(v.rows as number, maxRowsForHeight(v.height as number, T));
  if (v.heightMode === 'even') {
    v.rows = Math.max(v.rows as number, minRowsForEvenHeight(v.height as number, T));
  }
  if (v.widthMode === 'even') {
    v.columns = Math.max(v.columns as number, minColsForEvenWidth(v.width as number, T));
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
 * Tủ kệ KHÔNG dán cạnh → edgeBanding mọi cạnh false.
 */
function panel(
  id: string,
  label: string,
  material: string,
  size: [number, number, number],
  position: [number, number, number],
  extra?: { notes?: string; holes?: PanelHole[]; machining?: Machining[] },
): Part {
  const [length_mm, width_mm, thickness_mm] = [...size].sort((a, b) => b - a);
  return {
    id,
    label,
    material,
    size,
    position,
    length_mm,
    width_mm,
    thickness_mm,
    grain: 'length',
    edgeBanding: { front: false, back: false, left: false, right: false },
    qty: 1,
    notes: extra?.notes,
    holes: extra?.holes,
    machining: extra?.machining,
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
 * Chọn size ray ngăn kéo chuẩn xưởng VN dựa trên chiều sâu tủ.
 * Bộ size cố định: {250, 300, 350, 400, 450, 500}mm. Quy tắc:
 *  - D là bội 50 → ray = floor((D-50)/50)*50 (an toàn, ray nhỏ hơn thùng vài mm).
 *  - D lẻ      → ray = round((D-50)/50)*50 (gần nhất, xưởng điều chỉnh SLIDE_GAP).
 * Kết quả luôn nằm trong [250, 500].
 */
function slideSizeForDepth(D: number): number {
  const target = D - 50;
  const snap =
    D % 50 === 0 ? Math.floor(target / 50) * 50 : Math.round(target / 50) * 50;
  return Math.max(250, Math.min(500, snap));
}

/**
 * Số bản lề mỗi lá cánh, chia theo chiều cao mặt cánh (mm).
 * <1200: 2 · 1200–<1800: 3 · 1800–<2200: 4 · 2200–2400: 5.
 */
function hingeCount(faceH: number): number {
  if (faceH < 1200) return 2;
  if (faceH < 1800) return 3;
  if (faceH < 2200) return 4;
  return 5;
}

/**
 * Toạ độ Y (mm, từ ĐÁY cánh) của tâm từng bản lề: cách đầu/đuôi 100mm,
 * các bản lề còn lại chia ĐỀU khoảng giữa. count ≥ 2.
 */
function hingeYOnDoor(faceH: number, count: number): number[] {
  const margin = 100;
  if (count <= 1) return [faceH / 2];
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
  const D = params.depth as number;
  const slideSize = slideSizeForDepth(D); // ray ngăn kéo chuẩn xưởng (1 size cho cả tủ)
  const columns = params.columns as number;
  const rows = params.rows as number;
  const frameMaterial = params.color as string;
  // F2: body thickness theo material khung — MCA=17, mdf_son/plywood=18.
  // Mọi panel thân + spacing math dùng T này (cells override color cho back, không thay đổi geometry).
  const T = bodyTFor(frameMaterial);
  // v3.4: chọn kiểu tay nắm theo edge banding của frame material:
  //   edgeHex='#000000' → STRIP handle (Nam Khang edge profile đen) — gắn cạnh, không khoét lỗ
  //   else              → tay nắm tròn khoét lỗ Ø35 (hành vi cũ)
  const useStripHandle = resolveMaterial(frameMaterial).edgeHex === '#000000';
  // Đếm cánh + ngăn kéo để tính số tay nắm cuối hàm.
  let doorCount = 0;
  let drawerCount = 0;
  // Fittings (chân tủ + strip handle) — hoist trước cells loop để strip handle push được.
  const fittings: Fitting[] = [];
  // Màu từng ô (lưới "Màu từng ô"): FRAME_COLOR (hoặc trống) → ăn theo màu khung.
  const colorGrid = parseCellGrid((params.cellColors as string) ?? '');
  const cellMaterial = (r: number, c: number): string => {
    const v = colorGrid[r]?.[c];
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
  const grid = parseCellGrid((params.cells as string) ?? '');
  const cellType = (r: number, c: number): string => {
    let t = grid[r]?.[c] ?? DEFAULT_CELL;
    const w = colWidths[c];
    const h = rowHeights[r];
    const top = rowBottomY[r] + h;
    if ((t === 'drawer' || t === 'door') && w < FRONT_MIN_WIDTH) return DEFAULT_CELL;
    if (t === 'drawer' && (top > DRAWER_MAX_TOP || h > DRAWER_MAX_HEIGHT || w > DRAWER_MAX_WIDTH)) {
      t = 'door';
    }
    if (t === 'door' && (w > DOOR_MAX_WIDTH || h > DOOR_MAX_HEIGHT)) return DEFAULT_CELL;
    return t;
  };

  // Ghi chú cho 1 vách đứng (k, r): chỉ ra bản lề / ray gắn vào vách này, kèm
  // toạ độ Y (mm từ đáy vách). Gộp từ ô bên TRÁI (mép phải vách k) và ô bên PHẢI
  // (mép trái vách k). Đáy vách so với đáy cánh chênh FRONT_GAP/2 → cộng bù vào Y.
  const dividerNote = (k: number, r: number): string | undefined => {
    const out: string[] = [];
    const off = FRONT_GAP / 2;
    const inspect = (c: number, side: 'L' | 'R'): void => {
      const t = cellType(r, c);
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
      } else if (t === 'drawer') {
        const yCenter = Math.round(rowHeights[r] / 2);
        out.push(
          `Ray hộc ô (T${r + 1},C${c + 1}) ${slideSize}mm — 1 cặp tâm Y = ${yCenter}mm`,
        );
      }
    };
    if (k > 0) inspect(k - 1, 'L'); // ô bên trái: vách là mép phải của ô đó
    if (k < columns) inspect(k, 'R'); // ô bên phải: vách là mép trái của ô đó
    return out.length ? out.join(' | ') : undefined;
  };

  // --- S10.1 — Machining trên VÁCH ĐỨNG (refactor B4: shelfPin line + backClip + confirmat edge) ---
  // Convention: 'front' của vách = mặt PHẢI (X+ scene). 'back' = mặt TRÁI.
  // Lỗ từ ô láng giềng:
  //   - neighborSide='L' (ô bên TRÁI vách = vách là mép phải của ô c) → mặt vách hướng ô = TRÁI = 'back'
  //   - neighborSide='R' (ô bên PHẢI vách = vách là mép trái của ô c) → mặt vách hướng ô = PHẢI = 'front'
  // Vách [T, rowH, D] position [vachX[k], yC, 0] — panelCoord() tự nhận length/width axis.
  //
  // Operations:
  //   1. Hinge plate Ø4 (existing) — vít M4 cố định bản lề trên vách láng giềng cánh
  //   2. Drawer slide Ø4 (existing, bug 2 fix: span 16 → spec.drawerSlide.clusterScrewSpan = 32)
  //   3. Shelf pin Ø5 line 32mm (NEW bug 1 fix) — 2 dãy dọc cột, mỗi mặt vách có ô láng giềng
  //   4. Back clip Ø8 (NEW bug 4 fix) — clip lò xo giữ tấm hậu, mặt vách láng giềng ô có hậu
  //   5. Confirmat pilot Ø5 edge drill (NEW bug 3 fix) — trên CẠNH TRÊN + DƯỚI vách, liên kết với nóc/đáy
  const dividerMachining = (k: number, r: number): Machining[] => {
    const out: Machining[] = [];
    const rowH = rowHeights[r];
    const partSize: [number, number, number] = [T, rowH, D];
    const partPos: [number, number, number] = [vachX[k], rowCenterY(r), 0];
    const off = FRONT_GAP / 2;
    const cellHasBack = (c: number): boolean => cellType(r, c) !== 'open-nobk';

    // === 3. Shelf pin Ø5 line 32mm drilling — dọc trên cạnh trong vách ===
    if (spec.shelfPin.mode === 'line32mm') {
      const startY = spec.shelfPin.lineStartFromBottom;
      const endY = rowH - spec.shelfPin.lineEndFromTop;
      const yPositions: number[] = [];
      for (let y = startY; y <= endY; y += spec.shelfPin.lineSpacing) yPositions.push(y);
      const zFront = D / 2 - spec.shelfPin.columnInsetFromFront;
      const zBack = -D / 2 + spec.shelfPin.columnInsetFromBack;
      const emitShelfPinLine = (machSide: MachiningSide): void => {
        for (const yLocal of yPositions) {
          const yScene = rowBottomY[r] + yLocal;
          for (const zScene of [zFront, zBack]) {
            const { x_mm, y_mm } = panelCoord(partSize, partPos, [vachX[k], yScene, zScene]);
            out.push(drill('shelfPin', machSide, x_mm, y_mm, spec.shelfPin.pinDia, spec.shelfPin.pinDepth, T));
          }
        }
      };
      // Vách giữa có cả 2 ô → 2 mặt; vách biên → 1 mặt
      if (k < columns) emitShelfPinLine('front'); // ô bên phải
      if (k > 0) emitShelfPinLine('back'); // ô bên trái
    }

    // === 4. Back fastener — clip lò xo Ø8 (default) hoặc vít hậu (legacy) ===
    if (spec.backFastener.mode === 'clip') {
      const zClipScene = -D / 2 + spec.backFastener.clipInsetFromBackEdge; // gần mép sau
      const yTopLocal = rowH - spec.backFastener.clipMarginFromCellEnd;
      const yBotLocal = spec.backFastener.clipMarginFromCellEnd;
      const emitClips = (machSide: MachiningSide): void => {
        for (const yLocal of [yTopLocal, yBotLocal]) {
          const yScene = rowBottomY[r] + yLocal;
          const { x_mm, y_mm } = panelCoord(partSize, partPos, [vachX[k], yScene, zClipScene]);
          out.push(drill('backScrew', machSide, x_mm, y_mm, spec.backFastener.clipDia, spec.backFastener.clipDepth, T));
        }
      };
      if (k < columns && cellHasBack(k)) emitClips('front');
      if (k > 0 && cellHasBack(k - 1)) emitClips('back');
    }
    // mode 'screw' → vít hậu trên tấm ngang (legacy — handled in panel() of bottom/top/shelf nếu cần)

    // === 5. Confirmat pilot Ø5 edge drill — trên CẠNH TRÊN + DƯỚI vách ===
    // Mỗi vách liên kết với đáy (cạnh DƯỚI) + nóc (cạnh TRÊN) + có thể cả kệ giữa (cạnh nối với kệ).
    // Hiện tại em chỉ làm liên kết đáy/nóc (cạnh top/bottom của vách). Kệ giữa sẽ handled by kệ panel
    // (cần biết vị trí kệ — defer to future enhancement vì kệ không cố định nếu shelf pin line).
    const confSpec = spec.confirmat;
    const emitConfirmatEdge = (edge: 'top' | 'bottom'): void => {
      // 2 confirmat per joint: 1 cách mép trước + 1 cách mép sau
      // Trên cạnh top/bottom của vách (cạnh ngắn = D dài), position dọc theo cạnh đó = scene Z + D/2
      const zFrontPos = D - confSpec.insetFromFront; // tâm pilot 1 (gần mép trước)
      const zBackPos = confSpec.insetFromBack; // tâm pilot 2 (gần mép sau)
      for (const pos of [zFrontPos, zBackPos]) {
        out.push({
          op: 'edge_drill',
          purpose: 'confirmat',
          edge,
          position_mm: pos,
          depth_mm: confSpec.pilotDepth,
          diameter_mm: confSpec.pilotDia,
          thicknessOffset_mm: T / 2, // giữa cạnh
        });
      }
    };
    // Vách k=0..columns đều có cạnh DƯỚI liên kết đáy + cạnh TRÊN liên kết nóc
    emitConfirmatEdge('bottom');
    emitConfirmatEdge('top');

    // === 1 + 2. Hinge plate + Drawer slide (existing — refactored to use spec) ===
    const inspect = (c: number, neighborSide: 'L' | 'R'): void => {
      const t = cellType(r, c);
      const machSide: MachiningSide = neighborSide === 'L' ? 'back' : 'front';
      if (t === 'door') {
        const faceH = rowH - FRONT_GAP;
        const n = hingeCount(faceH);
        const ys = hingeYOnDoor(faceH, n);
        const cw = colWidths[c];
        const zScene = D / 2 - spec.hingePlate.plateInsetFromEdge;
        const yBaseScene = rowBottomY[r] + off;
        const emitPlate = (): void => {
          for (const ydoor of ys) {
            const yHinge = yBaseScene + ydoor;
            for (const dy of [-spec.hingePlate.plateScrewSpan / 2, spec.hingePlate.plateScrewSpan / 2]) {
              const { x_mm, y_mm } = panelCoord(partSize, partPos, [vachX[k], yHinge + dy, zScene]);
              out.push(drill('hinge', machSide, x_mm, y_mm, spec.hingePlate.plateScrewDia, spec.hingePlate.plateScrewDepth, T));
            }
          }
        };
        if (cw > WIDE_CELL) {
          emitPlate();
        } else {
          const sign = singleDoorHandleSign(c, columns);
          if ((neighborSide === 'L' && sign < 0) || (neighborSide === 'R' && sign > 0)) {
            emitPlate();
          }
        }
      } else if (t === 'drawer') {
        const yCenterScene = rowCenterY(r);
        const zScenePts = [
          D / 2 - spec.drawerSlide.clusterInsetFromEdge,
          -D / 2 + spec.drawerSlide.clusterInsetFromEdge,
        ];
        const span = spec.drawerSlide.clusterScrewSpan; // Bug 2 fix: 32 thay vì 16
        for (const zScene of zScenePts) {
          for (const dy of [-span / 2, span / 2]) {
            const { x_mm, y_mm } = panelCoord(partSize, partPos, [vachX[k], yCenterScene + dy, zScene]);
            out.push(
              drill('drawerSlide', machSide, x_mm, y_mm, spec.drawerSlide.screwDia, spec.drawerSlide.screwDepth, T),
            );
          }
        }
      }
    };
    if (k > 0) inspect(k - 1, 'L');
    if (k < columns) inspect(k, 'R');
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

  // --- S10 — Machining trên CÁNH + MẶT NGĂN KÉO ---
  // 'front' = mặt khách nhìn (Z+ scene). Tay nắm Ø35 xuyên → through=true.
  // Cup bản lề Ø35×13mm ở side='back' (mặt TRONG cánh). 2 vít cup cách tâm cup
  // ±HINGE_SCREW_OFFSET theo trục Y cánh.
  // hingeSign: +1=mép TRÁI cánh, −1=mép PHẢI, 0=không có bản lề (mặt ngăn kéo).
  const frontFaceMachining = (
    doorSize: [number, number, number],
    doorPos: [number, number, number],
    faceH: number,
    faceW: number,
    hingeSign: 1 | -1 | 0,
    handle: PanelHole | null, // v3.4: nullable — khi strip handle thì skip drill 'handle'
  ): Machining[] => {
    const out: Machining[] = [];
    if (handle) {
      const sceneHandle: [number, number, number] = [
        doorPos[0] + handle.dx,
        doorPos[1] + handle.dy,
        doorPos[2],
      ];
      const h = panelCoord(doorSize, doorPos, sceneHandle);
      out.push(drill('handle', 'front', h.x_mm, h.y_mm, handle.r * 2, T, T));
    }

    if (hingeSign !== 0) {
      const ys = hingeYOnDoor(faceH, hingeCount(faceH));
      // Tâm cup cách mép cánh HINGE_CUP_INSET theo trục X scene (chiều rộng cánh):
      //   hingeSign=+1 → mép TRÁI: xCup = doorPos.x - faceW/2 + HINGE_CUP_INSET
      //   hingeSign=-1 → mép PHẢI: xCup = doorPos.x + faceW/2 - HINGE_CUP_INSET
      const xCupScene = doorPos[0] + hingeSign * (-faceW / 2 + HINGE_CUP_INSET);
      for (const ydoor of ys) {
        const yScene = doorPos[1] - faceH / 2 + ydoor;
        const cup = panelCoord(doorSize, doorPos, [xCupScene, yScene, doorPos[2]]);
        out.push(pocket('hinge', 'back', cup.x_mm, cup.y_mm, HINGE_CUP_DIA, HINGE_CUP_DEPTH));
        for (const dy of [-HINGE_SCREW_OFFSET, HINGE_SCREW_OFFSET]) {
          const sc = panelCoord(doorSize, doorPos, [xCupScene, yScene + dy, doorPos[2]]);
          out.push(drill('hinge', 'back', sc.x_mm, sc.y_mm, HINGE_SCREW_DIA, HINGE_SCREW_DEPTH, T));
        }
      }
    }
    return out;
  };

  // --- Helper sinh note lỗ khoan cho tấm NGANG (đáy / nóc / kệ) ---
  // Chốt kệ Ø5×11mm tại mỗi vách (2 lỗ trước + sau, Z = ±(D/2 - PIN_INSET_FB)).
  // Vít hậu Ø3 ở tâm tấm hậu (Z = -(D - T_BACK)/2): nóc/đáy khoan sâu 9mm 1 mặt,
  // kệ khoan XUYÊN qua. Mỗi ô có hậu = 2 lỗ (cách mép trái/phải BACK_SCREW_MARGIN).
  const pinZ = Math.round(D / 2 - PIN_INSET_FB);
  const backScrewZ = Math.round(-(D - T_BACK) / 2);
  const footZ = D / 2 - FOOT_INSET; // S10: hoist sớm cho bottomMachining (cũ ở loop fittings)
  const pinXLine = vachX.map((x) => Math.round(x)).join(', ');
  const cellsWithBackOnRow = (r: number): number[] => {
    const out: number[] = [];
    for (let c = 0; c < columns; c++) if (cellType(r, c) !== 'open-nobk') out.push(c);
    return out;
  };
  const formatBackX = (cols: number[]): string =>
    cols
      .map((c) => {
        const xC = colCenterX(c);
        const inset = colWidths[c] / 2 - BACK_SCREW_MARGIN;
        return `${Math.round(xC - inset)}/${Math.round(xC + inset)}`;
      })
      .join(', ');
  const buildHoleNote = (mode: 'bottom' | 'top' | 'shelf', backCols: number[]): string => {
    const surface =
      mode === 'shelf' ? 'CẢ 2 MẶT (trên + dưới)' : mode === 'bottom' ? 'mặt TRÊN' : 'mặt DƯỚI';
    const out: string[] = [];
    out.push(
      `Chốt kệ Ø${PIN_DIA}×${PIN_DEPTH}mm — ${surface}, mỗi vách 2 lỗ Z=±${pinZ}mm tại X = ${pinXLine}mm`,
    );
    if (backCols.length > 0) {
      const screwDesc =
        mode === 'shelf'
          ? `XUYÊN qua kệ Ø3 tại Z=${backScrewZ}mm`
          : `Ø3 sâu ${T_BACK}mm — ${surface} tại Z=${backScrewZ}mm`;
      out.push(
        `Vít hậu ${screwDesc}, ${backCols.length} ô × 2 lỗ: X = ${formatBackX(backCols)}mm`,
      );
    }
    return out.join(' | ');
  };

  // ===========================================================
  // S10 — Machining (toạ độ DXF có cấu trúc cho CNC, song song với notes text)
  // Tấm ngang [W, T, D] position [0, py, 0]: length=X, width=Z → x_mm = sceneX+W/2,
  // y_mm = sceneZ+D/2. Convention 'front' cho từng tấm xem trong comment dưới.
  // ===========================================================
  const xpH = (xs: number) => xs + W / 2; // panel x_mm cho tấm ngang
  const ypH = (zs: number) => zs + D / 2; // panel y_mm cho tấm ngang

  /** Chốt kệ Ø5 trên 1 tấm ngang. side='front' (mặt khoan chính) hoặc 'back' (kệ giữa). */
  const horizPinDrills = (side: MachiningSide): Machining[] => {
    const out: Machining[] = [];
    for (const xv of vachX) {
      const xp = xpH(xv);
      out.push(drill('shelfPin', side, xp, ypH(pinZ), PIN_DIA, PIN_DEPTH, T));
      out.push(drill('shelfPin', side, xp, ypH(-pinZ), PIN_DIA, PIN_DEPTH, T));
    }
    return out;
  };

  /** Vít hậu Ø3 trên 1 tấm ngang. through=true cho kệ giữa (xuyên Ø3 sâu T). */
  const horizBackScrewDrills = (backCols: number[], through: boolean): Machining[] => {
    const out: Machining[] = [];
    const depth = through ? T : BACK_SCREW_DEPTH_SOLO;
    for (const c of backCols) {
      const xC = colCenterX(c);
      const inset = colWidths[c] / 2 - BACK_SCREW_MARGIN;
      out.push(
        drill('backScrew', 'front', xpH(xC - inset), ypH(backScrewZ), BACK_SCREW_DIA, depth, T),
      );
      out.push(
        drill('backScrew', 'front', xpH(xC + inset), ypH(backScrewZ), BACK_SCREW_DIA, depth, T),
      );
    }
    return out;
  };

  const parts: Part[] = [];
  let hinges = 0;
  let slides = 0;

  // --- Tấm ngang DÀI (chạy hết W): đáy + nóc + kệ giữa ---
  // S10.1 refactor B4:
  //   - Bỏ chốt kệ Ø5 (move to vách qua dividerMachining shelfPin line32mm)
  //   - Bỏ vít hậu Ø3 (replaced by clip lò xo Ø8 trên vách qua dividerMachining backFastener clip)
  //   - Thêm confirmat counterbore Ø7 + thru hole Ø6.3 (NEW — liên kết với cạnh vách)
  //   - Đáy giữ foot Ø8 định vị (mặt dưới = side 'back')
  //   - Kệ giữa: machining EMPTY nếu shelfPin.mode='line32mm' (kệ trượt vào chốt, không vít)
  //              hoặc confirmat counterbore nếu mode='fixed' (defer to future)
  const confSpec = spec.confirmat;
  /** Confirmat counterbore + thru hole trên 1 tấm ngang. side='back' = mặt khoan
   *  (đáy mặt dưới hướng xuống, nóc mặt trên hướng lên). */
  const horizConfirmatCounterbores = (machSide: MachiningSide): Machining[] => {
    const out: Machining[] = [];
    for (const xv of vachX) {
      const xp = xpH(xv);
      for (const zScene of [D / 2 - confSpec.insetFromFront, -D / 2 + confSpec.insetFromBack]) {
        const yp = ypH(zScene);
        // Counterbore Ø7 sâu 13mm (đầu vít chìm xuống)
        out.push(drill('confirmat', machSide, xp, yp, confSpec.counterboreDia, confSpec.counterboreDepth, T));
        // Thru hole Ø6.3 xuyên qua tấm cho thân vít
        out.push(drill('confirmat', machSide, xp, yp, confSpec.screwDia, T, T));
      }
    }
    return out;
  };

  // Tấm đáy:
  //   - Confirmat counterbore mặt DƯỚI ('back') — đầu vít chìm khi vặn từ dưới lên vào cạnh dưới vách
  //   - Foot Ø8 mặt DƯỚI ('back') — chân tủ định vị
  const bottomBackCols = cellsWithBackOnRow(0); // dùng cho text note (legacy)
  const bottomMachining: Machining[] = [...horizConfirmatCounterbores('back')];
  for (const xv of vachX) {
    bottomMachining.push(drill('foot', 'back', xpH(xv), ypH(footZ), spec.foot.pinDia, spec.foot.pinDepth, T));
    bottomMachining.push(drill('foot', 'back', xpH(xv), ypH(-footZ), spec.foot.pinDia, spec.foot.pinDepth, T));
  }
  const bottomNote =
    `Mặt dưới: ${2 * (columns + 1)} lỗ chân Ø${spec.foot.pinDia} + ` +
    `${2 * (columns + 1)} lỗ counterbore Ø${confSpec.counterboreDia} cho confirmat M${confSpec.screwDia}×${confSpec.screwLength}` +
    (bottomBackCols.length > 0 ? ` · Tấm hậu lắp bằng clip lò xo Ø${spec.backFastener.clipDia} (xem vách)` : '');
  parts.push(
    panel('bottom', 'Tấm đáy', frameMaterial, [W, T, D], [0, T / 2, 0], {
      notes: bottomNote,
      machining: bottomMachining,
    }),
  );

  // Tấm nóc:
  //   - Confirmat counterbore mặt TRÊN ('back' vì nóc convention front=mặt dưới)
  //   - Không có foot, không có gì khác
  parts.push(
    panel('top', 'Tấm nóc', frameMaterial, [W, T, D], [0, H - T / 2, 0], {
      notes:
        `Mặt trên: ${2 * (columns + 1)} lỗ counterbore Ø${confSpec.counterboreDia} cho confirmat M${confSpec.screwDia}×${confSpec.screwLength}`,
      machining: [...horizConfirmatCounterbores('back')],
    }),
  );

  // Kệ giữa: machining empty (shelfPin line32mm — kệ trượt vào chốt, không vít).
  // TODO: support `spec.shelfPin.mode='fixed'` → confirmat trên kệ.
  for (let g = 0; g < rows - 1; g++) {
    const y = rowBottomY[g] + rowHeights[g] + T / 2;
    parts.push(
      panel(`shelf-${g}`, 'Kệ', frameMaterial, [W, T, D], [0, y, 0], {
        notes: `Kệ trượt — đặt vào chốt Ø${spec.shelfPin.pinDia} trên vách (mode 32mm-line)`,
      }),
    );
  }

  // --- Vách đứng: đoạn ngắn 1 tầng, columns+1 vị trí (gồm 2 mép biên) ---
  // Mỗi vách có note vị trí bản lề / ray (nếu ô láng giềng cần gắn vào vách này).
  // S10: kèm machining[] có cấu trúc cho cùng bản lề/ray (plate Ø4 chuẩn Blum/Hettich).
  for (let k = 0; k <= columns; k++) {
    for (let r = 0; r < rows; r++) {
      const note = dividerNote(k, r);
      const mach = dividerMachining(k, r);
      const extra: { notes?: string; machining?: Machining[] } = {};
      if (note) extra.notes = note;
      if (mach.length) extra.machining = mach;
      parts.push(
        panel(
          `divider-c${k}-r${r}`,
          'Vách đứng',
          frameMaterial,
          [T, rowHeights[r], D],
          [vachX[k], rowCenterY(r), 0],
          Object.keys(extra).length ? extra : undefined,
        ),
      );
    }
  }

  // --- Từng ô: tấm lưng (per-ô, trừ "mở không hậu") + mặt trước (cánh/ngăn kéo) ---
  // Cánh/hộc CHÌM trong ô; mặt ngoài phẳng cạnh trước khung. Tay nắm = lỗ khoét Ø35.
  const backZ = -(D - T_BACK) / 2;
  const frontZ = D / 2 - T / 2;
  const topHoleY = (h: number) => h / 2 - HOLE_INSET; // tâm lỗ — gần cạnh trên
  for (let r = 0; r < rows; r++) {
    const yC = rowCenterY(r);
    const faceH = rowHeights[r] - FRONT_GAP;
    for (let c = 0; c < columns; c++) {
      const xC = colCenterX(c);
      const cw = colWidths[c];
      const type = cellType(r, c);
      const cm = cellMaterial(r, c); // màu ô này — phủ tấm hậu + cánh/ngăn kéo

      // tấm lưng riêng cho ô (mọi loại trừ "mở không hậu").
      // Cánh & ngăn kéo: hậu bị che → dùng MÀU KHUNG (không phát sinh ván phụ vô ích).
      // Mở-có-hậu: hậu là điểm tô màu cho ô trống → dùng cellMaterial của ô.
      if (type !== 'open-nobk') {
        const backMaterial = type === 'door' || type === 'drawer' ? frameMaterial : cm;
        parts.push(
          panel(`back-r${r}-c${c}`, 'Tấm lưng', backMaterial,
            [cw, rowHeights[r], T_BACK], [xC, yC, backZ]),
        );
      }

      if (type === 'drawer') {
        // thùng hộc: 2 hông + hậu + đáy (thụt SLIDE_GAP mỗi bên chừa ray).
        // Tính TRƯỚC để ghi vào note mặt ngăn kéo bên dưới.
        const bw = cw - 2 * SLIDE_GAP; // bề rộng NGOÀI thùng (chứa hông + ruột)
        const bh = faceH - 20; // chiều cao thành hộc
        const bFront = frontZ - T; // mặt trước thùng — ngay sau false front
        const bBack = backZ + T_BACK / 2 + 30; // chừa 30mm trước tấm hậu ô
        const bd = bFront - bBack; // chiều sâu thùng
        const bzC = (bFront + bBack) / 2;
        const sideX = cw / 2 - SLIDE_GAP - T / 2;

        // mặt trước (false front) — lắp chìm, có tay nắm.
        // v3.4: strip handle (no hole) khi frame edge đen; else round Ø35 hole.
        const drawerHandle: PanelHole | null = useStripHandle
          ? null
          : { dx: 0, dy: topHoleY(faceH), r: HOLE_R };
        const drawerSize: [number, number, number] = [cw - FRONT_GAP, faceH, T];
        const drawerPos: [number, number, number] = [xC, yC, frontZ];
        const ffMach = frontFaceMachining(drawerSize, drawerPos, faceH, cw - FRONT_GAP, 0, drawerHandle);
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
          panel(`drawer-r${r}-c${c}`, 'Mặt ngăn kéo', cm, drawerSize, drawerPos, {
            notes:
              (useStripHandle
                ? `Tay nắm strip đen (Nam Khang) gắn cạnh TRÊN · `
                : `Khoét lỗ tay nắm Ø35 — giữa cạnh trên · `) +
              `Thùng hộc ${Math.round(bw)}×${Math.round(bh)}×${Math.round(bd)}mm ` +
              `(rộng×cao×sâu) · Ray ${slideSize}mm · ` +
              `4 lỗ Ø${spec.drawerSlide.screwDia} mặt sau bắt vào hông hộc (cách mép 80mm)`,
            holes: drawerHandle ? [drawerHandle] : undefined,
            machining: ffMach,
          }),
        );

        // S10.1 Bug 6: thùng hộc cần liên kết. Note text giải thích — machining
        // detail (edge drill cho dowel hộc) defer to future enhancement vì xưởng
        // VN thường tự dóng template cho thùng hộc, không cần CNC.
        const boxNote =
          `Liên kết thùng hộc: 2 dowel Ø${spec.dowel.dowelDia}×${spec.dowel.pilotDepthEach * 2}mm + ` +
          `2 vít M${spec.drawerSlide.screwDia} mỗi giao điểm (hông↔hậu, đáy↔hông, đáy↔hậu) — ` +
          `tổng ~12 dowel + 12 vít cho 1 thùng hộc. Xưởng tự khoan theo cữ.`;
        parts.push(
          panel(`drawerL-r${r}-c${c}`, 'Hông hộc', cm, [T, bh, bd], [xC - sideX, yC, bzC], {
            notes: boxNote,
          }),
        );
        parts.push(
          panel(`drawerR-r${r}-c${c}`, 'Hông hộc', cm, [T, bh, bd], [xC + sideX, yC, bzC], {
            notes: boxNote,
          }),
        );
        parts.push(
          panel(
            `drawerBk-r${r}-c${c}`,
            'Hậu hộc',
            cm,
            [bw - 2 * T, bh, T],
            [xC, yC, bBack + T / 2],
            { notes: boxNote },
          ),
        );
        parts.push(
          panel(
            `drawerBot-r${r}-c${c}`,
            'Đáy hộc',
            cm,
            [bw - 2 * T, T_BACK, bd - T],
            [xC, yC - bh / 2 + T_BACK / 2, bzC],
            { notes: boxNote },
          ),
        );
        slides += 1;
        drawerCount += 1;
        if (useStripHandle) {
          // Drawer: handle direction CÙNG HƯỚNG cánh trong cùng cột (founder spec).
          const drawerHandleSign = singleDoorHandleSign(c, columns) as 1 | -1;
          fittings.push(
            ...makeStripHandle(`hstrip-d-r${r}-c${c}`, drawerPos, drawerSize, false, drawerHandleSign),
          );
        }
      } else if (type === 'door') {
        // #4: đáy ô tính TỪ SÀN (cộng chiều cao chân) ≥ ngưỡng → tay nắm sát cạnh DƯỚI.
        const lowHandle = rowBottomY[r] + FOOT_H >= LOW_HANDLE_FROM_GROUND;
        const holeDy = lowHandle ? HOLE_INSET - faceH / 2 : faceH / 2 - HOLE_INSET;
        const vWord = lowHandle ? 'dưới' : 'trên';
        const nHinges = hingeCount(faceH);
        if (cw > WIDE_CELL) {
          // ô rộng → 2 cánh: bản lề mép NGOÀI, 2 lỗ tay nắm quay vào nhau (giáp nhau).
          const leafW = cw / 2 - 6;
          const grip = leafW / 2 - HOLE_INSET;
          // Lá A (trái): bản lề mép TRÁI cánh → hingeSign=+1; tay nắm phải lá A → dx=+grip.
          const leafASize: [number, number, number] = [leafW, faceH, T];
          const leafAPos: [number, number, number] = [xC - cw / 4, yC, frontZ];
          // v3.4: strip handle (no hole) khi frame edge đen; else round Ø35.
          const leafAHandle: PanelHole | null = useStripHandle
            ? null
            : { dx: grip, dy: holeDy, r: HOLE_R };
          parts.push(
            panel(`door-r${r}-c${c}-a`, 'Cánh tủ', cm, leafASize, leafAPos, {
              notes: useStripHandle
                ? `Tay nắm strip đen gắn cạnh ${vWord} · ${nHinges} bản lề mép trái`
                : `Khoét lỗ tay nắm Ø35 — góc ${vWord} bên phải · ${nHinges} bản lề mép trái`,
              holes: leafAHandle ? [leafAHandle] : undefined,
              machining: frontFaceMachining(leafASize, leafAPos, faceH, leafW, 1, leafAHandle),
            }),
          );
          if (useStripHandle) {
            // Leaf A: hinge mép TRÁI (+1) → handle bên PHẢI (+1 đối diện hinge).
            fittings.push(
              ...makeStripHandle(`hstrip-da-r${r}-c${c}`, leafAPos, leafASize, lowHandle, 1),
            );
          }
          doorCount += 1;
          // Lá B (phải): bản lề mép PHẢI cánh → hingeSign=-1; tay nắm trái lá B → dx=-grip.
          const leafBSize: [number, number, number] = [leafW, faceH, T];
          const leafBPos: [number, number, number] = [xC + cw / 4, yC, frontZ];
          const leafBHandle: PanelHole | null = useStripHandle
            ? null
            : { dx: -grip, dy: holeDy, r: HOLE_R };
          parts.push(
            panel(`door-r${r}-c${c}-b`, 'Cánh tủ', cm, leafBSize, leafBPos, {
              notes: useStripHandle
                ? `Tay nắm strip đen gắn cạnh ${vWord} · ${nHinges} bản lề mép phải`
                : `Khoét lỗ tay nắm Ø35 — góc ${vWord} bên trái · ${nHinges} bản lề mép phải`,
              holes: leafBHandle ? [leafBHandle] : undefined,
              machining: frontFaceMachining(leafBSize, leafBPos, faceH, leafW, -1, leafBHandle),
            }),
          );
          if (useStripHandle) {
            // Leaf B: hinge mép PHẢI (-1) → handle bên TRÁI (-1 đối diện hinge).
            fittings.push(
              ...makeStripHandle(`hstrip-db-r${r}-c${c}`, leafBPos, leafBSize, lowHandle, -1),
            );
          }
          doorCount += 1;
          hinges += 2 * nHinges;
        } else {
          // #3: cánh đơn — tay nắm trái/phải theo quy tắc ghép cặp cột (quay vào nhau).
          const faceW = cw - FRONT_GAP;
          const sign = singleDoorHandleSign(c, columns);
          const sWord = sign > 0 ? 'phải' : 'trái';
          const hingeSide = sign > 0 ? 'trái' : 'phải';
          // hingeSign = sign (+1 = bản lề mép trái cánh, -1 = mép phải)
          const singleSize: [number, number, number] = [faceW, faceH, T];
          const singlePos: [number, number, number] = [xC, yC, frontZ];
          const singleHandle: PanelHole | null = useStripHandle
            ? null
            : { dx: sign * (faceW / 2 - HOLE_INSET), dy: holeDy, r: HOLE_R };
          parts.push(
            panel(`door-r${r}-c${c}`, 'Cánh tủ', cm, singleSize, singlePos, {
              notes: useStripHandle
                ? `Tay nắm strip đen gắn cạnh ${vWord} · ${nHinges} bản lề mép ${hingeSide}`
                : `Khoét lỗ tay nắm Ø35 — góc ${vWord} bên ${sWord} · ${nHinges} bản lề mép ${hingeSide}`,
              holes: singleHandle ? [singleHandle] : undefined,
              machining: frontFaceMachining(
                singleSize,
                singlePos,
                faceH,
                faceW,
                sign as 1 | -1,
                singleHandle,
              ),
            }),
          );
          if (useStripHandle) {
            // Single door: handle theo sign quy ước (đối diện bản lề).
            fittings.push(
              ...makeStripHandle(
                `hstrip-d-r${r}-c${c}`,
                singlePos,
                singleSize,
                lowHandle,
                sign as 1 | -1,
              ),
            );
          }
          doorCount += 1;
          hinges += nHinges;
        }
      }
      // 'open-back' / 'open-nobk' → không có mặt trước
    }
  }

  // --- Chân tủ: 2 cái mỗi vách đứng (trước + sau) — nơi lực dồn xuống nhiều nhất ---
  // (`fittings` đã hoist trước cells loop để strip handle push được)
  // footZ đã hoist lên đầu build() để dùng cho bottomMachining (lỗ Ø8 định vị)
  for (let k = 0; k <= columns; k++) {
    fittings.push({
      id: `foot-c${k}-front`, kind: 'foot',
      size: [FOOT_DIA, FOOT_H, FOOT_DIA], position: [vachX[k], FOOT_H / 2, footZ],
    });
    fittings.push({
      id: `foot-c${k}-back`, kind: 'foot',
      size: [FOOT_DIA, FOOT_H, FOOT_DIA], position: [vachX[k], FOOT_H / 2, -footZ],
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
    hardware.push({ id: 'drawer-slide', label: `Ray ngăn kéo ${slideSize}mm (bộ)`, qty: slides });
  }
  // v3.4 — Tay nắm: strip đen khi frame edge đen, else round Ø35 (round chưa
  // tracked trong hardware từ trước — gap cũ, để Phase 2 fix khi cần BOM round).
  const handleQty = doorCount + drawerCount;
  if (handleQty > 0 && useStripHandle) {
    hardware.push({
      id: 'handle_strip_black',
      label: 'Tay nắm strip đen (Nam Khang edge profile)',
      qty: handleQty,
      notes: `Gắn cạnh ${doorCount + drawerCount} cánh/mặt ngăn kéo — kích thước theo admin catalog.`,
    });
  }
  // foot count = footFittings only (strip handle fittings không tính chân).
  const footFittings = fittings.filter((f) => f.kind === 'foot');
  hardware.push({
    id: 'foot',
    label: 'Chân tủ (nút mỏng)',
    qty: footFittings.length,
    notes: `2 cái mỗi vách đứng (1 trước + 1 sau), bắt vào mặt dưới tấm đáy — ${columns + 1} vách.`,
  });

  return { parts, hardware, fittings };
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
