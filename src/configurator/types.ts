// =============================================================
// HỢP ĐỒNG DNA — nền KHÓA từ Session 1.
// Mọi sản phẩm (products/<slug>/dna.ts) phải tuân theo các kiểu này.
// Chỉ THÊM field tùy chọn (không phá kiểu cũ), và chỉ khi founder duyệt.
// Lịch sử: S2 thêm ProductDNA.resolveControls? (núm động), Part.holes,
//          và Parameter type 'cellgrid' (lưới chọn loại từng ô). Sau S2 thêm
//          Parameter.group? (gom núm) + cellgrid colSizes/rowSizes/tint (lưới mặt đứng)
//          + Parameter.disabledByCol? (cấm option theo cột)
//          + ProductDNA.normalizeValues? (tự chỉnh tham số phụ thuộc)
//          + Parameter.cellVariant? (cellgrid: lưới chọn loại / lưới chọn màu).
//          + Parameter.stepId? · ProductDNA.steps? · ProductDNA.getWarnings?
//            (wizard nhiều bước + cảnh báo kích thước — đều tùy chọn).
//          + Parameter.lockedCells? · Hardware.notes? · Fitting + BuildResult.fittings?
//            (ô khoá lưới màu · ghi chú phụ kiện · chân tủ 3D — đều tùy chọn / additive).
//          + PriceConfig.materialRates? / hardwarePrices? / materialDensities? /
//            hardwareWeights? (S9 — bơm catalog đơn giá sản xuất; đều tùy chọn).
//          + PriceConfig.materialLabels? (giá theo từng màu — nhãn dòng bảng giá).
//          + Machining types (MachiningSide/Purpose/Drill/Pocket) + Part.machining?
//            (S10 — lỗ khoan/phay có cấu trúc cho xuất DXF cho CNC; tùy chọn,
//            engine pricing/cutlist KHÔNG đọc; renderer 3D vẫn dùng `holes`).
//          + Part.perimeter? (mm — chu vi bản vẽ; cutlist set để tính khối lượng
//            dán cạnh; chỉ cho material có dán cạnh) +
//            PriceConfig.edgeBandingPricePerM? / edgeBandingMmByBoardType?
//            (bơm từ catalog admin — tách giá dán cạnh thành dòng riêng).
// =============================================================

/** Một núm khách hàng chỉnh được trên configurator (rộng, cao, số tầng, màu...). */
export interface Parameter {
  id: string; // mã, vd "width" — build() đọc qua params[id]
  label: string; // nhãn tiếng Việt hiện cho khách, vd "Chiều rộng"
  type: 'number' | 'option' | 'cellgrid';
  group?: string; // gom các núm liên tiếp cùng group vào 1 khung có tiêu đề (vd "Chiều rộng")
  stepId?: string; // (wizard) id bước chứa núm này — khớp 1 phần tử ProductDNA.steps
  // (lưu ý: KHÁC `step` bên dưới — `step` là bước nhảy thanh trượt số)
  // type 'number' → thanh trượt:
  min?: number;
  max?: number;
  step?: number;
  unit?: string; // vd "mm" (chỉ để hiển thị)
  // type 'option' → nút chọn / swatch màu; type 'cellgrid' → danh sách loại ô:
  options?: { value: string; label: string }[];
  // type 'cellgrid' → lưới gridRows × gridCols; value là chuỗi mã hoá (xem cellgrid.ts):
  gridRows?: number;
  gridCols?: number;
  disabledByRow?: string[][]; // [hàng] → option value bị cấm ở hàng đó (vd ngăn kéo ở hàng cao)
  disabledByCol?: string[][]; // [cột] → option value bị cấm ở cột đó (vd ngăn kéo ở cột hẹp)
  // 'cellgrid' → khi ô có value bị cấm bởi disabledByRow/Col, value sẽ chuyển sang
  // cellFallbackMap[value] (nếu có) thay vì options[0]. VD {drawer: 'door'} → ngăn kéo
  // vi phạm size sẽ thành cánh (giữ "ý định" gần với user nhất), không phải mở-có-hậu.
  cellFallbackMap?: Record<string, string>;
  // 'cellgrid' → ma trận symbol per-cell để vẽ ký hiệu UI (override mặc định = value).
  // Cho phép DNA chọn biến thể icon theo ngữ cảnh ô (vd: 'door-L'/'door-R'/'door-double'
  // dựa trên hướng mở cánh + cánh đơn/đôi). Symbol nào engine không nhận diện → bỏ qua.
  cellSymbolByPosition?: string[][];
  lockedCells?: boolean[][]; // 'cellgrid' → [hàng][cột] true = ô KHOÁ (vẽ trắng, không bấm được)
  colSizes?: number[]; // 'cellgrid' → bề rộng thật từng cột (mm) — để vẽ ô lưới đúng tỉ lệ
  rowSizes?: number[]; // 'cellgrid' → chiều cao thật từng tầng (mm)
  tint?: string; // 'cellgrid' → màu nền ô (hex) cho lưới giống mặt đứng tủ
  cellVariant?: 'type' | 'color'; // 'cellgrid' → 'type' (chọn loại ô, mặc định) | 'color' (chọn màu ô)
  default: number | string; // 'cellgrid' → chuỗi mã hoá lưới
}

/** Dán cạnh theo 4 cạnh của mặt length×width. */
export interface EdgeBanding {
  front: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
}

/**
 * Lỗ khoét xuyên tấm (vd lỗ tay nắm). dx/dy lệch so với TÂM tấm, theo trục X,Y
 * của `size`; lỗ xuyên theo bề dày (trục Z). Renderer dựng lỗ từ field này;
 * xưởng đọc mô tả ở `notes`. Chỉ hợp lệ cho tấm mặt có Z là bề dày (cánh/hộc).
 */
export interface PanelHole {
  dx: number; // lệch tâm theo trục X của size (mm)
  dy: number; // lệch tâm theo trục Y của size (mm)
  r: number; // bán kính lỗ (mm)
}

// =============================================================
// MACHINING — S10 (additive). Mô tả lỗ khoan/phay CÓ CẤU TRÚC để xuất DXF cho
// máy CNC. Song song với `Part.notes` (text cho người đọc) và `Part.holes` (chỉ
// tay nắm Ø35 — render 3D). DNA cũ không khai báo `machining?` vẫn chạy bình
// thường; engine pricing/cutlist KHÔNG đọc machining (giá không đổi).
//
// QUY ƯỚC TOẠ ĐỘ (khác với `PanelHole.dx/dy` lệch tâm):
//   - Gốc (0,0) = góc TRÁI DƯỚI của tấm KHI NHÌN TỪ PHÍA 'front'
//   - x_mm dọc theo length_mm (cạnh dài), tăng sang phải
//   - y_mm dọc theo width_mm (cạnh ngắn), tăng lên trên
//   - Cả x_mm và y_mm đều ≥ 0 — chuẩn DXF công nghiệp
// QUY ƯỚC SIDE:
//   - 'front' = mặt thợ CNC úp xuống bàn máy để gia công op đó
//   - 'back' = mặt còn lại (chỉ xuất hiện cho tấm gia công 2 MẶT, vd kệ giữa)
// =============================================================

/** Mặt tấm được gia công. */
export type MachiningSide = 'front' | 'back';

/** Mục đích lỗ — UI/xưởng filter và label DXF layer. */
export type MachiningPurpose =
  | 'handle' // tay nắm Ø35 (đã có trong PanelHole, thêm bản structured)
  | 'hinge' // bản lề âm cup Ø35 + 2 vít M4 (chuẩn Blum/Hettich)
  | 'shelfPin' // chốt kệ Ø5 sâu 11mm — line 32mm trên vách
  | 'drawerSlide' // ray ngăn kéo (vít M4)
  | 'backScrew' // vít hậu Ø3 (mode='screw') hoặc clip lò xo Ø8 (mode='clip')
  | 'foot' // chân tủ Ø8 định vị xuyên đáy
  | 'confirmat' // S10.1 vít liên kết chính M6.3×50 (pilot cạnh + counterbore mặt)
  | 'dowel' // S10.1 chốt gỗ Ø8 định vị
  | 'other';

/** 1 lỗ khoan tròn (drill bit thẳng). */
export interface MachiningDrill {
  op: 'drill';
  purpose: MachiningPurpose;
  side: MachiningSide;
  x_mm: number; // ≥0, từ mép TRÁI tấm (theo length_mm)
  y_mm: number; // ≥0, từ mép DƯỚI tấm (theo width_mm)
  diameter_mm: number;
  depth_mm: number;
  through: boolean; // true nếu depth_mm >= thickness_mm
}

/**
 * 1 hốc tròn (cup bản lề âm Ø35 sâu 13mm). Tâm hốc tại (x_mm, y_mm).
 * Dùng cho cup bản lề; có thể mở rộng pocket chữ nhật sau (đổi sang width/height).
 */
export interface MachiningPocket {
  op: 'pocket';
  purpose: MachiningPurpose;
  side: MachiningSide;
  x_mm: number; // tâm hốc, ≥0
  y_mm: number; // tâm hốc, ≥0
  diameter_mm: number; // Ø hốc tròn (cup bản lề: 35)
  depth_mm: number;
}

/**
 * 1 lỗ khoan trên CẠNH ván (edge drilling) — cho confirmat pilot, dowel pilot.
 * Khác với MachiningDrill (face drilling — khoan trên MẶT ván theo trục thickness),
 * edge drilling khoan VUÔNG GÓC vào 1 trong 4 cạnh dài/ngắn của ván.
 *
 * Frame:
 *   - `edge`: cạnh nào của ván (top/bottom theo length; left/right theo length-axis 0,
 *      front/back nếu cần future — hiện chỉ top/bottom/left/right).
 *   - `position_mm`: vị trí dọc theo cạnh (0 = đầu start theo length axis).
 *   - `depth_mm`: sâu vào ván (lỗ ngắn vào lòng ván theo trục vuông góc cạnh).
 *   - `thicknessOffset_mm`: tâm lỗ trên cạnh — offset so với 1 mặt (default = ván
 *      thickness/2 = giữa cạnh). Vd thickness=18, cụm vít 2 lỗ trên cạnh → 1 ở
 *      thicknessOffset=6, 1 ở thicknessOffset=12.
 *
 * Workflow CNC: cần máy 5-axis hoặc máy khoan ngang chuyên dụng. Xưởng cơ bản 3-axis
 * → output edge holes ra file CSV machine-readable (xem CNC-WORKSHOP-SPEC.md §11).
 */
export interface MachiningEdgeDrill {
  op: 'edge_drill';
  purpose: MachiningPurpose;
  /** Cạnh nào: top/bottom = cạnh ngắn vuông góc length; left/right = cạnh dọc theo length. */
  edge: 'top' | 'bottom' | 'left' | 'right';
  /** Vị trí dọc cạnh (mm từ đầu start theo trục cạnh đó). */
  position_mm: number;
  /** Sâu vào ván (mm theo trục vuông góc cạnh). */
  depth_mm: number;
  /** Đường kính lỗ. */
  diameter_mm: number;
  /** Vị trí tâm lỗ trên cạnh — offset từ mặt 'front' (mm theo trục thickness).
   *  Vắng → giữa cạnh (= thickness/2). */
  thicknessOffset_mm?: number;
}

export type Machining = MachiningDrill | MachiningPocket | MachiningEdgeDrill;

// =============================================================
// MACHINING SPEC — S10.1 (additive). Hằng số kích thước phụ kiện CNC (cup bản
// lề, ray, confirmat, dowel, chốt kệ, clip lò xo, chân, tay nắm). Founder edit
// trong admin /admin/ke-catalog tab "Quy cách CNC" → KV lưu → engine consume
// qua PriceConfig.machiningSpec (DEFAULT fallback cho missing fields).
//
// Mode field (shelfPin/backFastener/foot/handle) cho phép switch implementation
// — vd `shelfPin.mode='line32mm'` → 30 lỗ Ø5 dọc cột; `mode='fixed'` → 4 lỗ tại
// vị trí kệ. Admin UI render form khác nhau theo mode.
// =============================================================

/** Cup bản lề âm Ø35 + 2 vít cup (chuẩn Blum/Hettich). */
export interface HingeCupSpec {
  cupDia: number; // Ø cup (default 35)
  cupDepth: number; // sâu cup (default 13)
  cupInsetFromEdge: number; // tâm cup cách mép cánh (default 22)
  cupScrewDia: number; // Ø vít cup (default 4)
  cupScrewDepth: number; // sâu vít cup (default 12)
  cupScrewOffset: number; // 2 vít cup cách tâm cup ±N theo trục dài (default 24)
}

/** Plate bản lề trên vách (2 vít M4). */
export interface HingePlateSpec {
  plateInsetFromEdge: number; // tâm plate cách mép trước vách (default 37)
  plateScrewSpan: number; // 2 vít plate cách nhau (default 32 — chuẩn 32mm-system)
  plateScrewDia: number; // Ø vít plate (default 4)
  plateScrewDepth: number; // sâu vít plate (default 12)
}

/** Ray ngăn kéo — vít M4 4 lỗ. */
export interface DrawerSlideSpec {
  screwDia: number; // Ø vít M4 (default 4)
  screwDepth: number; // sâu vít (default 12)
  clusterInsetFromEdge: number; // cụm vít trước/sau cách mép vách (default 37)
  clusterScrewSpan: number; // 2 vít trên/dưới mỗi cụm cách nhau (default 32, chuẩn 32mm)
  gapPerSide: number; // khe hộc-vách mỗi bên chừa ray (default 13)
}

/** Confirmat M6.3×50 — vít liên kết chính vách ↔ tấm ngang. */
export interface ConfirmatSpec {
  screwDia: number; // Ø thân vít (default 6.3)
  screwLength: number; // chiều dài (default 50)
  pilotDia: number; // Ø lỗ mồi cạnh ván (default 5)
  pilotDepth: number; // sâu mồi (default 38)
  counterboreDia: number; // Ø lỗ đầu vít mặt đối ứng (default 7)
  counterboreDepth: number; // sâu counterbore (default 13)
  perJoint: number; // số confirmat mỗi giao điểm (default 2)
  insetFromFront: number; // vít 1 cách mép trước vách (default 50)
  insetFromBack: number; // vít 2 cách mép sau (default 50)
}

/** Dowel gỗ Ø8×30 — chốt định vị xen kẽ confirmat. */
export interface DowelSpec {
  dowelDia: number; // Ø chốt + lỗ mồi (default 8)
  pilotDepthEach: number; // sâu lỗ mồi mỗi đầu (default 15)
  perJoint: number; // số dowel mỗi giao điểm (default 2)
}

/** Chốt kệ Ø5 — 2 mode line32mm hoặc fixed. */
export interface ShelfPinSpec {
  mode: 'line32mm' | 'fixed';
  pinDia: number; // Ø chốt (default 5)
  pinDepth: number; // sâu (default 11)
  // Cả 2 mode:
  columnInsetFromFront: number; // dãy trước cách mép trước vách (default 37)
  columnInsetFromBack: number; // dãy sau cách mép sau vách (default 37)
  // Chỉ mode 'line32mm':
  lineStartFromBottom: number; // lỗ đầu tiên cách đáy vách (default 64)
  lineSpacing: number; // cách nhau dọc cột (default 32)
  lineEndFromTop: number; // lỗ cuối cách đỉnh vách (default 64)
}

/** Liên kết tấm hậu — 2 mode clip lò xo hoặc vít cũ. */
export interface BackFastenerSpec {
  mode: 'clip' | 'screw';
  // mode 'clip' (founder chọn 2026-05-24):
  clipDia: number; // Ø lỗ clip trên vách (default 8)
  clipDepth: number; // sâu lỗ clip (default 12)
  clipInsetFromBackEdge: number; // tâm clip cách mép sau vách (default 15)
  clipsPerEdge: number; // số clip mỗi cạnh vách (default 2)
  clipMarginFromCellEnd: number; // clip trên cách đỉnh ô / dưới cách đáy ô (default 80)
  // mode 'screw' (cũ — giữ lại để fallback):
  screwDia: number; // Ø vít hậu (default 3.5)
  screwDepth: number; // sâu vít (default 15)
  marginFromCellEdge: number; // cách mép trái/phải ô (default 30)
}

/** Chân tủ — 3 mode pin/plate/screw. */
export interface FootSpec {
  mode: 'pin' | 'plate' | 'screw';
  pinDia: number; // mode 'pin': Ø định vị (default 8)
  pinDepth: number; // sâu (default 12)
  insetFromEdge: number; // tâm chân cách mép trước/sau đáy (default 45)
  positionsPerDivider: number; // số chân/vách (default 2 — 1 trước + 1 sau)
}

/** Tay nắm — 3 mode recessed/bar/cup_pull. */
export interface HandleSpec {
  mode: 'recessed' | 'bar' | 'cup_pull';
  // mode 'recessed' (default — em đang dùng):
  recessedDia: number; // Ø lỗ khoét xuyên (default 35)
  recessedInsetFromEdge: number; // tâm lỗ cách mép cánh (default 40)
  // mode 'bar' / 'cup_pull':
  barSpacing?: number; // 2 lỗ vít cách nhau (96/128/160 cho bar, 64 cho cup_pull)
  barScrewDia?: number; // Ø vít M4 (default 4)
}

/** Toàn bộ spec machining. */
export interface MachiningSpec {
  hingeCup: HingeCupSpec;
  hingePlate: HingePlateSpec;
  drawerSlide: DrawerSlideSpec;
  confirmat: ConfirmatSpec;
  dowel: DowelSpec;
  shelfPin: ShelfPinSpec;
  backFastener: BackFastenerSpec;
  foot: FootSpec;
  handle: HandleSpec;
}

/**
 * Một Part = một tấm/miếng cắt rời.
 * Vừa là 1 hình hộp trong 3D, vừa là 1 dòng trong cut-list cho xưởng.
 *  - size + position  → mô tả hình hộp trong không gian 3D (đơn vị mm).
 *  - length/width/thickness + grain + edgeBanding → thông tin để xưởng cắt.
 * size luôn là cùng 3 con số với length/width/thickness, chỉ khác cách gán trục.
 */
export interface Part {
  id: string;
  label: string; // tên dễ hiểu, vd "Tấm hông trái"
  material: string; // "catalog/id", vd "mfc/mfc_oak" (tra trong materials.ts)

  // --- Hình học 3D (hộp thẳng trục, không xoay) ---
  size: [number, number, number]; // kích thước hộp theo trục X, Y, Z (mm)
  position: [number, number, number]; // TÂM hộp trong toạ độ scene (mm)

  // --- Thông tin cut-list cho xưởng ---
  length_mm: number;
  width_mm: number;
  thickness_mm: number;
  grain: 'length' | 'width' | 'none'; // chiều vân gỗ chạy theo cạnh nào
  edgeBanding: EdgeBanding;

  qty: number; // số lượng tấm giống hệt nhau
  notes?: string; // ghi chú gia công, vd "khoan 4 lỗ Φ5 bắt kệ"
  holes?: PanelHole[]; // lỗ khoét trên mặt tấm (tay nắm...) — để render 3D
  // (S10, tùy chọn) Mọi lỗ khoan/phay CÓ CẤU TRÚC để xuất DXF cho CNC. Quy ước
  // toạ độ + side: xem khối comment trên `MachiningSide`/`MachiningPurpose`.
  // Notes string + holes (Ø35 tay nắm) GIỮ NGUYÊN song song để con người đọc
  // và renderer 3D tiếp tục dùng. Engine pricing/cutlist không tiêu thụ field này.
  machining?: Machining[];
  // (Edge-banding upgrade, tùy chọn) Chu vi bản vẽ (mm) = 2×(length_mm + width_mm)
  // KHI vật liệu có dán cạnh (resolveMaterial(material).noEdgeBanding !== true).
  // Set bởi buildCutlist; cutlist tổng hợp ra mét dán cạnh, pricing nhân giá/m.
  // Material lộ cạnh (vd plywood An Cường) → perimeter = undefined.
  perimeter?: number;
}

/** Phụ kiện — đếm theo cái, không có kích thước cắt (bản lề, ray, ốc, chân...). */
export interface Hardware {
  id: string;
  label: string; // vd "Bản lề giảm chấn"
  qty: number;
  notes?: string; // ghi chú vị trí / cách lắp — hiện ở bảng cắt (vd vị trí bắt chân tủ)
}

/**
 * Phụ kiện CÓ hình khối trong 3D nhưng KHÔNG phải tấm cắt (vd chân tủ).
 * Chỉ để renderer dựng hình; `cutlist`/`pricing` chỉ đọc `parts` nên tự bỏ qua —
 * số lượng & giá của fitting đếm riêng qua `Hardware`.
 */
export interface Fitting {
  id: string;
  /**
   * Loại phụ kiện — renderer chọn hình dạng theo đây:
   *  - 'foot': chân tủ Ø8 nút mỏng — size = [đường kính, cao, đường kính]
   *  - 'handle-strip': nẹp tay nắm gắn cạnh (Nam Khang edge profile) — size = [length, height, depth]
   */
  kind: 'foot' | 'handle-strip';
  size: [number, number, number]; // hộp bao (mm) — foot: [Ø, cao, Ø]; handle-strip: [length, height, depth]
  position: [number, number, number]; // TÂM khối trong toạ độ scene (mm)
  /** (handle-strip) Màu nẹp — hex. Vắng → đen mặc định (#000000). */
  color?: string;
}

/** Giá trị tham số khách đang chọn — map từ Parameter.id → giá trị. */
export type ParamValues = Record<string, number | string>;

/**
 * Context truyền cho `resolveControls` để gán label cho `Parameter.options[]`
 * của vật liệu. Configurator nạp từ `priceConfig.materialLabels` (catalog KV).
 * Vắng → DNA dùng auto-label từ id (fallback safe cho local dev / test).
 */
export interface ResolveContext {
  /** Map "catalog/id" → tên hiển thị (vd "mdf_son/vang" → "MDF Vàng"). */
  materialLabels?: Record<string, string>;
}

/** Kết quả của build(): danh sách tấm cắt + phụ kiện. */
export interface BuildResult {
  parts: Part[];
  hardware: Hardware[];
  fittings?: Fitting[]; // (tùy chọn) phụ kiện có hình khối 3D, không phải tấm cắt — vd chân tủ
}

/** Cấu hình tính giá cho 1 sản phẩm. */
export interface PriceConfig {
  margin: number; // hệ số nhân lãi, vd 1.6
  laborPerOrder?: number; // tiền công cố định mỗi đơn (VND) — DEPRECATED khi có boards (xài laborPerSheet)
  // --- IKEA-style stepped margin (additive, optional) ---
  // Khi `marginTiers` có data → engine dùng `computeMargin(panelCount, tiers)` để
  // lookup margin theo panel count (ít panel = margin thấp cạnh tranh, nhiều
  // panel = margin cao reflect độ phức tạp). Vắng → fallback flat `margin`.
  marginTiers?: { maxPanels: number | null; margin: number }[]; // sort by maxPanels asc, last item maxPanels=null = catch-all
  // --- Nesting-based pricing (additive, optional) ---
  // Khi `boards` có dữ liệu → engine chạy nesting (src/lib/nesting/cost.ts),
  // áp hao hụt vào materialCost (sàn 40% hoặc cao hơn nếu nesting tệ hơn),
  // cộng nhân công = numSheets × laborPerSheet. Vắng `boards` → giữ hành vi cũ.
  boards?: import('@/lib/production-catalog').CatalogBoard[]; // khổ ván stock từ catalog
  laborPerSheet?: number; // VND/tấm ván cốt (default 100_000, từ nesting/cost.ts)
  wasteMultiplierMin?: number; // sàn hao hụt (default 1.4 = 40%)
  kerfMm?: number; // mạch cưa cho nesting (default 3)
  // --- S9 (additive, đều tùy chọn) — đơn giá sản xuất bơm từ catalog admin. ---
  // Vắng mặt → engine dùng hằng số mặc định trong pricing.ts (hành vi cũ, BASELINE bất biến).
  materialRates?: Record<string, Record<number, number>>; // catalog HOẶC "catalog/id" màu → {độ dày → VND/m²}
  hardwarePrices?: Record<string, number>; // Hardware.id → VND/cái
  materialDensities?: Record<string, number>; // catalog → kg/m³
  hardwareWeights?: Record<string, number>; // Hardware.id → kg/cái
  materialLabels?: Record<string, string>; // "catalog/id" màu → tên hiển thị ở bảng giá
  // --- Edge-banding upgrade (additive) — tách giá dán cạnh thành dòng riêng ---
  // Vắng mặt → giữ hành vi cũ (KHÔNG cộng giá dán cạnh; KHÔNG trừ kích thước cắt).
  edgeBandingPricePerM?: number; // VND/m dán cạnh (default fallback nếu vắng)
  edgeBandingMmByBoardType?: Record<string, number>; // catalog → độ dày dán cạnh (mm), vd {mdf_son: 0.4}
  // (S10.1, tùy chọn) Spec phụ kiện CNC bơm từ catalog admin. Engine consume qua
  // dna.build() opts.priceConfig. Vắng mặt → DEFAULT_MACHINING_SPEC trong DNA.
  machiningSpec?: MachiningSpec;
}

/**
 * DNA của 1 sản phẩm. Mỗi products/<slug>/dna.ts export default 1 object kiểu này.
 * Đây là TẤT CẢ những gì AI viết cho mỗi sản phẩm mới.
 */
export interface ProductDNA {
  slug: string;
  name: string; // tên hiển thị, vd "Tủ kệ Module"
  parameters: Parameter[]; // núm TĨNH — dùng để seed giá trị ban đầu
  /**
   * (Tùy chọn) Danh sách BƯỚC của wizard. Có field này → Configurator hiện dạng nhiều
   * bước (mỗi lần 1 bước), chỉ vẽ núm có `Parameter.step` khớp id bước đang xem;
   * không có → vẽ toàn bộ núm phẳng như cũ.
   */
  steps?: { id: string; label: string }[];
  /**
   * (Tùy chọn, thêm ở S2) Sinh danh sách núm ĐỘNG theo giá trị hiện tại — khi số/loại
   * núm phụ thuộc tham số khác (vd: mỗi tầng 1 thanh trượt). Có hàm này → Configurator
   * render theo nó (tính lại mỗi lần đổi tham số); không có → render `parameters`.
   *
   * `context` (tùy chọn, thêm sau): Configurator có thể truyền catalog labels (KV
   * admin) để DNA gán label cho `Parameter.options[]` của vật liệu — single source
   * từ catalog. Không truyền → DNA dùng label tự sinh từ id (cho local dev / test).
   */
  resolveControls?(values: ParamValues, context?: ResolveContext): Parameter[];
  /**
   * (Tùy chọn) Chuẩn hoá value-set sau MỖI lần khách đổi 1 núm — cho phép sản phẩm tự
   * điều chỉnh tham số phụ thuộc (vd: tăng số tầng khi chiều cao vượt cỡ ô tối đa).
   * Hàm THUẦN; Configurator gọi ngay trong setState nên thay đổi là tức thời.
   */
  normalizeValues?(values: ParamValues): ParamValues;
  /**
   * (Tùy chọn) Trả danh sách câu cảnh báo cho cấu hình hiện tại (vd tổng kích thước
   * vượt giới hạn). Configurator hiện chúng trong hộp cảnh báo; rỗng → không hiện.
   * Hàm THUẦN, CHỈ để hiển thị — không chặn build().
   */
  getWarnings?(values: ParamValues): string[];
  /**
   * Sinh hình học + machining từ giá trị tham số. opts (S10.1, tùy chọn) cho
   * phép Configurator/API truyền `priceConfig` để override spec từ admin catalog
   * (vd `machiningSpec`). Vắng opts → DNA dùng default values (BASELINE giữ).
   */
  build(params: ParamValues, opts?: BuildOptions): BuildResult;
  priceConfig: PriceConfig;
}

/** Options khi gọi `dna.build()`. Tất cả tùy chọn — vắng → engine dùng default. */
export interface BuildOptions {
  /** Override config từ catalog admin (S9 prices + S10.1 machining spec). */
  priceConfig?: PriceConfig;
}
