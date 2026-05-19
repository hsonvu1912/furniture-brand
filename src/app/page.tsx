'use client';
// =============================================================
// TRANG SẢN PHẨM — tủ kệ. Configurator nạp động (ssr:false) vì Three.js
// cần API trình duyệt. Session 4 sẽ dựng trang chủ + SEO quanh trang này.
// =============================================================
import dynamic from 'next/dynamic';
import tuKe from '../../products/tu-ke/dna';

const Configurator = dynamic(
  () => import('@/configurator/Configurator').then((m) => m.Configurator),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-neutral-500">
        Đang tải trình dựng 3D…
      </div>
    ),
  },
);

export default function Home() {
  return (
    <main className="h-screen w-screen">
      <Configurator dna={tuKe} />
    </main>
  );
}
