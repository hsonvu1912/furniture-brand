// =============================================================================
// PRESETS — tu-y ("y"). P83.5: thư viện mẫu để khách chọn nhanh. Mỗi preset =
// 1 bố cục module (Tetris, lưới 18cm) + màu. BẮT BUỘC productSlug:'tu-y' để
// getDNA chọn đúng engine. Mọi bố cục đều CÓ ĐỠ (không ô bay). Chưa có ảnh thật
// (render tu-y chưa dựng) → /collection hiện placeholder gradient.
//
// Dùng type `Preset` của tu-ke (hợp đồng chung UI collection — 1 nguồn).
// =============================================================================
import type { ParamValues } from '@/configurator/types';
import type { Preset } from '../tu-ke/presets';
import { encodeModules, type YModule } from './modules';

export type { Preset };

/** values gọn cho 1 preset tu-y. */
function v(color: string, modules: YModule[], handleType = 'bar'): ParamValues {
  return { color, edgeBanding: 'same', handleType, modules: encodeModules({ modules }) };
}

// === Kệ đôi — 2 hộp 36×36 cạnh nhau (1 mở trần + 1 mở có hậu) ================
const keDoi: Preset = {
  slug: 'y-ke-doi',
  name: 'Kệ đôi',
  description: 'Hai hộp module 36×36 ghép ngang — một ô mở thoáng, một ô có hậu kín lưng. Gọn cho góc làm việc hoặc kệ bày.',
  category: 'decor',
  accent: 'from-[#8DD8D0] to-[#7EB3DC]',
  usecase: 'Bàn làm việc · Góc bày',
  productSlug: 'tu-y',
  values: v('mfc_melamine/ml_trang_kem', [
    { id: 'm0', gx: 0, gy: 0, gw: 2, gh: 2, attribute: 'open-nobk' },
    { id: 'm1', gx: 2, gy: 0, gw: 2, gh: 2, attribute: 'open-back' },
  ]),
};

// === Kệ chữ L — 2 hộp dưới + 1 hộp chồng trái ================================
const chuL: Preset = {
  slug: 'y-chu-l',
  name: 'Kệ chữ L',
  description: 'Ba hộp module xếp chữ L: hai ô tầng dưới (36×36 + 54×36) đỡ một ô chồng bên trái. Cân đối cho kệ sách hoặc vách ngăn nhẹ.',
  category: 'book',
  accent: 'from-[#F5D78E] to-[#8DD8D0]',
  usecase: 'Kệ sách · Vách ngăn',
  productSlug: 'tu-y',
  values: v('plywood_veneer/oak', [
    { id: 'm0', gx: 0, gy: 0, gw: 2, gh: 2, attribute: 'open-nobk' },
    { id: 'm1', gx: 2, gy: 0, gw: 3, gh: 2, attribute: 'open-back' },
    { id: 'm2', gx: 0, gy: 2, gw: 2, gh: 2, attribute: 'open-nobk' },
  ]),
};

// === Tủ 2 cánh — 1 hộp cánh 54cm + 1 hộp mở ==================================
const tuCanh: Preset = {
  slug: 'y-tu-canh',
  name: 'Tủ cánh + mở',
  description: 'Một hộp 54×36 lắp cánh (giấu đồ) ghép một hộp 36×36 mở để bày. Vừa kín vừa thoáng.',
  category: 'decor',
  accent: 'from-[#7EB3DC] to-[#C5A3D4]',
  usecase: 'Phòng khách · Lưu trữ',
  productSlug: 'tu-y',
  values: v('mfc_melamine/ml_xanh_reu', [
    { id: 'm0', gx: 0, gy: 0, gw: 3, gh: 2, attribute: 'door' },
    { id: 'm1', gx: 3, gy: 0, gw: 2, gh: 2, attribute: 'open-nobk' },
  ]),
};

// === Kệ bậc thang — 2 hộp dưới + 1 hộp chồng (so le) =========================
const bacThang: Preset = {
  slug: 'y-bac-thang',
  name: 'Kệ bậc thang',
  description: 'Hai hộp tầng dưới đỡ một hộp tầng trên lệch sang trái, tạo dáng bậc thang trang trí. Hợp treo tường thấp hoặc ngăn phòng.',
  category: 'wall',
  accent: 'from-[#C5A3D4] to-[#D9A0C4]',
  usecase: 'Trang trí tường · Ngăn phòng',
  productSlug: 'tu-y',
  values: v('mdf_son/den', [
    { id: 'm0', gx: 0, gy: 0, gw: 2, gh: 2, attribute: 'open-nobk' },
    { id: 'm1', gx: 2, gy: 0, gw: 2, gh: 2, attribute: 'open-back' },
    { id: 'm2', gx: 0, gy: 2, gw: 2, gh: 2, attribute: 'open-nobk' },
  ]),
};

export const PRESETS: Preset[] = [keDoi, chuL, tuCanh, bacThang];
