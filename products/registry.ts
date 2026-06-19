// =============================================================================
// Product registry (P83) — 1 NGUỒN map slug → bundle sản phẩm. ngăn có nhiều LOẠI
// tủ: tu-ke ("Loại 1" = config/preset hiện tại) + (P83.1+) tu-y ("Loại 2" = module
// hộp rời). getDNA(slug) chọn DNA theo slug, default 'tu-ke' (23 preset cũ KHÔNG có
// productSlug → coi như tu-ke, back-compat). Thêm loại tủ mới = thêm 1 dòng PRODUCTS.
// Nhãn hiển thị là TẠM ("Loại 1/2") — founder đặt tên thật sau, chỉ sửa PRODUCT_LABELS.
// =============================================================================
import type { ProductDNA } from '@/configurator/types';
import tuKe from './tu-ke/dna';
import { PRESETS as tuKePresets, type Preset } from './tu-ke/presets';
import tuY from './tu-y/dna';
import { PRESETS as tuYPresets } from './tu-y/presets';

export interface ProductEntry {
  dna: ProductDNA;
  presets: Preset[];
  label: string;
}

export const DEFAULT_PRODUCT_SLUG = 'tu-ke';

export const PRODUCT_LABELS: Record<string, string> = {
  'tu-ke': 'x', // P83.5 — nhãn NỘI BỘ (admin) tạm "x"/"y". Đổi 1 chỗ này.
  'tu-y': 'y',
};

// P88 — nhãn KHÁCH-THẤY (bộ lọc /collection, trang chi tiết). Mô tả thay "x"/"y" thô.
export const PRODUCT_DISPLAY_LABELS: Record<string, string> = {
  'tu-ke': 'Tủ kệ', // lưới cột × tầng (configurator gốc)
  'tu-y': 'Mô-đun', // module hộp rời ghép tự do
};

export const PRODUCTS: Record<string, ProductEntry> = {
  'tu-ke': { dna: tuKe, presets: tuKePresets, label: PRODUCT_LABELS['tu-ke'] },
  'tu-y': { dna: tuY, presets: tuYPresets, label: PRODUCT_LABELS['tu-y'] },
};

/** Chọn DNA theo slug; vắng/không biết → tu-ke (back-compat preset cũ không có productSlug). */
export function getDNA(slug?: string): ProductDNA {
  const entry = slug ? PRODUCTS[slug] : undefined;
  return entry?.dna ?? PRODUCTS[DEFAULT_PRODUCT_SLUG].dna;
}

/** Nhãn hiển thị loại tủ theo slug (tạm "Loại 1/2"). */
export function getProductLabel(slug?: string): string {
  const label = slug ? PRODUCT_LABELS[slug] : undefined;
  return label ?? PRODUCT_LABELS[DEFAULT_PRODUCT_SLUG];
}
