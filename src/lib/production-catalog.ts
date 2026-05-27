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
import type { MachiningSpec, PriceConfig } from "../configurator/types";

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
  | "drawer-slide"
  | "foot"
  | "edge_banding";

/** Sản phẩm (DNA) đã biết — sinh cột bật/tắt màu trong admin. Thêm sản phẩm mới
 *  ở Session 8 → thêm 1 dòng vào đây. */
export const KNOWN_DNAS: { slug: string; label: string }[] = [
  { slug: "tu-ke", label: "Tủ kệ" },
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
  boardTypes: CatalogBoardType[]; // 5 cố định (S9: 3 + v3: +1 mdf chống ẩm + v3.6: +1 mfc)
  colors: CatalogColor[]; // 63 cố định (v3.4: +11 ml_*_edge_den — đối xứng MDF+AC cạnh đen)
  hardware: CatalogHardware[]; // 6 cố định (S9: 4 + v3: +1 edge_banding + v3.4: +1 handle_strip_black)
  boards: CatalogBoard[]; // list tự do (S10)
  labor: { perOrder: number };
  kerfMm: number;
  margin: number;
  // v4 (nesting pricing): 2 hằng số kinh doanh override default trong nesting/cost.ts.
  // Vắng → engine dùng MIN_WASTE_MULTIPLIER=1.4 + DEFAULT_LABOR_PER_SHEET=100_000.
  wasteMultiplierMin?: number; // sàn hao hụt (vd 1.4 = +40%)
  laborPerSheet?: number; // VND/tấm ván cốt từ nesting (vd 100_000)
  // v5 (IKEA stepped margin): markup tăng theo panel count (complexity proxy).
  // Vắng → engine dùng flat `margin`. Có → sort by maxPanels asc, last item maxPanels=null = catch-all.
  marginTiers?: { maxPanels: number | null; margin: number }[];
  // S10.1 (tùy chọn): quy cách phụ kiện CNC — admin chỉnh trong tab "Quy cách CNC".
  // Vắng → engine dùng DEFAULT_MACHINING_SPEC trong DNA (BASELINE giữ).
  machiningSpec?: MachiningSpec;
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
      label: "MDF chống ẩm phủ melamine (An Cường, dán cạnh đồng màu)",
      densityKgPerM3: 720,
      edgeBandingMm: 0.4,
    },
    {
      // v3.6 — MFC (ván dăm) Minh Long phủ melamine. CHỈ dán cạnh ĐEN (không
      // có variant đồng màu). Density ~650 kg/m³ chuẩn particleboard.
      id: "mfc_melamine",
      label: "Ván dăm (MFC) Minh Long phủ melamine (cạnh đen)",
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
    // MDF+AC — Dán cạnh ĐEN (6 variant): cùng mã NCC + giá, edge='#000000' khác face.
    defColor("mdf_chong_am_melamine/ac_vang_nghe_edge_den", "MDF+AC Vàng nghệ · cạnh đen", "mdf_chong_am_melamine", "MS 030 SH", "An Cường"),
    defColor("mdf_chong_am_melamine/ac_den_tuyen_edge_den", "MDF+AC Đen tuyền · cạnh đen", "mdf_chong_am_melamine", "MS 230 S", "An Cường"),
    defColor("mdf_chong_am_melamine/ac_trang_kem_edge_den", "MDF+AC Trắng kem · cạnh đen", "mdf_chong_am_melamine", "MS 9205 S", "An Cường"),
    defColor("mdf_chong_am_melamine/ac_nau_xam_edge_den", "MDF+AC Nâu xám · cạnh đen", "mdf_chong_am_melamine", "MS 025 MM", "An Cường"),
    defColor("mdf_chong_am_melamine/ac_xanh_muc_edge_den", "MDF+AC Xanh mực · cạnh đen", "mdf_chong_am_melamine", "MS 083 T", "An Cường"),
    defColor("mdf_chong_am_melamine/ac_xanh_thien_thanh_edge_den", "MDF+AC Xanh thiên thanh · cạnh đen", "mdf_chong_am_melamine", "MS 050 T", "An Cường"),
    // MDF+ML (Minh Long) — MDF chống ẩm phủ melamine, DÁN CẠNH ĐỒNG MÀU.
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
    // MDF+ML — Dán cạnh ĐEN (11 variant: face giữ nguyên, edge = #000000) ---
    defColor("mdf_chong_am_melamine/ml_xanh_reu_edge_den", "MDF+ML Xanh rêu · cạnh đen", "mdf_chong_am_melamine", "ML 211", "Minh Long", { 17: 200_000, 9: 140_000 }),
    defColor("mdf_chong_am_melamine/ml_do_san_ho_edge_den", "MDF+ML Đỏ san hô · cạnh đen", "mdf_chong_am_melamine", "ML 212", "Minh Long", { 17: 200_000, 9: 140_000 }),
    defColor("mdf_chong_am_melamine/ml_xam_am_edge_den", "MDF+ML Xám ấm · cạnh đen", "mdf_chong_am_melamine", "ML 214", "Minh Long", { 17: 200_000, 9: 140_000 }),
    defColor("mdf_chong_am_melamine/ml_den_espresso_edge_den", "MDF+ML Đen espresso · cạnh đen", "mdf_chong_am_melamine", "ML 216", "Minh Long", { 17: 200_000, 9: 140_000 }),
    defColor("mdf_chong_am_melamine/ml_xanh_mint_edge_den", "MDF+ML Xanh mint · cạnh đen", "mdf_chong_am_melamine", "ML 217", "Minh Long", { 17: 200_000, 9: 140_000 }),
    defColor("mdf_chong_am_melamine/ml_xanh_diu_edge_den", "MDF+ML Xanh dịu · cạnh đen", "mdf_chong_am_melamine", "ML 218", "Minh Long", { 17: 200_000, 9: 140_000 }),
    defColor("mdf_chong_am_melamine/ml_xanh_teal_dam_edge_den", "MDF+ML Xanh teal đậm · cạnh đen", "mdf_chong_am_melamine", "ML 219", "Minh Long", { 17: 200_000, 9: 140_000 }),
    defColor("mdf_chong_am_melamine/ml_caramel_edge_den", "MDF+ML Caramel · cạnh đen", "mdf_chong_am_melamine", "ML 223", "Minh Long", { 17: 200_000, 9: 140_000 }),
    defColor("mdf_chong_am_melamine/ml_olive_edge_den", "MDF+ML Olive · cạnh đen", "mdf_chong_am_melamine", "ML 224", "Minh Long", { 17: 200_000, 9: 140_000 }),
    defColor("mdf_chong_am_melamine/ml_xanh_navy_edge_den", "MDF+ML Xanh navy · cạnh đen", "mdf_chong_am_melamine", "ML 225", "Minh Long", { 17: 200_000, 9: 140_000 }),
    defColor("mdf_chong_am_melamine/ml_hong_phan_edge_den", "MDF+ML Hồng phấn · cạnh đen", "mdf_chong_am_melamine", "ML 226", "Minh Long", { 17: 200_000, 9: 140_000 }),
    // MFC+ML (Minh Long) — Ván dăm phủ melamine. Surface giống hệt MDF+ML, CHỈ
    // cạnh đen (không có variant đồng màu). Giá 261k/18mm · 222k/9mm.
    defColor("mfc_melamine/ml_xanh_reu_edge_den", "MFC+ML Xanh rêu · cạnh đen", "mfc_melamine", "ML 211", "Minh Long"),
    defColor("mfc_melamine/ml_do_san_ho_edge_den", "MFC+ML Đỏ san hô · cạnh đen", "mfc_melamine", "ML 212", "Minh Long"),
    defColor("mfc_melamine/ml_xam_am_edge_den", "MFC+ML Xám ấm · cạnh đen", "mfc_melamine", "ML 214", "Minh Long"),
    defColor("mfc_melamine/ml_den_espresso_edge_den", "MFC+ML Đen espresso · cạnh đen", "mfc_melamine", "ML 216", "Minh Long"),
    defColor("mfc_melamine/ml_xanh_mint_edge_den", "MFC+ML Xanh mint · cạnh đen", "mfc_melamine", "ML 217", "Minh Long"),
    defColor("mfc_melamine/ml_xanh_diu_edge_den", "MFC+ML Xanh dịu · cạnh đen", "mfc_melamine", "ML 218", "Minh Long"),
    defColor("mfc_melamine/ml_xanh_teal_dam_edge_den", "MFC+ML Xanh teal đậm · cạnh đen", "mfc_melamine", "ML 219", "Minh Long"),
    defColor("mfc_melamine/ml_caramel_edge_den", "MFC+ML Caramel · cạnh đen", "mfc_melamine", "ML 223", "Minh Long"),
    defColor("mfc_melamine/ml_olive_edge_den", "MFC+ML Olive · cạnh đen", "mfc_melamine", "ML 224", "Minh Long"),
    defColor("mfc_melamine/ml_xanh_navy_edge_den", "MFC+ML Xanh navy · cạnh đen", "mfc_melamine", "ML 225", "Minh Long"),
    defColor("mfc_melamine/ml_hong_phan_edge_den", "MFC+ML Hồng phấn · cạnh đen", "mfc_melamine", "ML 226", "Minh Long"),
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
    {
      id: "drawer-slide",
      label: "Ray ngăn kéo (bộ)",
      sku: "",
      unitPrice: 90_000,
      weightKg: 0.55,
    },
    { id: "foot", label: "Chân tủ", sku: "", unitPrice: 5_000, weightKg: 0.005 },
    // v3 — dán cạnh PVC đồng màu. Đơn vị "m" (mét dài). Engine cộng theo chu vi.
    // weightKg: 0.01 (10g/m PVC 0.4mm — tham khảo, founder chỉnh sau).
    {
      id: "edge_banding",
      label: "Dán cạnh đồng màu",
      sku: "PVC 0.4mm",
      unitPrice: 8_000,
      weightKg: 0.01,
    },
  ],
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
  // v5 IKEA-style margin anchors — engine linear interpolate giữa các anchor liền kề.
  // Anchor cuối có explicit maxPanels (vd 150) = plateau threshold; beyond = giữ margin 2.0.
  // Admin có thể sửa anchors. Add/remove tier qua admin (sau).
  marginTiers: [
    { maxPanels: 20, margin: 1.3 },
    { maxPanels: 40, margin: 1.5 },
    { maxPanels: 80, margin: 1.7 },
    { maxPanels: 150, margin: 2.0 },
  ],
  machiningSpec: DEFAULT_MACHINING_SPEC,
  updatedAt: "",
};

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
    edgeBandingPricePerM,
    edgeBandingMmByBoardType,
    machiningSpec: catalog.machiningSpec ?? DEFAULT_MACHINING_SPEC,
    // Nesting pricing: pass-through boards + kerf để computePrice chạy nesting.
    // Vắng (boards rỗng) → engine fallback laborPerOrder cũ. Constants 1.4 (sàn
    // hao hụt) + 100k/ván cốt mặc định trong src/lib/nesting/cost.ts.
    boards: catalog.boards,
    kerfMm: catalog.kerfMm,
    laborPerSheet: catalog.laborPerSheet,
    wasteMultiplierMin: catalog.wasteMultiplierMin,
    marginTiers: catalog.marginTiers,
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
 * Gác cổng dữ liệu KV: đảm bảo đủ 5 loại ván + 74 màu + 6 phụ kiện CỐ ĐỊNH
 * (thiếu/khuyết field → lấp từ DEFAULT_CATALOG). Tránh giá/lọc sai âm thầm.
 *
 * v3 migration: stored.version === 2 (KV cũ founder đã lưu trước upgrade) cũng
 * được merge — giữ tất cả customizations cho 29 màu / 3 loại ván / 4 phụ kiện cũ;
 * 6 màu mới (mca_*) + boardType mdf_chong_am + hardware edge_banding lấy từ
 * DEFAULT. Founder Lưu 1 lần để KV chính thức lên v3.
 */
/**
 * v5 migration: legacy KV có last tier maxPanels=null (catch-all) → convert sang
 * explicit number (= last_numeric × 2) để computeMargin linear interp đúng.
 * Vắng/rỗng → return undefined (caller fallback DEFAULT_CATALOG.marginTiers).
 */
function migrateMarginTiers(
  stored: { maxPanels: number | null; margin: number }[] | undefined,
): { maxPanels: number | null; margin: number }[] | undefined {
  if (!stored || stored.length === 0) return undefined;
  return stored.map((t, i) => {
    if (t.maxPanels !== null) return t;
    const prevMax = i > 0 ? stored[i - 1].maxPanels ?? 100 : 100;
    return { maxPanels: prevMax * 2, margin: t.margin };
  });
}

export function mergeCatalog(stored: Partial<ProductionCatalog> | null): ProductionCatalog {
  if (!stored) return DEFAULT_CATALOG;
  // version cast: Partial<ProductionCatalog>.version = `3 | undefined` theo type,
  // nhưng runtime có thể là `2` (KV cũ trước v3 upgrade) → accept cả 2 lẫn 3.
  const v = stored.version as unknown as number | undefined;
  if (v !== 2 && v !== 3) return DEFAULT_CATALOG;
  const boardTypes = DEFAULT_CATALOG.boardTypes.map((def) => {
    const s = stored.boardTypes?.find((b) => b?.id === def.id);
    return s ? { ...def, ...s } : def;
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
  // machiningSpec: deep-merge với DEFAULT (KV chưa lưu spec → DEFAULT; lưu 1 phần
  // → override fields tương ứng, giữ default cho missing).
  const machiningSpec = resolveMachiningSpec(stored.machiningSpec);
  return {
    version: 3,
    boardTypes,
    colors,
    hardware,
    // v4 migration: KV cũ (boards rỗng) → seed DEFAULT để nesting kick in.
    // Admin save catalog với boards thực tế → respect KV.
    boards: stored.boards && stored.boards.length > 0 ? stored.boards : DEFAULT_CATALOG.boards,
    labor: stored.labor ?? DEFAULT_CATALOG.labor,
    kerfMm: stored.kerfMm ?? DEFAULT_CATALOG.kerfMm,
    margin: stored.margin ?? DEFAULT_CATALOG.margin,
    wasteMultiplierMin: stored.wasteMultiplierMin ?? DEFAULT_CATALOG.wasteMultiplierMin,
    laborPerSheet: stored.laborPerSheet ?? DEFAULT_CATALOG.laborPerSheet,
    // v5 IKEA anchors: nếu KV chưa có → seed default. Nếu có legacy null catch-all
    // → migrate sang explicit maxPanels (= last_numeric × 2) cho linear interp đúng.
    marginTiers: migrateMarginTiers(stored.marginTiers) ?? DEFAULT_CATALOG.marginTiers,
    machiningSpec,
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

  if (!Array.isArray(cat.boardTypes) || cat.boardTypes.length !== 5)
    return "Phải có đúng 5 loại ván";
  for (const def of DEFAULT_CATALOG.boardTypes) {
    const bt = cat.boardTypes.find((x) => x?.id === def.id);
    if (!bt) return `Thiếu loại ván "${def.id}"`;
    if (!isPos(bt.densityKgPerM3)) return `Mật độ "${def.label}" phải > 0`;
    if (bt.edgeBandingMm !== undefined && !isNonNeg(bt.edgeBandingMm))
      return `Độ dày dán cạnh "${def.label}" phải ≥ 0`;
  }

  if (!Array.isArray(cat.colors) || cat.colors.length !== 74)
    return "Phải có đúng 74 màu";
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

  if (!Array.isArray(cat.hardware) || cat.hardware.length !== 6)
    return "Phải có đúng 6 dòng phụ kiện";
  for (const def of DEFAULT_CATALOG.hardware) {
    const h = cat.hardware.find((x) => x?.id === def.id);
    if (!h) return `Thiếu phụ kiện "${def.id}"`;
    if (!isPos(h.unitPrice)) return `Đơn giá "${def.label}" phải > 0`;
    if (!isPos(h.weightKg)) return `Cân nặng "${def.label}" phải > 0`;
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
      const isLast = i === cat.marginTiers.length - 1;
      if (typeof t?.margin !== "number" || t.margin < 1)
        return `Bậc margin #${i + 1}: margin phải ≥ 1`;
      if (!isLast && (typeof t.maxPanels !== "number" || t.maxPanels <= 0))
        return `Bậc margin #${i + 1}: maxPanels phải > 0 (chỉ bậc cuối được null)`;
      if (isLast && t.maxPanels !== null && (typeof t.maxPanels !== "number" || t.maxPanels <= 0))
        return `Bậc margin cuối: maxPanels phải null (catch-all) hoặc số > 0`;
    }
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
