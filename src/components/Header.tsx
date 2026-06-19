"use client";

// =============================================================================
// Header — regrocery exact: sticky transparent · text accent orange-red ·
// minimal nav links · mobile menu full-screen.
// =============================================================================
import Link from "next/link";
import { useState, useEffect } from "react";
import KeLogo from "./KeLogo";

const NAV = [
  { href: "/collection", label: "Bộ sưu tập" },
  { href: "/design", label: "Thiết kế" },
  { href: "/lien-he", label: "Liên hệ" },
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
        className={`fixed top-0 left-0 right-0 z-50 max-w-[1920px] mx-auto ${
          menuOpen ? "bg-[var(--color-bg)]" : "bg-[var(--color-bg)]/95 backdrop-blur-md"
        }`}
      >
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-12 h-16 md:h-20 flex items-center justify-between">
          <Link href="/" className="logo-link" aria-label="Trang chủ ngăn by màumè">
            <KeLogo size="md" />
          </Link>

          <nav className="hidden md:flex items-center gap-8 lg:gap-10">
            {NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm md:text-[15px] text-accent hover:opacity-60 transition-opacity font-medium"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Mobile: hamburger + label text */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex items-center gap-2 text-sm text-accent font-medium"
            aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={menuOpen}
          >
            <span>{menuOpen ? "Đóng" : "Menu"}</span>
            <div className="relative w-5 h-5 flex items-center justify-center">
              <span
                className={`absolute w-5 h-[1.5px] bg-[var(--color-accent)] transition-all duration-300 ease-out ${
                  menuOpen ? "rotate-45" : "-translate-y-[4px]"
                }`}
              />
              <span
                className={`absolute w-5 h-[1.5px] bg-[var(--color-accent)] transition-all duration-300 ease-out ${
                  menuOpen ? "-rotate-45" : "translate-y-[4px]"
                }`}
              />
            </div>
          </button>
        </div>
      </header>

      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-[var(--color-bg)] flex flex-col items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Menu điều hướng"
        >
          <nav className="flex flex-col items-center gap-8">
            {NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="display-huge text-accent display-italic hover:opacity-60 transition-opacity"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      <div className="h-16 md:h-20" aria-hidden="true" />
    </>
  );
}
