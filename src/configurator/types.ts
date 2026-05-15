// =============================================================
// HỢP ĐỒNG DNA — KHÓA Ở SESSION 1, KHÔNG ĐỔI VỀ SAU.
// Mọi sản phẩm (products/<slug>/dna.ts) phải tuân theo các kiểu này.
// Đổi file này = phải sửa lại MỌI sản phẩm cũ → chỉ đổi khi thật cần.
// =============================================================

/** Một núm khách hàng chỉnh được trên configurator (rộng, cao, số tầng, màu...). */
export interface Parameter {
  id: string; // mã, vd "width" — build() đọc qua params[id]
  label: string; // nhãn tiếng Việt hiện cho khách, vd "Chiều rộng"
  type: 'number' | 'option';
  // type 'number' → thanh trượt:
  min?: number;
  max?: number;
  step?: number;
  unit?: string; // vd "mm" (chỉ để hiển thị)
  // type 'option' → nút chọn / swatch màu:
  options?: { value: string; label: string }[];
  default: number | string;
}

/** Dán cạnh theo 4 cạnh của mặt length×width. */
export interface EdgeBanding {
  front: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
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
}

/** Phụ kiện — đếm theo cái, không có kích thước cắt (bản lề, ray, ốc, chân...). */
export interface Hardware {
  id: string;
  label: string; // vd "Bản lề giảm chấn"
  qty: number;
}

/** Giá trị tham số khách đang chọn — map từ Parameter.id → giá trị. */
export type ParamValues = Record<string, number | string>;

/** Kết quả của build(): danh sách tấm cắt + phụ kiện. */
export interface BuildResult {
  parts: Part[];
  hardware: Hardware[];
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
  parameters: Parameter[];
  build(params: ParamValues): BuildResult;
  priceConfig: PriceConfig;
}
