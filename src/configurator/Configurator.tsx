'use client';
// =============================================================
// CONFIGURATOR — khung dùng chung cho MỌI sản phẩm.
// Nhận 1 ProductDNA → render: bảng điều khiển (slider/nút) + 3D + giá + bảng cắt.
// Núm điều khiển: dna.resolveControls(values) nếu DNA có (núm động), không thì dna.parameters.
// Engine — chỉ mở rộng khi founder duyệt; thêm sản phẩm = thêm products/<slug>/dna.ts.
// =============================================================
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type {} from '@react-three/fiber';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { NeutralToneMapping, PCFShadowMap, Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import { AssemblyMesh, Dimensions, FittingMesh, Ground, PartMesh, SceneIBL, SceneLighting, ScreenshotCameraRig, ScreenshotPostFX, Wall, computePartAnimation, setRecordTint, type AssemblyConfig } from './renderer';
import { StagingProps } from './staging-props';
import { edgeHexForBand, resolveMaterial } from './materials';
import { computePrice, formatPrice, type PriceBreakdown } from './pricing';
import { buildCutlist, type Cutlist } from './cutlist';
import { PricePanel, CutlistPanel } from './admin-detail-panels'; // P96 — dùng chung cả 2 config (bỏ bản inline trùng)
import { OrderBar, FloatingIconButton, IconUndo, IconRuler, EditorialHeader, HintPill, WarningBox, SectionCard, SectionHeading, Segmented, SwatchOption } from './ui'; // P96 — kit dùng chung (thay OrderBar/OrderDialog + chrome + 1 phần controls cục bộ)
import { nestBoards } from '@/lib/nesting';
import type { NestedBoardLayout, NestingResult } from '@/lib/dxf/types';
import {
  cellsToBlocks,
  encodeBlocks,
  encodeCellGrid,
  findBlockAt,
  hasSubSplit,
  isBlocksValue,
  isUniformBlocks,
  mergeBlocks,
  parseCellGrid,
  parseSubSplit,
  reconcileCellGrid,
  setSubCellType,
  splitBlockIntra,
  unmergeBlocks,
  unsplitBlockIntra,
  type MergeDirection,
  type SplitAxis,
} from './cellgrid';
import type {
  EdgeBandingType,
  Fitting,
  ParamValues,
  Parameter,
  Part,
  PriceConfig,
  ProductDNA,
  ResolveContext,
} from './types';

// Bóng đổ: three r184 ĐÃ deprecate PCFSoftShadowMap ở runtime (WebGLShadowMap tự
// fallback PCFShadowMap + cảnh báo console) → dùng thẳng PCFShadowMap cho cả
// interactive lẫn screenshot. Độ MỀM mép bóng lấy từ directionalLight
// shadow-radius (nhoè theo texel) — screenshot xài radius cao hơn để mềm hơn.
const SHADOW_CONFIG = { enabled: true, type: PCFShadowMap };

/** Giá trị khởi tạo: lấy default của từng Parameter. */
function initialValues(parameters: Parameter[]): ParamValues {
  const values: ParamValues = {};
  for (const p of parameters) values[p.id] = p.default;
  return values;
}

/** Style swatch cho picker: ảnh vân nếu có texture, ngược lại nền `fallbackBg`
 *  (giữ logic tint/darken/“theo khung” đã tính sẵn cho các option khác). */
function swatchCss(material: string, fallbackBg: string): CSSProperties {
  const m = resolveMaterial(material);
  if (m.textureUrl) {
    return { backgroundImage: `url(${m.textureUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  return { backgroundColor: fallbackBg };
}

/** 1 khối núm trong sidebar: có `group` → khung có tiêu đề; không → núm đơn lẻ. */
interface ControlSection {
  group?: string;
  items: Parameter[];
}

/** Gom các núm LIÊN TIẾP cùng `group` vào 1 section (núm không group → section riêng). */
function groupControls(controls: Parameter[]): ControlSection[] {
  const sections: ControlSection[] = [];
  for (const param of controls) {
    const last = sections[sections.length - 1];
    if (param.group && last && last.group === param.group) {
      last.items.push(param);
    } else {
      sections.push({ group: param.group, items: [param] });
    }
  }
  return sections;
}

// P36 v3: nhãn NGẮN + icon cho tab bar (5 tab → tránh xuống dòng xấu trong sidebar hẹp).
const TAB_SHORT: Record<string, string> = {
  'Chiều rộng': 'Rộng',
  'Chiều cao': 'Cao',
  'Chiều sâu': 'Sâu',
  'Ô tủ': 'Ô tủ',
  'Vật liệu khung': 'Vật liệu',
};

/** Icon nhỏ cho từng tab (16×16, currentColor). */
function TabIcon({ label }: { label: string }) {
  const cls = 'w-4 h-4 shrink-0';
  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (label) {
    case 'Chiều rộng': // mũi tên ngang ↔
      return (
        <svg className={cls} viewBox="0 0 16 16" {...stroke}>
          <path d="M2 8h12M5 5 2 8l3 3M11 5l3 3-3 3" />
        </svg>
      );
    case 'Chiều cao': // mũi tên dọc ↕
      return (
        <svg className={cls} viewBox="0 0 16 16" {...stroke}>
          <path d="M8 2v12M5 5 8 2l3 3M5 11l3 3 3-3" />
        </svg>
      );
    case 'Chiều sâu': // mũi tên 2 chiều CHÉO (trục sâu, giống rộng/cao nhưng chéo)
      return (
        <svg className={cls} viewBox="0 0 16 16" {...stroke}>
          <path d="M4 12 12 4M4 8.5 4 12 7.5 12M12 7.5 12 4 8.5 4" />
        </svg>
      );
    case 'Ô tủ': // lưới 2×2
      return (
        <svg className={cls} viewBox="0 0 16 16" {...stroke}>
          <rect x="2.5" y="2.5" width="11" height="11" rx="1.2" />
          <path d="M8 2.5v11M2.5 8h11" />
        </svg>
      );
    case 'Vật liệu khung': // mẫu màu (swatch)
      return <svg className={cls} viewBox="0 0 16 16"><rect x="2.5" y="2.5" width="11" height="11" rx="2.5" fill="currentColor" /></svg>;
    default:
      return null;
  }
}

// ============================================================
// DIRECT-3D MANIPULATION (redesign 2026-05) — chạm ô tủ trên 3D để đổi
// kiểu / màu, thay cho lưới 2D trong sidebar.
// ============================================================

/** Bề dày ván khung (mm) — mirror hằng T trong dna.ts. CHỈ dùng để định vị
 *  hitbox vô hình; không tham gia logic build/giá. */
const FRAME_T = 18;

/** 1 ô tủ trong không gian 3D — vị trí tâm + kích thước (mm). subIdx có khi
 *  ô đã sub-split: 0 = L (V) / B (H), 1 = R (V) / T (H). */
interface CellBox {
  row: number;
  col: number;
  subIdx?: 0 | 1;
  pos: [number, number, number];
  size: [number, number, number];
}

/**
 * Dựng danh sách ô 3D từ núm cellgrid: dùng `colSizes`/`rowSizes` (kích thước
 * thông thuỷ thật mm, do dna.resolveControls tính sẵn) + bề dày khung FRAME_T.
 * P3 v2: ô có sub-split (block.t = "a>b" V hoặc "a^b" H) → tách thành 2
 * hitbox sub-cell để user click chọn riêng từng sub-cell.
 */
function cellBoxes(
  param: Parameter | undefined,
  depth: number,
  cellBlocks: import('./cellgrid').CellBlock[],
): CellBox[] {
  if (!param) return [];
  const rows = param.gridRows ?? 0;
  const cols = param.gridCols ?? 0;
  const colSizes = param.colSizes ?? [];
  const rowSizes = param.rowSizes ?? [];
  if (rows < 1 || cols < 1 || colSizes.length !== cols || rowSizes.length !== rows) {
    return [];
  }
  const W = colSizes.reduce((s, x) => s + x, 0) + (cols + 1) * FRAME_T;
  const boxes: CellBox[] = [];
  // Iterate by block (top-left only) → cross-merged block có DUY NHẤT 1 hitbox to;
  // primitive 1×1 → 1 hitbox; sub-split → 2 sub-hitbox.
  const seenBlocks = new Set<import('./cellgrid').CellBlock>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const block = cellBlocks.find(
        (b) => r >= b.r && r < b.r + b.rs && c >= b.c && c < b.c + b.cs,
      );
      if (!block || seenBlocks.has(block)) continue;
      // Chỉ tạo hitbox khi iterate đến top-left của block.
      if (r !== block.r || c !== block.c) continue;
      seenBlocks.add(block);
      // Compute block bounds (sum cols/rows trong block.rs/cs).
      let blockW = 0;
      for (let k = block.c; k < block.c + block.cs; k++) blockW += colSizes[k];
      blockW += (block.cs - 1) * FRAME_T; // vách giữa các col bị nuốt vào block
      let blockH = 0;
      for (let k = block.r; k < block.r + block.rs; k++) blockH += rowSizes[k];
      blockH += (block.rs - 1) * FRAME_T;
      // Compute center của block trong scene coords.
      let xLeft = -W / 2 + FRAME_T;
      for (let k = 0; k < block.c; k++) xLeft += colSizes[k] + FRAME_T;
      const blockCenterX = xLeft + blockW / 2;
      let yBottom = FRAME_T;
      for (let k = 0; k < block.r; k++) yBottom += rowSizes[k] + FRAME_T;
      const blockCenterY = yBottom + blockH / 2;
      // Phân tích t để biết primitive / sub-split.
      const parsed = parseSubSplit(block.t);
      if ('primitive' in parsed && parsed.primitive !== undefined) {
        boxes.push({
          row: block.r,
          col: block.c,
          pos: [blockCenterX, blockCenterY, 0],
          size: [blockW, blockH, depth + 120],
        });
      } else if ('split' in parsed && parsed.split) {
        if (parsed.split.axis === 'V') {
          const subW = (blockW - FRAME_T) / 2;
          boxes.push({
            row: block.r,
            col: block.c,
            subIdx: 0,
            pos: [blockCenterX - (subW + FRAME_T) / 2, blockCenterY, 0],
            size: [subW, blockH, depth + 120],
          });
          boxes.push({
            row: block.r,
            col: block.c,
            subIdx: 1,
            pos: [blockCenterX + (subW + FRAME_T) / 2, blockCenterY, 0],
            size: [subW, blockH, depth + 120],
          });
        } else {
          const subH = (blockH - FRAME_T) / 2;
          boxes.push({
            row: block.r,
            col: block.c,
            subIdx: 0,
            pos: [blockCenterX, blockCenterY - (subH + FRAME_T) / 2, 0],
            size: [blockW, subH, depth + 120],
          });
          boxes.push({
            row: block.r,
            col: block.c,
            subIdx: 1,
            pos: [blockCenterX, blockCenterY + (subH + FRAME_T) / 2, 0],
            size: [blockW, subH, depth + 120],
          });
        }
      }
    }
  }
  return boxes;
}

/** P36: hộp bao CẢ HÀNG `row` (full inner width) — tô sáng tầng đang chọn ở tab
 *  Chiều cao (tái dùng CellHighlight). Toạ độ khớp cellBoxes: X canh giữa, Y từ
 *  sàn (FRAME_T) lên. Trả null nếu param/kích thước không hợp lệ. */
function rowBox(
  param: Parameter | undefined,
  depth: number,
  row: number,
): CellBox | null {
  if (!param) return null;
  const rows = param.gridRows ?? 0;
  const cols = param.gridCols ?? 0;
  const colSizes = param.colSizes ?? [];
  const rowSizes = param.rowSizes ?? [];
  if (rows < 1 || cols < 1 || colSizes.length !== cols || rowSizes.length !== rows) return null;
  if (row < 0 || row >= rows) return null;
  const W = colSizes.reduce((s, x) => s + x, 0) + (cols + 1) * FRAME_T;
  let yBottom = FRAME_T;
  for (let k = 0; k < row; k++) yBottom += rowSizes[k] + FRAME_T;
  return {
    row,
    col: 0,
    // P36 v3: khít chiều cao thông thuỷ tầng (thụt nhẹ -6mm 2 đầu), nhưng LỒI RA
    // TRƯỚC ~60mm (z=+30, depth+60) để không đè lên mặt ngăn kéo/cánh; mặt sau vẫn
    // phẳng với hậu (không thừa ra phía sau khi xoay).
    pos: [0, yBottom + rowSizes[row] / 2, 30],
    size: [W - 2 * FRAME_T - 6, rowSizes[row] - 6, depth + 60],
  };
}

/** P36 v2: hộp bao CẢ CỘT `col` (full inner height) — tô sáng cột đang chọn ở tab
 *  Chiều rộng. Toạ độ khớp cellBoxes: X canh theo cột, Y giữa (full chiều cao). */
function colBox(
  param: Parameter | undefined,
  depth: number,
  col: number,
): CellBox | null {
  if (!param) return null;
  const rows = param.gridRows ?? 0;
  const cols = param.gridCols ?? 0;
  const colSizes = param.colSizes ?? [];
  const rowSizes = param.rowSizes ?? [];
  if (rows < 1 || cols < 1 || colSizes.length !== cols || rowSizes.length !== rows) return null;
  if (col < 0 || col >= cols) return null;
  const W = colSizes.reduce((s, x) => s + x, 0) + (cols + 1) * FRAME_T;
  const H = rowSizes.reduce((s, x) => s + x, 0) + (rows + 1) * FRAME_T;
  let xLeft = -W / 2 + FRAME_T;
  for (let k = 0; k < col; k++) xLeft += colSizes[k] + FRAME_T;
  return {
    row: 0,
    col,
    pos: [xLeft + colSizes[col] / 2, H / 2, 30],
    size: [colSizes[col] - 6, H - 2 * FRAME_T - 6, depth + 60],
  };
}

/** Lớp hộp vô hình phủ mỗi ô — bắt click → biết (row,col). Trong suốt
 *  (opacity 0) nhưng vẫn raycast. R3F `onClick` chỉ fire khi click, không
 *  fire khi kéo (xoay camera) — nên không xung đột OrbitControls. */
/** P22/P23: 1 sub-cell (sau split) có vừa cho `type` không — dựa kích thước
 *  THÔNG THUỶ thật (w×h mm). Ngưỡng đồng bộ engine applyTypeFallback:
 *    door: w 250–1200, h ≤ 600 · drawer: w 250–900, h ≤ 400 + tủ sâu ≥ 300
 *    (P76 ray âm — sâu 250 không cỡ ray nào vừa) · open: chỉ ≥150 inner.
 *  Single source cho: split eligibility, subBanned (CellBar), fallback khi split. */
const SUBCELL_MIN_INNER = 150;
function subCellTypeFits(type: string, w: number, h: number, depth: number): boolean {
  if (w < SUBCELL_MIN_INNER || h < SUBCELL_MIN_INNER) return false;
  if (type === 'drawer') return w >= 250 && w <= 900 && h <= 400 && depth >= 300;
  if (type === 'door') return w >= 250 && w <= 1200 && h <= 600;
  return true; // open-back / open-nobk
}

/** Tính lý do tại sao 1 option bị banned cho cell (r, c) cụ thể.
 *  Thống nhất subject là "ô" (cell) với attribute "rộng/cao":
 *    "Ô {attribute} {actual}cm — {cánh/ngăn kéo} cần ô {attribute} tối đa {limit}cm"
 *  VD: "Ô rộng 190cm — cánh cần ô rộng tối đa 120cm". */
function getDisabledReason(
  value: string,
  ctx: { bannedByRow: boolean; bannedByCol: boolean; rowH?: number; colW?: number },
): string | null {
  const { bannedByRow, bannedByCol, rowH, colW } = ctx;
  if (!bannedByRow && !bannedByCol) return null;
  const cm = (mm: number) => Math.round(mm / 10);
  if (value === 'drawer') {
    if (bannedByCol && colW != null) {
      if (colW < 250) return `Ô rộng ${cm(colW)}cm — ngăn kéo cần ô rộng tối thiểu 25cm`;
      return `Ô rộng ${cm(colW)}cm — ngăn kéo cần ô rộng tối đa 90cm`;
    }
    if (bannedByRow && rowH != null) {
      if (rowH > 400) return `Ô cao ${cm(rowH)}cm — ngăn kéo cần ô cao tối đa 40cm`;
      return 'Ô ở cao quá — ngăn kéo chỉ phù hợp dưới 1,2m';
    }
    return 'Ngăn kéo không hợp kích thước';
  }
  if (value === 'door') {
    if (bannedByCol && colW != null) {
      if (colW < 250) return `Ô rộng ${cm(colW)}cm — cánh cần ô rộng tối thiểu 25cm`;
      return `Ô rộng ${cm(colW)}cm — cánh cần ô rộng tối đa 120cm`;
    }
    if (bannedByRow && rowH != null) {
      return `Ô cao ${cm(rowH)}cm — cánh cần ô cao tối đa 240cm`;
    }
    return 'Cánh không hợp kích thước';
  }
  return 'Không hợp kích thước';
}

function CellHitboxes({
  boxes,
  onPick,
}: {
  boxes: CellBox[];
  onPick: (row: number, col: number, subIdx?: 0 | 1) => void;
}) {
  return (
    <group>
      {boxes.map((b) => (
        <mesh
          key={`${b.row}-${b.col}-${b.subIdx ?? 'p'}`}
          position={b.pos}
          onClick={(e) => {
            e.stopPropagation();
            onPick(b.row, b.col, b.subIdx);
          }}
        >
          <boxGeometry args={b.size} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Tô ĐỎ NHẸ ô đang chọn — khối hộp trong suốt đỏ phủ đúng ô, để khách biết
 *  đang chỉnh ô nào (popup neo cố định ở góc, không còn neo tại ô). */
function CellHighlight({ box }: { box: CellBox }) {
  return (
    <mesh position={box.pos} renderOrder={10}>
      <boxGeometry args={box.size} />
      <meshBasicMaterial
        color="#ff2020"
        transparent
        opacity={0.5}
        depthWrite={false}
      />
    </mesh>
  );
}

// Vector tái dùng cho FitCamera — tránh cấp phát mới mỗi lần fit.
const _fitDir = new Vector3();
const _fitTarget = new Vector3();

/**
 * Camera tự fit khung hình: target = tâm tủ (Y = chiều cao / 2); khoảng cách
 * tính sao cho cả tủ (bounding sphere) lọt khung — xét CẢ fov dọc lẫn fov
 * ngang (suy từ tỉ lệ canvas). Màn hình dọc-hẹp (mobile) → fov ngang nhỏ →
 * tự lùi xa hơn nên không cắt đỉnh tủ. Giữ nguyên góc orbit khách đang xem;
 * refit khi đổi kích thước tủ hoặc xoay/đổi kích thước màn hình.
 * Presentation layer (camera) — KHÔNG đụng engine.
 */
function FitCamera({
  width,
  height,
  depth,
}: {
  width: number;
  height: number;
  depth: number;
}) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  // controls lấy qua useThree (OrbitControls có makeDefault) — khi controls
  // vào store, FitCamera re-render + effect chạy lại. Tránh lỗi thứ tự
  // ref/layout-effect (effect FitCamera chạy trước khi ref OrbitControls gắn).
  const controls = useThree((s) => s.controls) as
    | { target: Vector3; update: () => void }
    | null;
  const fitted = useRef(false);
  useLayoutEffect(() => {
    if (!controls) return;
    // Bán kính bao quanh tủ (bounding sphere) + góc fov dọc/ngang.
    const radius = 0.5 * Math.hypot(width, height, depth);
    const vFov = (camera.fov * Math.PI) / 180;
    const aspect = size.width / size.height || 1;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    // Lùi theo góc NHỎ hơn (chiều bị bó nhất) → cả tủ luôn lọt khung. ×1.12 đệm.
    const dist = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.12;
    _fitTarget.set(0, height / 2, 0);
    // Hướng nhìn: lần đầu = góc iso mặc định; sau giữ góc khách đang xem.
    if (fitted.current) {
      _fitDir.copy(camera.position).sub(controls.target);
      if (_fitDir.lengthSq() < 1) _fitDir.set(3000, 1000, 3800);
    } else {
      _fitDir.set(3000, 1000, 3800);
    }
    _fitDir.normalize();
    camera.position.copy(_fitTarget).addScaledVector(_fitDir, dist);
    controls.target.copy(_fitTarget);
    controls.update();
    fitted.current = true;
  }, [width, height, depth, size.width, size.height, camera, controls]);
  return null;
}

/** Thanh ngang chọn kiểu + màu + chia/gộp ô — neo SÁT CẠNH DƯỚI 3D viewport.
 *  Layout: hàng trên = tab Kiểu/Màu + thanh action Chia/Gộp; hàng dưới =
 *  options grid của tab đang chọn. Switch tab GIỮ ô đang chọn (cellPopup).
 *  Chia/Gộp là placeholder Session 7 — sẽ hoạt động từ Session 9-10.
 *  Ngăn kéo (drawer) luôn bị cấm Chia/Gộp. */
function CellBar({
  cellsParam,
  cellColorsParam,
  row,
  col,
  currentType,
  currentColor,
  tab,
  onTabChange,
  onPickType,
  onPickColor,
  onSplitVertical,
  onSplitHorizontal,
  onMergeUp,
  onMergeDown,
  onMergeLeft,
  onMergeRight,
  onUnmerge,
  frozenByMerge = false,
  mergedRestrict = false,
  mergedDoorEligible = false,
  isSubCell = false,
  subBanned = [],
  onClose,
}: {
  cellsParam: Parameter;
  cellColorsParam: Parameter | undefined;
  row: number;
  col: number;
  currentType: string;
  currentColor: string;
  tab: 'type' | 'color';
  onTabChange: (t: 'type' | 'color') => void;
  onPickType: (value: string) => void;
  onPickColor: (value: string) => void;
  /** P3 SPLIT: undefined → nút disabled (drawer / merged block / cols max). */
  onSplitVertical?: () => void;
  onSplitHorizontal?: () => void;
  /** P4 MERGE: 4 hướng. undefined → nút disabled (không có láng giềng phù hợp). */
  onMergeUp?: () => void;
  onMergeDown?: () => void;
  onMergeLeft?: () => void;
  onMergeRight?: () => void;
  /** P4 BỎ GỘP: undefined → nút disabled (block chưa cross-merged). */
  onUnmerge?: () => void;
  /** P4: block đang cross-merged (rs>1 hoặc cs>1) → lock đổi type/color, chỉ
   *  cho Bỏ gộp. User phải Bỏ gộp trước để chỉnh thuộc tính từng ô con. */
  frozenByMerge?: boolean;
  /** P61: block cross-merged → picker HẠN CHẾ (Mở không hậu + Cánh có hậu),
   *  KHÔNG khóa cứng. User đổi trực tiếp giữa 2 kiểu mà không cần Bỏ gộp. */
  mergedRestrict?: boolean;
  /** P61: khoang gộp vừa kích thước cánh → cho hiện option "Cánh (có hậu)". */
  mergedDoorEligible?: boolean;
  /** P5.10: sub-cell context (cellPopup.subIdx defined) → KHÔNG cho chọn
   *  'open-nobk' vì hậu dùng chung cho cả cell, không thể có sub-cell open-nobk
   *  riêng (sẽ phá tấm hậu cell). */
  isSubCell?: boolean;
  /** P22: type bị cấm theo kích thước SUB-CELL thật (tính ở caller từ dim sau
   *  split). Khi isSubCell → dùng list này thay disabledByRow/Col (vốn theo ô ngoài). */
  subBanned?: string[];
  onClose: () => void;
}) {
  const param = tab === 'color' ? cellColorsParam : cellsParam;
  const current = tab === 'color' ? currentColor : currentType;
  const onPick = tab === 'color' ? onPickColor : onPickType;
  // Khi không có cellColorsParam (DNA không opt-in màu từng ô) thì ẩn tab Màu.
  const showColorTab = !!cellColorsParam;
  // P5.10: sub-cell context + tab Kiểu → filter bỏ 'open-nobk' (hậu shared per cell).
  const rawOpts = param?.options ?? [];
  const opts =
    isSubCell && tab === 'type'
      ? rawOpts.filter((o) => o.value !== 'open-nobk')
      : mergedRestrict && tab === 'type'
        ? [
            // P61 — ô GỘP: chỉ "Mở (không hậu)" + (nếu khoang vừa kích thước) "Cánh".
            ...rawOpts.filter((o) => o.value === 'open-nobk'),
            ...(mergedDoorEligible ? [{ value: 'door', label: 'Cánh' }] : []),
          ]
        : rawOpts;
  const isColor = tab === 'color';
  const tint = param?.tint ?? '#e7e5df';
  const bannedByRow = param?.disabledByRow?.[row] ?? [];
  const bannedByCol = param?.disabledByCol?.[col] ?? [];
  // P22: sub-cell dùng subBanned (tính theo dim sau split); ô thường dùng
  // disabledByRow/Col (dim ô ngoài). Màu (color tab) không bị cấm theo size.
  const banned =
    isColor ? [] : isSubCell ? subBanned : [...bannedByRow, ...bannedByCol];
  const locked = param?.lockedCells?.[row]?.[col] ?? false;
  const rowH = param?.rowSizes?.[row];
  const colW = param?.colSizes?.[col];
  const bgOf = (v: string): string => {
    if (isColor) return v === opts[0]?.value ? tint : resolveMaterial(v).hex;
    return v === 'open-nobk' ? '#ffffff' : tint;
  };
  // P37: tab Kiểu/Màu — full-width segmented (panel dọc trong sidebar).
  const tabBtn = (id: 'type' | 'color', label: string) => (
    <button
      type="button"
      onClick={() => onTabChange(id)}
      aria-pressed={tab === id}
      className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium tracking-wide transition ${
        tab === id
          ? 'bg-[var(--color-accent)] text-white'
          : 'text-[var(--color-accent)]/70 hover:bg-[var(--color-accent-bg)]'
      }`}
    >
      {label}
    </button>
  );
  /** P37: nút Chia/Gộp — có nền surface (panel dọc), flex-1 chia đều theo hàng. */
  const segBtn = (
    key: string,
    label: React.ReactNode,
    title: string,
    onClick: () => void,
    disabled: boolean,
  ) => (
    <button
      key={key}
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={`flex-1 min-w-[28px] inline-flex items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-[11px] font-medium tracking-wide transition ${
        disabled
          ? 'cursor-not-allowed bg-[var(--color-bg)]/40 opacity-40 text-[var(--color-accent)]/50'
          : 'bg-[var(--color-bg)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white'
      }`}
    >
      {label}
    </button>
  );
  /** Icon SVG: 1 box vuông với divider line — ý nghĩa "1 ô bị chia thành 2"
   *  trực quan hơn 2 box riêng. SplitV = đường dọc ở giữa, SplitH = đường ngang. */
  const SplitVIcon = () => (
    <svg
      viewBox="0 0 14 14"
      className="inline-block h-3.5 w-3.5 align-middle"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="1.5" y="2.5" width="11" height="9" rx="1" />
      <line x1="7" y1="3" x2="7" y2="11" />
    </svg>
  );
  const SplitHIcon = () => (
    <svg
      viewBox="0 0 14 14"
      className="inline-block h-3.5 w-3.5 align-middle"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="1.5" y="2.5" width="11" height="9" rx="1" />
      <line x1="2" y1="7" x2="12" y2="7" />
    </svg>
  );
  // P3 v2: split active (intra-cell). Sub-cell INHERIT parent type (door → 2
  // door, drawer → 2 drawer). Eligibility do parent check (sub-cell fit size
  // constraint theo type) — onSplitVertical/Horizontal callback `undefined` khi
  // không đủ điều kiện.
  const splitVTitle = !onSplitVertical
    ? `Không thể chia dọc — ô ${currentType === 'drawer' ? 'ngăn kéo' : currentType === 'door' ? 'cánh' : 'này'} không đủ rộng cho 2 sub-cell hợp lệ`
    : `Chia ô thành 2 ${currentType === 'drawer' ? 'ngăn kéo' : currentType === 'door' ? 'cánh' : 'phần'} trái-phải (50/50)`;
  const splitHTitle = !onSplitHorizontal
    ? `Không thể chia ngang — ô không đủ cao cho 2 sub-cell hợp lệ`
    : `Chia ô thành 2 ${currentType === 'drawer' ? 'ngăn kéo' : currentType === 'door' ? 'cánh' : 'phần'} trên-dưới (50/50)`;
  // P4 MERGE title: cụ thể theo hướng. Disable callback = undefined → grey out.
  const mergeUpTitle = !onMergeUp
    ? 'Không thể gộp lên — không có ô láng giềng phù hợp'
    : 'Gộp với ô bên trên';
  const mergeDownTitle = !onMergeDown
    ? 'Không thể gộp xuống — không có ô láng giềng phù hợp'
    : 'Gộp với ô bên dưới';
  const mergeLeftTitle = !onMergeLeft
    ? 'Không thể gộp sang trái — không có ô láng giềng phù hợp'
    : 'Gộp với ô bên trái';
  const mergeRightTitle = !onMergeRight
    ? 'Không thể gộp sang phải — không có ô láng giềng phù hợp'
    : 'Gộp với ô bên phải';
  const unmergeTitle = !onUnmerge
    ? 'Ô chưa được gộp — không có gì để bỏ'
    : 'Bỏ gộp: tách block lớn về các ô riêng';
  const hasSplit = !!(onSplitVertical || onSplitHorizontal);
  const hasMerge = !!(onMergeUp || onMergeDown || onMergeLeft || onMergeRight);
  // P37c: mũi tên hướng GỘP cho D-pad — vẽ trỏ LÊN, xoay theo hướng.
  const mergeArrow = (dir: 'up' | 'down' | 'left' | 'right') => {
    const rot = { up: 0, right: 90, down: 180, left: 270 }[dir];
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-[18px] w-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transform: `rotate(${rot}deg)` }}
        aria-hidden="true"
      >
        <path d="M12 19V7M6 13l6-6 6 6" />
      </svg>
    );
  };
  // P37c: 1 ô trong D-pad GỘP — bật nếu có handler hướng đó, mờ nếu không.
  const dpadBtn = (
    handler: (() => void) | undefined,
    dir: 'up' | 'down' | 'left' | 'right',
    title: string,
  ) => (
    <button
      type="button"
      disabled={!handler}
      onClick={handler}
      title={title}
      aria-label={title}
      className={`flex aspect-square items-center justify-center rounded-lg transition ${
        handler
          ? 'bg-[var(--color-bg)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white'
          : 'cursor-not-allowed bg-[var(--color-bg)]/35 text-[var(--color-accent)]/20'
      }`}
    >
      {mergeArrow(dir)}
    </button>
  );
  return (
    // P41: panel DỌC nhúng — COMPACT. Kiểu = pill NGANG (swatch nhỏ + tên, không kéo
    // dài) · Bố cục: nhãn Chia/Gộp bên trái + control bên phải · D-pad thu nhỏ.
    <SectionCard className="flex flex-col gap-2">
      {/* Header: nhãn ô đang chọn + nút × bỏ chọn. */}
      <div className="flex items-center justify-between">
        <SectionHeading>{isSubCell ? 'Ô con đang chọn' : 'Ô đang chọn'}</SectionHeading>
        <button
          type="button"
          onClick={onClose}
          aria-label="Bỏ chọn ô"
          className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md bg-[var(--color-bg)] text-base leading-none text-[var(--color-accent)]/70 hover:bg-[var(--color-accent)] hover:text-white transition"
        >
          ×
        </button>
      </div>

      {/* Tab Kiểu ô / Màu ô — full-width segmented. */}
      {showColorTab && (
        <div className="flex gap-0.5 rounded-lg bg-[var(--color-bg)] p-0.5">
          {tabBtn('type', 'Kiểu ô')}
          {tabBtn('color', 'Màu ô')}
        </div>
      )}

      {/* Lưới options của tab đang chọn — pill NGANG 2 cột (gọn, không kéo dài). */}
      {frozenByMerge ? (
        <div className="rounded-lg bg-[var(--color-accent-bg)] px-3 py-2 text-center">
          <p className="text-[11px] leading-relaxed text-[var(--color-accent)]/75">
            Ô này đang gộp lớn. Bấm <span className="font-semibold">Bỏ gộp</span> bên dưới
            để chỉnh kiểu &amp; màu từng ô.
          </p>
        </div>
      ) : mergedRestrict && isColor && currentType !== 'door' ? (
        // P61 — ô gộp đang "Mở (không hậu)": không có tấm để tô màu. Gợi ý đổi sang cánh.
        <div className="rounded-lg bg-[var(--color-accent-bg)] px-3 py-2 text-center">
          <p className="text-[11px] leading-relaxed text-[var(--color-accent)]/75">
            Ô gộp đang <span className="font-semibold">Mở (không hậu)</span> — chọn{' '}
            <span className="font-semibold">Cánh</span> ở tab Kiểu ô để tô màu.
          </p>
        </div>
      ) : locked && isColor ? (
        <p className="px-1 py-2 text-center text-[11px] text-[var(--color-accent)]/60">
          Ô mở-không-hậu không có vật liệu để đổi.
        </p>
      ) : (
        <div
          className={`grid grid-cols-2 gap-1 ${
            isColor ? 'max-h-[180px] overflow-y-auto pr-0.5' : ''
          }`}
        >
          {opts.map((o) => {
            const isBanned = !isColor && banned.includes(o.value);
            const isCurrent = o.value === current;
            const bg = bgOf(o.value);
            const reason = !isBanned
              ? null
              : isSubCell
                ? `Ô con sau khi chia không đủ kích thước cho "${o.label}"`
                : getDisabledReason(o.value, {
                    bannedByRow: bannedByRow.includes(o.value),
                    bannedByCol: bannedByCol.includes(o.value),
                    rowH,
                    colW,
                  });
            return (
              <button
                key={o.value}
                type="button"
                disabled={isBanned}
                onClick={() => onPick(o.value)}
                title={reason ?? o.label}
                className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left transition ${
                  isBanned
                    ? 'cursor-not-allowed opacity-40'
                    : isCurrent
                      ? 'bg-[var(--color-accent)] text-white shadow-sm'
                      : 'bg-[var(--color-bg)] text-[var(--color-accent)] hover:bg-[var(--color-accent-bg)]'
                }`}
              >
                <span
                  className="relative h-6 w-9 shrink-0 rounded border border-[var(--color-accent)]/25"
                  style={swatchCss(o.value, bg)}
                >
                  {!isColor && !isBanned && (
                    <CellSymbol type={o.value} stroke={pickContrast(bg)} />
                  )}
                </span>
                <span className="text-[10px] leading-tight">{o.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Bố cục: nhãn trái + control phải (gọn). Chia 2 nút · Gộp D-pad nhỏ · Bỏ gộp. */}
      {(hasSplit || hasMerge || onUnmerge) && (
        <div className="flex flex-col gap-2 border-t border-[var(--color-accent)]/12 pt-2">
          {hasSplit && (
            <div className="flex items-center gap-2">
              <span className="w-8 shrink-0 text-[11px] text-[var(--color-accent)]/55">Chia</span>
              <div className="flex flex-1 gap-1">
                {segBtn(
                  'split-v',
                  <><SplitVIcon /><span>Dọc</span></>,
                  splitVTitle,
                  () => onSplitVertical?.(),
                  !onSplitVertical,
                )}
                {segBtn(
                  'split-h',
                  <><SplitHIcon /><span>Ngang</span></>,
                  splitHTitle,
                  () => onSplitHorizontal?.(),
                  !onSplitHorizontal,
                )}
              </div>
            </div>
          )}
          {hasMerge && (
            <div className="flex items-center gap-2">
              <span className="w-8 shrink-0 text-[11px] text-[var(--color-accent)]/55">Gộp</span>
              {/* D-pad 3×3 thu nhỏ: mũi tên 4 hướng quanh ô tâm; hướng gộp được thì sáng. */}
              <div className="grid w-[100px] grid-cols-3 gap-1">
                <span />
                {dpadBtn(onMergeUp, 'up', mergeUpTitle)}
                <span />
                {dpadBtn(onMergeLeft, 'left', mergeLeftTitle)}
                <span className="flex aspect-square items-center justify-center rounded-md border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10">
                  <span className="h-3 w-3 rounded-sm bg-[var(--color-accent)]/55" />
                </span>
                {dpadBtn(onMergeRight, 'right', mergeRightTitle)}
                <span />
                {dpadBtn(onMergeDown, 'down', mergeDownTitle)}
                <span />
              </div>
            </div>
          )}
          {onUnmerge && (
            <button
              type="button"
              onClick={onUnmerge}
              title={unmergeTitle}
              className="w-full rounded-lg bg-[var(--color-bg)] px-2 py-1.5 text-[11px] font-medium tracking-wide text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white transition"
            >
              ⊟ Bỏ gộp ô
            </button>
          )}
        </div>
      )}
    </SectionCard>
  );
}

/**
 * Núm số: thanh trượt + ô NHẬP TAY (gõ số trực tiếp) + ghi chú min–max.
 * Gõ số rồi rời ô / nhấn Enter mới chốt: làm tròn theo step, kẹp trong [min, max].
 */
function NumberControl({
  param,
  value,
  onChange,
}: {
  param: Parameter;
  value: number | string;
  onChange: (id: string, value: number | string) => void;
}) {
  const min = param.min ?? 0;
  const max = param.max ?? 0;
  const step = param.step && param.step > 0 ? param.step : 1;
  const num = typeof value === 'number' ? value : Number(value);

  // Ô nhập giữ state CHỮ riêng để khách gõ tự do; chỉ chốt khi blur / Enter.
  const [text, setText] = useState(() => String(num));
  // P54f: cờ ĐANG GÕ. Khi ô đang focus, KHÔNG để giá trị ngoài (slider/preset/áp-sống)
  // ghi đè chữ → gõ số nhiều chữ trên mobile không bị reset giữa chừng ("nhảy").
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!focusedRef.current) setText(String(num));
  }, [num]);

  // P39: THROTTLE slider theo khung hình (~60fps) khi param.throttle bật. Kéo Tổng
  // rộng bắn hàng trăm onChange/giây → gom về ≤1 lần/khung → dựng lại 3D ít hơn nhiều
  // (hết lag). Giá trị CUỐI luôn được flush (rAF kế tiếp đọc pendingRef mới nhất).
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<number | null>(null);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null); // P54e: debounce áp ô nhập
  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (debRef.current != null) clearTimeout(debRef.current);
    },
    [],
  );
  const emitSlider = (val: number) => {
    if (!param.throttle) {
      onChange(param.id, val);
      return;
    }
    pendingRef.current = val;
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (pendingRef.current != null) {
          onChange(param.id, pendingRef.current);
          pendingRef.current = null;
        }
      });
    }
  };

  // P54f: ÁP-SỐNG khi đang gõ (debounce) — chỉ đổi hình học (onChange), KHÔNG đụng chữ
  // trong ô, để gõ tiếp số nhiều chữ mà không bị nhảy. Số DƯỚI min coi như đang gõ dở →
  // chưa áp (tránh tủ co về min giữa chừng); chỉ kẹp TRẦN (max) khi áp sống.
  const applyVal = (t: string) => {
    if (t.trim() === '' || !Number.isFinite(Number(t))) return;
    const n = Number(t);
    if (n < min) return;
    const snapped = Math.round((n - min) / step) * step + min;
    const clamped = Math.min(snapped, max);
    if (clamped !== num) onChange(param.id, clamped);
  };
  // Blur / Enter: CHỐT cuối — kẹp đủ min↔max + đồng bộ chữ về giá trị hợp lệ.
  const commitVal = (t: string) => {
    focusedRef.current = false;
    if (debRef.current != null) {
      clearTimeout(debRef.current);
      debRef.current = null;
    }
    if (t.trim() === '' || !Number.isFinite(Number(t))) {
      setText(String(num)); // gõ rỗng / không phải số → trả lại giá trị cũ
      return;
    }
    const snapped = Math.round((Number(t) - min) / step) * step + min;
    const clamped = Math.min(Math.max(snapped, min), max);
    setText(String(clamped));
    if (clamped !== num) onChange(param.id, clamped);
  };
  // Gõ: cập nhật chữ + TỰ ÁP sau 0.7s ngừng gõ → mobile khỏi phải bấm ra ngoài màn hình.
  const onText = (t: string) => {
    setText(t);
    if (debRef.current != null) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => applyVal(t), 700);
  };

  // P17: READ-ONLY → dòng số tĩnh (label + giá trị), KHÔNG slider/input. Dùng cho
  // tổng = Σ ô ở manual mode. Sạch, không phải slider xám (khác P16).
  if (param.readonly) {
    return (
      <div className="flex items-baseline justify-between gap-2 py-0.5">
        <label className="text-xs md:text-sm font-medium text-[var(--color-accent)]/70 font-viet">
          {param.label}
        </label>
        <span className="text-sm md:text-base font-semibold tabular-nums text-[var(--color-accent)]">
          {Math.round(num).toLocaleString('vi-VN')}
          <span className="ml-1 text-[10px] font-normal text-[var(--color-accent)]/50">
            {param.unit} · = tổng các ô
          </span>
        </span>
      </div>
    );
  }

  // P17: SEGMENTED 3 nấc → render hàng nút thay slider (vd chiều cao tầng 15/30/45cm).
  if (param.steps && param.steps.length > 0) {
    const snappedCur = param.steps.reduce(
      (best, s) => (Math.abs(s - num) < Math.abs(best - num) ? s : best),
      param.steps[0],
    );
    return (
      <div>
        <div className="mb-1 md:mb-2 flex items-baseline justify-between gap-2">
          <label className="text-xs md:text-sm font-medium text-[var(--color-accent)] font-viet">
            {param.label}
          </label>
        </div>
        <Segmented
          numeric
          options={param.steps.map((s) => ({ value: String(s), label: `${Math.round(s / 10)} cm` }))}
          value={String(snappedCur)}
          onChange={(v) => onChange(param.id, Number(v))}
          ariaLabel={param.label}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 md:mb-2 flex items-baseline justify-between gap-2">
        <label className="text-xs md:text-sm font-medium text-[var(--color-accent)] font-viet">
          {param.label}
        </label>
        <span className="flex items-center gap-1.5">
          {param.sliderOnly ? (
            // P36 v3: CHỈ slider — hiện giá trị read-only (gõ số không tương tác 3d realtime).
            <span className="text-xs md:text-sm tabular-nums text-accent font-semibold">
              {Math.round(num).toLocaleString('vi-VN')}
            </span>
          ) : (
            <input
              type="text"
              inputMode="numeric"
              enterKeyHint="done"
              aria-label={`${param.label} — nhập số`}
              // P54e: text-[16px] ở mobile → iOS Chrome KHÔNG auto-zoom khi focus (<16px mới zoom).
              className="w-[60px] md:w-[56px] bg-[var(--color-accent-bg)] border border-[var(--color-accent)]/20 rounded-md px-2 py-1 text-center text-[16px] md:text-sm tabular-nums text-accent font-medium focus:border-[var(--color-accent)] focus:bg-[var(--color-bg)] focus:outline-none max-md:min-h-[32px] transition-colors"
              value={text}
              onFocus={() => {
                focusedRef.current = true;
              }}
              onChange={(e) => onText(e.target.value)}
              onBlur={() => commitVal(text)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
            />
          )}
          {param.unit && (
            <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-accent)]/60 font-medium shrink-0">
              {param.unit}
            </span>
          )}
        </span>
      </div>
      <input
        type="range"
        className="ke-slider"
        min={min}
        max={max}
        step={step}
        value={num}
        onChange={(e) => emitSlider(Number(e.target.value))}
      />
      <p className="mt-0.5 md:mt-1.5 text-[10px] uppercase tracking-[0.15em] tabular-nums text-[var(--color-accent)]/50 font-medium">
        {min} — {max}{param.unit ? ` ${param.unit}` : ''}
      </p>
    </div>
  );
}

// initialValues?: Partial<ParamValues> — additive, S5 (preset library): nếu truyền,
// merge ĐÈ lên default của dna.parameters trước khi normalize. Sản phẩm cũ KHÔNG
// truyền → dùng nguyên default như cũ (engine bất biến với cách dùng cũ).
//
// mode?: 4 chế độ Configurator:
//  - 'public' (default cho ke.maume.asia /design): user end view — sidebar
//    đầy đủ controls, TotalPriceOnly (1 dòng giá), nút "Đặt hàng". Ẩn hết
//    breakdown / cutlist / BOM (chỉ admin thấy).
//  - 'interactive': dev/founder testing — như public, có thể override qua
//    ?mode=interactive nếu cần thử nghiệm.
//  - 'screenshot': capture thumbnail — ẩn sidebar/dimensions/ground/wall/orbit,
//    background trắng, dpr=2, 3-point lighting. Bbox crop cabinet pixel.
//  - 'admin': full UI + PricePanel breakdown + CutlistPanel + "Lưu preset"
//    button (wire tới maume API). Dùng cho founder admin.maume.asia/ke.
//
// onSavePreset (Phase A→C): callback khi click "Lưu preset" trong admin mode.
// Phase A chỉ stub; Phase C wire vào maume API /api/admin/ke-presets.
export function Configurator({
  dna,
  initialValues: override,
  mode = 'interactive',
  onSavePreset,
  screenshotAngle = 'iso-front-right',
  presetMeta,
  priceConfig,
  enabledMaterials,
  homeHref,
}: {
  dna: ProductDNA;
  initialValues?: Partial<ParamValues>;
  mode?: 'interactive' | 'screenshot' | 'admin' | 'public' | 'record';
  onSavePreset?: (values: ParamValues) => void | Promise<void>;
  /** Chỉ áp dụng khi mode='screenshot'. 3 góc cho thumbnail. */
  screenshotAngle?: 'iso-front-right' | 'front' | 'iso-front-left';
  /** Optional metadata khi load preset qua ?preset=<slug>. Pass vào order. */
  presetMeta?: { slug?: string; name?: string };
  /** (S9, tùy chọn) Catalog đơn giá bơm từ KV — override dna.priceConfig. */
  priceConfig?: PriceConfig;
  /** (tùy chọn) id màu ("catalog/id") được bật cho sản phẩm này — màu ngoài
   *  danh sách bị ẩn khỏi bảng chọn. Vắng → hiện mọi màu (tương thích ngược). */
  enabledMaterials?: string[];
  /** (tùy chọn) Link "về trang chủ" — desktop hiện trong header sidebar, mobile
   *  hiện nút tròn nổi góc trên-trái viewport. Vắng → không hiện. */
  homeHref?: string;
}) {
  // Record (clip 15s): DÙNG CHUNG toàn bộ render "studio" của screenshot (PostFX
  // GTAO+SMAA, lighting studio, ground bóng mềm, preserveDrawingBuffer, ẩn UI) →
  // `isShot` gộp cả 'record'. Chỉ rẽ nhánh riêng ở 3 chỗ: camera (orbit liên tục),
  // trạng thái mở cánh/kéo (làn sóng) và TẮT staging props (tránh nhấp nháy khi biến hình).
  const isRecord = mode === 'record';
  const isShot = mode === 'screenshot' || isRecord;
  const isAdmin = mode === 'admin';
  // ExportConfigButton đã REMOVED (founder không còn dùng dev tool này — đã có
  // proper admin Save preset flow tại admin.maume.asia/ke).
  // "Lưu preset" button chỉ admin (sau Phase C wire vào API).
  const showSavePreset = isAdmin;
  // "Đặt hàng" button cho khách hàng end-user — interactive + public, NOT screenshot/admin.
  const showOrderButton = !isShot && !isAdmin;
  // P28 — UNDO: state config gói trong { values, past }. `setValues` GIỮ NGUYÊN
  // tên + chữ ký (drop-in cho MỌI call site cũ) nhưng giờ tự đẩy trạng thái CŨ
  // vào `past` (cap 50 bước) mỗi lần đổi → undoConfig() lùi 1 bước. Mọi read
  // `values` không đổi (= hist.values).
  const [hist, setHist] = useState<{ values: ParamValues; past: ParamValues[] }>(() => {
    const init = initialValues(dna.parameters);
    // Merge bỏ qua key có value undefined (Partial<ParamValues> cho phép undefined).
    let merged: ParamValues = init;
    if (override) {
      merged = { ...init };
      for (const k in override) {
        const v = override[k];
        if (v !== undefined) merged[k] = v;
      }
    }
    const normalized = dna.normalizeValues ? dna.normalizeValues(merged) : merged;
    return { values: normalized, past: [] };
  });
  const values = hist.values;
  const canUndo = hist.past.length > 0;
  const setValues = useCallback(
    (updater: ParamValues | ((prev: ParamValues) => ParamValues)) => {
      setHist((h) => {
        const next =
          typeof updater === 'function'
            ? (updater as (p: ParamValues) => ParamValues)(h.values)
            : updater;
        if (next === h.values) return h; // no-op → KHÔNG ghi history
        return { values: next, past: [...h.past, h.values].slice(-50) };
      });
    },
    [],
  );

  // Redesign 2026-05: bỏ wizard + drawer kéo. Layout cố định — 3D LUÔN hiện,
  // panel chỉ chứa Kích thước. Thuộc tính ô + màu thao tác THẲNG trên 3D.
  // S7 (2026-05-27): bỏ EditModeToggle bên ngoài, gộp cả 2 tab (Kiểu/Màu) vào
  // CellBar (popup neo bottom) — switch tab giữ ô đang chọn.
  // Mobile: panel hiện dạng tab ngang (Rộng/Cao/Sâu/Vật liệu khung) — click
  // tab nào chỉnh nhóm đó, giảm scroll. Desktop bỏ qua (mọi nhóm xếp dọc).
  const [activeTab, setActiveTab] = useState(0);
  // cellPopup: ô đang mở popup chọn (null = không mở). `subIdx` khi user click
  // vào sub-cell của ô đã split (0 = L/B, 1 = R/T) — popup edits sub-cell type
  // thay vì cell type primitive.
  const [cellPopup, setCellPopup] = useState<{ row: number; col: number; subIdx?: 0 | 1 } | null>(
    null,
  );
  // cellTab: tab hiện trong CellBar — lifted ở đây để animation "mở cánh"
  // (open=1 ở tab Kiểu, open=0 ở tab Màu) đồng bộ với UI. Reset về 'type'
  // mỗi khi user click ô mới.
  const [cellTab, setCellTab] = useState<'type' | 'color'>('type');
  // P36: rowSelect — chỉ số TẦNG đang chọn để chỉnh cao riêng (chỉ dùng ở tab
  // "Chiều cao"; null = không chọn). Tách khỏi cellPopup vì tab Chiều cao thao
  // tác theo HÀNG, tab Ô tủ thao tác theo Ô.
  const [rowSelect, setRowSelect] = useState<number | null>(null);
  // P36 v2: colSelect — chỉ số CỘT đang chọn để chỉnh rộng (chỉ ở tab Chiều rộng).
  const [colSelect, setColSelect] = useState<number | null>(null);

  // P29: bật/tắt hiển thị 3 trục KÍCH THƯỚC TỔNG trên 3D (mặc định hiện).
  const [showTotalDims, setShowTotalDims] = useState(true);
  // P28: HOÀN TÁC — lùi 1 bước config (đóng popup ô vì cấu trúc có thể đổi).
  const undoConfig = useCallback(() => {
    setHist((h) =>
      h.past.length === 0
        ? h
        : { values: h.past[h.past.length - 1], past: h.past.slice(0, -1) },
    );
    setCellPopup(null);
    setRowSelect(null); // P36: đóng cả popup cao-tầng
    setColSelect(null); // P36 v2: đóng cả popup rộng-cột
  }, []);

  // Danh sách núm: động (resolveControls) nếu DNA có, tĩnh nếu không.
  // Truyền `ctx.materialLabels` từ priceConfig → DNA tự gán label vật liệu từ
  // catalog (single source). Không truyền override sau ở đây nữa — DNA quyết.
  // enabledMaterials (nếu có): ẩn option màu ("catalog/id") không được bật.
  // P49 — ctx.enabledEdgeBands: loại dán cạnh admin BẬT (priceConfig.edgeBands[t].enabled)
  // → resolveControls chỉ hiện các loại này trong option "Dán cạnh".
  const controls = useMemo(() => {
    const ctx: ResolveContext | undefined = priceConfig
      ? {
          materialLabels: priceConfig.materialLabels,
          enabledEdgeBands: priceConfig.edgeBands
            ? (Object.keys(priceConfig.edgeBands) as EdgeBandingType[]).filter(
                (t) => priceConfig.edgeBands![t]?.enabled,
              )
            : undefined,
        }
      : undefined;
    const raw = dna.resolveControls?.(values, ctx) ?? dna.parameters;
    if (!enabledMaterials) return raw;
    const allow = new Set(enabledMaterials);
    return raw.map((p) => {
      if (!p.options) return p;
      const current = values[p.id];
      const opts = p.options.filter(
        (o) => !o.value.includes('/') || allow.has(o.value) || o.value === current,
      );
      return opts.length === p.options.length ? p : { ...p, options: opts };
    });
  }, [dna, values, enabledMaterials, priceConfig?.materialLabels, priceConfig?.edgeBands]);
  // Panel CHỈ render núm KHÔNG phải cellgrid (kích thước + vật liệu khung).
  // 2 núm cellgrid (cells/cellColors) vẫn nằm trong `controls` → vẫn feed
  // intentValues/build; chỉ KHÔNG vẽ ở panel — thao tác thẳng trên 3D.
  const sections = useMemo(
    // P45: ẩn control adminOnly (vd "Loại tay nắm") khi KHÔNG ở admin mode →
    // khách không thấy; giá trị vẫn nằm trong values nên preset round-trip bình thường.
    () => groupControls(controls.filter((c) => c.type !== 'cellgrid' && (isAdmin || !c.adminOnly))),
    [controls, isAdmin],
  );
  // P36: tab đang mở quyết định 3D cho phép thao tác gì khi click ô:
  //  - 'Ô tủ'      → mở CellBar (loại/màu/gộp/chia).
  //  - 'Chiều cao' → chọn TẦNG để chỉnh cao riêng.
  //  - khác        → chỉ xoay/zoom, click KHÔNG làm gì.
  const activeGroup = sections[activeTab]?.group;
  const mode3D: 'cells' | 'rows' | 'cols' | 'view' =
    activeGroup === 'Ô tủ'
      ? 'cells'
      : activeGroup === 'Chiều cao'
        ? 'rows'
        : activeGroup === 'Chiều rộng'
          ? 'cols'
          : 'view';
  // Đổi tab → đóng mọi popup (tránh popup treo sai ngữ cảnh).
  const selectTab = useCallback((i: number) => {
    setActiveTab(i);
    setCellPopup(null);
    setRowSelect(null);
    setColSelect(null);
  }, []);
  // P36: nấc cao hợp lệ cho từng tầng (DNA-driven) — popup "chỉnh cao tầng" trên 3D.
  const rowSteps = useMemo(
    () => controls.find((c) => c.id === 'height')?.rowSteps ?? [],
    [controls],
  );
  // P36 v2: [min,max] rộng cột (DNA-driven) — popup "chỉnh rộng cột" trên 3D.
  const colRange = useMemo(
    () => controls.find((c) => c.id === 'width')?.colRange ?? null,
    [controls],
  );
  // 2 núm cellgrid tách riêng cho lớp tương tác 3D — CellBar nhận cả 2 để
  // switch tab Kiểu/Màu trong cùng popup mà không cần state ngoài.
  const cellsParam = useMemo(() => controls.find((c) => c.id === 'cells'), [controls]);
  const colorsParam = useMemo(() => controls.find((c) => c.id === 'cellColors'), [controls]);

  // P34: cấu hình camera screenshot — tính 1 lần, dùng cho Canvas prop (fov/near/far
  // ban đầu) VÀ rig (set position mỗi frame). ⚠️ R3F chỉ áp `camera` prop lúc MOUNT;
  // đổi screenshotAngle KHÔNG reposition → rig phải tự set position theo góc (nếu
  // không, chụp 3 góc ra cùng 1 ảnh). Memo theo dims + góc.
  const shotCam = useMemo(
    () =>
      mode === 'screenshot'
        ? computeScreenshotCamera(
            Number(values.width ?? 1200),
            Number(values.height ?? 1800),
            Number(values.depth ?? 350),
            screenshotAngle,
          )
        : null,
    [mode, values.width, values.height, values.depth, screenshotAngle],
  );

  // ── RECORD MODE (clip 15s) ────────────────────────────────────────────────
  // "Director" ngoài bơm camera + trạng thái mở qua window.__keApplyFrame (effect
  // bên dưới) → lưu React state → set-then-capture: đổi state → re-render → đợi
  // 1-2 frame → canvas.toDataURL(). KHÔNG cần realtime nên state là đủ & tất định.
  const [recCam, setRecCam] = useState<RecordCam>({ azimuthDeg: 22, distScale: 1.05, fov: 18 });
  const [recOpen, setRecOpen] = useState<RecordOpen>({ kind: 'none' });
  const [, bumpFrame] = useState(0); // ép re-render mỗi __keApplyFrame (kể cả khi chỉ đổi tint module-level)
  const recordShotCam = useMemo(
    () =>
      isRecord
        ? computeRecordCamera(
            Number(values.width ?? 1200),
            Number(values.height ?? 1800),
            Number(values.depth ?? 350),
            recCam,
          )
        : null,
    [isRecord, values.width, values.height, values.depth, recCam],
  );
  // Camera đang dùng để vẽ: record → orbit liên tục; screenshot → 3 góc cố định.
  const activeShotCam = isRecord ? recordShotCam : shotCam;

  // Cài "director API" lên window CHỈ khi record mode (clip). Script Playwright
  // bên ngoài gọi: __keApplyFrame(frame) đặt 1 frame (values + camera + open),
  // rồi __keCaptureFrame() trả PNG dataURL của canvas. __keReady báo đã mount.
  useEffect(() => {
    if (!isRecord) return;
    const w = window as unknown as KeRecordWindow;
    w.__keApplyFrame = (frame: RecordFrame) => {
      if (frame.values) {
        setValues((prev) => {
          const merged: ParamValues = { ...prev };
          // Record/clip: key per-cột/per-tầng (colW_/tierH_/colSet*) do TỪNG frame quyết
          // toàn bộ → xoá cũ trước khi merge, tránh rớt lại từ scene trước (manual→even).
          for (const k in merged)
            if (/^(colW_|tierH_|colSet_|colSetW_)/.test(k)) delete merged[k];
          const fv = frame.values!;
          for (const k in fv) {
            const v = fv[k];
            if (v !== undefined) merged[k] = v;
          }
          return dna.normalizeValues ? dna.normalizeValues(merged) : merged;
        });
      }
      if (frame.cam) setRecCam((p) => ({ ...p, ...frame.cam }));
      if (frame.open) setRecOpen(frame.open);
      if (frame.tint !== undefined) setRecordTint(frame.tint); // override màu thân kệ (module-level)
      bumpFrame((n) => n + 1); // luôn re-render → PartMesh đọc tint mới
    };
    w.__keCaptureFrame = () => {
      const c = document.querySelector('canvas') as HTMLCanvasElement | null;
      return c ? c.toDataURL('image/png') : '';
    };
    w.__keReady = true;
    return () => {
      delete w.__keApplyFrame;
      delete w.__keCaptureFrame;
      delete w.__keReady;
      setRecordTint(null);
    };
  }, [isRecord, dna, setValues]);
  // Migrate `cells/cellColors` → list `CellBlock` để CellBar/Split/Sub-cell dùng.
  // Phải declare TRƯỚC cellHitBoxes vì hitboxes phụ thuộc cellBlocks (sub-cell hitbox).
  //
  // P4.12: FILL MISSING CELLS. Khi user tăng `columns`/`rows`, ParamValues.cells
  // có thể chỉ chứa blocks cho old size → cells mới không có block. Fix: thêm
  // 1×1 default blocks cho mọi (r, c) không được phủ. Đảm bảo cellBoxes loop
  // có hitbox cho mọi cell trong grid.
  const fillMissingCells = (
    blocks: import('./cellgrid').CellBlock[],
    rowsN: number,
    colsN: number,
    fb: string,
  ): import('./cellgrid').CellBlock[] => {
    const covered = new Set<string>();
    for (const b of blocks) {
      for (let dr = 0; dr < b.rs; dr++) {
        for (let dc = 0; dc < b.cs; dc++) {
          covered.add(`${b.r + dr},${b.c + dc}`);
        }
      }
    }
    const out = blocks.slice();
    for (let r = 0; r < rowsN; r++) {
      for (let c = 0; c < colsN; c++) {
        if (!covered.has(`${r},${c}`)) {
          out.push({ r, c, rs: 1, cs: 1, t: fb });
        }
      }
    }
    return out;
  };
  const cellBlocks = useMemo(() => {
    if (!cellsParam) return [];
    const rowsN = cellsParam.gridRows ?? 0;
    const colsN = cellsParam.gridCols ?? 0;
    const fb = cellsParam.options?.[0]?.value ?? '';
    const blocks = cellsToBlocks(
      String(values[cellsParam.id] ?? cellsParam.default ?? ''),
      rowsN,
      colsN,
      fb,
    );
    return fillMissingCells(blocks, rowsN, colsN, fb);
  }, [cellsParam, values]);
  const colorBlocks = useMemo(() => {
    if (!colorsParam) return [];
    const rowsN = colorsParam.gridRows ?? 0;
    const colsN = colorsParam.gridCols ?? 0;
    const fb = colorsParam.options?.[0]?.value ?? '';
    const blocks = cellsToBlocks(
      String(values[colorsParam.id] ?? colorsParam.default ?? ''),
      rowsN,
      colsN,
      fb,
    );
    return fillMissingCells(blocks, rowsN, colsN, fb);
  }, [colorsParam, values]);
  // Hộp 3D vô hình phủ mỗi ô — bắt click chọn ô (kể cả sub-cell nếu ô đã split).
  const cellHitBoxes = useMemo(
    () => cellBoxes(cellsParam, Number(values.depth ?? 350), cellBlocks),
    [cellsParam, values.depth, cellBlocks],
  );
  // Ô đang mở popup → hộp 3D + giá trị hiện tại (kiểu & màu) của ô đó.
  // Với sub-cell click: match cả subIdx.
  const popupBox = cellPopup
    ? cellHitBoxes.find(
        (b) =>
          b.row === cellPopup.row &&
          b.col === cellPopup.col &&
          (b.subIdx ?? null) === (cellPopup.subIdx ?? null),
      )
    : undefined;
  // `popupCurrent*` resolve sub-cell type khi cellPopup.subIdx có; else primitive.
  /** Helper: lấy type của 1 (sub-)cell từ blocks list. */
  const resolveCellType = (
    blocks: typeof cellBlocks,
    row: number,
    col: number,
    subIdx: 0 | 1 | undefined,
    fallback: string,
  ): string => {
    const block = findBlockAt(blocks, row, col);
    if (!block) return fallback;
    const parsed = parseSubSplit(block.t);
    if (parsed.primitive !== undefined) return parsed.primitive;
    // Has sub-split: nếu subIdx undefined → primitive view (impossible khi UI
    // expand sub hitboxes). Trả về sub đầu tiên cho safety.
    return parsed.split.subs[subIdx ?? 0];
  };
  const popupCurrentType =
    cellPopup && cellsParam
      ? resolveCellType(
          cellBlocks,
          cellPopup.row,
          cellPopup.col,
          cellPopup.subIdx,
          cellsParam.options?.[0]?.value ?? '',
        )
      : '';
  const popupCurrentColor =
    cellPopup && colorsParam
      ? resolveCellType(
          colorBlocks,
          cellPopup.row,
          cellPopup.col,
          cellPopup.subIdx,
          colorsParam.options?.[0]?.value ?? '',
        )
      : '';
  // INTENT values — cellgrid CHỈ pad size, KHÔNG áp disabled rules. Để UI lưới hiển
  // thị đúng cái user đã chọn, KỂ CẢ khi kích thước hiện tại không cho phép. Khi user
  // kéo kích thước về lại trị hợp lệ, ô tự "hiện lại" loại cũ (vd ngăn kéo) — vì
  // values.cells lưu trữ ý định gốc, KHÔNG bị ghi đè bởi reconcile.
  const intentValues = useMemo(() => {
    // P36: seed từ TẤT CẢ values (gồm rows, tierH_r... KHÔNG còn là control) rồi
    // mới override theo control — nếu không, build() thiếu rows/tierH → NaN.
    const full: ParamValues = { ...values };
    for (const control of controls) {
      if (control.type === 'cellgrid') {
        const raw = String(values[control.id] ?? control.default);
        // P3: blocks format không qua reconcile (parseCellGrid sẽ mangle), pass-through.
        // dna.build sẽ parse blocks và apply fallback rule per-cell trong cellType().
        if (isBlocksValue(raw)) {
          full[control.id] = raw;
        } else {
          const grid = reconcileCellGrid(
            raw,
            control.gridRows ?? 0,
            control.gridCols ?? 0,
            control.options?.[0]?.value ?? '',
            // KHÔNG truyền disabledByRow/Col → chỉ pad size, giữ value gốc.
          );
          full[control.id] = encodeCellGrid(grid);
        }
      } else {
        full[control.id] = values[control.id] ?? control.default;
      }
    }
    return full;
  }, [controls, values]);

  // EFFECTIVE values — cellgrid áp disabled rules + cellFallbackMap. Dùng cho build()
  // → 3D & cutlist phản ánh đúng những gì xưởng sẽ làm (vd ngăn kéo vi phạm → cánh).
  // P3: blocks format pass-through (dna.build apply per-cell fallback trong cellType).
  const resolvedValues = useMemo(() => {
    // P36: seed từ TẤT CẢ values (rows, tierH_r... không còn là control) → build()
    // mới đủ dữ liệu; nếu chỉ lấy từ controls sẽ thiếu rows/tierH → NaN.
    const full: ParamValues = { ...values };
    for (const control of controls) {
      if (control.type === 'cellgrid') {
        const raw = String(values[control.id] ?? control.default);
        if (isBlocksValue(raw)) {
          full[control.id] = raw;
        } else {
          const grid = reconcileCellGrid(
            raw,
            control.gridRows ?? 0,
            control.gridCols ?? 0,
            control.options?.[0]?.value ?? '',
            control.disabledByRow,
            control.disabledByCol,
            control.cellFallbackMap,
          );
          full[control.id] = encodeCellGrid(grid);
        }
      } else {
        full[control.id] = values[control.id] ?? control.default;
      }
    }
    return full;
  }, [controls, values]);

  // resolvedValues → build() → giá + bảng cắt. Mỗi bước chỉ tính lại khi input đổi.
  const build = useMemo(() => dna.build(resolvedValues), [dna, resolvedValues]);
  // priceConfig (S9): route bơm catalog từ KV thì dùng nó, không thì dna.priceConfig.
  const effectivePriceConfig = priceConfig ?? dna.priceConfig;
  const price = useMemo(
    () => computePrice(build, effectivePriceConfig),
    [build, effectivePriceConfig],
  );
  const cutlist = useMemo(
    () => buildCutlist(build, effectivePriceConfig),
    [build, effectivePriceConfig],
  );
  // Cảnh báo (vd tổng kích thước vượt giới hạn) — DNA tự tính, Configurator chỉ hiện.
  const warnings = useMemo(() => dna.getWarnings?.(resolvedValues) ?? [], [dna, resolvedValues]);
  // Map "catalog/id" → tên vật liệu cho cột Vật liệu bảng cắt. Đọc từ `controls`
  // (đã resolve qua ctx) → SINGLE SOURCE: chuỗi catalog → resolveControls →
  // controls.options → đây. Không còn override/fallback ở Configurator.
  const materialLabels = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of controls) for (const o of p.options ?? []) m[o.value] = o.label;
    return m;
  }, [controls]);

  const setParam = (id: string, value: number | string) =>
    setValues((prev) => {
      // P36: kéo thanh TỔNG chiều cao → gắn cờ tạm `__heightIntent='total'` để
      // normalizeValues CHIA ĐỀU target ra các tầng (bám nấc + tự co/giãn số tầng)
      // thay vì tính tổng từ tầng. Cờ luôn bị xoá trong normalizeValues (không persist).
      // P40: chỉnh RIÊNG 1 cột (slider cột) → GHI NHỚ rộng cột đó vào `colSetW_{p}`
      // (neo theo vị trí). Accordion kéo tổng giữ/khôi phục cột này từ trí nhớ.
      const next: ParamValues =
        id === 'height'
          ? { ...prev, height: value, __heightIntent: 'total' }
          : id === 'width'
            ? { ...prev, width: value, __widthIntent: 'total' }
            : id.startsWith('colW_')
              ? { ...prev, [id]: value, [`colSetW_${id.slice(5)}`]: value }
              : id.startsWith('tierH_')
                // P43: chỉnh RIÊNG cao 1 tầng → ghi nhớ vào tierSetH_{r} (tầng đông cứng,
                // accordion kéo tổng bỏ qua nó). slice(6) bỏ 'tierH_'.
                ? { ...prev, [id]: value, [`tierSetH_${id.slice(6)}`]: value }
                : { ...prev, [id]: value };
      return dna.normalizeValues ? dna.normalizeValues(next) : next;
    });

  // setCell — cập nhật 1 ô (hoặc sub-cell) trong lưới cellgrid (cells / cellColors).
  // P3 v2: subIdx có → setSubCellType (chỉ đổi sub-cell L/R/B/T, KHÔNG đụng sub kia);
  // subIdx undefined → đổi primitive type cho cả block (cell chưa sub-split).
  // Nếu sau update list vẫn 1×1 primitive uniform → ghi legacy format (Sheet log
  // không thấy format mới cho đơn chưa split/merge).
  const setCell = (
    paramId: string,
    row: number,
    col: number,
    next: string,
    subIdx?: 0 | 1,
  ) => {
    setValues((prev) => {
      const raw = String(prev[paramId] ?? '');
      const control = controls.find((c) => c.id === paramId);
      const rowsCount = control?.gridRows ?? 0;
      const colsCount = control?.gridCols ?? 0;
      const fallback = control?.options?.[0]?.value ?? '';
      // FIX (P35): fill ô thiếu — chuỗi cells có thể CHƯA phủ hết grid khi user
      // tăng cột/tầng (chuỗi gốc không tự nở). Đồng bộ với cellBlocks hiển thị.
      const blocks = fillMissingCells(
        cellsToBlocks(raw, rowsCount, colsCount, fallback),
        rowsCount,
        colsCount,
        fallback,
      );
      let updatedBlocks: typeof blocks;
      if (subIdx !== undefined) {
        // Update 1 sub-cell qua setSubCellType (codec helper).
        updatedBlocks = setSubCellType(blocks, row, col, subIdx, next);
      } else {
        // Primitive cell update: tìm block và đổi t.
        const targetIdx = blocks.findIndex(
          (b) => row >= b.r && row < b.r + b.rs && col >= b.c && col < b.c + b.cs,
        );
        if (targetIdx >= 0) {
          updatedBlocks = blocks.map((b, i) => (i === targetIdx ? { ...b, t: next } : b));
        } else {
          // Cell mới (vd: user thêm tầng/cột → ô mới chưa có block trong list).
          // Append 1×1 block mới. KHÔNG dùng legacy parseCellGrid fallback vì
          // sẽ mangle nếu raw là blocks format (chứa '|', '>', '^').
          updatedBlocks = [...blocks, { r: row, c: col, rs: 1, cs: 1, t: next }];
        }
      }
      // Encode về legacy nếu mọi block đều 1×1 primitive (không sub-split).
      const allPrimitive = updatedBlocks.every((b) => !hasSubSplit(b.t));
      const updatedCellsValue =
        isUniformBlocks(updatedBlocks) && allPrimitive
          ? encodeCellGrid(
              Array.from({ length: rowsCount }, (_, r) =>
                Array.from({ length: colsCount }, (_, c) => {
                  const found = updatedBlocks.find((b) => b.r === r && b.c === c);
                  return found?.t ?? fallback;
                }),
              ),
            )
          : encodeBlocks(updatedBlocks);
      const updated = { ...prev, [paramId]: updatedCellsValue };
      return dna.normalizeValues ? dna.normalizeValues(updated) : updated;
    });
  };

  // splitCell — P3 v2 SPLIT INTRA-CELL: chèn 1 vách phụ vào ô [row, col] chia
  // thành 2 sub-cell. Outer grid KHÔNG đổi (rows/columns/colW/tierH giữ nguyên).
  // Sub-cell INHERIT type ô gốc (door → 2 door, drawer → 2 drawer, open-back →
  // 2 open-back) — user yêu cầu giữ thuộc tính ô. Đây là semantic "chia đôi"
  // trực giác (chia 1 ngăn kéo thành 2 ngăn kéo, chia 1 cánh thành 2 cánh).
  // Caller PHẢI đảm bảo:
  //  - block tại (row, col) là 1×1 primitive (chưa sub-split, không cross-merged)
  //  - sub-cell clear inner ≥ 150×150 + fit constraint theo type (UI check)
  // Cells + cellColors cùng topology → áp dụng splitBlockIntra cho cả 2.
  const splitCell = (row: number, col: number, axis: SplitAxis) => {
    if (!cellsParam) return;
    setValues((prev) => {
      const rowsCount = (prev.rows as number) ?? cellsParam.gridRows ?? 0;
      const colsCount = (prev.columns as number) ?? cellsParam.gridCols ?? 0;
      const fallback = cellsParam.options?.[0]?.value ?? 'open-back';
      // Cells: parent type = block.t hiện tại. Sub-cell INHERIT parent type.
      const cellsRaw = String(prev[cellsParam.id] ?? '');
      // FIX (P35): fill ô thiếu trước khi split — tránh splitBlockIntra throw khi
      // ô nằm ở cột/tầng mới thêm (chuỗi cells chưa phủ tới).
      const cellBlks = fillMissingCells(
        cellsToBlocks(cellsRaw, rowsCount, colsCount, fallback),
        rowsCount,
        colsCount,
        fallback,
      );
      const parentBlock = findBlockAt(cellBlks, row, col);
      const rawParentType = parentBlock?.t ?? fallback;
      // P22: sub-cell KHÔNG được 'open-nobk' (tấm hậu dùng chung cho cả cell).
      // Nếu ô gốc đang open-nobk → subs mặc định 'open-back' (có hậu).
      const inheritType = rawParentType === 'open-nobk' ? 'open-back' : rawParentType;
      // P23: nếu cánh/ngăn kéo KHÔNG vừa sub-cell sau khi chia → fallback subs
      // về 'open-back' (vẫn cho split, chỉ đổi loại). Dim sub-cell theo trục chia.
      const cw = cellsParam.colSizes?.[col] ?? 0;
      const ch = cellsParam.rowSizes?.[row] ?? 0;
      const SUB_T = 18;
      const subW = axis === 'vertical' ? (cw - SUB_T) / 2 : cw;
      const subH = axis === 'horizontal' ? (ch - SUB_T) / 2 : ch;
      const parentType = subCellTypeFits(inheritType, subW, subH, Number(prev.depth ?? 400))
        ? inheritType
        : 'open-back';
      const splitCellBlks = splitBlockIntra(cellBlks, row, col, axis, parentType);
      const updated: ParamValues = { ...prev, [cellsParam.id]: encodeBlocks(splitCellBlks) };
      // CellColors: cùng topology — mỗi sub-cell inherit COLOR của ô gốc.
      // Self-heal: nếu colorBlks không có block tại (row, col) (vd vì user mới
      // setCell type cho cell mới mà cellColors chưa kịp đồng bộ), auto-add
      // 1×1 block với colorFallback. Tránh splitBlockIntra throw → page crash.
      if (colorsParam) {
        const colorRaw = String(prev[colorsParam.id] ?? '');
        const colorFallback = colorsParam.options?.[0]?.value ?? 'frame';
        let colorBlks = fillMissingCells(
          cellsToBlocks(colorRaw, rowsCount, colsCount, colorFallback),
          rowsCount,
          colsCount,
          colorFallback,
        );
        if (!findBlockAt(colorBlks, row, col)) {
          colorBlks = [...colorBlks, { r: row, c: col, rs: 1, cs: 1, t: colorFallback }];
        }
        const parentColorBlock = findBlockAt(colorBlks, row, col);
        const parentColor = parentColorBlock?.t ?? colorFallback;
        const splitColorBlks = splitBlockIntra(colorBlks, row, col, axis, parentColor);
        updated[colorsParam.id] = encodeBlocks(splitColorBlks);
      }
      return dna.normalizeValues ? dna.normalizeValues(updated) : updated;
    });
  };

  // mergeCell — P4 MERGE. 2 mode tuỳ context:
  //  - subIdx defined → UNSPLIT sub-cell: bỏ vách phụ, giữ type của sub-cell user
  //    đang click (qua `keepIdx = subIdx`). Direction param chỉ để pick the
  //    "neighbor" sub trong block; engine không cần xài.
  //  - subIdx undefined → CROSS-GRID MERGE: gộp với ô outer adjacent theo direction.
  //    Yêu cầu axis-perpendicular size khớp + cả 2 đều primitive. Throw nếu fail.
  // Áp dụng đồng thời cells + cellColors (cùng topology).
  const mergeCell = (
    row: number,
    col: number,
    direction: MergeDirection,
    subIdx?: 0 | 1,
  ) => {
    if (!cellsParam) return;
    setValues((prev) => {
      const rowsCount = (prev.rows as number) ?? cellsParam.gridRows ?? 0;
      const colsCount = (prev.columns as number) ?? cellsParam.gridCols ?? 0;
      const fallback = cellsParam.options?.[0]?.value ?? 'open-back';
      const cellsRaw = String(prev[cellsParam.id] ?? '');
      // FIX (P35): fill ô thiếu — BUG chính. checkDir (cellBlocks đã fill) BẬT nút
      // Gộp, nhưng nếu láng giềng ở cột/tầng mới (chuỗi cells chưa phủ) thì
      // mergeBlocks throw "không có block" → catch → no-op. Fill để khớp checkDir.
      const cellBlks = fillMissingCells(
        cellsToBlocks(cellsRaw, rowsCount, colsCount, fallback),
        rowsCount,
        colsCount,
        fallback,
      );
      let newCellBlks: typeof cellBlks;
      let newColorBlks: typeof cellBlks | null = null;
      if (subIdx !== undefined) {
        // UNSPLIT: giữ type của sub-cell click.
        newCellBlks = unsplitBlockIntra(cellBlks, row, col, subIdx);
        if (colorsParam) {
          const colorRaw = String(prev[colorsParam.id] ?? '');
          const colorFallback = colorsParam.options?.[0]?.value ?? 'frame';
          let colorBlks = fillMissingCells(
            cellsToBlocks(colorRaw, rowsCount, colsCount, colorFallback),
            rowsCount,
            colsCount,
            colorFallback,
          );
          // Self-heal: nếu cellColors mất sync (block không có), add default.
          if (!findBlockAt(colorBlks, row, col)) {
            colorBlks = [...colorBlks, { r: row, c: col, rs: 1, cs: 1, t: colorFallback }];
          }
          newColorBlks = unsplitBlockIntra(colorBlks, row, col, subIdx);
        }
      } else {
        // CROSS-GRID MERGE: gộp với ô bên `direction`. KẾT QUẢ LUÔN open-nobk
        // (mở không hậu) + FRAME color — user yêu cầu: gộp 2 ô = tạo bay lớn
        // xuyên thấu, mất hậu + mất type cũ.
        try {
          newCellBlks = mergeBlocks(cellBlks, row, col, direction);
        } catch (e) {
          console.warn('[mergeCell] cells:', (e as Error).message);
          return prev; // no-op nếu fail
        }
        // Override result type: tìm block bao trùm (row, col) sau merge → 'open-nobk'.
        newCellBlks = newCellBlks.map((b) => {
          const inMerged =
            row >= b.r && row < b.r + b.rs && col >= b.c && col < b.c + b.cs;
          return inMerged ? { ...b, t: 'open-nobk' } : b;
        });
        if (colorsParam) {
          const colorRaw = String(prev[colorsParam.id] ?? '');
          const colorFallback = colorsParam.options?.[0]?.value ?? 'frame';
          let colorBlks = fillMissingCells(
            cellsToBlocks(colorRaw, rowsCount, colsCount, colorFallback),
            rowsCount,
            colsCount,
            colorFallback,
          );
          // Self-heal: ensure source + neighbor color blocks exist.
          if (!findBlockAt(colorBlks, row, col)) {
            colorBlks = [...colorBlks, { r: row, c: col, rs: 1, cs: 1, t: colorFallback }];
          }
          try {
            newColorBlks = mergeBlocks(colorBlks, row, col, direction);
          } catch {
            // Color không merge cùng cấu trúc (vd 2 color blocks có size khác nhau)
            // → vẫn override block tại (row,col) về FRAME cho khớp cells.
            newColorBlks = colorBlks;
          }
          // Override màu block bao trùm → FRAME (open-nobk không có hậu để màu hiển thị).
          newColorBlks = newColorBlks.map((b) => {
            const inMerged =
              row >= b.r && row < b.r + b.rs && col >= b.c && col < b.c + b.cs;
            return inMerged ? { ...b, t: colorFallback } : b;
          });
        }
      }
      // Encode: nếu mọi block 1×1 primitive (không sub-split) → legacy uniform;
      // else blocks. (single block với rs>1/cs>1 cũng dùng blocks format mới.)
      const encodeResult = (
        blks: typeof cellBlks,
        rowsN: number,
        colsN: number,
        fb: string,
      ): string => {
        const allPrimitive = blks.every((b) => !hasSubSplit(b.t));
        if (isUniformBlocks(blks) && allPrimitive) {
          return encodeCellGrid(
            Array.from({ length: rowsN }, (_, r) =>
              Array.from({ length: colsN }, (_, c) => {
                const found = blks.find((b) => b.r === r && b.c === c);
                return found?.t ?? fb;
              }),
            ),
          );
        }
        return encodeBlocks(blks);
      };
      const updated: ParamValues = {
        ...prev,
        [cellsParam.id]: encodeResult(newCellBlks, rowsCount, colsCount, fallback),
      };
      if (colorsParam && newColorBlks) {
        const colorFallback = colorsParam.options?.[0]?.value ?? 'frame';
        updated[colorsParam.id] = encodeResult(newColorBlks, rowsCount, colsCount, colorFallback);
      }
      return dna.normalizeValues ? dna.normalizeValues(updated) : updated;
    });
  };

  // unmergeCell — P4 BỎ GỘP: tách block cross-merged (rs>1 hoặc cs>1) thành
  // rs × cs ô 1×1 riêng lẻ, mỗi ô giữ type cũ (open-nobk sau cross-merge).
  // Đảo lại cross-grid merge. Sub-split (intra-cell) phải dùng unsplitBlockIntra
  // (qua "Gộp →" cho V-split L, etc), KHÔNG dùng unmergeCell.
  const unmergeCell = (row: number, col: number) => {
    if (!cellsParam) return;
    setValues((prev) => {
      const rowsCount = (prev.rows as number) ?? cellsParam.gridRows ?? 0;
      const colsCount = (prev.columns as number) ?? cellsParam.gridCols ?? 0;
      const fallback = cellsParam.options?.[0]?.value ?? 'open-back';
      const cellsRaw = String(prev[cellsParam.id] ?? '');
      // FIX (P35): fill ô thiếu để đồng bộ với hiển thị (an toàn, nhất quán 4 handler).
      const cellBlks = fillMissingCells(
        cellsToBlocks(cellsRaw, rowsCount, colsCount, fallback),
        rowsCount,
        colsCount,
        fallback,
      );
      const newCellBlks = unmergeBlocks(cellBlks, row, col);
      let newColorBlks: typeof cellBlks | null = null;
      if (colorsParam) {
        const colorRaw = String(prev[colorsParam.id] ?? '');
        const colorFallback = colorsParam.options?.[0]?.value ?? 'frame';
        const colorBlks = fillMissingCells(
          cellsToBlocks(colorRaw, rowsCount, colsCount, colorFallback),
          rowsCount,
          colsCount,
          colorFallback,
        );
        newColorBlks = unmergeBlocks(colorBlks, row, col);
      }
      const encodeResult = (
        blks: typeof cellBlks,
        rowsN: number,
        colsN: number,
        fb: string,
      ): string => {
        const allPrimitive = blks.every((b) => !hasSubSplit(b.t));
        if (isUniformBlocks(blks) && allPrimitive) {
          return encodeCellGrid(
            Array.from({ length: rowsN }, (_, r) =>
              Array.from({ length: colsN }, (_, c) => {
                const found = blks.find((b) => b.r === r && b.c === c);
                return found?.t ?? fb;
              }),
            ),
          );
        }
        return encodeBlocks(blks);
      };
      const updated: ParamValues = {
        ...prev,
        [cellsParam.id]: encodeResult(newCellBlks, rowsCount, colsCount, fallback),
      };
      if (colorsParam && newColorBlks) {
        const colorFallback = colorsParam.options?.[0]?.value ?? 'frame';
        updated[colorsParam.id] = encodeResult(newColorBlks, rowsCount, colsCount, colorFallback);
      }
      return dna.normalizeValues ? dna.normalizeValues(updated) : updated;
    });
  };

  // P37: phần tử bảng chỉnh Ô TỦ (CellBar) — render TRONG sidebar (section "Ô tủ")
  // thay vì nổi trên 3D. Tính eligibility chia/gộp tại đây từ cellPopup + cellBlocks.
  // null khi: chế độ chụp / không ở tab Ô tủ / chưa chọn ô / DNA không có cellgrid.
  const cellEditorEl =
    !isShot && mode3D === 'cells' && cellPopup && cellsParam
      ? (() => {
          // P3 v2 split eligibility (intra-cell):
          //  - Block 1×1 primitive (chưa sub-split, không cross-merged)
          //  - User chưa chọn sub-cell (subIdx undefined) — không nested split
          //  - Sub-cell sau split phải có clear inner ≥ 150×150 (sub-divider T = 18mm)
          //  - Sub-cell phải fit constraint theo type:
          //    * door: sub-W ≥ 250 (FRONT_MIN_WIDTH) + sub-W ≤ 1200 + sub-H ≤ 2400
          //    * drawer: sub-W ≥ 250 + sub-W ≤ 900 + sub-H ≤ 400
          //    * open-back/open-nobk: chỉ cần ≥ 150 inner
          const currentBlock = findBlockAt(cellBlocks, cellPopup.row, cellPopup.col);
          const blockIs1x1Primitive =
            !!currentBlock &&
            currentBlock.rs === 1 &&
            currentBlock.cs === 1 &&
            !hasSubSplit(currentBlock.t);
          const notSubCell = cellPopup.subIdx === undefined;
          const rowsCount = (values.rows as number) ?? cellsParam.gridRows ?? 0;
          const colsCount = (values.columns as number) ?? cellsParam.gridCols ?? 0;
          // Kích thước cell vật lý (mm).
          const cellW = cellsParam.colSizes?.[cellPopup.col] ?? 0;
          const cellH = cellsParam.rowSizes?.[cellPopup.row] ?? 0;
          const SUB_DIVIDER_T = 18;
          // Sub-cell dimensions sau split (clear inner = outer - vách phụ T).
          const subVW = (cellW - SUB_DIVIDER_T) / 2; // V-split: width của mỗi sub-cell
          const subHH = (cellH - SUB_DIVIDER_T) / 2; // H-split: height của mỗi sub-cell
          // P23: split LUÔN cho phép miễn 2 sub-cell ≥ 150mm thông thuỷ (dùng
          // 'open-back' = chỉ check min). Nếu type hiện tại (cánh/ngăn kéo) không
          // vừa sub-cell → splitCell tự fallback subs về 'open-back' (xem handler).
          const cfgDepth = Number(resolvedValues.depth ?? 400);
          const canSplitVertical =
            blockIs1x1Primitive &&
            notSubCell &&
            subCellTypeFits('open-back', subVW, cellH, cfgDepth);
          const canSplitHorizontal =
            blockIs1x1Primitive &&
            notSubCell &&
            subCellTypeFits('open-back', cellW, subHH, cfgDepth);

          // P4 MERGE eligibility:
          //  - Sub-cell context: chỉ hướng đối diện sub-cell kia active (unsplit).
          //    V-split L (subIdx=0) → 'right'; V-split R (subIdx=1) → 'left'.
          //    H-split B (subIdx=0) → 'up'; H-split T (subIdx=1) → 'down'.
          //  - Primitive cell context (subIdx undefined): kiểm tra láng giềng outer
          //    cùng axis-perpendicular size + cả 2 đều primitive + type compat.
          let canMergeUp = false;
          let canMergeDown = false;
          let canMergeLeft = false;
          let canMergeRight = false;
          // Bỏ gộp: block bao trùm (row, col) phải cross-merged (rs > 1 hoặc cs > 1)
          // và KHÔNG sub-split. Cho phép cả với sub-cell context? KHÔNG — sub-cell
          // dùng Gộp ←/→/↑/↓ để unsplit (đảo split). Bỏ gộp riêng cho cross-merge.
          const canUnmerge =
            cellPopup.subIdx === undefined &&
            !!currentBlock &&
            !hasSubSplit(currentBlock.t) &&
            (currentBlock.rs > 1 || currentBlock.cs > 1);
          // P61 — Cross-merged block KHÔNG còn khóa cứng. Thay bằng picker HẠN CHẾ:
          // "Mở (không hậu)" + (nếu khoang gộp vừa kích thước) "Cánh (có hậu)".
          const isCrossMerged = canUnmerge;
          const frozenByMerge = false;
          // Kích thước thông thuỷ khoang gộp (gồm bề dày vách giữa bị nuốt; T vách ~18).
          // Giới hạn KHỚP dna.ts: FRONT_MIN_WIDTH=250, MERGED_DOOR_MAX_W=1418, MAX_H=918.
          let mergedDoorEligible = false;
          if (isCrossMerged && currentBlock) {
            const MERGE_T = 18;
            let mW = 0;
            for (let cc = currentBlock.c; cc < currentBlock.c + currentBlock.cs; cc++)
              mW += cellsParam.colSizes?.[cc] ?? 0;
            mW += (currentBlock.cs - 1) * MERGE_T;
            let mH = 0;
            for (let rr = currentBlock.r; rr < currentBlock.r + currentBlock.rs; rr++)
              mH += cellsParam.rowSizes?.[rr] ?? 0;
            mH += (currentBlock.rs - 1) * MERGE_T;
            mergedDoorEligible = mW >= 250 && mW <= 1418 && mH <= 918;
          }
          if (cellPopup.subIdx !== undefined) {
            // Sub-cell: enable hướng đối diện.
            const subAxis =
              currentBlock && hasSubSplit(currentBlock.t)
                ? parseSubSplit(currentBlock.t).split?.axis
                : null;
            if (subAxis === 'V') {
              canMergeRight = cellPopup.subIdx === 0; // L → gộp về phải
              canMergeLeft = cellPopup.subIdx === 1; // R → gộp về trái
            } else if (subAxis === 'H') {
              canMergeUp = cellPopup.subIdx === 0; // B → gộp lên trên
              canMergeDown = cellPopup.subIdx === 1; // T → gộp xuống dưới
            }
          } else if (
            currentBlock &&
            !hasSubSplit(currentBlock.t) &&
            currentBlock.rs === 1 &&
            currentBlock.cs === 1
          ) {
            // Primitive 1×1 cell — CHƯA cross-merged. Cho phép gộp 1 lần với
            // 1 láng giềng. Sau merge, block sẽ rs/cs > 1 → KHÔNG cho merge tiếp
            // (tránh chain merge 3+ cells); user phải "Bỏ gộp" trước rồi mới
            // merge với partner mới.
            const checkDir = (dir: MergeDirection): boolean => {
              let nR: number;
              let nC: number;
              if (dir === 'up') {
                nR = currentBlock.r - 1;
                nC = cellPopup.col;
              } else if (dir === 'down') {
                nR = currentBlock.r + currentBlock.rs;
                nC = cellPopup.col;
              } else if (dir === 'left') {
                nR = cellPopup.row;
                nC = currentBlock.c - 1;
              } else {
                nR = cellPopup.row;
                nC = currentBlock.c + currentBlock.cs;
              }
              if (nR < 0 || nR >= rowsCount || nC < 0 || nC >= colsCount) return false;
              const neighbor = findBlockAt(cellBlocks, nR, nC);
              if (!neighbor || hasSubSplit(neighbor.t)) return false;
              // Neighbor cũng phải primitive 1×1 — không cho merge chain (rule
              // "1 cell chỉ gộp 1 lần"). Nếu neighbor đã merged → user phải Bỏ
              // gộp neighbor trước.
              if (neighbor.rs !== 1 || neighbor.cs !== 1) return false;
              // Axis-perpendicular size phải khớp để kết quả là hình chữ nhật.
              if (dir === 'up' || dir === 'down') {
                return currentBlock.c === neighbor.c && currentBlock.cs === neighbor.cs;
              }
              return currentBlock.r === neighbor.r && currentBlock.rs === neighbor.rs;
            };
            // CONVENTION FLIP: tu-ke render r=0 ở SÀN (bottom), r=rows-1 ở NÓC (top).
            // UI mũi tên '↑' = visually UP = ô có r LỚN hơn. Codec 'up' = decrease r
            // (= visually DOWN trong tu-ke). Map ngược: UI up → codec down, vice versa.
            // Left/right không bị flip (c=0=left ở cả 2 convention).
            canMergeUp = checkDir('down');
            canMergeDown = checkDir('up');
            canMergeLeft = checkDir('left');
            canMergeRight = checkDir('right');
          }
          // P22: sub-cell context → ban type không vừa kích thước SUB-CELL thật
          // (½ trên trục bị chia). Constraint outer disabledByRow/Col KHÔNG đúng
          // cho sub-cell nên CellBar dùng list này thay thế khi isSubCell.
          const subBanned: string[] = [];
          if (cellPopup.subIdx !== undefined && currentBlock && hasSubSplit(currentBlock.t)) {
            const subAxis2 = parseSubSplit(currentBlock.t).split?.axis;
            const subW = subAxis2 === 'V' ? subVW : cellW;
            const subH = subAxis2 === 'H' ? subHH : cellH;
            for (const t of ['drawer', 'door']) {
              if (!subCellTypeFits(t, subW, subH, cfgDepth)) subBanned.push(t);
            }
          }
          return (
            <CellBar
              cellsParam={cellsParam}
              cellColorsParam={colorsParam}
              subBanned={subBanned}
              row={cellPopup.row}
              col={cellPopup.col}
              currentType={popupCurrentType}
              currentColor={popupCurrentColor}
              tab={cellTab}
              onTabChange={setCellTab}
              onPickType={(v) => {
                // P37.b: GIỮ ô đang chọn sau khi đổi kiểu (không ngắt quãng) — chỉ
                // đổi type, topology ô không đổi nên cellPopup vẫn hợp lệ.
                setCell(cellsParam.id, cellPopup.row, cellPopup.col, v, cellPopup.subIdx);
              }}
              onPickColor={(v) => {
                if (colorsParam) {
                  // P37.b: GIỮ ô đang chọn sau khi đổi màu.
                  setCell(colorsParam.id, cellPopup.row, cellPopup.col, v, cellPopup.subIdx);
                }
              }}
              onSplitVertical={
                canSplitVertical
                  ? () => {
                      // P37.b: chia DỌC → tự chọn sub-cell TRÁI (subIdx 0) để chỉnh tiếp.
                      splitCell(cellPopup.row, cellPopup.col, 'vertical');
                      setCellPopup({ row: cellPopup.row, col: cellPopup.col, subIdx: 0 });
                    }
                  : undefined
              }
              onSplitHorizontal={
                canSplitHorizontal
                  ? () => {
                      // P37.b: chia NGANG → tự chọn sub-cell TRÊN (subIdx 1, Y cao hơn).
                      splitCell(cellPopup.row, cellPopup.col, 'horizontal');
                      setCellPopup({ row: cellPopup.row, col: cellPopup.col, subIdx: 1 });
                    }
                  : undefined
              }
              onMergeUp={
                canMergeUp
                  ? () => {
                      // UI ↑ = visually up = increase r (tu-ke r=0 at floor) → codec 'down'.
                      // P37.b: gộp → chọn Ô TỔNG. Cross-merge 'down': anchor = (row,col).
                      // Sub-cell unsplit: block về 1×1 tại (row,col). Cả 2 → {row,col}.
                      mergeCell(cellPopup.row, cellPopup.col, 'down', cellPopup.subIdx);
                      setCellPopup({ row: cellPopup.row, col: cellPopup.col });
                    }
                  : undefined
              }
              onMergeDown={
                canMergeDown
                  ? () => {
                      // UI ↓ = visually down = decrease r → codec 'up'.
                      // P37.b: cross-merge 'up' → anchor ô tổng = (row-1, col). Sub-cell
                      // unsplit → về (row, col).
                      mergeCell(cellPopup.row, cellPopup.col, 'up', cellPopup.subIdx);
                      setCellPopup(
                        cellPopup.subIdx !== undefined
                          ? { row: cellPopup.row, col: cellPopup.col }
                          : { row: cellPopup.row - 1, col: cellPopup.col },
                      );
                    }
                  : undefined
              }
              onMergeLeft={
                canMergeLeft
                  ? () => {
                      // P37.b: cross-merge 'left' → anchor ô tổng = (row, col-1). Sub-cell
                      // unsplit → về (row, col).
                      mergeCell(cellPopup.row, cellPopup.col, 'left', cellPopup.subIdx);
                      setCellPopup(
                        cellPopup.subIdx !== undefined
                          ? { row: cellPopup.row, col: cellPopup.col }
                          : { row: cellPopup.row, col: cellPopup.col - 1 },
                      );
                    }
                  : undefined
              }
              onMergeRight={
                canMergeRight
                  ? () => {
                      // P37.b: cross-merge 'right' → anchor ô tổng = (row, col). Sub-cell
                      // unsplit → cũng (row, col).
                      mergeCell(cellPopup.row, cellPopup.col, 'right', cellPopup.subIdx);
                      setCellPopup({ row: cellPopup.row, col: cellPopup.col });
                    }
                  : undefined
              }
              onUnmerge={
                canUnmerge
                  ? () => {
                      // P37.b: bỏ gộp → ô về 1×1 tại (row,col), GIỮ chọn ô đó.
                      unmergeCell(cellPopup.row, cellPopup.col);
                      setCellPopup({ row: cellPopup.row, col: cellPopup.col });
                    }
                  : undefined
              }
              frozenByMerge={frozenByMerge}
              mergedRestrict={isCrossMerged}
              mergedDoorEligible={mergedDoorEligible}
              isSubCell={cellPopup.subIdx !== undefined}
              onClose={() => setCellPopup(null)}
            />
          );
        })()
      : null;

  // Layout cố định: mobile = cột-ngược (3D trên, panel dưới);
  // desktop = hàng (panel trái, 3D phải). DOM: panel trước, 3D sau.
  return (
    <div className="relative h-full w-full flex flex-col-reverse md:flex-row">
      {!isShot && (
      <aside
        className="shrink-0 flex flex-col gap-5 max-md:gap-1.5 overflow-y-auto bg-[var(--color-bg)] p-5 max-md:px-3 max-md:py-2 text-[var(--color-ink)] max-md:h-[38dvh] md:h-full md:w-[340px] md:border-r md:border-[var(--color-accent)]/20"
      >
        {/* Header — desktop only editorial. Mobile bỏ để nén chiều cao panel. (P96 kit) */}
        <EditorialHeader
          homeHref={homeHref}
          kicker="Tủ kệ · ngăn"
          title={presetMeta?.name?.replace(/^(kê|ngăn)\.?\s*/i, "") || dna.name.replace(/^Tủ kệ\s*/, "")}
          hint={<>Kéo thanh trượt chỉnh kích thước. Chạm vào ô tủ trên hình để đổi kiểu &amp; màu.</>}
        />

        {/* P13.5: WarningBox moved to 3D viewport overlay (top center). */}

        {/* P12.3: Tabs hiện trên CẢ desktop + mobile (module-based pattern). Sticky
            bám trên cùng drawer khi scroll. Full bar grid 4 cell, divider border-r
            giữa cells. Sticky cần aside có overflow-y-auto. */}
        <div className="shrink-0 sticky -top-5 max-md:-top-3 -mx-5 max-md:-mx-3 z-20 bg-[var(--color-bg)] border-y border-[var(--color-accent)]/20">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))` }}>
            {sections.map((section, i) => {
              const full = section.group ?? section.items[0].label;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectTab(i)}
                  aria-pressed={i === activeTab}
                  title={full}
                  className={`min-h-[52px] flex flex-col items-center justify-center gap-1 px-0.5 transition border-r last:border-r-0 border-[var(--color-accent)]/20 ${
                    i === activeTab
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'bg-transparent text-[var(--color-accent)]/70 hover:bg-[var(--color-accent-bg)]'
                  }`}
                >
                  <TabIcon label={full} />
                  <span className="text-[10px] md:text-[11px] font-medium leading-none whitespace-nowrap">
                    {TAB_SHORT[full] ?? full}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <section className="flex flex-col gap-4 max-md:gap-1.5">
          {sections.map((section, i) => {
            // P12.3: Cả mobile + desktop chỉ hiện section của tab active (module pattern).
            const isHidden = i !== activeTab;
            if (!section.group) {
              const param = section.items[0];
              return (
                <div key={param.id} className={isHidden ? 'hidden' : ''}>
                  <ParamControl
                    param={param}
                    value={intentValues[param.id]}
                    onChange={setParam}
                  />
                </div>
              );
            }
            return (
              <div
                key={section.group}
                className={`flex flex-col gap-5 max-md:gap-1.5 ${isHidden ? 'hidden' : ''}`}
              >
                {section.items.map((param) => (
                  <ParamControl
                    key={param.id}
                    param={param}
                    value={intentValues[param.id]}
                    onChange={setParam}
                  />
                ))}
                {/* P37: tab Chiều cao — chạm 1 tầng trên 3D → editor cao-tầng hiện
                    NGAY DƯỚI thanh Tổng (không còn popup nổi). Chưa chọn → gợi ý. */}
                {section.group === 'Chiều cao' &&
                  (rowSelect !== null &&
                  rowSelect < Number(values.rows ?? 0) &&
                  rowSteps.length > 0 ? (
                    <div className="flex flex-col gap-2 rounded-xl border border-[var(--color-accent)]/15 bg-[var(--color-surface-2)]/35 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-[var(--color-accent)] font-viet">
                          Tầng {rowSelect + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setRowSelect(null)}
                          aria-label="Bỏ chọn tầng"
                          className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md bg-[var(--color-bg)] text-base leading-none text-[var(--color-accent)]/70 hover:bg-[var(--color-accent)] hover:text-white transition"
                        >
                          ×
                        </button>
                      </div>
                      <div className="flex w-full gap-0.5 rounded-lg bg-[var(--color-bg)] p-0.5">
                        {rowSteps.map((s) => {
                          const cur = Number(values[`tierH_${rowSelect}`] ?? 0);
                          const active = Math.abs(cur - s) < 1;
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setParam(`tierH_${rowSelect}`, s)}
                              className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition tabular-nums ${
                                active
                                  ? 'bg-[var(--color-accent)] text-white shadow-sm'
                                  : 'text-[var(--color-accent)]/70 hover:text-[var(--color-accent)]'
                              }`}
                            >
                              {Math.round(s / 10)} cm
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--color-accent)]/60 font-viet leading-relaxed">
                      Kéo thanh trên để cao/thấp (tự thêm/bớt tầng 30cm). Chạm vào một tầng
                      trên hình để chỉnh riêng chiều cao tầng đó.
                    </p>
                  ))}
                {/* P54b: tab Chiều rộng — CHẠM 1 cột trên 3D → control cột ĐÓ hiện ở đây
                    (ô NHẬP SỐ + slider). Kích thước TẤT CẢ cột hiển thị trên 3D viewport
                    (innerColDims). Không liệt kê hết cột ở sidebar (theo yêu cầu founder). */}
                {section.group === 'Chiều rộng' &&
                  colRange &&
                  (colSelect !== null && colSelect < Number(values.columns ?? 0) ? (
                    <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--color-accent)]/15 bg-[var(--color-surface-2)]/35 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium font-viet text-[var(--color-accent)]">
                          Chỉnh rộng cột
                        </span>
                        <button
                          type="button"
                          onClick={() => setColSelect(null)}
                          aria-label="Bỏ chọn cột"
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--color-bg)] text-base leading-none text-[var(--color-accent)]/70 transition hover:bg-[var(--color-accent)] hover:text-white"
                        >
                          ×
                        </button>
                      </div>
                      <ColSizeRow
                        index={colSelect}
                        value={Number(values[`colW_${colSelect}`] ?? colRange[0])}
                        min={colRange[0]}
                        max={colRange[1]}
                        active
                        onFocus={() => {}}
                        onCommit={(v) => setParam(`colW_${colSelect}`, v)}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--color-accent)]/60 font-viet leading-relaxed">
                      Chạm vào một cột trên hình để chỉnh riêng rộng cột đó (kích thước từng cột
                      hiện ngay trên mô hình). Kéo thanh trên để rộng/hẹp cả tủ.
                    </p>
                  ))}
                {/* P37: tab Ô tủ — info hint (section.items) + bảng CellBar khi đã chọn ô. */}
                {section.group === 'Ô tủ' && cellEditorEl}
              </div>
            );
          })}
        </section>

        {/* PricePanel breakdown + CutlistPanel (bảng cắt + BOM phụ kiện) chỉ
            hiện cho admin. User end (interactive/public) xem giá + nút Đặt
            hàng ở OrderBar nổi trên 3D viewport (cả mobile lẫn desktop). */}
        {isAdmin && (
          <>
            <PricePanel price={price} size={build.size} />
            <CutlistPanel cutlist={cutlist} materialLabels={materialLabels} />
          </>
        )}
        {showSavePreset && (
          <>
            <SavePresetButton values={values} onSave={onSavePreset} />
            <NestingButton
              parts={cutlist.parts ?? build.parts}
              boards={effectivePriceConfig?.boards ?? []}
              kerfMm={effectivePriceConfig?.kerfMm ?? 3}
            />
          </>
        )}
      </aside>
      )}

      <div className="relative min-h-0 flex-1 max-md:h-[56dvh]">
        {/* Nút về trang chủ — mobile only (desktop đã có trong header sidebar).
            Nút tròn nổi góc trên-trái viewport. */}
        {!isShot && homeHref && (
          <a
            href={homeHref}
            aria-label="Về trang chủ"
            className="md:hidden absolute left-3 top-3 z-30 inline-flex items-center justify-center w-9 h-9 rounded-full bg-[var(--color-bg)]/90 backdrop-blur shadow-md text-lg leading-none text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white transition"
          >
            ←
          </a>
        )}
        {/* P28/P29: cụm nút nổi top-trái — Hoàn tác + bật/tắt kích thước tổng.
            Mobile: xuống dưới nút Trang chủ (top-[3.25rem]); desktop: góc trên-trái trống. */}
        {!isShot && (
          <div className="absolute z-30 left-3 top-[3.25rem] md:left-6 md:top-28 flex items-center gap-2">
            <FloatingIconButton onClick={undoConfig} disabled={!canUndo} ariaLabel="Hoàn tác" title="Hoàn tác thay đổi gần nhất">{IconUndo}</FloatingIconButton>
            <FloatingIconButton onClick={() => setShowTotalDims((v) => !v)} active={showTotalDims} ariaLabel="Bật/tắt kích thước tổng" title={showTotalDims ? 'Ẩn kích thước tổng' : 'Hiện kích thước tổng'}>{IconRuler}</FloatingIconButton>
          </div>
        )}
        {/* P13.5: Warning popup — floating top-center, layer trên 3D viewport. (P96 kit) */}
        {!isShot && warnings.length > 0 && (
          <WarningBox warnings={warnings} title="⚠ Cảnh báo kích thước" />
        )}
        {/* P37: pill gợi ý theo TAB đang mở — ẩn khi đã chọn phần tử, hoặc khi
            tab chỉ để xem (Chiều sâu / Vật liệu khung → mode3D='view'). */}
        {!isShot && mode3D !== 'view' &&
          (mode3D === 'cells'
            ? !cellPopup
            : mode3D === 'rows'
              ? rowSelect === null
              : colSelect === null) && (
          <HintPill>
            {mode3D === 'cells'
              ? 'Chạm ô để chỉnh'
              : mode3D === 'rows'
                ? 'Chạm tầng để chỉnh cao'
                : 'Chạm cột để chỉnh rộng'}
          </HintPill>
        )}
        {/* Giá + nút Đặt hàng — nổi góc trên 3D viewport, không nền bar. (P96: kit OrderBar.
            summary + buildPayload riêng tủ x; layout/form/POST chung với tủ y.) */}
        {showOrderButton && (
          <OrderBar
            priceTotal={price.total}
            summary={
              <>
                <p><strong>Mẫu:</strong> {presetMeta?.name || 'Tủ tự thiết kế'}</p>
                <p><strong>Kích thước:</strong> {values.width as number} × {values.height as number} × {values.depth as number} mm</p>
                <p><strong>Cấu trúc:</strong> {values.columns as number} cột × {values.rows as number} tầng</p>
              </>
            }
            buildPayload={() => ({
              preset: { slug: presetMeta?.slug, name: presetMeta?.name },
              values,
              price, // full PriceBreakdown
              cutlist, // full Cutlist
              bom: build.fittings ?? [], // BOM = fittings
            })}
          />
        )}
        {/* P37: bảng chỉnh Ô TỦ (CellBar) đã chuyển vào sidebar — xem `cellEditorEl`
            render trong <aside> section "Ô tủ". KHÔNG còn nổi trên 3D viewport. */}
        {/* P37: popup CAO TẦNG + RỘNG CỘT đã chuyển vào sidebar (section Chiều
            cao / Chiều rộng), hiện dưới thanh Tổng. KHÔNG còn nổi trên 3D. */}
        <Canvas
          shadows={SHADOW_CONFIG}
          onPointerMissed={() => {
            setCellPopup(null);
            setRowSelect(null);
            setColSelect(null);
          }}
          camera={
            activeShotCam ?? { position: [3000, 1900, 3800], fov: 35, near: 100, far: 30000 }
          }
          // gl.preserveDrawingBuffer cho phép canvas.toDataURL() trả ảnh thật.
          // toneMapping Neutral (Khronos PBR Neutral) → giữ màu TRUNG THỰC; KHÔNG
          // dùng ACES mặc định của R3F (ACES dìm tối + lệch tông, sai màu thật).
          gl={
            isShot
              ? {
                  preserveDrawingBuffer: true,
                  alpha: true,
                  antialias: true,
                  toneMapping: NeutralToneMapping,
                }
              : { preserveDrawingBuffer: true, toneMapping: NeutralToneMapping }
          }
          dpr={isRecord ? 1.25 : isShot ? 2.5 : undefined}
        >
          {/* P30: screenshot KHÔNG set background → canvas TRONG SUỐT → khâu capture
              composite lên TRẮNG TINH (#fff thật). Tránh NeutralToneMapping nén
              trắng-đục xuống xám ~240 (gốc rễ "nền ghi"). Interactive giữ #eeeeee. */}
          {!isShot && <color attach="background" args={['#eeeeee']} />}
          {isShot ? <ScreenshotLighting /> : <SceneLighting />}
          {/* P33: TRẢ LẠI bóng đổ mềm — Ground studio (shadowMaterial vô hình, chỉ
              hiện BÓNG; nền vẫn trắng tuyệt đối). shadowMaterial đổ bóng theo opacity
              CỐ ĐỊNH, không phụ thuộc ambient → bóng vẫn rõ dù ambient 2.5 (màu tủ
              vẫn sát map). Crop hạ ngưỡng để GỘP bóng vào khung → không cắt góc. */}
          {isShot ? <Ground variant="studio" /> : <Ground />}
          {/* P24: GTAO + SMAA chỉ ở screenshot mode → thumbnail có chiều sâu,
              cạnh mịn; interactive/mobile giữ nguyên đường render cũ. */}
          {isShot && <ScreenshotPostFX />}
          {/* P32: rig nhìn ngang (cạnh thẳng) + lens-shift canh giữa tủ theo tâm. */}
          {isShot && activeShotCam && (
            <ScreenshotCameraRig
              position={activeShotCam.position}
              centerY={Number(values.height ?? 1800) / 2}
            />
          )}
          {/* P65 — props trang trí trong hốc, CHỈ khi chụp thumbnail. Seed theo cấu
              hình (cells + kích thước) → chụp lại ra y hệt. */}
          {isShot && !isRecord && (
            <StagingProps
              cavities={build.cavities ?? []}
              seed={`${values.width}x${values.height}x${values.depth}|${values.cells ?? ''}`}
              size={build.size}
            />
          )}
          {!isShot && <Wall parts={build.parts} />}
          {/* Pre-compute assemblies: gom door+handle / drawer+sides+handle thành 1 group.
              Mỗi assembly có 1 transform DUY NHẤT → tay nắm "dính" vào cánh, không thể desync. */}
          {(() => {
            const partById = new Map(build.parts.map((p) => [p.id, p]));
            const usedPartIds = new Set<string>();
            const usedFittingIds = new Set<string>();
            const assemblies: Array<{ key: string; config: AssemblyConfig; openProgress: number }> = [];

            // Iterate parts → khi gặp 1 door/drawer panel → build assembly cho cell đó.
            // P3 v2: regex bắt thêm sub-suffix `-L|-R|-B|-T` (sub-cell trong ô đã split).
            // Vẫn match leaf `-a|-b` (cánh đôi rộng) — sub-cell và leaf không đụng nhau
            // vì leaf chỉ xuất hiện khi cell wide > WIDE_CELL, sub-cell narrow < WIDE_CELL.
            for (const part of build.parts) {
              if (usedPartIds.has(part.id)) continue;
              const m = part.id.match(/^(door|drawer)-r(\d+)-c(\d+)(?:-([LRBT]))?(?:-([ab]))?$/);
              if (!m) continue;
              const [, kind, rStr, cStr, subStr, leaf] = m;
              const row = Number(rStr);
              const col = Number(cStr);
              // Sub-cell suffix '' khi primitive cell; '-L'/'-R'/'-B'/'-T' khi sub-cell.
              const subSuffix = subStr ? `-${subStr}` : '';
              const subIdx: 0 | 1 | undefined =
                subStr === 'L' || subStr === 'B' ? 0 : subStr === 'R' || subStr === 'T' ? 1 : undefined;
              const partAnim = computePartAnimation(part, build.fittings);
              if (!partAnim) continue;

              const pivotPos: [number, number, number] = partAnim.kind === 'door'
                ? [part.position[0] + (partAnim.hingeOffsetX ?? 0), part.position[1], part.position[2]]
                : [part.position[0], part.position[1], part.position[2]];

              const asmParts: Part[] = [part];
              const asmFittings: Fitting[] = [];
              usedPartIds.add(part.id);

              if (kind === 'drawer') {
                // Drawer assembly: 5 tấm cùng cell (hoặc sub-cell). Lookup IDs include subSuffix.
                for (const sub of ['L', 'R', 'Bk', 'Bot']) {
                  const sp = partById.get(`drawer${sub}-r${row}-c${col}${subSuffix}`);
                  if (sp) { asmParts.push(sp); usedPartIds.add(sp.id); }
                }
              }

              // Handle (strip ĐEN hoặc BAR) matching this assembly (include subSuffix):
              //   door single → h{strip|bar}-d-r{r}-c{c}{subSuffix}
              //   door leaf-a → h{strip|bar}-da-r{r}-c{c}{subSuffix}
              //   door leaf-b → h{strip|bar}-db-r{r}-c{c}{subSuffix}
              //   drawer     → h{strip|bar}-d-r{r}-c{c}{subSuffix}
              // P45 fix: KHỚP CẢ 'hbar-' (bar handle) — trước chỉ 'hstrip-' nên bar
              // không vào assembly → không mở/đóng cùng cánh-ngăn kéo.
              const handleSuffix = leaf
                ? `d${leaf}-r${row}-c${col}${subSuffix}`
                : `d-r${row}-c${col}${subSuffix}`;
              const handlePrefixes = [`hstrip-${handleSuffix}-`, `hbar-${handleSuffix}-`];
              for (const f of build.fittings ?? []) {
                if (handlePrefixes.some((p) => f.id.startsWith(p))) {
                  asmFittings.push(f);
                  usedFittingIds.add(f.id);
                }
              }

              // P3 v2: animation mở khi cellPopup match (row, col, subIdx).
              // Record (clip): trạng thái mở do director quyết — toàn bộ hoặc "làn sóng".
              const open = isRecord
                ? recordOpenProgress(
                    recOpen,
                    partAnim.kind,
                    row,
                    col,
                    Number(values.columns ?? 1),
                    Number(values.rows ?? 1),
                  )
                : cellPopup && cellTab === 'type'
                    && row === cellPopup.row && col === cellPopup.col
                    && (cellPopup.subIdx ?? null) === (subIdx ?? null)
                  ? 1
                  : 0;
              assemblies.push({
                key: part.id,
                config: {
                  pivotPos,
                  kind: partAnim.kind,
                  angleSign: partAnim.angleSign,
                  parts: asmParts,
                  fittings: asmFittings,
                },
                openProgress: open,
              });
            }

            // Parts/fittings ngoài assembly: render độc lập.
            const restParts = build.parts.filter((p) => !usedPartIds.has(p.id));
            const restFittings = (build.fittings ?? []).filter((f) => !usedFittingIds.has(f.id));

            return (
              <>
                <group>
                  {restParts.map((part) => (
                    <PartMesh key={part.id} part={part} fittings={build.fittings} />
                  ))}
                </group>
                {assemblies.map((a) => (
                  <AssemblyMesh
                    key={a.key}
                    config={a.config}
                    openProgress={a.openProgress}
                    immediate={isRecord}
                    fittingsForHingeDetect={build.fittings}
                  />
                ))}
                {restFittings.map((fitting) => (
                  <FittingMesh key={fitting.id} fitting={fitting} />
                ))}
              </>
            );
          })()}
          {!isShot && (() => {
            // P20/P21: 3 dim TỔNG luôn hiện (envelope). Breakdown từng cột/tầng hiện ở
            // tab tương ứng — đặt SÁT cabinet, tách khỏi outer.
            // P54b: BỎ check widthMode/heightMode==='manual' (P36 v2 đã gỡ toggle Chia
            // đều/Từng cột → flag luôn 'even' → nhãn không bao giờ hiện). Giờ hiện rộng
            // TỪNG CỘT khi ở tab Rộng (≥2 cột), cao TỪNG TẦNG khi ở tab Cao (≥2 tầng).
            const showCol = activeTab === 0 && Number(values.columns ?? 0) > 1 && !!build.gridLines;
            const showRow = activeTab === 1 && Number(values.rows ?? 0) > 1 && !!build.gridLines;
            return (
              <Dimensions
                parts={build.parts}
                showOuter={showTotalDims}
                innerColDims={
                  showCol
                    ? build.gridLines!.colCenters.map((cx, i) => ({
                        centerX: cx,
                        mm: build.gridLines!.colWidths[i],
                      }))
                    : undefined
                }
                innerRowDims={
                  showRow
                    ? build.gridLines!.rowCenters.map((cy, i) => ({
                        centerY: cy,
                        mm: build.gridLines!.rowHeights[i],
                      }))
                    : undefined
                }
              />
            );
          })()}
          {/* Lớp hitbox vô hình + popup chọn kiểu/màu — direct manipulation. */}
          {!isShot && (
            <CellHitboxes
              boxes={cellHitBoxes}
              onPick={(row, col, subIdx) => {
                // P36: click ô làm gì TUỲ TAB đang mở (mode3D).
                if (mode3D === 'cells') {
                  setCellPopup({ row, col, subIdx });
                  setCellTab('type');
                } else if (mode3D === 'rows') {
                  setRowSelect(row); // chọn TẦNG để chỉnh cao
                } else if (mode3D === 'cols') {
                  setColSelect(col); // chọn CỘT để chỉnh rộng
                }
                // 'view' → bỏ qua (chỉ xoay/zoom mô hình).
              }}
            />
          )}
          {/* Ô đang chọn (tab Ô tủ) — tô đỏ nhẹ. Tầng đang chọn (tab Chiều cao) →
              tô cả hàng. */}
          {!isShot && mode3D === 'cells' && popupBox && <CellHighlight box={popupBox} />}
          {!isShot && mode3D === 'rows' && rowSelect !== null && (() => {
            const rb = rowBox(cellsParam, Number(values.depth ?? 350), rowSelect);
            return rb ? <CellHighlight box={rb} /> : null;
          })()}
          {!isShot && mode3D === 'cols' && colSelect !== null && (() => {
            const cb = colBox(cellsParam, Number(values.depth ?? 350), colSelect);
            return cb ? <CellHighlight box={cb} /> : null;
          })()}
          {!isShot && (
            <FitCamera
              width={Number(values.width ?? 1200)}
              height={Number(values.height ?? 1800)}
              depth={Number(values.depth ?? 350)}
            />
          )}
          {!isShot && (
            <OrbitControls
              makeDefault
              enableDamping
              maxPolarAngle={Math.PI / 2.05}
              minDistance={1500}
              maxDistance={12000}
            />
          )}
          {/* Screenshot mode: target động = giữa tủ (Y = height/2) → tủ cao/thấp
              đều fit frame. enabled=false: không user interaction. */}
          {isShot && (
            <OrbitControls
              target={[0, Number(values.height ?? 1800) / 2, 0]}
              enabled={false}
            />
          )}
        </Canvas>
      </div>
    </div>
  );
}

/**
 * Tính camera position + FOV cho screenshot.
 *
 * Design quyết định (founder duyệt):
 *  - **Baseline 2400mm**: distance FIXED tính cho tủ cao 2400mm fill 0.85 chiều cao
 *    thumbnail. Tủ thấp hơn → tự nhiên nhỏ hơn → sense of scale catalog.
 *  - Công thức: d = (BASELINE/FILL/2) / tan(FOV_half_rad).
 *    Với FOV=25°, BASELINE=2400, FILL=0.85 → d ≈ 6360mm.
 *  - Camera Y SCALE theo height tủ (camY = h/2 + h*0.15) → tilt nhẹ above center
 *    invariant qua mọi cabinet → "cân đối" cảm giác giống nhau.
 *  - 3 góc đối xứng trục Y:
 *    · 'iso-front-right': X+ Z+ (góc phải)
 *    · 'front':           chính diện X=0 Z+
 *    · 'iso-front-left':  X- Z+ (góc trái)
 */
// ── RECORD MODE types + helpers (clip 15s) ───────────────────────────────────
interface RecordCam {
  /** Góc orbit quanh trục đứng: 0 = chính diện, + = quay sang phải (độ). */
  azimuthDeg: number;
  /** Nhân khoảng cách camera (1 = vừa khung; >1 = lùi ra; <1 = đẩy vào). */
  distScale: number;
  /** FOV dọc (độ). 18 = tele → cạnh đứng song song, ít méo phối cảnh. */
  fov: number;
  /** (oneshot) Bán kính envelope CỐ ĐỊNH để fit (mm) → khoảng cách camera KHÔNG đổi
   *  theo kích thước tủ → tủ NỞ RA / THU LẠI thật trong khung khi biến hình. Vắng →
   *  fit bounding-sphere mỗi frame (luôn đầy khung). */
  fitMm?: number;
}
type RecordOpen =
  | { kind: 'none' }
  | { kind: 'all'; value: number; only?: 'door' | 'drawer' }
  | { kind: 'wave'; t: number; stagger: number; axis: 'col' | 'row'; reverse?: boolean; only?: 'door' | 'drawer' };
interface RecordFrame {
  values?: Partial<ParamValues>;
  cam?: Partial<RecordCam>;
  open?: RecordOpen;
  /** Record: override màu thân kệ (hex) → "quét màu" mượt. null = trả màu enum gốc. */
  tint?: { hex: string; roughness?: number; metalness?: number } | null;
}
interface KeRecordWindow extends Window {
  __keApplyFrame?: (f: RecordFrame) => void;
  __keCaptureFrame?: () => string;
  __keReady?: boolean;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth01 = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

/**
 * Trạng thái mở (0..1) của 1 cánh/ngăn kéo ở ô (row,col) cho record mode.
 *  - 'all'  → mọi ô cùng giá trị (lọc theo `only` nếu chỉ muốn door hoặc drawer).
 *  - 'wave' → "làn sóng": ô lệch pha theo vị trí dọc trục (col hoặc row); `t` 0→1
 *             chạy sóng qua lưới, `stagger` (0..0.95) = độ trễ giữa đầu↔cuối.
 */
function recordOpenProgress(
  spec: RecordOpen,
  kind: 'door' | 'drawer',
  row: number,
  col: number,
  cols: number,
  rows: number,
): number {
  if (spec.kind === 'none') return 0;
  if (spec.only && spec.only !== kind) return 0;
  if (spec.kind === 'all') return clamp01(spec.value);
  const n = spec.axis === 'row' ? rows : cols;
  const idx = spec.axis === 'row' ? row : col;
  let p = n > 1 ? idx / (n - 1) : 0;
  if (spec.reverse) p = 1 - p;
  const stagger = Math.min(0.95, Math.max(0, spec.stagger));
  const span = 1 - stagger || 1;
  return smooth01((spec.t - p * stagger) / span);
}

/**
 * Camera ORBIT cho record (clip): tái dùng đúng công thức fit (bounding sphere) +
 * tầm mắt cố định 1400mm + lens-shift của computeScreenshotCamera (giữ cạnh đứng
 * THẲNG = "tối giản cao cấp"), nhưng azimuth LIÊN TỤC + dolly (distScale) thay vì
 * 3 góc rời rạc. centerY = H/2 do ScreenshotCameraRig lo (lens-shift).
 */
function computeRecordCamera(
  width: number,
  height: number,
  depth: number,
  cam: RecordCam,
): { position: [number, number, number]; fov: number; near: number; far: number } {
  const FRAME_FILL = 0.82;
  const FOV = cam.fov;
  const fovHalfRad = (FOV / 2) * (Math.PI / 180);
  // fitMm (oneshot): fit theo envelope CỐ ĐỊNH → khoảng cách không đổi → thấy tủ nở/thu.
  const r = cam.fitMm ?? 0.5 * Math.sqrt(width * width + height * height + depth * depth);
  const dist = (r / Math.sin(fovHalfRad) / FRAME_FILL) * cam.distScale;
  const centerY = height / 2;
  const EYE_HEIGHT = 1400;
  const camY = EYE_HEIGHT;
  const dyWorld = centerY - camY;
  const horiz = Math.sqrt(Math.max(dist * dist - dyWorld * dyWorld, (0.3 * dist) ** 2));
  const az = (cam.azimuthDeg * Math.PI) / 180;
  const x = Math.sin(az) * horiz;
  const z = Math.cos(az) * horiz;
  return { position: [x, camY, z], fov: FOV, near: 100, far: 30000 };
}

function computeScreenshotCamera(
  width: number,
  height: number,
  depth: number,
  angle: 'iso-front-right' | 'front' | 'iso-front-left',
): { position: [number, number, number]; fov: number; near: number; far: number } {
  // UNIFORM FRAMING — mỗi cabinet fill ~85% frame của RIÊNG NÓ (catalog pattern
  // Tylko/IKEA). distance scale theo max dim từng tủ → Compact, Loft, Tall đều
  // trông to xấp xỉ nhau trong tile. Mất sense of real-scale nhưng grid cân đối.
  //
  // P25 — FRAMING TỰ ĐỘNG CÂN ĐỐI cho MỌI kích thước (W×H×D bất kỳ):
  //
  // Fit theo BOUNDING SPHERE của khối tủ thay vì max(w,h). Khối tủ chiếm
  //   x∈[-W/2, W/2] · y∈[0, H] · z∈[-D/2, D/2]
  // → tâm = (0, H/2, 0); bán kính r = ½·√(W²+H²+D²). Sphere BẤT BIẾN theo góc
  // xoay/độ sâu → đảm bảo tủ rộng-thấp, cao-hẹp, to, nhỏ ĐỀU vừa khung + canh
  // giữa, lề đều, KHÔNG BAO GIỜ bị cắt. Đây là cách "frame-to-fit" chuẩn của 3D
  // viewer, áp cho thumbnail để mọi preset/đơn hàng tự cân.
  //
  // Khoảng cách để sphere lấp FILL khung: dist = r / sin(FOV/2) / FILL.
  // FOV 18° = ống TELE → đứng xa + zoom → ít méo phối cảnh (cạnh đứng song song).
  const FRAME_FILL = 0.82;
  const FOV = 18;
  const fovHalfRad = (FOV / 2) * (Math.PI / 180);

  const r = 0.5 * Math.sqrt(width * width + height * height + depth * depth);
  const dist = r / Math.sin(fovHalfRad) / FRAME_FILL;
  const centerY = height / 2;

  // P32 — TẦM MẮT CỐ ĐỊNH 1400mm (nhất quán mọi preset — founder yêu cầu). Camera
  // nhìn NGANG (rig lookAt cùng cao độ) → trục nhìn song song sàn → cạnh đứng
  // THẲNG TẮP. Vì tâm tủ (H/2) thường KHÁC 1400 → rig dùng LENS-SHIFT (dịch khung
  // theo phương đứng) để tủ vẫn CANH GIỮA mà KHÔNG cần chúc camera (= không nghiêng).
  // horiz = cạnh ngang sao cho khoảng cách tới tâm sphere == dist (giữ fit).
  const EYE_HEIGHT = 1400;
  const camY = EYE_HEIGHT;
  const dyWorld = centerY - camY;
  const horiz = Math.sqrt(Math.max(dist * dist - dyWorld * dyWorld, (0.3 * dist) ** 2));

  // Góc iso giữ tỉ lệ 0.65:0.75 (≈40.9° lệch khỏi trục trước), chuẩn hoá về |horiz|.
  const isoLen = Math.hypot(0.65, 0.75);
  const ix = (0.65 / isoLen) * horiz;
  const iz = (0.75 / isoLen) * horiz;
  const positions: Record<typeof angle, [number, number, number]> = {
    'iso-front-right': [ix, camY, iz],
    'front': [0, camY, horiz],
    'iso-front-left': [-ix, camY, iz],
  };
  return { position: positions[angle], fov: FOV, near: 100, far: 30000 };
}

/** 3-point studio lighting cho screenshot mode — key + fill + rim. */
function ScreenshotLighting() {
  return (
    <>
      {/* P65 — TẠO KHỐI: IBL studio (RoomEnvironment) cho chuyển sáng-tối mềm đa
          hướng + sheen matte → mặt tủ hết "bệt". Hạ ambient 2.5→0.85 (ambient cao
          triệt tiêu khối); IBL + key/fill bù lại độ sáng. Giữ NeutralToneMapping
          → màu vẫn sát hex swatch (đặt hàng chuẩn); ấm CHỈ đến từ nền composite. */}
      <SceneIBL intensity={0.4} />
      <ambientLight intensity={0.85} />
      {/* Key — P33 castShadow lại (đổ bóng mềm trên sàn studio). Cao + hơi lệch
          phải-trước → bóng đổ xuống-trái-sau, mềm (shadow-radius 14). shadowMaterial
          không bị ambient 2.5 wash (đổ bóng theo opacity cố định). */}
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
      {/* Fill từ trái — kéo mặt khuất lên, GIỮ chuyển sáng-tối (không xoá khối). */}
      <directionalLight position={[-4000, 2500, 3000]} intensity={0.5} />
      {/* Rim sau — tách nhẹ khỏi nền. */}
      <directionalLight position={[0, 3000, -3500]} intensity={0.35} />
    </>
  );
}

/**
 * P54 — 1 hàng "kích thước cột" trong tab Chiều rộng: tên cột + ô NHẬP SỐ (commit
 * khi blur/Enter, clamp [min,max]) + slider (áp ngay). Local text state để gõ trọn
 * số trước khi áp (tránh nhảy giữa chừng); đồng bộ lại khi `value` đổi từ ngoài
 * (vd kéo tổng / chỉnh cột khác). Focus → onFocus (highlight cột trên 3D).
 */
function ColSizeRow({
  index,
  value,
  min,
  max,
  active,
  onFocus,
  onCommit,
}: {
  index: number;
  value: number;
  min: number;
  max: number;
  active: boolean;
  onFocus: () => void;
  onCommit: (v: number) => void;
}) {
  const [text, setText] = useState(String(Math.round(value)));
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // P54f: cờ ĐANG GÕ — khi focus thì không để value ngoài ghi đè chữ (gõ số mobile không nhảy).
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!focusedRef.current) setText(String(Math.round(value)));
  }, [value]);
  useEffect(() => () => {
    if (debRef.current != null) clearTimeout(debRef.current);
  }, []);
  // P54f: ÁP-SỐNG khi đang gõ — chỉ đổi hình học (onCommit), KHÔNG đụng chữ trong ô.
  // Số dưới min coi như gõ dở → chưa áp (tránh cột co về min giữa chừng).
  const applyVal = (t: string) => {
    const n = Math.round(Number(t));
    if (t.trim() === '' || !Number.isFinite(n) || n < min) return;
    onCommit(Math.min(max, n));
  };
  // Blur / Enter: CHỐT cuối — kẹp đủ min↔max + đồng bộ chữ.
  const commitVal = (t: string) => {
    focusedRef.current = false;
    if (debRef.current != null) {
      clearTimeout(debRef.current);
      debRef.current = null;
    }
    const n = Math.round(Number(t));
    const valid = t.trim() !== '' && Number.isFinite(n);
    const clamped = Math.max(min, Math.min(max, valid ? n : value));
    onCommit(clamped);
    setText(String(clamped));
  };
  // P54f: gõ → cập nhật chữ + TỰ ÁP sau 0.7s ngừng gõ (mobile khỏi phải bấm ra ngoài).
  const onText = (t: string) => {
    setText(t);
    if (debRef.current != null) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => applyVal(t), 700);
  };
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-1.5 py-1 transition ${
        active ? 'bg-[var(--color-accent-bg)]' : ''
      }`}
    >
      <span className="w-10 shrink-0 text-[11px] font-viet text-[var(--color-accent)]">
        Cột {index + 1}
      </span>
      <input
        type="number"
        inputMode="numeric"
        enterKeyHint="done"
        value={text}
        min={min}
        max={max}
        onFocus={() => {
          focusedRef.current = true;
          onFocus();
        }}
        onChange={(e) => onText(e.target.value)}
        onBlur={() => commitVal(text)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        // P54e: text-[16px] ở mobile → iOS Chrome không auto-zoom khi focus.
        className="w-16 shrink-0 rounded border border-[var(--color-accent)]/25 bg-[var(--color-bg)] px-1.5 py-1 text-right text-[16px] md:text-xs tabular-nums text-[var(--color-accent)]"
      />
      <span className="shrink-0 text-[10px] text-[var(--color-accent)]/45">mm</span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={Math.round(value)}
        onFocus={onFocus}
        onChange={(e) => onCommit(Number(e.target.value))}
        className="ke-slider min-w-0 flex-1"
      />
    </div>
  );
}

/** 1 núm: 'number' → thanh trượt, 'option' → hàng nút (kèm ô màu nếu là vật liệu). */
function ParamControl({
  param,
  value,
  onChange,
}: {
  param: Parameter;
  value: number | string;
  onChange: (id: string, value: number | string) => void;
}) {
  if (param.type === 'number') {
    return <NumberControl param={param} value={value} onChange={onChange} />;
  }

  if (param.type === 'cellgrid') {
    return <CellGridControl param={param} value={value} onChange={onChange} />;
  }

  // P36: 'info' → dòng gợi ý (tab tồn tại, thao tác chính trên 3D).
  if (param.type === 'info') {
    return (
      <p className="text-xs md:text-sm text-[var(--color-accent)]/70 font-viet leading-relaxed">
        {param.label}
      </p>
    );
  }

  // P12.4/P19: 2 patterns dựa trên option values:
  //  - MATERIAL picker (vd "Vật liệu khung"): values dạng "catalog/id" → LIST
  //    hàng ngang (swatch trái + tên ĐẦY ĐỦ phải), solid màu (không gạch chéo).
  //  - TOGGLE / option đơn giản (vd widthMode 'even'/'manual'): pill button text.
  const isMaterialPicker = param.options?.some((o) => o.value.includes('/')) ?? false;
  // P52: "Dán cạnh" cũng render dạng lưới SWATCH MÀU (17 màu nẹp), không phải toggle.
  const isEdgePicker = param.id === 'edgeBanding';

  if (isMaterialPicker || isEdgePicker) {
    return (
      <div>
        <label className="mb-1 md:mb-3 block text-xs md:text-sm font-medium text-[var(--color-accent)] font-viet">
          {param.label}
        </label>
        {/* P19: GRID 2 cột — swatch + tên (tên dài wrap 2 dòng, không cắt).
            Solid hex (bỏ diagonal cạnh đen — đồng bộ CellBar màu ô). Scroll dọc. */}
        <div className="grid grid-cols-2 gap-1 max-h-[340px] max-md:max-h-[220px] overflow-y-auto pr-0.5">
          {param.options?.map((opt) => {
            const active = value === opt.value;
            // P52: ô "Dán cạnh" → swatch = màu nẹp (edgeHexForBand). 'same' (đồng màu,
            // không hex) → swatch gạch chéo nhạt báo "theo màu ván".
            const edgeHex = isEdgePicker ? edgeHexForBand('', opt.value) : undefined;
            const swStyle: CSSProperties = isEdgePicker
              ? edgeHex
                ? { backgroundColor: edgeHex }
                : { background: 'linear-gradient(135deg, #e2ded7 50%, #ffffff 50%)' }
              : swatchCss(opt.value, resolveMaterial(opt.value).hex);
            return (
              <SwatchOption key={opt.value} swatchStyle={swStyle} label={opt.label} active={active} onClick={() => onChange(param.id, opt.value)} />
            );
          })}
        </div>
      </div>
    );
  }

  // P13.2: TOGGLE — segmented control style. 2 button connected, 1 active có
  // background accent + shadow. Trông cleaner than pill style trước đó.
  return (
    <div>
      <label className="mb-1 md:mb-2 block text-xs md:text-sm font-medium text-[var(--color-accent)] font-viet">
        {param.label}
      </label>
      <Segmented
        className="max-w-xs"
        options={param.options ?? []}
        value={value as string}
        onChange={(v) => onChange(param.id, v)}
        ariaLabel={param.label}
      />
    </div>
  );
}

/** Chọn màu nét vẽ tương phản với màu nền ô (sơn tủ): nền sáng → nét tối, nền tối → nét sáng. */
function pickContrast(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length < 6) return '#1a1a1a';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b; // độ sáng cảm nhận
  return lum > 145 ? '#1a1a1a' : '#f4f4f4';
}

/** Làm tối 1 màu hex theo hệ số (0–1) — vẽ nét chia lưới "đúng màu ván nhưng đậm hơn". */
function darken(hex: string, factor: number): string {
  const h = hex.replace('#', '');
  if (h.length < 6) return hex;
  const ch = (i: number) => Math.round(parseInt(h.slice(i, i + 2), 16) * factor);
  const hx = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${hx(ch(0))}${hx(ch(2))}${hx(ch(4))}`;
}

/**
 * Ký hiệu kỹ thuật vẽ chồng lên ô — nét KẺ BÁM ĐÚNG CÁC GÓC ô, co giãn theo ô:
 *  - door   → tam giác: 2 nét từ 2 góc cạnh tay nắm về giữa cạnh bản lề
 *  - drawer → 2 đường chéo của ô (chữ X)
 *  - open-back / open-nobk → KHÔNG ký hiệu (phân biệt bằng màu nền: sơn ↔ trắng)
 */
function CellSymbol({ type, stroke }: { type: string; stroke: string }) {
  const cls = 'pointer-events-none absolute inset-0 h-full w-full';
  const line = (points: string) => (
    <polyline
      points={points}
      fill="none"
      stroke={stroke}
      strokeWidth={1.6}
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
  );
  // Cánh đơn — bản lề mép TRÁI: tam giác đỉnh trái (tay nắm phải).
  // 'door' (giá trị gốc, chưa có hint variant) cũng vẽ dạng này — tương thích ngược.
  if (type === 'door' || type === 'door-L') {
    return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={cls}>
        {line('100,0 0,50 100,100')}
      </svg>
    );
  }
  // Cánh đơn — bản lề mép PHẢI: tam giác đỉnh phải (tay nắm trái).
  if (type === 'door-R') {
    return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={cls}>
        {line('0,0 100,50 0,100')}
      </svg>
    );
  }
  // Cánh ĐÔI: 2 tam giác đỉnh quay vào TRỤC GIỮA (bản lề 2 mép ngoài) + 1 nét chia
  // dọc ở giữa thân để phân biệt khỏi chữ X của ngăn kéo (chuẩn iconography ngành).
  if (type === 'door-double') {
    return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={cls}>
        {line('0,0 50,50 0,100')}
        {line('100,0 50,50 100,100')}
        {line('50,0 50,100')}
      </svg>
    );
  }
  if (type === 'drawer') {
    return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={cls}>
        <path
          d="M0 0 L100 100 M100 0 L0 100"
          fill="none"
          stroke={stroke}
          strokeWidth={1.6}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }
  return null; // open-back / open-nobk → không vẽ ký hiệu
}

/** Menu nhỏ bật ngay tại ô để chọn (loại HOẶC màu) — mục bị cấm hiển thị mờ.
 *  flipLeft: cell ở 2 cột phải cùng → menu dạt sang trái để không tràn.
 *  flipUp: cell ở 2 hàng dưới cùng → menu bật LÊN TRÊN thay vì xuống (mobile drawer max-h-[80vh] dễ clip). */
function CellMenu({
  opts,
  current,
  banned,
  bgOf,
  isColor,
  flipLeft,
  flipUp,
  onPick,
}: {
  opts: { value: string; label: string }[];
  current: string;
  banned: string[];
  bgOf: (value: string) => string;
  isColor: boolean;
  flipLeft: boolean;
  flipUp: boolean;
  onPick: (value: string) => void;
}) {
  return (
    <div
      className={`absolute z-50 max-h-64 w-44 overflow-y-auto overflow-x-hidden rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-bg)] shadow-lg ${
        flipLeft ? 'right-0' : 'left-0'
      } ${flipUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}
    >
      {opts.map((o) => {
        const isBanned = banned.includes(o.value);
        const isCurrent = o.value === current;
        const bg = bgOf(o.value);
        return (
          <button
            key={o.value}
            type="button"
            disabled={isBanned}
            onClick={() => onPick(o.value)}
            className={`flex w-full items-center gap-2 px-2 py-2.5 md:py-1.5 text-left text-xs transition ${
              isBanned
                ? 'cursor-not-allowed text-[var(--color-accent)]/30'
                : isCurrent
                  ? 'bg-[var(--color-surface-2)] font-medium text-[var(--color-ink)]'
                  : 'text-[var(--color-accent)] hover:bg-[var(--color-accent-bg)]'
            }`}
          >
            <span
              className="relative inline-block h-5 w-7 shrink-0 rounded-sm border border-[var(--color-accent)]/30"
              style={{ ...swatchCss(o.value, bg), opacity: isBanned ? 0.45 : 1 }}
            >
              {!isColor && !isBanned && <CellSymbol type={o.value} stroke={pickContrast(bg)} />}
            </span>
            <span className="flex-1">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Khít lưới trong khung này (px) — sidebar hẹp nên giữ gọn; panel có thể cuộn.
const GRID_MAX_W = 312;
const GRID_MAX_H = 360;

/**
 * Lưới "MẶT ĐỨNG tủ": ô đúng tỉ lệ rộng×cao thật (colSizes/rowSizes); nét chia =
 * màu ván đậm. Hai biến thể (param.cellVariant): 'type' = chọn loại ô (nền sơn/
 * trắng + ký hiệu kỹ thuật); 'color' = chọn màu ô (nền = màu đã chọn, không ký hiệu).
 * Bấm 1 ô → menu nhỏ bật ngay tại ô.
 */
function CellGridControl({
  param,
  value,
  onChange,
}: {
  param: Parameter;
  value: number | string;
  onChange: (id: string, value: number | string) => void;
}) {
  const [open, setOpen] = useState<{ r: number; c: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const rows = param.gridRows ?? 0;
  const cols = param.gridCols ?? 0;
  const opts = param.options ?? [];
  const tint = param.tint ?? '#e7e5df';
  const isColor = param.cellVariant === 'color';
  const grid = parseCellGrid(String(value));

  // Màu nền 1 ô: lưới màu → màu đã chọn (opt[0] "Theo khung" = tint); lưới loại → sơn/trắng.
  const bgOf = (v: string): string => {
    if (isColor) return v === opts[0]?.value ? tint : resolveMaterial(v).hex;
    return v === 'open-nobk' ? '#ffffff' : tint;
  };

  // Kích thước ô = kích thước thật (mm) → đơn vị fr của CSS Grid.
  const colSizes = param.colSizes?.length ? param.colSizes : Array.from({ length: cols }, () => 1);
  const rowSizes = param.rowSizes?.length ? param.rowSizes : Array.from({ length: rows }, () => 1);
  const sumW = colSizes.reduce((s, w) => s + w, 0) || 1;
  const sumH = rowSizes.reduce((s, h) => s + h, 0) || 1;
  // Co lưới vừa khít GRID_MAX_W×GRID_MAX_H mà giữ ĐÚNG tỉ lệ thật của tủ.
  const scale = Math.min(GRID_MAX_W / sumW, GRID_MAX_H / sumH);

  // Đóng menu khi bấm ra ngoài lưới hoặc nhấn Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function setCell(r: number, c: number, next: string) {
    const g = grid.map((row) => [...row]);
    if (!g[r]) g[r] = [];
    g[r][c] = next;
    onChange(param.id, encodeCellGrid(g));
    setOpen(null);
  }

  return (
    <div ref={rootRef}>
      <label className="mb-3 block text-xs md:text-sm font-medium text-[var(--color-accent)] font-viet">{param.label}</label>
      <div className="flex justify-center bg-[var(--color-surface-2)] p-3 rounded-md border border-[var(--color-accent)]/15">
        <div
          className="grid gap-[3px]"
          style={{
            gridTemplateColumns: colSizes.map((w) => `${w}fr`).join(' '),
            // rowSizes[0] = tầng dưới cùng → đảo lại để hàng UI trên cùng = tầng trên.
            gridTemplateRows: [...rowSizes].reverse().map((h) => `${h}fr`).join(' '),
            width: sumW * scale,
            height: sumH * scale,
            padding: 3, // viền ngoài = đúng nét chia giữa ô → lưới dạng table
            backgroundColor: darken(tint, 0.55), // nét chia + viền = màu ván đậm
          }}
        >
          {Array.from({ length: rows * cols }, (_, idx) => {
            const r = rows - 1 - Math.floor(idx / cols); // tầng thật (UI vẽ trên→dưới)
            const c = idx % cols;
            const v = grid[r]?.[c] ?? opts[0]?.value ?? '';
            const banned = [
              ...(param.disabledByRow?.[r] ?? []),
              ...(param.disabledByCol?.[c] ?? []),
            ];
            const isOpen = open?.r === r && open?.c === c;
            // Ô KHOÁ (vd ô "mở không hậu" trong lưới màu) → vẽ trắng, không bấm được.
            const locked = param.lockedCells?.[r]?.[c] ?? false;
            const bg = locked ? '#ffffff' : bgOf(v);
            // Symbol vẽ trên ô: DNA có thể override bằng cellSymbolByPosition (vd
            // 'door-L'/'door-R'/'door-double' để phân biệt hướng + cánh đơn/đôi).
            // Không có override → dùng value như cũ (tương thích sản phẩm cũ).
            const symbol = param.cellSymbolByPosition?.[r]?.[c] ?? v;
            return (
              <div key={idx} className="relative">
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => !locked && setOpen(isOpen ? null : { r, c })}
                  aria-label={
                    `Cột ${c + 1}, tầng ${r + 1}` + (locked ? ' — khoá (ô mở không hậu)' : '')
                  }
                  className={`relative block h-full w-full p-0 transition ${
                    locked
                      ? 'cursor-not-allowed'
                      : isOpen
                        ? 'outline outline-2 outline-[var(--color-accent)]'
                        : 'hover:brightness-95'
                  }`}
                  style={swatchCss(v, bg)}
                >
                  {!isColor && !locked && (
                    <CellSymbol type={symbol} stroke={pickContrast(bg)} />
                  )}
                </button>
                {isOpen && !locked && (
                  <CellMenu
                    opts={opts}
                    current={v}
                    banned={banned}
                    bgOf={bgOf}
                    isColor={isColor}
                    flipLeft={c >= cols - 2}
                    flipUp={r <= 1}
                    onPick={(next) => setCell(r, c, next)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-[var(--color-accent)]/60">
        Bấm 1 ô để chọn — ô đúng tỉ lệ và màu như mặt đứng tủ.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * SavePresetButton — gọi onSavePreset callback từ admin mode. Phase A chỉ stub;
 * Phase C maume admin pass callback wire vào API /api/admin/ke-presets POST.
 * Khi onSavePreset chưa truyền (Phase A standalone) → chỉ console.log + alert.
 * ───────────────────────────────────────────────────────────────────────── */
function SavePresetButton({
  values,
  onSave,
}: {
  values: ParamValues;
  onSave?: (values: ParamValues) => void | Promise<void>;
}) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const handleClick = async () => {
    setStatus('saving');
    try {
      if (onSave) {
        await onSave(values);
      } else {
        // Phase A stub: chưa có maume API → log + alert + stash localStorage tạm
        // để founder vẫn save được drafts trước Phase C.
        const draft = {
          values,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(`ke-preset-draft-${Date.now()}`, JSON.stringify(draft));
        console.log('[ngăn admin] Preset draft saved to localStorage:', draft);
        alert(
          'Phase A: Đã lưu draft vào localStorage. Phase C sẽ wire tới maume API ' +
            'để push lên Cloudflare KV và sync với ke.maume.asia.',
        );
      }
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (err) {
      console.error('[ngăn admin] Save preset error:', err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2500);
    }
  };
  return (
    <section className="border-t border-[var(--color-accent)]/20 pt-4">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === 'saving'}
        className={`w-full rounded-md px-3 py-2.5 text-sm font-medium transition ${
          status === 'saved'
            ? 'bg-[var(--color-accent-bg)] text-[var(--color-accent)] border border-[var(--color-accent)]/40'
            : status === 'error'
              ? 'bg-[var(--color-accent-bg)] text-[var(--color-accent)] border border-[var(--color-accent)]/40'
              : status === 'saving'
                ? 'bg-[var(--color-surface-2)] text-[var(--color-accent)]/80 cursor-wait'
                : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]'
        }`}
      >
        {status === 'saved'
          ? '✓ Đã lưu preset (xem trên /collection)'
          : status === 'error'
            ? '✕ Lỗi lưu — xem console'
            : status === 'saving'
              ? '⏳ Đang lưu...'
              : '💾 Lưu thành preset (admin)'}
      </button>
      <p className="mt-2 text-[11px] text-[var(--color-accent)]/60 leading-relaxed">
        Admin only. Cấu hình hiện tại sẽ được lưu thành preset trên ke.maume.asia
        cho khách xem ở /collection.
      </p>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * P63 — NestingButton (admin): nút "Xem nesting" → popup SVG đơn giản, nhẹ.
 * Tính nestBoards từ cutlist parts + khổ ván catalog NGAY khi bấm (lazy). Mỗi
 * khổ ván = 1 hình chữ nhật, mỗi tấm cắt = 1 ô màu bên trong. Không chi tiết lỗ.
 * ───────────────────────────────────────────────────────────────────────── */
function NestingButton({
  parts,
  boards,
  kerfMm,
}: {
  parts: Part[];
  boards: NonNullable<PriceConfig['boards']>;
  kerfMm: number;
}) {
  const [result, setResult] = useState<NestingResult | null>(null);
  return (
    <section className="border-t border-[var(--color-accent)]/20 pt-4">
      <button
        type="button"
        onClick={() => setResult(nestBoards(parts, boards, kerfMm))}
        className="w-full rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-surface-2)] px-3 py-2.5 text-sm font-medium text-[var(--color-accent)] transition hover:bg-[var(--color-accent-bg)]"
      >
        ▦ Xem nesting (sơ đồ xếp tấm)
      </button>
      {result &&
        createPortal(
          <NestingModal result={result} onClose={() => setResult(null)} />,
          document.body,
        )}
    </section>
  );
}

function NestingModal({ result, onClose }: { result: NestingResult; onClose: () => void }) {
  const pct = (u: number) => `${Math.round(u * 100)}%`;
  const halves = result.boards.filter((b) => (b.fraction ?? 1) === 0.5).length;
  const quarters = result.boards.filter((b) => (b.fraction ?? 1) <= 0.25).length;
  const cutNote = [halves ? `${halves} nửa` : '', quarters ? `${quarters} phần tư` : '']
    .filter(Boolean)
    .join(' · ');
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-[var(--color-ink)]/40 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-[var(--color-bg)] shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-accent)]/15 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-[var(--color-accent)]">Sơ đồ xếp tấm (nesting)</p>
            <p className="text-[11px] text-[var(--color-accent)]/55">
              {result.boards.length} khổ ván · tận dụng TB {pct(result.avgUtilization)}
              {cutNote && ` · ✂ cắt: ${cutNote}`}
              {result.unplaced.length > 0 && ` · ⚠ ${result.unplaced.length} tấm không vừa khổ`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--color-surface-2)] text-lg leading-none text-[var(--color-accent)]/60 transition hover:bg-[var(--color-accent)] hover:text-white"
          >
            ×
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {result.boards.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-accent)]/55">
              Chưa có khổ ván trong catalog (hoặc tủ chưa có tấm để xếp).
            </p>
          ) : (
            result.boards.map((board, i) => (
              <NestingBoardSvg key={`${board.boardId}-${i}`} board={board} index={i} />
            ))
          )}
          {result.unplaced.length > 0 && (
            <div className="rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent-bg)] px-3 py-2 text-[11px] leading-relaxed text-[var(--color-accent)]">
              <p className="font-medium">Tấm KHÔNG xếp được (lớn hơn mọi khổ ván):</p>
              {result.unplaced.map((u, i) => (
                <p key={`${u.id}-${i}`}>
                  • {u.label} — {Math.round(u.length_mm)}×{Math.round(u.width_mm)}mm
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NestingBoardSvg({ board, index }: { board: NestedBoardLayout; index: number }) {
  const MAXW = 280; // px — cạnh dài board hiển thị
  const scale = MAXW / board.boardLength;
  const w = board.boardLength * scale;
  const h = board.boardWidth * scale;
  return (
    <div>
      <p className="mb-1 text-[11px] text-[var(--color-accent)]/60">
        Khổ #{index + 1}: {board.materialId} · {board.thicknessMm}mm ·{' '}
        {Math.round(board.boardLength)}×{Math.round(board.boardWidth)}mm
        {board.fraction && board.fraction < 1 ? (
          <span className="font-semibold text-[var(--color-accent)]">
            {' '}{board.fraction <= 0.25 ? '✂✂ phần tư' : '✂ nửa khổ'}
          </span>
        ) : null}{' '}
        · {board.placements.length} tấm · tận dụng {Math.round(board.utilization * 100)}%
      </p>
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="rounded border border-neutral-300 bg-neutral-50"
      >
        {board.placements.map((p, i) => {
          // rotated: length theo trục Y board → rộng theo X = partWidth, cao theo Y = partLength.
          const rw = (p.rotated ? p.partWidth : p.partLength) * scale;
          const rh = (p.rotated ? p.partLength : p.partWidth) * scale;
          const x = p.x * scale;
          const y = h - (p.y * scale + rh); // lật Y: nesting gốc dưới-trái → SVG gốc trên-trái
          const hue = (i * 47) % 360;
          return (
            <rect
              key={`${p.partId}-${i}`}
              x={x + 0.5}
              y={y + 0.5}
              width={Math.max(0, rw - 1)}
              height={Math.max(0, rh - 1)}
              fill={`hsl(${hue} 70% 88%)`}
              stroke={`hsl(${hue} 55% 52%)`}
              strokeWidth={0.8}
            >
              <title>
                {p.partLabel} — {Math.round(p.partLength)}×{Math.round(p.partWidth)}mm
                {p.rotated ? ' (xoay 90°)' : ''}
              </title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}
