// =============================================================
// SẢN PHẨM: TỦ KỆ — products/tu-ke/dna.ts
// Một hệ tủ kệ LINH HOẠT: 1 file DNA customize ra nhiều loại kệ/tủ.
// Tham số: rộng/cao/sâu, số cột/tầng, chế độ rộng & cao (chia đều / từng
// cột-tầng), và LƯỚI loại từng ô (mở có hậu / mở không hậu / cánh / ngăn kéo).
// Vật liệu: plywood phủ màu trơn 2 mặt, KHÔNG dán cạnh — thân 18mm, ván hậu 9mm.
// Đây là MẪU CHUẨN cho mọi sản phẩm về sau.
//
// Hệ toạ độ scene (mm): X∈[-W/2,W/2], Y∈[0,H] (0=sàn), Z∈[-D/2,D/2] (trước +Z).
// Khung: nóc/đáy/kệ là tấm ngang DÀI (hết W); vách đứng là đoạn NGẮN 1 tầng
// (columns+1 vị trí, gồm 2 mép biên — không có "tấm hông" riêng).
// =============================================================
import { encodeCellGrid, parseCellGrid } from '@/configurator/cellgrid';
import { resolveMaterial } from '@/configurator/materials';
import type {
  BuildResult,
  Fitting,
  Hardware,
  PanelHole,
  ParamValues,
  Parameter,
  Part,
  ProductDNA,
} from '@/configurator/types';

const T = 18; // độ dày ván thân tủ (mm) — nóc/đáy/kệ/vách/cánh/hộc
const T_BACK = 9; // độ dày ván hậu (mm)
const FRONT_GAP = 4; // khe hở quanh cánh / mặt ngăn kéo (mm)
const WIDE_CELL = 500; // ô rộng hơn mức này → tách 2 cánh
const CELL_MIN = 150; // thông thuỷ tối thiểu 1 ô (mm) — áp cho cả rộng lẫn cao
const TIER_MAX = 900; // cao tối đa 1 ô (mm) — manual: khoá slider; chia đều: tự thêm tầng
const COL_MAX = 700; // rộng tối đa 1 ô (mm) — manual: khoá slider; chia đều: tự thêm cột
const DRAWER_MAX_TOP = 1200; // đỉnh ô ≤ mức này mới cho ngăn kéo (tầm với + nhìn thấy đồ)
const DRAWER_MAX_HEIGHT = 400; // ô cao hơn mức này → không cho ngăn kéo (hộc quá cao)
const FRONT_MIN_WIDTH = 250; // ô hẹp hơn mức này → không cho cánh/ngăn kéo (đủ chỗ ray/bản lề)
const SLIDE_GAP = 13; // khe mỗi bên giữa thùng hộc và vách ô — chừa ray trượt
const HOLE_R = 17.5; // bán kính lỗ tay nắm khoét (mm) — Ø35
const HOLE_INSET = 40; // tâm lỗ tay nắm cách mép tấm (mm)
const FOOT_H = 5; // chiều cao chân tủ "nút mỏng" (mm) — tủ được nhấc lên đúng mức này
const FOOT_DIA = 18; // đường kính chân tủ (mm)
const FOOT_INSET = 45; // tâm chân cách mép trước / sau tủ (mm)
const LOW_HANDLE_FROM_GROUND = 1200; // đáy ô ≥ mức này (từ sàn) → tay nắm cánh nằm sát cạnh DƯỚI

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Kích thước tủ tối thiểu để n ô đều thông thuỷ ≥ CELL_MIN (chế độ chia đều). */
const minTotal = (n: number) => n * CELL_MIN + (n - 1) * T + 2 * T;
/** minTotal làm tròn LÊN bội số `step` → giá trị slider luôn nằm trên lưới (không bị snap lệch). */
const stepMin = (n: number, step: number) => Math.ceil(minTotal(n) / step) * step;
/** Kích thước 1 ô khi chia đều n ô trong tổng `total` (mm). */
const evenCell = (total: number, n: number) => (total - 2 * T - (n - 1) * T) / n;

/** Vị trí mép (dưới/trái) của từng phần tử: phần tử 0 bắt đầu ở T, cách nhau T. */
function starts(sizes: number[]): number[] {
  const out: number[] = [];
  let pos = T;
  for (const s of sizes) {
    out.push(pos);
    pos += s + T;
  }
  return out;
}

/** Chiều cao mỗi tầng — chế độ "chia đều" (từ chiều cao tổng) hoặc "từng tầng" (núm tierH_*). */
function computeRowHeights(values: ParamValues): number[] {
  const rows = values.rows as number;
  if (values.heightMode === 'manual') {
    // tierH_* chưa kéo → mặc định = chia đều (khớp seed thanh trượt & build()).
    const seed = evenCell(values.height as number, rows);
    return Array.from({ length: rows }, (_, r) =>
      clamp(Number(values[`tierH_${r}`] ?? seed), CELL_MIN, TIER_MAX),
    );
  }
  const h = evenCell(Math.max(values.height as number, minTotal(rows)), rows);
  return Array.from({ length: rows }, () => h);
}

/** Bề rộng mỗi cột — chế độ "chia đều" (từ chiều rộng tổng) hoặc "từng cột" (núm colW_*). */
function computeColWidths(values: ParamValues): number[] {
  const columns = values.columns as number;
  if (values.widthMode === 'manual') {
    // colW_* chưa kéo → mặc định = chia đều (khớp seed thanh trượt & build()).
    const seed = evenCell(values.width as number, columns);
    return Array.from({ length: columns }, (_, c) =>
      clamp(Number(values[`colW_${c}`] ?? seed), CELL_MIN, COL_MAX),
    );
  }
  const w = evenCell(Math.max(values.width as number, minTotal(columns)), columns);
  return Array.from({ length: columns }, () => w);
}

// 4 loại ô khách chọn trên lưới (value đầu tiên = mặc định).
const CELL_TYPES: { value: string; label: string }[] = [
  { value: 'open-back', label: 'Mở (có hậu)' },
  { value: 'open-nobk', label: 'Mở (không hậu)' },
  { value: 'door', label: 'Cánh' },
  { value: 'drawer', label: 'Ngăn kéo' },
];
const DEFAULT_CELL = CELL_TYPES[0].value;

// Danh sách VẬT LIỆU (gộp 1 list) — dùng cho núm "Vật liệu khung" lẫn lưới "Vật liệu từng ô".
// 2 họ: ván MDF sơn màu (mdf_son) + ván plywood phủ veneer vân gỗ (plywood_veneer).
const MATERIALS: { value: string; label: string }[] = [
  { value: 'mdf_son/vang', label: 'MDF Vàng' },
  { value: 'mdf_son/cam', label: 'MDF Cam' },
  { value: 'mdf_son/do', label: 'MDF Đỏ' },
  { value: 'mdf_son/nau', label: 'MDF Nâu' },
  { value: 'mdf_son/xanh_la', label: 'MDF Xanh lá' },
  { value: 'mdf_son/xanh', label: 'MDF Xanh' },
  { value: 'mdf_son/xam_nhat', label: 'MDF Xám nhạt' },
  { value: 'mdf_son/xam', label: 'MDF Xám' },
  { value: 'mdf_son/den', label: 'MDF Đen' },
  { value: 'plywood_veneer/oak', label: 'Veneer Sồi' },
  { value: 'plywood_veneer/walnut', label: 'Veneer Óc chó' },
  { value: 'plywood_veneer/ash', label: 'Veneer Tần bì' },
];
// Lưới "Vật liệu từng ô": ô mang giá trị này → ăn theo "Vật liệu khung" (không đặt riêng).
const FRAME_COLOR = 'frame';

// 3 BƯỚC khách thao tác (wizard). resolveControls gắn mỗi núm vào 1 step.id dưới đây.
const STEPS = [
  { id: 'size', label: 'Kích thước' },
  { id: 'cells', label: 'Thuộc tính ô' },
  { id: 'finish', label: 'Màu & vật liệu' },
];

// --- Cấu hình MẶC ĐỊNH của 2 lưới ô (6 tầng × 4 cột — khớp rows/columns mặc định) ---
// Tầng 0 = dưới cùng. Dưới: ngăn kéo (xanh lá) · giữa: mở-không-hậu · trên: cánh (vàng).
const DEFAULT_CELLS = encodeCellGrid([
  ['drawer', 'drawer', 'drawer', 'drawer'],
  ['drawer', 'drawer', 'drawer', 'drawer'],
  ['open-nobk', 'open-nobk', 'open-nobk', 'open-nobk'],
  ['open-nobk', 'open-nobk', 'open-nobk', 'open-nobk'],
  ['door', 'door', 'door', 'door'],
  ['door', 'door', 'door', 'door'],
]);
const DEFAULT_CELL_COLORS = encodeCellGrid([
  ['mdf_son/xanh_la', 'mdf_son/xanh_la', 'mdf_son/xanh_la', 'mdf_son/xanh_la'],
  ['mdf_son/xanh_la', 'mdf_son/xanh_la', 'mdf_son/xanh_la', 'mdf_son/xanh_la'],
  [FRAME_COLOR, FRAME_COLOR, FRAME_COLOR, FRAME_COLOR],
  [FRAME_COLOR, FRAME_COLOR, FRAME_COLOR, FRAME_COLOR],
  ['mdf_son/vang', 'mdf_son/vang', 'mdf_son/vang', 'mdf_son/vang'],
  ['mdf_son/vang', 'mdf_son/vang', 'mdf_son/vang', 'mdf_son/vang'],
]);

// --- Núm TĨNH (seed giá trị ban đầu; danh sách hiển thị do resolveControls sinh) ---
const parameters: Parameter[] = [
  { id: 'width', label: 'Chiều rộng', type: 'number', min: 600, max: 2400, step: 1, unit: 'mm', default: 1900 },
  { id: 'height', label: 'Chiều cao', type: 'number', min: 700, max: 2200, step: 1, unit: 'mm', default: 2200 },
  { id: 'depth', label: 'Chiều sâu', type: 'number', min: 300, max: 600, step: 1, unit: 'mm', default: 350 },
  { id: 'columns', label: 'Số cột', type: 'number', min: 1, max: 5, step: 1, unit: 'cột', default: 4 },
  { id: 'rows', label: 'Số tầng', type: 'number', min: 1, max: 6, step: 1, unit: 'tầng', default: 6 },
  {
    id: 'widthMode',
    label: 'Chế độ chiều rộng',
    type: 'option',
    default: 'even',
    options: [
      { value: 'even', label: 'Chia đều' },
      { value: 'manual', label: 'Từng cột' },
    ],
  },
  {
    id: 'heightMode',
    label: 'Chế độ chiều cao',
    type: 'option',
    default: 'even',
    options: [
      { value: 'even', label: 'Chia đều' },
      { value: 'manual', label: 'Từng tầng' },
    ],
  },
  { id: 'color', label: 'Vật liệu khung', type: 'option', default: 'mdf_son/den', options: MATERIALS },
  // 2 mục dưới CHỈ để seed mặc định cho 2 lưới ô — lưới hiển thị do resolveControls sinh.
  { id: 'cells', label: 'Thuộc tính từng ô', type: 'cellgrid', default: DEFAULT_CELLS },
  { id: 'cellColors', label: 'Vật liệu từng ô', type: 'cellgrid', default: DEFAULT_CELL_COLORS },
];

const paramById = (id: string): Parameter => {
  const p = parameters.find((x) => x.id === id);
  if (!p) throw new Error(`Tham số không tồn tại: ${id}`);
  return p;
};

/** 1 thanh trượt kích thước "từng cột/tầng" (mm, bước 10, khớp lưới step). */
function sizeSlider(id: string, label: string, value: number, max: number): Parameter {
  return {
    id,
    label,
    type: 'number',
    min: CELL_MIN,
    max,
    step: 1,
    unit: 'mm',
    default: Math.round(clamp(value, CELL_MIN, max)),
  };
}

/** Gắn nhãn nhóm cho 1 núm — Configurator gom các núm cùng group vào 1 khung có tiêu đề. */
const inGroup = (p: Parameter, group: string): Parameter => ({ ...p, group });

/** Chế độ chia đều: số TẦNG ít nhất để mỗi ô cao ≤ TIER_MAX (chặn trên bởi max núm 'rows'). */
function minRowsForEvenHeight(height: number): number {
  const max = (paramById('rows').max as number) ?? 6;
  let n = 1;
  while (n < max && evenCell(height, n) > TIER_MAX) n++;
  return n;
}

/** Chế độ chia đều: số CỘT ít nhất để mỗi ô rộng ≤ COL_MAX (chặn trên bởi max núm 'columns'). */
function minColsForEvenWidth(width: number): number {
  const max = (paramById('columns').max as number) ?? 5;
  let n = 1;
  while (n < max && evenCell(width, n) > COL_MAX) n++;
  return n;
}

/**
 * Sinh danh sách núm theo trạng thái hiện tại:
 *  - chiều rộng/cao: "chia đều" → 1 núm tổng (min động); "từng cột/tầng" → mỗi cái 1 núm.
 *  - lưới loại ô: kích thước theo số cột × số tầng; tầng có đỉnh > 1200mm cấm "ngăn kéo".
 */
function resolveControls(values: ParamValues): Parameter[] {
  const columns = values.columns as number;
  const rows = values.rows as number;
  const list: Parameter[] = [];

  // --- Nhóm "Chiều rộng": số cột + chế độ + (1 núm tổng | mỗi cột 1 núm) ---
  // chia đều: số cột có min ĐỘNG (đủ cột để mỗi ô rộng ≤ COL_MAX).
  const columnsParam =
    values.widthMode === 'even'
      ? { ...paramById('columns'), min: minColsForEvenWidth(values.width as number) }
      : paramById('columns');
  list.push(inGroup(columnsParam, 'Chiều rộng'));
  list.push(inGroup(paramById('widthMode'), 'Chiều rộng'));
  if (values.widthMode === 'manual') {
    const split = evenCell(values.width as number, columns);
    for (let c = 0; c < columns; c++) {
      list.push(inGroup(sizeSlider(`colW_${c}`, `Rộng cột ${c + 1}`, split, COL_MAX), 'Chiều rộng'));
    }
  } else {
    const wp = paramById('width');
    list.push(inGroup({ ...wp, min: stepMin(columns, wp.step ?? 50) }, 'Chiều rộng'));
  }

  // --- Nhóm "Chiều cao": số tầng + chế độ + (1 núm tổng | mỗi tầng 1 núm) ---
  // chia đều: số tầng có min ĐỘNG (đủ tầng để mỗi ô cao ≤ TIER_MAX).
  const rowsParam =
    values.heightMode === 'even'
      ? { ...paramById('rows'), min: minRowsForEvenHeight(values.height as number) }
      : paramById('rows');
  list.push(inGroup(rowsParam, 'Chiều cao'));
  list.push(inGroup(paramById('heightMode'), 'Chiều cao'));
  if (values.heightMode === 'manual') {
    const split = evenCell(values.height as number, rows);
    for (let r = 0; r < rows; r++) {
      list.push(inGroup(sizeSlider(`tierH_${r}`, `Cao tầng ${r + 1}`, split, TIER_MAX), 'Chiều cao'));
    }
  } else {
    const hp = paramById('height');
    list.push(inGroup({ ...hp, min: stepMin(rows, hp.step ?? 50) }, 'Chiều cao'));
  }

  list.push(paramById('depth'));

  // --- Lưới loại ô (hiển thị như MẶT ĐỨNG tủ: ô đúng tỉ lệ thật + màu sơn) ---
  const rowHeights = computeRowHeights(values);
  const colWidths = computeColWidths(values);
  const rowBottomY = starts(rowHeights);
  // Ngăn kéo bị cấm: tầng quá cao (đỉnh > DRAWER_MAX_TOP) HOẶC cột quá hẹp (< FRONT_MIN_WIDTH).
  const disabledByRow = rowHeights.map((h, r) =>
    rowBottomY[r] + h > DRAWER_MAX_TOP || h > DRAWER_MAX_HEIGHT ? ['drawer'] : [],
  );
  const disabledByCol = colWidths.map((w) => (w < FRONT_MIN_WIDTH ? ['drawer', 'door'] : []));
  list.push({
    id: 'cells',
    label: 'Thuộc tính từng ô',
    type: 'cellgrid',
    options: CELL_TYPES,
    gridRows: rows,
    gridCols: columns,
    disabledByRow,
    disabledByCol,
    colSizes: colWidths,
    rowSizes: rowHeights,
    tint: resolveMaterial(values.color as string).hex,
    default: encodeCellGrid(
      Array.from({ length: rows }, () => Array.from({ length: columns }, () => DEFAULT_CELL)),
    ),
  });

  // --- Lưới VẬT LIỆU từng ô — "Theo khung" = ăn theo vật liệu khung ---
  // Ô "mở không hậu" không có tấm nào để phủ vật liệu → khoá ô đó trong lưới màu.
  const typeGrid = parseCellGrid((values.cells as string) ?? '');
  const lockedCells = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: columns }, (_, c) => typeGrid[r]?.[c] === 'open-nobk'),
  );
  list.push({
    id: 'cellColors',
    label: 'Vật liệu từng ô (hậu / cánh / ngăn kéo)',
    type: 'cellgrid',
    cellVariant: 'color',
    options: [{ value: FRAME_COLOR, label: 'Theo khung' }, ...MATERIALS],
    gridRows: rows,
    gridCols: columns,
    colSizes: colWidths,
    rowSizes: rowHeights,
    lockedCells,
    tint: resolveMaterial(values.color as string).hex,
    default: encodeCellGrid(
      Array.from({ length: rows }, () => Array.from({ length: columns }, () => FRAME_COLOR)),
    ),
  });

  list.push(paramById('color'));

  // Gắn nhãn BƯỚC cho từng núm (wizard): lưới loại ô → 'cells'; lưới vật liệu + vật
  // liệu khung → 'finish'; còn lại (số cột/tầng, chế độ, rộng/cao/sâu) → 'size'.
  return list.map((p) => ({
    ...p,
    stepId:
      p.id === 'cells' ? 'cells' : p.id === 'cellColors' || p.id === 'color' ? 'finish' : 'size',
  }));
}

/**
 * Chuẩn hoá value-set sau mỗi lần khách đổi 1 núm (Configurator gọi qua dna.normalizeValues).
 * Chế độ "chia đều": kéo chiều cao/rộng TỔNG làm 1 ô vượt cỡ tối đa → tự thêm tầng/cột.
 * Chế độ "từng cột/tầng" đã khoá ngay tại slider (sizeSlider max) nên không xử ở đây.
 */
function normalizeValues(values: ParamValues): ParamValues {
  const v: ParamValues = { ...values };
  if (v.heightMode === 'even') {
    v.rows = Math.max(v.rows as number, minRowsForEvenHeight(v.height as number));
  }
  if (v.widthMode === 'even') {
    v.columns = Math.max(v.columns as number, minColsForEvenWidth(v.width as number));
  }
  return v;
}

/**
 * Cảnh báo cho khách — CHỈ hiển thị, KHÔNG chặn build(). Ở chế độ "từng cột/tầng"
 * tổng tủ = cộng dồn các ô nên có thể vượt giới hạn rộng/cao tối đa của sản phẩm.
 */
function getWarnings(values: ParamValues): string[] {
  const out: string[] = [];
  const colWidths = computeColWidths(values);
  const rowHeights = computeRowHeights(values);
  const W = colWidths.reduce((s, w) => s + w, 0) + (colWidths.length + 1) * T;
  const H = rowHeights.reduce((s, h) => s + h, 0) + (rowHeights.length + 1) * T;
  const maxW = paramById('width').max as number;
  const maxH = paramById('height').max as number;
  if (W > maxW) {
    out.push(
      `Tổng chiều rộng ${Math.round(W)}mm vượt giới hạn ${maxW}mm — giảm bớt cột hoặc ` +
        `độ rộng từng cột, hoặc liên hệ để đặt kích thước riêng.`,
    );
  }
  if (H > maxH) {
    out.push(
      `Tổng chiều cao ${Math.round(H)}mm vượt giới hạn ${maxH}mm — giảm bớt tầng hoặc ` +
        `độ cao từng tầng, hoặc liên hệ để đặt kích thước riêng.`,
    );
  }
  return out;
}

/**
 * Tạo 1 Part. size = [x,y,z] của hộp 3D; length/width/thickness suy ra bằng
 * cách sắp xếp 3 cạnh giảm dần (cạnh nhỏ nhất = độ dày ván).
 * Tủ kệ KHÔNG dán cạnh → edgeBanding mọi cạnh false.
 */
function panel(
  id: string,
  label: string,
  material: string,
  size: [number, number, number],
  position: [number, number, number],
  extra?: { notes?: string; holes?: PanelHole[] },
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
    grain: 'length',
    edgeBanding: { front: false, back: false, left: false, right: false },
    qty: 1,
    notes: extra?.notes,
    holes: extra?.holes,
  };
}

/**
 * Cánh ĐƠN — lỗ tay nắm ở mép PHẢI (trả +1) hay TRÁI (-1).
 * Ghép cặp cột tính từ bên PHẢI: trong cặp, cột trái → tay nắm phải, cột phải → trái
 * (2 tay nắm quay vào nhau). Số cột lẻ → cột ngoài cùng bên TRÁI là cột thừa, tay nắm
 * hướng vào trong (phải).
 */
function singleDoorHandleSign(col: number, columns: number): number {
  const hasLeftover = columns % 2 === 1;
  if (hasLeftover && col === 0) return 1; // cột thừa bên trái → tay nắm hướng vào (phải)
  const offset = hasLeftover ? 1 : 0;
  return (col - offset) % 2 === 0 ? 1 : -1; // chẵn = cột trái của cặp → phải; lẻ → trái
}

/** Sinh hình học + phụ kiện từ giá trị tham số khách chọn. */
function build(params: ParamValues): BuildResult {
  const D = params.depth as number;
  const columns = params.columns as number;
  const rows = params.rows as number;
  const frameMaterial = params.color as string;
  // Màu từng ô (lưới "Màu từng ô"): FRAME_COLOR (hoặc trống) → ăn theo màu khung.
  const colorGrid = parseCellGrid((params.cellColors as string) ?? '');
  const cellMaterial = (r: number, c: number): string => {
    const v = colorGrid[r]?.[c];
    return !v || v === FRAME_COLOR ? frameMaterial : v;
  };

  const rowHeights = computeRowHeights(params);
  const colWidths = computeColWidths(params);
  // Chiều cao/rộng tủ = tổng các ô + các tấm ngăn + 2 tấm biên.
  const H = rowHeights.reduce((s, h) => s + h, 0) + (rows + 1) * T;
  const W = colWidths.reduce((s, w) => s + w, 0) + (columns + 1) * T;

  const rowBottomY = starts(rowHeights); // mép dưới mỗi tầng
  const rowCenterY = (r: number) => rowBottomY[r] + rowHeights[r] / 2;

  // Tâm các vách đứng k = 0..columns (toạ độ scene, trục X).
  const vachX: number[] = [];
  for (let k = 0, x = T / 2 - W / 2; k <= columns; k++) {
    vachX.push(x);
    if (k < columns) x += T + colWidths[k];
  }
  const colCenterX = (c: number) => vachX[c] + T / 2 + colWidths[c] / 2;

  // Loại từng ô (lưới đã được Configurator chuẩn hoá đúng rows × columns).
  const grid = parseCellGrid((params.cells as string) ?? '');
  const cellType = (r: number, c: number): string => {
    const t = grid[r]?.[c] ?? DEFAULT_CELL;
    // phòng hờ — coi như "mở có hậu" nếu vi phạm ràng buộc:
    if ((t === 'drawer' || t === 'door') && colWidths[c] < FRONT_MIN_WIDTH) return DEFAULT_CELL;
    if (t === 'drawer' && rowBottomY[r] + rowHeights[r] > DRAWER_MAX_TOP) return DEFAULT_CELL;
    if (t === 'drawer' && rowHeights[r] > DRAWER_MAX_HEIGHT) return DEFAULT_CELL;
    return t;
  };

  const parts: Part[] = [];
  let hinges = 0;
  let slides = 0;

  // --- Tấm ngang DÀI (chạy hết W): đáy + nóc + kệ giữa ---
  parts.push(
    panel('bottom', 'Tấm đáy', frameMaterial, [W, T, D], [0, T / 2, 0], {
      notes: `Mặt dưới: bắt ${2 * (columns + 1)} chân tủ — ${columns + 1} vị trí vách đứng × 2 (trước + sau).`,
    }),
  );
  parts.push(panel('top', 'Tấm nóc', frameMaterial, [W, T, D], [0, H - T / 2, 0]));
  for (let g = 0; g < rows - 1; g++) {
    const y = rowBottomY[g] + rowHeights[g] + T / 2; // kệ nằm ngay trên tầng g
    parts.push(panel(`shelf-${g}`, 'Kệ', frameMaterial, [W, T, D], [0, y, 0]));
  }

  // --- Vách đứng: đoạn ngắn 1 tầng, columns+1 vị trí (gồm 2 mép biên) ---
  for (let k = 0; k <= columns; k++) {
    for (let r = 0; r < rows; r++) {
      parts.push(
        panel(`divider-c${k}-r${r}`, 'Vách đứng', frameMaterial,
          [T, rowHeights[r], D], [vachX[k], rowCenterY(r), 0]),
      );
    }
  }

  // --- Từng ô: tấm lưng (per-ô, trừ "mở không hậu") + mặt trước (cánh/ngăn kéo) ---
  // Cánh/hộc CHÌM trong ô; mặt ngoài phẳng cạnh trước khung. Tay nắm = lỗ khoét Ø35.
  const backZ = -(D - T_BACK) / 2;
  const frontZ = D / 2 - T / 2;
  const topHoleY = (h: number) => h / 2 - HOLE_INSET; // tâm lỗ — gần cạnh trên
  for (let r = 0; r < rows; r++) {
    const yC = rowCenterY(r);
    const faceH = rowHeights[r] - FRONT_GAP;
    for (let c = 0; c < columns; c++) {
      const xC = colCenterX(c);
      const cw = colWidths[c];
      const type = cellType(r, c);
      const cm = cellMaterial(r, c); // màu ô này — phủ tấm hậu + cánh/ngăn kéo

      // tấm lưng riêng cho ô (mọi loại trừ "mở không hậu")
      if (type !== 'open-nobk') {
        parts.push(
          panel(`back-r${r}-c${c}`, 'Tấm lưng', cm,
            [cw, rowHeights[r], T_BACK], [xC, yC, backZ]),
        );
      }

      if (type === 'drawer') {
        // mặt trước (false front) — lắp chìm, có lỗ tay nắm
        parts.push(
          panel(`drawer-r${r}-c${c}`, 'Mặt ngăn kéo', cm,
            [cw - FRONT_GAP, faceH, T], [xC, yC, frontZ], {
              notes: 'Khoét lỗ tay nắm Ø35 — giữa cạnh trên',
              holes: [{ dx: 0, dy: topHoleY(faceH), r: HOLE_R }],
            }),
        );
        // thùng hộc: 2 hông + hậu + đáy (thụt SLIDE_GAP mỗi bên chừa ray)
        const bw = cw - 2 * SLIDE_GAP; // bề rộng NGOÀI thùng
        const bh = faceH - 20; // chiều cao thành hộc
        const bFront = frontZ - T; // mặt trước thùng — ngay sau false front
        const bBack = backZ + T_BACK / 2 + 30; // chừa 30mm trước tấm hậu ô
        const bd = bFront - bBack; // chiều sâu thùng
        const bzC = (bFront + bBack) / 2;
        const sideX = cw / 2 - SLIDE_GAP - T / 2;
        parts.push(panel(`drawerL-r${r}-c${c}`, 'Hông hộc', cm, [T, bh, bd], [xC - sideX, yC, bzC]));
        parts.push(panel(`drawerR-r${r}-c${c}`, 'Hông hộc', cm, [T, bh, bd], [xC + sideX, yC, bzC]));
        parts.push(
          panel(`drawerBk-r${r}-c${c}`, 'Hậu hộc', cm,
            [bw - 2 * T, bh, T], [xC, yC, bBack + T / 2]),
        );
        parts.push(
          panel(`drawerBot-r${r}-c${c}`, 'Đáy hộc', cm,
            [bw - 2 * T, T_BACK, bd - T], [xC, yC - bh / 2 + T_BACK / 2, bzC]),
        );
        slides += 1;
      } else if (type === 'door') {
        // #4: đáy ô tính TỪ SÀN (cộng chiều cao chân) ≥ ngưỡng → tay nắm sát cạnh DƯỚI.
        const lowHandle = rowBottomY[r] + FOOT_H >= LOW_HANDLE_FROM_GROUND;
        const holeDy = lowHandle ? HOLE_INSET - faceH / 2 : faceH / 2 - HOLE_INSET;
        const vWord = lowHandle ? 'dưới' : 'trên';
        if (cw > WIDE_CELL) {
          // ô rộng → 2 cánh: bản lề mép NGOÀI, 2 lỗ tay nắm quay vào nhau (giáp nhau).
          const leafW = cw / 2 - 6;
          const grip = leafW / 2 - HOLE_INSET;
          parts.push(
            panel(`door-r${r}-c${c}-a`, 'Cánh tủ', cm,
              [leafW, faceH, T], [xC - cw / 4, yC, frontZ], {
                notes: `Khoét lỗ tay nắm Ø35 — góc ${vWord} bên phải`,
                holes: [{ dx: grip, dy: holeDy, r: HOLE_R }],
              }),
          );
          parts.push(
            panel(`door-r${r}-c${c}-b`, 'Cánh tủ', cm,
              [leafW, faceH, T], [xC + cw / 4, yC, frontZ], {
                notes: `Khoét lỗ tay nắm Ø35 — góc ${vWord} bên trái`,
                holes: [{ dx: -grip, dy: holeDy, r: HOLE_R }],
              }),
          );
          hinges += 4;
        } else {
          // #3: cánh đơn — tay nắm trái/phải theo quy tắc ghép cặp cột (quay vào nhau).
          const faceW = cw - FRONT_GAP;
          const sign = singleDoorHandleSign(c, columns);
          const sWord = sign > 0 ? 'phải' : 'trái';
          parts.push(
            panel(`door-r${r}-c${c}`, 'Cánh tủ', cm,
              [faceW, faceH, T], [xC, yC, frontZ], {
                notes: `Khoét lỗ tay nắm Ø35 — góc ${vWord} bên ${sWord}`,
                holes: [{ dx: sign * (faceW / 2 - HOLE_INSET), dy: holeDy, r: HOLE_R }],
              }),
          );
          hinges += 2;
        }
      }
      // 'open-back' / 'open-nobk' → không có mặt trước
    }
  }

  // --- Chân tủ: 2 cái mỗi vách đứng (trước + sau) — nơi lực dồn xuống nhiều nhất ---
  const fittings: Fitting[] = [];
  const footZ = D / 2 - FOOT_INSET;
  for (let k = 0; k <= columns; k++) {
    fittings.push({
      id: `foot-c${k}-front`, kind: 'foot',
      size: [FOOT_DIA, FOOT_H, FOOT_DIA], position: [vachX[k], FOOT_H / 2, footZ],
    });
    fittings.push({
      id: `foot-c${k}-back`, kind: 'foot',
      size: [FOOT_DIA, FOOT_H, FOOT_DIA], position: [vachX[k], FOOT_H / 2, -footZ],
    });
  }
  // Nhấc cả tủ lên đúng chiều cao chân → chân nằm gọn giữa sàn (y=0) và đáy tủ.
  for (const p of parts) p.position[1] += FOOT_H;

  const hardware: Hardware[] = [];
  if (hinges > 0) hardware.push({ id: 'hinge', label: 'Bản lề giảm chấn', qty: hinges });
  if (slides > 0) hardware.push({ id: 'drawer-slide', label: 'Ray ngăn kéo (bộ)', qty: slides });
  hardware.push({
    id: 'foot',
    label: 'Chân tủ (nút mỏng)',
    qty: fittings.length,
    notes: `2 cái mỗi vách đứng (1 trước + 1 sau), bắt vào mặt dưới tấm đáy — ${columns + 1} vách.`,
  });

  return { parts, hardware, fittings };
}

const tuKe: ProductDNA = {
  slug: 'tu-ke',
  name: 'Tủ kệ Module',
  parameters,
  steps: STEPS,
  resolveControls,
  normalizeValues,
  getWarnings,
  build,
  priceConfig: { margin: 1.6, laborPerOrder: 300_000 },
};

export default tuKe;
