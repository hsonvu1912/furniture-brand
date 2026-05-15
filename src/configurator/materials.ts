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
  if (catalog === 'wood_veneer' || catalog === 'mfc' || catalog === 'mdf_finish') {
    return { hex: '#d4a574', roughness: 0.7 };
  }
  return { hex: '#888888', roughness: 0.5 };
}

/** Liệt kê mọi vật liệu trong 1 catalog (dùng cho swatch màu ở Session 2). */
export function listMaterials(catalog: string): { id: string; appearance: MaterialAppearance }[] {
  const entries = CATALOGS[catalog];
  return entries ? Object.entries(entries).map(([id, appearance]) => ({ id, appearance })) : [];
}
