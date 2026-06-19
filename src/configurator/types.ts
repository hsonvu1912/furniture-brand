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
  type: 'number' | 'option' | 'cellgrid' | 'info';
  // 'info' (P36) → KHÔNG phải núm: chỉ render `label` như dòng gợi ý trong panel.
  // Dùng để 1 tab tồn tại trong khi thao tác chính nằm trên mô hình 3D (vd tab "Ô tủ").
  group?: string; // gom các núm liên tiếp cùng group vào 1 khung có tiêu đề (vd "Chiều rộng")
  stepId?: string; // (wizard) id bước chứa núm này — khớp 1 phần tử ProductDNA.steps
  // (lưu ý: KHÁC `step` bên dưới — `step` là bước nhảy thanh trượt số)
  // type 'number' → thanh trượt:
  min?: number;
  max?: number;
  step?: number;
  unit?: string; // vd "mm" (chỉ để hiển thị)
  /** (Tùy chọn) 'number' → hiển thị READ-ONLY dạng dòng số (label + giá trị),
   *  KHÔNG slider/input. Dùng cho derived value (vd tổng = Σ ô ở manual mode). */
  readonly?: boolean;
  /** (P36 v3, tùy chọn) 'number' → CHỈ slider (kéo), giá trị hiện read-only, KHÔNG
   *  ô nhập số. Vì ô nhập chỉ commit on-blur (không tương tác 3d realtime khi gõ);
   *  slider onChange cập nhật 3d ngay. Dùng cho Tổng rộng/cao. */
  sliderOnly?: boolean;
  /** (P39, tùy chọn) 'number' slider → gom onChange theo KHUNG HÌNH (requestAnimationFrame,
   *  ~60fps) trước khi báo lên. Tránh dựng lại 3D hàng trăm lần/giây khi kéo (vd Tổng rộng). */
  throttle?: boolean;
  /** (P45, tùy chọn) Chỉ HIỂN THỊ control khi Configurator mode='admin' (vd "Loại
   *  tay nắm" — set theo preset, khách không đổi). Giá trị vẫn nằm trong values nên
   *  round-trip qua preset bình thường; chỉ ẩn UI ở mode khác admin. */
  adminOnly?: boolean;
  /** (Tùy chọn) 'number' → render thành SEGMENTED 3 nấc thay vì slider. Mỗi nấc
   *  là 1 giá trị rời rạc (vd chiều cao tầng [150,300,450]). */
  steps?: number[];
  /** (P36, tùy chọn) Trên param TỔNG (vd 'height'): các nấc rời rạc HỢP LỆ cho
   *  từng HÀNG — UI dùng cho popup "chỉnh cao từng tầng" khi chạm hàng trên 3D.
   *  KHÁC `steps` (steps làm param render segmented; rowSteps chỉ là metadata). */
  rowSteps?: number[];
  /** (P36, tùy chọn) Trên param TỔNG 'width': [min, max] LIÊN TỤC cho slider
   *  "chỉnh rộng từng cột" khi chạm cột trên 3D (width liên tục, không nấc). */
  colRange?: [number, number];
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
  // 'cellgrid' → cách codec lưu giá trị (Phase 2+):
  //  - 'uniform' (default, vắng = uniform): chuỗi legacy "a,b;c,d" rows × cols ô vuông.
  //  - 'blocks': chuỗi block-list "r,c,rs,cs,t|..." cho phép split (sub-cell) + merge
  //    (Excel-like). DNA opt-in mới có nút Chia/Gộp trong CellBar. Chi tiết codec
  //    xem `src/configurator/cellgrid.ts`. Auto-detect ở runtime nên DNA legacy
  //    KHÔNG cần khai báo (vẫn parse được).
  cellLayoutMode?: 'uniform' | 'blocks';
  default: number | string; // 'cellgrid' → chuỗi mã hoá lưới
}

/** Dán cạnh theo 4 cạnh của mặt length×width. */
export interface EdgeBanding {
  front: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
}

/** P49/P52: MÀU dán cạnh khách chọn — id từ palette EDGE_BAND_COLORS (materials.ts).
 *  'same' = đồng màu mặt ván · 'black'/'white' · 'ml_*' = 14 màu Minh Long.
 *  Nới thành `string` (P52) để thêm màu tuỳ ý mà không phải sửa union khắp nơi. */
export type EdgeBandingType = string;

/** P49: spec 1 loại dán cạnh đã GIẢI (engine consume qua PriceConfig.edgeBands). */
export interface ResolvedEdgeBand {
  enabled: boolean; // admin bật → hiện cho khách chọn
  pricePerM: number; // VND/m
  thicknessMm: number; // độ dày dùng cho cắt-bù kích thước (= min(thicknesses))
  widths: number[]; // các khổ (mm) — tham khảo cho xưởng
  thicknesses: number[]; // các độ dày (mm) — tham khảo
  hex?: string; // P52: màu nẹp (vắng = đồng màu); báo giá/DXF/renderer dùng
  label?: string; // P52: tên hiển thị (vd "Xanh rêu") — báo giá dùng
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

/** Mục đích lỗ — UI/xưởng filter và label DXF layer.
 *  P74: BỎ 'confirmat'/'dowel'/'shelfPin' — toàn bộ liên kết ván↔ván chuyển sang
 *  connector 2-in-1 ('connector'); tấm hậu dùng chốt lò xo ('backScrew'). */
export type MachiningPurpose =
  | 'handle' // tay nắm Ø35 (đã có trong PanelHole, thêm bản structured)
  | 'hinge' // bản lề âm cup Ø35 + 2 vít M4 (chuẩn Blum/Hettich)
  | 'drawerSlide' // vít bắt thân ray âm vào mặt vách (lỗ mồi Ø2.5 — P76)
  | 'drawerRailPin' // P76 — lỗ Ø6 trên hậu hộc đón chốt đuôi ray âm
  | 'backScrew' // chốt lò xo tấm hậu (pin cạnh hậu + lỗ đón mặt tấm ngang — P74)
  | 'foot' // chân tủ Ø8 định vị xuyên đáy
  | 'connector' // P74 — connector 2-in-1 (lỗ chốt Ø8 cạnh + rãnh PAT trên mặt)
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
 * P74 — 1 rãnh OVALE (obround: 2 đầu bo tròn) phay trên MẶT tấm — cho PAT của
 * connector 2-in-1. Rãnh 2 cấp sâu = 2 op slot LỒNG NHAU cùng tâm (vành nông cho
 * PAT chìm + rãnh giữa sâu cho đầu pin trượt). Tâm rãnh tại (x_mm, y_mm); trục
 * dài rãnh theo `along`: 'length' = dọc trục x tấm, 'width' = dọc trục y tấm.
 */
export interface MachiningSlot {
  op: 'slot';
  purpose: MachiningPurpose;
  side: MachiningSide;
  x_mm: number; // tâm rãnh, ≥0
  y_mm: number; // tâm rãnh, ≥0
  length_mm: number; // chiều dài rãnh (gồm 2 đầu bo tròn)
  width_mm: number; // bề rộng rãnh (= Ø 2 đầu bo)
  depth_mm: number;
  along: 'length' | 'width'; // hướng trục dài rãnh trên tấm
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

export type Machining = MachiningDrill | MachiningPocket | MachiningSlot | MachiningEdgeDrill;

// =============================================================
// MACHINING SPEC — S10.1 (additive). Hằng số kích thước phụ kiện CNC (cup bản
// lề, ray, connector 2-in-1, chốt lò xo hậu, chân, tay nắm). Founder edit
// trong admin /admin/ke-catalog tab "Phụ kiện & CNC" → KV lưu → engine consume
// qua PriceConfig.machiningSpec (DEFAULT fallback cho missing fields).
//
// Mode field (foot/handle) cho phép switch implementation — vd `handle.mode`
// 'recessed'/'bar'/'cup_pull'. Admin UI render form khác nhau theo mode.
// P74: toàn bộ liên kết ván↔ván = connector 2-in-1 (xem ConnectorSpec).
// =============================================================

/** Chén bản lề âm Ø35 + 2 lỗ mồi vít chén.
 *  P75 — theo Häfele Metalla A 110° lọt lòng 311.88.512: chén Ø35 sâu 12,
 *  hệ vít 48/6 (2 vít cách nhau 48 = ±24, tâm vít LÙI 6mm vào lòng cánh so
 *  với tâm chén), vít gỗ Ø3.5 → lỗ mồi Ø2.5. */
export interface HingeCupSpec {
  cupDia: number; // Ø chén (default 35)
  cupDepth: number; // sâu chén (default 12 — chính hãng Hafele)
  cupInsetFromEdge: number; // tâm chén cách mép cánh (default 22 = K 4.5mm, range Hafele 3-7)
  cupScrewDia: number; // Ø LỖ MỒI vít chén (default 2.5 cho vít gỗ Ø3.5)
  cupScrewDepth: number; // sâu lỗ mồi (default 10)
  cupScrewOffset: number; // 2 vít chén cách tâm chén ±N theo trục dài (default 24 — hệ 48)
  cupScrewBackset: number; // tâm vít LÙI vào lòng cánh so với tâm chén (default 6 — hệ /6)
}

/** Bát (đế) bản lề trên vách — Häfele 311.98.700 chữ thập trượt, 2 vít ván dăm. */
export interface HingePlateSpec {
  plateInsetFromEdge: number; // tâm bát cách mép trước vách (default 37 — bản vẽ Hafele)
  plateScrewSpan: number; // 2 vít bát cách nhau (default 32 — system 32, bản vẽ Hafele)
  plateScrewDia: number; // Ø LỖ MỒI vít bát (default 2.5 cho vít ván dăm Ø3.5)
  plateScrewDepth: number; // sâu lỗ mồi (default 11)
}

/**
 * P76 — RAY ÂM Hafele EPC Plus mở 3/4 giảm chấn (433.03.001-.004, dài
 * 270/300/350/400 theo nấc sâu tủ — bảng RAIL_BY_DEPTH trong dna). Ray nằm
 * DƯỚI ĐÁY hộc: thân ray bắt vít vào MẶT VÁCH sát đáy ô (hệ lỗ 32mm), đuôi
 * ray có chốt cắm vào 2 lỗ Ø6 trên HẬU HỘC, khóa nhựa phía trước xưởng tự
 * bắt (không CNC). Thay ray bi 2 bên hông cũ (cụm vít giữa ô + khe 13mm).
 */
export interface DrawerSlideSpec {
  // --- Vít bắt RAY vào VÁCH — theo BẢN VẼ LẮP chính hãng (P76.1, đọc trực tiếp):
  //     mỗi vị trí cụm có 2 LỖ ĐỨNG cách railScrewRowSpacing (12); các cụm nằm tại
  //     {0, 128, 224} (hằng RAIL_CLUSTER_OFFSETS trong dna) tính từ lỗ đầu — lỗ đầu
  //     cách mép trước ray railFirstScrewFromFront (37). Ray 270 dùng 2 cụm, ≥300: 3.
  railScrewPilotDia: number; // Ø lỗ mồi (default 2.5 cho vít Hospa Ø3.5)
  railScrewPilotDepth: number; // sâu lỗ mồi (default 11)
  railFirstScrewFromFront: number; // lỗ đầu cách MÉP TRƯỚC RAY (default 37 — bản vẽ)
  railScrewRowFromCellBottom: number; // hàng vít DƯỚI so ĐÁY Ô (default 10.2 — bản vẽ)
  railScrewRowSpacing: number; // hàng trên cách hàng dưới (default 12 — bản vẽ)
  railSetbackFromFront: number; // mép trước ray lùi so mặt sau mặt ngăn kéo (default 0) [xưởng xác nhận]
  // --- Bề rộng hộc — bản vẽ: LÒNG TRONG hộc = LÒNG TỦ − boxInnerWidthOffset (42).
  //     bw (ngoài) = lòng tủ − 42 + 2×dày thành → thành 17 khe 4/bên, thành 18 khe 3.
  boxInnerWidthOffset: number; // default 42 (箱体内宽 B−42 trên bản vẽ)
  // --- Chốt đuôi ray — lỗ định vị trên HẬU HỘC (bản vẽ: Ø6, cách sườn 7 / mép dưới 11) ---
  backPinHoleDia: number; // Ø lỗ (default 6)
  backPinHoleDepth: number; // sâu (default 10) [xưởng xác nhận chiều chốt]
  backPinFromSideEdge: number; // tâm lỗ cách mép sườn hậu hộc (default 7 — bản vẽ)
  backPinFromBottom: number; // tâm lỗ cách mép dưới hậu hộc (default 11 — bản vẽ)
  // --- Vít mặt ngăn kéo ↔ hông hộc (giữ semantics cũ) ---
  screwDia: number; // Ø vít (default 4)
  screwDepth: number; // sâu (default 12)
}

/**
 * P74 — Connector 2-in-1 (chốt kim loại Ø8×30 ren + PAT 50×12×2): liên kết MỌI
 * giao ván↔ván (vách↔nóc/đáy/đợt ngang, vách phụ chia ô↔tấm nhận). Lắp: chốt
 * vặn vào LỖ CẠNH tấm đứng (pin Ø5 nhô ra) + PAT bắt vít trong RÃNH khoét trên
 * MẶT tấm nhận → ghép, pin trượt theo rãnh khoá lại. Thay confirmat+dowel+chốt
 * kệ (đã bỏ P74 — kết cấu cũ không khớp xưởng).
 */
export interface ConnectorSpec {
  pinHoleDia: number; // Ø lỗ cạnh vặn chốt (default 8)
  pinHoleDepth: number; // sâu lỗ cạnh (default 32 — thân chốt 30)
  slotLength: number; // dài rãnh PAT trên mặt tấm nhận (default 50)
  slotWidth: number; // rộng rãnh PAT (default 13 — PAT 12 + dơ 1)
  rimDepth: number; // sâu vành cho PAT chìm (default 2)
  channelLength: number; // dài rãnh giữa cho đầu pin trượt (default 24)
  channelWidth: number; // rộng rãnh giữa (default 9 — đầu pin Ø5 + khoá)
  channelDepth: number; // sâu rãnh giữa (default 8.5, tính từ mặt ván)
  perJoint: number; // số bộ mỗi giao điểm (default 2 — 1 trước + 1 sau)
  insetFromFront: number; // tâm bộ 1 cách mép trước (default 50)
  insetFromBack: number; // tâm bộ 2 cách mép sau (default 50)
}

/**
 * P74 — Chốt lò xo tấm hậu: pin cắm vào LỖ CẠNH trên/dưới tấm hậu (ván 9mm) +
 * LỖ ĐÓN tương ứng trên MẶT nóc/đáy/đợt ngang tại vị trí tấm hậu. (Trước P74
 * lỗ clip nằm SAI trên mặt vách đứng — founder xác nhận 2026-06-12.)
 */
export interface BackFastenerSpec {
  pinDia: number; // Ø lỗ cạnh tấm hậu cắm chốt (default 5 — cạnh ván 9mm)
  pinHoleDepth: number; // sâu lỗ cạnh hậu (default 25)
  faceHoleDia: number; // Ø lỗ đón trên mặt tấm ngang (default 8)
  faceHoleDepth: number; // sâu lỗ đón (default 10)
  pinsPerEdge: number; // số chốt mỗi cạnh hậu (default 2)
  marginFromCellEdge: number; // chốt cách mép trái/phải ô (default 80)
}

/** Chân tủ — 3 mode pin/plate/screw. */
export interface FootSpec {
  mode: 'pin'; // P77 — chỉ chân nút mỏng cấy chốt Ø8 (founder chốt; bỏ plate/screw chưa có code)
  pinDia: number; // Ø định vị (default 8) — engine đọc
  pinDepth: number; // sâu (default 12) — engine đọc
  insetFromEdge: number; // tâm chân cách mép trước/sau đáy (default 90) — engine đọc, clamp ≥85 tránh đè rãnh
  positionsPerDivider: number; // số chân/vách (default 2 — trước+sau; 1 → 1 chân giữa) — engine đọc
}

/** Tay nắm — quy cách KHOAN (loại tay nắm chọn ở preset qua handleType, KHÔNG ở đây).
 *  P77: engine ĐỌC mọi field (trước recessedDia/Inset/barSpacing là hằng cứng). */
export interface HandleSpec {
  // Tay nắm TRÒN (round):
  recessedDia: number; // Ø lỗ khoét xuyên (default 35)
  recessedInsetFromEdge: number; // tâm lỗ cách mép cánh (default 40)
  // Tay nắm BAR (thanh):
  barSpacing?: number; // 2 vít cách nhau (default 64; clamp trong thân thanh)
  barScrewDia?: number; // Ø vít (default 4)
}

/** Toàn bộ spec machining. P74: confirmat/dowel/shelfPin → connector (2-in-1). */
export interface MachiningSpec {
  hingeCup: HingeCupSpec;
  hingePlate: HingePlateSpec;
  drawerSlide: DrawerSlideSpec;
  connector: ConnectorSpec;
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
  /** (P45, tùy chọn) Hướng bản lề cánh — true = bản lề mép TRÁI (cánh mở sang
   *  trái). Engine set TƯỜNG MINH cho mọi cánh để renderer animate đúng — đặc biệt
   *  cần khi tay nắm dạng BAR căn giữa (không suy được hướng từ vị trí lỗ tay nắm).
   *  Vắng → renderer suy theo holes[0].dx / strip fitting (cơ chế cũ, vẫn giữ). */
  hingeOnLeft?: boolean;
  /** (P83, tùy chọn) Bán kính VÁT GÓC (mm) khi render 3D — CHỈ ảnh hưởng hình hoạ:
   *  renderer bo cạnh tấm bằng RoundedBox để các module nhìn tách bạch (không dính
   *  liền). KHÔNG đụng kích thước cắt / giá / DXF (chúng đọc size·length·width).
   *  Tủ x KHÔNG set → render hệt cũ. Hiện chỉ tủ y gắn cho ván thân (không cánh). */
  chamfer_mm?: number;
  // (Edge-banding upgrade, tùy chọn) Chu vi bản vẽ (mm) = 2×(length_mm + width_mm)
  // KHI vật liệu có dán cạnh (resolveMaterial(material).noEdgeBanding !== true).
  // Set bởi buildCutlist; cutlist tổng hợp ra mét dán cạnh, pricing nhân giá/m.
  // Material lộ cạnh (vd plywood An Cường) → perimeter = undefined.
  perimeter?: number;
  /** (P49, tùy chọn) Loại MÀU dán cạnh của tấm này: khung/vách = theo lựa chọn khách
   *  (same/black/white); cánh/ngăn kéo LUÔN 'same'; tấm lộ cạnh (plywood) → undefined.
   *  cutlist/pricing gom theo field này; renderer dùng `edgeHex`. */
  edgeColor?: EdgeBandingType;
  /** (P49, tùy chọn) Hex màu cạnh đã giải để renderer/DXF vẽ: '#000000' đen, '#FFFFFF'
   *  trắng; 'same' → undefined (renderer dùng màu mặt ván). */
  edgeHex?: string;
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
   *  - 'handle-bar' (P45): thanh tay nắm đen mờ CĂN GIỮA + 2 trụ đỡ, nhô ra trước
   *    mặt cánh — size = [length|cạnh, height|cạnh, depth] (cả grip lẫn trụ đều box)
   */
  kind: 'foot' | 'handle-strip' | 'handle-bar';
  size: [number, number, number]; // hộp bao (mm) — foot: [Ø, cao, Ø]; handle-strip/bar: [length, height, depth]
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
  /** (P49) Các loại dán cạnh admin ĐÃ BẬT — resolveControls lọc option 'edgeBanding'
   *  chỉ hiện các loại này. Vắng → hiện cả 3 (default an toàn cho local/test). */
  enabledEdgeBands?: EdgeBandingType[];
}

/** P65 — Hốc trống của 1 ô MỞ (open-back/open-nobk, ô đơn) để đặt props trang trí
 *  khi chụp thumbnail. Toạ độ + kích thước lòng hốc theo scene coords (mm). */
export interface CellCavity {
  col: number;
  row: number;
  type: 'open-back' | 'open-nobk';
  cx: number; // center X
  floorY: number; // Y mặt sàn hốc
  cz: number; // center Z (0 = giữa sâu tủ)
  w: number; // rộng lòng hốc
  h: number; // cao lòng hốc
  d: number; // sâu lòng hốc (đã trừ hậu + khe trước)
}

/** Kết quả của build(): danh sách tấm cắt + phụ kiện. */
export interface BuildResult {
  parts: Part[];
  hardware: Hardware[];
  fittings?: Fitting[]; // (tùy chọn) phụ kiện có hình khối 3D, không phải tấm cắt — vd chân tủ
  /** (Tùy chọn) Vị trí + kích thước thông thuỷ từng cột/tầng để render dim labels per-cell. */
  gridLines?: {
    colCenters: number[]; // X center của từng cột (scene coords)
    colWidths: number[];  // chiều rộng thông thuỷ mỗi cột (mm)
    rowCenters: number[]; // Y center của từng tầng (scene coords)
    rowHeights: number[]; // chiều cao thông thuỷ mỗi tầng (mm)
  };
  /** P60 — Kích thước phủ bì (mm) để pricing tính THỂ TÍCH (m³) cho margin. */
  size?: { w: number; h: number; d: number };
  /** P60 — Số ngăn kéo + số cánh (đo "độ phức tạp" cho phụ trội margin). */
  drawerCount?: number;
  doorCount?: number;
  /** P65 — hốc ô mở (đặt props khi chụp thumbnail). Chỉ render dùng, additive. */
  cavities?: CellCavity[];
  /** P84 — TỦ Y: đếm module theo khoá `${cells}-${attribute}` (cells = gw*gh ∈
   *  {2,4,6,8} ↔ 18/36/54/72cm; attribute ∈ open-nobk/open-back/door). VỪA là CỜ
   *  nhận biết tủ y cho computePrice (x KHÔNG set), VỪA là đầu vào tính nhân công
   *  theo loại ô (× config.tuYCellLabor). Chỉ tu-y.build() set. */
  moduleCounts?: Record<string, number>;
}

/** Cấu hình tính giá cho 1 sản phẩm. */
export interface PriceConfig {
  margin: number; // hệ số nhân lãi, vd 1.6
  laborPerOrder?: number; // tiền công cố định mỗi đơn (VND) — DEPRECATED khi có boards (xài laborPerSheet)
  // --- Stepped margin theo THỂ TÍCH (m³) — P60 (additive, optional) ---
  // Khi `marginTiers` có data → engine dùng `computeMargin(volumeM3, units, tiers)`:
  // anchor `vol` = ngưỡng thể tích (m³); nội suy tuyến tính giữa anchor, plateau 2 đầu.
  // Tủ nhỏ (m³ thấp) margin thấp = phễu; tủ to margin cao = lợi nhuận. Ngăn kéo KHÔNG
  // đẩy margin (khác P12 cũ theo panel count). Vắng → fallback flat `margin`.
  marginTiers?: { vol: number; margin: number }[]; // sort by vol asc
  // P72 — ĐÃ BỎ phụ trội phức tạp theo số ngăn/cánh (complexityBonusPerUnit/Max):
  // margin khung chỉ còn theo thể tích; chi phí ngăn kéo nằm ở vật liệu + ray.
  // --- Nesting-based pricing (additive, optional) ---
  // Khi `boards` có dữ liệu → engine chạy nesting (src/lib/nesting/cost.ts),
  // áp hao hụt vào materialCost (sàn 40% hoặc cao hơn nếu nesting tệ hơn),
  // cộng nhân công = numSheets × laborPerSheet. Vắng `boards` → giữ hành vi cũ.
  boards?: import('@/lib/production-catalog').CatalogBoard[]; // khổ ván stock từ catalog
  laborPerSheet?: number; // VND/tấm ván cốt (default 100_000, từ nesting/cost.ts)
  wasteMultiplierMin?: number; // sàn hao hụt (default 1.4 = 40%)
  kerfMm?: number; // mạch cưa cho nesting (default 3)
  // P69 — Hệ số lãi RIÊNG cho phụ kiện (mua sẵn, lãi mỏng). Phụ kiện KHÔNG nhân margin
  // khung (theo m³) mà nhân `hardwareMargin` cố định. Default 1.2 (=+20%). Vắng → 1.2.
  hardwareMargin?: number;
  // --- S9 (additive, đều tùy chọn) — đơn giá sản xuất bơm từ catalog admin. ---
  // Vắng mặt → engine dùng hằng số mặc định trong pricing.ts (hành vi cũ, BASELINE bất biến).
  materialRates?: Record<string, Record<number, number>>; // catalog HOẶC "catalog/id" màu → {độ dày → VND/m²}
  hardwarePrices?: Record<string, number>; // Hardware.id → VND/cái
  materialDensities?: Record<string, number>; // catalog → kg/m³
  hardwareWeights?: Record<string, number>; // Hardware.id → kg/cái
  materialLabels?: Record<string, string>; // "catalog/id" màu → tên hiển thị ở bảng giá
  // --- Edge-banding upgrade (additive) — tách giá dán cạnh thành dòng riêng ---
  // Vắng mặt → giữ hành vi cũ (KHÔNG cộng giá dán cạnh; KHÔNG trừ kích thước cắt).
  edgeBandingPricePerM?: number; // VND/m dán cạnh (P49: fallback cũ — thường vắng)
  edgeBandingMmByBoardType?: Record<string, number>; // catalog → độ dày (P49: fallback cũ)
  /** (P49) Spec 3 loại dán cạnh đã giải (same/black/white) — engine gom Part theo
   *  edgeColor → giá/m + độ dày cắt-bù. Nguồn chính (thay edgeBandingPricePerM). */
  edgeBands?: Record<EdgeBandingType, ResolvedEdgeBand>;
  // (S10.1, tùy chọn) Spec phụ kiện CNC bơm từ catalog admin. Engine consume qua
  // dna.build() opts.priceConfig. Vắng mặt → DEFAULT_MACHINING_SPEC trong DNA.
  machiningSpec?: MachiningSpec;
  // --- P84 TỦ Y (admin chỉnh trong catalog) — chỉ áp khi build.moduleCounts có data ---
  /** Hệ số lãi PHẲNG tủ y (vd 2.2). Vắng → 2.2. Thay margin theo thể tích của x. */
  tuYMargin?: number;
  /** Hao hụt ván tủ y (tỉ lệ, vd 0.15 = 15%). Vắng → 0.15 mặc định. */
  tuYWasteRatio?: number;
  /** Nhân công tủ y theo loại ô: khoá `${cells}-${attribute}` → VND/ô. Vắng/0 → công 0. */
  tuYCellLabor?: Record<string, number>;
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
