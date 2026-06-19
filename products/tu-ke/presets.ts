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

// P46: phân loại theo CÔNG NĂNG (MVP 7 loại) — thay nhãn style cũ (compact/loft...).
export type PresetCategory = 'tv' | 'decor' | 'book' | 'wall' | 'drawer' | 'shoe' | 'bedside';

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
  /** P83: slug loại tủ ('tu-ke'/'tu-y'...). VẮNG = 'tu-ke' (back-compat 23 preset cũ).
   *  Dùng getDNA(productSlug) để chọn đúng DNA khi build/giá/DXF. */
  productSlug?: string;
  /** Ảnh CHÍNH (= thumbnails[0]). Base64 lúc Save → URL sau putPreset. Back-compat. */
  thumbnail?: string;
  /** P34: NHIỀU góc render (chính diện + chéo trái + chéo phải). Base64[] lúc Save
   *  → URL[] sau putPreset. Dùng cho hover-swap (trang chủ/collection) + gallery
   *  (product page). thumbnails[0] = thumbnail (ảnh chính). */
  thumbnails?: string[];
}

const FRAME = 'frame'; // marker "ăn theo màu khung" — trùng FRAME_COLOR trong dna.ts

// === COMPACT — phòng nhỏ / studio apartment ==============================
// 800×1200×400 · 2 cột × 3 tầng = 6 ô (cw=400, h=400)
// Tầng 0: 2 ngăn kéo · Tầng 1: 2 mở-có-hậu · Tầng 2: 2 cánh
const compact: Preset = {
  slug: 'compact',
  name: 'KÊ. Compact',
  description: 'Tủ nhỏ gọn cho phòng nhỏ. 2 ngăn kéo dưới chứa đồ kín, 2 ô giữa bày decor, 2 cánh trên giấu đồ. Tỉ lệ vừa người, dễ đặt trong căn hộ studio dưới 30m².',
  category: 'decor',
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
  category: 'decor',
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
  category: 'decor',
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
  category: 'book',
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
  category: 'tv',
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

// ============================================================================
// TEST PRESETS (TEMPORARY) — verify split/merge engine. KHÔNG ship cho user end.
// Filter ở PRESETS list cuối file (test slug bị skip ở UI gallery).
// ============================================================================

/** Test merge: tủ 1×3 với ô (0,0) và (0,1) cross-merged → 1 block 1×2 + 1 ô (0,2). */
const testMerge: Preset = {
  slug: 'test-merge',
  name: 'TEST. Cross-merge',
  description: 'Test preset: 2 ô đầu gộp ngang thành 1 bay rộng, ô cuối còn riêng.',
  category: 'decor',
  accent: 'from-[#F5A088] to-[#F5D78E]',
  usecase: 'Test cross-grid merge engine',
  values: {
    width: 1200,
    height: 600,
    depth: 400,
    columns: 3,
    rows: 1,
    widthMode: 'manual',
    heightMode: 'manual',
    colW_0: 400,
    colW_1: 400,
    colW_2: 400,
    tierH_0: 600,
    color: 'mdf_son/xam_nhat',
    // Blocks format: 1 block 1×2 (open-nobk - merged result) + 1 block 1×1 (open-back).
    cells: '0,0,1,2,open-nobk|0,2,1,1,open-back',
    cellColors: `0,0,1,2,${FRAME}|0,2,1,1,${FRAME}`,
  },
};

/** Test split: tủ 1×1 với ô open-back đã split dọc → vách phụ giữa, 2 sub open-back. */
const testSplit: Preset = {
  slug: 'test-split',
  name: 'TEST. Sub-split',
  description: 'Test preset: 1 ô open-back đã split dọc, vách phụ chìm trong cell.',
  category: 'decor',
  accent: 'from-[#F5A088] to-[#F5D78E]',
  usecase: 'Test intra-cell split engine',
  values: {
    width: 800,
    height: 600,
    depth: 400,
    columns: 1,
    rows: 1,
    widthMode: 'manual',
    heightMode: 'manual',
    colW_0: 800,
    tierH_0: 600,
    color: 'mdf_son/xam_nhat',
    // 1 block 1×1 với t = "open-back>open-back" (V-split, 2 sub open-back).
    cells: '0,0,1,1,open-back>open-back',
    cellColors: `0,0,1,1,${FRAME}>${FRAME}`,
  },
};

/** Test: compact-style sau khi user merge 2 ô open-back giữa thành 1 bay. */
const testCompactMerged: Preset = {
  slug: 'test-compact-merged',
  name: 'TEST. Compact post-merge',
  description: 'Mô phỏng state sau khi user merge 2 ô open-back giữa của compact.',
  category: 'decor',
  accent: 'from-[#F5A088] to-[#F5D78E]',
  usecase: 'Test compact + cross-merge engine',
  values: {
    width: 800,
    height: 1200,
    depth: 400,
    columns: 2,
    rows: 3,
    widthMode: 'even',
    heightMode: 'even',
    color: 'mdf_son/xam_nhat',
    // Block list: row 0 = 2 drawers, row 1 = 1 merged block (open-nobk cs=2 với pre lossless),
    // row 2 = 2 doors. Pre data: 2 open-back nguyên gốc trước merge → unmerge restore đúng.
    cells: '0,0,1,1,drawer|0,1,1,1,drawer|1,0,1,2,open-nobk~open-back~open-back|2,0,1,1,door|2,1,1,1,door',
    cellColors: `0,0,1,1,mdf_son/cam|0,1,1,1,mdf_son/cam|1,0,1,2,${FRAME}~${FRAME}~${FRAME}|2,0,1,1,${FRAME}|2,1,1,1,${FRAME}`,
  },
};

/** Test: vertical merge (gộp dọc 2 ô) — kiểm tra hướng up/down sau khi flip. */
const testVerticalMerge: Preset = {
  slug: 'test-vmerge',
  name: 'TEST. Vertical merge',
  description: 'Mô phỏng state sau khi user gộp 2 ô open-back dọc (col 0, rows 0+1).',
  category: 'decor',
  accent: 'from-[#F5A088] to-[#F5D78E]',
  usecase: 'Test vertical merge engine',
  values: {
    width: 800,
    height: 1200,
    depth: 400,
    columns: 2,
    rows: 3,
    widthMode: 'even',
    heightMode: 'even',
    color: 'mdf_son/xam_nhat',
    // col 0 rows 0+1 merged (rs=2 cs=1, open-nobk với pre=['open-back','open-back']).
    // col 0 row 2 + col 1 rows 0,1,2 = primitive open-back.
    cells: '0,0,2,1,open-nobk~open-back~open-back|0,1,1,1,open-back|1,1,1,1,open-back|2,0,1,1,open-back|2,1,1,1,open-back',
    cellColors: `0,0,2,1,${FRAME}~${FRAME}~${FRAME}|0,1,1,1,${FRAME}|1,1,1,1,${FRAME}|2,0,1,1,${FRAME}|2,1,1,1,${FRAME}`,
  },
};

/** Test: cell với V-split door>door — verify animation sub-cell L/R. */
const testDoorSplit: Preset = {
  slug: 'test-door-split',
  name: 'TEST. Door sub-split',
  description: '1 ô V-split door>door — click sub L hoặc R để verify animation mở cánh.',
  category: 'decor',
  accent: 'from-[#F5A088] to-[#F5D78E]',
  usecase: 'Test sub-cell door animation',
  values: {
    width: 800,
    height: 600,
    depth: 400,
    columns: 1,
    rows: 1,
    widthMode: 'manual',
    heightMode: 'manual',
    colW_0: 800,
    tierH_0: 600,
    color: 'mdf_son/xam_nhat',
    cells: '0,0,1,1,door>door',
    cellColors: `0,0,1,1,${FRAME}>${FRAME}`,
  },
};

/** Test: cell rộng 1000mm với door type → cánh đôi (2 leaves). Verify split. */
const testWideDoor: Preset = {
  slug: 'test-wide-door',
  name: 'TEST. Wide door (cánh đôi)',
  description: '1 ô rộng 1000mm cánh đôi — verify khi split V có crash không.',
  category: 'decor',
  accent: 'from-[#F5A088] to-[#F5D78E]',
  usecase: 'Test wide door split',
  values: {
    width: 1000,
    height: 600,
    depth: 400,
    columns: 1,
    rows: 1,
    widthMode: 'manual',
    heightMode: 'manual',
    colW_0: 1000,
    tierH_0: 600,
    color: 'mdf_son/xam_nhat',
    cells: 'door', // legacy 1 cell door
    cellColors: FRAME,
  },
};

/** Test: wide door đã V-split → 2 sub door 491mm mỗi cái (single door per sub). */
const testWideDoorSplit: Preset = {
  slug: 'test-wide-door-split',
  name: 'TEST. Wide door post-split',
  description: 'Mô phỏng wide door (1000mm) đã V-split → 2 sub door single (~491mm each).',
  category: 'decor',
  accent: 'from-[#F5A088] to-[#F5D78E]',
  usecase: 'Test wide door post-split render',
  values: {
    width: 1000,
    height: 600,
    depth: 400,
    columns: 1,
    rows: 1,
    widthMode: 'manual',
    heightMode: 'manual',
    colW_0: 1000,
    tierH_0: 600,
    color: 'mdf_son/xam_nhat',
    cells: '0,0,1,1,door>door',
    cellColors: `0,0,1,1,${FRAME}>${FRAME}`,
  },
};

export const PRESETS: Preset[] = [compact, studio, loft, tall, wide, testMerge, testSplit, testCompactMerged, testVerticalMerge, testDoorSplit, testWideDoor, testWideDoorSplit];

/** Lookup preset by slug. Returns undefined nếu không tìm thấy. */
export function findPreset(slug: string | undefined): Preset | undefined {
  if (!slug) return undefined;
  return PRESETS.find((p) => p.slug === slug);
}

/** NGUỒN DUY NHẤT các danh mục — FilterBar / CategoryList / admin / product page
 *  đều import từ đây (P46: hết hardcode rời rạc). 7 loại công năng cho MVP. */
export const CATEGORIES: { value: PresetCategory; label: string }[] = [
  { value: 'tv', label: 'Tủ TV' },
  { value: 'decor', label: 'Tủ trang trí' },
  { value: 'book', label: 'Tủ sách' },
  { value: 'wall', label: 'Tủ tường' },
  { value: 'drawer', label: 'Tủ ngăn kéo' },
  { value: 'shoe', label: 'Tủ giày' },
  { value: 'bedside', label: 'Tủ đầu giường' },
];

/** value → label (cho product page hiển thị nhãn loại). */
export const categoryLabel = (value: string): string =>
  CATEGORIES.find((c) => c.value === value)?.label ?? value;
