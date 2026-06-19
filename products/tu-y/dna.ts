// =============================================================================
// SẢN PHẨM: tu-y ("Loại 2") — products/tu-y/dna.ts  (P83.2)
// Tủ MODULE hộp rời: nhiều hộp độc lập ghép Tetris trên lưới 18cm. Mỗi module =
// 1 hộp 4 ván 18mm (2 VÁCH chạy hết chiều cao + NÓC/ĐÁY kẹp giữa), sâu cố định
// 36cm, KHÔNG chia vách chung (2 module kề giữ vách riêng — 2 lớp ván chỗ chạm).
// Thuộc tính ô: mở-không-hậu / mở-có-hậu / cánh (KHÔNG ngăn kéo).
//
// TÁCH HẲN khỏi tu-ke (x): KHÔNG import geometry của x. CHỈ dùng chung HẠ TẦNG
// product-agnostic: types, materials (resolveMaterial/edgeHexForBand), machining
// spec (resolveMachiningSpec), và engine giá/cutlist/DXF (qua BuildResult). Mọi
// helper hình học (panel/drill/pocket/slot/panelCoord/hinge…) COPY THUẦN từ x —
// KHÔNG bóc closure cánh của x (giữ BASELINE x bất biến).
//
// Hệ toạ độ scene (mm): X căn giữa quanh 0, Y∈[0,H] (0=sàn, +FOOT_H ở post-pass),
// Z giữa 0 (mặt trước +Z, hậu −Z). Sâu D=360 cố định.
//
// Liên kết: 4 GÓC hộp (vách↔nóc/đáy) = connector 2-in-1 (P74, thật). Liên kết
// GIỮA CÁC MODULE ("chốt sau lưng") = spec CHƯA chốt → placeholder BOM gắn cờ
// [xưởng xác nhận], KHÔNG phát machining (chờ founder/xưởng xác nhận).
// =============================================================================
import { resolveMachiningSpec } from '@/configurator/machining-defaults';
import { EDGE_BAND_COLORS, edgeHexForBand, resolveMaterial } from '@/configurator/materials';
import type {
  BuildOptions,
  BuildResult,
  CellCavity,
  EdgeBandingType,
  Fitting,
  Hardware,
  Machining,
  MachiningSide,
  PanelHole,
  ParamValues,
  Parameter,
  Part,
  ProductDNA,
} from '@/configurator/types';
import { findFloating, GRID_MM, parseModules, type YComposition, type YModule } from './modules';

// ---- Hằng số hình học (đồng bộ quy ước x) -----------------------------------
const DEFAULT_T = 18; // ván thân (mm)
const MCA_T = 17; // MDF chống ẩm melamine ship 17mm physical
const T_BACK = 9; // ván hậu (mm)
const DEPTH = 360; // sâu cố định 36cm
const FOOT_H = 5; // nhấc tủ khỏi sàn (chân nút mỏng)
const FOOT_DIA = 18; // Ø chân tủ (3D)
const FOOT_INSET_SAFE = 85; // tâm chân ≥85mm từ mép (tránh đè rãnh connector)
const FRONT_GAP = 4; // khe overlay cánh
// VÁT GÓC 45° PHẲNG cạnh ván thân (mm) — CHỈ render 3D. Mỗi cạnh ván cắt 1 mặt
// phẳng 45° so với 2 mặt chính → 2 ván kề tạo "rãnh V" ở chỗ tiếp giáp → module
// nhìn tách bạch mà KHÔNG dời vị trí / KHÔNG đổi kích thước (giá/DXF/phủ bì giữ
// nguyên tuyệt đối). Renderer dựng bằng ExtrudeGeometry bevel 1-đoạn (mặt phẳng,
// KHÔNG bo tròn) + giữ UV mặt chính → vân gỗ map đúng (RoundedBox thì mất vân).
const CHAMFER_MM = 1.5;
const WIDE_CELL = 600; // lòng rộng ≤600 → 1 cánh; >600 → 2 cánh
const LOW_HANDLE_FROM_GROUND = 1200; // module cao >1200 từ sàn → tay nắm mép DƯỚI

// ---- Hằng số bản lề (Hafele 311.88.512 — đồng bộ x P75) ---------------------
const HINGE_X_TARGET = 280;
const HINGE_X_PHYS = 52;
const HINGE_MARGIN_MIN = 60;
const HINGE_MARGIN_MAX = 100;
const HINGE_MARGIN_ABS = 30;

// ---- Hằng số tay nắm (đồng bộ x P45/P77) ------------------------------------
const BAR_LEN = 100;
const BAR_ARM_THICK = 8;
const BAR_ARM_DEPTH = 22;
const BAR_LIP_HEIGHT = 13;
const BAR_LIP_THICK = 8;
const BAR_INSET = 60;
const BAR_EDGE_MARGIN = 12;
const STRIP_TOP_THICKNESS = 3;
const STRIP_TOP_DEPTH = 14;
const STRIP_BELLY_HEIGHT = 12;
const STRIP_BELLY_DEPTH = 2.5;
const STRIP_HANDLE_INSET = 0;

type Handle = 'round' | 'strip' | 'bar' | 'none';

/** Body thickness theo material (đồng bộ x). MCA An Cường/Minh Long ship 17mm. */
// P97 — RAY ÂM Hafele EPC Plus (copy LITERAL từ tu-ke/dna.ts — TỦ X KHÔNG ĐỤNG).
// tu-y sâu cố định 360 → railForDepth snap 350 → ray 300mm (433.03.002). Lòng 351 ≥ 318 ✓.
interface RailInfo {
  len: number;
  sku: string;
  hwId: string;
  minInner: number;
}
const RAIL_BY_DEPTH: Record<number, RailInfo> = {
  300: { len: 270, sku: '433.03.001', hwId: 'drawer-slide-270', minInner: 288 },
  350: { len: 300, sku: '433.03.002', hwId: 'drawer-slide-300', minInner: 318 },
  400: { len: 350, sku: '433.03.003', hwId: 'drawer-slide-350', minInner: 368 },
  450: { len: 400, sku: '433.03.004', hwId: 'drawer-slide-400', minInner: 418 },
};
const RAIL_CLUSTER_OFFSETS = [0, 128, 224];
const railClustersFor = (railLen: number): number[] =>
  railLen < 300 ? RAIL_CLUSTER_OFFSETS.slice(0, 2) : RAIL_CLUSTER_OFFSETS;
function railForDepth(D: number): RailInfo | null {
  const snap = Math.max(250, Math.min(450, Math.round(D / 50) * 50));
  return RAIL_BY_DEPTH[snap] ?? null;
}

function bodyTFor(material: unknown): number {
  if (typeof material !== 'string') return DEFAULT_T;
  return material.startsWith('mdf_chong_am_melamine/') ? MCA_T : DEFAULT_T;
}

// =============================================================================
// HELPER THUẦN — COPY VERBATIM từ tu-ke/dna.ts (KHÔNG import để tách hẳn).
// =============================================================================
/** Làm tròn 1 chữ số thập phân (gọn DXF). */
const r1 = (v: number): number => Math.round(v * 10) / 10;

/** 1 MachiningDrill — `through` tự tính từ depth vs thickness. */
function drill(
  purpose: Machining['purpose'],
  side: MachiningSide,
  x_mm: number,
  y_mm: number,
  diameter_mm: number,
  depth_mm: number,
  thickness_mm: number,
): Machining {
  return {
    op: 'drill',
    purpose,
    side,
    x_mm: r1(x_mm),
    y_mm: r1(y_mm),
    diameter_mm,
    depth_mm,
    through: depth_mm >= thickness_mm - 0.5,
  };
}

/** 1 MachiningPocket (hốc tròn — cup bản lề âm). */
function pocket(
  purpose: Machining['purpose'],
  side: MachiningSide,
  x_mm: number,
  y_mm: number,
  diameter_mm: number,
  depth_mm: number,
): Machining {
  return { op: 'pocket', purpose, side, x_mm: r1(x_mm), y_mm: r1(y_mm), diameter_mm, depth_mm };
}

/** 1 MachiningSlot (rãnh obround cho PAT connector). (x,y) = TÂM rãnh. */
function slot(
  purpose: Machining['purpose'],
  side: MachiningSide,
  x_mm: number,
  y_mm: number,
  length_mm: number,
  width_mm: number,
  depth_mm: number,
  along: 'length' | 'width',
): Machining {
  return { op: 'slot', purpose, side, x_mm: r1(x_mm), y_mm: r1(y_mm), length_mm, width_mm, depth_mm, along };
}

/** Toạ độ scene tuyệt đối → frame physical của tấm (length axis = trục lớn nhất). */
function panelCoord(
  partSize: [number, number, number],
  partPos: [number, number, number],
  scene: [number, number, number],
): { x_mm: number; y_mm: number } {
  const axes: { idx: 0 | 1 | 2; s: number }[] = [
    { idx: 0, s: partSize[0] },
    { idx: 1, s: partSize[1] },
    { idx: 2, s: partSize[2] },
  ];
  axes.sort((a, b) => b.s - a.s);
  const lAxis = axes[0].idx;
  const wAxis = axes[1].idx;
  return {
    x_mm: scene[lAxis] - (partPos[lAxis] - partSize[lAxis] / 2),
    y_mm: scene[wAxis] - (partPos[wAxis] - partSize[wAxis] / 2),
  };
}

/** Trục scene (0=X,1=Y,2=Z) ứng với LENGTH axis của tấm. */
function lengthAxisOf(s: [number, number, number]): 0 | 1 | 2 {
  const axes: { idx: 0 | 1 | 2; v: number }[] = [
    { idx: 0, v: s[0] },
    { idx: 1, v: s[1] },
    { idx: 2, v: s[2] },
  ];
  axes.sort((a, b) => b.v - a.v);
  return axes[0].idx;
}

/** Số bản lề theo chiều cao MẶT cánh (Hafele — đồng bộ x). */
function hingeCount(faceH: number): number {
  if (faceH < 900) return 2;
  if (faceH < 1800) return 3;
  if (faceH < 2200) return 4;
  return 5;
}

/** Khoảng cách tâm bản lề → mép trên/dưới cánh (dải 60–100, nén tới 30 cho cánh lùn). */
function hingeEndMargin(faceH: number): number {
  const m = Math.min(HINGE_MARGIN_MAX, Math.max(HINGE_MARGIN_MIN, (faceH - HINGE_X_TARGET) / 2));
  if (faceH - 2 * m < HINGE_X_PHYS) return Math.max(HINGE_MARGIN_ABS, (faceH - HINGE_X_PHYS) / 2);
  return m;
}

/** Toạ độ Y (từ ĐÁY cánh) tâm từng bản lề, chia đều. */
function hingeYOnDoor(faceH: number, count: number): number[] {
  if (count <= 1) return [faceH / 2];
  const margin = hingeEndMargin(faceH);
  const span = faceH - 2 * margin;
  return Array.from({ length: count }, (_, i) => margin + (span * i) / (count - 1));
}

/** Tạo 1 Part ván phẳng. edge?.banded → dán cạnh + edgeColor/edgeHex (post-pass đè lại). */
function panel(
  id: string,
  label: string,
  material: string,
  size: [number, number, number],
  position: [number, number, number],
  extra?: {
    notes?: string;
    holes?: PanelHole[];
    machining?: Machining[];
    hingeOnLeft?: boolean;
  },
): Part {
  const [length_mm, width_mm, thickness_mm] = [...size].sort((a, b) => b - a);
  return {
    id,
    label,
    material,
    size,
    position,
    length_mm,
    width_mm,
    thickness_mm,
    grain: resolveMaterial(material).grain === true ? 'length' : 'none',
    edgeBanding: { front: false, back: false, left: false, right: false },
    qty: 1,
    notes: extra?.notes,
    holes: extra?.holes,
    machining: extra?.machining,
    ...(extra?.hingeOnLeft !== undefined ? { hingeOnLeft: extra.hingeOnLeft } : {}),
  };
}

// =============================================================================
// PARAMETERS
// =============================================================================
/** Vài màu khung mặc định (P83.4 sẽ lấy từ catalog admin enabledFor 'tu-y'). */
const COLOR_OPTIONS: { value: string; label: string }[] = [
  { value: 'mfc_melamine/ml_trang_kem', label: 'MFC Trắng kem' },
  { value: 'mfc_melamine/ml_xanh_reu', label: 'MFC Xanh rêu' },
  { value: 'mdf_son/den', label: 'MDF Sơn đen' },
  { value: 'plywood_veneer/oak', label: 'Veneer Sồi' },
];

const parameters: Parameter[] = [
  // P85 — mode màu: chung (1 bộ cả tủ) / riêng (mỗi ô tự chọn khung·cánh·nẹp). UI custom trong YConfigurator.
  { id: 'colorMode', label: 'Chế độ màu', type: 'option', options: [{ value: 'chung', label: 'Màu chung' }, { value: 'rieng', label: 'Màu riêng từng ô' }], default: 'chung' },
  { id: 'color', label: 'Màu khung', type: 'option', options: COLOR_OPTIONS, default: 'mfc_melamine/ml_trang_kem' },
  {
    id: 'edgeBanding',
    label: 'Màu nẹp',
    type: 'option',
    options: EDGE_BAND_COLORS.map((c) => ({ value: c.id, label: c.label })),
    default: 'same',
  },
  {
    id: 'handleType',
    label: 'Loại tay nắm',
    type: 'option',
    adminOnly: true,
    options: [
      { value: 'bar', label: 'Thanh (bar)' },
      { value: 'strip', label: 'Nẹp âm (strip)' },
      { value: 'round', label: 'Tròn khoét Ø35' },
      { value: 'none', label: 'Không tay nắm' },
    ],
    default: 'bar',
  },
  // `modules` = JSON composition (YModule[]). 'info' → panel KHÔNG vẽ núm; thao tác
  // thêm/sửa module nằm trên 3D (YConfigurator, P83.3). Giá trị round-trip qua values.
  { id: 'modules', label: 'Bố cục module', type: 'info', default: '{"modules":[]}' }, // P97 — vẽ từ 0 (rỗng → nút "+")
];

// =============================================================================
// build()
// =============================================================================
// P92 — Cánh cần ≥2 ô MỖI chiều (≥36cm rộng VÀ cao). Ô có cạnh 18cm (gw=1 hoặc gh=1)
// quá nhỏ cho cánh + bản lề → cấm. (Founder: "ô 18x36 không được có cánh vì nhỏ quá".)
function doorAllowedY(m: { gw: number; gh: number }): boolean {
  return m.gw >= 2 && m.gh >= 2;
}
// P97 — NGĂN KÉO chỉ cho module ĐỨNG rộng 36cm (gw=2), cao ≥36cm: 36×36 (1 ngăn),
// 36×54 (2 ngăn), 36×72 (2-3 ngăn). Ngăn kéo xếp chồng theo chiều CAO.
function drawerAllowedY(m: { gw: number; gh: number }): boolean {
  return m.gw === 2 && m.gh >= 2;
}
// P97 — Số ngăn kéo theo chiều cao: 36→1, 54→2, 72→2 (mặc định); tối đa gh2→1/gh3→2/gh4→3.
function drawerCountY(m: YModule): number {
  const max = m.gh >= 4 ? 3 : m.gh >= 3 ? 2 : 1;
  const def = m.gh >= 3 ? 2 : 1;
  return Math.max(1, Math.min(max, m.drawers ?? def));
}
// P92/P97 — Thuộc tính HIỆU LỰC: cánh/ngăn kéo ở ô không hợp lệ → "Mở (có hậu)" (phòng dữ liệu cũ).
function effectiveAttrY(m: YModule): YModule['attribute'] {
  if (m.attribute === 'door' && !doorAllowedY(m)) return 'open-back';
  if (m.attribute === 'drawer' && !drawerAllowedY(m)) return 'open-back';
  return m.attribute;
}
// P92 — Port từ tủ x (singleDoorHandleSign): cánh ĐƠN → tay nắm phải(+1)/trái(-1).
// Ghép cặp dãy ô-cánh liền kề TỪ PHẢI: trong cặp, ô trái → tay nắm phải, ô phải → trái
// (2 tay nắm QUAY VÀO NHAU). Dãy lẻ → ô ngoài cùng bên TRÁI hướng vào (phải). Dãy 1 ô → +1.
function singleDoorHandleSign(col: number, columns: number): 1 | -1 {
  const hasLeftover = columns % 2 === 1;
  if (hasLeftover && col === 0) return 1;
  const offset = hasLeftover ? 1 : 0;
  return (col - offset) % 2 === 0 ? 1 : -1;
}

function build(params: ParamValues, opts?: BuildOptions): BuildResult {
  const spec = resolveMachiningSpec(opts?.priceConfig?.machiningSpec);
  const conn = spec.connector;
  const bf = spec.backFastener;
  const hp = spec.hingePlate;

  const frameMat = String(params.color ?? 'mfc_melamine/ml_trang_kem');
  const D = DEPTH;
  const backZ = -(D - T_BACK) / 2; // tâm Z tấm hậu (chìm 9mm ở mặt sau)
  // Dày thân T theo VẬT LIỆU TỪNG module (MCA An Cường→17, còn lại→18) — tính
  // trong vòng lặp vì mỗi module có thể chọn màu khung riêng (founder spec).

  const handleTypeVal = String(params.handleType ?? 'bar').trim();
  const handleKind: Handle =
    handleTypeVal === 'strip' ? 'strip' : handleTypeVal === 'round' ? 'round' : handleTypeVal === 'none' ? 'none' : 'bar';

  // Màu nẹp (option độc lập). Khung lộ cạnh (plywood) → ép 'same'.
  const frameExposed = resolveMaterial(frameMat).noEdgeBanding === true;
  const edgeType: EdgeBandingType = frameExposed
    ? 'same'
    : ((String(params.edgeBanding ?? 'same').trim() || 'same') as EdgeBandingType);

  // Nẹp per-ô: id ván THÂN/HẬU → loại nẹp của ô đó. Cánh KHÔNG vào map (luôn 'same').
  const edgeByPart = new Map<string, EdgeBandingType>();

  const comp = parseModules(params.modules);
  // P85 — Mode màu: 'rieng' = mỗi ô tự chọn khung/cánh/nẹp; 'chung' = 1 bộ áp cả tủ
  // (cánh=khung). colorMode tường minh THẮNG; nếu VẮNG mà data có màu per-ô (preset cũ
  // dùng "Màu ô riêng") → tự hiểu 'rieng' (giữ tương thích ngược). Build chỉ tôn trọng
  // m.color/doorColor/edgeColor khi perCell.
  const explicitMode = params.colorMode != null ? String(params.colorMode) : null;
  const perCell = explicitMode
    ? explicitMode === 'rieng'
    : comp.modules.some((m) => m.color || m.doorColor || m.edgeColor);

  // Bao ngoài THỰC của cụm module (TRỪ minGX/minGY) → size phủ bì + căn giữa ĐÚNG kể cả khi
  // module KHÔNG bắt đầu từ cột 0 / tầng 0 (vd dời/xoá ô bên trái). P88.6: trước dùng
  // spanGX*GRID (ngầm giả định bắt đầu từ 0) → minGX>0 thì size phồng to (vd 2160 thay 1440)
  // → lệch bbox OBJ → Blender VỨT cavities (sanity-check) → mất đồ trang trí. minGX=minGY=0
  // (preset bắt đầu từ gốc) → kết quả y HỆT cũ (totalW=spanGX*GRID, xOffset=-totalW/2).
  const minGX = comp.modules.length ? comp.modules.reduce((mn, m) => Math.min(mn, m.gx), Infinity) : 0; // P97 — rỗng → 0 (tránh NaN)
  const spanGX = comp.modules.reduce((mx, m) => Math.max(mx, m.gx + m.gw), 0);
  const minGY = comp.modules.length ? comp.modules.reduce((mn, m) => Math.min(mn, m.gy), Infinity) : 0;
  const spanGY = comp.modules.reduce((my, m) => Math.max(my, m.gy + m.gh), 0);
  const totalW = (spanGX - minGX) * GRID_MM;
  const totalH = (spanGY - minGY) * GRID_MM;
  const xOffset = -minGX * GRID_MM - totalW / 2; // module ở minGX → mép trái -totalW/2 (căn giữa extent thực)

  const parts: Part[] = [];
  const fittings: Fitting[] = [];
  const cavities: CellCavity[] = [];
  let doorCount = 0;
  let hinges = 0;
  let footSeq = 0;
  let slides = 0; // P97 — số cặp ray âm ngăn kéo
  let drawerFaces = 0; // P97 — số mặt ngăn kéo (đếm tay nắm)
  const rail = railForDepth(DEPTH); // P97 — tu-y sâu 360 → ray 300mm (433.03.002)

  // ---- Closure machining cánh (cup chén + lỗ tay nắm) — capture spec/T -------
  const frontFaceMachining = (
    doorSize: [number, number, number],
    doorPos: [number, number, number],
    faceH: number,
    faceW: number,
    hingeSign: 1 | -1,
    handleHoles: PanelHole[],
    ys: number[],
  ): Machining[] => {
    const tDoor = doorSize[2]; // dày cánh = T của module (đọc từ size, không capture)
    const out: Machining[] = [];
    for (const hole of handleHoles) {
      const sc = panelCoord(doorSize, doorPos, [doorPos[0] + hole.dx, doorPos[1] + hole.dy, doorPos[2]]);
      out.push(drill('handle', 'front', sc.x_mm, sc.y_mm, hole.r * 2, tDoor, tDoor));
    }
    const hc = spec.hingeCup;
    const xCupScene = doorPos[0] + hingeSign * (-faceW / 2 + hc.cupInsetFromEdge);
    const xScrewScene = xCupScene + hingeSign * hc.cupScrewBackset;
    for (const yd of ys) {
      const yScene = doorPos[1] - faceH / 2 + yd;
      const cup = panelCoord(doorSize, doorPos, [xCupScene, yScene, doorPos[2]]);
      out.push(pocket('hinge', 'back', cup.x_mm, cup.y_mm, hc.cupDia, hc.cupDepth));
      for (const dy of [-hc.cupScrewOffset, hc.cupScrewOffset]) {
        const sc = panelCoord(doorSize, doorPos, [xScrewScene, yScene + dy, doorPos[2]]);
        out.push(drill('hinge', 'back', sc.x_mm, sc.y_mm, hc.cupScrewDia, hc.cupScrewDepth, tDoor));
      }
    }
    return out;
  };

  // ---- Closure tay nắm (đồng bộ x) ------------------------------------------
  const barLenFor = (w: number): number => Math.min(BAR_LEN, w - 60);
  const barDx = (w: number, sign: number): number =>
    sign === 0 ? 0 : sign * Math.max(0, w / 2 - barLenFor(w) / 2 - BAR_EDGE_MARGIN);
  const barScrewHoles = (w: number, fH: number, sign: number, lowHandle: boolean): PanelHole[] => {
    const len = barLenFor(w);
    const r = (spec.handle.barScrewDia ?? 4) / 2;
    const dy = lowHandle ? BAR_INSET - fH / 2 : fH / 2 - BAR_INSET;
    const cx = barDx(w, sign);
    const sx = Math.max(20, Math.min((spec.handle.barSpacing ?? 64) / 2, len / 2 - 12));
    return [
      { dx: cx - sx, dy, r },
      { dx: cx + sx, dy, r },
    ];
  };
  const makeBarHandle = (
    id: string,
    doorPos: [number, number, number],
    doorSize: [number, number, number],
    sign: number,
    lowHandle: boolean,
  ): Fitting[] => {
    const [w, fH, t] = doorSize;
    const length = barLenFor(w);
    const yEdge = lowHandle ? -fH / 2 : fH / 2;
    const ySign = lowHandle ? -1 : 1;
    const yLine = doorPos[1] + yEdge - ySign * BAR_INSET;
    const faceZ = doorPos[2] + t / 2;
    const xC = doorPos[0] + barDx(w, sign);
    return [
      {
        id: `${id}-arm`,
        kind: 'handle-bar',
        size: [length, BAR_ARM_THICK, BAR_ARM_DEPTH],
        position: [xC, yLine, faceZ + BAR_ARM_DEPTH / 2],
        color: '#1a1a1a',
      },
      {
        id: `${id}-lip`,
        kind: 'handle-bar',
        size: [length, BAR_LIP_HEIGHT, BAR_LIP_THICK],
        position: [xC, yLine - BAR_LIP_HEIGHT / 2, faceZ + BAR_ARM_DEPTH - BAR_LIP_THICK / 2],
        color: '#1a1a1a',
      },
    ];
  };
  const makeStripHandle = (
    id: string,
    doorPos: [number, number, number],
    doorSize: [number, number, number],
    lowHandle: boolean,
    handleSign: 1 | -1,
  ): Fitting[] => {
    const [w, fH, t] = doorSize;
    const length = Math.max(80, Math.min(160, w * 0.35));
    const xOff = handleSign * (w / 2 - length / 2 - STRIP_HANDLE_INSET);
    const yEdge = lowHandle ? -fH / 2 : fH / 2;
    const ySign = lowHandle ? -1 : 1;
    return [
      {
        id: `${id}-top`,
        kind: 'handle-strip',
        size: [length, STRIP_TOP_THICKNESS, STRIP_TOP_DEPTH],
        position: [doorPos[0] + xOff, doorPos[1] + yEdge + ySign * (STRIP_TOP_THICKNESS / 2), doorPos[2] + t / 2 + STRIP_TOP_DEPTH / 2],
        color: '#1a1a1a',
      },
      {
        id: `${id}-belly`,
        kind: 'handle-strip',
        size: [length, STRIP_BELLY_HEIGHT, STRIP_BELLY_DEPTH],
        position: [
          doorPos[0] + xOff,
          doorPos[1] + yEdge - ySign * (STRIP_BELLY_HEIGHT / 2),
          doorPos[2] + t / 2 + STRIP_TOP_DEPTH - STRIP_BELLY_DEPTH / 2,
        ],
        color: '#1a1a1a',
      },
    ];
  };

  // ---- Closure PAT slots cho connector 2-in-1 (đồng bộ x patSlots) ----------
  const patSlots = (
    hostSize: [number, number, number],
    hostPos: [number, number, number],
    side: MachiningSide,
    scene: [number, number, number],
  ): Machining[] => {
    const { x_mm, y_mm } = panelCoord(hostSize, hostPos, scene);
    const along: 'length' | 'width' = lengthAxisOf(hostSize) === 2 ? 'length' : 'width';
    return [
      slot('connector', side, x_mm, y_mm, conn.slotLength, conn.slotWidth, conn.rimDepth, along),
      slot('connector', side, x_mm, y_mm, conn.channelLength, conn.channelWidth, conn.channelDepth, along),
    ];
  };

  // ===========================================================================
  // P92 — TAY NẮM "QUAY VÀO NHAU" (port logic tủ x): tính sign cho từng ô-cánh ĐƠN.
  // Gom các ô-cánh đơn HỢP LỆ cùng hàng (gy,gh) thành dãy liền kề theo gx, ghép cặp
  // từ phải (singleDoorHandleSign) → tay nắm 2 ô cạnh nhau quay vào nhau. Cánh đôi
  // (gw=4, innerW>600) tự quay vào giữa nên KHÔNG nằm trong dãy. Ô-cánh đơn đứng một
  // mình → +1 (giữ như cũ). sign điều khiển: tay nắm, hướng bản lề, bát bản lề.
  // ===========================================================================
  const matForY = (m: YModule) => (perCell && m.color && m.color !== 'frame' ? m.color : frameMat);
  const isSingleLeafDoorY = (m: YModule): boolean => {
    if (effectiveAttrY(m) !== 'door') return false; // chỉ cánh hợp lệ (đã loại ô quá nhỏ)
    const innerW = m.gw * GRID_MM - 2 * bodyTFor(matForY(m));
    return innerW <= WIDE_CELL; // ≤600 = 1 lá (gw 2-3); >600 = cánh đôi (gw=4) → bỏ qua
  };
  const handleSignById = new Map<string, 1 | -1>();
  {
    const byBand = new Map<string, YModule[]>();
    for (const m of comp.modules.filter(isSingleLeafDoorY)) {
      const k = `${m.gy}:${m.gh}`;
      const arr = byBand.get(k);
      if (arr) arr.push(m); else byBand.set(k, [m]);
    }
    for (const band of byBand.values()) {
      band.sort((a, b) => a.gx - b.gx);
      let run: YModule[] = [];
      const flush = () => {
        run.forEach((m, i) => handleSignById.set(m.id, singleDoorHandleSign(i, run.length)));
        run = [];
      };
      for (const m of band) {
        const prev = run[run.length - 1];
        if (prev && prev.gx + prev.gw === m.gx) run.push(m); // chạm cạnh → cùng dãy
        else { flush(); run = [m]; }
      }
      flush();
    }
  }

  // ===========================================================================
  // VÒNG LẶP MODULE
  // ===========================================================================
  for (const m of comp.modules) {
    // P85 — màu KHUNG (thân) + CÁNH + NẸP của ô. perCell=false → ăn màu mặc định (khung chung).
    const mat = perCell && m.color && m.color !== 'frame' ? m.color : frameMat;
    const doorMat = perCell && m.doorColor && m.doorColor !== 'frame' ? m.doorColor : mat; // cánh: vắng → theo khung ô
    const mEdge: EdgeBandingType =
      perCell && m.edgeColor && !resolveMaterial(mat).noEdgeBanding
        ? (m.edgeColor as EdgeBandingType)
        : edgeType; // nẹp ô (vắng/lộ-cạnh → nẹp chung)
    const T = bodyTFor(mat); // dày thân theo vật liệu module (MCA→17, else 18)
    const frontZ = D / 2 - T / 2; // tâm Z mặt cánh (mặt trước flush)
    const W = m.gw * GRID_MM;
    const H = m.gh * GRID_MM;
    const x0 = m.gx * GRID_MM + xOffset; // mép trái ngoài (KHÔNG dời — module chạm nhau)
    const y0 = (m.gy - minGY) * GRID_MM; // mép dưới ngoài (chưa +FOOT_H); trừ minGY → đáy cụm chạm sàn
    const cx = x0 + W / 2;
    const cyBox = y0 + H / 2;
    const innerW = W - 2 * T;
    const innerH = H - 2 * T;
    // P92 — attr HIỆU LỰC: cánh ở ô quá nhỏ (cạnh 18cm) → render như "Mở (có hậu)".
    // Mọi nhánh dưới (tấm hậu, cánh, hốc decor) đọc `attr` này → nhất quán.
    const attr = effectiveAttrY(m);
    const idp = m.id; // an toàn cho id Part
    // P85 — gắn nẹp ô cho ván THÂN + HẬU (cánh KHÔNG set → post-pass giữ 'same').
    // back-id set vô điều kiện cũng vô hại (post-pass chỉ tra part thực sự tồn tại).
    for (const pid of [`m${idp}-left`, `m${idp}-right`, `m${idp}-top`, `m${idp}-bottom`, `back-m${idp}`]) {
      edgeByPart.set(pid, mEdge);
    }

    // --- Geometry locals + machining arrays ---
    // Kết cấu GIỐNG TỦ X: ván NGANG (nóc/đáy) chạy FULL rộng ô [W,T,D]; 2 vách
    // đứng LỌT GIỮA nóc/đáy → cao = innerH (kẹp giữa, tâm vẫn cyBox). Nhờ nóc/đáy
    // full rộng, chân tủ & connector (đặt ở X = tâm vách x0+T/2) rơi đúng vào tấm.
    const sideSize: [number, number, number] = [T, innerH, D];
    const leftPos: [number, number, number] = [x0 + T / 2, cyBox, 0];
    const rightPos: [number, number, number] = [x0 + W - T / 2, cyBox, 0];
    const horizSize: [number, number, number] = [W, T, D];
    const topPos: [number, number, number] = [cx, y0 + H - T / 2, 0];
    const botPos: [number, number, number] = [cx, y0 + T / 2, 0];
    const leftMach: Machining[] = [];
    const rightMach: Machining[] = [];
    const topMach: Machining[] = [];
    const botMach: Machining[] = [];

    // --- (1) Tấm HẬU (open-back / door) ---
    const hasBack = attr === 'open-back' || attr === 'door' || attr === 'drawer';
    let backMach: Machining[] | null = null;
    if (hasBack) {
      backMach = [];
      // door che hậu → màu khung (giấu); open-back → màu module (khách thấy).
      const backMat = attr === 'door' || attr === 'drawer' ? frameMat : mat;
      parts.push(
        panel(`back-m${idp}`, 'Tấm lưng', backMat, [innerW, innerH, T_BACK], [cx, cyBox, backZ], {
          machining: backMach,
        }),
      );
    }

    // --- (2) Connector 2-in-1 ở 4 GÓC hộp (vách↔nóc, vách↔đáy) ---
    // edge_drill trên cạnh trên/dưới của vách + 2 PAT slot trên mặt nóc/đáy.
    const zPositions = [D - conn.insetFromFront, conn.insetFromBack]; // dọc sâu (0..D)
    const emitCorner = (sidePos: [number, number, number], sideMach: Machining[], whichEnd: 'top' | 'bottom') => {
      const lAxis = lengthAxisOf(sideSize); // 1 nếu H≥D, else 2
      const sideEdge: 'top' | 'bottom' | 'left' | 'right' =
        lAxis === 1 ? (whichEnd === 'top' ? 'top' : 'bottom') : whichEnd === 'top' ? 'right' : 'left';
      const horizPos = whichEnd === 'top' ? topPos : botPos;
      const horizMach = whichEnd === 'top' ? topMach : botMach;
      const horizFace: MachiningSide = whichEnd === 'top' ? 'back' : 'front'; // mặt nóc úp xuống / mặt đáy ngửa lên
      for (const zp of zPositions) {
        sideMach.push({
          op: 'edge_drill',
          purpose: 'connector',
          edge: sideEdge,
          position_mm: r1(zp),
          depth_mm: conn.pinHoleDepth,
          diameter_mm: conn.pinHoleDia,
          thicknessOffset_mm: T / 2,
        });
        const zScene = zp - D / 2;
        horizMach.push(...patSlots(horizSize, horizPos, horizFace, [sidePos[0], horizPos[1], zScene]));
      }
    };
    emitCorner(leftPos, leftMach, 'top');
    emitCorner(leftPos, leftMach, 'bottom');
    emitCorner(rightPos, rightMach, 'top');
    emitCorner(rightPos, rightMach, 'bottom');

    // --- (3) Chốt lò xo TẤM HẬU (pin cạnh trên/dưới hậu + lỗ đón trên nóc/đáy) ---
    if (backMach) {
      const nPins = Math.max(1, bf.pinsPerEdge);
      const span = innerW - 2 * bf.marginFromCellEdge;
      const pinXs: number[] = [];
      for (let i = 0; i < nPins; i++) {
        pinXs.push(nPins === 1 || span <= 0 ? cx : cx - span / 2 + (span * i) / (nPins - 1));
      }
      for (const end of ['down', 'up'] as const) {
        const horizPos = end === 'down' ? botPos : topPos;
        const horizMach = end === 'down' ? botMach : topMach;
        const horizFace: MachiningSide = end === 'down' ? 'front' : 'back';
        const edge: 'top' | 'bottom' | 'left' | 'right' =
          innerW >= innerH ? (end === 'down' ? 'bottom' : 'top') : end === 'down' ? 'left' : 'right';
        for (const px of pinXs) {
          backMach.push({
            op: 'edge_drill',
            purpose: 'backScrew',
            edge,
            position_mm: r1(px - (cx - innerW / 2)),
            depth_mm: bf.pinHoleDepth,
            diameter_mm: bf.pinDia,
            thicknessOffset_mm: T_BACK / 2,
          });
          const fc = panelCoord(horizSize, horizPos, [px, horizPos[1], backZ]);
          horizMach.push(drill('backScrew', horizFace, fc.x_mm, fc.y_mm, bf.faceHoleDia, bf.faceHoleDepth, T));
        }
      }
    }

    // --- (4) CÁNH (door) — 1 lá nếu lòng ≤600, 2 lá nếu rộng hơn ---
    if (attr === 'door') {
      const moduleTopFromFloor = y0 + H + FOOT_H;
      const lowHandle = moduleTopFromFloor > LOW_HANDLE_FROM_GROUND;

      // 1 lá cánh: tạo Part + cup chén + tay nắm + khoan BÁT lên vách bên bản lề.
      const addLeaf = (
        suffix: string,
        leafCx: number,
        faceW: number,
        faceH: number,
        sign: 1 | -1,
      ) => {
        const ys = hingeYOnDoor(faceH, hingeCount(faceH));
        // Lỗ tay nắm.
        let holes: PanelHole[] = [];
        const roundHoles: PanelHole[] = [];
        if (handleKind === 'round') {
          const hr = (spec.handle.recessedDia ?? 35) / 2;
          const hin = spec.handle.recessedInsetFromEdge ?? 40;
          const holeDy = lowHandle ? hin - faceH / 2 : faceH / 2 - hin;
          const rh: PanelHole = { dx: sign * (faceW / 2 - hin), dy: holeDy, r: hr };
          holes = [rh];
          roundHoles.push(rh);
        } else if (handleKind === 'bar') {
          holes = barScrewHoles(faceW, faceH, sign, lowHandle);
        }
        const doorSize: [number, number, number] = [faceW, faceH, T];
        const doorPos: [number, number, number] = [leafCx, cyBox, frontZ];
        const vWord = lowHandle ? 'dưới' : 'trên';
        parts.push(
          panel(`door-m${idp}-${suffix}`, 'Cánh tủ', doorMat, doorSize, doorPos, {
            notes: `${ys.length} bản lề mép ${sign > 0 ? 'trái' : 'phải'} · tay nắm ${vWord}`,
            holes: roundHoles.length ? roundHoles : undefined,
            machining: frontFaceMachining(doorSize, doorPos, faceH, faceW, sign, holes, ys),
            hingeOnLeft: sign > 0,
          }),
        );
        doorCount += 1;
        hinges += ys.length;
        if (handleKind === 'bar') fittings.push(...makeBarHandle(`hbar-m${idp}-${suffix}`, doorPos, doorSize, sign, lowHandle));
        else if (handleKind === 'strip')
          fittings.push(...makeStripHandle(`hstrip-m${idp}-${suffix}`, doorPos, doorSize, lowHandle, sign > 0 ? 1 : -1));

        // BÁT bản lề lên mặt trong VÁCH bên bản lề — Y khớp ys (cup↔plate bất biến).
        const sideMach = sign > 0 ? leftMach : rightMach;
        const sidePos = sign > 0 ? leftPos : rightPos;
        const plateSide: MachiningSide = sign > 0 ? 'front' : 'back';
        const zPlate = D / 2 - hp.plateInsetFromEdge;
        for (const yd of ys) {
          const yScene = cyBox - faceH / 2 + yd;
          for (const dy of [-hp.plateScrewSpan / 2, hp.plateScrewSpan / 2]) {
            const pc = panelCoord(sideSize, sidePos, [sidePos[0], yScene + dy, zPlate]);
            sideMach.push(drill('hinge', plateSide, pc.x_mm, pc.y_mm, hp.plateScrewDia, hp.plateScrewDepth, T));
          }
        }
      };

      // P97 — số cánh: override m.doorLeaves (cho 54×36 chọn đơn/đôi), vắng → suy theo bề rộng.
      const leaves = m.doorLeaves ?? (innerW <= WIDE_CELL ? 1 : 2);
      if (leaves === 1) {
        // P92 — sign theo bản đồ "quay vào nhau" (ô-cánh liền kề); đứng một mình → +1.
        addLeaf('a', cx, innerW - FRONT_GAP, innerH - FRONT_GAP, handleSignById.get(m.id) ?? 1);
      } else {
        // 2 cánh: khe ngoài + khe giữa = FRONT_GAP; lá trái bản lề trái, lá phải bản lề phải.
        const leafW = (innerW - 3 * FRONT_GAP) / 2;
        const faceH = innerH - FRONT_GAP;
        const leftLeafCx = x0 + T + FRONT_GAP + leafW / 2;
        const rightLeafCx = x0 + W - T - FRONT_GAP - leafW / 2;
        addLeaf('a', leftLeafCx, leafW, faceH, 1);
        addLeaf('b', rightLeafCx, leafW, faceH, -1);
      }
    }

    // --- (4b) NGĂN KÉO (drawer, P97) — chia chiều CAO innerH thành N ngăn ĐỀU; mỗi ngăn =
    // 1 mặt ngăn kéo (false front, màu CÁNH) + thùng hộc 4 ván (màu KHUNG) + 1 cặp ray âm
    // 300mm. Cấu trúc + phụ kiện PORT NGUYÊN từ tủ x (P76). Vít mồi ray khoan thẳng lên
    // 2 vách bên (leftMach/rightMach) tại đáy mỗi ngăn — không cần post-pass (biết hình trực tiếp).
    if (attr === 'drawer' && rail) {
      const n = drawerCountY(m);
      const ds = spec.drawerSlide;
      const slotH = innerH / n;
      const moduleTopFromFloor = y0 + H + FOOT_H;
      const lowHandle = moduleTopFromFloor > LOW_HANDLE_FROM_GROUND;
      const TD_WALL = T; // thành hộc = ván thân
      const TD_BOT = T_BACK; // đáy hộc = ván 9
      const bw = innerW - ds.boxInnerWidthOffset + 2 * TD_WALL; // ngoài thùng (bản vẽ: lòng = lòng tủ − 42)
      const bd = rail.len; // sâu thùng = chiều dài ray
      const bFront = frontZ - T / 2; // mặt trước thùng sát mặt sau false front
      const bBack = bFront - bd;
      const bzC = (bFront + bBack) / 2;
      const sideX = (bw - TD_WALL) / 2;
      const bkW = bw - 2 * TD_WALL;
      const zRayFront = bFront - ds.railSetbackFromFront;
      const zOffs = railClustersFor(rail.len).map((c) => ds.railFirstScrewFromFront + c);
      const railScrew = (wallPos: [number, number, number], wallMach: Machining[], wside: MachiningSide, floorY: number) => {
        const rowYs = [floorY + ds.railScrewRowFromCellBottom, floorY + ds.railScrewRowFromCellBottom + ds.railScrewRowSpacing];
        for (const off of zOffs)
          for (const railY of rowYs) {
            const pc = panelCoord(sideSize, wallPos, [wallPos[0], railY, zRayFront - off]);
            wallMach.push(drill('drawerSlide', wside, pc.x_mm, pc.y_mm, ds.railScrewPilotDia, ds.railScrewPilotDepth, T));
          }
      };
      for (let i = 0; i < n; i++) {
        const sfx = `${idp}-d${i}`;
        const slotBottomY = y0 + T + i * slotH; // đáy ngăn i (mặt trong đáy module + i tầng)
        const yC = slotBottomY + slotH / 2;
        const faceH = slotH - FRONT_GAP;
        const faceW = innerW - FRONT_GAP;
        const bh = faceH - 20; // cao thành hộc (khe nhấc hộc ray âm)
        // Mặt ngăn kéo (false front) — màu CÁNH, tay nắm CĂN GIỮA + 4 vít M4 mặt sau vào hông hộc.
        let holes: PanelHole[] = [];
        const roundHoles: PanelHole[] = [];
        if (handleKind === 'round') {
          const hr = (spec.handle.recessedDia ?? 35) / 2;
          const hin = spec.handle.recessedInsetFromEdge ?? 40;
          const rh: PanelHole = { dx: 0, dy: lowHandle ? hin - faceH / 2 : faceH / 2 - hin, r: hr };
          holes = [rh];
          roundHoles.push(rh);
        } else if (handleKind === 'bar') {
          holes = barScrewHoles(faceW, faceH, 0, lowHandle);
        }
        const faceSize: [number, number, number] = [faceW, faceH, T];
        const facePos: [number, number, number] = [cx, yC, frontZ];
        const ffMach = frontFaceMachining(faceSize, facePos, faceH, faceW, 1, holes, []); // ys=[] → KHÔNG cup (ngăn kéo)
        const ffMargin = Math.min(80, faceH / 2 - 10, faceW / 2 - 10);
        for (const sx of [-sideX, sideX])
          for (const sy of [yC + faceH / 2 - ffMargin, yC - faceH / 2 + ffMargin]) {
            const sc = panelCoord(faceSize, facePos, [cx + sx, sy, frontZ]);
            ffMach.push(drill('drawerSlide', 'back', sc.x_mm, sc.y_mm, ds.screwDia, ds.screwDepth, T));
          }
        parts.push(
          panel(`drawer-${sfx}`, 'Mặt ngăn kéo', doorMat, faceSize, facePos, {
            notes: `Thùng hộc ${Math.round(bw)}×${Math.round(bh)}×${Math.round(bd)}mm · Ray âm ${rail.len}mm (Hafele ${rail.sku}) · 4 vít M${ds.screwDia} mặt sau vào hông hộc`,
            holes: roundHoles.length ? roundHoles : undefined,
            machining: ffMach,
          }),
        );
        // Thùng hộc: 2 hông + hậu (2 lỗ Ø6 chốt đuôi ray) + đáy — màu KHUNG (mat).
        const boxNote = `P97 thùng hộc ray âm: thành ván thân ${TD_WALL}mm, đáy ${TD_BOT}mm, sâu = ray ${rail.len}mm (${rail.sku}).`;
        parts.push(panel(`drawerL-${sfx}`, 'Hông hộc', mat, [TD_WALL, bh, bd], [cx - sideX, yC, bzC], { notes: boxNote }));
        parts.push(panel(`drawerR-${sfx}`, 'Hông hộc', mat, [TD_WALL, bh, bd], [cx + sideX, yC, bzC], { notes: boxNote }));
        const bkSize: [number, number, number] = [bkW, bh, TD_WALL];
        const bkPos: [number, number, number] = [cx, yC, bBack + TD_WALL / 2];
        const bkMach: Machining[] = [];
        for (const sx of [-1, 1]) {
          const pc = panelCoord(bkSize, bkPos, [cx + sx * (bkW / 2 - ds.backPinFromSideEdge), yC - bh / 2 + ds.backPinFromBottom, bkPos[2]]);
          bkMach.push(drill('drawerRailPin', 'back', pc.x_mm, pc.y_mm, ds.backPinHoleDia, ds.backPinHoleDepth, TD_WALL));
        }
        parts.push(panel(`drawerBk-${sfx}`, 'Hậu hộc', mat, bkSize, bkPos, { notes: boxNote, machining: bkMach }));
        parts.push(
          panel(`drawerBot-${sfx}`, 'Đáy hộc', mat, [bkW, TD_BOT, bd - TD_WALL], [cx, yC - bh / 2 + TD_BOT / 2, bzC + TD_WALL / 2], { notes: boxNote }),
        );
        // Vít mồi thân ray trên 2 vách bên (đáy ô = slotBottomY).
        railScrew(leftPos, leftMach, 'front', slotBottomY);
        railScrew(rightPos, rightMach, 'back', slotBottomY);
        // Tay nắm (căn giữa — ngăn kéo không bản lề).
        if (handleKind === 'bar') fittings.push(...makeBarHandle(`hbar-d-${sfx}`, facePos, faceSize, 0, lowHandle));
        else if (handleKind === 'strip') fittings.push(...makeStripHandle(`hstrip-d-${sfx}`, facePos, faceSize, lowHandle, 1));
        slides += 1;
        drawerFaces += 1;
      }
    }

    // --- (5) CHÂN tủ cho module TỰA SÀN (gy=0): lỗ Ø8 mặt dưới đáy + fitting ---
    if (m.gy === minGY) {
      const footInset = Math.max(FOOT_INSET_SAFE, spec.foot.insetFromEdge ?? 90);
      const footZcenter = D / 2 - footInset;
      const footZs = (spec.foot.positionsPerDivider ?? 2) <= 1 ? [0] : [footZcenter, -footZcenter];
      const footXs = [x0 + T / 2, x0 + W - T / 2]; // dưới 2 vách
      for (const fx of footXs) {
        for (const fz of footZs) {
          fittings.push({
            id: `foot-m${idp}-${footSeq++}`,
            kind: 'foot',
            size: [FOOT_DIA, FOOT_H, FOOT_DIA],
            position: [fx, FOOT_H / 2, fz],
          });
          const fc = panelCoord(horizSize, botPos, [fx, botPos[1], fz]);
          botMach.push(drill('foot', 'back', fc.x_mm, fc.y_mm, spec.foot.pinDia, spec.foot.pinDepth, T));
        }
      }
    }

    // --- (6) CAVITY (ô mở) cho thumbnail props — KHÔNG cho door/drawer (ô kín) ---
    if (attr !== 'door' && attr !== 'drawer') {
      cavities.push({
        // col/row = góc dưới-trái lưới (DUY NHẤT mỗi module vì không chồng) → StagingProps
        // có key + seed riêng từng ô (trước để 0,0 → trùng key React → chỉ 1 đồ render).
        col: m.gx,
        row: m.gy,
        type: attr === 'open-back' ? 'open-back' : 'open-nobk',
        cx,
        floorY: y0 + T + FOOT_H,
        cz: 0,
        w: innerW - FRONT_GAP,
        h: innerH - FRONT_GAP,
        d: D - (attr === 'open-back' ? T_BACK : 0),
      });
    }

    // --- (7) Tạo 4 ván carcass (sau khi đã gắn machining) ---
    parts.push(panel(`m${idp}-left`, 'Vách trái', mat, sideSize, leftPos, { machining: leftMach }));
    parts.push(panel(`m${idp}-right`, 'Vách phải', mat, sideSize, rightPos, { machining: rightMach }));
    parts.push(panel(`m${idp}-top`, 'Nóc', mat, horizSize, topPos, { machining: topMach }));
    parts.push(panel(`m${idp}-bottom`, 'Đáy', mat, horizSize, botPos, { machining: botMach }));
  }

  // ===========================================================================
  // POST-PASS
  // ===========================================================================
  // Nhấc cả tủ lên FOOT_H (chân nằm giữa sàn y=0 và đáy). MỌI tay nắm (strip+bar)
  // gắn theo cánh → nhấc cùng tủ; CHỈ chân tủ KHÔNG nhấc (nằm dưới sàn).
  // (x chỉ nhấc handle-strip — bug tiềm ẩn 5mm cho bar; tu-y làm đúng cả hai.)
  for (const p of parts) {
    p.position[1] += FOOT_H;
    // Vát góc ván THÂN (vách/nóc/đáy/hậu) — render-only, tách-nhìn các module.
    // Cánh KHÔNG vát (có lỗ tay nắm/cup → đi nhánh khoét; vát ở đây không áp).
    if (!p.id.startsWith('door-') && !p.id.startsWith('drawer')) p.chamfer_mm = CHAMFER_MM;
  }
  for (const f of fittings) if (f.kind !== 'foot') f.position[1] += FOOT_H;

  // ---- Gom HARDWARE từ machining đã phát (đồng bộ x) -------------------------
  const hardware: Hardware[] = [];
  let connectorSets = 0;
  let backPinCount = 0;
  for (const p of parts) {
    for (const mc of p.machining ?? []) {
      if (mc.op !== 'edge_drill') continue;
      if (mc.purpose === 'connector') connectorSets += 1;
      else if (mc.purpose === 'backScrew') backPinCount += 1;
    }
  }
  if (hinges > 0) hardware.push({ id: 'hinge', label: 'Bản lề giảm chấn (Hafele)', qty: hinges });
  if (connectorSets > 0) {
    hardware.push({
      id: 'connector_2in1',
      label: 'Connector 2-in-1 (chốt Ø8×30 + PAT)',
      qty: connectorSets,
      notes: `${conn.perJoint} bộ mỗi góc vách↔nóc/đáy (tâm cách mép trước/sau ${conn.insetFromFront}/${conn.insetFromBack}mm).`,
    });
  }
  if (backPinCount > 0) {
    hardware.push({
      id: 'back_clip',
      label: `Chốt lò xo tấm hậu Ø${bf.pinDia}×${bf.pinHoleDepth}`,
      qty: backPinCount,
      notes: `${bf.pinsPerEdge} chốt mỗi cạnh trên/dưới tấm hậu, cắm vào lỗ đón Ø${bf.faceHoleDia} trên nóc/đáy.`,
    });
  }
  if (slides > 0 && rail) {
    hardware.push({
      id: rail.hwId,
      label: `Ray âm Hafele ${rail.len}mm (${rail.sku})`,
      qty: slides,
      notes: '1 cặp/ngăn kéo · ngăn kéo tủ Y sâu 360 → ray 300mm.',
    });
  }
  const handleQty = doorCount + drawerFaces; // P97 — tay nắm: cánh + mặt ngăn kéo
  if (handleQty > 0 && handleKind !== 'none') {
    if (handleKind === 'strip')
      hardware.push({ id: 'handle_strip_black', label: 'Tay nắm strip đen (Nam Khang)', qty: handleQty });
    else if (handleKind === 'bar') hardware.push({ id: 'handle_bar', label: 'Tay nắm bar đen (profile L)', qty: handleQty });
    else hardware.push({ id: 'handle', label: 'Tay nắm tròn (khoét Ø35)', qty: handleQty });
  }
  const footCount = fittings.filter((f) => f.kind === 'foot').length;
  if (footCount > 0) {
    hardware.push({
      id: 'foot',
      label: 'Chân tủ (nút mỏng)',
      qty: footCount,
      notes: 'Bắt vào mặt dưới đáy mỗi module tựa sàn.',
    });
  }
  // [xưởng xác nhận] — chốt liên kết GIỮA các module ("chốt sau lưng"): spec CHƯA
  // chốt → KHÔNG phát machining; chỉ 1 dòng BOM placeholder theo số cạnh chung
  // (giá tạm dùng fallback engine 20k/cái, admin chỉnh sau). Đếm cặp module kề cạnh.
  // TODO(P83.5): khi founder/xưởng chốt loại chốt → phát edge_drill/slot tại đây +
  //   thay 'module_link_tbd' bằng HardwareId thật (admin catalog định giá).
  const mods = comp.modules;
  let moduleLinks = 0;
  for (let i = 0; i < mods.length; i++) {
    for (let j = i + 1; j < mods.length; j++) {
      if (modulesAdjacent(mods[i], mods[j])) moduleLinks += 1;
    }
  }
  if (moduleLinks > 0) {
    hardware.push({
      id: 'module_link_tbd',
      label: '[xưởng xác nhận] Chốt liên kết module (chốt sau lưng)',
      qty: moduleLinks,
      notes: 'Spec/loại/số lượng CHƯA chốt — chờ xác nhận xưởng. Số lượng = số cạnh chung giữa các module (tạm tính).',
    });
  }

  // ---- Dán cạnh (P49 — đồng bộ x): cánh LUÔN 'same'; còn lại edgeType khách chọn;
  //      vật liệu lộ cạnh (plywood noEdgeBanding) → KHÔNG dán. ------------------
  const edgedParts: Part[] = parts.map((p) => {
    const ap = resolveMaterial(p.material);
    if (ap.noEdgeBanding === true) {
      return { ...p, edgeColor: undefined, edgeHex: undefined, edgeBanding: { front: false, back: false, left: false, right: false } };
    }
    const isDoor = p.id.startsWith('door-');
    // P85 — cánh luôn 'same' (viền đồng màu); thân/hậu lấy nẹp PER-Ô (edgeByPart) → vắng = nẹp chung.
    const type: EdgeBandingType = isDoor ? 'same' : (edgeByPart.get(p.id) ?? edgeType);
    return {
      ...p,
      edgeColor: type,
      edgeHex: edgeHexForBand(ap.hex, type),
      edgeBanding: { front: true, back: true, left: true, right: true },
    };
  });

  // P84 — đếm module theo (cỡ-ô × loại-ô) cho giá: VỪA là cờ "tủ y" cho computePrice,
  // VỪA là đầu vào nhân công theo loại ô. Khoá `${cells}-${attribute}` (cells=gw*gh
  // ∈ {2,4,6,8} bất biến khi quay ↔ 18/36/54/72cm).
  const moduleCounts: Record<string, number> = {};
  for (const m of comp.modules) {
    const k = `${m.gw * m.gh}-${effectiveAttrY(m)}`; // P92 — cánh ô quá nhỏ đếm như open-back
    moduleCounts[k] = (moduleCounts[k] ?? 0) + 1;
  }

  return {
    parts: edgedParts,
    hardware,
    fittings,
    size: { w: totalW, h: totalH, d: D },
    doorCount,
    cavities,
    moduleCounts,
  };
}

/** 2 module kề cạnh (chung 1 đoạn biên >0) trên lưới? — cho placeholder liên kết. */
function modulesAdjacent(a: YModule, b: YModule): boolean {
  const ax2 = a.gx + a.gw;
  const ay2 = a.gy + a.gh;
  const bx2 = b.gx + b.gw;
  const by2 = b.gy + b.gh;
  const yOverlap = Math.min(ay2, by2) - Math.max(a.gy, b.gy);
  const xOverlap = Math.min(ax2, bx2) - Math.max(a.gx, b.gx);
  const vTouch = (ax2 === b.gx || bx2 === a.gx) && yOverlap > 0;
  const hTouch = (ay2 === b.gy || by2 === a.gy) && xOverlap > 0;
  return vTouch || hTouch;
}

/** Cảnh báo cấu hình (UI hiện; KHÔNG chặn build). Module "bay" (không tựa) + liên kết TBD. */
function getWarnings(values: ParamValues): string[] {
  const comp: YComposition = parseModules(values.modules);
  const out: string[] = [];
  for (const id of findFloating(comp)) {
    out.push(`Ô ${id} đang "bay" (không có ô/sàn đỡ bên dưới) — cần thêm đỡ.`);
  }
  if (comp.modules.length >= 2) {
    out.push('Liên kết giữa các module (chốt sau lưng): loại/số lượng chờ xưởng xác nhận.');
  }
  return out;
}

const tuY: ProductDNA = {
  slug: 'tu-y',
  name: 'y', // P83.5 — founder đặt tên tạm "y" (đổi tên thật sau qua PRODUCT_LABELS + đây)
  parameters,
  build,
  getWarnings,
  priceConfig: { margin: 1.6, laborPerOrder: 300_000 }, // catalog KV override lúc runtime
};

export default tuY;
