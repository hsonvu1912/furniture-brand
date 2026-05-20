"use client";

// =============================================================================
// Header — sticky top. Logo trái + 3 nav link / hamburger mobile. KHÔNG có
// cart/wishlist như maume (KÊ là pure-config site, chưa có shopping cart).
// Outer container `max-w-[1920px] mx-auto` đồng bộ PageWrapper. Inner
// `max-w-[1400px]` đồng bộ section. Mobile menu links có accent color hover.
// =============================================================================
import Link from "next/link";
import { useState, useEffect } from "react";
import KeLogo from "./KeLogo";

const NAV = [
  { href: "/collection", label: "Bộ sưu tập", accent: "page-color-coral" },
  { href: "/design", label: "Thiết kế tự do", accent: "page-color-teal" },
  { href: "/lien-he", label: "Liên hệ", accent: "page-color-blue" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (menuOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 border-b border-neutral-100 max-w-[1920px] mx-auto ${
          menuOpen ? "bg-[#FDFBF7]" : "bg-white/80 backdrop-blur-xl"
        }`}
      >
        <div className="max-w-[1400px] mx-auto px-6 h-14 md:h-20 flex items-center justify-between">
          <Link href="/" className="logo-link" aria-label="Trang chủ KÊ. by màumè">
            <KeLogo size="md" />
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm md:text-base font-medium text-neutral-600 hover:text-black transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden relative w-8 h-8 flex items-center justify-center"
            aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={menuOpen}
          >
            <span
              className={`absolute w-5 h-[1.5px] bg-neutral-800 transition-all duration-300 ease-out ${
                menuOpen ? "rotate-45" : "-translate-y-[5px]"
              }`}
            />
            <span
              className={`absolute w-3.5 h-[1.5px] bg-neutral-800 transition-all duration-300 ease-out ${
                menuOpen ? "opacity-0 translate-x-2" : "translate-x-[-3px]"
              }`}
            />
            <span
              className={`absolute w-5 h-[1.5px] bg-neutral-800 transition-all duration-300 ease-out ${
                menuOpen ? "-rotate-45" : "translate-y-[5px]"
              }`}
            />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#FDFBF7] flex flex-col items-center pt-32"
          role="dialog"
          aria-modal="true"
          aria-label="Menu điều hướng"
        >
          <nav className="flex flex-col items-center gap-6">
            {NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`text-2xl font-bold tracking-tight text-neutral-800 hover:${link.accent} transition-colors duration-200`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {/* Spacer cho fixed header */}
      <div className="h-14 md:h-20" aria-hidden="true" />
    </>
  );
}
