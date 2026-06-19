// =============================================================================
// production-catalog — "cuốn sổ giá sản xuất" (S9 + giá-theo-màu + edge banding).
//
// Tách số liệu sản xuất khỏi hằng số cứng configurator/pricing.ts → DỮ LIỆU lưu
// Cloudflare KV (key `catalog:production`), admin maume CRUD được.
//
// v2: giá quản lý theo TỪNG MÀU (29 màu) — mỗi màu có giá riêng, mã nội bộ, và
// danh sách sản phẩm (DNA) được bật. Loại ván (boardTypes) giữ mật độ (tính chất
// của ván, không theo màu). Engine chỉ nhận PriceConfig — catalogToPriceConfig()
// phẳng hoá catalog thành PriceConfig cho computePrice() / buildCutlist().
//
// v3 (edge-banding upgrade): thêm 1 loại ván "MDF chống ẩm phủ melamine" (6 màu
// An Cường, dán cạnh đồng màu) + field edgeBandingMm per boardType + 1 dòng phụ
// kiện mới "edge_banding" (giá VND/m dán cạnh). Engine cộng thêm dòng "Dán cạnh
// đồng màu" vào báo giá khi config có cấu hình.
//
// Fallback: KV miss / ngoài Workers → DEFAULT_CATALOG (mirror CHÍNH XÁC hằng số
// pricing.ts) → giá tủ KHÔNG đổi cho tới khi admin chủ động sửa.
// =============================================================================
// v3.5: getCloudflareContext lazy-loaded inside getKV() — cho phép admin/ke
// (client component) import catalogToPriceConfig/enabledMaterialsForDna mà
// không kéo theo @opennextjs/cloudflare (server-only) vào client bundle.
import { DEFAULT_MACHINING_SPEC, resolveMachiningSpec } from "../configurator/machining-defaults";
import { EDGE_BAND_COLORS } from "../configurator/materials";
import type { EdgeBandingType, MachiningSpec, PriceConfig, ResolvedEdgeBand } from "../configurator/types";

export { DEFAULT_MACHINING_SPEC } from "../configurator/machining-defaults";

/** Key KV của catalog (singleton — 1 key duy nhất). */
export const CATALOG_KEY = "catalog:production";

// --- id CỐ ĐỊNH — khớp catalog key (materials.ts) & Hardware.id (build() phát ra) ---
export type MaterialId =
  | "mdf_son"
  | "plywood_veneer"
  | "plywood_melamine"
  | "mdf_chong_am_melamine"
  | "mfc_melamine";
export type HardwareId =
  | "hinge"
  | "handle"
  | "handle_strip_black"
  | "handle_bar"
  // P76 — ray âm Hafele EPC Plus theo nấc sâu tủ (thay "drawer-slide" chung):
  | "drawer-slide-270" // 433.03.001 (tủ sâu 300)
  | "drawer-slide-300" // 433.03.002 (tủ sâu 350)
  | "drawer-slide-350" // 433.03.003 (tủ sâu 400)
  | "drawer-slide-400" // 433.03.004 (tủ sâu 450)
  | "foot"
  | "connector_2in1" // P74 — bộ chốt Ø8×30 + PAT, liên kết vách ↔ tấm ngang
  | "back_clip" // P74 — chốt lò xo Ø5×25 giữ tấm hậu
  | "edge_banding";

/** Sản phẩm (DNA) đã biết — sinh cột bật/tắt màu trong admin. Thêm sản phẩm mới
 *  ở Session 8 → thêm 1 dòng vào đây. */
export const KNOWN_DNAS: { slug: string; label: string }[] = [
  { slug: "tu-ke", label: "Tủ kệ" },
  { slug: "tu-y", label: "Tủ module" }, // P83 — nhãn tạm (cột bật/tắt màu cho loại 2)
];

/** 1 loại ván — dòng CỐ ĐỊNH; mật độ là tính chất của ván (không theo màu). */
export interface CatalogBoardType {
  id: MaterialId;
  label: string;
  densityKgPerM3: number;
  // v3: độ dày dán cạnh (mm) áp cho material loại này. Material có `noEdgeBanding`
  // ở materials.ts sẽ SKIP (lộ cạnh). Vắng / 0 → coi như không dán (tương thích cũ).
  edgeBandingMm?: number;
}

/**
 * 1 màu ván — admin sửa mã nội bộ + giá + bật/tắt theo sản phẩm.
 * v3: `ratePerM2` linh hoạt theo độ dày thực tế — MDF chống ẩm An Cường dùng
 * thickness 17 (lưu cùng giá ở key 18 qua catalogToPriceConfig — engine convention).
 */
export interface CatalogColor {
  id: string; // "catalog/id" — vd "mdf_son/den"
  boardType: MaterialId; // thuộc loại ván nào
  label: string; // tên hiển thị — vd "MDF Đen"
  code: string; // mã nội bộ kho/xưởng (mã NCC, lấy từ tên ảnh swatch)
  supplier: string; // nhà cung cấp — vd "Minh Long" / "An Cường" ("" = chưa rõ)
  ratePerM2: { 18?: number; 17?: number; 9: number }; // VND/m² theo độ dày
  enabledFor: string[]; // slug các DNA bật màu này
}

/** 1 dòng phụ kiện — CỐ ĐỊNH (giữ nguyên từ S9). */
export interface CatalogHardware {
  id: HardwareId;
  label: string;
  sku: string;
  unitPrice: number;
  weightKg: number;
}

/** P49: 1 LOẠI dán cạnh (đồng-màu / đen / trắng). Admin bật/tắt + nhập giá/m + các
 *  khổ + độ dày. Khách chọn 1 loại (trong các loại enabled) cho khung; cánh/ngăn
 *  kéo luôn 'same'. Thay cho cách cũ (hardcode `_edge_den` vào id màu). */
export interface CatalogEdgeBand {
  type: EdgeBandingType; // id từ EDGE_BAND_COLORS: 'same'|'black'|'white'|'ml_*'
  label: string; // "Đồng màu" | "Đen" | "Trắng" | tên màu ML
  enabled: boolean; // admin bật → hiện cho khách
  pricePerM: number; // VND/m
  widths: number[]; // các khổ (mm), vd [22, 28, 42]
  thicknesses: number[]; // các độ dày (mm), vd [0.4, 1, 2]
  weightKgPerM?: number; // kg/m (mặc định 0.01)
  hex?: string; // P52: màu nẹp (vắng = đồng màu). Khớp EDGE_BAND_COLORS.
}

/** 1 khổ ván tồn kho — danh sách TỰ DO (S10 nesting). */
export interface CatalogBoard {
  id: string;
  label: string;
  materialId: MaterialId;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
}

/** Toàn bộ "cuốn sổ giá sản xuất". */
export interface ProductionCatalog {
  version: 3;
  boardTypes: CatalogBoardType[]; // 5 cố định
  colors: CatalogColor[]; // P49: bỏ các biến thể `_edge_den` (gộp) → mỗi màu 1 lần
  hardware: CatalogHardware[]; // P49: bỏ `edge_banding` (chuyển sang edgeBands)
  edgeBands: CatalogEdgeBand[]; // P49: 3 loại dán cạnh (same/black/white)
  boards: CatalogBoard[]; // list tự do (S10)
  labor: { perOrder: number };
  kerfMm: number;
  margin: number;
  // v4 (nesting pricing): 2 hằng số kinh doanh override default trong nesting/cost.ts.
  // Vắng → engine dùng MIN_WASTE_MULTIPLIER=1.4 + DEFAULT_LABOR_PER_SHEET=100_000.
  wasteMultiplierMin?: number; // sàn hao hụt (vd 1.4 = +40%)
  laborPerSheet?: number; // VND/tấm ván cốt từ nesting (vd 100_000)
  // v6 (P60): margin tăng theo THỂ TÍCH tủ (m³) — anchor `vol` (m³). Vắng → flat `margin`.
  marginTiers?: { vol: number; margin: number }[];
  // P72 — ĐÃ BỎ complexityBonusPerUnit/Max (phụ trội margin theo số ngăn/cánh).
  // KV cũ còn field này → mergeCatalog tự DROP khi đọc (build object tường minh).
  // P69 — Hệ số lãi RIÊNG cho phụ kiện (mua sẵn, lãi mỏng). KHÔNG nhân margin khung. Default 1.2.
  hardwareMargin?: number;
  // S10.1 (tùy chọn): quy cách phụ kiện CNC — admin chỉnh trong tab "Quy cách CNC".
  // Vắng → engine dùng DEFAULT_MACHINING_SPEC trong DNA (BASELINE giữ).
  machiningSpec?: MachiningSpec;
  // --- P84 TỦ Y (admin chỉnh trong tab "Giá & lãi") — chỉ ảnh hưởng tủ y ---
  tuYMargin?: number; // hệ số lãi PHẲNG tủ y (vd 2.2). Vắng → 2.2 (thay margin thể tích của x).
  tuYWasteRatio?: number; // hao hụt ván tủ y (tỉ lệ, vd 0.15 = 15%). Vắng → 0.15.
  tuYCellLabor?: Record<string, number>; // nhân công/ô: khoá `${cells}-${attribute}` → VND. Vắng → 0.
  updatedAt: string; // ISO ("" = chưa từng lưu)
}

// DEFAULT_MACHINING_SPEC moved to src/configurator/machining-defaults.ts (re-exported above
// để admin/page.tsx vẫn import được từ production-catalog).

// Đơn giá mặc định theo loại ván — mirror MATERIAL_RATE_PER_M2 trong pricing.ts.
// v3: thêm mdf_chong_am_melamine (key 17 — An Cường ship boards 17mm physical).
const DEFAULT_RATE: Record<MaterialId, { 18?: number; 17?: number; 9: number }> = {
  mdf_son: { 18: 700_000, 9: 350_000 },
  plywood_veneer: { 18: 560_000, 9: 280_000 },
  plywood_melamine: { 18: 496_527, 9: 373_263 },
  mdf_chong_am_melamine: { 17: 240_000, 9: 165_000 },
  // v3.6: MFC ván dăm Minh Long phủ melamine — body 18mm chuẩn; CHỈ có cạnh đen.
  mfc_melamine: { 18: 261_000, 9: 222_000 },
};

/**
 * Tạo 1 màu mặc định — bật cho tu-ke. code/supplier mặc định rỗng; rate vắng
 * mặt → ăn theo đơn giá loại ván (truyền rate riêng cho NCC có giá khác).
 */
function defColor(
  id: string,
  label: string,
  boardType: MaterialId,
  code = "",
  supplier = "",
  rate?: { 18?: number; 17?: number; 9: number },
): CatalogColor {
  return {
    id,
    boardType,
    label,
    code,
    supplier,
    ratePerM2: rate ? { ...rate } : { ...DEFAULT_RATE[boardType] },
    enabledFor: ["tu-ke"],
  };
}

/**
 * Catalog mặc định — mirror CHÍNH XÁC hằng số trong configurator/pricing.ts +
 * danh sách màu trong materials.ts / dna.ts. Neo giữ BASELINE.
 * ⚠️ Sửa số ở đây phải đồng bộ với pricing.ts.
 */
export const DEFAULT_CATALOG: ProductionCatalog = {
  version: 3,
  boardTypes: [
    { id: "mdf_son", label: "Ván MDF sơn màu", densityKgPerM3: 720, edgeBandingMm: 0.4 },
    { id: "plywood_veneer", label: "Ván plywood veneer", densityKgPerM3: 600, edgeBandingMm: 0.4 },
    {
      id: "plywood_melamine",
      label: "Plywood phủ melamine 2 mặt (lộ cạnh)",
      densityKgPerM3: 600,
      edgeBandingMm: 0.4, // áp cho 11 màu Minh Long; 6 An Cường có noEdgeBanding=true → skip
    },
    {
      id: "mdf_chong_am_melamine",
      label: "MDF chống ẩm phủ melamine (An Cường)",
      densityKgPerM3: 720,
      edgeBandingMm: 0.4,
    },
    {
      // v3.6 — MFC (ván dăm) Minh Long phủ melamine. Density ~650 kg/m³ chuẩn
      // particleboard. P49: màu cạnh do option "Dán cạnh" quyết (bỏ nhãn "cạnh đen").
      id: "mfc_melamine",
      label: "Ván dăm (MFC) Minh Long phủ melamine",
      densityKgPerM3: 650,
      edgeBandingMm: 0.4,
    },
  ],
  colors: [
    defColor("mdf_son/vang", "MDF Vàng", "mdf_son"),
    defColor("mdf_son/cam", "MDF Cam", "mdf_son"),
    defColor("mdf_son/do", "MDF Đỏ", "mdf_son"),
    defColor("mdf_son/nau", "MDF Nâu", "mdf_son"),
    defColor("mdf_son/xanh_la", "MDF Xanh lá", "mdf_son"),
    defColor("mdf_son/xanh", "MDF Xanh", "mdf_son"),
    defColor("mdf_son/xam_nhat", "MDF Xám nhạt", "mdf_son"),
    defColor("mdf_son/xam", "MDF Xám", "mdf_son"),
    defColor("mdf_son/den", "MDF Đen", "mdf_son"),
    defColor("plywood_veneer/oak", "Veneer Sồi", "plywood_veneer"),
    defColor("plywood_veneer/walnut", "Veneer Óc chó", "plywood_veneer"),
    defColor("plywood_veneer/ash", "Veneer Tần bì", "plywood_veneer"),
    // PLY+ML (Minh Long) — plywood phủ melamine, lộ cạnh. Mã nội bộ "ML 2xx" từ tên ảnh.
    defColor("plywood_melamine/ml_xanh_reu", "PLY+ML Xanh rêu", "plywood_melamine", "ML 211", "Minh Long"),
    defColor("plywood_melamine/ml_do_san_ho", "PLY+ML Đỏ san hô", "plywood_melamine", "ML 212", "Minh Long"),
    defColor("plywood_melamine/ml_xam_am", "PLY+ML Xám ấm", "plywood_melamine", "ML 214", "Minh Long"),
    defColor("plywood_melamine/ml_den_espresso", "PLY+ML Đen espresso", "plywood_melamine", "ML 216", "Minh Long"),
    defColor("plywood_melamine/ml_xanh_mint", "PLY+ML Xanh mint", "plywood_melamine", "ML 217", "Minh Long"),
    defColor("plywood_melamine/ml_xanh_diu", "PLY+ML Xanh dịu", "plywood_melamine", "ML 218", "Minh Long"),
    defColor("plywood_melamine/ml_xanh_teal_dam", "PLY+ML Xanh teal đậm", "plywood_melamine", "ML 219", "Minh Long"),
    defColor("plywood_melamine/ml_caramel", "PLY+ML Caramel", "plywood_melamine", "ML 223", "Minh Long"),
    defColor("plywood_melamine/ml_olive", "PLY+ML Olive", "plywood_melamine", "ML 224", "Minh Long"),
    defColor("plywood_melamine/ml_xanh_navy", "PLY+ML Xanh navy", "plywood_melamine", "ML 225", "Minh Long"),
    defColor("plywood_melamine/ml_hong_phan", "PLY+ML Hồng phấn", "plywood_melamine", "ML 226", "Minh Long"),
    // PLY+AC (An Cường) — plywood phủ melamine, lộ cạnh. Mã "MS xxx" từ tên ảnh; 330k/233k.
    defColor("plywood_melamine/ac_vang_nghe", "PLY+AC Vàng nghệ", "plywood_melamine", "MS 030 SH", "An Cường", { 18: 330_000, 9: 233_000 }),
    defColor("plywood_melamine/ac_den_tuyen", "PLY+AC Đen tuyền", "plywood_melamine", "MS 230 S", "An Cường", { 18: 330_000, 9: 233_000 }),
    defColor("plywood_melamine/ac_trang_kem", "PLY+AC Trắng kem", "plywood_melamine", "MS 9205 S", "An Cường", { 18: 330_000, 9: 233_000 }),
    defColor("plywood_melamine/ac_nau_xam", "PLY+AC Nâu xám", "plywood_melamine", "MS 025 MM", "An Cường", { 18: 330_000, 9: 233_000 }),
    defColor("plywood_melamine/ac_xanh_muc", "PLY+AC Xanh mực", "plywood_melamine", "MS 083 T", "An Cường", { 18: 330_000, 9: 233_000 }),
    defColor("plywood_melamine/ac_xanh_thien_thanh", "PLY+AC Xanh thiên thanh", "plywood_melamine", "MS 050 T", "An Cường", { 18: 330_000, 9: 233_000 }),
    // MDF+AC (An Cường) — MDF chống ẩm phủ melamine, DÁN CẠNH ĐỒNG MÀU.
    // Cùng 6 mã NCC với PLY+AC nhưng cấu tạo MDF chống ẩm. Giá: 240k/m² (17mm) · 165k/m² (9mm).
    defColor("mdf_chong_am_melamine/ac_vang_nghe", "MDF+AC Vàng nghệ", "mdf_chong_am_melamine", "MS 030 SH", "An Cường"),
    defColor("mdf_chong_am_melamine/ac_den_tuyen", "MDF+AC Đen tuyền", "mdf_chong_am_melamine", "MS 230 S", "An Cường"),
    defColor("mdf_chong_am_melamine/ac_trang_kem", "MDF+AC Trắng kem", "mdf_chong_am_melamine", "MS 9205 S", "An Cường"),
    defColor("mdf_chong_am_melamine/ac_nau_xam", "MDF+AC Nâu xám", "mdf_chong_am_melamine", "MS 025 MM", "An Cường"),
    defColor("mdf_chong_am_melamine/ac_xanh_muc", "MDF+AC Xanh mực", "mdf_chong_am_melamine", "MS 083 T", "An Cường"),
    defColor("mdf_chong_am_melamine/ac_xanh_thien_thanh", "MDF+AC Xanh thiên thanh", "mdf_chong_am_melamine", "MS 050 T", "An Cường"),
    // P49: bỏ 6 biến thể MDF+AC "cạnh đen" — dán cạnh giờ là option riêng (same/black/white).
    // MDF+ML (Minh Long) — MDF chống ẩm phủ melamine.
    // Cùng surface + mã NCC với PLY+ML; giá placeholder — founder điền qua admin sau.
    defColor("mdf_chong_am_melamine/ml_xanh_reu", "MDF+ML Xanh rêu", "mdf_chong_am_melamine", "ML 211", "Minh Long", { 17: 200_000, 9: 140_000 }),
    defColor("mdf_chong_am_melamine/ml_do_san_ho", "MDF+ML Đỏ san hô", "mdf_chong_am_melamine", "ML 212", "Minh Long", { 17: 200_000, 9: 140_000 }),
    defColor("mdf_chong_am_melamine/ml_xam_am", "MDF+ML Xám ấm", "mdf_chong_am_melamine", "ML 214", "Minh Long", { 17: 200_000, 9: 140_000 }),
    defColor("mdf_chong_am_melamine/ml_den_espresso", "MDF+ML Đen espresso", "mdf_chong_am_melamine", "ML 216", "Minh Long", { 17: 200_000, 9: 140_000 }),
    defColor("mdf_chong_am_melamine/ml_xanh_mint", "MDF+ML Xanh mint", "mdf_chong_am_melamine", "ML 217", "Minh Long", { 17: 200_000, 9: 140_000 }),
    defColor("mdf_chong_am_melamine/ml_xanh_diu", "MDF+ML Xanh dịu", "mdf_chong_am_melamine", "ML 218", "Minh Long", { 17: 200_000, 9: 140_000 }),
    defColor("mdf_chong_am_melamine/ml_xanh_teal_dam", "MDF+ML Xanh teal đậm", "mdf_chong_am_melamine", "ML 219", "Minh Long", { 17: 200_000, 9: 140_000 }),
    defColor("mdf_chong_am_melamine/ml_caramel", "MDF+ML Caramel", "mdf_chong_am_melamine", "ML 223", "Minh Long", { 17: 200_000, 9: 140_000 }),
    defColor("mdf_chong_am_melamine/ml_olive", "MDF+ML Olive", "mdf_chong_am_melamine", "ML 224", "Minh Long", { 17: 200_000, 9: 140_000 }),
    defColor("mdf_chong_am_melamine/ml_xanh_navy", "MDF+ML Xanh navy", "mdf_chong_am_melamine", "ML 225", "Minh Long", { 17: 200_000, 9: 140_000 }),
    defColor("mdf_chong_am_melamine/ml_hong_phan", "MDF+ML Hồng phấn", "mdf_chong_am_melamine", "ML 226", "Minh Long", { 17: 200_000, 9: 140_000 }),
    // P49: bỏ 11 biến thể MDF+ML "cạnh đen" — dán cạnh giờ là option riêng.
    // MFC+ML (Minh Long) — Ván dăm phủ melamine (id GỐC, không hậu tố _edge_den;
    // màu cạnh chọn ở option dán cạnh). Giá 261k/18mm · 222k/9mm.
    defColor("mfc_melamine/ml_xanh_reu", "MFC+ML Xanh rêu", "mfc_melamine", "ML 211", "Minh Long"),
    defColor("mfc_melamine/ml_do_san_ho", "MFC+ML Đỏ san hô", "mfc_melamine", "ML 212", "Minh Long"),
    defColor("mfc_melamine/ml_xam_am", "MFC+ML Xám ấm", "mfc_melamine", "ML 214", "Minh Long"),
    defColor("mfc_melamine/ml_den_espresso", "MFC+ML Đen espresso", "mfc_melamine", "ML 216", "Minh Long"),
    defColor("mfc_melamine/ml_xanh_mint", "MFC+ML Xanh mint", "mfc_melamine", "ML 217", "Minh Long"),
    defColor("mfc_melamine/ml_xanh_diu", "MFC+ML Xanh dịu", "mfc_melamine", "ML 218", "Minh Long"),
    defColor("mfc_melamine/ml_xanh_teal_dam", "MFC+ML Xanh teal đậm", "mfc_melamine", "ML 219", "Minh Long"),
    defColor("mfc_melamine/ml_caramel", "MFC+ML Caramel", "mfc_melamine", "ML 223", "Minh Long"),
    defColor("mfc_melamine/ml_olive", "MFC+ML Olive", "mfc_melamine", "ML 224", "Minh Long"),
    defColor("mfc_melamine/ml_xanh_navy", "MFC+ML Xanh navy", "mfc_melamine", "ML 225", "Minh Long"),
    defColor("mfc_melamine/ml_hong_phan", "MFC+ML Hồng phấn", "mfc_melamine", "ML 226", "Minh Long"),
    // P48.5 — 3 màu Minh Long bổ sung.
    defColor("mfc_melamine/ml_den_tuyen", "MFC+ML Đen tuyền", "mfc_melamine", "ML 230", "Minh Long"),
    defColor("mfc_melamine/ml_do_booc_do", "MFC+ML Đỏ booc-đô", "mfc_melamine", "ML 027", "Minh Long"),
    defColor("mfc_melamine/ml_trang_kem", "MFC+ML Trắng kem", "mfc_melamine", "ML 103", "Minh Long"),
    // P79 — màu mới Minh Long ML 220 (vàng kem nhạt trơn).
    defColor("mfc_melamine/ml_vang_kem_220", "MFC+ML Vàng kem 220", "mfc_melamine", "ML 220", "Minh Long"),
    // P51 — 2 map VÂN GỖ Minh Long (render texture ảnh thật đúng tỷ lệ).
    defColor("mfc_melamine/ml_van_go_sang", "MFC+ML Vân gỗ sáng", "mfc_melamine", "ML 2311", "Minh Long"),
    defColor("mfc_melamine/ml_van_go_dam", "MFC+ML Vân gỗ đậm", "mfc_melamine", "ML 2382", "Minh Long"),
    // P59 — 2 vân gỗ bổ sung (đơn giá premium 279k/236k như nhóm vân gỗ).
    defColor("mfc_melamine/ml_van_go_soi", "MFC+ML Vân gỗ sồi", "mfc_melamine", "ML 7525", "Minh Long", { 18: 279_000, 9: 236_000 }),
    defColor("mfc_melamine/ml_van_go_oc_cho", "MFC+ML Vân gỗ óc chó", "mfc_melamine", "ML 7225", "Minh Long", { 18: 279_000, 9: 236_000 }),
  ],
  hardware: [
    { id: "hinge", label: "Bản lề giảm chấn", sku: "", unitPrice: 18_000, weightKg: 0.06 },
    { id: "handle", label: "Tay nắm tròn (khoét lỗ Ø35)", sku: "", unitPrice: 30_000, weightKg: 0.04 },
    // v3.4 — strip handle ĐEN (Nam Khang edge profile pull). Áp cho cánh tủ khi
    // frame material có edge banding đen. Founder điền giá/SKU chính xác qua admin.
    {
      id: "handle_strip_black",
      label: "Tay nắm strip đen (edge profile)",
      sku: "Nam Khang edge đen",
      unitPrice: 70_000,
      weightKg: 0.05,
    },
    // P45 — tay nắm bar đen mờ, căn giữa cánh (chọn theo preset trong admin).
    // Founder điền giá/SKU/cân nặng chính xác sau.
    {
      id: "handle_bar",
      label: "Tay nắm bar đen (căn giữa)",
      sku: "",
      unitPrice: 50_000,
      weightKg: 0.08,
    },
    // P76 — RAY ÂM Hafele EPC Plus mở 3/4 giảm chấn, 4 cỡ theo nấc sâu tủ
    // (300→270 · 350→300 · 400→350 · 450→400; sâu 250 không có ngăn kéo).
    // Giá tham khảo đại lý VN 06/2026 — founder chỉnh admin theo giá nhập thật.
    {
      id: "drawer-slide-270",
      label: "Ray âm EPC Plus 270mm (tủ sâu 300)",
      sku: "433.03.001",
      unitPrice: 243_100,
      weightKg: 0.9,
    },
    {
      id: "drawer-slide-300",
      label: "Ray âm EPC Plus 300mm (tủ sâu 350)",
      sku: "433.03.002",
      unitPrice: 195_000,
      weightKg: 0.9,
    },
    {
      id: "drawer-slide-350",
      label: "Ray âm EPC Plus 350mm (tủ sâu 400)",
      sku: "433.03.003",
      unitPrice: 226_270,
      weightKg: 0.9,
    },
    {
      id: "drawer-slide-400",
      label: "Ray âm EPC Plus 400mm (tủ sâu 450)",
      sku: "433.03.004",
      unitPrice: 277_200,
      weightKg: 0.9,
    },
    { id: "foot", label: "Chân tủ", sku: "", unitPrice: 5_000, weightKg: 0.005 },
    // P74 — connector 2-in-1 kim loại (chốt Ø8×30 ren + PAT 50×12×2): mọi liên kết
    // vách đứng ↔ tấm ngang (đáy/nóc/kệ/vách phụ). Giá tạm — founder chỉnh admin.
    {
      id: "connector_2in1",
      label: "Connector 2-in-1 (chốt Ø8 + PAT)",
      sku: "",
      unitPrice: 3_000,
      weightKg: 0.015,
    },
    // P74 — chốt lò xo Ø5×25 cạnh trên/dưới tấm hậu, cắm vào lỗ đón trên tấm ngang.
    {
      id: "back_clip",
      label: "Chốt lò xo tấm hậu Ø5×25",
      sku: "",
      unitPrice: 1_000,
      weightKg: 0.005,
    },
    // P49: bỏ dòng phụ kiện "edge_banding" — chuyển sang `edgeBands` (3 loại).
  ],
  // P49/P52: dán cạnh sinh từ palette EDGE_BAND_COLORS (đồng màu + đen + trắng + 14 màu
  // ML = 17). enabled = hiện cho khách; giá/m + khổ + độ dày (mặc định chung, admin sửa
  // được). Khách chọn 1 loại cho khung; cánh/ngăn kéo luôn 'same'.
  edgeBands: EDGE_BAND_COLORS.map((c) => ({
    type: c.id,
    label: c.label,
    enabled: true,
    pricePerM: 8_000,
    widths: [22, 28, 42],
    thicknesses: [0.4, 1, 2],
    weightKgPerM: 0.01,
    hex: c.hex,
  })),
  // v4 (nesting pricing): khổ ván chuẩn VN 1220×2440 cho 5 loại ván × {body, 9mm}.
  // MCA (An Cường) body 17mm; còn lại 18mm. Cần để pricing engine chạy nesting
  // → cộng 40% hao hụt + 100k/ván cốt. Admin có thể CRUD thêm khổ khác qua UI.
  boards: [
    { id: 'mdf_son-1220x2440-18', label: 'MDF sơn 1220×2440 18mm', materialId: 'mdf_son', lengthMm: 2440, widthMm: 1220, thicknessMm: 18 },
    { id: 'mdf_son-1220x2440-9', label: 'MDF sơn 1220×2440 9mm', materialId: 'mdf_son', lengthMm: 2440, widthMm: 1220, thicknessMm: 9 },
    { id: 'plywood_veneer-1220x2440-18', label: 'Plywood veneer 1220×2440 18mm', materialId: 'plywood_veneer', lengthMm: 2440, widthMm: 1220, thicknessMm: 18 },
    { id: 'plywood_veneer-1220x2440-9', label: 'Plywood veneer 1220×2440 9mm', materialId: 'plywood_veneer', lengthMm: 2440, widthMm: 1220, thicknessMm: 9 },
    { id: 'plywood_melamine-1220x2440-18', label: 'Plywood melamine 1220×2440 18mm', materialId: 'plywood_melamine', lengthMm: 2440, widthMm: 1220, thicknessMm: 18 },
    { id: 'plywood_melamine-1220x2440-9', label: 'Plywood melamine 1220×2440 9mm', materialId: 'plywood_melamine', lengthMm: 2440, widthMm: 1220, thicknessMm: 9 },
    { id: 'mdf_chong_am_melamine-1220x2440-17', label: 'MDF chống ẩm melamine 1220×2440 17mm', materialId: 'mdf_chong_am_melamine', lengthMm: 2440, widthMm: 1220, thicknessMm: 17 },
    { id: 'mdf_chong_am_melamine-1220x2440-9', label: 'MDF chống ẩm melamine 1220×2440 9mm', materialId: 'mdf_chong_am_melamine', lengthMm: 2440, widthMm: 1220, thicknessMm: 9 },
    { id: 'mfc_melamine-1220x2440-18', label: 'MFC melamine 1220×2440 18mm', materialId: 'mfc_melamine', lengthMm: 2440, widthMm: 1220, thicknessMm: 18 },
    { id: 'mfc_melamine-1220x2440-9', label: 'MFC melamine 1220×2440 9mm', materialId: 'mfc_melamine', lengthMm: 2440, widthMm: 1220, thicknessMm: 9 },
  ],
  labor: { perOrder: 300_000 },
  kerfMm: 3,
  margin: 1.6,
  // v4 mặc định khớp constants trong nesting/cost.ts — admin có thể override.
  wasteMultiplierMin: 1.4,
  laborPerSheet: 100_000,
  // v6 (P60) margin anchors theo THỂ TÍCH (m³) — tủ nhỏ margin thấp (phễu), tủ to cao
  // (lợi nhuận). Engine nội suy tuyến tính; ngoài anchor đầu/cuối = plateau. Admin sửa được.
  marginTiers: [
    { vol: 0.15, margin: 1.25 },
    { vol: 0.4, margin: 1.4 },
    { vol: 0.8, margin: 1.6 },
    { vol: 1.5, margin: 1.85 },
    { vol: 2.5, margin: 2.1 },
  ],
  hardwareMargin: 1.2, // P69: lãi phụ kiện (mua sẵn) — +20%, không nhân margin khung
  machiningSpec: DEFAULT_MACHINING_SPEC,
  // P84 tủ y: margin PHẲNG 2.2 (thay margin thể tích); hao hụt ván 15%; nhân công theo
  // loại ô mặc định trống (founder điền sau khi chốt giá xưởng) → mọi khoá `?? 0`.
  tuYMargin: 2.2,
  tuYWasteRatio: 0.15,
  tuYCellLabor: {},
  updatedAt: "",
};

/** P49: giải edgeBands (KV stored merge DEFAULT theo type) → map type→ResolvedEdgeBand
 *  cho engine. thicknessMm = min(thicknesses) (mỏng nhất ~0.4mm — dùng cho cắt-bù). */
export function resolveEdgeBands(
  stored?: CatalogEdgeBand[],
): Record<EdgeBandingType, ResolvedEdgeBand> {
  const out = {} as Record<EdgeBandingType, ResolvedEdgeBand>;
  for (const def of DEFAULT_CATALOG.edgeBands) {
    const s = stored?.find((b) => b?.type === def.type);
    const b = s ? { ...def, ...s } : def;
    const thicknesses = b.thicknesses?.length ? b.thicknesses : def.thicknesses;
    out[b.type] = {
      enabled: b.enabled !== false,
      pricePerM: b.pricePerM ?? def.pricePerM,
      thicknessMm: Math.min(...thicknesses),
      widths: b.widths?.length ? b.widths : def.widths,
      thicknesses,
      hex: def.hex, // P52: màu nẹp = palette (nguồn duy nhất, admin không sửa hex)
      label: def.label, // P52: tên nẹp (báo giá dùng)
    };
  }
  return out;
}

/** P49: các loại dán cạnh admin đã BẬT (ResolveContext → resolveControls lọc option). */
export function enabledEdgeBandTypes(catalog: ProductionCatalog): EdgeBandingType[] {
  return (catalog.edgeBands ?? DEFAULT_CATALOG.edgeBands)
    .filter((b) => b.enabled)
    .map((b) => b.type);
}

/**
 * Phẳng hoá catalog → PriceConfig cho engine (computePrice / buildCutlist).
 * materialRates + materialLabels theo TỪNG MÀU; materialDensities theo loại ván.
 *
 * v3.2 (rà soát alias): KHÔNG còn alias universal 17↔18 — gây "noise" rate giả
 * cho mdf_son/plywood (NCC không bán 17mm). Bây giờ chỉ expose key thực tế founder
 * lưu trong catalog: mdf_son/plywood → {18, 9} · MCA → {17, 9}. KHÔNG có phantom.
 *
 * Cộng edgeBandingPricePerM (từ hardware id="edge_banding") + edgeBandingMmByBoardType
 * (từ boardTypes). dna.ts (F2) đảm bảo Part.thickness_mm khớp catalog key cho từng
 * material — body MCA dùng 17mm, body khác dùng 18mm.
 *
 * v4 (nesting pricing): expose `boards` + `kerfMm` → computePrice tự chạy nesting,
 * cộng 40% hao hụt (sàn) + 100k/ván cốt vào giá. Catalog có boards rỗng → engine
 * giữ hành vi cũ (laborPerOrder fallback). Admin bơm khổ ván qua catalog UI là
 * kích hoạt nesting pricing tự động.
 */
export function catalogToPriceConfig(catalog: ProductionCatalog): PriceConfig {
  const materialRates: Record<string, Record<number, number>> = {};
  const materialLabels: Record<string, string> = {};
  for (const c of catalog.colors) {
    const rates: Record<number, number> = {};
    // CHỈ expose keys có thực trong catalog — không alias 17↔18 universal nữa.
    if (c.ratePerM2[18] !== undefined) rates[18] = c.ratePerM2[18];
    if (c.ratePerM2[17] !== undefined) rates[17] = c.ratePerM2[17];
    if (c.ratePerM2[9] !== undefined) rates[9] = c.ratePerM2[9];
    materialRates[c.id] = rates;
    materialLabels[c.id] = c.label;
  }
  const materialDensities: Record<string, number> = {};
  for (const bt of catalog.boardTypes) materialDensities[bt.id] = bt.densityKgPerM3;
  // Map độ dày dán cạnh per boardType (vắng → bỏ qua trong engine).
  const edgeBandingMmByBoardType: Record<string, number> = {};
  for (const bt of catalog.boardTypes) {
    if (bt.edgeBandingMm && bt.edgeBandingMm > 0) {
      edgeBandingMmByBoardType[bt.id] = bt.edgeBandingMm;
    }
  }
  const hardwarePrices: Record<string, number> = {};
  const hardwareWeights: Record<string, number> = {};
  let edgeBandingPricePerM = 0;
  for (const h of catalog.hardware) {
    hardwarePrices[h.id] = h.unitPrice;
    hardwareWeights[h.id] = h.weightKg;
    if (h.id === "edge_banding") edgeBandingPricePerM = h.unitPrice;
  }
  return {
    margin: catalog.margin,
    laborPerOrder: catalog.labor.perOrder,
    materialRates,
    materialLabels,
    materialDensities,
    hardwarePrices,
    hardwareWeights,
    edgeBandingPricePerM, // P49: fallback cũ (edge_banding hardware đã bỏ → thường 0)
    edgeBandingMmByBoardType, // P49: fallback cũ
    edgeBands: resolveEdgeBands(catalog.edgeBands), // P49: nguồn chính cho dán cạnh
    machiningSpec: catalog.machiningSpec ?? DEFAULT_MACHINING_SPEC,
    // Nesting pricing: pass-through boards + kerf để computePrice chạy nesting.
    // Vắng (boards rỗng) → engine fallback laborPerOrder cũ. Constants 1.4 (sàn
    // hao hụt) + 100k/ván cốt mặc định trong src/lib/nesting/cost.ts.
    boards: catalog.boards,
    kerfMm: catalog.kerfMm,
    laborPerSheet: catalog.laborPerSheet,
    wasteMultiplierMin: catalog.wasteMultiplierMin,
    marginTiers: catalog.marginTiers,
    hardwareMargin: catalog.hardwareMargin, // P69
    // P84 tủ y: chuyển thẳng (engine chỉ áp khi build.moduleCounts có data).
    tuYMargin: catalog.tuYMargin,
    tuYWasteRatio: catalog.tuYWasteRatio,
    tuYCellLabor: catalog.tuYCellLabor,
  };
}

/** Danh sách id màu được bật cho 1 sản phẩm (DNA). Configurator dùng để lọc. */
export function enabledMaterialsForDna(
  catalog: ProductionCatalog,
  dnaSlug: string,
): string[] {
  return catalog.colors
    .filter((c) => c.enabledFor.includes(dnaSlug))
    .map((c) => c.id);
}

/**
 * Gác cổng dữ liệu KV: đảm bảo đủ 5 loại ván + 77 màu + 6 phụ kiện CỐ ĐỊNH
 * (thiếu/khuyết field → lấp từ DEFAULT_CATALOG). Tránh giá/lọc sai âm thầm.
 *
 * v3 migration: stored.version === 2 (KV cũ founder đã lưu trước upgrade) cũng
 * được merge — giữ tất cả customizations cho 29 màu / 3 loại ván / 4 phụ kiện cũ;
 * 6 màu mới (mca_*) + boardType mdf_chong_am + hardware edge_banding lấy từ
 * DEFAULT. Founder Lưu 1 lần để KV chính thức lên v3.
 */
/**
 * P60 migration: KV cũ lưu anchor theo PANEL COUNT (field `maxPanels`). Công thức mới
 * dùng THỂ TÍCH (field `vol`, m³). Số panel-count vô nghĩa khi đọc là m³ → nếu stored
 * CHƯA có field `vol` (định dạng cũ) → return undefined để caller dùng
 * DEFAULT_CATALOG.marginTiers (mốc m³ mới). Định dạng mới (có `vol`) → giữ nguyên.
 */
function migrateMarginTiers(stored: unknown): { vol: number; margin: number }[] | undefined {
  if (!Array.isArray(stored) || stored.length === 0) return undefined;
  const allVol = stored.every(
    (t) =>
      t &&
      typeof (t as { vol?: unknown }).vol === "number" &&
      typeof (t as { margin?: unknown }).margin === "number",
  );
  return allVol ? (stored as { vol: number; margin: number }[]) : undefined;
}

export function mergeCatalog(stored: Partial<ProductionCatalog> | null): ProductionCatalog {
  if (!stored) return DEFAULT_CATALOG;
  // version cast: Partial<ProductionCatalog>.version = `3 | undefined` theo type,
  // nhưng runtime có thể là `2` (KV cũ trước v3 upgrade) → accept cả 2 lẫn 3.
  const v = stored.version as unknown as number | undefined;
  if (v !== 2 && v !== 3) return DEFAULT_CATALOG;
  const boardTypes = DEFAULT_CATALOG.boardTypes.map((def) => {
    const s = stored.boardTypes?.find((b) => b?.id === def.id);
    // P49: `label` là MÔ TẢ HỆ THỐNG (admin không sửa được) → LUÔN lấy từ DEFAULT,
    // đè nhãn cũ lưu trong KV (vd "…cạnh đen" / "…dán cạnh đồng màu" trước khi tách
    // dán cạnh thành option). Density/edgeBandingMm vẫn giữ giá trị founder đã lưu.
    return s ? { ...def, ...s, label: def.label } : def;
  });
  const colors = DEFAULT_CATALOG.colors.map((def) => {
    const s = stored.colors?.find((c) => c?.id === def.id);
    if (!s) return def;
    // code/supplier: catalog KV cũ lưu rỗng → giữ giá trị DEFAULT mới (mã NCC).
    return { ...def, ...s, code: s.code || def.code, supplier: s.supplier || def.supplier };
  });
  const hardware = DEFAULT_CATALOG.hardware.map((def) => {
    const s = stored.hardware?.find((h) => h?.id === def.id);
    return s ? { ...def, ...s } : def;
  });
  // P49/P52: merge edgeBands theo type (KV cũ 3 loại → seed thêm 14 màu ML từ DEFAULT).
  // `hex` + `label` LUÔN lấy từ DEFAULT (palette = nguồn duy nhất, admin chỉ sửa giá/bật-tắt).
  const edgeBands = DEFAULT_CATALOG.edgeBands.map((def) => {
    const s = stored.edgeBands?.find((b) => b?.type === def.type);
    return s ? { ...def, ...s, hex: def.hex, label: def.label } : def;
  });
  // machiningSpec: deep-merge với DEFAULT (KV chưa lưu spec → DEFAULT; lưu 1 phần
  // → override fields tương ứng, giữ default cho missing).
  const machiningSpec = resolveMachiningSpec(stored.machiningSpec);
  return {
    version: 3,
    boardTypes,
    colors,
    hardware,
    edgeBands,
    // v4 migration: KV cũ (boards rỗng) → seed DEFAULT để nesting kick in.
    // Admin save catalog với boards thực tế → respect KV.
    boards: stored.boards && stored.boards.length > 0 ? stored.boards : DEFAULT_CATALOG.boards,
    labor: stored.labor ?? DEFAULT_CATALOG.labor,
    kerfMm: stored.kerfMm ?? DEFAULT_CATALOG.kerfMm,
    margin: stored.margin ?? DEFAULT_CATALOG.margin,
    wasteMultiplierMin: stored.wasteMultiplierMin ?? DEFAULT_CATALOG.wasteMultiplierMin,
    laborPerSheet: stored.laborPerSheet ?? DEFAULT_CATALOG.laborPerSheet,
    // P60 anchors theo THỂ TÍCH: KV cũ (panel-count) hoặc chưa có → seed DEFAULT m³.
    marginTiers: migrateMarginTiers(stored.marginTiers) ?? DEFAULT_CATALOG.marginTiers,
    // P72: complexityBonus* trong KV cũ bị DROP tại đây (không copy sang object mới).
    hardwareMargin: stored.hardwareMargin ?? DEFAULT_CATALOG.hardwareMargin, // P69
    machiningSpec,
    // P84 tủ y: KV cũ chưa có → seed mặc định (margin 2.2 + 15% + bảng công trống).
    tuYMargin: stored.tuYMargin ?? DEFAULT_CATALOG.tuYMargin,
    tuYWasteRatio: stored.tuYWasteRatio ?? DEFAULT_CATALOG.tuYWasteRatio,
    tuYCellLabor: stored.tuYCellLabor ?? DEFAULT_CATALOG.tuYCellLabor,
    updatedAt: stored.updatedAt ?? "",
  };
}

const isPos = (n: unknown): n is number => typeof n === "number" && n > 0;
const isNonNeg = (n: unknown): n is number => typeof n === "number" && n >= 0;

/**
 * Kiểm tra 1 object có hợp lệ làm ProductionCatalog v3 không (dùng cho API POST).
 * Trả null nếu hợp lệ, hoặc chuỗi mô tả lỗi ĐẦU TIÊN bắt được.
 */
export function validateCatalog(c: unknown): string | null {
  if (!c || typeof c !== "object") return "Catalog rỗng hoặc sai kiểu";
  const cat = c as Partial<ProductionCatalog>;
  if (cat.version !== 3) return "version phải = 3";

  // P48.5: đếm theo DEFAULT_CATALOG (tự đồng bộ — thêm/bớt ở DEFAULT là validate
  // tự đúng, KHÔNG còn magic-number lệch như bug "phải 6 phụ kiện" do P45 thêm handle_bar).
  if (!Array.isArray(cat.boardTypes) || cat.boardTypes.length !== DEFAULT_CATALOG.boardTypes.length)
    return `Phải có đúng ${DEFAULT_CATALOG.boardTypes.length} loại ván`;
  for (const def of DEFAULT_CATALOG.boardTypes) {
    const bt = cat.boardTypes.find((x) => x?.id === def.id);
    if (!bt) return `Thiếu loại ván "${def.id}"`;
    if (!isPos(bt.densityKgPerM3)) return `Mật độ "${def.label}" phải > 0`;
    if (bt.edgeBandingMm !== undefined && !isNonNeg(bt.edgeBandingMm))
      return `Độ dày dán cạnh "${def.label}" phải ≥ 0`;
  }

  if (!Array.isArray(cat.colors) || cat.colors.length !== DEFAULT_CATALOG.colors.length)
    return `Phải có đúng ${DEFAULT_CATALOG.colors.length} màu`;
  for (const def of DEFAULT_CATALOG.colors) {
    const col = cat.colors.find((x) => x?.id === def.id);
    if (!col) return `Thiếu màu "${def.id}"`;
    // Body rate: ÍT NHẤT 1 trong 2 thickness (17 hoặc 18) phải có giá dương.
    const bodyRate = col.ratePerM2?.[17] ?? col.ratePerM2?.[18];
    if (!isPos(bodyRate) || !isPos(col.ratePerM2?.[9]))
      return `Giá màu "${def.label}" phải > 0 (cần ít nhất 1 trong {17, 18}mm + 9mm)`;
    if (!Array.isArray(col.enabledFor))
      return `Màu "${def.label}" thiếu danh sách sản phẩm`;
  }

  if (!Array.isArray(cat.hardware) || cat.hardware.length !== DEFAULT_CATALOG.hardware.length)
    return `Phải có đúng ${DEFAULT_CATALOG.hardware.length} dòng phụ kiện`;
  for (const def of DEFAULT_CATALOG.hardware) {
    const h = cat.hardware.find((x) => x?.id === def.id);
    if (!h) return `Thiếu phụ kiện "${def.id}"`;
    if (!isPos(h.unitPrice)) return `Đơn giá "${def.label}" phải > 0`;
    if (!isPos(h.weightKg)) return `Cân nặng "${def.label}" phải > 0`;
  }

  // P49: đúng 3 loại dán cạnh; mỗi loại có bật/tắt + giá/m ≥ 0 + ≥1 khổ + ≥1 độ dày > 0.
  if (!Array.isArray(cat.edgeBands) || cat.edgeBands.length !== DEFAULT_CATALOG.edgeBands.length)
    return `Phải có đúng ${DEFAULT_CATALOG.edgeBands.length} loại dán cạnh`;
  for (const def of DEFAULT_CATALOG.edgeBands) {
    const e = cat.edgeBands.find((x) => x?.type === def.type);
    if (!e) return `Thiếu loại dán cạnh "${def.type}"`;
    if (typeof e.enabled !== "boolean") return `Dán cạnh "${def.label}" thiếu bật/tắt`;
    if (!isNonNeg(e.pricePerM)) return `Giá dán cạnh "${def.label}" phải ≥ 0`;
    if (!Array.isArray(e.widths) || e.widths.length === 0 || !e.widths.every(isPos))
      return `Dán cạnh "${def.label}" cần ít nhất 1 khổ > 0`;
    if (!Array.isArray(e.thicknesses) || e.thicknesses.length === 0 || !e.thicknesses.every(isPos))
      return `Dán cạnh "${def.label}" cần ít nhất 1 độ dày > 0`;
  }

  if (!Array.isArray(cat.boards)) return "boards phải là danh sách";
  for (const b of cat.boards) {
    if (!isPos(b?.lengthMm) || !isPos(b?.widthMm) || !isPos(b?.thicknessMm))
      return "Mỗi khổ ván phải có dài/rộng/dày > 0";
  }

  if (!cat.labor || !isNonNeg(cat.labor.perOrder)) return "Tiền công phải ≥ 0";
  if (!isNonNeg(cat.kerfMm)) return "Mạch cưa kerf phải ≥ 0";
  if (typeof cat.margin !== "number" || cat.margin < 1)
    return "Hệ số margin phải ≥ 1";
  if (cat.wasteMultiplierMin !== undefined && (typeof cat.wasteMultiplierMin !== "number" || cat.wasteMultiplierMin < 1))
    return "Sàn hao hụt phải ≥ 1 (vd 1.4 = +40%)";
  if (cat.laborPerSheet !== undefined && !isNonNeg(cat.laborPerSheet))
    return "Nhân công/ván cốt phải ≥ 0";
  if (cat.marginTiers !== undefined) {
    if (!Array.isArray(cat.marginTiers) || cat.marginTiers.length === 0)
      return "Bậc margin phải là danh sách ≥ 1 phần tử";
    for (let i = 0; i < cat.marginTiers.length; i++) {
      const t = cat.marginTiers[i];
      if (typeof t?.margin !== "number" || t.margin < 1)
        return `Bậc margin #${i + 1}: margin phải ≥ 1`;
      if (typeof t?.vol !== "number" || t.vol <= 0)
        return `Bậc margin #${i + 1}: thể tích (m³) phải > 0`;
    }
  }
  if (cat.hardwareMargin !== undefined && (typeof cat.hardwareMargin !== "number" || cat.hardwareMargin < 1))
    return "Lãi phụ kiện phải ≥ 1 (vd 1.2 = +20%)";
  // P84 tủ y: margin ≥ 1; hao hụt 0..1 (0..100%); bảng nhân công mỗi giá trị ≥ 0.
  if (cat.tuYMargin !== undefined && (typeof cat.tuYMargin !== "number" || cat.tuYMargin < 1))
    return "Hệ số lãi tủ y phải ≥ 1 (vd 2.2)";
  if (cat.tuYWasteRatio !== undefined && (typeof cat.tuYWasteRatio !== "number" || cat.tuYWasteRatio < 0 || cat.tuYWasteRatio > 1))
    return "Hao hụt ván tủ y phải trong khoảng 0–100%";
  if (cat.tuYCellLabor !== undefined) {
    if (typeof cat.tuYCellLabor !== "object" || cat.tuYCellLabor === null)
      return "Nhân công tủ y phải là bảng";
    for (const [k, v] of Object.entries(cat.tuYCellLabor))
      if (!isNonNeg(v)) return `Nhân công tủ y "${k}" phải ≥ 0`;
  }
  return null;
}

/**
 * Đọc env CF runtime. undefined nếu chạy ngoài Workers (build/dev/client).
 * v3.5: dynamic import @opennextjs/cloudflare → file vẫn import được từ client
 * components (vd admin/ke editor) mà không bị bundle error.
 */
async function getKV(): Promise<KVNamespace | undefined> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    return getCloudflareContext({ async: false }).env?.KE_PRESETS;
  } catch {
    return undefined;
  }
}

/**
 * Đọc catalog sản xuất từ KV. KV miss / ngoài Workers → DEFAULT_CATALOG.
 * Luôn đi qua mergeCatalog → kết quả luôn đủ dòng, hợp lệ để tính giá.
 */
export async function getProductionCatalog(): Promise<ProductionCatalog> {
  const kv = await getKV();
  if (!kv) return DEFAULT_CATALOG;
  const stored = await kv.get<ProductionCatalog>(CATALOG_KEY, "json");
  if (!stored) return DEFAULT_CATALOG;
  return mergeCatalog(stored);
}
