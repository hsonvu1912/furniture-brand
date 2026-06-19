// =============================================================================
// StorySection — editorial story block (regrocery "Stay in the Loop" adapted).
// Pattern: 2-col layout, 1 ảnh + caption pull quote bên, hoặc 1-col centered.
// =============================================================================
import Link from "next/link";
import { Ngan } from "./Brand";

export default function StorySection() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-12 py-20 md:py-28 lg:py-36">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 md:gap-16 items-center">
        {/* Left: pull quote text */}
        <div className="lg:col-span-7 order-2 lg:order-1">
          <p className="editorial-caption mb-5 md:mb-7">Triết lý làm tủ</p>
          <blockquote className="display-large text-accent display-italic leading-[1.05] mb-8">
            “Không có 2 ngôi nhà giống nhau,<br />
            nên không có 2 chiếc tủ giống nhau.”
          </blockquote>
          <p className="text-base md:text-lg text-accent/80 font-viet leading-relaxed max-w-xl mb-8">
            <Ngan /> tin rằng nội thất nên đo theo bạn, không phải bạn co theo nội thất.
            Mỗi bản vẽ chúng tôi gửi xưởng là duy nhất, theo từng milimet bạn chỉnh.
          </p>
          <Link href="/design" className="pill-outline">
            Thử thiết kế →
          </Link>
        </div>

        {/* Right: visual block */}
        <div className="lg:col-span-5 order-1 lg:order-2">
          <div
            className="relative aspect-[4/5] overflow-hidden"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(247,76,37,0.12) 0%, rgba(247,76,37,0.04) 50%, transparent 100%)",
            }}
          >
            {/* Centered text mark */}
            <div className="absolute inset-0 flex items-center justify-center">
              <p
                className="font-lora font-medium not-italic text-accent leading-[0.8] text-center select-none tracking-tight"
                style={{ fontSize: "clamp(6rem, 18vw, 14rem)" }}
              >
                ngăn
              </p>
            </div>
            {/* Corner markings */}
            <div className="absolute top-4 left-4 text-accent/60">
              <p className="editorial-caption">since 2026</p>
            </div>
            <div className="absolute bottom-4 right-4 text-accent/60 text-right">
              <p className="editorial-caption">made in vietnam</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
