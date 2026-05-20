// =============================================================================
// Footer — gọn hơn maume (KÊ chưa có nhiều page). Brand block + social links
// của thương hiệu mẹ màumè + nav + copyright. Email dùng cùng maume.decor.
// =============================================================================
import Link from "next/link";
import KeLogo from "./KeLogo";

export default function Footer() {
  return (
    <footer className="border-t border-neutral-200 mt-16 md:mt-24 bg-neutral-50/50">
      <div className="max-w-[1400px] mx-auto px-6 py-12 md:py-16">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          <div>
            <Link href="/" className="logo-link inline-block">
              <KeLogo size="sm" />
            </Link>
            <p className="text-sm text-neutral-400 mt-2 italic font-viet">
              Tủ kệ tham số · xưởng Việt Nam.
            </p>

            <div className="flex items-center gap-3 mt-4">
              <a
                href="https://www.instagram.com/maume.decor/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-gradient-to-tr hover:from-[#833AB4] hover:via-[#E1306C] hover:to-[#F77737] hover:text-white transition-all duration-300"
                aria-label="Instagram"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </a>
              <a
                href="https://www.facebook.com/profile.php?id=61582885251239"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-[#1877F2] hover:text-white transition-all duration-300"
                aria-label="Facebook"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
              <span className="w-px h-4 bg-neutral-200" />
              <a
                href="mailto:maume.decor@gmail.com"
                className="text-xs text-neutral-400 hover:text-black transition-colors font-viet"
              >
                maume.decor@gmail.com
              </a>
            </div>
          </div>

          <nav className="flex gap-6 text-sm text-neutral-500 font-viet">
            <Link href="/collection" className="hover:text-black transition-colors">
              Bộ sưu tập
            </Link>
            <Link href="/design" className="hover:text-black transition-colors">
              Thiết kế
            </Link>
            <Link href="/lien-he" className="hover:text-black transition-colors">
              Liên hệ
            </Link>
          </nav>
        </div>

        <div className="mt-10 pt-6 border-t border-neutral-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <p className="text-xs text-neutral-400 font-viet">
            © {new Date().getFullYear()}{" "}
            <span className="gradient-text font-bold tracking-tight">KÊ. by màumè</span>.
            Mọi quyền được bảo lưu.
          </p>
          <p className="text-xs text-neutral-300 font-viet">Thiết kế Việt Nam</p>
        </div>
      </div>
    </footer>
  );
}
