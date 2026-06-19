// =============================================================================
// staging-props — P65. ĐỒ TRANG TRÍ cho thumbnail (mode='screenshot').
// Mô hình: SÁCH = đồ lấp chính (nhiều, lặp được, nhiều kích cỡ, hợp cả hộc thấp);
// ĐỒ TRANG TRÍ (đèn/lọ/cây/khung/bát/nến/cầu) = điểm nhấn THƯA + KHÔNG lặp/khung hình.
// Kích thước THẬT (mm). Tủ THẤP (<1500) → 1-2 đồ cao trên MẶT NÓC (không chồng sách).
// Tránh "lọt thỏm" (hộc cao mà đồ < 45% → bỏ); hộc thấp thì bày SÁCH NẰM. Deterministic.
// =============================================================================
import { Suspense, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import type { CellCavity } from './types';

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const NEUTRALS = ['#f2efe9', '#e8e3d9', '#dcd6ca', '#cdc6ba', '#bcb5a8', '#aaa399'];
const DARK = '#46433d';
const SAGE = '#9ba291';
const DRIED = '#b6a98f';
const nc = (rng: () => number) => NEUTRALS[Math.floor(rng() * NEUTRALS.length)];
const mat = (color: string, rough = 0.82, metal = 0) => (
  <meshStandardMaterial color={color} roughness={rough} metalness={metal} />
);

type Vec = { w: number; h: number; d: number };
type Built = { w: number; h: number; d: number; node: React.ReactElement; anchor?: 'left'; overhang?: number };
type Kind =
  | 'bookstack' | 'bookrow' | 'bookupright' | 'lowbooks'
  | 'vase' | 'lamp' | 'plant' | 'frame' | 'bowl' | 'candle' | 'orb';

const BOOK_KINDS: Kind[] = ['bookstack', 'bookrow', 'bookupright', 'lowbooks'];
const STATEMENT: Kind[] = ['vase', 'lamp', 'plant', 'frame', 'bowl', 'candle', 'orb'];
const TOP_OK: Kind[] = ['vase', 'lamp', 'plant', 'candle', 'frame']; // nóc: đồ cao, KHÔNG sách

function buildProp(kind: Kind, seed: number): Built {
  const r = mulberry32(seed);
  switch (kind) {
    case 'bookstack': {
      const n = 2 + Math.floor(r() * 3);
      const bw = 180 + r() * 80;
      const bd = 140 + r() * 60;
      const out: React.ReactElement[] = [];
      let y = 0;
      for (let i = 0; i < n; i++) {
        const bh = 26 + r() * 14;
        out.push(<mesh key={i} position={[(r() - 0.5) * 12, y + bh / 2, (r() - 0.5) * 10]} rotation={[0, (r() - 0.5) * 0.14, 0]} castShadow receiveShadow><boxGeometry args={[bw * (1 - i * 0.06), bh, bd]} />{mat(nc(r))}</mesh>);
        y += bh + 2;
      }
      return { w: bw, h: y, d: bd, node: <>{out}</> };
    }
    case 'lowbooks': {
      // 2-3 cuốn NẰM CHỒNG thấp (thuần nằm — KHÔNG xen cuốn dựng) → hợp hộc thấp <150mm.
      const n = 2 + Math.floor(r() * 2);
      const bw = 150 + r() * 120;
      const bd = 120 + r() * 60;
      const out: React.ReactElement[] = [];
      let y = 0;
      for (let i = 0; i < n; i++) {
        const bh = 20 + r() * 12;
        out.push(<mesh key={i} position={[(r() - 0.5) * 16, y + bh / 2, (r() - 0.5) * 10]} rotation={[0, (r() - 0.5) * 0.18, 0]} castShadow receiveShadow><boxGeometry args={[bw * (1 - i * 0.08), bh, bd]} />{mat(nc(r))}</mesh>);
        y += bh + 1.5;
      }
      return { w: bw, h: y, d: bd, node: <>{out}</> };
    }
    case 'bookrow': {
      // SÁCH NGHIÊNG: cả bộ nghiêng cùng chiều, DỰA VÀO 1 VÁCH ĐỨNG bên trái (anchor='left').
      // KHÔNG có quyển nằm đỡ (founder: vô lý). Quyển cao nhất sát vách, các quyển sau tựa lên nhau.
      const lean = 0.12 + r() * 0.07;
      const cnt = 3 + Math.floor(r() * 4);
      const bd = 150 + r() * 40;
      const items: React.ReactElement[] = [];
      let x = 0;
      let maxH = 0;
      for (let i = 0; i < cnt; i++) {
        const bw = 26 + r() * 16;
        const bh = 250 - i * 10 + r() * 30;
        maxH = Math.max(maxH, bh);
        // pivot ở chân-trái mỗi quyển; xoay +lean → đỉnh ngả sang TRÁI (-x) tựa vào vách.
        items.push(<group key={i} position={[x, 0, (r() - 0.5) * 8]} rotation={[0, 0, lean]}><mesh position={[bw / 2, bh / 2, 0]} castShadow receiveShadow><boxGeometry args={[bw, bh, bd]} />{mat(nc(r))}</mesh></group>);
        x += bw * Math.cos(lean) + 2.5;
      }
      const overhang = maxH * Math.sin(lean); // đỉnh nhô sang trái → đặt áp sát vách
      return { w: x + overhang, h: maxH, d: bd, node: <>{items}</>, anchor: 'left', overhang };
    }
    case 'bookupright': {
      // SÁCH ĐỨNG: thẳng đứng cạnh nhau, cao thấp xen kẽ; cả bộ ÁP SÁT VÁCH TRÁI (founder).
      const cnt = 4 + Math.floor(r() * 4);
      const bd = 150 + r() * 40;
      const items: React.ReactElement[] = [];
      let x = 0;
      let maxH = 0;
      for (let i = 0; i < cnt; i++) {
        const bw = 22 + r() * 16;
        const bh = 190 + r() * 80;
        maxH = Math.max(maxH, bh);
        items.push(<mesh key={i} position={[x + bw / 2, bh / 2, (r() - 0.5) * 8]} castShadow receiveShadow><boxGeometry args={[bw, bh, bd]} />{mat(nc(r))}</mesh>);
        x += bw + 2.5;
      }
      // origin tại chân quyển đầu (x=0), không căn giữa → áp sát vách trái; overhang=0 (đứng thẳng).
      return { w: x, h: maxH, d: bd, node: <>{items}</>, anchor: 'left', overhang: 0 };
    }
    case 'vase': {
      const rad = 32 + r() * 26;
      const h = 200 + r() * 150;
      const neck = 0.5 + r() * 0.4;
      return { w: 2 * rad, h, d: 2 * rad, node: <mesh position={[0, h / 2, 0]} castShadow receiveShadow><cylinderGeometry args={[rad * neck, rad, h, 24]} />{mat(nc(r), 0.7)}</mesh> };
    }
    case 'lamp': {
      // Đế to + thân dày → vững. KHÔNG quá cao (founder).
      const domeR = 56 + r() * 22;
      const totalH = 220 + r() * 70;
      const baseR = domeR * 0.62;
      const baseH = 26 + r() * 10;
      const stemR = 12 + r() * 4;
      const stemH = Math.max(45, totalH - domeR - baseH);
      const shade = NEUTRALS[1 + Math.floor(r() * 2)];
      return { w: 2 * domeR, h: totalH, d: 2 * domeR, node: (
        <group>
          <mesh position={[0, baseH / 2, 0]} castShadow receiveShadow><cylinderGeometry args={[baseR * 0.78, baseR, baseH, 28]} />{mat(DARK, 0.4, 0.3)}</mesh>
          <mesh position={[0, baseH + stemH / 2, 0]} castShadow receiveShadow><cylinderGeometry args={[stemR, stemR * 1.3, stemH, 16]} />{mat(DARK, 0.4, 0.3)}</mesh>
          <mesh position={[0, baseH + stemH, 0]} castShadow receiveShadow><sphereGeometry args={[domeR, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />{mat(shade, 0.5)}</mesh>
        </group>
      ) };
    }
    case 'plant': {
      const potR = 32 + r() * 16;
      const potH = 70 + r() * 36;
      const fw = 150 + r() * 60; // footprint GỌN → vừa nhiều hộc. (GLTF thay node này.)
      const nStem = 7 + Math.floor(r() * 5);
      const stems: React.ReactElement[] = [];
      for (let i = 0; i < nStem; i++) {
        const len = 150 + r() * 180;
        stems.push(<group key={i} position={[(r() - 0.5) * potR * 0.6, potH, (r() - 0.5) * potR * 0.6]} rotation={[(r() - 0.5) * 0.5, r() * 6.28, (r() - 0.5) * 0.5]}><mesh position={[0, len / 2, 0]} castShadow><cylinderGeometry args={[1.1, 3, len, 5]} />{mat(r() < 0.5 ? DRIED : SAGE, 0.9)}</mesh></group>);
      }
      return { w: fw, h: potH + 300, d: fw, node: <group><mesh position={[0, potH / 2, 0]} castShadow receiveShadow><cylinderGeometry args={[potR * 0.8, potR, potH, 20]} />{mat(nc(r), 0.72)}</mesh>{stems}</group> };
    }
    case 'frame': {
      const fh = 170 + r() * 110;
      const fw = fh * (0.7 + r() * 0.25);
      const th = 16;
      return { w: fw, h: fh, d: th + 40, node: <group position={[0, fh / 2, 0]} rotation={[-0.12, (r() - 0.5) * 0.25, 0]}><mesh castShadow receiveShadow><boxGeometry args={[fw, fh, th]} />{mat(nc(r), 0.7)}</mesh><mesh position={[0, 0, th / 2 + 1]} castShadow><boxGeometry args={[fw * 0.78, fh * 0.78, 2]} />{mat(NEUTRALS[5], 0.6)}</mesh></group> };
    }
    case 'bowl': {
      const rad = 72 + r() * 40;
      const bh = 48 + r() * 32;
      return { w: 2 * rad, h: bh, d: 2 * rad, node: <mesh position={[0, bh / 2, 0]} castShadow receiveShadow><cylinderGeometry args={[rad, rad * 0.66, bh, 28]} />{mat(nc(r), 0.68)}</mesh> };
    }
    case 'candle': {
      const rad = 26 + r() * 14;
      const h = 150 + r() * 120;
      return { w: 2 * rad, h, d: 2 * rad, node: <group><mesh position={[0, 6, 0]} castShadow receiveShadow><cylinderGeometry args={[rad, rad * 1.15, 12, 20]} />{mat(DARK, 0.4, 0.25)}</mesh><mesh position={[0, 12 + (h - 12) / 2, 0]} castShadow receiveShadow><cylinderGeometry args={[rad * 0.55, rad * 0.62, h - 12, 18]} />{mat(nc(r), 0.6)}</mesh></group> };
    }
    case 'orb': {
      const rad = 55 + r() * 30;
      return { w: 2 * rad, h: 2 * rad + 14, d: 2 * rad, node: <group><mesh position={[0, 7, 0]} castShadow receiveShadow><cylinderGeometry args={[rad * 0.7, rad * 0.8, 14, 20]} />{mat(nc(r), 0.7)}</mesh><mesh position={[0, 14 + rad, 0]} castShadow receiveShadow><sphereGeometry args={[rad, 20, 16]} />{mat(nc(r), 0.55)}</mesh></group> };
    }
  }
}

function fits(p: Vec, cav: CellCavity, isTop: boolean): boolean {
  return p.w <= cav.w * 0.82 && p.d <= cav.d * 0.82 && (isTop || p.h <= cav.h * 0.92);
}

/** Thứ tự SÁCH thử theo hình hộc (thử lần lượt → ít ô trống). thấp→nằm; cao→đứng/nghiêng xen kẽ. */
function bookOrder(cav: CellCavity, rng: () => number): Kind[] {
  if (cav.h < 185) return ['lowbooks', 'bookstack']; // thấp: chỉ sách NẰM
  if (cav.h / cav.w > 1.2) {
    // hộc cao: ưu tiên ĐỨNG hoặc NGHIÊNG (xen kẽ), rồi mới xếp/nằm.
    return rng() < 0.5
      ? ['bookupright', 'bookrow', 'bookstack', 'lowbooks']
      : ['bookrow', 'bookupright', 'bookstack', 'lowbooks'];
  }
  const roll = rng();
  if (roll < 0.34) return ['bookupright', 'bookstack', 'bookrow', 'lowbooks'];
  if (roll < 0.67) return ['bookrow', 'bookupright', 'bookstack', 'lowbooks'];
  return ['bookstack', 'bookupright', 'bookrow', 'lowbooks'];
}

function topCavities(size: { w: number; h: number; d: number }): CellCavity[] {
  const n = size.w >= 1300 ? 2 : 1;
  const usableW = size.w * 0.7;
  const slotW = usableW / n;
  const slots: CellCavity[] = [];
  for (let i = 0; i < n; i++) {
    slots.push({ col: 100 + i, row: 100, type: 'open-back', cx: -usableW / 2 + slotW * (i + 0.5), floorY: size.h, cz: -size.d * 0.1, w: slotW, h: 520, d: size.d * 0.7 });
  }
  return slots;
}

// --- GLTF: model THẬT (CC0 Kenney/Quaternius) cho đồ trang trí (screenshot-only). Scale theo
// CHIỀU CAO reserved của prop, KẸP bề ngang/sâu để không tràn hộc, base y=0, tâm x/z, bật bóng.
// recolor → tông trung tính. NHIỀU model / loại (bank) → mỗi hộc bốc 1 biến thể theo seed. ---
type GltfCfg = { url: string; recolor?: (c: THREE.Color) => THREE.Color };

// Cây: lá xanh → sage xám, chậu cam → greige (founder: sai tone).
const plantRecolor = (c: THREE.Color): THREE.Color =>
  c.g > c.r + 0.02 && c.g > c.b ? new THREE.Color('#97a08d') : new THREE.Color('#c9bca6');
const lum = (c: THREE.Color) => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
const GREIGE_LO = new THREE.Color('#544f48');
const GREIGE_HI = new THREE.Color('#efe9df');
/** Bỏ bão hoà → ramp xám-ấm theo ĐỘ SÁNG (giữ tương phản khối, đồng bộ tông studio). */
const neutralize = (c: THREE.Color): THREE.Color => {
  const t = 0.16 + 0.84 * Math.pow(Math.min(1, Math.max(0, lum(c))), 0.85);
  return GREIGE_LO.clone().lerp(GREIGE_HI, t);
};

// Bank: mỗi Kind có 1+ model THẬT. Đồ phi hữu cơ → neutralize; cây → plantRecolor.
const GLTF_BANK: Partial<Record<Kind, GltfCfg[]>> = {
  plant: [
    { url: '/props/plant.glb', recolor: plantRecolor }, // Kenney (flat: lá xanh→sage)
    { url: '/props/plant-house.glb', recolor: plantRecolor }, // Quaternius houseplant (flat)
  ],
  vase: [
    { url: '/props/vase-pot.glb', recolor: neutralize }, // flat
    { url: '/props/vase-jar.glb', recolor: neutralize }, // textured→strip→off-white đặc
  ],
  bowl: [
    { url: '/props/bowl.glb', recolor: neutralize }, // Kenney (flat)
    { url: '/props/bowl-pot.glb', recolor: neutralize }, // Quaternius cooking pot (flat)
  ],
  lamp: [
    { url: '/props/lamp-table.glb', recolor: neutralize }, // flat: đế + chao
    { url: '/props/lamp-shade.glb', recolor: neutralize }, // textured→strip→off-white đặc
  ],
};
const ALL_GLTF_URLS = Array.from(new Set(Object.values(GLTF_BANK).flat().map((c) => c!.url)));

function GltfProp({ url, targetH, maxW, maxD, recolor }: { url: string; targetH: number; maxW?: number; maxD?: number; recolor?: (c: THREE.Color) => THREE.Color }) {
  const { scene } = useGLTF(url);
  const obj = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      if (recolor && m.material) {
        const conv = (mm: THREE.Material) => {
          const cl = (mm as THREE.MeshStandardMaterial).clone();
          if (cl.color) cl.color = recolor(cl.color);
          cl.map = null; // bỏ texture → màu phẳng (đã neutralize) hiện ra; nếu không, ảnh đè màu
          cl.emissiveMap = null;
          if (cl.emissive) cl.emissive = new THREE.Color('#000000');
          cl.roughness = 0.85;
          cl.metalness = 0;
          cl.needsUpdate = true;
          return cl;
        };
        m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material);
      }
    });
    const box = new THREE.Box3().setFromObject(c);
    const size = new THREE.Vector3();
    box.getSize(size);
    let s = size.y > 1e-6 ? targetH / size.y : 1;
    if (maxW && size.x * s > maxW) s = maxW / size.x; // kẹp ngang → không tràn hộc
    if (maxD && size.z * s > maxD) s = Math.min(s, maxD / size.z); // kẹp sâu
    c.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    const g = new THREE.Group();
    g.add(c);
    g.scale.setScalar(s);
    return g;
  }, [scene, targetH, maxW, maxD, recolor]);
  return <primitive object={obj} />;
}
// KHÔNG preload ở top-level: nếu không, MỌI trang import Configurator (kể cả /design tương tác,
// không có props) đều tải 8 GLB vô ích → nặng. Chỉ warm cache khi <StagingProps> thật sự mount.

function PropInstance({ cav, kind, isTop }: { cav: CellCavity; kind: Kind; isTop: boolean }) {
  const seed = hashStr(`p:${cav.col},${cav.row}:${kind}`);
  const p = buildProp(kind, seed);
  const jr = mulberry32(seed ^ 0x9e3779b9);
  const slackZ = Math.max(0, cav.d * 0.82 - p.d);
  const jz = (jr() - 0.5) * slackZ * 0.5 - cav.d * (isTop ? 0.04 : 0.08);
  // Sách nghiêng (anchor='left'): áp sát vách TRÁI, gần như không xoay Y để giữ thế tựa.
  const ry = (jr() - 0.5) * (p.anchor === 'left' ? 0.12 : 0.5);
  let jx: number;
  if (p.anchor === 'left') {
    // local x=0 (chân quyển đầu) cách vách trái = overhang + gap → đỉnh nghiêng chạm gần vách.
    jx = -cav.w / 2 + (p.overhang ?? 0) + 10;
  } else {
    const slackX = Math.max(0, cav.w * 0.82 - p.w);
    jx = (jr() - 0.5) * slackX * 0.75;
  }
  // Bốc 1 biến thể model THẬT theo seed (ổn định/preset) — nếu Kind có bank GLTF.
  const bank = GLTF_BANK[kind];
  const cfg = bank && bank.length ? bank[hashStr(`g:${cav.col},${cav.row}:${kind}`) % bank.length] : undefined;
  return (
    <group position={[cav.cx + jx, cav.floorY, cav.cz + jz]} rotation={[0, ry, 0]}>
      {cfg ? <GltfProp url={cfg.url} targetH={p.h} maxW={cav.w * 0.82} maxD={cav.d * 0.88} recolor={cfg.recolor} /> : p.node}
    </group>
  );
}

/**
 * Chọn props: NÓC = 1-2 đồ cao (distinct). HỐC = phần lớn SÁCH (lặp được, hợp hình
 * hộc) + rải ~1/3 đồ trang trí (distinct, không lặp). Hộc cao mà đồ nhỏ < 45% → bỏ
 * (lọt thỏm); hộc thấp luôn cho SÁCH NẰM.
 */
export function StagingProps({
  cavities,
  seed,
  size,
}: {
  cavities: CellCavity[];
  seed: string;
  size?: { w: number; h: number; d: number };
}) {
  // Warm GLTF cache CHỈ khi props thật sự mount (screenshot). /design KHÔNG tải GLB → nhẹ.
  useEffect(() => {
    ALL_GLTF_URLS.forEach((u) => useGLTF.preload(u));
  }, []);
  const placed = useMemo(() => {
    const rand = mulberry32(hashStr(seed || 'tu-ke'));
    const eligible = (cavities ?? []).filter((c) => c.w >= 140 && c.h >= 120 && c.d >= 150);
    const tops = size && size.h < 1500 ? topCavities(size) : [];
    const out: { cav: CellCavity; kind: Kind; isTop: boolean }[] = [];
    const stmtPool = shuffle(STATEMENT, rand); // điểm nhấn KHÔNG lặp

    // NÓC: đồ cao distinct (vase/lamp/plant/candle/frame).
    for (const cav of tops) {
      const order = stmtPool.filter((k) => TOP_OK.includes(k));
      const k = order.find((kk) => fits(buildProp(kk, hashStr(`p:${cav.col},${cav.row}:${kk}`)), cav, true));
      if (k) { out.push({ cav, kind: k, isTop: true }); stmtPool.splice(stmtPool.indexOf(k), 1); }
    }

    // HỐC: density CAO (founder: ít quá → lấp gần hết). Phần lớn SÁCH, rải điểm nhấn.
    const cellCount = Math.max(0, Math.min(26, Math.round(eligible.length * 0.95)));
    const cells = shuffle(eligible, rand).slice(0, cellCount);
    let sinceStmt = 3;
    for (const cav of cells) {
      const wantStmt = stmtPool.length > 0 && (rand() < 0.26 || sinceStmt >= 5);
      let done = false;
      if (wantStmt) {
        for (const k of stmtPool) {
          const p = buildProp(k, hashStr(`p:${cav.col},${cav.row}:${k}`));
          if (fits(p, cav, false) && p.h >= cav.h * 0.42) {
            out.push({ cav, kind: k, isTop: false });
            stmtPool.splice(stmtPool.indexOf(k), 1);
            sinceStmt = 0; done = true; break;
          }
        }
      }
      if (!done) {
        // SÁCH — thử LẦN LƯỢT 3 kiểu để LẤP được (ít ô trống → nhiều props).
        for (const bk of bookOrder(cav, rand)) {
          const p = buildProp(bk, hashStr(`p:${cav.col},${cav.row}:${bk}`));
          if (fits(p, cav, false) && (cav.h < 300 || p.h >= cav.h * 0.26)) {
            out.push({ cav, kind: bk, isTop: false });
            sinceStmt++; done = true; break;
          }
        }
      }
    }
    return out;
  }, [cavities, seed, size]);

  return (
    <Suspense fallback={null}>
      {placed.map((p) => (
        <PropInstance key={`${p.cav.col}-${p.cav.row}`} cav={p.cav} kind={p.kind} isTop={p.isTop} />
      ))}
    </Suspense>
  );
}
