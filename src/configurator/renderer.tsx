'use client';
// =============================================================
// RENDER 3D — Part[] → mesh Three.js.
// Ánh sáng 3 điểm lấy từ tylko-demo/index.html (dòng 457–471).
// =============================================================
import { useEffect, useMemo, useRef } from 'react';
import type {} from '@react-three/fiber'; // nạp kiểu JSX cho <mesh>, <light>...
import { Html, Line } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  CanvasTexture,
  ExtrudeGeometry,
  Path,
  PMREMGenerator,
  RepeatWrapping,
  Shape,
  SRGBColorSpace,
  Vector2,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
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

/** Info animate chung — Part hoặc Fitting đi kèm. */
export interface AnimInfo {
  kind: 'door' | 'drawer';
  /** Pivot trong world space — door: hinge edge; drawer: part.position. */
  pivotPos: [number, number, number];
  /** Vị trí mesh local (relative to pivot) — sao cho world = pivot + local khi rotation=0. */
  meshLocalPos: [number, number, number];
  /** Door: -1 = mở quay sang trái (hinge LEFT), +1 = mở quay sang phải (hinge RIGHT). */
  angleSign?: number;
}

/** Phân tích Part.id để biết nó có thuộc loại animate được (door/drawer mặt) +
 *  hinge side để pivot rotation. Trả null nếu Part không animate được.
 *  `fittings` truyền vào để lookup hinge side khi door dùng strip handle
 *  (part.holes undefined) — phải hỏi vị trí fitting để biết hướng. */
export function computePartAnimation(
  part: Part,
  fittings?: ReadonlyArray<Fitting>,
): {
  kind: 'door' | 'drawer';
  row: number;
  col: number;
  // door: hinge offset từ tâm Part (1 trong 2 cạnh dài hơn theo X)
  // drawer: slide direction (luôn +Z = ra phía trước)
  hingeOffsetX?: number;
  angleSign?: number;
} | null {
  // door-r{r}-c{c} | door-r{r}-c{c}-a | door-r{r}-c{c}-b
  const doorMatch = part.id.match(/^door-r(\d+)-c(\d+)(?:-([ab]))?$/);
  if (doorMatch) {
    const row = Number(doorMatch[1]);
    const col = Number(doorMatch[2]);
    const leaf = doorMatch[3]; // 'a' | 'b' | undefined
    const [sx] = part.size;
    let hingeOnLeft: boolean;
    if (leaf === 'a') hingeOnLeft = true;       // cánh trái double → hinge trái
    else if (leaf === 'b') hingeOnLeft = false; // cánh phải double → hinge phải
    else {
      // Single door: hinge phía ĐỐI với tay nắm. 2 cách tay nắm tồn tại:
      //   (1) Lỗ Ø35 trên cánh (part.holes) — dx > 0: tay nắm phải, < 0: trái
      //   (2) Strip handle (Fitting `hstrip-d-r{r}-c{c}-top`) — fitting.position.x
      //       so với door.position.x cho biết handle ở bên phải hay trái cánh.
      const handleDx = part.holes?.[0]?.dx;
      if (handleDx !== undefined) {
        hingeOnLeft = handleDx > 0; // dx > 0 (handle right) → hinge LEFT
      } else if (fittings) {
        const strip = fittings.find((f) => f.id === `hstrip-d-r${row}-c${col}-top`);
        if (strip) {
          // strip.position.x > door.position.x → handle bên phải → hinge LEFT
          hingeOnLeft = strip.position[0] > part.position[0];
        } else {
          hingeOnLeft = true; // fallback an toàn (default hinge LEFT)
        }
      } else {
        hingeOnLeft = true;
      }
    }
    return {
      kind: 'door',
      row, col,
      hingeOffsetX: hingeOnLeft ? -sx / 2 : sx / 2,
      angleSign: hingeOnLeft ? -1 : 1, // mở ra phía trước (Y rotation âm/dương)
    };
  }
  // Ngăn kéo: drawer-r{r}-c{c} (mặt trước) + drawerL/R/Bk/Bot-r{r}-c{c} (hông/hậu/đáy)
  // → tất cả 5 tấm cùng trượt Z+ để hộc kéo ra như thật.
  const drawerMatch = part.id.match(/^drawer(?:L|R|Bk|Bot)?-r(\d+)-c(\d+)$/);
  if (drawerMatch) {
    return {
      kind: 'drawer',
      row: Number(drawerMatch[1]),
      col: Number(drawerMatch[2]),
    };
  }
  return null;
}

/** Vẽ 1 Part: hộp đặc, hoặc tấm có lỗ khoét (khi part.holes có giá trị).
 *  openProgress 0→1: animate door rotate hoặc drawer slide ra. */
export function PartMesh({
  part,
  openProgress = 0,
  fittings,
  parentPivot,
}: {
  part: Part;
  openProgress?: number;
  /** Optional — pass build.fittings để hỗ trợ detect hinge của door dùng strip handle. */
  fittings?: ReadonlyArray<Fitting>;
  /** Khi set, mesh render INSIDE 1 outer group có pivot ở `parentPivot`. Bỏ qua
   *  group wrap + animation nội bộ — outer group (Assembly) lo animation. */
  parentPivot?: [number, number, number];
}) {
  const m = resolveMaterial(part.material);
  const hasHoles = !!part.holes && part.holes.length > 0;
  const anim = useMemo(() => computePartAnimation(part, fittings), [part, fittings]);
  const useExternalGroup = !!parentPivot;

  // Smooth animation: lerp current progress về target (openProgress prop) qua thời gian.
  // Apply transform qua group ref trực tiếp (không re-render React).
  // Bỏ qua khi useExternalGroup — outer Assembly animate chung.
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);
  useFrame((_, dt) => {
    if (useExternalGroup || !anim || !groupRef.current) return;
    const cur = progressRef.current;
    const speed = 8;
    const next = Math.abs(openProgress - cur) < 0.001
      ? openProgress
      : cur + (openProgress - cur) * Math.min(1, speed * dt);
    progressRef.current = next;
    if (anim.kind === 'door') {
      groupRef.current.rotation.y = (anim.angleSign ?? -1) * (Math.PI * 75 / 180) * next;
      groupRef.current.position.z = part.position[2]; // reset defensive
    } else if (anim.kind === 'drawer') {
      groupRef.current.rotation.y = 0; // reset defensive
      groupRef.current.position.z = part.position[2] + 250 * next;
    }
  });

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

  // v3.4.2 fix "mất mặt": Khi material đổi (vd mdf_son → MDF+AC cạnh đen) render
  // path CŨNG đổi (BoxGeometry ↔ ExtrudeGeometry, 1 mat ↔ 2 mat ↔ 6 mat). R3F
  // không reliable khi switch geometry+attach pattern trên cùng mesh (stale
  // material slots gây "mất mặt" panel). FORCE REMOUNT mesh khi path thay đổi
  // qua `key` đặc trưng theo (hasHoles, has2Tone, material).
  const meshKey = `${hasHoles ? 'ex' : 'bx'}-${has2Tone ? '2t' : '1t'}-${part.material}`;

  // Setup pivot cho anim: door wrap group ở hinge axis (mesh local lệch lại để bù),
  // drawer wrap group ở part.position (mesh local = origin). Non-anim → mesh ở part.position.
  // Khi useExternalGroup: outer group có pivot ở parentPivot, mesh local = world - parentPivot.
  let meshPos: [number, number, number] = part.position;
  let groupPivot: [number, number, number] | null = null;
  if (useExternalGroup) {
    meshPos = [
      part.position[0] - parentPivot![0],
      part.position[1] - parentPivot![1],
      part.position[2] - parentPivot![2],
    ];
  } else if (anim?.kind === 'door') {
    const hx = anim.hingeOffsetX ?? 0;
    groupPivot = [part.position[0] + hx, part.position[1], part.position[2]];
    meshPos = [-hx, 0, 0];
  } else if (anim?.kind === 'drawer') {
    groupPivot = part.position;
    meshPos = [0, 0, 0];
  }

  let meshEl: React.ReactElement;
  if (holeGeometry) {
    // ExtrudeGeometry: 2 groups (caps = front/back face, sideWalls = 4 cạnh).
    if (has2Tone) {
      meshEl = (
        <mesh key={meshKey} position={meshPos} geometry={holeGeometry} castShadow receiveShadow>
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
    } else {
      meshEl = (
        <mesh key={meshKey} position={meshPos} geometry={holeGeometry} castShadow receiveShadow>
          <meshStandardMaterial
            key={part.material}
            color={m.hex}
            map={grainMap}
            {...baseProps}
          />
        </mesh>
      );
    }
  } else if (has2Tone) {
    // BoxGeometry: 6 materials theo trục X/Y/Z, 2 mặt mỗi trục.
    const sizes = part.size;
    const minDim = Math.min(...sizes);
    const isFaceAxis = (axisIdx: number) => sizes[axisIdx] === minDim;
    const isFaceByIdx = (idx: number) => isFaceAxis(Math.floor(idx / 2));
    meshEl = (
      <mesh key={meshKey} position={meshPos} castShadow receiveShadow>
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
  } else {
    meshEl = (
      <mesh key={meshKey} position={meshPos} castShadow receiveShadow>
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

  if (groupPivot) {
    return (
      <group ref={groupRef} position={groupPivot}>
        {meshEl}
      </group>
    );
  }
  return meshEl;
}

/** Vẽ 1 phụ kiện 3D không phải tấm cắt — chân tủ + handle strip có animation
 *  open/close cùng cánh/ngăn kéo (nhận anim từ Configurator pre-compute). */
export function FittingMesh({
  fitting,
  parentPivot,
}: {
  fitting: Fitting;
  /** Khi set, mesh render INSIDE outer Assembly group (pivot ở parentPivot).
   *  Standalone (no parent): mesh ở fitting.position world. */
  parentPivot?: [number, number, number];
}) {
  const meshPos: [number, number, number] = parentPivot
    ? [
        fitting.position[0] - parentPivot[0],
        fitting.position[1] - parentPivot[1],
        fitting.position[2] - parentPivot[2],
      ]
    : fitting.position;
  let meshEl: React.ReactElement;
  if (fitting.kind === 'handle-strip') {
    const color = fitting.color ?? '#1a1a1a';
    meshEl = (
      <mesh position={meshPos} castShadow receiveShadow>
        <boxGeometry args={fitting.size} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.45} />
      </mesh>
    );
  } else {
    // 'foot': chân tủ Ø8 nút mỏng
    const r = fitting.size[0] / 2;
    const h = fitting.size[1];
    meshEl = (
      <mesh position={meshPos} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, h, 20]} />
        <meshStandardMaterial color="#2b2b2b" metalness={0.25} roughness={0.55} />
      </mesh>
    );
  }
  return meshEl;
}

/** Assembly = cụm cánh/ngăn kéo + tay nắm liên quan, animate trong 1 group duy nhất.
 *  Door pivot = hinge edge. Drawer pivot = part.position. Children share transform → tay
 *  nắm "dính" vào cánh, không thể desync. */
export interface AssemblyConfig {
  /** Pivot trong world space (group's position). */
  pivotPos: [number, number, number];
  kind: 'door' | 'drawer';
  /** Door: rotation direction. */
  angleSign?: number;
  /** Parts trong assembly (door panel, hoặc drawer 5 tấm). */
  parts: Part[];
  /** Fittings trong assembly (handle strips). */
  fittings: Fitting[];
}

export function AssemblyMesh({
  config,
  openProgress = 0,
  fittingsForHingeDetect,
}: {
  config: AssemblyConfig;
  openProgress?: number;
  /** Pass build.fittings để PartMesh detect hinge cho door strip handle (chỉ cần ở init). */
  fittingsForHingeDetect?: ReadonlyArray<Fitting>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);
  useFrame((_, dt) => {
    if (!groupRef.current) return;
    const cur = progressRef.current;
    const speed = 8;
    const next = Math.abs(openProgress - cur) < 0.001
      ? openProgress
      : cur + (openProgress - cur) * Math.min(1, speed * dt);
    progressRef.current = next;
    if (config.kind === 'door') {
      groupRef.current.rotation.y = (config.angleSign ?? -1) * (Math.PI * 75 / 180) * next;
      groupRef.current.position.z = config.pivotPos[2];
    } else {
      groupRef.current.rotation.y = 0;
      groupRef.current.position.z = config.pivotPos[2] + 250 * next;
    }
  });
  return (
    <group ref={groupRef} position={config.pivotPos}>
      {config.parts.map((part) => (
        <PartMesh
          key={part.id}
          part={part}
          parentPivot={config.pivotPos}
          fittings={fittingsForHingeDetect}
        />
      ))}
      {config.fittings.map((fitting) => (
        <FittingMesh key={fitting.id} fitting={fitting} parentPivot={config.pivotPos} />
      ))}
    </group>
  );
}

/**
 * IBL (image-based lighting) bằng `RoomEnvironment` built-in three.js — sinh
 * cubemap thủ tục (trần sáng + tường + panel) NGAY trong engine, convolve qua
 * `PMREMGenerator` → gán vào `scene.environment`. KHÔNG fetch HDR, footprint
 * VRAM nhỏ, tránh được bug drei `<Environment>` + React 19 / Turbopack.
 * `intensity` = `scene.environmentIntensity` (núm vặn 0.3–1.0).
 */
function SceneIBL({ intensity = 0.5 }: { intensity?: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = intensity;
    return () => {
      envTex.dispose();
      pmrem.dispose();
      scene.environment = null;
    };
  }, [gl, scene, intensity]);
  return null;
}

/**
 * Ánh sáng kiểu TRONG NHÀ — dịu, ít tương phản, bóng đổ mềm (không gắt như nắng
 * trưa). Cường độ cân cho toneMapping Neutral: mặt ngoài tủ ≈ đúng màu thật,
 * lòng hộc tủ vẫn đủ sáng để phân biệt ô có cánh / không cánh.
 *
 * Chiến lược chống flat (founder feedback 2026-05-23): dùng IBL (image-based
 * lighting) qua `<SceneIBL>` (RoomEnvironment in-engine) làm "khung cảnh phản
 * chiếu" → mọi `MeshStandardMaterial` tự sinh highlight tương ứng `roughness` →
 * tủ ĐEN cũng có vùng sáng phản xạ Fresnel ~4% → tách rõ mặt sáng / mặt tối,
 * không còn cảm giác bệt. IBL gánh cả vai trò "ambient via reflection" → đèn
 * nền (ambient/hemisphere) hạ XUỐNG để không cộng dồn → grey tủ giữ đúng màu.
 * Đèn directional vẫn tạo khối + bóng đổ mềm; ambient/hemi nhẹ chỉ chống đen-xì
 * lòng hộc khi IBL bị occlusion.
 */
export function SceneLighting() {
  return (
    <>
      {/* IBL từ RoomEnvironment (built-in three.js, thủ tục, in-engine) → mọi
          MeshStandardMaterial bắt phản xạ studio nhẹ → tủ ĐEN có Fresnel ~4%
          → tách sáng/tối. Tránh drei <Environment> (bug context-lost React 19 +
          Turbopack). intensity 0.55: cân từ 1.0 (đen có contrast nhưng trắng
          loá) → 0.75 (trắng vẫn wash) → 0.55 (trắng ≈ thật, đen vẫn giữ phần
          lớn highlight Fresnel). */}
      <SceneIBL intensity={0.55} />
      {/* IBL gánh phần "ambient via reflection" → ambient/hemi hạ MẠNH (1.6→0.6,
          1.2→0.6) để không cộng dồn → grey không bị wash. */}
      <ambientLight intensity={0.6} />
      <hemisphereLight color="#ffffff" groundColor="#c9b89a" intensity={0.6} />
      {/* Đèn chính 1.1 (hạ tiếp từ 1.3) — giảm contribution trên mặt hứng key
          để màu sáng không loá. Bóng đổ giữ rõ (radius 3, intensity 0.95). */}
      <directionalLight
        position={[2500, 4500, 3500]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-normalBias={4}
        shadow-radius={3}
        shadow-intensity={0.95}
        shadow-camera-left={-3500}
        shadow-camera-right={3500}
        shadow-camera-top={3500}
        shadow-camera-bottom={-1000}
        shadow-camera-near={1000}
        shadow-camera-far={12000}
      />
      {/* Đèn phụ (fill) góc thấp đối diện — kéo mặt đứng (mặt trước/cạnh hông)
          lên đúng màu thật mà gần như không chạm mặt phẳng ngang trong hộc. */}
      <directionalLight position={[-3500, 2000, 1500]} intensity={0.62} />
    </>
  );
}

/** Sàn nhận bóng đổ (mặt phẳng nằm ngang ở y = 0).
 *  - `variant='default'`: meshStandardMaterial xám nhận shadow + lighting (interactive scene).
 *  - `variant='studio'`: shadowMaterial VÔ HÌNH chỉ nhận shadow → background trắng
 *    visible through sàn → sàn TRẮNG TINH seamless, bóng xuất hiện như vệt mờ.
 *    Trade-off: dùng ShadowMaterial chứ KHÔNG meshStandardMaterial vì standard
 *    material nhận ambient lighting → kéo màu trắng xuống xám nhạt khó tránh.
 */
export function Ground({ variant = 'default' }: { variant?: 'default' | 'studio' }) {
  if (variant === 'studio') {
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20000, 20000]} />
        <shadowMaterial transparent opacity={0.25} color="#000000" />
      </mesh>
    );
  }
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
