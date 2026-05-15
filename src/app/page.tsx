'use client';
// =============================================================
// TRANG DEMO SESSION 1 — kiểm tra render engine bằng 1 Part[] cứng.
// Session 2 sẽ thay bằng trang sản phẩm thật (đọc products/tu-ke/dna.ts).
// Configurator nạp động (ssr:false) vì Three.js cần API trình duyệt.
// =============================================================
import dynamic from 'next/dynamic';
import type { Part } from '@/configurator/types';

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

// --- Tủ kệ mini cứng — TẠM THỜI cho Session 1 ---
const T = 18; // độ dày ván (mm)
const W = 1200;
const H = 1800;
const D = 350;

function panel(
  id: string,
  label: string,
  material: string,
  size: [number, number, number],
  position: [number, number, number],
  grain: Part['grain'] = 'length',
): Part {
  const [length_mm, width_mm, thickness_mm] = [...size].sort((a, b) => b - a);
  return {
    id,
    label,
    material,
    size,
    position,
    length_mm,
    width_mm,
    thickness_mm,
    grain,
    edgeBanding: { front: false, back: false, left: false, right: false },
    qty: 1,
  };
}

const DEMO_PARTS: Part[] = [
  panel('side-l', 'Tấm hông trái', 'mfc/mfc_oak', [T, H, D], [-(W - T) / 2, H / 2, 0]),
  panel('side-r', 'Tấm hông phải', 'mfc/mfc_oak', [T, H, D], [(W - T) / 2, H / 2, 0]),
  panel('top', 'Tấm nóc', 'mfc/mfc_oak', [W, T, D], [0, H - T / 2, 0]),
  panel('bottom', 'Tấm đáy', 'mfc/mfc_oak', [W, T, D], [0, T / 2, 0]),
  panel('shelf-1', 'Kệ giữa (dưới)', 'mfc/mfc_walnut', [W - 2 * T, T, D - 30], [0, H / 3, 0]),
  panel('shelf-2', 'Kệ giữa (trên)', 'mfc/mfc_walnut', [W - 2 * T, T, D - 30], [0, (2 * H) / 3, 0]),
  panel(
    'back',
    'Tấm lưng',
    'mdf_finish/white_lacquer',
    [W - 2 * T - 4, H - 2 * T - 4, 6],
    [0, H / 2, -(D - 6) / 2],
    'none',
  ),
];

export default function Home() {
  return (
    <main className="h-screen w-screen">
      <Configurator parts={DEMO_PARTS} />
    </main>
  );
}
