import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const cabinetGrotesk = localFont({
  src: [
    { path: "../../public/fonts/SVN-CabinetGrotesk-Regular.woff2", weight: "400" },
    { path: "../../public/fonts/SVN-CabinetGrotesk-Medium.woff2", weight: "500" },
    { path: "../../public/fonts/SVN-CabinetGrotesk-Bold.woff2", weight: "700" },
    { path: "../../public/fonts/SVN-CabinetGrotesk-Extrabold.woff2", weight: "800" },
    { path: "../../public/fonts/SVN-CabinetGrotesk-Black.woff2", weight: "900" },
  ],
  display: "swap",
  variable: "--font-cabinet",
});

// Be Vietnam Pro — load qua next/font/local thay @font-face CSS để Next tự
// handle basePath cho deploy GitHub Pages (CSS url() absolute path không
// auto-prefix). Mỗi weight có 2 file (latin + viet) — gộp vào 1 entry,
// browser load cả 2 (mất unicode-range subsetting nhưng đảm bảo basePath).
const beVietnamPro = localFont({
  src: [
    { path: "../../public/fonts/BeVietnamPro-300-latin.woff2", weight: "300" },
    { path: "../../public/fonts/BeVietnamPro-300-viet.woff2", weight: "300" },
    { path: "../../public/fonts/BeVietnamPro-400-latin.woff2", weight: "400" },
    { path: "../../public/fonts/BeVietnamPro-400-viet.woff2", weight: "400" },
    { path: "../../public/fonts/BeVietnamPro-500-latin.woff2", weight: "500" },
    { path: "../../public/fonts/BeVietnamPro-500-viet.woff2", weight: "500" },
    { path: "../../public/fonts/BeVietnamPro-600-latin.woff2", weight: "600" },
    { path: "../../public/fonts/BeVietnamPro-600-viet.woff2", weight: "600" },
    { path: "../../public/fonts/BeVietnamPro-700-latin.woff2", weight: "700" },
    { path: "../../public/fonts/BeVietnamPro-700-viet.woff2", weight: "700" },
  ],
  display: "swap",
  variable: "--font-be-vietnam-pro",
});

// Lora (P82) — font serif CHỈ cho wordmark logo NGĂN. Dùng next/font/local (woff2
// trong public/fonts) như 2 font trên. Bản full có glyph tiếng Việt (Ă/ă).
const lora = localFont({
  src: [
    { path: "../../public/fonts/Lora-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/Lora-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/Lora-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/Lora-Bold.woff2", weight: "700", style: "normal" },
    { path: "../../public/fonts/Lora-Italic.woff2", weight: "400", style: "italic" },
    { path: "../../public/fonts/Lora-MediumItalic.woff2", weight: "500", style: "italic" },
  ],
  display: "swap",
  variable: "--font-lora",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ngan.maume.asia"),
  title: {
    default: "ngăn by màumè — Tủ kệ thiết kế 3D",
    template: "%s · ngăn by màumè",
  },
  description:
    "Thiết kế tủ kệ theo ý bạn: chỉnh kích thước, ngăn, vật liệu — xem ngay mô hình 3D, giá hiện ngay, xưởng làm sẵn cho bạn.",
  openGraph: {
    title: "ngăn by màumè — Tủ kệ thiết kế 3D",
    description:
      "Tủ kệ tham số: tự chỉnh, xem 3D ngay, giá hiện ngay, xưởng làm sẵn.",
    siteName: "ngăn by màumè",
    locale: "vi_VN",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${cabinetGrotesk.variable} ${beVietnamPro.variable} ${lora.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-[var(--color-bg)]" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
