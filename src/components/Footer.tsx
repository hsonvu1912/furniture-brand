// =============================================================================
// Footer — Rev4 rich editorial (regrocery exact pattern).
// 5 zones:
//   1. Mantra caption row
//   2. Brand statement + email form + social
//   3. 5-col nav grid (Khám phá, Mẫu, Studio, Về KÊ., Liên lạc)
//   4. GIANT "kê_" logo with marquee animation
//   5. Bottom strip: copyright, legal, badge
// =============================================================================
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[var(--color-dark-bg)] text-[var(--color-bg)] mt-0 relative overflow-hidden">
      {/* Decorative orange line top */}
      <div className="h-[2px] bg-[var(--color-accent)]" aria-hidden />

      <div className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-12 pt-20 md:pt-28 pb-8">
        {/* Mantra row */}
        <div className="flex flex-wrap items-baseline gap-4 mb-16 md:mb-24">
          <p className="text-[11px] uppercase tracking-[0.25em] text-[var(--color-accent)] font-medium">
            Thiết kế từng milimet
          </p>
          <span className="text-[var(--color-accent)]/40">·</span>
          <p className="text-[11px] uppercase tracking-[0.25em] text-[var(--color-accent)]/70 font-medium">
            Render 3D realtime
          </p>
          <span className="text-[var(--color-accent)]/40">·</span>
          <p className="text-[11px] uppercase tracking-[0.25em] text-[var(--color-accent)]/70 font-medium">
            Xưởng Việt Nam · Since 2026
          </p>
        </div>

        {/* Brand statement + email signup */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 mb-20 md:mb-28">
          <div className="lg:col-span-7">
            <p className="display-large text-[var(--color-bg)] display-italic leading-[1.05]">
              KÊ. làm cho việc đóng tủ kệ riêng dễ hơn.
            </p>
            <p className="mt-6 text-base md:text-lg text-[var(--color-bg)]/70 font-viet leading-relaxed max-w-2xl">
              Bạn chỉnh từng milimet, chọn vật liệu, xem 3D ngay. Xưởng VN cắt CNC
              theo bản vẽ, giao tận nhà, lắp ráp trong 60 phút.
            </p>
          </div>
          <div className="lg:col-span-5">
            <p className="editorial-caption mb-5 text-[var(--color-accent)]">
              Đăng ký nhận mẫu mới
            </p>
            <form className="flex gap-2 max-w-md mb-6">
              <input
                type="email"
                placeholder="Email của bạn"
                className="flex-1 px-5 py-3 bg-transparent border border-[var(--color-bg)]/30 text-[var(--color-bg)] placeholder-[var(--color-bg)]/40 focus:border-[var(--color-accent)] focus:outline-none text-sm rounded-full font-viet"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-[var(--color-accent)] text-white text-sm font-medium rounded-full hover:bg-[var(--color-accent-hover)] transition-colors whitespace-nowrap"
              >
                Đăng ký
              </button>
            </form>
            <div className="flex items-center gap-5 text-sm text-[var(--color-bg)]/70 font-viet">
              <a
                href="https://www.instagram.com/maume.decor/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--color-accent)] transition-colors"
              >
                Instagram
              </a>
              <span className="text-[var(--color-bg)]/30">·</span>
              <a
                href="https://www.facebook.com/profile.php?id=61582885251239"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--color-accent)] transition-colors"
              >
                Facebook
              </a>
              <span className="text-[var(--color-bg)]/30">·</span>
              <a
                href="mailto:maume.decor@gmail.com"
                className="hover:text-[var(--color-accent)] transition-colors"
              >
                Email
              </a>
            </div>
          </div>
        </div>

        {/* 5-col nav grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 md:gap-6 mb-20">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-bg)]/40 font-medium mb-5">
              Khám phá
            </p>
            <ul className="space-y-3 text-sm font-viet text-[var(--color-bg)]/80">
              <li><Link href="/collection" className="hover:text-[var(--color-accent)] transition-colors">Bộ sưu tập</Link></li>
              <li><Link href="/design" className="hover:text-[var(--color-accent)] transition-colors">Thiết kế tự do</Link></li>
              <li><Link href="/lien-he" className="hover:text-[var(--color-accent)] transition-colors">Liên hệ</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-bg)]/40 font-medium mb-5">
              Mẫu sẵn
            </p>
            <ul className="space-y-3 text-sm font-viet text-[var(--color-bg)]/80">
              <li><Link href="/collection/compact" className="hover:text-[var(--color-accent)] transition-colors">Compact</Link></li>
              <li><Link href="/collection/studio" className="hover:text-[var(--color-accent)] transition-colors">Studio</Link></li>
              <li><Link href="/collection/loft" className="hover:text-[var(--color-accent)] transition-colors">Loft</Link></li>
              <li><Link href="/collection/tall" className="hover:text-[var(--color-accent)] transition-colors">Tall</Link></li>
              <li><Link href="/collection/wide" className="hover:text-[var(--color-accent)] transition-colors">Wide</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-bg)]/40 font-medium mb-5">
              Studio
            </p>
            <ul className="space-y-3 text-sm font-viet text-[var(--color-bg)]/80">
              <li>Cut-list xưởng</li>
              <li>DXF CNC export</li>
              <li>Spec gỗ &amp; vật liệu</li>
              <li>Tham số hoá</li>
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-bg)]/40 font-medium mb-5">
              Về KÊ.
            </p>
            <ul className="space-y-3 text-sm font-viet text-[var(--color-bg)]/80">
              <li>
                <a href="https://maume.asia" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-accent)] transition-colors">
                  Brand mẹ: màumè
                </a>
              </li>
              <li>Xưởng Việt Nam</li>
              <li>Bảo hành 24 tháng</li>
              <li>Since 2026</li>
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-bg)]/40 font-medium mb-5">
              Liên lạc
            </p>
            <ul className="space-y-3 text-sm font-viet text-[var(--color-bg)]/80">
              <li>
                <a href="mailto:maume.decor@gmail.com" className="hover:text-[var(--color-accent)] transition-colors break-all">
                  maume.decor@<br />gmail.com
                </a>
              </li>
              <li className="text-[var(--color-bg)]/60">
                Tp. Hồ Chí Minh · VN
              </li>
            </ul>
          </div>
        </div>

        {/* GIANT logo — full width, overflow hidden, fades into edges */}
        <div className="border-t border-[var(--color-bg)]/10 pt-12 mb-8 relative">
          <div
            className="text-[var(--color-accent)] leading-[0.78] font-medium select-none"
            style={{
              fontSize: "clamp(7rem, 32vw, 28rem)",
              letterSpacing: "-0.08em",
            }}
          >
            kê_
          </div>
          {/* Tiny meta corner */}
          <div className="absolute top-12 right-0">
            <p className="editorial-caption text-[var(--color-bg)]/40">v1.0 · 2026</p>
          </div>
        </div>

        {/* Bottom strip */}
        <div className="pt-6 border-t border-[var(--color-bg)]/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <p className="text-xs text-[var(--color-bg)]/40 font-viet">
            © {new Date().getFullYear()} KÊ. by màumè. Mọi quyền được bảo lưu.
          </p>
          <nav className="flex items-center gap-4 text-xs text-[var(--color-bg)]/40 font-viet">
            <Link href="/privacy" className="hover:text-[var(--color-accent)] transition-colors">
              Privacy
            </Link>
            <span>·</span>
            <Link href="/terms" className="hover:text-[var(--color-accent)] transition-colors">
              Terms
            </Link>
            <span>·</span>
            <Link href="/cookies" className="hover:text-[var(--color-accent)] transition-colors">
              Cookies
            </Link>
          </nav>
          <p className="text-xs text-[var(--color-bg)]/40 font-viet italic">
            Crafted with care in Vietnam
          </p>
        </div>
      </div>
    </footer>
  );
}
