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
  cellVariant?: 'type' | 'color' | 'subgrid'; // 'cellgrid' → 'type' (chọn loại ô) | 'color' (chọn màu ô) | 'subgrid' (carrier cho sub-cells map, no direct UI)
  // 'cellgrid' → cho phép ô chia thành sub-cells (xem subgrid.ts). Khi true, CellMenu
  // hiện thêm nút "Chia ô" cho các value cho phép (vd open-back/open-nobk).
  subGridAllowed?: boolean;
  // 'cellgrid' → value đặc biệt báo ô đang là container chứa sub-cells (mặc định 'split').
  subContainerValue?: string;
  // 'cellgrid' → id của parameter lưu subCells map (vd 'subCells') — UI cross-ref.
  subGridSourceId?: string;
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
  kind: 'foot'; // loại phụ kiện — renderer chọn hình dạng theo đây
  size: [number, number, number]; // hộp bao (mm) — foot: [đường kính, cao, đường kính]
  position: [number, number, number]; // TÂM khối trong toạ độ scene (mm)
}

/** Giá trị tham số khách đang chọn — map từ Parameter.id → giá trị. */
export type ParamValues = Record<string, number | string>;

/** Kết quả của build(): danh sách tấm cắt + phụ kiện. */
export interface BuildResult {
  parts: Part[];
  hardware: Hardware[];
  fittings?: Fitting[]; // (tùy chọn) phụ kiện có hình khối 3D, không phải tấm cắt — vd chân tủ
}

/** Cấu hình tính giá cho 1 sản phẩm. */
export interface PriceConfig {
  margin: number; // hệ số nhân lãi, vd 1.6
  laborPerOrder?: number; // tiền công cố định mỗi đơn (VND)
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
   */
  resolveControls?(values: ParamValues): Parameter[];
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
  build(params: ParamValues): BuildResult;
  priceConfig: PriceConfig;
}
