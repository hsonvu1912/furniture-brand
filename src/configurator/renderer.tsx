'use client';
// =============================================================
// RENDER 3D — Part[] → mesh Three.js.
// Ánh sáng 3 điểm lấy từ tylko-demo/index.html (dòng 457–471).
// =============================================================
import { useEffect, useMemo } from 'react';
import type {} from '@react-three/fiber'; // nạp kiểu JSX cho <mesh>, <light>...
import { Html, Line } from '@react-three/drei';
import {
  CanvasTexture,
  ExtrudeGeometry,
  Path,
  RepeatWrapping,
  Shape,
  SRGBColorSpace,
  Vector2,
} from 'three';
import { resolveMaterial } from './materials';
import type { Fitting, Part } from './types';

// --- Vân gỗ procedural cho veneer: 1 texture XÁM (mặt nạ) NHÂN lên màu gỗ ---
// Nền trắng = giữ nguyên màu; nét xám = vân đậm. Dùng làm `map` cùng `color = màu gỗ`
// → map lỗi/không áp được thì vẫn còn đúng màu gỗ (không bao giờ ra trắng).
let grainTex: CanvasTexture | null = null;

/** Vẽ mặt nạ vân gỗ (xám): nền trắng + dải rộng + nét sọc lượn NHẸ (sin). */
function makeGrainCanvas(): HTMLCanvasElement {
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, S, S);
  ctx.lineCap = 'round';
  // 1 dải vân = đường lượn dọc; gray thấp = đậm; amp = độ uốn.
  const band = (gray: number, alpha: number, width: number, amp: number) => {
    const x = Math.random() * S;
    const ph = Math.random() * 9;
    ctx.strokeStyle = `rgb(${gray},${gray},${gray})`;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let y = -24; y <= S + 24; y += 12) {
      const wob = Math.sin(y * 0.011 + ph) * amp + Math.sin(y * 0.05 + ph * 2) * amp * 0.32;
      if (y === -24) ctx.moveTo(x + wob, y);
      else ctx.lineTo(x + wob, y);
    }
    ctx.stroke();
  };
  // dải rộng (vân lớn) — to bản, RẤT nhạt
  for (let i = 0; i < 8; i++) {
    band(176 + ((Math.random() * 38) | 0), 0.14 + Math.random() * 0.2, 22 + Math.random() * 46, 14 + Math.random() * 16);
  }
  // nét vừa — vân chính, NHẸ NHÀNG (đã hạ độ đậm: gỗ tự nhiên, không đen kịt)
  for (let i = 0; i < 44; i++) {
    band(124 + ((Math.random() * 60) | 0), 0.14 + Math.random() * 0.24, 1.4 + Math.random() * 4, 8 + Math.random() * 11);
  }
  // nét mảnh — chi tiết mờ
  for (let i = 0; i < 34; i++) {
    band(146 + ((Math.random() * 52) | 0), 0.1 + Math.random() * 0.18, 0.5 + Math.random() * 1.5, 6 + Math.random() * 8);
  }
  ctx.globalAlpha = 1;
  return cv;
}

/** Texture mặt nạ vân gỗ GỐC — sinh 1 lần; mỗi ván clone ra bản riêng (xem makePartGrain). */
function getGrainTexture(): CanvasTexture {
  if (!grainTex) {
    grainTex = new CanvasTexture(makeGrainCanvas());
    grainTex.colorSpace = SRGBColorSpace;
  }
  return grainTex;
}

// --- Mỗi ván veneer 1 texture RIÊNG: vân dọc cạnh dài, mật độ cố định, lệch ngẫu nhiên ---
const GRAIN_TILE = 900; // 1 nhịp vân (dọc thớ) ~900mm — mật độ thật, KHÔNG co giãn theo ván
const GRAIN_CROSS = 340; // bề ngang 1 dải vân ~340mm

/** Băm chuỗi → số 0..1 ổn định (offset vân theo id ván — "ngẫu nhiên" mà không nhấp nháy). */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 997) / 997;
}

/**
 * Texture vân gỗ riêng cho 1 ván: clone mặt nạ gốc (chung ảnh nguồn nên rẻ); đặt `repeat`
 * theo kích thước THẬT → mật độ vân không đổi; xoay cho vân chạy dọc cạnh DÀI hơn của ván;
 * lệch `offset` theo id → mỗi ván một kiểu.
 */
function makePartGrain(size: [number, number, number], id: string): CanvasTexture {
  const tex = getGrainTexture().clone();
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.center.set(0.5, 0.5);
  const thick = Math.min(size[0], size[1], size[2]); // cạnh nhỏ nhất = bề dày ván
  const plane = size.filter((_, i) => i !== size.indexOf(thick)); // 2 cạnh của mặt lớn
  const along = Math.max(plane[0], plane[1]);
  const across = Math.min(plane[0], plane[1]);
  if (plane[1] >= plane[0]) {
    // cạnh dài là cạnh "dọc" của mặt → vân (trục V của ảnh) đã đúng hướng
    tex.rotation = 0;
    tex.repeat.set(across / GRAIN_CROSS, along / GRAIN_TILE);
  } else {
    // cạnh dài là cạnh "ngang" → xoay 90° cho vân chạy dọc theo nó
    tex.rotation = Math.PI / 2;
    tex.repeat.set(along / GRAIN_TILE, across / GRAIN_CROSS);
  }
  tex.offset.set(hash01(id + 'u'), hash01(id + 'v'));
  tex.needsUpdate = true;
  return tex;
}

/** Vẽ 1 Part: hộp đặc, hoặc tấm có lỗ khoét (khi part.holes có giá trị). */
export function PartMesh({ part }: { part: Part }) {
  const m = resolveMaterial(part.material);
  const hasHoles = !!part.holes && part.holes.length > 0;

  // Tấm có lỗ → ExtrudeGeometry từ Shape chữ nhật + lỗ tròn (boxGeometry không khoét được).
  const holeGeometry = useMemo(() => {
    if (!hasHoles) return null;
    const [sx, sy, sz] = part.size;
    const shape = new Shape();
    shape.moveTo(-sx / 2, -sy / 2);
    shape.lineTo(sx / 2, -sy / 2);
    shape.lineTo(sx / 2, sy / 2);
    shape.lineTo(-sx / 2, sy / 2);
    shape.closePath();
    for (const hole of part.holes!) {
      const path = new Path();
      path.absarc(hole.dx, hole.dy, hole.r, 0, Math.PI * 2, true);
      shape.holes.push(path);
    }
    // UV mặc định của ExtrudeGeometry tính theo TOẠ ĐỘ THẬT (mm) → vân veneer tile loạn,
    // gần như mất hẳn trên cánh / mặt ngăn kéo. Tự sinh UV 0→1 cho mặt trước & sau (như
    // boxGeometry) → makePartGrain đặt `repeat` đúng → vân hiện chuẩn.
    const uvGen = {
      generateTopUV(_g: ExtrudeGeometry, verts: number[], a: number, b: number, c: number) {
        const at = (i: number) =>
          new Vector2((verts[i * 3] + sx / 2) / sx, (verts[i * 3 + 1] + sy / 2) / sy);
        return [at(a), at(b), at(c)];
      },
      generateSideWallUV() {
        return [new Vector2(0, 0), new Vector2(0, 1), new Vector2(1, 1), new Vector2(1, 0)];
      },
    };
    const geo = new ExtrudeGeometry(shape, { depth: sz, bevelEnabled: false, UVGenerator: uvGen });
    geo.translate(0, 0, -sz / 2); // ép khối chạy 0→sz → dời để căn tâm như boxGeometry
    return geo;
  }, [part, hasHoles]);

  // Giải phóng GPU buffer khi geometry đổi / mesh bị gỡ.
  useEffect(() => () => holeGeometry?.dispose(), [holeGeometry]);

  // Veneer (m.grain) → texture vân gỗ RIÊNG mỗi ván: vân dọc cạnh dài, mật độ thật (không
  // co giãn), lệch nhẹ theo id. map lỗi vẫn còn đúng màu gỗ (không ra trắng).
  const grainMap = useMemo(
    () => (m.grain ? makePartGrain(part.size, part.id) : null),
    [m.grain, part.id, part.size],
  );
  // key=part.material → ĐỔI VẬT LIỆU thì REMOUNT material (tạo MeshStandardMaterial mới).
  // BẮT BUỘC: three.js KHÔNG tự biên dịch lại shader khi `map` đổi null↔texture trên material
  // cũ → veneer mất hẳn vân gỗ nếu material bị tái dùng. Material mới = compile lại có USE_MAP.

  // S5 polish: vật liệu 2-tone (m.edgeHex) — mặt phẳng dùng hex, cạnh dùng edgeHex.
  // BoxGeometry có 6 materials [+X, -X, +Y, -Y, +Z, -Z]. Trục có size nhỏ nhất =
  // trục thickness → mặt vuông góc trục đó là FACE; 4 mặt còn lại là EDGE.
  // ExtrudeGeometry (part có lỗ) có 2 groups [caps, sideWalls] → material array
  // 2 phần: [face, edge].
  const has2Tone = !!m.edgeHex;

  const baseProps = {
    metalness: m.metalness ?? 0,
    roughness: m.roughness ?? 0.6,
    transparent: m.transparent ?? false,
    opacity: m.opacity ?? 1,
  } as const;

  if (holeGeometry) {
    // ExtrudeGeometry: 2 groups (caps = front/back face, sideWalls = 4 cạnh).
    if (has2Tone) {
      return (
        <mesh position={part.position} geometry={holeGeometry} castShadow receiveShadow>
          <meshStandardMaterial
            key={`${part.material}-face`}
            attach="material-0"
            color={m.hex}
            map={grainMap}
            {...baseProps}
          />
          <meshStandardMaterial
            key={`${part.material}-edge`}
            attach="material-1"
            color={m.edgeHex}
            {...baseProps}
          />
        </mesh>
      );
    }
    return (
      <mesh position={part.position} geometry={holeGeometry} castShadow receiveShadow>
        <meshStandardMaterial
          key={part.material}
          color={m.hex}
          map={grainMap}
          {...baseProps}
        />
      </mesh>
    );
  }

  // BoxGeometry: 6 materials theo trục X/Y/Z, 2 mặt mỗi trục.
  if (has2Tone) {
    const sizes = part.size;
    const minDim = Math.min(...sizes);
    const isFaceAxis = (axisIdx: number) => sizes[axisIdx] === minDim;
    // Index ↔ trục: 0,1 = ±X · 2,3 = ±Y · 4,5 = ±Z
    const isFaceByIdx = (idx: number) => isFaceAxis(Math.floor(idx / 2));
    return (
      <mesh position={part.position} castShadow receiveShadow>
        <boxGeometry args={part.size} />
        {[0, 1, 2, 3, 4, 5].map((idx) => (
          <meshStandardMaterial
            key={`${part.material}-${idx}`}
            attach={`material-${idx}`}
            color={isFaceByIdx(idx) ? m.hex : m.edgeHex}
            map={isFaceByIdx(idx) ? grainMap : null}
            {...baseProps}
          />
        ))}
      </mesh>
    );
  }
  return (
    <mesh position={part.position} castShadow receiveShadow>
      <boxGeometry args={part.size} />
      <meshStandardMaterial
        key={part.material}
        color={m.hex}
        map={grainMap}
        {...baseProps}
      />
    </mesh>
  );
}

/** Vẽ 1 phụ kiện 3D không phải tấm cắt — hiện chỉ có chân tủ (trụ tròn thấp, sẫm màu). */
export function FittingMesh({ fitting }: { fitting: Fitting }) {
  const r = fitting.size[0] / 2; // foot: size = [đường kính, cao, đường kính]
  const h = fitting.size[1];
  return (
    <mesh position={fitting.position} castShadow receiveShadow>
      <cylinderGeometry args={[r, r, h, 20]} />
      <meshStandardMaterial color="#2b2b2b" metalness={0.25} roughness={0.55} />
    </mesh>
  );
}

/** Ánh sáng 3 điểm — cường độ/vị trí lấy từ tylko-demo. */
export function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.2} />
      <hemisphereLight color="#ffffff" groundColor="#c9b89a" intensity={0.6} />
      <directionalLight
        position={[2500, 4500, 3500]}
        intensity={1.6}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-normalBias={4}
        shadow-camera-left={-3500}
        shadow-camera-right={3500}
        shadow-camera-top={3500}
        shadow-camera-bottom={-1000}
        shadow-camera-near={1000}
        shadow-camera-far={12000}
      />
      <directionalLight position={[-3500, 2000, 1500]} intensity={0.5} />
    </>
  );
}

/** Sàn nhận bóng đổ (mặt phẳng nằm ngang ở y = 0). */
export function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[20000, 20000]} />
      <meshStandardMaterial color="#e8e8e8" roughness={0.9} />
    </mesh>
  );
}

/** Tường phẳng đứng SÁT mặt hậu tủ — nền cho khung cảnh 3D. */
export function Wall({ parts }: { parts: Part[] }) {
  let backZ = -200;
  for (const p of parts) backZ = Math.min(backZ, p.position[2] - p.size[2] / 2);
  return (
    <mesh position={[0, 4000, backZ - 1]} receiveShadow>
      <planeGeometry args={[20000, 8000]} />
      <meshStandardMaterial color="#dcd7cf" roughness={0.95} />
    </mesh>
  );
}

/** Nhãn số kích thước — div HTML luôn quay về camera; CHỈ ghi con số. */
function DimLabel({ position, mm }: { position: [number, number, number]; mm: number }) {
  return (
    <Html position={position} center>
      <div className="pointer-events-none select-none whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold text-neutral-700 shadow-sm">
        {Math.round(mm)} <span className="font-normal text-neutral-400">mm</span>
      </div>
    </Html>
  );
}

/** Màu chung của đường + chấm kích thước. */
const DIM_COL = '#6b6b6b';

/** Chấm tròn ĐẶC đánh dấu 1 đầu mút đường kích thước (KHÔNG chĩa ra ngoài). */
function DimDot({ at }: { at: [number, number, number] }) {
  return (
    <mesh position={at}>
      <sphereGeometry args={[13, 14, 10]} />
      <meshBasicMaterial color={DIM_COL} />
    </mesh>
  );
}

/**
 * Đường kích thước TỔNG (rộng × cao × sâu) — đường đo MẢNH + chấm tròn 2 ĐẦU MÚT
 * + nhãn CHỈ ghi số. KHÔNG mũi tên / đầu chĩa ra. Rộng & sâu nằm SÁT SÀN (kiểu mặt
 * bằng) cho gọn — không lửng lơ giữa không trung; cao là đường dọc mép trước-trái.
 */
export function Dimensions({ parts }: { parts: Part[] }) {
  if (parts.length === 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of parts) {
    minX = Math.min(minX, p.position[0] - p.size[0] / 2);
    maxX = Math.max(maxX, p.position[0] + p.size[0] / 2);
    minY = Math.min(minY, p.position[1] - p.size[1] / 2);
    maxY = Math.max(maxY, p.position[1] + p.size[1] / 2);
    minZ = Math.min(minZ, p.position[2] - p.size[2] / 2);
    maxZ = Math.max(maxZ, p.position[2] + p.size[2] / 2);
  }
  const off = 140; // khoảng hở từ tủ tới đường kích thước
  const gy = minY + 4; // nhấc đường nằm khỏi sàn vài mm → tránh z-fighting với Ground
  const fz = maxZ + off; // đường "rộng" — nằm trên sàn, phía trước tủ
  const lx = minX - off; // đường "cao" — dọc theo mép trước-trái
  const rx = maxX + off; // đường "sâu" — nằm trên sàn, bên phải tủ
  return (
    <group>
      {/* RỘNG — đường nằm SÁT SÀN, trước tủ; chấm tròn 2 đầu */}
      <Line points={[[minX, gy, fz], [maxX, gy, fz]]} color={DIM_COL} lineWidth={1.5} />
      <DimDot at={[minX, gy, fz]} />
      <DimDot at={[maxX, gy, fz]} />
      <DimLabel position={[(minX + maxX) / 2, minY + 95, fz]} mm={maxX - minX} />
      {/* CAO — đường dọc theo mép trước-trái; chấm tròn 2 đầu */}
      <Line points={[[lx, minY, maxZ], [lx, maxY, maxZ]]} color={DIM_COL} lineWidth={1.5} />
      <DimDot at={[lx, minY, maxZ]} />
      <DimDot at={[lx, maxY, maxZ]} />
      <DimLabel position={[lx - 95, (minY + maxY) / 2, maxZ]} mm={maxY - minY} />
      {/* SÂU — đường nằm SÁT SÀN, bên phải tủ; chấm tròn 2 đầu */}
      <Line points={[[rx, gy, minZ], [rx, gy, maxZ]]} color={DIM_COL} lineWidth={1.5} />
      <DimDot at={[rx, gy, minZ]} />
      <DimDot at={[rx, gy, maxZ]} />
      <DimLabel position={[rx, minY + 95, (minZ + maxZ) / 2]} mm={maxZ - minZ} />
    </group>
  );
}
