// =============================================================================
// ValueProps — regrocery editorial pattern: centered display heading + 3 cols.
// =============================================================================
import ScrollReveal from "./ScrollReveal";

const PROPS = [
  {
    num: "01",
    title: "tham số hoá",
    body: "Cột, tầng, kích thước, vật liệu, ngăn — bạn kéo thanh trượt, tủ đổi ngay theo từng milimet. Không có 2 chiếc giống nhau.",
  },
  {
    num: "02",
    title: "3D realtime",
    body: "Không phải tưởng tượng. Mỗi lần chỉnh là thấy ngay khối tủ trên màn hình, xoay được, zoom được, xem trước khi đặt.",
  },
  {
    num: "03",
    title: "cut-list xưởng",
    body: "Mỗi thiết kế đẻ ra bảng cắt chi tiết theo từng tấm ván, đúng quy cách xưởng VN. Đặt là làm — không sai số.",
  },
];

export default function ValueProps() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-12 py-24 md:py-32 lg:py-40">
      <h2 className="display-huge text-accent display-italic text-center mb-20 md:mb-28 leading-[0.95]">
        Vì sao KÊ.
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-10 lg:gap-16">
        {PROPS.map((p, i) => (
          <ScrollReveal key={p.title} delay={i * 150}>
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-accent font-medium mb-4 tabular-nums">
                {p.num}
              </p>
              <h3 className="display-large text-accent display-italic mb-5 leading-[0.95]">
                {p.title}
              </h3>
              <p className="text-base md:text-lg text-accent/70 font-viet leading-relaxed max-w-xs mx-auto">
                {p.body}
              </p>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
