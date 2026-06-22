// =============================================================================
// tu-y (Loại 2) — mô hình MODULE hộp rời (P83). Tủ y = nhiều hộp module độc lập
// ghép kiểu Tetris trên LƯỚI 18cm. Mỗi module = 1 hộp 4 ván (vách trái/phải +
// nóc/đáy), sâu cố định 36cm. KHÔNG chia vách chung (mỗi module giữ vách riêng).
//
// Toạ độ lưới: gx/gy = góc DƯỚI-TRÁI theo đơn vị 18cm; gy=0 = sàn. gw/gh = cỡ theo
// lưới ĐÃ áp hướng (quay ngang/dọc = hoán đổi gw↔gh). 4 cỡ gốc (rộng×cao):
//   36×36 = 2×2 · 18×36 = 1×2 · 54×36 = 3×2 · 72×36 = 4×2 (sâu 36 cố định).
// Lưu trong ParamValues.modules = JSON.stringify({ modules: YModule[] }).
// Helper THUẦN, tu-y-local — KHÔNG đụng cellgrid.ts của x.
// =============================================================================

export const GRID_MM = 180; // 1 đơn vị lưới = 18cm

/** 1 module hộp rời. */
export interface YModule {
  id: string;
  gx: number; // góc dưới-trái X (đơn vị lưới)
  gy: number; // góc dưới-trái Y (đơn vị lưới; 0 = sàn)
  gw: number; // rộng (đơn vị lưới, đã áp hướng)
  gh: number; // cao (đơn vị lưới, đã áp hướng)
  attribute: 'open-nobk' | 'open-back' | 'door' | 'drawer';
  color?: string; // KHUNG (thân): 'frame'/'catalog/id' — vắng = theo màu khung mặc định
  doorColor?: string; // CÁNH/MẶT NGĂN KÉO: 'catalog/id' — vắng = theo màu khung ô (P85)
  edgeColor?: string; // NẸP: loại nẹp; vắng = theo nẹp chung (P85)
  drawers?: number; // P97 — số NGĂN KÉO (chỉ khi attribute='drawer'); vắng = suy theo chiều cao
  doorLeaves?: 1 | 2; // P97 — override SỐ CÁNH (cho 54×36 chọn đơn/đôi); vắng = suy theo bề rộng
}

export interface YComposition {
  modules: YModule[];
}

/** 4 cỡ chuẩn (chưa áp hướng) theo lưới 18cm. Key = nhãn rộng×cao (cm). */
export const Y_SIZES: Record<string, { gw: number; gh: number }> = {
  '36x36': { gw: 2, gh: 2 },
  '18x36': { gw: 1, gh: 2 },
  '54x36': { gw: 3, gh: 2 },
  '72x36': { gw: 4, gh: 2 },
};

/** Danh sách cỡ cho UI (giữ thứ tự). */
export const Y_SIZE_LIST: { key: string; label: string; gw: number; gh: number }[] = [
  { key: '18x36', label: '18×36', gw: 1, gh: 2 },
  { key: '36x36', label: '36×36', gw: 2, gh: 2 },
  { key: '54x36', label: '54×36', gw: 3, gh: 2 },
  { key: '72x36', label: '72×36', gw: 4, gh: 2 },
];

/** Thuộc tính ô cho UI. */
export const Y_ATTRIBUTES: { value: YModule['attribute']; label: string }[] = [
  { value: 'open-nobk', label: 'Mở (không hậu)' },
  { value: 'open-back', label: 'Mở (có hậu)' },
  { value: 'door', label: 'Cánh' },
  { value: 'drawer', label: 'Ngăn kéo' },
];

// =============================================================================
// P99 — QUY TẮC BIẾN THỂ Ô theo cỡ (gw,gh). NGUỒN DUY NHẤT: engine (dna.ts import
// lại 4 vị từ) + UI (YConfigurator chip "Kiểu ô" dùng 3 helper bên dưới). THUẦN.
// =============================================================================

// P92 — Cánh cần ≥2 ô MỖI chiều (≥36cm rộng VÀ cao). Ô có cạnh 18cm (gw=1/gh=1) cấm cánh.
export function doorAllowedY(m: { gw: number; gh: number }): boolean {
  return m.gw >= 2 && m.gh >= 2;
}
// P97 — NGĂN KÉO chỉ cho module ĐỨNG rộng 36cm (gw=2), cao ≥36cm. Xếp chồng theo CAO.
export function drawerAllowedY(m: { gw: number; gh: number }): boolean {
  return m.gw === 2 && m.gh >= 2;
}
// P97 — Số ngăn kéo theo cao: 36→1, 54→2, 72→2 (mặc định); tối đa gh2→1/gh3→2/gh4→3.
export function drawerCountY(m: YModule): number {
  const max = m.gh >= 4 ? 3 : m.gh >= 3 ? 2 : 1;
  const def = m.gh >= 3 ? 2 : 1;
  return Math.max(1, Math.min(max, m.drawers ?? def));
}
// P92/P97 — Thuộc tính HIỆU LỰC: cánh/ngăn kéo ở ô không hợp lệ → "Mở (có hậu)" (dữ liệu cũ).
export function effectiveAttrY(m: YModule): YModule['attribute'] {
  if (m.attribute === 'door' && !doorAllowedY(m)) return 'open-back';
  if (m.attribute === 'drawer' && !drawerAllowedY(m)) return 'open-back';
  return m.attribute;
}

/** Composition mặc định: 1 module 36×36 đặt trên sàn, mở-không-hậu. */
export function defaultComposition(): YComposition {
  return { modules: [{ id: 'm0', gx: 0, gy: 0, gw: 2, gh: 2, attribute: 'open-nobk' }] };
}

/** Parse chuỗi JSON `modules` → YComposition. Hỏng/rỗng → composition mặc định. */
export function parseModules(raw: unknown): YComposition {
  if (typeof raw !== 'string' || raw.trim() === '') return defaultComposition();
  try {
    const o = JSON.parse(raw) as { modules?: unknown };
    if (o && Array.isArray(o.modules)) {
      return { modules: o.modules as YModule[] }; // P97 — cho phép RỖNG (vẽ lại từ 0)
    }
  } catch {
    /* JSON hỏng → fallback */
  }
  return defaultComposition();
}

/** Encode YComposition → chuỗi JSON lưu vào ParamValues.modules. */
export function encodeModules(c: YComposition): string {
  return JSON.stringify(c);
}

// =============================================================================
// PLACEMENT HELPERS (P83.3) — THUẦN, tu-y-local. Dùng bởi YConfigurator + dna
// (getWarnings). Mọi thao tác trả về YComposition mới (hoặc null nếu từ chối:
// đè ô khác / lọt dưới sàn). Lưới 18cm; đổi sang mm chỉ ở build().
// =============================================================================

/** 2 hình chữ nhật lưới CHỒNG nhau (diện tích giao > 0)? */
function rectsOverlap(a: YModule, b: YModule): boolean {
  const xo = Math.min(a.gx + a.gw, b.gx + b.gw) - Math.max(a.gx, b.gx);
  const yo = Math.min(a.gy + a.gh, b.gy + b.gh) - Math.max(a.gy, b.gy);
  return xo > 0 && yo > 0;
}

/** Ứng viên có đè LÊN module nào đang có không? */
export function overlaps(modules: YModule[], candidate: YModule): boolean {
  return modules.some((m) => rectsOverlap(m, candidate));
}

/** id module kế tiếp ỔN ĐỊNH (suy từ max suffix số; KHÔNG Date.now/Math.random). */
export function nextModuleId(comp: YComposition): string {
  let max = -1;
  for (const m of comp.modules) {
    const mt = m.id.match(/^m(\d+)$/);
    if (mt) max = Math.max(max, parseInt(mt[1], 10));
  }
  return `m${max + 1}`;
}

/**
 * Gắn 1 module MỚI sát 1 CẠNH của module đang chọn (căn đáy khi gắn trái/phải,
 * căn cạnh trái khi gắn trên/dưới). Từ chối nếu lọt dưới sàn (gy<0) hoặc đè ô khác.
 *   edge = cạnh CỦA module đang chọn mà ô mới áp vào.
 */
export function placeAtEdge(
  comp: YComposition,
  selectedId: string,
  edge: 'left' | 'right' | 'top' | 'bottom',
  size: { gw: number; gh: number },
  attribute: YModule['attribute'],
  extra: Partial<YModule> = {}, // P97 — field thêm (drawers/doorLeaves/màu) khi đặt từ gallery
): YComposition | null {
  const sel = comp.modules.find((m) => m.id === selectedId);
  if (!sel) return null;
  const { gw, gh } = size;
  let gx: number;
  let gy: number;
  switch (edge) {
    case 'left':
      gx = sel.gx - gw;
      gy = sel.gy;
      break;
    case 'right':
      gx = sel.gx + sel.gw;
      gy = sel.gy;
      break;
    case 'top':
      gx = sel.gx;
      gy = sel.gy + sel.gh;
      break;
    case 'bottom':
      gx = sel.gx;
      gy = sel.gy - gh;
      break;
    default:
      return null;
  }
  if (gy < 0) return null; // không lọt dưới sàn
  const added: YModule = { id: nextModuleId(comp), gx, gy, gw, gh, attribute, ...extra };
  if (overlaps(comp.modules, added)) return null;
  return { modules: [...comp.modules, added] };
}

/** Cập nhật 1 field của module theo id (cỡ/hướng/thuộc tính/màu). Đè ô khác → null. */
export function updateModule(comp: YComposition, id: string, patch: Partial<YModule>): YComposition | null {
  const idx = comp.modules.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  const next: YModule = { ...comp.modules[idx], ...patch, id };
  const rest = comp.modules.filter((_, i) => i !== idx);
  if (overlaps(rest, next)) return null; // đổi cỡ/hướng làm đè ô kề → từ chối
  const modules = [...comp.modules];
  modules[idx] = next;
  return { modules };
}

/** Xoá module theo id. id không tồn tại → null. */
export function removeModule(comp: YComposition, id: string): YComposition | null {
  const idx = comp.modules.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  return { modules: comp.modules.filter((_, i) => i !== idx) };
}

/** Module có ĐỠ không? (tựa sàn gy=0, hoặc có module ngay dưới chồng X>0). */
export function isSupported(comp: YComposition, m: YModule): boolean {
  if (m.gy === 0) return true;
  return comp.modules.some(
    (s) => s !== m && s.gy + s.gh === m.gy && Math.min(s.gx + s.gw, m.gx + m.gw) - Math.max(s.gx, m.gx) > 0,
  );
}

/** id các module "bay" (không có đỡ). */
export function findFloating(comp: YComposition): string[] {
  return comp.modules.filter((m) => !isSupported(comp, m)).map((m) => m.id);
}
