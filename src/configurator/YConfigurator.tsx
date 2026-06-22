'use client';
// =============================================================================
// YConfigurator — trình dựng RIÊNG cho tu-y ("Loại 2": tủ module hộp rời, P83.3).
// TÁCH HẲN Configurator.tsx của x (x bất biến). DÙNG CHUNG: renderer (PartMesh/
// FittingMesh/Ground/SceneLighting/Wall/Dimensions), engine giá (computePrice),
// cutlist, materials. Tương tác: bấm 1 ô (module) → sửa cỡ/hướng/thuộc tính/màu/
// xoá ở sidebar; quanh ô đang chọn có 4 nút "+" trên 3D để sinh ô mới gắn cạnh.
// Cảnh báo "ô bay" lấy từ dna.getWarnings. Mọi state ghi vào values.modules (JSON).
// =============================================================================
import { OrbitControls, Html } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { NeutralToneMapping, PCFShadowMap, Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import {
  doorAllowedY,
  drawerAllowedY,
  drawerCountY,
  effectiveAttrY,
  encodeModules,
  findFloating,
  parseModules,
  placeAtEdge,
  removeModule,
  updateModule,
  type YComposition,
  type YModule,
} from '../../products/tu-y/modules';
import { buildCutlist } from './cutlist';
import { EDGE_BAND_COLORS, resolveMaterial, swatchCss } from './materials';
import { computePrice } from './pricing';
import { PricePanel, CutlistPanel } from './admin-detail-panels';
import { AssemblyMesh, Dimensions, FittingMesh, Ground, PartMesh, SceneIBL, SceneLighting, ScreenshotCameraRig, ScreenshotPostFX, Wall, type AssemblyConfig } from './renderer';
import { StagingProps } from './staging-props';
import {
  AccordionItem, ConfigShell, HintPill, IconRuler, IconUndo,
  PillButton, SavePresetButton, SectionCard, SectionHeading, Segmented, SwatchOption, Toast, WarningBox, type ToolSpec, type CommerceData,
} from './ui'; // P96 + MUUTO — kit dùng chung (ConfigShell, accordion, control nổi trên canvas)
import { buildShareUrl, saveDesignLocal } from './share-config'; // MUUTO — Chia sẻ + Lưu để sau
import type { ParamValues, Parameter, PriceConfig, ProductDNA } from './types';

const SHADOW_CONFIG = { enabled: true, type: PCFShadowMap };
const GRID = 180; // 18cm
const DEPTH = 360; // sâu cố định
const FOOT_H = 5; // tủ nhấc khỏi sàn (đồng bộ dna)

// ─── FitCamera (copy từ Configurator, dùng bounding-sphere của tủ) ────────────
const _fitDir = new Vector3();
const _fitTarget = new Vector3();
function FitCamera({ w, h, d }: { w: number; h: number; d: number }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as { target: Vector3; update: () => void } | null;
  const fitted = useRef(false);
  useLayoutEffect(() => {
    if (!controls) return;
    const radius = 0.5 * Math.hypot(w, h, d) || 600;
    const vFov = (camera.fov * Math.PI) / 180;
    const aspect = size.width / size.height || 1;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const dist = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.18;
    _fitTarget.set(0, h / 2, 0);
    if (fitted.current) {
      _fitDir.copy(camera.position).sub(controls.target);
      if (_fitDir.lengthSq() < 1) _fitDir.set(2400, 1200, 3000);
    } else {
      _fitDir.set(2400, 1200, 3000);
    }
    _fitDir.normalize();
    camera.position.copy(_fitTarget).addScaledVector(_fitDir, dist);
    controls.target.copy(_fitTarget);
    controls.update();
    fitted.current = true;
  }, [w, h, d, size.width, size.height, camera, controls]);
  return null;
}

// ─── Camera + đèn STUDIO khi chụp thumbnail (COPY nguyên văn từ Configurator.tsx để
//     x BẤT BIẾN — KHÔNG refactor file của x). Dùng cho mode='screenshot'. ─────────
/** P32 — fit bounding-sphere, FOV 18° tele (cạnh đứng thẳng), tầm mắt 1400 + lens-shift. */
function computeScreenshotCamera(
  width: number,
  height: number,
  depth: number,
  angle: 'iso-front-right' | 'front' | 'iso-front-left',
): { position: [number, number, number]; fov: number; near: number; far: number } {
  const FRAME_FILL = 0.82;
  const FOV = 18;
  const fovHalfRad = (FOV / 2) * (Math.PI / 180);
  const r = 0.5 * Math.sqrt(width * width + height * height + depth * depth);
  const dist = r / Math.sin(fovHalfRad) / FRAME_FILL;
  const centerY = height / 2;
  const EYE_HEIGHT = 1400;
  const camY = EYE_HEIGHT;
  const dyWorld = centerY - camY;
  const horiz = Math.sqrt(Math.max(dist * dist - dyWorld * dyWorld, (0.3 * dist) ** 2));
  const isoLen = Math.hypot(0.65, 0.75);
  const ix = (0.65 / isoLen) * horiz;
  const iz = (0.75 / isoLen) * horiz;
  const positions: Record<typeof angle, [number, number, number]> = {
    'iso-front-right': [ix, camY, iz],
    front: [0, camY, horiz],
    'iso-front-left': [-ix, camY, iz],
  };
  return { position: positions[angle], fov: FOV, near: 100, far: 30000 };
}

/** P65 — 3-point studio + IBL (tạo khối, màu sát hex). COPY từ Configurator (x bất biến). */
function ScreenshotLighting() {
  return (
    <>
      <SceneIBL intensity={0.4} />
      <ambientLight intensity={0.85} />
      <directionalLight
        position={[3500, 7000, 3000]}
        intensity={1.25}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-radius={14}
        shadow-camera-left={-3500}
        shadow-camera-right={3500}
        shadow-camera-top={3500}
        shadow-camera-bottom={-1500}
        shadow-camera-near={1000}
        shadow-camera-far={16000}
        shadow-bias={-0.0003}
      />
      <directionalLight position={[-4000, 2500, 3000]} intensity={0.5} />
      <directionalLight position={[0, 3000, -3500]} intensity={0.35} />
    </>
  );
}

// ─── Hình hộp bao mỗi module (scene coords) — cho hitbox/highlight/nút "+" ─────
interface ModBox {
  id: string;
  module: YModule;
  pos: [number, number, number];
  size: [number, number, number];
}
function moduleBoxes(comp: YComposition): ModBox[] {
  // P91 — PHẢI khớp 1-1 với dna.build() (P88.6 chuẩn hoá minGX/minGY): build căn giữa
  // theo extent THỰC (trừ minGX/minGY) + nhấc cả tủ +FOOT_H. Trước đây dùng công thức cũ
  // (totalW=spanGX*GRID, không trừ minGX, y=m.gy*GRID) → preset có ô bắt đầu từ cột>0
  // (vd 0x0x0-kio9 minGX=4) làm hitbox/highlight LỆCH sang phải minGX*GRID/2. minGX=minGY=0
  // → y hệt cũ. Toạ độ phải TRÙNG build: x0=m.gx*GRID+xOffset · y0=(m.gy-minGY)*GRID · +FOOT_H.
  const minGX = comp.modules.reduce((mn, m) => Math.min(mn, m.gx), Infinity);
  const spanGX = comp.modules.reduce((mx, m) => Math.max(mx, m.gx + m.gw), 0);
  const minGY = comp.modules.reduce((mn, m) => Math.min(mn, m.gy), Infinity);
  const totalW = (spanGX - minGX) * GRID;
  const xOffset = -minGX * GRID - totalW / 2;
  return comp.modules.map((m) => {
    const W = m.gw * GRID;
    const H = m.gh * GRID;
    const cx = m.gx * GRID + xOffset + W / 2;
    const cy = (m.gy - minGY) * GRID + H / 2 + FOOT_H;
    return { id: m.id, module: m, pos: [cx, cy, 0], size: [W, H, DEPTH + 40] };
  });
}

function ModuleHitboxes({ boxes, onPick }: { boxes: ModBox[]; onPick: (id: string) => void }) {
  return (
    <group>
      {boxes.map((b) => (
        <mesh
          key={b.id}
          position={b.pos}
          onClick={(e) => {
            e.stopPropagation();
            onPick(b.id);
          }}
        >
          <boxGeometry args={b.size} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function ModuleHighlight({ box }: { box: ModBox }) {
  // Halo bao QUANH ô (phình 12mm mỗi phía) — KHÔNG để mặt box TRÙNG mặt ván → hết
  // z-fighting (nhấp nháy đỏ trên mặt tấm). depthWrite off + renderOrder cao → tô nhẹ ô đang chọn.
  const M = 24;
  return (
    <mesh position={box.pos} renderOrder={10}>
      <boxGeometry args={[box.size[0] + M, box.size[1] + M, DEPTH + M]} />
      <meshBasicMaterial color="#f74c25" transparent opacity={0.22} depthWrite={false} />
    </mesh>
  );
}

/** 4 nút "+" quanh ô đang chọn (drei Html neo theo 3D). */
function EdgeAddButtons({ box, onAdd }: { box: ModBox; onAdd: (edge: 'left' | 'right' | 'top' | 'bottom') => void }) {
  const [cx, cy] = box.pos;
  const W = box.module.gw * GRID;
  const H = box.module.gh * GRID;
  const z = DEPTH / 2 + 10;
  const anchors: { edge: 'left' | 'right' | 'top' | 'bottom'; pos: [number, number, number] }[] = [
    { edge: 'right', pos: [cx + W / 2 + 60, cy, z] },
    { edge: 'left', pos: [cx - W / 2 - 60, cy, z] },
    { edge: 'top', pos: [cx, cy + H / 2 + 60, z] },
    { edge: 'bottom', pos: [cx, cy - H / 2 - 60, z] },
  ];
  return (
    <>
      {anchors.map((a) => (
        // zIndexRange [60,50] > dim labels [40,0] (renderer DimLabel) → nút "+" LUÔN nổi
        // trên đường kích thước, hết bị dim đè nuốt click (đặc biệt mobile). h-9 to hơn dễ chạm.
        <Html key={a.edge} position={a.pos} center zIndexRange={[60, 50]}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdd(a.edge);
            }}
            title="Thêm ô tủ"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent)] text-xl leading-none text-white shadow-md ring-2 ring-white/70 transition hover:bg-[var(--color-accent-hover)]"
          >
            +
          </button>
        </Html>
      ))}
    </>
  );
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────
function paramOptions(dna: ProductDNA, id: string): { value: string; label: string }[] {
  return dna.parameters.find((p: Parameter) => p.id === id)?.options ?? [];
}
// P96 — swatchCss giờ import từ materials.ts (1 nguồn dùng chung cả 2 config).

// ─── P97 — Bộ chọn module trực quan (gallery mặt đứng 2D, đơn sắc, đúng tỷ lệ) ────
const PICK_SHAPES: { gw: number; gh: number; label: string; feats: Record<'open' | 'back' | 'door' | 'drawer', boolean> }[] = [
  { gw: 1, gh: 2, label: '18×36', feats: { open: true, back: true, door: false, drawer: false } },
  { gw: 2, gh: 1, label: '36×18', feats: { open: true, back: true, door: false, drawer: false } },
  { gw: 2, gh: 2, label: '36×36', feats: { open: true, back: true, door: true, drawer: true } },
  { gw: 3, gh: 2, label: '54×36', feats: { open: true, back: true, door: true, drawer: false } },
  { gw: 2, gh: 3, label: '36×54', feats: { open: true, back: true, door: true, drawer: true } },
  { gw: 4, gh: 2, label: '72×36', feats: { open: true, back: true, door: true, drawer: false } },
  { gw: 2, gh: 4, label: '36×72', feats: { open: true, back: true, door: true, drawer: true } },
];
const PICK_FEATS: { k: 'open' | 'back' | 'door' | 'drawer'; label: string }[] = [
  { k: 'open', label: 'Mở' },
  { k: 'back', label: 'Mở có hậu' },
  { k: 'door', label: 'Cánh' },
  { k: 'drawer', label: 'Ngăn kéo' },
];
const PICK_ATTR = { open: 'open-nobk', back: 'open-back', door: 'door', drawer: 'drawer' } as const;

/** Mặt đứng 2D đơn sắc, đúng tỷ lệ thật (đặt trên 1 vạch sàn) — nét mực `--color-ink`. */
function ModuleElevation({ gw, gh, feat, count }: { gw: number; gh: number; feat: 'open' | 'back' | 'door' | 'drawer'; count: number }) {
  const SC = 1.42, FLOOR = 106, CW = 110;
  const pw = gw * 18 * SC, ph = gh * 18 * SC;
  const x0 = (CW - pw) / 2, y0 = FLOOR - ph, c = CW / 2, cy = y0 + ph / 2;
  const ink = 'var(--color-ink)';
  const marks: ReactNode[] = [];
  if (feat === 'back') {
    marks.push(<rect key="bk" x={x0 + 4} y={y0 + 4} width={pw - 8} height={ph - 8} fill="none" stroke={ink} strokeWidth={0.7} opacity={0.45} />);
  } else if (feat === 'door') {
    if (count === 2) {
      marks.push(<line key="sp" x1={c} y1={y0 + 2} x2={c} y2={y0 + ph - 2} stroke={ink} strokeWidth={0.9} />);
      marks.push(<line key="h1" x1={c - 6} y1={cy - 8} x2={c - 6} y2={cy + 8} stroke={ink} strokeWidth={1.5} />);
      marks.push(<line key="h2" x1={c + 6} y1={cy - 8} x2={c + 6} y2={cy + 8} stroke={ink} strokeWidth={1.5} />);
    } else {
      marks.push(<line key="h" x1={x0 + pw - 7} y1={cy - 8} x2={x0 + pw - 7} y2={cy + 8} stroke={ink} strokeWidth={1.5} />);
    }
  } else if (feat === 'drawer') {
    const sh = ph / count;
    for (let i = 0; i < count; i++) {
      const sy = y0 + i * sh;
      if (i > 0) marks.push(<line key={`d${i}`} x1={x0} y1={sy} x2={x0 + pw} y2={sy} stroke={ink} strokeWidth={1} />);
      marks.push(<line key={`dh${i}`} x1={c - 9} y1={sy + sh / 2} x2={c + 9} y2={sy + sh / 2} stroke={ink} strokeWidth={1.5} />);
    }
  }
  return (
    <svg viewBox="0 0 110 110" width="100%" style={{ display: 'block' }} aria-hidden>
      <line x1={x0 - 3} y1={FLOOR} x2={x0 + pw + 3} y2={FLOOR} stroke={ink} strokeWidth={0.7} opacity={0.3} />
      <rect x={x0} y={y0} width={pw} height={ph} fill="none" stroke={ink} strokeWidth={1.3} />
      {marks}
    </svg>
  );
}

// P99 — Sub-biến thể CÁNH theo bề rộng & NGĂN KÉO theo chiều cao. DÙNG CHUNG: gallery
// (ModulePicker) lẫn panel "Đổi kiểu ô" — 1 nguồn để tile luôn khớp nhau.
function doorSubVariants(gw: number): { count: number; sub: string; extra: Partial<YModule> }[] {
  if (gw === 3)
    return [
      { count: 1, sub: 'cánh đơn', extra: { doorLeaves: 1 } },
      { count: 2, sub: 'cánh đôi', extra: { doorLeaves: 2 } },
    ];
  const lv = gw >= 4 ? 2 : 1;
  return [{ count: lv, sub: lv === 2 ? 'cánh đôi' : 'cánh đơn', extra: {} }];
}
function drawerSubVariants(gh: number): { count: number; sub: string; extra: Partial<YModule> }[] {
  if (gh >= 4)
    return [
      { count: 2, sub: '2 ngăn', extra: { drawers: 2 } },
      { count: 3, sub: '3 ngăn', extra: { drawers: 3 } },
    ];
  const dc = gh >= 3 ? 2 : 1;
  return [{ count: dc, sub: `${dc} ngăn`, extra: {} }];
}
// P99 — Mọi biến thể KIỂU ô có thể đổi cho 1 ô (GIỮ NGUYÊN cỡ): open + back luôn có;
// door/drawer theo vị từ; sub-option (số cánh/số ngăn) bung thành tile riêng như gallery.
function editVariants(m: { gw: number; gh: number }): { feat: 'open' | 'back' | 'door' | 'drawer'; count: number; sub: string; extra: Partial<YModule> }[] {
  const out: { feat: 'open' | 'back' | 'door' | 'drawer'; count: number; sub: string; extra: Partial<YModule> }[] = [
    { feat: 'open', count: 1, sub: 'mở', extra: {} },
    { feat: 'back', count: 1, sub: 'mở có hậu', extra: {} },
  ];
  if (doorAllowedY(m)) for (const v of doorSubVariants(m.gw)) out.push({ feat: 'door', ...v });
  if (drawerAllowedY(m)) for (const v of drawerSubVariants(m.gh)) out.push({ feat: 'drawer', ...v });
  return out;
}

/** Gallery chọn module: tab tính năng + lưới mặt đứng — thay luồng cỡ/tính năng/xoay khi bấm +. */
function ModulePicker({ onPick, onCancel }: {
  onPick: (sel: { gw: number; gh: number; attribute: YModule['attribute']; extra: Partial<YModule> }) => void;
  onCancel: () => void;
}) {
  const [feat, setFeat] = useState<'open' | 'back' | 'door' | 'drawer'>('open');
  const tiles: { gw: number; gh: number; label: string; sub: string; count: number; extra: Partial<YModule> }[] = [];
  for (const s of PICK_SHAPES) {
    if (!s.feats[feat]) continue;
    if (feat === 'door') {
      for (const v of doorSubVariants(s.gw)) tiles.push({ gw: s.gw, gh: s.gh, label: s.label, sub: v.sub, count: v.count, extra: v.extra });
    } else if (feat === 'drawer') {
      for (const v of drawerSubVariants(s.gh)) tiles.push({ gw: s.gw, gh: s.gh, label: s.label, sub: v.sub, count: v.count, extra: v.extra });
    } else {
      tiles.push({ gw: s.gw, gh: s.gh, label: s.label, sub: feat === 'back' ? 'có hậu' : 'mở', count: 1, extra: {} });
    }
  }
  return (
    <SectionCard>
      <div className="mb-1.5 flex items-center justify-between">
        <SectionHeading>Thêm ô mới</SectionHeading>
        <button onClick={onCancel} className="text-base leading-none text-[var(--color-accent)]/70 hover:text-[var(--color-accent)]" aria-label="Huỷ thêm ô">✕</button>
      </div>
      <div className="mb-1.5 flex flex-wrap gap-1">
        {PICK_FEATS.map((f) => (
          <PillButton key={f.k} active={feat === f.k} onClick={() => setFeat(f.k)} className="text-[11px]">
            {f.label}
          </PillButton>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1">
        {tiles.map((t, i) => (
          <button
            key={`${t.label}-${t.sub}-${i}`}
            onClick={() => onPick({ gw: t.gw, gh: t.gh, attribute: PICK_ATTR[feat], extra: t.extra })}
            className="flex flex-col items-center rounded border border-[var(--color-accent)]/10 bg-[var(--color-bg)] px-0.5 pt-1 pb-0.5 text-[var(--color-ink)] transition hover:border-[var(--color-accent)]/45"
            title={`${t.label} cm · ${t.sub}`}
          >
            <ModuleElevation gw={t.gw} gh={t.gh} feat={feat} count={t.count} />
            <span className="text-[10px] font-medium leading-tight">{t.label}</span>
            {t.sub !== 'mở' && t.sub !== 'có hậu' && (
              <span className="text-[8px] leading-tight text-[var(--color-accent)]/60">{t.sub}</span>
            )}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[9px] font-viet leading-snug text-[var(--color-accent)]/60">Bấm 1 hình để thêm ô.</p>
    </SectionCard>
  );
}

interface Props {
  dna: ProductDNA;
  initialValues?: Partial<ParamValues>;
  mode?: 'interactive' | 'public' | 'admin' | 'screenshot';
  presetMeta?: { slug?: string; name?: string };
  priceConfig?: PriceConfig;
  enabledMaterials?: string[];
  homeHref?: string;
  /** Chỉ khi mode='screenshot' — 1 trong 3 góc chụp thumbnail (đồng bộ tu-x). */
  screenshotAngle?: 'iso-front-right' | 'front' | 'iso-front-left';
  /** (admin) Lưu cấu hình hiện tại thành preset. Có → hiện nút "Lưu preset". */
  onSavePreset?: (values: ParamValues) => void | Promise<void>;
}

export function YConfigurator({ dna, initialValues, mode = 'public', presetMeta, priceConfig, enabledMaterials, homeHref, screenshotAngle, onSavePreset }: Props) {
  const isAdmin = mode === 'admin';
  // P86 — chế độ chụp thumbnail: camera/đèn studio, ẩn UI, nền trong suốt, đồ trang trí.
  const isShot = mode === 'screenshot';

  // ── State (values + undo history) ──
  const [hist, setHist] = useState<{ values: ParamValues; past: ParamValues[] }>(() => {
    const seed: ParamValues = {};
    for (const p of dna.parameters) seed[p.id] = p.default;
    if (initialValues) for (const k in initialValues) if (initialValues[k] !== undefined) seed[k] = initialValues[k]!;
    return { values: seed, past: [] };
  });
  const values = hist.values;
  const canUndo = hist.past.length > 0;
  const setValues = useCallback((next: ParamValues) => {
    setHist((h) => (next === h.values ? h : { values: next, past: [...h.past, h.values].slice(-50) }));
  }, []);
  const undo = useCallback(() => {
    setHist((h) => (h.past.length === 0 ? h : { values: h.past[h.past.length - 1], past: h.past.slice(0, -1) }));
    setSelectedId(null);
  }, []);
  const setParam = (id: string, value: number | string) => setValues({ ...values, [id]: value });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showTotalDims, setShowTotalDims] = useState(true); // P95 — toggle kích thước tổng (nút nổi viewport)
  const [addEdge, setAddEdge] = useState<'left' | 'right' | 'top' | 'bottom' | 'first' | null>(null); // P97 — đang thêm ô → gallery ('first' = ô đầu tiên khi rỗng)

  // ── Composition + build + price ──
  const comp = useMemo(() => parseModules(values.modules), [values.modules]);
  const build = useMemo(() => dna.build(values, priceConfig ? { priceConfig } : undefined), [dna, values, priceConfig]);
  const price = useMemo(() => computePrice(build, priceConfig ?? dna.priceConfig), [build, priceConfig, dna]);
  const warnings = useMemo(() => dna.getWarnings?.(values) ?? [], [dna, values]);
  const boxes = useMemo(() => moduleBoxes(comp), [comp]);
  const selectedBox = selectedId ? boxes.find((b) => b.id === selectedId) ?? null : null;
  const floating = useMemo(() => new Set(findFloating(comp)), [comp]);
  // P86 — camera studio khi chụp (theo phủ bì build.size). null khi không chụp.
  const shotCam = useMemo(
    () =>
      isShot
        ? computeScreenshotCamera(build.size?.w ?? 720, build.size?.h ?? 720, build.size?.d ?? DEPTH, screenshotAngle ?? 'iso-front-right')
        : null,
    [isShot, build.size?.w, build.size?.h, build.size?.d, screenshotAngle],
  );

  // ── Module mutations (commit qua values.modules) ──
  const commitComp = (next: YComposition | null, selectAfter?: string) => {
    if (!next) {
      setToast('Không đặt được ô (đè ô khác hoặc lọt dưới sàn).');
      return;
    }
    setValues({ ...values, modules: encodeModules(next) });
    if (selectAfter !== undefined) setSelectedId(selectAfter);
  };
  // P97 — bấm "+" KHÔNG thêm ngay; mở GALLERY chọn module (cỡ + tính năng) rồi mới đặt.
  const handleAdd = (edge: 'left' | 'right' | 'top' | 'bottom') => {
    if (!selectedBox) return;
    setAddEdge(edge);
  };
  const handlePick = (sel: { gw: number; gh: number; attribute: YModule['attribute']; extra: Partial<YModule> }) => {
    if (!addEdge) return;
    if (addEdge === 'first') {
      // P97 — ô ĐẦU TIÊN (đang rỗng): đặt tại gốc (gx=0, gy=0, tựa sàn).
      const m0: YModule = { id: 'm0', gx: 0, gy: 0, gw: sel.gw, gh: sel.gh, attribute: sel.attribute, ...sel.extra };
      setValues({ ...values, modules: encodeModules({ modules: [m0] }) });
      setSelectedId('m0');
      setAddEdge(null);
      return;
    }
    if (!selectedBox) return;
    const expectId = nextIdFor(comp);
    commitComp(placeAtEdge(comp, selectedBox.module.id, addEdge, { gw: sel.gw, gh: sel.gh }, sel.attribute, sel.extra), expectId);
    setAddEdge(null);
  };
  const patchModule = (patch: Partial<YModule>) => {
    if (!selectedId) return;
    // P92 — đổi cỡ làm ô-cánh có cạnh 18cm (gw<2 hoặc gh<2) → tự chuyển "Mở (có hậu)".
    // Cánh cần ≥36cm CẢ rộng lẫn cao; đồng bộ với cấm cánh trong dna (effectiveAttrY).
    let p = patch;
    if (patch.gw !== undefined || patch.gh !== undefined) {
      const cur = comp.modules.find((x) => x.id === selectedId);
      const ngw = patch.gw ?? cur?.gw ?? 2;
      const ngh = patch.gh ?? cur?.gh ?? 2;
      const attr = patch.attribute ?? cur?.attribute;
      if (attr === 'door' && (ngw < 2 || ngh < 2)) p = { ...patch, attribute: 'open-back' };
      // P97 — đổi cỡ làm ô ngăn kéo không còn hợp lệ (không phải đứng rộng 36cm) → "Mở (có hậu)".
      if (attr === 'drawer' && !(ngw === 2 && ngh >= 2)) p = { ...patch, attribute: 'open-back' };
    }
    commitComp(updateModule(comp, selectedId, p), selectedId);
  };
  const handleDelete = () => {
    if (!selectedId) return;
    const next = removeModule(comp, selectedId);
    if (next) {
      // P97 — xoá ô CUỐI → comp RỖNG (vẽ lại từ 0); viewport hiện nút "+" Thêm ô đầu tiên.
      setValues({ ...values, modules: encodeModules(next) });
      setSelectedId(null);
    }
  };

  // ── Swatch lists ──
  // P83.5b — Màu khung/cánh/ô lấy TRỰC TIẾP từ danh sách màu ĐÃ BẬT trong catalog
  // admin (enabledMaterials) + tên từ priceConfig.materialLabels. Trước đây chỉ giao
  // với 4 màu CỨNG của DNA → admin tích màu khác không hiện. Vắng catalog (local/test)
  // → rơi về 4 màu mẫu của DNA.
  const curColor = String(values.color ?? '');
  const catalogColors =
    enabledMaterials && enabledMaterials.length
      ? enabledMaterials.map((id) => ({ value: id, label: priceConfig?.materialLabels?.[id] ?? id }))
      : null;
  const frameColors: { value: string; label: string }[] = catalogColors
    ? // luôn giữ màu ĐANG CHỌN trong danh sách (kể cả nếu admin tắt sau)
      curColor && !catalogColors.some((o) => o.value === curColor)
      ? [{ value: curColor, label: priceConfig?.materialLabels?.[curColor] ?? curColor }, ...catalogColors]
      : catalogColors
    : paramOptions(dna, 'color');
  const edgeColors = paramOptions(dna, 'edgeBanding');
  const handleTypes = paramOptions(dna, 'handleType');
  // P85 — mode màu: 'rieng' → hiện picker khung/cánh/nẹp PER-Ô; 'chung' → chỉ màu chung.
  // colorMode tường minh THẮNG; vắng + có màu per-ô (preset cũ) → 'rieng' (khớp build).
  const perCell =
    values.colorMode != null
      ? String(values.colorMode) === 'rieng'
      : comp.modules.some((m) => m.color || m.doorColor || m.edgeColor);

  const selModule = selectedBox?.module;
  const cutlist = useMemo(() => buildCutlist(build, priceConfig ?? dna.priceConfig), [build, priceConfig, dna]);

  // P93 — Gom mỗi CÁNH (+ tay nắm của nó) thành 1 "assembly" để mở ra khi chọn ô
  // (tái dùng AssemblyMesh của tủ x). Pivot = mép BẢN LỀ (theo hingeOnLeft), xoay ~75°.
  // Tay nắm "dính" theo cánh trong cùng group. Phần còn lại (vách/nóc/đáy/hậu/chân +
  // tay nắm khác) render thường. id cánh tủ y: `door-m{idp}-{a|b}`; tay nắm: `hbar/hstrip-m{idp}-{a|b}-*`.
  const doorAssemblies = useMemo(() => {
    const usedParts = new Set<string>();
    const usedFittings = new Set<string>();
    const list: Array<{ moduleId: string; config: AssemblyConfig }> = [];
    for (const part of build.parts) {
      const mm = part.id.match(/^door-m(.+)-([ab])$/);
      if (!mm) continue;
      const moduleId = mm[1];
      const suffix = mm[2];
      const hingeOnLeft = part.hingeOnLeft ?? true;
      const sx = part.size[0];
      const pivotPos: [number, number, number] = [
        part.position[0] + (hingeOnLeft ? -sx / 2 : sx / 2), // mép bản lề (cạnh dài đứng)
        part.position[1],
        part.position[2],
      ];
      const asmFittings = (build.fittings ?? []).filter(
        (f) => f.id.startsWith(`hbar-m${moduleId}-${suffix}-`) || f.id.startsWith(`hstrip-m${moduleId}-${suffix}-`),
      );
      usedParts.add(part.id);
      asmFittings.forEach((f) => usedFittings.add(f.id));
      list.push({
        moduleId,
        config: { pivotPos, kind: 'door', angleSign: hingeOnLeft ? -1 : 1, parts: [part], fittings: asmFittings },
      });
    }
    // P97 — NGĂN KÉO: mỗi mặt ngăn kéo + 4 ván thùng hộc + tay nắm = 1 assembly TRƯỢT RA
    // (+250mm) khi ô đang chọn. id mặt: `drawer-m{id}-d{i}`; thùng: `drawer{L,R,Bk,Bot}-...`.
    for (const part of build.parts) {
      const mm = part.id.match(/^drawer-(.+)-d(\d+)$/);
      if (!mm) continue;
      const moduleId = mm[1];
      const sfx = `${moduleId}-d${mm[2]}`;
      const boxParts = build.parts.filter(
        (p) =>
          p.id === `drawer-${sfx}` ||
          p.id === `drawerL-${sfx}` ||
          p.id === `drawerR-${sfx}` ||
          p.id === `drawerBk-${sfx}` ||
          p.id === `drawerBot-${sfx}`,
      );
      const asmFittings = (build.fittings ?? []).filter(
        (f) => f.id.startsWith(`hbar-d-${sfx}-`) || f.id.startsWith(`hstrip-d-${sfx}-`),
      );
      boxParts.forEach((p) => usedParts.add(p.id));
      asmFittings.forEach((f) => usedFittings.add(f.id));
      list.push({
        moduleId,
        config: { pivotPos: [part.position[0], part.position[1], part.position[2]], kind: 'drawer', parts: boxParts, fittings: asmFittings },
      });
    }
    return {
      list,
      restParts: build.parts.filter((p) => !usedParts.has(p.id)),
      restFittings: (build.fittings ?? []).filter((f) => !usedFittings.has(f.id)),
    };
  }, [build.parts, build.fittings]);

  // MUUTO — state accordion (mở-một-panel) cho tủ y (chỉ trình bày, KHÔNG đụng handler).
  const [openPanel, setOpenPanel] = useState<string | null>('cell');
  const togglePanel = (p: string) => setOpenPanel((cur) => (cur === p ? null : p));
  // MUUTO — Tools cho ConfigShell: Hoàn tác · bật/tắt kích thước tổng.
  const shellTools: ToolSpec[] | undefined = isShot
    ? undefined
    : [
        { key: 'undo', icon: IconUndo, label: 'Hoàn tác', onClick: undo, disabled: !canUndo, title: 'Hoàn tác thay đổi gần nhất' },
        { key: 'dims', icon: IconRuler, label: 'Kích thước', onClick: () => setShowTotalDims((v) => !v), active: showTotalDims, title: showTotalDims ? 'Ẩn kích thước tổng' : 'Hiện kích thước tổng' },
      ];
  return (
    <ConfigShell
      chrome={!isShot}
      brand="ngăn"
      backHref={homeHref}
      kicker="Tủ mô-đun"
      title={presetMeta?.name?.replace(/^(kê|ngăn)\.?\s*/i, '') || "Tự thiết kế"}
      tools={shellTools}
      commerce={
        !isAdmin
          ? ({
              priceTotal: price.total,
              orderTitle: 'Đặt hàng',
              onShare: () => buildShareUrl('tu-y', values),
              onSave: () => saveDesignLocal('tu-y', values, presetMeta?.name),
              summary: <p><strong>Mẫu:</strong> {presetMeta?.name || dna.name}</p>,
              buildPayload: () => ({ preset: { slug: presetMeta?.slug ?? 'tu-y', name: presetMeta?.name ?? dna.name }, values, price, cutlist, bom: build.fittings ?? [] }),
            } satisfies CommerceData)
          : undefined
      }
      sidebar={
        <>

        {/* (admin) Lưu preset — kit dùng chung */}
        {isAdmin && onSavePreset && <SavePresetButton values={values} onSave={onSavePreset} className="self-start" />}

        {/* MUUTO — bấm "+" → gallery chọn module (full-width); else accordion. */}
        {addEdge ? (
        <ModulePicker onPick={handlePick} onCancel={() => setAddEdge(null)} />
        ) : (
        <div className="flex flex-col">
        <AccordionItem title="Ô đang chọn" open={openPanel === 'cell'} onToggle={() => togglePanel('cell')}>
          {!selModule ? (
            <p className="text-xs font-viet leading-relaxed text-[var(--color-accent)]/70">Chạm vào 1 ô trên mô hình để chỉnh. Bấm dấu “+” quanh ô để thêm ô mới.</p>
          ) : (
            <div className="flex flex-col gap-3 text-xs">
              {/* P99 — Đổi KIỂU ô tại chỗ bằng HÌNH VẼ mặt đứng (dùng chung ModuleElevation với gallery). */}
              <p className="font-viet leading-relaxed text-[var(--color-accent)]/70">Bấm hình để đổi KIỂU ô. Đổi KÍCH THƯỚC thì xoá rồi thêm bằng bộ hình “+”.</p>
              <div className="border-t border-[var(--color-accent)]/15 pt-2">
                <p className="mb-1 font-viet text-[var(--color-accent)]/70">Kiểu ô</p>
                <div className="grid grid-cols-3 gap-1">
                  {editVariants(selModule).map((v, i) => {
                    const eff = effectiveAttrY(selModule);
                    const cf = eff === 'open-nobk' ? 'open' : eff === 'open-back' ? 'back' : eff;
                    const cc = eff === 'door' ? (selModule.doorLeaves ?? (selModule.gw >= 4 ? 2 : 1)) : eff === 'drawer' ? drawerCountY(selModule) : 1;
                    const active = v.feat === cf && v.count === cc;
                    return (
                      <button
                        key={`${v.feat}-${v.count}-${i}`}
                        onClick={() => patchModule({ attribute: PICK_ATTR[v.feat], doorLeaves: v.extra.doorLeaves, drawers: v.extra.drawers })}
                        className={`flex flex-col items-center rounded border px-0.5 pt-1 pb-0.5 text-[var(--color-ink)] transition ${active ? 'border-[var(--color-accent)] bg-[var(--color-accent-bg)]/70' : 'border-[var(--color-accent)]/10 bg-[var(--color-bg)] hover:border-[var(--color-accent)]/45'}`}
                        title={v.sub}
                      >
                        <ModuleElevation gw={selModule.gw} gh={selModule.gh} feat={v.feat} count={v.count} />
                        <span className="text-[10px] font-medium leading-tight">{v.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* P85 — màu RIÊNG từng ô (khung · cánh · nẹp), chỉ hiện ở mode 'rieng'. */}
              {perCell && (
                <div className="flex flex-col gap-2 border-t border-[var(--color-accent)]/15 pt-2">
                  <div>
                    <p className="mb-1 font-viet text-[var(--color-accent)]/70">Màu khung ô</p>
                    <div className="grid grid-cols-2 gap-1">
                      <PillButton active={!selModule.color || selModule.color === 'frame'} onClick={() => patchModule({ color: undefined })} className="col-span-2 text-[10px]">Mặc định</PillButton>
                      {frameColors.map((c) => (
                        <SwatchOption key={c.value} swatchStyle={swatchCss(c.value, resolveMaterial(c.value).hex)} label={c.label} active={selModule.color === c.value} onClick={() => patchModule({ color: c.value })} />
                      ))}
                    </div>
                  </div>
                  {(selModule.attribute === 'door' || selModule.attribute === 'drawer') && (
                    <div>
                      <p className="mb-1 font-viet text-[var(--color-accent)]/70">{selModule.attribute === 'drawer' ? 'Màu mặt ngăn kéo' : 'Màu cánh ô'}</p>
                      <div className="grid grid-cols-2 gap-1">
                        <PillButton active={!selModule.doorColor} onClick={() => patchModule({ doorColor: undefined })} className="col-span-2 text-[10px]">Theo khung</PillButton>
                        {frameColors.map((c) => (
                          <SwatchOption key={c.value} swatchStyle={swatchCss(c.value, resolveMaterial(c.value).hex)} label={c.label} active={selModule.doorColor === c.value} onClick={() => patchModule({ doorColor: c.value })} />
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="mb-1 font-viet text-[var(--color-accent)]/70">Màu nẹp ô</p>
                    <div className="grid grid-cols-2 gap-1">
                      <PillButton active={!selModule.edgeColor} onClick={() => patchModule({ edgeColor: undefined })} className="col-span-2 text-[10px]">Theo nẹp chung</PillButton>
                      {edgeColors.map((c) => {
                        const def = EDGE_BAND_COLORS.find((e) => e.id === c.value);
                        return (
                          <SwatchOption
                            key={c.value}
                            swatchStyle={def?.hex ? { backgroundColor: def.hex } : { background: 'linear-gradient(135deg, #e2ded7 50%, #ffffff 50%)' }}
                            label={c.label}
                            active={selModule.edgeColor === c.value}
                            onClick={() => patchModule({ edgeColor: c.value })}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              {floating.has(selModule.id) && (
                <p className="rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent-bg)]/95 px-2 py-1 text-[var(--color-accent)]">⚠ Ô này đang “bay” — chưa có ô/sàn đỡ.</p>
              )}
              <PillButton onClick={handleDelete} className="border border-[var(--color-accent)]/40">🗑 Xoá ô</PillButton>
            </div>
          )}
        </AccordionItem>

        {/* MUUTO — accordion "Màu sắc": chế độ màu + (màu khung/nẹp khi chung) */}
        <AccordionItem title="Màu sắc" open={openPanel === 'color'} onToggle={() => togglePanel('color')}>
          <div className="flex flex-col gap-3">
            <div>
              <Segmented
                ariaLabel="Chế độ màu"
                options={[{ value: 'chung', label: 'Màu chung' }, { value: 'rieng', label: 'Riêng từng ô' }]}
                value={perCell ? 'rieng' : 'chung'}
                onChange={(v) => setParam('colorMode', v)}
              />
              {perCell && (
                <p className="mt-1.5 text-[10px] font-viet leading-relaxed text-[var(--color-ink-2)]">Bấm 1 ô trên mô hình để chỉnh màu khung/cánh/nẹp riêng cho ô đó.</p>
              )}
            </div>

            {/* Màu khung + nẹp TOÀN CỤC chỉ hiện ở mode CHUNG (đổi cả tủ). */}
            {!perCell && (
            <>
            <div>
              <p className="muuto-label mb-1.5 text-[var(--color-ink-2)]">Màu khung</p>
              <div className="grid grid-cols-2 gap-1">
                {frameColors.map((c) => (
                  <SwatchOption key={c.value} swatchStyle={swatchCss(c.value, resolveMaterial(c.value).hex)} label={c.label} active={values.color === c.value} onClick={() => setParam('color', c.value)} />
                ))}
              </div>
            </div>
            <div>
              <p className="muuto-label mb-1.5 text-[var(--color-ink-2)]">Màu nẹp</p>
              <div className="grid grid-cols-2 gap-1">
                {edgeColors.map((c) => {
                  const def = EDGE_BAND_COLORS.find((e) => e.id === c.value);
                  return (
                    <SwatchOption
                      key={c.value}
                      swatchStyle={def?.hex ? { backgroundColor: def.hex } : { background: 'linear-gradient(135deg, #e2ded7 50%, #ffffff 50%)' }}
                      label={c.label}
                      active={(values.edgeBanding ?? 'same') === c.value}
                      onClick={() => setParam('edgeBanding', c.value)}
                    />
                  );
                })}
              </div>
            </div>
            </>
            )}
          </div>
        </AccordionItem>

        {/* Tay nắm (admin) — accordion */}
        {isAdmin && handleTypes.length > 0 && (
          <AccordionItem title="Loại tay nắm" open={openPanel === 'handle'} onToggle={() => togglePanel('handle')}>
            <div className="grid grid-cols-2 gap-1">
              {handleTypes.map((h) => (
                <PillButton key={h.value} active={(values.handleType ?? 'bar') === h.value} onClick={() => setParam('handleType', h.value)} className="text-xs">
                  {h.label}
                </PillButton>
              ))}
            </div>
          </AccordionItem>
        )}
        </div>
        )}

        {/* P95 — Admin: bảng giá chi tiết + cutlist trong sidebar. KHÁCH: giá + Đặt hàng
            chuyển NỔI lên viewport (OrderBar) → bỏ khỏi sidebar. */}
        {isAdmin && (
          <section className="mt-auto flex flex-col gap-3">
            <PricePanel price={price} size={build.size} />
            <CutlistPanel cutlist={cutlist} materialLabels={priceConfig?.materialLabels ?? {}} />
          </section>
        )}
        </>
      }
      viewport={
        <>
        {/* MUUTO — Trang chủ (→ TopBar) + Hoàn tác/Kích thước (→ Toolbar) + Giá/Đặt hàng (→ CommerceBar) chuyển ra ConfigShell. */}
        {/* P96 — hint pill + cảnh báo + toast (kit) */}
        {!isShot && !selectedId && comp.modules.length > 0 && <HintPill>Chạm ô để chỉnh · bấm + để thêm ô</HintPill>}
        {/* P97 — vẽ từ 0: nút "+" giữa viewport để chọn ô đầu tiên. */}
        {!isShot && comp.modules.length === 0 && !addEdge && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <button
              onClick={() => setAddEdge('first')}
              className="pointer-events-auto flex flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-[var(--color-accent)]/45 bg-[var(--color-bg)]/85 px-8 py-6 text-[var(--color-accent)] backdrop-blur transition hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white"
            >
              <span className="text-3xl leading-none">+</span>
              <span className="text-sm font-viet">Thêm ô đầu tiên</span>
            </button>
          </div>
        )}
        {!isShot && <WarningBox warnings={warnings} title="⚠ Cảnh báo" />}
        {!isShot && <Toast message={toast} onDismiss={() => setToast(null)} />}
        <Canvas
          shadows={SHADOW_CONFIG}
          onPointerMissed={() => { setSelectedId(null); setAddEdge(null); }}
          // Chụp: camera studio (shotCam); thường: camera mặc định + FitCamera.
          camera={shotCam ?? { position: [2400, 1200, 3000], fov: 35, near: 50, far: 30000 }}
          // Chụp: nền TRONG SUỐT (alpha) → khâu capture composite lên nền studio; thường: nền đặc.
          gl={
            isShot
              ? { preserveDrawingBuffer: true, alpha: true, antialias: true, toneMapping: NeutralToneMapping }
              : { preserveDrawingBuffer: true, toneMapping: NeutralToneMapping }
          }
          dpr={isShot ? 2.5 : undefined}
        >
          {!isShot && <color attach="background" args={['#eeeeee']} />}
          {isShot ? <ScreenshotLighting /> : <SceneLighting />}
          {isShot ? <Ground variant="studio" /> : <Ground />}
          {isShot && <ScreenshotPostFX />}
          {isShot && shotCam && (
            <ScreenshotCameraRig position={shotCam.position} centerY={(build.size?.h ?? 720) / 2} />
          )}
          {/* Đồ trang trí trong hốc ô mở — CHỈ khi chụp. size={undefined} → TẮT đồ-trên-nóc
              (tránh lơ lửng với tủ y xếp so le). seed theo composition → chụp lại ra y hệt. */}
          {isShot && <StagingProps cavities={build.cavities ?? []} seed={`tuy|${values.modules ?? ''}`} size={undefined} />}
          {!isShot && <Wall parts={build.parts} />}
          {/* P93 — phần KHÔNG mở (vách/nóc/đáy/hậu/chân + tay nắm khác) render thường. */}
          {doorAssemblies.restParts.map((part) => (
            <PartMesh key={part.id} part={part} fittings={build.fittings} />
          ))}
          {doorAssemblies.restFittings.map((f) => (
            <FittingMesh key={f.id} fitting={f} />
          ))}
          {/* P93 — mỗi CÁNH = 1 assembly: mở ~75° khi ô của nó đang chọn (selectedId), else đóng. */}
          {doorAssemblies.list.map((a) => (
            <AssemblyMesh
              key={a.config.parts[0].id}
              config={a.config}
              openProgress={selectedId === a.moduleId ? 1 : 0}
              fittingsForHingeDetect={build.fittings}
            />
          ))}
          {!isShot && <Dimensions parts={build.parts} showOuter={showTotalDims} />}
          {!isShot && <ModuleHitboxes boxes={boxes} onPick={(id) => { setSelectedId(id); setAddEdge(null); }} />}
          {!isShot && selectedBox && <ModuleHighlight box={selectedBox} />}
          {!isShot && selectedBox && <EdgeAddButtons box={selectedBox} onAdd={handleAdd} />}
          {!isShot && <FitCamera w={build.size?.w ?? 720} h={build.size?.h ?? 720} d={build.size?.d ?? DEPTH} />}
          {!isShot && <OrbitControls makeDefault enableDamping maxPolarAngle={Math.PI / 2.05} minDistance={500} maxDistance={9000} />}
        </Canvas>
        </>
      }
    />
  );
}

/** id mà placeAtEdge sẽ cấp cho ô mới (đồng bộ nextModuleId trong modules.ts). */
function nextIdFor(comp: YComposition): string {
  let max = -1;
  for (const m of comp.modules) {
    const mt = m.id.match(/^m(\d+)$/);
    if (mt) max = Math.max(max, parseInt(mt[1], 10));
  }
  return `m${max + 1}`;
}

export default YConfigurator;
