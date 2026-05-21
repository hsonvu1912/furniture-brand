'use client';
// =============================================================================
// /design — trang Configurator full-screen. Three.js cần API trình duyệt nên
// import động (ssr:false). Đọc query ?preset=<slug>: tìm trong PRESETS, pass
// preset.values vào Configurator qua prop initialValues. Không có preset →
// fallback default từ dna.parameters.
// =============================================================================
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo } from 'react';
import tuKe from '../../../products/tu-ke/dna';
import { findPreset } from '../../../products/tu-ke/presets';

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

function DesignInner() {
  const searchParams = useSearchParams();
  const slug = searchParams.get('preset');
  // Lookup chỉ 1 lần per slug — preset là static, không cần re-compute.
  const initialValues = useMemo(() => {
    const preset = findPreset(slug ?? undefined);
    return preset?.values;
  }, [slug]);

  return <Configurator dna={tuKe} initialValues={initialValues} />;
}

export default function DesignPage() {
  return (
    <main className="h-screen w-screen">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-neutral-500">
            Đang tải…
          </div>
        }
      >
        <DesignInner />
      </Suspense>
    </main>
  );
}
