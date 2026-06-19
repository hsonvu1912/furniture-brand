// =============================================================================
// HowItWorks — 3 bước editorial (regrocery numbered steps pattern).
// Layout: heading + 3 cols numbered, mỗi col có number giant + heading + body.
// =============================================================================
import ScrollReveal from "./ScrollReveal";
import { Ngan } from "./Brand";

const STEPS = [
  {
    num: "01",
    title: "chọn mẫu",
    body: "Bắt đầu từ 1 trong 5 mẫu thiết kế sẵn (Compact, Studio, Loft, Tall, Wide), hoặc từ tờ giấy trắng. Mỗi mẫu mở Configurator để bạn chỉnh tiếp.",
  },
  {
    num: "02",
    title: "đo từng milimet",
    body: "Kéo thanh trượt — chiều rộng, cao, sâu đến từng mm. Đổi cột, đổi tầng, đổi cánh/ngăn kéo theo từng ô. Xem 3D xoay được, zoom được.",
  },
  {
    num: "03",
    title: "xưởng làm — giao",
    body: "Chốt giá, đặt 50%. Xưởng VN cắt CNC theo bản vẽ DXF, sai số 0. Giao tận nhà, lắp ráp trong 60 phút. Bảo hành 24 tháng.",
  },
];

export default function HowItWorks() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-12 py-20 md:py-28 lg:py-36">
      <div className="mb-14 md:mb-20 max-w-3xl">
        <p className="editorial-caption mb-5 md:mb-7">3 bước</p>
        <h2 className="display-huge text-accent display-italic leading-[0.95]">
          Cách <Ngan /> làm việc.
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 lg:gap-12">
        {STEPS.map((s, i) => (
          <ScrollReveal key={s.num} delay={i * 150}>
            <div className="border-t border-accent/30 pt-6 md:pt-8">
              <p
                className="text-accent/40 tabular-nums display-italic mb-4 leading-[0.8]"
                style={{ fontSize: "clamp(3rem, 6vw, 5rem)", fontWeight: 400 }}
              >
                {s.num}
              </p>
              <h3 className="display-large text-accent display-italic mb-5 leading-[0.95]">
                {s.title}
              </h3>
              <p className="text-base md:text-lg text-accent/70 font-viet leading-relaxed">
                {s.body}
              </p>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
