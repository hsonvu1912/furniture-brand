'use client';
// =============================================================================
// /design — trang Configurator full-screen. Three.js cần API trình duyệt nên
// import động (ssr:false). Không có Header/Footer ở đây (Configurator full-bleed
// để tận dụng tối đa space cho 3D).
// =============================================================================
import dynamic from 'next/dynamic';
import tuKe from '../../../products/tu-ke/dna';

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

export default function DesignPage() {
  return (
    <main className="h-screen w-screen">
      <Configurator dna={tuKe} />
    </main>
  );
}
