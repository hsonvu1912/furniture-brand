'use client';
// =============================================================
// RENDER 3D — Part[] → mesh Three.js.
// Ánh sáng 3 điểm lấy từ tylko-demo/index.html (dòng 457–471).
// =============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import type {} from '@react-three/fiber'; // nạp kiểu JSX cho <mesh>, <light>...
import { Html, Line } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  BufferGeometry,
  CanvasTexture,
  ClampToEdgeWrapping,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Path,
  PMREMGenerator,
  RepeatWrapping,
  Shape,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
// P24: postprocessing chỉ dùng cho THUMBNAIL (screenshot mode) — GTAO (ambient
// occlusion ground-truth) đổ bóng mềm vào góc/khe/lòng hộc → render có chiều sâu.
// three 0.184 có sẵn các pass này trong examples/jsm → KHÔNG cần thêm npm.
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
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

// =============================================================
// P51 — TEXTURE ẢNH THẬT (map vân gỗ Minh Long chụp nguyên tấm 1220×2745mm).
// Cache 1 Texture gốc/url (nạp 1 lần qua TextureLoader); mỗi ván CLONE ra bản riêng để
// đặt repeat/offset/rotation — clone chia sẻ `.source` nên KHÔNG upload lại GPU.
// =============================================================
const imgTexCache = new Map<string, Texture>();
const imgTexWaiters = new Map<string, Set<() => void>>();

/** Lấy Texture ảnh theo url (cache). onReady gọi khi ảnh load xong (để component re-render). */
function getImageTexture(url: string, onReady: () => void): Texture {
  const cached = imgTexCache.get(url);
  if (cached) {
    if (!cached.image) {
      let set = imgTexWaiters.get(url);
      if (!set) imgTexWaiters.set(url, (set = new Set()));
      set.add(onReady);
    }
    return cached;
  }
  const tex = new TextureLoader().load(url, () => {
    const set = imgTexWaiters.get(url);
    if (set) { set.forEach((cb) => cb()); set.clear(); }
  });
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
  imgTexCache.set(url, tex);
  let set = imgTexWaiters.get(url);
  if (!set) imgTexWaiters.set(url, (set = new Set()));
  set.add(onReady);
  return tex;
}

/** BoxGeometry — với mỗi trục VUÔNG GÓC `perpAxis` của 1 cặp mặt, (U,V) của mặt ánh xạ ra 2
 *  trục world nào. three.js: mặt ⟂X → U dọc Z, V dọc Y · ⟂Y → U dọc X, V dọc Z · ⟂Z → U dọc
 *  X, V dọc Y. Nhờ bảng này tính `repeat` đúng cho TỪNG mặt (kể cả 4 mặt cạnh), không méo. */
const UV_AXES: ReadonlyArray<readonly [number, number]> = [
  [2, 1], // mặt ⟂ X (2 đầu hông): U dọc Z (sâu), V dọc Y (cao)
  [0, 2], // mặt ⟂ Y (trên/dưới): U dọc X (rộng), V dọc Z (sâu)
  [0, 1], // mặt ⟂ Z (trước/sau): U dọc X (rộng), V dọc Y (cao)
];

/**
 * P55 — Texture ảnh cho CẶP MẶT vuông góc trục `perpAxis` của 1 ván. `repeat` tính theo ĐÚNG
 * kích thước THẬT của riêng mặt đó (không dùng chung tỷ lệ của mặt lớn) ⇒ MỌI mặt — kể cả dải
 * cạnh dày 18mm — giữ đúng tỷ lệ vân, HẾT kéo dãn. Vân (trục V dài 2745 của ảnh) chạy dọc cạnh
 * DÀI hơn của mặt. offset đối xứng quanh tâm + biên (1-repeat)/2 → vùng cắt luôn nằm trong ảnh.
 */
function makeAxisImageTexture(
  base: Texture,
  size: [number, number, number],
  id: string,
  perpAxis: number,
  mapWmm: number,
  mapHmm: number,
): Texture {
  const tex = base.clone();
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
  tex.center.set(0.5, 0.5);
  tex.needsUpdate = true;
  const [uAxis, vAxis] = UV_AXES[perpAxis];
  const uMm = size[uAxis];
  const vMm = size[vAxis];
  // ru = repeat.x, rv = repeat.y. QUAN TRỌNG: three.js (Matrix3.setUvTransform) áp `repeat`
  // trong hệ UV GỐC rồi MỚI xoay. Nên khi rotation=90°, repeat.x điều khiển trục V của mặt,
  // repeat.y điều khiển trục U → phải gán ĐẢO so với trực giác, nếu không mặt bị méo dị hướng.
  let ru: number, rv: number;
  if (vMm >= uMm) {
    // mặt cao hơn rộng → vân (trục V ảnh) đã chạy dọc V → không xoay. repeat thẳng: x↔U, y↔V.
    tex.rotation = 0;
    ru = uMm / mapWmm;
    rv = vMm / mapHmm;
  } else {
    // mặt rộng hơn cao → xoay 90° cho vân chạy dọc U (cạnh dài). Sau xoay: repeat.x↔V, repeat.y↔U
    // ⇒ repeat.x = sâu/khổ-ngang, repeat.y = rộng/khổ-dọc → tỷ lệ 1:1 ĐỀU cả 2 trục (hết méo).
    tex.rotation = Math.PI / 2;
    ru = vMm / mapWmm;
    rv = uMm / mapHmm;
  }
  ru = Math.min(ru, 1); // phòng xa: mặt vượt khổ tấm → fill kín, không kéo dãn
  rv = Math.min(rv, 1);
  tex.repeat.set(ru, rv);
  // offset ∈ [-(1-r)/2, (1-r)/2] (đối xứng quanh center 0.5) → coords luôn trong [0,1].
  const k = id + perpAxis;
  tex.offset.set((hash01(k + 'u') - 0.5) * (1 - ru), (hash01(k + 'v') - 0.5) * (1 - rv));
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
  // P3 v2: regex bắt thêm sub-cell suffix `-L|-R|-B|-T` (sub-cell trong cell
  // đã split). Cả primitive cells lẫn sub-cells đều cần animation mở.
  // Patterns:
  //   door-r{r}-c{c}              — primitive single
  //   door-r{r}-c{c}-a            — primitive double leaf A
  //   door-r{r}-c{c}-b            — primitive double leaf B
  //   door-r{r}-c{c}-L            — sub V left
  //   door-r{r}-c{c}-R            — sub V right
  //   door-r{r}-c{c}-B/-T         — sub H bottom/top
  //   door-r{r}-c{c}-L-a/-b       — sub L với cánh đôi (edge case unlikely)
  const doorMatch = part.id.match(/^door-r(\d+)-c(\d+)(?:-([LRBT]))?(?:-([ab]))?$/);
  if (doorMatch) {
    const row = Number(doorMatch[1]);
    const col = Number(doorMatch[2]);
    const subStr = doorMatch[3]; // 'L'|'R'|'B'|'T' | undefined
    const leaf = doorMatch[4]; // 'a' | 'b' | undefined
    const subSuffix = subStr ? `-${subStr}` : '';
    const [sx] = part.size;
    let hingeOnLeft: boolean;
    // P45: engine set hingeOnLeft TƯỜNG MINH (ưu tiên) — cần cho tay nắm bar căn
    // giữa (không suy được hướng từ lỗ). Vắng → heuristic cũ (holes / strip fitting).
    if (part.hingeOnLeft !== undefined) hingeOnLeft = part.hingeOnLeft;
    else if (leaf === 'a') hingeOnLeft = true;       // cánh trái double → hinge trái
    else if (leaf === 'b') hingeOnLeft = false; // cánh phải double → hinge phải
    else {
      // Single door (primitive hoặc sub-cell): hinge phía ĐỐI với tay nắm.
      //   (1) Lỗ Ø35 trên cánh (part.holes) — dx > 0: tay nắm phải, < 0: trái
      //   (2) Strip handle (Fitting `hstrip-d-r{r}-c{c}{subSuffix}-top`)
      const handleDx = part.holes?.[0]?.dx;
      if (handleDx !== undefined) {
        hingeOnLeft = handleDx > 0;
      } else if (fittings) {
        const strip = fittings.find(
          (f) => f.id === `hstrip-d-r${row}-c${col}${subSuffix}-top`,
        );
        if (strip) {
          hingeOnLeft = strip.position[0] > part.position[0];
        } else {
          hingeOnLeft = true;
        }
      } else {
        hingeOnLeft = true;
      }
    }
    return {
      kind: 'door',
      row, col,
      hingeOffsetX: hingeOnLeft ? -sx / 2 : sx / 2,
      angleSign: hingeOnLeft ? -1 : 1,
    };
  }
  // Ngăn kéo: drawer-r{r}-c{c} (mặt trước) + drawerL/R/Bk/Bot-r{r}-c{c} (hông/hậu/đáy)
  // → tất cả 5 tấm cùng trượt Z+ để hộc kéo ra như thật.
  // P3 v2: thêm sub-cell suffix `-L|-R|-B|-T` ở cuối cho sub-cell drawer.
  const drawerMatch = part.id.match(/^drawer(?:L|R|Bk|Bot)?-r(\d+)-c(\d+)(?:-[LRBT])?$/);
  if (drawerMatch) {
    return {
      kind: 'drawer',
      row: Number(drawerMatch[1]),
      col: Number(drawerMatch[2]),
    };
  }
  return null;
}

// Record mode (clip): override màu TOÀN BỘ thân kệ theo từng frame để "quét màu"
// mượt (engine vốn chọn vật liệu theo enum → nhảy bậc). Module-level: PartMesh đọc
// trực tiếp; Configurator set qua setRecordTint() trong __keApplyFrame trước mỗi re-render.
// null = tắt (render bình thường). Giữ grain procedural → vẫn có vân gỗ khi đổi hex.
let _recordTint: { hex: string; roughness?: number; metalness?: number } | null = null;
export function setRecordTint(t: { hex: string; roughness?: number; metalness?: number } | null) {
  _recordTint = t;
}

/** P83: HỘP VÁT GÓC 45° PHẲNG — 6 mặt GIỮ NGUYÊN mặt phẳng ngoài (flush, KHÔNG thụt
 *  vào như ExtrudeGeometry bevel), chỉ cắt 1 facet 45° ở 12 cạnh + 8 góc. 2 group:
 *  0 = 2 mặt chính (⟂ faceAxis) — UV [0,1] cho vân gỗ; 1 = mặt cạnh + facet vát (màu
 *  đặc). Tự dựng vì three không có hộp vát-phẳng giữ-UV-mặt. Verts không chia sẻ →
 *  computeVertexNormals ra flat shading (facet vát sắc nét). Winding tự sửa outward. */
function chamferedBoxGeometry(size: readonly [number, number, number], c: number, faceAxis: number): BufferGeometry {
  const half = [size[0] / 2, size[1] / 2, size[2] / 2];
  const facePos: number[] = [], faceUV: number[] = [];
  const edgePos: number[] = [], edgeUV: number[] = [];
  const sub = (p: number[], q: number[]) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
  const cross = (u: number[], v: number[]) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const dot = (u: number[], v: number[]) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const V = (a: number, av: number, b: number, bv: number, cc: number, cv: number) => {
    const p = [0, 0, 0]; p[a] = av; p[b] = bv; p[cc] = cv; return p;
  };
  const addTri = (pos: number[], uvArr: number[], p: number[], q0: number[], r0: number[], up?: number[], uq0?: number[], ur0?: number[]) => {
    let q = q0, r = r0, uq = uq0, ur = ur0;
    const n = cross(sub(q, p), sub(r, p));
    const ctr = [(p[0] + q[0] + r[0]) / 3, (p[1] + q[1] + r[1]) / 3, (p[2] + q[2] + r[2]) / 3];
    if (dot(n, ctr) < 0) { const t = q; q = r; r = t; const tu = uq; uq = ur; ur = tu; } // ép outward
    pos.push(p[0], p[1], p[2], q[0], q[1], q[2], r[0], r[1], r[2]);
    if (up && uq && ur) uvArr.push(up[0], up[1], uq[0], uq[1], ur[0], ur[1]);
    else uvArr.push(0, 0, 0, 0, 0, 0);
  };
  const addQuad = (pos: number[], uvArr: number[], a: number[], b: number[], d: number[], e: number[], ua?: number[], ub?: number[], ud?: number[], ue?: number[]) => {
    addTri(pos, uvArr, a, b, d, ua, ub, ud); addTri(pos, uvArr, a, d, e, ua, ud, ue);
  };
  // 6 mặt (thụt c trong-mặt-phẳng, GIỮ NGUYÊN toạ độ trục pháp tuyến → flush)
  for (let a = 0; a < 3; a++) {
    const b = (a + 1) % 3, cc = (a + 2) % 3;
    const large = a === faceAxis;
    const pos = large ? facePos : edgePos, uvArr = large ? faceUV : edgeUV;
    for (const s of [1, -1]) {
      const av = s * half[a], bm = half[b] - c, cm = half[cc] - c;
      const k = [V(a, av, b, -bm, cc, -cm), V(a, av, b, bm, cc, -cm), V(a, av, b, bm, cc, cm), V(a, av, b, -bm, cc, cm)];
      if (large) {
        const uv = (p: number[]) => [(p[b] + half[b]) / (2 * half[b]), (p[cc] + half[cc]) / (2 * half[cc])];
        addQuad(pos, uvArr, k[0], k[1], k[2], k[3], uv(k[0]), uv(k[1]), uv(k[2]), uv(k[3]));
      } else addQuad(pos, uvArr, k[0], k[1], k[2], k[3]);
    }
  }
  // 12 cạnh: facet 45° nối mép-thụt mặt-a với mép-thụt mặt-b
  for (let e = 0; e < 3; e++) {
    const a = (e + 1) % 3, b = (e + 2) % 3, em = half[e] - c;
    for (const sa of [1, -1]) for (const sb of [1, -1]) {
      const fa1 = V(a, sa * half[a], b, sb * (half[b] - c), e, -em);
      const fa2 = V(a, sa * half[a], b, sb * (half[b] - c), e, em);
      const fb1 = V(a, sa * (half[a] - c), b, sb * half[b], e, -em);
      const fb2 = V(a, sa * (half[a] - c), b, sb * half[b], e, em);
      addQuad(edgePos, edgeUV, fa1, fa2, fb2, fb1);
    }
  }
  // 8 góc: tam giác nối 3 mép mặt
  for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) {
    addTri(edgePos, edgeUV,
      [sx * half[0], sy * (half[1] - c), sz * (half[2] - c)],
      [sx * (half[0] - c), sy * half[1], sz * (half[2] - c)],
      [sx * (half[0] - c), sy * (half[1] - c), sz * half[2]]);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(facePos.concat(edgePos), 3));
  geo.setAttribute('uv', new Float32BufferAttribute(faceUV.concat(edgeUV), 2));
  geo.addGroup(0, facePos.length / 3, 0); // mặt chính = vân
  geo.addGroup(facePos.length / 3, edgePos.length / 3, 1); // cạnh + facet = màu đặc
  geo.computeVertexNormals();
  return geo;
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
  const _rawM = resolveMaterial(part.material);
  // Record: ép màu thân kệ về tint hiện tại (bỏ ảnh texture + cạnh 2-tone để màu THUẦN,
  // giữ grain procedural cho có vân) → cả kệ "quét" 1 màu mượt theo frame.
  const m = _recordTint
    ? { ..._rawM, hex: _recordTint.hex, roughness: _recordTint.roughness ?? _rawM.roughness, metalness: _recordTint.metalness ?? 0, textureUrl: undefined, edgeHex: undefined, grain: true }
    : _rawM;
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

  // P83: VÁT GÓC 45° PHẲNG (tủ y) — hộp tự dựng: 6 mặt GIỮ NGUYÊN mặt phẳng ngoài
  // (flush — KHÔNG thụt như ExtrudeGeometry bevel), chỉ cắt facet 45° ở cạnh + góc.
  // Mặt chính (⟂ trục mỏng) giữ UV [0,1] → vân gỗ map đúng. Hộp vẫn đúng [w,h,d].
  const chamferGeometry = useMemo(() => {
    const c = part.chamfer_mm;
    if (!c || hasHoles) return null;
    const faceAxis = part.size.indexOf(Math.min(...part.size)); // trục mỏng = 2 mặt chính
    const cc = Math.min(c, Math.min(...part.size) / 2 - 0.5);
    if (cc <= 0) return null;
    return chamferedBoxGeometry(part.size, cc, faceAxis);
  }, [part, hasHoles]);

  // Hình học "đặc thù" (khoét lỗ HOẶC vát góc) → đi chung nhánh ExtrudeGeometry 2-material.
  const customGeo = holeGeometry ?? chamferGeometry;

  // Giải phóng GPU buffer khi geometry đổi / mesh bị gỡ.
  useEffect(() => () => {
    holeGeometry?.dispose();
    chamferGeometry?.dispose();
  }, [holeGeometry, chamferGeometry]);

  // P51: material có ẢNH texture (vân gỗ Minh Long) → ưu tiên ảnh thật, map đúng tỷ lệ.
  // Ảnh load async → khi chưa xong tạm dùng grain procedural (placeholder), load xong
  // setTexReady → re-render → đổi sang ảnh. Veneer (m.grain) không có ảnh → grain procedural.
  const [, setTexReady] = useState(0);
  const imgTex = m.textureUrl ? getImageTexture(m.textureUrl, () => setTexReady((n) => n + 1)) : null;
  const imgLoaded = !!(m.textureUrl && imgTex?.image);
  // Trục mỏng nhất = trục thickness → cặp mặt ⟂ nó là MẶT CHÍNH; 2 trục kia là cạnh.
  const faceAxisIdx = part.size.indexOf(Math.min(...part.size));
  // P55: map RIÊNG cho từng cặp mặt (3 trục) — mỗi mặt đúng tỷ lệ thật → cạnh 18mm hết kéo
  // dãn. Ảnh thật: dựng cả 3 (cạnh đồng-màu cũng phủ vân đúng tỷ lệ). Veneer (grain
  // procedural, không ảnh): chỉ phủ mặt chính, cạnh để màu đặc (như cũ).
  const axisMaps = useMemo(() => {
    const maps: (Texture | null)[] = [null, null, null];
    if (imgLoaded && imgTex) {
      const mw = m.mapWidthMm ?? 1220;
      const mh = m.mapHeightMm ?? 2745;
      for (let a = 0; a < 3; a++) maps[a] = makeAxisImageTexture(imgTex, part.size, part.id, a, mw, mh);
    } else if (m.grain) {
      maps[faceAxisIdx] = makePartGrain(part.size, part.id);
    }
    return maps;
  }, [m.grain, imgLoaded, imgTex, part.id, part.size, m.mapWidthMm, m.mapHeightMm, faceAxisIdx]);
  const faceMap = axisMaps[faceAxisIdx]; // map của 2 mặt chính (cho nhánh extrude + 1-material)
  // Ảnh texture ĐÃ có màu thật → mặt phải TRẮNG (map × white = đúng màu). Grain procedural
  // là mặt nạ xám/nền trắng → mặt = m.hex (map × màu gỗ). map lỗi vẫn còn đúng màu (không ra trắng).
  const faceColor = imgLoaded ? '#ffffff' : m.hex;
  // key=part.material → ĐỔI VẬT LIỆU thì REMOUNT material (tạo MeshStandardMaterial mới).
  // BẮT BUỘC: three.js KHÔNG tự biên dịch lại shader khi `map` đổi null↔texture trên material
  // cũ → veneer mất hẳn vân gỗ nếu material bị tái dùng. Material mới = compile lại có USE_MAP.

  // S5 polish + P49: vật liệu 2-tone — mặt phẳng dùng hex, cạnh dùng edgeHex.
  // BoxGeometry có 6 materials [+X, -X, +Y, -Y, +Z, -Z]. Trục có size nhỏ nhất =
  // trục thickness → mặt vuông góc trục đó là FACE; 4 mặt còn lại là EDGE.
  // ExtrudeGeometry (part có lỗ) có 2 groups [caps, sideWalls] → material array
  // 2 phần: [face, edge].
  //
  // P49 — màu cạnh ĐI THEO Part (option dán cạnh tách khỏi vật liệu):
  //   • part.edgeHex set (đen '#000000' / trắng '#FFFFFF') → dùng trực tiếp.
  //   • part.edgeColor==='same' (dán cạnh đồng màu) → undefined ⇒ 1-tone (cạnh = mặt).
  //   • còn lại (plywood lộ cạnh, edgeColor vắng) → material.edgeHex ⇒ 2-tone cạnh raw.
  const edgeHex = part.edgeHex ?? (part.edgeColor === 'same' ? undefined : m.edgeHex);
  const has2Tone = !!edgeHex;
  // P51 fix — vật liệu có ẢNH texture LUÔN render qua nhánh mảng nhiều-material (giống
  // đen/trắng), KHÔNG dùng nhánh 1-material (three.js render 1-material trên BoxGeometry
  // nhiều-group ra TỐI hơn mảng material → cạnh đồng-màu trước đây bị tối). Cạnh đồng-màu
  // (không edgeHex) vẫn phủ map (đúng "đồng màu = vân"); đen/trắng → cạnh màu đặc.
  const textured = !!(m.textureUrl && imgLoaded);
  const useMulti = has2Tone || textured; // dùng nhánh mảng material (face/edge riêng)
  const edgeUsesMap = textured && !has2Tone; // cạnh đồng-màu + textured → map cả cạnh
  const edgeFaceColor = has2Tone ? edgeHex : faceColor; // đen/trắng/plywood = edgeHex; same = faceColor

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
  const meshKey = `${customGeo ? 'ex' : 'bx'}-${useMulti ? 'mt' : 'st'}-${part.material}-${part.edgeColor ?? 'raw'}-${imgLoaded ? 'img' : 'pre'}`;

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
  if (customGeo) {
    // ExtrudeGeometry: 2 groups (caps = 2 mặt chính, sideWalls = cạnh + mặt vát).
    if (useMulti) {
      meshEl = (
        <mesh key={meshKey} position={meshPos} geometry={customGeo} castShadow receiveShadow>
          <meshStandardMaterial
            key={`${part.material}-face`}
            attach="material-0"
            color={faceColor}
            map={faceMap}
            {...baseProps}
          />
          {/* P55: vách-bên extrude là perimeter 1-group, UV mỗi đoạn = [0,1]² → KHÔNG map đúng
              tỷ lệ được → cạnh textured dùng MÀU GỖ ĐẶC (m.hex) thay vì ảnh kéo dãn. */}
          <meshStandardMaterial
            key={`${part.material}-edge`}
            attach="material-1"
            color={edgeUsesMap ? m.hex : edgeFaceColor}
            map={null}
            {...baseProps}
          />
        </mesh>
      );
    } else {
      meshEl = (
        <mesh key={meshKey} position={meshPos} geometry={customGeo} castShadow receiveShadow>
          <meshStandardMaterial
            key={part.material}
            color={faceColor}
            map={faceMap}
            {...baseProps}
          />
        </mesh>
      );
    }
  } else if (useMulti) {
    // BoxGeometry: 6 materials theo trục X/Y/Z, 2 mặt mỗi trục.
    const sizes = part.size;
    const minDim = Math.min(...sizes);
    const isFaceAxis = (axisIdx: number) => sizes[axisIdx] === minDim;
    const isFaceByIdx = (idx: number) => isFaceAxis(Math.floor(idx / 2));
    meshEl = (
      <mesh key={meshKey} position={meshPos} castShadow receiveShadow>
        <boxGeometry args={part.size} />
        {[0, 1, 2, 3, 4, 5].map((idx) => (
          // P55: mỗi mặt lấy map của ĐÚNG trục nó (axisMaps[axisIdx]) → đúng tỷ lệ, hết kéo dãn.
          // Mặt chính: luôn map. Cạnh: chỉ map khi đồng-màu+textured (edgeUsesMap); đen/trắng→null.
          <meshStandardMaterial
            key={`${part.material}-${idx}`}
            attach={`material-${idx}`}
            color={isFaceByIdx(idx) ? faceColor : edgeFaceColor}
            map={isFaceByIdx(idx) ? faceMap : edgeUsesMap ? axisMaps[Math.floor(idx / 2)] : null}
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
          map={faceMap}
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
  } else if (fitting.kind === 'handle-bar') {
    // P45: thanh bar đen MỜ — metalness thấp + roughness cao (khác strip bóng hơn).
    const color = fitting.color ?? '#1a1a1a';
    meshEl = (
      <mesh position={meshPos} castShadow receiveShadow>
        <boxGeometry args={fitting.size} />
        <meshStandardMaterial color={color} metalness={0.35} roughness={0.6} />
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
  immediate = false,
  fittingsForHingeDetect,
}: {
  config: AssemblyConfig;
  openProgress?: number;
  /** Record mode (clip): snap THẲNG tới target, bỏ lerp theo thời gian → mỗi frame
   *  chụp ra TẤT ĐỊNH (set-then-capture). Mặc định false → giữ animation mượt cũ. */
  immediate?: boolean;
  /** Pass build.fittings để PartMesh detect hinge cho door strip handle (chỉ cần ở init). */
  fittingsForHingeDetect?: ReadonlyArray<Fitting>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);
  useFrame((_, dt) => {
    if (!groupRef.current) return;
    const cur = progressRef.current;
    const speed = 8;
    const next = immediate
      ? openProgress
      : Math.abs(openProgress - cur) < 0.001
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
export function SceneIBL({ intensity = 0.5 }: { intensity?: number }) {
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
 * P24 — Postprocessing CHỈ cho THUMBNAIL (mode='screenshot'). Mount component này
 * trong <Canvas> sẽ "chiếm" khâu render (useFrame priority 1 → R3F tắt auto-render)
 * và đẩy scene qua một EffectComposer:
 *
 *   RenderPass (beauty, linear)
 *     → GTAOPass  (ground-truth ambient occlusion: đổ bóng mềm vào khe ghép tấm,
 *                  góc trong hộc, gầm kệ → render có CHIỀU SÂU, hết "bệt")
 *     → SMAAPass  (khử răng cưa cạnh hình học, sắc nét cho ảnh tĩnh)
 *     → OutputPass (tone-map + sang sRGB)
 *
 * RÀNG BUỘC MÀU: OutputPass đọc `renderer.toneMapping` → vì Canvas set
 * NeutralToneMapping nên ảnh qua composer áp ĐÚNG Neutral y như đường render
 * trực tiếp → màu KHÔNG đổi (giữ chuẩn catalog để lên đơn/cắt). RT của composer
 * là HalfFloat (linear) → không có double-tonemap.
 *
 * Vì chỉ mount khi isShot → scene tương tác/mobile KHÔNG đụng tới (0 rủi ro perf).
 * dpr cao ở screenshot (supersample) tự cho composer RT phân giải cao → mịn hơn.
 */
export function ScreenshotPostFX() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const composer = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));

    // GTAO tune cho scene THANG mm (tủ ~1200–2400mm, tấm dày ~18mm, hộc sâu ~350mm).
    // radius/thickness theo world-unit = mm → ~110mm bắt được contact-shadow ở
    // mối ghép tấm + lòng hộc mà không "ám khói" cả mặt phẳng lớn.
    const gtao = new GTAOPass(scene, camera, size.width, size.height);
    gtao.output = GTAOPass.OUTPUT.Default; // 0 = beauty × AO (đã composite)
    gtao.blendIntensity = 0.55; // P32: 0.9→0.55 — AO nhẹ hơn nữa → màu sát map, chỉ khe/góc tối nhẹ
    gtao.updateGtaoMaterial({
      radius: 110,
      distanceExponent: 1.0,
      thickness: 110,
      scale: 1.0,
      distanceFallOff: 1.0,
      samples: 32, // P30: 16→32 → giảm hạt/noise của AO (mịn hơn)
      screenSpaceRadius: false,
    });
    // P30: tăng cường khử nhiễu Poisson (denoise) cho AO mượt, hết lốm đốm.
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, radiusExponent: 1, rings: 2, samples: 16 });
    c.addPass(gtao);

    c.addPass(new SMAAPass());
    c.addPass(new OutputPass());
    return c;
    // size CỐ TÌNH không vào deps — đổi kích thước xử lý qua setSize ở effect dưới
    // (tạo lại composer mỗi lần resize sẽ rò GPU memory).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);

  useEffect(() => {
    composer.setSize(size.width, size.height);
    composer.setPixelRatio(gl.getPixelRatio());
  }, [composer, size.width, size.height, gl]);

  useEffect(() => () => composer.dispose(), [composer]);

  // priority 1 → R3F nhường khâu render: tự nó KHÔNG gọi gl.render nữa, composer lo.
  useFrame((_, delta) => composer.render(delta), 1);

  return null;
}

const _rigTarget = /*@__PURE__*/ new THREE.Vector3();

/**
 * P32 — Camera rig THUMBNAIL với LENS-SHIFT (kiểu chụp kiến trúc/sản phẩm):
 *  1. lookAt NGANG: nhìn về (0, camY, 0) — CÙNG cao độ camera → trục nhìn song
 *     song sàn → đường ĐỨNG của tủ GIỮ THẲNG TẮP (không hội tụ/nghiêng).
 *  2. LENS-SHIFT đứng: tâm tủ (0, centerY, 0) thường KHÁC cao độ camera (1400mm)
 *     → tủ lệch khỏi giữa khung. Thay vì CHÚC camera (gây nghiêng), ta dịch khung
 *     hình theo phương đứng bằng cách chỉnh phần tử shear `projectionMatrix[9]`
 *     → tủ về CHÍNH GIỮA mà cạnh đứng vẫn thẳng.
 *
 * Toán: điểm ở lệch đứng dyWorld so với trục nhìn, cách `dist` → ndc_y =
 * (dyWorld/dist)/tan(fov/2). Set shear = ndc_y → tâm tủ về ndc_y=0 (giữa khung).
 * Cập nhật cả projectionMatrixInverse để GTAO (đọc inverse dựng lại depth) đúng.
 *
 * useFrame priority 0 (TRƯỚC composer p1) → áp xong mới render. Mỗi frame → bền.
 */
export function ScreenshotCameraRig({
  position,
  centerY,
}: {
  position: [number, number, number];
  centerY: number;
}) {
  const camera = useThree((s) => s.camera as THREE.PerspectiveCamera);
  useFrame(() => {
    // P34: SET position MỖI FRAME (R3F chỉ áp `camera` prop lúc mount → đổi góc
    // screenshotAngle KHÔNG reposition; rig phải tự dời → chụp 3 góc ra 3 ảnh khác).
    camera.position.set(position[0], position[1], position[2]);
    const camY = position[1];
    camera.lookAt(0, camY, 0); // nhìn NGANG → cạnh đứng thẳng
    camera.updateProjectionMatrix(); // reset về frustum đối xứng
    const dyWorld = centerY - camY;
    const dist = camera.position.distanceTo(_rigTarget.set(0, centerY, 0));
    const fovHalf = (camera.fov / 2) * (Math.PI / 180);
    const shiftY = dyWorld / (dist * Math.tan(fovHalf));
    camera.projectionMatrix.elements[9] += shiftY; // lens-shift đứng → canh giữa
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  });
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
        {/* P65: opacity 0.22→0.30 → bóng ĐẬM hơn ở chân để BÁM SÀN trên nền gradient
            xám ấm (trên nền trắng cũ bóng nhạt là đủ; trên nền xám cần đậm hơn mới
            đọc rõ). Viền bóng vẫn mềm nhờ PCFSoftShadowMap + shadow-radius 14. */}
        <shadowMaterial transparent opacity={0.45} color="#1a1410" />
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

/** Nhãn số kích thước — div HTML luôn quay về camera; CHỈ ghi con số.
 *  Theme-styled: nền kem (--color-bg) + chữ accent thay vì trắng/xám lạc tông.
 *  `variant`: 'outer' (tổng — đậm, nổi) | 'inner' (từng ô — nhỏ, nhạt) để phân cấp.
 *  zIndexRange [40, 0]: dưới CellBar (z-[100]) để không đè UI. */
function DimLabel({
  position,
  mm,
  variant = 'outer',
}: {
  position: [number, number, number];
  mm: number;
  variant?: 'outer' | 'inner';
}) {
  // P54d — ĐỒNG BỘ thiết kế: CẢ HAI đều PILL nền kem (đọc rõ trên MỌI nền, hết halo
  // nhoè trên tủ tối). Khác nhau "1 chút": outer (tổng) = to + đậm + có đuôi "mm";
  // inner (cột/tầng) = nhỏ + nhạt hơn + CHỈ số (bỏ "mm" cho gọn → đỡ đè nhau khi tủ
  // nhiều cột trên mobile). Responsive: nhỏ thêm 1 cỡ ở mobile (<768px).
  const isInner = variant === 'inner';
  const cls = isInner
    ? 'rounded bg-[var(--color-bg)]/88 px-1 py-px text-[9px] md:text-[11px] font-medium text-[var(--color-accent)]/90 ring-1 ring-[var(--color-accent)]/10'
    : 'rounded-md bg-[var(--color-bg)]/95 px-1.5 py-0.5 text-[11px] md:text-[13px] font-semibold text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/15 shadow-sm';
  return (
    <Html position={position} center zIndexRange={[40, 0]}>
      <div className={`pointer-events-none select-none whitespace-nowrap tabular-nums ${cls}`}>
        {Math.round(mm)}
        {!isInner && <span className="ml-0.5 font-normal opacity-50">mm</span>}
      </div>
    </Html>
  );
}

/** Màu chung của đường + chấm kích thước — warm grey hợp theme kem. */
const DIM_COL = '#b0a89f';

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
export function Dimensions({
  parts,
  innerColDims,
  innerRowDims,
  showOuter = true,
}: {
  parts: Part[];
  /** P13.6: dim thông thuỷ từng cột (chỉ khi tab Chiều rộng + manual). [{centerX, mm}] */
  innerColDims?: { centerX: number; mm: number }[];
  /** P13.6: dim thông thuỷ từng tầng (chỉ khi tab Chiều cao + manual). [{centerY, mm}] */
  innerRowDims?: { centerY: number; mm: number }[];
  /** P29: bật/tắt 3 trục kích thước TỔNG (rộng/cao/sâu). Inner vẫn theo tab/manual. */
  showOuter?: boolean;
}) {
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
  const gy = minY + 4; // nhấc đường nằm khỏi sàn vài mm → tránh z-fighting với Ground
  // P21: Bố cục 3 trục TỔNG cân đối kiểu bản vẽ kỹ thuật (LUÔN hiện):
  //  - RỘNG: cạnh trước-đáy (ngang), line Z = maxZ+220 (xa, xuống dưới screen).
  //  - SÂU:  cạnh phải-đáy (đi vào), line X = maxX+140.
  //  - CAO:  cạnh TRÁI-đứng, line X = minX-160 → cân với SÂU bên phải (hết lệch).
  // Inner (từng ô) đặt SÁT cabinet, tách hẳn outer (không line riêng → đỡ rối):
  //  - cols: ngay trước mép đáy (Z = maxZ+55), giữa outer-width line.
  //  - rows: ngay sát mép trái (X = minX-55), nằm TRONG outer-height line.
  const wz = maxZ + 340; // RỘNG line (front, đẩy XA để tách hẳn inner-col ở Z+50)
  const dx = maxX + 140; // SÂU line (right floor)
  const hx = minX - 160; // CAO line (LEFT vertical)
  return (
    <group>
      {/* P29: 3 trục TỔNG — bật/tắt qua showOuter (nút trên 3D viewport). */}
      {showOuter && (
        <>
          {/* RỘNG (tổng) — cạnh trước, sát sàn. */}
          <Line points={[[minX, gy, wz], [maxX, gy, wz]]} color={DIM_COL} lineWidth={1.5} />
          <DimDot at={[minX, gy, wz]} />
          <DimDot at={[maxX, gy, wz]} />
          <DimLabel position={[(minX + maxX) / 2, minY + 90, wz]} mm={maxX - minX} />
          {/* CAO (tổng) — cạnh TRÁI đứng (cân với SÂU bên phải). */}
          <Line points={[[hx, minY, maxZ], [hx, maxY, maxZ]]} color={DIM_COL} lineWidth={1.5} />
          <DimDot at={[hx, minY, maxZ]} />
          <DimDot at={[hx, maxY, maxZ]} />
          <DimLabel position={[hx - 90, (minY + maxY) / 2, maxZ]} mm={maxY - minY} />
          {/* SÂU (tổng) — cạnh phải, sát sàn. */}
          <Line points={[[dx, gy, minZ], [dx, gy, maxZ]]} color={DIM_COL} lineWidth={1.5} />
          <DimDot at={[dx, gy, minZ]} />
          <DimDot at={[dx, gy, maxZ]} />
          <DimLabel position={[dx, minY + 90, (minZ + maxZ) / 2]} mm={maxZ - minZ} />
        </>
      )}
      {/* INNER từng cột — pill nền kem TRƯỚC + DƯỚI mép đáy mỗi cột (tách thân tủ).
          P54d: NHIỀU cột (>4) → SO LE độ sâu (cột lẻ đẩy ra trước Z+75) → 2 hàng zigzag,
          hết đè nhau trên mobile. Ít cột → 1 hàng gọn. */}
      {(() => {
        const stagger = (innerColDims?.length ?? 0) > 4;
        return innerColDims?.map((d, i) => (
          <DimLabel
            key={`ic-${i}`}
            position={[d.centerX, minY + 28, maxZ + 80 + (stagger && i % 2 ? 78 : 0)]}
            mm={d.mm}
            variant="inner"
          />
        ));
      })()}
      {/* INNER từng tầng — pill bên TRÁI mỗi tầng. P54d: NHIỀU tầng (>4) → SO LE ngang
          (tầng lẻ đẩy thêm sang trái X-60) → zigzag, hết đè nhau. */}
      {(() => {
        const stagger = (innerRowDims?.length ?? 0) > 4;
        return innerRowDims?.map((d, i) => (
          <DimLabel
            key={`ir-${i}`}
            position={[minX - 95 - (stagger && i % 2 ? 62 : 0), d.centerY, maxZ]}
            mm={d.mm}
            variant="inner"
          />
        ));
      })()}
    </group>
  );
}
