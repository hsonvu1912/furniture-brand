// =============================================================
// THƯ VIỆN VẬT LIỆU — màu + thuộc tính bề mặt cho render 3D.
// Gốc: furniture-designer/src/lib/material-colors.ts (8 catalog).
// Part.material là chuỗi "catalog/id", vd "mfc/mfc_oak".
// =============================================================

import type { CSSProperties } from 'react';
import type { EdgeBandingType } from './types';

export interface MaterialAppearance {
  hex: string;
  metalness?: number;
  roughness?: number;
  opacity?: number;
  transparent?: boolean;
  grain?: boolean; // true → renderer phủ texture vân gỗ procedural (vd veneer)
  // (S5 polish, additive): vật liệu 2-tone — mặt phẳng dùng `hex`, cạnh hộp dùng
  // `edgeHex` (vd plywood dán melamine 2 mặt, lộ cạnh plywood thật). Renderer
  // detect → multi-material BoxGeometry [face, face, edge, edge, face, face].
  // Material cũ KHÔNG có → render 1-tone như cũ.
  edgeHex?: string;
  // (S5 polish, additive): không dán cạnh (cạnh lộ raw material). Cutlist gen
  // sẽ note "Cạnh lộ — không dán nẹp" + DNA build() có thể set edgeBanding=false.
  noEdgeBanding?: boolean;
  // (P51, additive): ảnh texture THẬT (vd map vân gỗ Minh Long chụp nguyên tấm).
  // Renderer nạp ảnh qua TextureLoader (cache 1 lần/url) và map theo mm thật:
  // `mapWidthMm`×`mapHeightMm` = kích thước tấm ván ảnh đại diện → repeat = cạnh-ván/
  // kích-thước-ảnh ⇒ vân giữ đúng tỷ lệ mọi cỡ ván (giống makePartGrain). Vân chạy
  // dọc trục V (cao) của ảnh. Có textureUrl thì renderer DÙNG ảnh thay vì grain procedural;
  // `hex` vẫn giữ làm màu nền/dự phòng khi ảnh chưa/không load được.
  textureUrl?: string;
  mapWidthMm?: number; // bề NGANG ảnh (ngang thớ), mm — vd 1220 (khổ tấm)
  mapHeightMm?: number; // chiều CAO ảnh (dọc thớ), mm — vd 2745 (dài tấm)
}

const CATALOGS: Record<string, Record<string, MaterialAppearance>> = {
  anodized_aluminum: {
    anode_silver: { hex: '#c8c8c8', metalness: 0.85, roughness: 0.35 },
    anode_champagne: { hex: '#b39880', metalness: 0.8, roughness: 0.4 },
    anode_black: { hex: '#1a1a1a', metalness: 0.85, roughness: 0.35 },
    anode_gold: { hex: '#c8a560', metalness: 0.85, roughness: 0.35 },
  },
  wood_veneer: {
    oak_natural: { hex: '#d4a574', metalness: 0, roughness: 0.7 },
    walnut_dark: { hex: '#5a3d2b', metalness: 0, roughness: 0.7 },
    ash_light: { hex: '#e8d4a8', metalness: 0, roughness: 0.7 },
    white_lacquer: { hex: '#f5f5f5', metalness: 0.1, roughness: 0.5 },
  },
  mfc: {
    mfc_oak: { hex: '#d4a574', metalness: 0, roughness: 0.65 },
    mfc_walnut: { hex: '#5a3d2b', metalness: 0, roughness: 0.65 },
    mfc_white: { hex: '#f5f5f5', metalness: 0, roughness: 0.55 },
    mfc_black: { hex: '#1a1a1a', metalness: 0, roughness: 0.55 },
  },
  mdf_finish: {
    white_lacquer: { hex: '#f5f5f5', metalness: 0.1, roughness: 0.45 },
    raw_mdf: { hex: '#b8a890', metalness: 0, roughness: 0.85 },
  },
  steel_finish: {
    powder_black: { hex: '#1a1a1a', metalness: 0.5, roughness: 0.45 },
    chrome: { hex: '#dadada', metalness: 0.95, roughness: 0.15 },
    powder_white: { hex: '#f0f0f0', metalness: 0.4, roughness: 0.45 },
  },
  metal_finish: {
    brushed_steel: { hex: '#c8c8c8', metalness: 0.9, roughness: 0.3 },
    polished_brass: { hex: '#c8a560', metalness: 0.95, roughness: 0.15 },
    matte_black: { hex: '#1a1a1a', metalness: 0.6, roughness: 0.45 },
  },
  glass_tint: {
    clear: { hex: '#a8c4d8', opacity: 0.35, transparent: true, roughness: 0.05 },
    smoke: { hex: '#404040', opacity: 0.55, transparent: true, roughness: 0.05 },
    bronze: { hex: '#aa8855', opacity: 0.5, transparent: true, roughness: 0.05 },
  },
  acrylic: {
    clear: { hex: '#cccccc', opacity: 0.45, transparent: true, roughness: 0.1 },
    white: { hex: '#f0f0f0', opacity: 0.85, transparent: true, roughness: 0.2 },
    black: { hex: '#1a1a1a', metalness: 0.1, roughness: 0.2 },
  },
  // --- Session 2: vật liệu sản phẩm "tủ kệ" — id khớp danh sách MATERIALS trong dna.ts ---
  // mdf_son: ván MDF sơn màu — 9 màu đo từ ảnh swatch thật. Sơn mờ → metalness 0, roughness cao.
  mdf_son: {
    vang: { hex: '#bfa23d', metalness: 0, roughness: 0.62 },
    cam: { hex: '#c26d3b', metalness: 0, roughness: 0.62 },
    do: { hex: '#ae534e', metalness: 0, roughness: 0.62 },
    nau: { hex: '#8b5c3d', metalness: 0, roughness: 0.62 },
    xanh_la: { hex: '#52795d', metalness: 0, roughness: 0.62 },
    xanh: { hex: '#527e9b', metalness: 0, roughness: 0.62 },
    xam_nhat: { hex: '#929292', metalness: 0, roughness: 0.62 },
    xam: { hex: '#6a6a72', metalness: 0, roughness: 0.62 },
    den: { hex: '#4e4e4e', metalness: 0, roughness: 0.62 },
  },
  // plywood_veneer: ván plywood phủ veneer vân gỗ thật (satin → roughness thấp hơn MDF).
  plywood_veneer: {
    oak: { hex: '#9e6f3f', metalness: 0, roughness: 0.55, grain: true },
    walnut: { hex: '#45301f', metalness: 0, roughness: 0.5, grain: true },
    ash: { hex: '#b58d52', metalness: 0, roughness: 0.55, grain: true },
  },
  // plywood_melamine: plywood phủ melamine 2 mặt (4 mặt phẳng), CẠNH lộ plywood
  // thật (#D4A574 birch tự nhiên). 11 màu Minh Long (ml_*) + 6 màu An Cường (ac_*).
  // noEdgeBanding=true → xưởng không dán nẹp cạnh, melamine ép thẳng giữ cạnh raw.
  plywood_melamine: {
    ml_xanh_reu:       { hex: '#587060', edgeHex: '#D4A574', noEdgeBanding: true, metalness: 0, roughness: 0.55 },
    ml_do_san_ho:      { hex: '#E7796C', edgeHex: '#D4A574', noEdgeBanding: true, metalness: 0, roughness: 0.55 },
    ml_xam_am:         { hex: '#958F81', edgeHex: '#D4A574', noEdgeBanding: true, metalness: 0, roughness: 0.55 },
    ml_den_espresso:   { hex: '#2C1C0D', edgeHex: '#D4A574', noEdgeBanding: true, metalness: 0, roughness: 0.55 },
    ml_xanh_mint:      { hex: '#A5CAC3', edgeHex: '#D4A574', noEdgeBanding: true, metalness: 0, roughness: 0.55 },
    ml_xanh_diu:       { hex: '#8DAA8B', edgeHex: '#D4A574', noEdgeBanding: true, metalness: 0, roughness: 0.55 },
    ml_xanh_teal_dam:  { hex: '#015A6C', edgeHex: '#D4A574', noEdgeBanding: true, metalness: 0, roughness: 0.55 },
    ml_caramel:        { hex: '#99755F', edgeHex: '#D4A574', noEdgeBanding: true, metalness: 0, roughness: 0.55 },
    ml_olive:          { hex: '#9A8A69', edgeHex: '#D4A574', noEdgeBanding: true, metalness: 0, roughness: 0.55 },
    ml_xanh_navy:      { hex: '#3C5C75', edgeHex: '#D4A574', noEdgeBanding: true, metalness: 0, roughness: 0.55 },
    ml_hong_phan:      { hex: '#EBCAC3', edgeHex: '#D4A574', noEdgeBanding: true, metalness: 0, roughness: 0.55 },
    // An Cường — plywood melamine (6 màu MFC). Cùng cấu tạo lộ cạnh như Minh Long.
    ac_vang_nghe:        { hex: '#F8D150', edgeHex: '#D4A574', noEdgeBanding: true, metalness: 0, roughness: 0.55 },
    ac_den_tuyen:        { hex: '#000000', edgeHex: '#D4A574', noEdgeBanding: true, metalness: 0, roughness: 0.55 },
    ac_trang_kem:        { hex: '#E4E0D4', edgeHex: '#D4A574', noEdgeBanding: true, metalness: 0, roughness: 0.55 },
    ac_nau_xam:          { hex: '#897F75', edgeHex: '#D4A574', noEdgeBanding: true, metalness: 0, roughness: 0.55 },
    ac_xanh_muc:         { hex: '#052345', edgeHex: '#D4A574', noEdgeBanding: true, metalness: 0, roughness: 0.55 },
    ac_xanh_thien_thanh: { hex: '#84B0CD', edgeHex: '#D4A574', noEdgeBanding: true, metalness: 0, roughness: 0.55 },
  },
  // mdf_chong_am_melamine — MDF chống ẩm phủ melamine, 2 NCC theo naming XXX+YYY:
  //  A. MDF+AC (An Cường): 6 ac_* (đồng màu) + 6 ac_*_edge_den (cạnh đen)
  //  B. MDF+ML (Minh Long): 11 ml_* (đồng màu — hex copy từ PLY+ML)
  // Tất cả entries có DÁN CẠNH (catalog edgeBandingMm > 0). Vật lý 17mm/9mm.
  // UI swatch tự detect edgeHex !== hex → render diagonal 2-half cho variant cạnh đen.
  mdf_chong_am_melamine: {
    // --- A. MDF+AC (An Cường) — Dán cạnh đồng màu (6 màu) ---
    ac_vang_nghe:        { hex: '#F8D150', metalness: 0, roughness: 0.55 },
    ac_den_tuyen:        { hex: '#000000', metalness: 0, roughness: 0.55 },
    ac_trang_kem:        { hex: '#E4E0D4', metalness: 0, roughness: 0.55 },
    ac_nau_xam:          { hex: '#897F75', metalness: 0, roughness: 0.55 },
    ac_xanh_muc:         { hex: '#052345', metalness: 0, roughness: 0.55 },
    ac_xanh_thien_thanh: { hex: '#84B0CD', metalness: 0, roughness: 0.55 },
    // P49: bỏ 6 biến thể MDF+AC "cạnh đen" — dán cạnh giờ là option riêng (edgeHex set theo Part).
    // --- B. MDF+ML (Minh Long) — 11 màu, hex copy từ PLY+ML.
    // Mã NCC giống plywood Minh Long (ML 211, 212, ...) — phân biệt qua boardType + supplier.
    ml_xanh_reu:      { hex: '#587060', metalness: 0, roughness: 0.55 },
    ml_do_san_ho:     { hex: '#E7796C', metalness: 0, roughness: 0.55 },
    ml_xam_am:        { hex: '#958F81', metalness: 0, roughness: 0.55 },
    ml_den_espresso:  { hex: '#2C1C0D', metalness: 0, roughness: 0.55 },
    ml_xanh_mint:     { hex: '#A5CAC3', metalness: 0, roughness: 0.55 },
    ml_xanh_diu:      { hex: '#8DAA8B', metalness: 0, roughness: 0.55 },
    ml_xanh_teal_dam: { hex: '#015A6C', metalness: 0, roughness: 0.55 },
    ml_caramel:       { hex: '#99755F', metalness: 0, roughness: 0.55 },
    ml_olive:         { hex: '#9A8A69', metalness: 0, roughness: 0.55 },
    ml_xanh_navy:     { hex: '#3C5C75', metalness: 0, roughness: 0.55 },
    ml_hong_phan:     { hex: '#EBCAC3', metalness: 0, roughness: 0.55 },
    // P49: bỏ 11 biến thể MDF+ML "cạnh đen" — dán cạnh giờ là option riêng.
  },
  // v3.6 — mfc_melamine: ván dăm (MFC) Minh Long phủ melamine. Surface giống hệt
  // MDF+ML. P49: id GỐC (bỏ hậu tố _edge_den + bỏ edgeHex) — màu cạnh do option dán
  // cạnh quyết định (edgeHex set theo Part). Body 18mm chuẩn. Giá 261k/18mm · 222k/9mm.
  mfc_melamine: {
    ml_xanh_reu:      { hex: '#587060', metalness: 0, roughness: 0.55 },
    ml_do_san_ho:     { hex: '#E7796C', metalness: 0, roughness: 0.55 },
    ml_xam_am:        { hex: '#958F81', metalness: 0, roughness: 0.55 },
    ml_den_espresso:  { hex: '#2C1C0D', metalness: 0, roughness: 0.55 },
    ml_xanh_mint:     { hex: '#A5CAC3', metalness: 0, roughness: 0.55 },
    ml_xanh_diu:      { hex: '#8DAA8B', metalness: 0, roughness: 0.55 },
    ml_xanh_teal_dam: { hex: '#015A6C', metalness: 0, roughness: 0.55 },
    ml_caramel:       { hex: '#99755F', metalness: 0, roughness: 0.55 },
    ml_olive:         { hex: '#9A8A69', metalness: 0, roughness: 0.55 },
    ml_xanh_navy:     { hex: '#3C5C75', metalness: 0, roughness: 0.55 },
    ml_hong_phan:     { hex: '#EBCAC3', metalness: 0, roughness: 0.55 },
    // P48.5 — 3 màu Minh Long bổ sung (hex sample từ ảnh swatch trong Downloads).
    ml_den_tuyen:     { hex: '#121212', metalness: 0, roughness: 0.55 },
    ml_do_booc_do:    { hex: '#6C0F07', metalness: 0, roughness: 0.55 },
    ml_trang_kem:     { hex: '#FEFDF9', metalness: 0, roughness: 0.55 },
    ml_vang_kem_220:  { hex: '#FFFBC3', metalness: 0, roughness: 0.55 }, // P79 — ML 220 vàng kem nhạt
    // P51 — 2 map VÂN GỖ Minh Long (ảnh thật chụp nguyên tấm 1220×2745mm). Renderer
    // nạp ảnh + map đúng tỷ lệ; hex = màu trung bình (dự phòng khi ảnh chưa load).
    ml_van_go_sang: {
      hex: '#C3A877', metalness: 0, roughness: 0.6, grain: true,
      textureUrl: '/textures/ml-van-go-sang.jpg', mapWidthMm: 1220, mapHeightMm: 2745,
    },
    ml_van_go_dam: {
      hex: '#3C2D20', metalness: 0, roughness: 0.6, grain: true,
      textureUrl: '/textures/ml-van-go-dam.jpg', mapWidthMm: 1220, mapHeightMm: 2745,
    },
    // P59 — 2 map vân gỗ Minh Long bổ sung (ML 7525 sồi sáng · ML 7225 óc chó đậm).
    ml_van_go_soi: {
      hex: '#A28F6B', metalness: 0, roughness: 0.6, grain: true,
      textureUrl: '/textures/ml-van-go-soi.jpg', mapWidthMm: 1220, mapHeightMm: 2745,
    },
    ml_van_go_oc_cho: {
      hex: '#433728', metalness: 0, roughness: 0.6, grain: true,
      textureUrl: '/textures/ml-van-go-oc-cho.jpg', mapWidthMm: 1220, mapHeightMm: 2745,
    },
  },
};

/** P49: hậu tố id cũ mã hoá "cạnh đen". Giờ dán cạnh là option riêng → strip về id gốc. */
const EDGE_DEN_SUFFIX = '_edge_den';

/** Tra cứu vật liệu theo chuỗi "catalog/id", trả về fallback hợp lý nếu không thấy. */
export function resolveMaterial(material: string): MaterialAppearance {
  const [catalog, rawId] = material.split('/');
  // Back-compat: data cũ (thiết kế khách / preset) còn id "..._edge_den" → quy về id gốc.
  const id = rawId?.endsWith(EDGE_DEN_SUFFIX) ? rawId.slice(0, -EDGE_DEN_SUFFIX.length) : rawId;
  const entry = CATALOGS[catalog]?.[id];
  if (entry) return entry;

  if (catalog === 'glass_tint' || catalog === 'acrylic') {
    return { hex: '#a8c4d8', opacity: 0.4, transparent: true };
  }
  if (catalog === 'anodized_aluminum' || catalog === 'metal_finish' || catalog === 'steel_finish') {
    return { hex: '#c0c0c0', metalness: 0.7, roughness: 0.4 };
  }
  if (
    catalog === 'wood_veneer' ||
    catalog === 'mfc' ||
    catalog === 'mdf_finish' ||
    catalog === 'mdf_son' ||
    catalog === 'plywood_veneer' ||
    catalog === 'plywood_melamine' ||
    catalog === 'mdf_chong_am_melamine' ||
    catalog === 'mfc_melamine'
  ) {
    return { hex: '#d4a574', roughness: 0.7 };
  }
  return { hex: '#888888', roughness: 0.5 };
}

/** Liệt kê mọi vật liệu trong 1 catalog (dùng cho swatch màu ở Session 2). */
export function listMaterials(catalog: string): { id: string; appearance: MaterialAppearance }[] {
  const entries = CATALOGS[catalog];
  return entries ? Object.entries(entries).map(([id, appearance]) => ({ id, appearance })) : [];
}

/**
 * P52 — PALETTE màu nẹp dán cạnh (NGUỒN DUY NHẤT). Dùng chung cho: edgeHexForBand
 * (render), DEFAULT_CATALOG.edgeBands (giá admin), param edgeBanding (ô chọn khách),
 * nhãn DXF/báo giá. `hex` vắng (chỉ 'same') = nẹp đồng màu, renderer vẽ 1-tone theo mặt.
 * 14 màu ML = đúng hex màu Minh Long tương ứng (nẹp dán cạnh màu đặc).
 */
export interface EdgeBandColor {
  id: string;
  label: string; // tên ngắn cho ô chọn khách (vd "Xanh rêu")
  hex?: string; // màu nẹp; vắng = đồng màu (theo mặt)
}
export const EDGE_BAND_COLORS: EdgeBandColor[] = [
  { id: 'same', label: 'Đồng màu' },
  { id: 'black', label: 'Đen', hex: '#000000' },
  { id: 'white', label: 'Trắng', hex: '#FFFFFF' },
  // 14 màu ML (Minh Long) — hex khớp màu melamine cùng tên.
  { id: 'ml_xanh_reu', label: 'Xanh rêu', hex: '#587060' },
  { id: 'ml_do_san_ho', label: 'Đỏ san hô', hex: '#E7796C' },
  { id: 'ml_xam_am', label: 'Xám ấm', hex: '#958F81' },
  { id: 'ml_den_espresso', label: 'Đen espresso', hex: '#2C1C0D' },
  { id: 'ml_xanh_mint', label: 'Xanh mint', hex: '#A5CAC3' },
  { id: 'ml_xanh_diu', label: 'Xanh dịu', hex: '#8DAA8B' },
  { id: 'ml_xanh_teal_dam', label: 'Xanh teal đậm', hex: '#015A6C' },
  { id: 'ml_caramel', label: 'Caramel', hex: '#99755F' },
  { id: 'ml_olive', label: 'Olive', hex: '#9A8A69' },
  { id: 'ml_xanh_navy', label: 'Xanh navy', hex: '#3C5C75' },
  { id: 'ml_hong_phan', label: 'Hồng phấn', hex: '#EBCAC3' },
  { id: 'ml_den_tuyen', label: 'Đen tuyền', hex: '#121212' },
  { id: 'ml_do_booc_do', label: 'Đỏ booc-đô', hex: '#6C0F07' },
  { id: 'ml_trang_kem', label: 'Trắng kem', hex: '#FEFDF9' },
  { id: 'ml_vang_kem_220', label: 'Vàng kem 220', hex: '#FFFBC3' }, // P79
];

const EDGE_BAND_HEX: Record<string, string | undefined> = Object.fromEntries(
  EDGE_BAND_COLORS.map((c) => [c.id, c.hex]),
);

/**
 * P49/P52 — màu nẹp dán cạnh theo loại đã chọn (tra từ EDGE_BAND_COLORS):
 * - `same` (đồng màu) → undefined ⇒ renderer 1-tone (cạnh = màu mặt ván).
 * - `black`/`white`/`ml_*` → hex tương ứng ⇒ renderer 2-tone (mặt + cạnh màu).
 * `faceHex` giữ tham số cho khả năng "đồng màu nhưng đậm hơn" sau này.
 */
export function edgeHexForBand(_faceHex: string, type: EdgeBandingType): string | undefined {
  return EDGE_BAND_HEX[type];
}

// P96 — swatch VÂN GỖ thật cho UI (1 nguồn dùng chung cả 2 config + product page).
// Material có textureUrl → ảnh vân thật; vắng → nền hex phẳng. Trước đây copy cục bộ
// trong Configurator.tsx + YConfigurator.tsx → gom về đây.
export function swatchCss(material: string, fallbackBg: string): CSSProperties {
  const m = resolveMaterial(material);
  if (m.textureUrl) return { backgroundImage: `url(${m.textureUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  return { backgroundColor: fallbackBg };
}
