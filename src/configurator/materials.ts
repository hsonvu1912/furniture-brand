// =============================================================
// THƯ VIỆN VẬT LIỆU — màu + thuộc tính bề mặt cho render 3D.
// Gốc: furniture-designer/src/lib/material-colors.ts (8 catalog).
// Part.material là chuỗi "catalog/id", vd "mfc/mfc_oak".
// =============================================================

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
  // thật (#D4A574 birch tự nhiên). 11 màu ML từ BST màu đơn sắc 2026-05-21.
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
  },
};

/** Tra cứu vật liệu theo chuỗi "catalog/id", trả về fallback hợp lý nếu không thấy. */
export function resolveMaterial(material: string): MaterialAppearance {
  const [catalog, id] = material.split('/');
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
    catalog === 'plywood_melamine'
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
