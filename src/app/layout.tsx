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

export const metadata: Metadata = {
  title: {
    default: "KÊ. by màumè — Tủ kệ thiết kế 3D",
    template: "%s · KÊ. by màumè",
  },
  description:
    "Thiết kế tủ kệ theo ý bạn: chỉnh kích thước, ngăn, vật liệu — xem ngay mô hình 3D, giá hiện ngay, xưởng làm sẵn cho bạn.",
  openGraph: {
    title: "KÊ. by màumè — Tủ kệ thiết kế 3D",
    description:
      "Tủ kệ tham số: tự chỉnh, xem 3D ngay, giá hiện ngay, xưởng làm sẵn.",
    siteName: "KÊ. by màumè",
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
      className={`${cabinetGrotesk.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
