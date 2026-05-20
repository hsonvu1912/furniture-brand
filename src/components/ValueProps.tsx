// =============================================================================
// ValueProps — 3 cột giá trị: tham số · 3D realtime · cut-list xưởng.
// Pattern maume: heading (text-2xl md:text-3xl font-bold tracking-tight) +
// caption nhỏ (text-sm text-neutral-400 mt-1) + mb-10 + grid 3 col. py-20 flat.
// =============================================================================
const PROPS = [
  {
    title: "Tham số hoá",
    body: "Cột, tầng, kích thước, vật liệu, ngăn — bạn kéo thanh trượt, tủ đổi ngay theo từng milimet. Không có 2 chiếc giống nhau.",
    accent: "page-color-coral",
  },
  {
    title: "3D realtime",
    body: "Không phải tưởng tượng. Mỗi lần chỉnh là thấy ngay khối tủ trên màn hình, xoay được, zoom được, xem trước khi đặt.",
    accent: "page-color-teal",
  },
  {
    title: "Cut-list xưởng",
    body: "Mỗi thiết kế đẻ ra bảng cắt chi tiết theo từng tấm ván, đúng quy cách xưởng VN. Đặt là làm — không sai số.",
    accent: "page-color-blue",
  },
];

export default function ValueProps() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 py-20 border-t border-neutral-200">
      <div className="mb-10">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Vì sao KÊ.</h2>
        <p className="text-sm text-neutral-400 mt-1 font-viet">3 giá trị cốt lõi</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
        {PROPS.map((p) => (
          <div key={p.title}>
            <h3 className={`text-xl md:text-2xl font-bold tracking-tight mb-3 ${p.accent}`}>
              {p.title}
            </h3>
            <p className="text-base text-neutral-600 font-viet leading-relaxed">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
