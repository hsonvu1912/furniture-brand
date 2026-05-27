// =============================================================================
// PRESETS — 5 mẫu tủ kệ pre-configured cho KÊ. Mỗi preset = 1 set ParamValues
// hoàn chỉnh (kích thước · grid · cells · colors). Khi khách click PresetCard
// trên /collection → /design?preset=<slug> load preset.values vào Configurator
// qua prop initialValues (engine extension S5, additive).
//
// Constraints để cells hoạt động đúng:
//  - drawer: cột 250-900mm · ô cao ≤400mm · đỉnh ≤1200mm
//  - door:   cột 250-1200mm · ô cao ≤2400mm · cột >600 → tự tách cánh đôi
//  - open-back / open-nobk: cột 150-1200mm · ô cao 150-2400mm
//
// Nếu cell type bị banned bởi size → reconcileCellGrid fallback (drawer→door→
// open-back). Preset design đảm bảo MỌI ô đều hợp lệ (không cần fallback).
// =============================================================================
import { encodeCellGrid } from '@/configurator/cellgrid';
import type { ParamValues } from '@/configurator/types';

export type PresetCategory = 'compact' | 'studio' | 'loft' | 'tall' | 'wide';

export interface Preset {
  slug: string;
  name: string;
  description: string;
  category: PresetCategory;
  /** Tailwind utility class màu accent — fallback gradient placeholder khi thiếu thumbnail */
  accent: string;
  /** Vibe/usecase — hiển thị trong PresetCard subtitle */
  usecase: string;
  values: ParamValues;
  /** Base64 PNG dataURL chụp tự động khi admin Save. Optional — thiếu → fallback gradient. */
  thumbnail?: string;
}

const FRAME = 'frame'; // marker "ăn theo màu khung" — trùng FRAME_COLOR trong dna.ts

// === COMPACT — phòng nhỏ / studio apartment ==============================
// 800×1200×400 · 2 cột × 3 tầng = 6 ô (cw=400, h=400)
// Tầng 0: 2 ngăn kéo · Tầng 1: 2 mở-có-hậu · Tầng 2: 2 cánh
const compact: Preset = {
  slug: 'compact',
  name: 'KÊ. Compact',
  description: 'Tủ nhỏ gọn cho phòng nhỏ. 2 ngăn kéo dưới chứa đồ kín, 2 ô giữa bày decor, 2 cánh trên giấu đồ. Tỉ lệ vừa người, dễ đặt trong căn hộ studio dưới 30m².',
  category: 'compact',
  accent: 'from-[#F5A088] to-[#F5D78E]', // coral → yellow
  usecase: 'Phòng nhỏ · Studio < 30m²',
  values: {
    width: 800,
    height: 1200,
    depth: 400,
    columns: 2,
    rows: 3,
    widthMode: 'even',
    heightMode: 'even',
    color: 'mdf_son/xam_nhat',
    cells: encodeCellGrid([
      ['drawer', 'drawer'],
      ['open-back', 'open-back'],
      ['door', 'door'],
    ]),
    cellColors: encodeCellGrid([
      ['mdf_son/cam', 'mdf_son/cam'],
      [FRAME, FRAME],
      [FRAME, FRAME],
    ]),
  },
};

// === STUDIO — phòng khách / sinh hoạt chung ===============================
// 1500×1800×400 · 3 cột × 4 tầng = 12 ô (cw=500, h=450)
// h=450 > 400 → KHÔNG có ngăn kéo. Mix cánh + mở + open-nobk
// Tầng 0,1: cánh (6) · Tầng 2: mở-có-hậu (3) · Tầng 3: mở-không-hậu (3)
const studio: Preset = {
  slug: 'studio',
  name: 'KÊ. Studio',
  description: 'Tủ phòng khách đa năng. 2 hàng cánh dưới giấu sách/đồ điện tử, hàng giữa bày tranh ảnh, hàng trên mở thoáng cho cây hoặc lọ hoa. Cân bằng giữa chứa và trưng.',
  category: 'studio',
  accent: 'from-[#8DD8D0] to-[#7EB3DC]', // teal → blue
  usecase: 'Phòng khách · 30-50m²',
  values: {
    width: 1500,
    height: 1800,
    depth: 400,
    columns: 3,
    rows: 4,
    widthMode: 'even',
    heightMode: 'even',
    color: 'plywood_veneer/oak',
    cells: encodeCellGrid([
      ['door', 'door', 'door'],
      ['door', 'door', 'door'],
      ['open-back', 'open-back', 'open-back'],
      ['open-nobk', 'open-nobk', 'open-nobk'],
    ]),
    cellColors: encodeCellGrid([
      [FRAME, FRAME, FRAME],
      [FRAME, FRAME, FRAME],
      [FRAME, FRAME, FRAME],
      [FRAME, FRAME, FRAME],
    ]),
  },
};

// === LOFT — phòng ngủ master / dressing room ==============================
// 2000×2400×400 · 4 cột × 6 tầng = 24 ô (cw=500, h=400)
// h=400 OK cho drawer. Tầng 0,1,2: drawer (đỉnh 400/800/1200 ≤ 1200 ✓)
// Tầng 3: mở-có-hậu · Tầng 4,5: cánh
const loft: Preset = {
  slug: 'loft',
  name: 'KÊ. Loft',
  description: 'Tủ tường master bedroom hoặc dressing room. 12 ngăn kéo dưới chứa đồ kín (quần áo, phụ kiện), hàng giữa bày đồ trang trí, 8 cánh trên giấu mền/balo lớn. Cao chạm trần.',
  category: 'loft',
  accent: 'from-[#7EB3DC] to-[#C5A3D4]', // blue → purple
  usecase: 'Phòng ngủ master · Dressing room',
  values: {
    width: 2000,
    height: 2400,
    depth: 400,
    columns: 4,
    rows: 6,
    widthMode: 'even',
    heightMode: 'even',
    color: 'mdf_son/den',
    cells: encodeCellGrid([
      ['drawer', 'drawer', 'drawer', 'drawer'],
      ['drawer', 'drawer', 'drawer', 'drawer'],
      ['drawer', 'drawer', 'drawer', 'drawer'],
      ['open-back', 'open-back', 'open-back', 'open-back'],
      ['door', 'door', 'door', 'door'],
      ['door', 'door', 'door', 'door'],
    ]),
    cellColors: encodeCellGrid([
      ['mdf_son/cam', 'mdf_son/cam', 'mdf_son/cam', 'mdf_son/cam'],
      ['mdf_son/cam', 'mdf_son/cam', 'mdf_son/cam', 'mdf_son/cam'],
      ['mdf_son/cam', 'mdf_son/cam', 'mdf_son/cam', 'mdf_son/cam'],
      [FRAME, FRAME, FRAME, FRAME],
      [FRAME, FRAME, FRAME, FRAME],
      [FRAME, FRAME, FRAME, FRAME],
    ]),
  },
};

// === TALL — tủ ngách / góc cầu thang ======================================
// 600×2200×400 · 1 cột × 6 tầng = 6 ô (cw=600, h=367)
// Tầng 0: ngăn kéo · Tầng 1-5: mở-có-hậu (kệ sách / decor cao)
const tall: Preset = {
  slug: 'tall',
  name: 'KÊ. Tall',
  description: 'Tủ hẹp đứng cho ngách hoặc góc cầu thang. Ngăn kéo dưới chứa giày dép hoặc đồ nhỏ, 5 tầng mở phía trên dành cho sách, kỷ vật, lọ decor cao. Chỉ rộng 60cm.',
  category: 'tall',
  accent: 'from-[#C5A3D4] to-[#D9A0C4]', // purple → pink
  usecase: 'Tủ ngách · Góc cầu thang',
  values: {
    width: 600,
    height: 2200,
    depth: 400,
    columns: 1,
    rows: 6,
    widthMode: 'even',
    heightMode: 'even',
    color: 'plywood_veneer/walnut',
    cells: encodeCellGrid([
      ['drawer'],
      ['open-back'],
      ['open-back'],
      ['open-back'],
      ['open-back'],
      ['open-back'],
    ]),
    cellColors: encodeCellGrid([
      [FRAME],
      [FRAME],
      [FRAME],
      [FRAME],
      [FRAME],
      [FRAME],
    ]),
  },
};

// === WIDE — TV stand / console phòng khách ================================
// 2400×900×400 · 5 cột × 2 tầng = 10 ô (cw=480, h=450)
// h=450 > 400 → KHÔNG drawer. Tầng 0: cánh ngoài + mở giữa (giấu TV box / decor)
// Tầng 1: 5 mở-có-hậu (kệ bày decor / sách)
const wide: Preset = {
  slug: 'wide',
  name: 'KÊ. Wide',
  description: 'Kệ TV ngang rộng thấp 90cm. Hàng dưới: 2 cánh hai bên giấu thiết bị, 3 ô giữa bày loa / decor. Hàng trên: 5 ô mở để cây, ảnh khung, đồ kỷ niệm. Ngồi sofa nhìn vừa tầm.',
  category: 'wide',
  accent: 'from-[#F5D78E] to-[#8DD8D0]', // yellow → teal
  usecase: 'Phòng khách · TV stand 2.4m',
  values: {
    width: 2400,
    height: 900,
    depth: 400,
    columns: 5,
    rows: 2,
    widthMode: 'even',
    heightMode: 'even',
    color: 'mdf_son/xam_nhat',
    cells: encodeCellGrid([
      ['door', 'open-back', 'open-back', 'open-back', 'door'],
      ['open-back', 'open-back', 'open-back', 'open-back', 'open-back'],
    ]),
    cellColors: encodeCellGrid([
      [FRAME, FRAME, FRAME, FRAME, FRAME],
      [FRAME, FRAME, FRAME, FRAME, FRAME],
    ]),
  },
};

export const PRESETS: Preset[] = [compact, studio, loft, tall, wide];

/** Lookup preset by slug. Returns undefined nếu không tìm thấy. */
export function findPreset(slug: string | undefined): Preset | undefined {
  if (!slug) return undefined;
  return PRESETS.find((p) => p.slug === slug);
}

/** Tất cả category có sẵn — dùng cho FilterBar generate chip. */
export const CATEGORIES: { value: PresetCategory; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'studio', label: 'Studio' },
  { value: 'loft', label: 'Loft' },
  { value: 'tall', label: 'Tall' },
  { value: 'wide', label: 'Wide' },
];
