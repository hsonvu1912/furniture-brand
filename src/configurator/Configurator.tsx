'use client';
// =============================================================
// CONFIGURATOR — khung dùng chung cho MỌI sản phẩm.
// Nhận 1 ProductDNA → render: bảng điều khiển (slider/nút) + 3D + giá + bảng cắt.
// Núm điều khiển: dna.resolveControls(values) nếu DNA có (núm động), không thì dna.parameters.
// Engine — chỉ mở rộng khi founder duyệt; thêm sản phẩm = thêm products/<slug>/dna.ts.
// =============================================================
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type {} from '@react-three/fiber';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { NeutralToneMapping, PCFShadowMap, Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import { AssemblyMesh, Dimensions, FittingMesh, Ground, PartMesh, SceneLighting, Wall, computePartAnimation, type AssemblyConfig } from './renderer';
import { resolveMaterial } from './materials';
import { computePrice, formatPrice, type PriceBreakdown } from './pricing';
import { buildCutlist, type Cutlist } from './cutlist';
import { encodeCellGrid, parseCellGrid, reconcileCellGrid } from './cellgrid';
import type { Fitting, ParamValues, Parameter, Part, PriceConfig, ProductDNA } from './types';

// Bóng đổ MỀM: three r184 đã DEPRECATE PCFSoftShadowMap (tự fallback về
// PCFShadowMap + cảnh báo console) → dùng thẳng PCFShadowMap. Độ mềm "ánh sáng
// trong nhà" lấy từ directionalLight: shadow-radius (nhoè mép) + shadow-intensity.
const SHADOW_CONFIG = { enabled: true, type: PCFShadowMap };

/** Giá trị khởi tạo: lấy default của từng Parameter. */
function initialValues(parameters: Parameter[]): ParamValues {
  const values: ParamValues = {};
  for (const p of parameters) values[p.id] = p.default;
  return values;
}

/**
 * Style cho ô màu (swatch) trong picker / cutlist. Nếu material có `edgeHex`
 * khác `hex` → render diagonal 50/50 (top-left = face, bottom-right = edge) để
 * khách biết loại dán cạnh. Vd MDF+AC cạnh đen: face vàng + edge đen. Đồng màu /
 * không có edgeHex → solid 1 màu (hành vi cũ).
 */
function swatchStyle(material: string): CSSProperties {
  const m = resolveMaterial(material);
  if (!m.edgeHex || m.edgeHex === m.hex) return { backgroundColor: m.hex };
  return {
    background: `linear-gradient(135deg, ${m.hex} 50%, ${m.edgeHex} 50%)`,
  };
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

// ============================================================
// DIRECT-3D MANIPULATION (redesign 2026-05) — chạm ô tủ trên 3D để đổi
// kiểu / màu, thay cho lưới 2D trong sidebar.
// ============================================================

/** Bề dày ván khung (mm) — mirror hằng T trong dna.ts. CHỈ dùng để định vị
 *  hitbox vô hình; không tham gia logic build/giá. */
const FRAME_T = 18;

/** 1 ô tủ trong không gian 3D — vị trí tâm + kích thước (mm). */
interface CellBox {
  row: number;
  col: number;
  pos: [number, number, number];
  size: [number, number, number];
}

/**
 * Dựng danh sách ô 3D từ núm cellgrid: dùng `colSizes`/`rowSizes` (kích thước
 * thông thuỷ thật mm, do dna.resolveControls tính sẵn) + bề dày khung FRAME_T.
 * Toạ độ khớp renderer: X giữa = 0, Y = 0 ở sàn, +Z mặt trước.
 *   - col c: trái tủ −W/2, +FRAME_T (ván hông), + Σ ô trước + c·FRAME_T (vách).
 *   - row r: sàn 0, +FRAME_T (ván đáy), + Σ ô dưới + r·FRAME_T (kệ).
 */
function cellBoxes(param: Parameter | undefined, depth: number): CellBox[] {
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
  for (let r = 0; r < rows; r++) {
    let yBottom = FRAME_T;
    for (let k = 0; k < r; k++) yBottom += rowSizes[k] + FRAME_T;
    const cy = yBottom + rowSizes[r] / 2;
    for (let c = 0; c < cols; c++) {
      let xLeft = -W / 2 + FRAME_T;
      for (let k = 0; k < c; k++) xLeft += colSizes[k] + FRAME_T;
      const cx = xLeft + colSizes[c] / 2;
      boxes.push({
        row: r,
        col: c,
        pos: [cx, cy, 0],
        size: [colSizes[c], rowSizes[r], depth + 120],
      });
    }
  }
  return boxes;
}

/** Lớp hộp vô hình phủ mỗi ô — bắt click → biết (row,col). Trong suốt
 *  (opacity 0) nhưng vẫn raycast. R3F `onClick` chỉ fire khi click, không
 *  fire khi kéo (xoay camera) — nên không xung đột OrbitControls. */
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
  onPick: (row: number, col: number) => void;
}) {
  return (
    <group>
      {boxes.map((b) => (
        <mesh
          key={`${b.row}-${b.col}`}
          position={b.pos}
          onClick={(e) => {
            e.stopPropagation();
            onPick(b.row, b.col);
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
  onClose: () => void;
}) {
  const param = tab === 'color' ? cellColorsParam : cellsParam;
  const current = tab === 'color' ? currentColor : currentType;
  const onPick = tab === 'color' ? onPickColor : onPickType;
  // Khi không có cellColorsParam (DNA không opt-in màu từng ô) thì ẩn tab Màu.
  const showColorTab = !!cellColorsParam;
  // Ngăn kéo không cho Chia/Gộp (yêu cầu user). Placeholder Session 7: tất cả disabled.
  const isDrawer = currentType === 'drawer';
  const opts = param?.options ?? [];
  const isColor = tab === 'color';
  const tint = param?.tint ?? '#e7e5df';
  const bannedByRow = param?.disabledByRow?.[row] ?? [];
  const bannedByCol = param?.disabledByCol?.[col] ?? [];
  const banned = [...bannedByRow, ...bannedByCol];
  const locked = param?.lockedCells?.[row]?.[col] ?? false;
  const rowH = param?.rowSizes?.[row];
  const colW = param?.colSizes?.[col];
  const bgOf = (v: string): string => {
    if (isColor) return v === opts[0]?.value ? tint : resolveMaterial(v).hex;
    return v === 'open-nobk' ? '#ffffff' : tint;
  };
  const tabBtn = (id: 'type' | 'color', label: string) => (
    <button
      type="button"
      onClick={() => onTabChange(id)}
      aria-pressed={tab === id}
      className={`rounded-full px-3 md:px-4 py-1 md:py-1.5 text-[11px] md:text-xs font-medium tracking-wide transition ${
        tab === id
          ? 'bg-[var(--color-accent)] text-white'
          : 'text-[var(--color-accent)]/70 hover:bg-[var(--color-accent-bg)]'
      }`}
    >
      {label}
    </button>
  );
  const actionBtn = (
    key: string,
    label: string,
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
      className={`rounded-md border border-[var(--color-accent)]/30 px-2 py-1 text-[11px] md:text-xs font-medium tracking-wide transition ${
        disabled
          ? 'cursor-not-allowed opacity-40 text-[var(--color-accent)]/50'
          : 'bg-[var(--color-surface-2)] text-[var(--color-accent)] hover:bg-[var(--color-accent-bg)]'
      }`}
    >
      {label}
    </button>
  );
  // Placeholder S7: chia/gộp chưa active. S9-S10 sẽ wire vào setCell logic.
  const splitTitle = isDrawer
    ? 'Ngăn kéo không thể chia'
    : 'Sẽ có trong session 9-10';
  const mergeTitle = isDrawer
    ? 'Ngăn kéo không thể gộp'
    : 'Sẽ có trong session 9-10';
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col gap-1.5 border-t border-[var(--color-accent)]/20 bg-[var(--color-bg)]/95 px-1.5 py-1.5 backdrop-blur">
      {/* Hàng trên: tab Kiểu/Màu + thanh action Chia/Gộp + nút Đóng. */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 rounded-full border border-[var(--color-accent)]/30 p-0.5">
          {tabBtn('type', 'Kiểu ô')}
          {showColorTab && tabBtn('color', 'Màu ô')}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-accent)]/50 px-1">
            Chia
          </span>
          {actionBtn('split-v', '⫴ Dọc', splitTitle, () => {}, true)}
          {actionBtn('split-h', '☰ Ngang', splitTitle, () => {}, true)}
          <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-accent)]/50 px-1 ml-1">
            Gộp
          </span>
          {actionBtn('merge-up', '↑', mergeTitle, () => {}, true)}
          {actionBtn('merge-down', '↓', mergeTitle, () => {}, true)}
          {actionBtn('merge-left', '←', mergeTitle, () => {}, true)}
          {actionBtn('merge-right', '→', mergeTitle, () => {}, true)}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="ml-auto shrink-0 px-1.5 text-lg leading-none text-[var(--color-accent)]/60 hover:text-[var(--color-accent)]"
        >
          ×
        </button>
      </div>
      {/* Hàng dưới: options của tab đang chọn. */}
      {locked && isColor ? (
        <p className="px-2 py-4 text-center text-xs text-[var(--color-accent)]/60">
          Ô mở-không-hậu không có vật liệu để đổi.
        </p>
      ) : (
        <div className="flex-1 overflow-x-auto">
          <div className="mx-auto flex w-max gap-3 md:gap-4 px-1 items-start">
            {opts.map((o) => {
              const isBanned = banned.includes(o.value);
              const isCurrent = o.value === current;
              const bg = bgOf(o.value);
              const reason = isBanned
                ? getDisabledReason(o.value, {
                    bannedByRow: bannedByRow.includes(o.value),
                    bannedByCol: bannedByCol.includes(o.value),
                    rowH,
                    colW,
                  })
                : null;
              return (
                <div key={o.value} className="flex w-[136px] md:w-[148px] shrink-0 flex-col items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isBanned}
                    onClick={() => onPick(o.value)}
                    className={`flex w-full flex-col items-center gap-1 rounded-lg px-2 py-2 transition ${
                      isBanned
                        ? 'cursor-not-allowed opacity-50'
                        : isCurrent
                          ? 'bg-[var(--color-accent)] text-white'
                          : 'bg-[var(--color-surface-2)] text-[var(--color-accent)] hover:bg-[var(--color-accent-bg)]'
                    }`}
                  >
                    <span
                      className="relative inline-block h-6 w-9 shrink-0 rounded border border-[var(--color-accent)]/30"
                      style={{ backgroundColor: bg }}
                    >
                      {!isColor && !isBanned && (
                        <CellSymbol type={o.value} stroke={pickContrast(bg)} />
                      )}
                    </span>
                    <span className="text-center text-[11px] leading-tight">
                      {o.label}
                    </span>
                  </button>
                  {reason && (
                    <p className="w-full px-0.5 text-center text-[11px] leading-[1.3] italic text-[var(--color-accent)]/70 font-viet">
                      {reason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Hộp cảnh báo (hổ phách) — hiện các câu do dna.getWarnings trả về. */
function WarningBox({ warnings }: { warnings: string[] }) {
  return (
    <div className="rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent-bg)] p-3 text-xs leading-relaxed text-[var(--color-accent)]">
      <p className="mb-0.5 font-semibold">Cảnh báo kích thước</p>
      {warnings.map((w, i) => (
        <p key={i} className={i > 0 ? 'mt-1' : undefined}>
          {w}
        </p>
      ))}
    </div>
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
  useEffect(() => setText(String(num)), [num]);

  const commit = () => {
    if (text === String(num)) return; // không đổi gì → bỏ qua
    if (text.trim() === '' || !Number.isFinite(Number(text))) {
      setText(String(num)); // gõ rỗng / không phải số → trả lại giá trị cũ
      return;
    }
    const snapped = Math.round((Number(text) - min) / step) * step + min;
    const clamped = Math.min(Math.max(snapped, min), max);
    setText(String(clamped));
    if (clamped !== num) onChange(param.id, clamped);
  };

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium text-[var(--color-accent)] font-viet">
          {param.label}
        </label>
        <span className="flex items-center gap-1.5">
          <input
            type="text"
            inputMode="numeric"
            aria-label={`${param.label} — nhập số`}
            className="w-[60px] md:w-[56px] bg-[var(--color-accent-bg)] border border-[var(--color-accent)]/20 rounded-md px-2 py-1 text-center text-sm tabular-nums text-accent font-medium focus:border-[var(--color-accent)] focus:bg-[var(--color-bg)] focus:outline-none max-md:min-h-[36px] transition-colors"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
          {param.unit && (
            <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-accent)]/60 font-medium shrink-0">
              {param.unit}
            </span>
          )}
        </span>
      </div>
      <input
        type="range"
        className="w-full accent-[var(--color-accent)] max-md:h-7"
        min={min}
        max={max}
        step={step}
        value={num}
        onChange={(e) => onChange(param.id, Number(e.target.value))}
      />
      <p className="mt-1.5 text-[10px] uppercase tracking-[0.15em] tabular-nums text-[var(--color-accent)]/50 font-medium">
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
}: {
  dna: ProductDNA;
  initialValues?: Partial<ParamValues>;
  mode?: 'interactive' | 'screenshot' | 'admin' | 'public';
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
}) {
  const isShot = mode === 'screenshot';
  const isAdmin = mode === 'admin';
  // ExportConfigButton đã REMOVED (founder không còn dùng dev tool này — đã có
  // proper admin Save preset flow tại admin.maume.asia/ke).
  // "Lưu preset" button chỉ admin (sau Phase C wire vào API).
  const showSavePreset = isAdmin;
  // "Đặt hàng" button cho khách hàng end-user — interactive + public, NOT screenshot/admin.
  const showOrderButton = !isShot && !isAdmin;
  const [values, setValues] = useState<ParamValues>(() => {
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
    return dna.normalizeValues ? dna.normalizeValues(merged) : merged;
  });

  // Redesign 2026-05: bỏ wizard + drawer kéo. Layout cố định — 3D LUÔN hiện,
  // panel chỉ chứa Kích thước. Thuộc tính ô + màu thao tác THẲNG trên 3D.
  // S7 (2026-05-27): bỏ EditModeToggle bên ngoài, gộp cả 2 tab (Kiểu/Màu) vào
  // CellBar (popup neo bottom) — switch tab giữ ô đang chọn.
  // Mobile: panel hiện dạng tab ngang (Rộng/Cao/Sâu/Vật liệu khung) — click
  // tab nào chỉnh nhóm đó, giảm scroll. Desktop bỏ qua (mọi nhóm xếp dọc).
  const [activeTab, setActiveTab] = useState(0);
  // cellPopup: ô đang mở popup chọn (null = không mở).
  const [cellPopup, setCellPopup] = useState<{ row: number; col: number } | null>(null);
  // cellTab: tab hiện trong CellBar — lifted ở đây để animation "mở cánh"
  // (open=1 ở tab Kiểu, open=0 ở tab Màu) đồng bộ với UI. Reset về 'type'
  // mỗi khi user click ô mới.
  const [cellTab, setCellTab] = useState<'type' | 'color'>('type');

  // Danh sách núm: động (resolveControls) nếu DNA có, tĩnh nếu không.
  // Truyền `ctx.materialLabels` từ priceConfig → DNA tự gán label vật liệu từ
  // catalog (single source). Không truyền override sau ở đây nữa — DNA quyết.
  // enabledMaterials (nếu có): ẩn option màu ("catalog/id") không được bật.
  const controls = useMemo(() => {
    const ctx = priceConfig?.materialLabels
      ? { materialLabels: priceConfig.materialLabels }
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
  }, [dna, values, enabledMaterials, priceConfig?.materialLabels]);
  // Panel CHỈ render núm KHÔNG phải cellgrid (kích thước + vật liệu khung).
  // 2 núm cellgrid (cells/cellColors) vẫn nằm trong `controls` → vẫn feed
  // intentValues/build; chỉ KHÔNG vẽ ở panel — thao tác thẳng trên 3D.
  const sections = useMemo(
    () => groupControls(controls.filter((c) => c.type !== 'cellgrid')),
    [controls],
  );
  // 2 núm cellgrid tách riêng cho lớp tương tác 3D — CellBar nhận cả 2 để
  // switch tab Kiểu/Màu trong cùng popup mà không cần state ngoài.
  const cellsParam = useMemo(() => controls.find((c) => c.id === 'cells'), [controls]);
  const colorsParam = useMemo(() => controls.find((c) => c.id === 'cellColors'), [controls]);
  // Hộp 3D vô hình phủ mỗi ô — bắt click chọn ô.
  const cellHitBoxes = useMemo(
    () => cellBoxes(cellsParam, Number(values.depth ?? 350)),
    [cellsParam, values.depth],
  );
  // Ô đang mở popup → hộp 3D + giá trị hiện tại (kiểu & màu) của ô đó.
  const popupBox = cellPopup
    ? cellHitBoxes.find((b) => b.row === cellPopup.row && b.col === cellPopup.col)
    : undefined;
  const popupCurrentType =
    cellPopup && cellsParam
      ? parseCellGrid(String(values[cellsParam.id] ?? ''))[cellPopup.row]?.[cellPopup.col] ??
        cellsParam.options?.[0]?.value ??
        ''
      : '';
  const popupCurrentColor =
    cellPopup && colorsParam
      ? parseCellGrid(String(values[colorsParam.id] ?? ''))[cellPopup.row]?.[cellPopup.col] ??
        colorsParam.options?.[0]?.value ??
        ''
      : '';
  // INTENT values — cellgrid CHỈ pad size, KHÔNG áp disabled rules. Để UI lưới hiển
  // thị đúng cái user đã chọn, KỂ CẢ khi kích thước hiện tại không cho phép. Khi user
  // kéo kích thước về lại trị hợp lệ, ô tự "hiện lại" loại cũ (vd ngăn kéo) — vì
  // values.cells lưu trữ ý định gốc, KHÔNG bị ghi đè bởi reconcile.
  const intentValues = useMemo(() => {
    const full: ParamValues = {};
    for (const control of controls) {
      if (control.type === 'cellgrid') {
        const raw = String(values[control.id] ?? control.default);
        const grid = reconcileCellGrid(
          raw,
          control.gridRows ?? 0,
          control.gridCols ?? 0,
          control.options?.[0]?.value ?? '',
          // KHÔNG truyền disabledByRow/Col → chỉ pad size, giữ value gốc.
        );
        full[control.id] = encodeCellGrid(grid);
      } else {
        full[control.id] = values[control.id] ?? control.default;
      }
    }
    return full;
  }, [controls, values]);

  // EFFECTIVE values — cellgrid áp disabled rules + cellFallbackMap. Dùng cho build()
  // → 3D & cutlist phản ánh đúng những gì xưởng sẽ làm (vd ngăn kéo vi phạm → cánh).
  const resolvedValues = useMemo(() => {
    const full: ParamValues = {};
    for (const control of controls) {
      if (control.type === 'cellgrid') {
        const raw = String(values[control.id] ?? control.default);
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
      const next = { ...prev, [id]: value };
      return dna.normalizeValues ? dna.normalizeValues(next) : next;
    });

  // setCell — cập nhật 1 ô trong lưới cellgrid (cells hoặc cellColors) khi
  // khách chọn từ popup trên 3D. Dùng encodeCellGrid/parseCellGrid sẵn có.
  const setCell = (paramId: string, row: number, col: number, next: string) => {
    setValues((prev) => {
      const grid = parseCellGrid(String(prev[paramId] ?? '')).map((r) => [...r]);
      if (!grid[row]) grid[row] = [];
      grid[row][col] = next;
      const updated = { ...prev, [paramId]: encodeCellGrid(grid) };
      return dna.normalizeValues ? dna.normalizeValues(updated) : updated;
    });
  };

  // Layout cố định: mobile = cột-ngược (3D trên, panel dưới);
  // desktop = hàng (panel trái, 3D phải). DOM: panel trước, 3D sau.
  return (
    <div className="relative h-full w-full flex flex-col-reverse md:flex-row">
      {!isShot && (
      <aside
        className="shrink-0 flex flex-col gap-5 max-md:gap-3 overflow-y-auto bg-[var(--color-bg)] p-5 max-md:p-3 text-[var(--color-ink)] max-md:h-[44dvh] md:h-full md:w-[340px] md:border-r md:border-[var(--color-accent)]/20"
      >
        {/* Header — desktop only editorial. Mobile bỏ để nén chiều cao panel. */}
        <header className="max-md:hidden pb-2 border-b border-[var(--color-accent)]/15">
          <p className="editorial-caption mb-3">Configurator · v1</p>
          <h1 className="display-italic text-accent text-4xl lg:text-5xl leading-[0.95] tracking-tight">
            {presetMeta?.name?.replace(/^KÊ\.\s*/, "") || dna.name.replace(/^Tủ kệ\s*/, "")}
          </h1>
          <p className="mt-4 text-xs text-[var(--color-accent)]/70 font-viet leading-relaxed">
            Kéo thanh trượt chỉnh kích thước. Chạm vào ô tủ trên hình để đổi
            kiểu &amp; màu.
          </p>
        </header>

        {warnings.length > 0 && <WarningBox warnings={warnings} />}

        {/* Mobile: tabs sticky bám trên cùng drawer khi scroll. Full bar grid 4
            cell vuông hẳn, không gap, divider border-r giữa cells. Sticky cần
            aside có overflow-y-auto. */}
        <div className="md:hidden shrink-0 sticky -top-3 -mx-3 z-20 bg-[var(--color-bg)] border-y border-[var(--color-accent)]/20">
          <div className="grid grid-cols-4">
            {sections.map((section, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveTab(i)}
                aria-pressed={i === activeTab}
                className={`min-h-[48px] flex items-center justify-center px-1 text-[11px] font-medium tracking-wide text-center leading-tight transition border-r last:border-r-0 border-[var(--color-accent)]/20 ${
                  i === activeTab
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-transparent text-[var(--color-accent)]/70 hover:bg-[var(--color-accent-bg)]'
                }`}
              >
                {section.group ?? section.items[0].label}
              </button>
            ))}
          </div>
        </div>

        <section className="flex flex-col gap-4 max-md:gap-2.5">
          {sections.map((section, i) => {
            // Mobile: chỉ hiện section của tab đang chọn. Desktop: hiện hết.
            const hideOnMobile = i !== activeTab ? 'max-md:hidden' : '';
            if (!section.group) {
              const param = section.items[0];
              return (
                <div key={param.id} className={hideOnMobile}>
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
                className={`flex flex-col gap-5 max-md:gap-3 md:border-t md:border-[var(--color-accent)]/15 pt-5 max-md:pt-3 ${hideOnMobile}`}
              >
                {/* Tiêu đề nhóm editorial — desktop hiện; mobile ẩn (tab đã là tiêu đề). */}
                <h3 className="flex items-baseline gap-3 max-md:hidden">
                  <span className="editorial-caption">{String(i).padStart(2, "0")}</span>
                  <span className="display-italic text-accent text-xl tracking-tight">
                    {section.group}
                  </span>
                </h3>
                {section.items.map((param) => (
                  <ParamControl
                    key={param.id}
                    param={param}
                    value={intentValues[param.id]}
                    onChange={setParam}
                  />
                ))}
              </div>
            );
          })}
        </section>

        {/* PricePanel breakdown + CutlistPanel (bảng cắt + BOM phụ kiện) chỉ
            hiện cho admin. User end (interactive/public) xem giá + nút Đặt
            hàng ở OrderBar nổi trên 3D viewport (cả mobile lẫn desktop). */}
        {isAdmin && (
          <>
            <PricePanel price={price} />
            <CutlistPanel cutlist={cutlist} materialLabels={materialLabels} />
          </>
        )}
        {showSavePreset && (
          <SavePresetButton values={values} onSave={onSavePreset} />
        )}
      </aside>
      )}

      <div className="relative min-h-0 flex-1 max-md:h-[56dvh]">
        {!isShot && !cellPopup && (
          <p className="pointer-events-none absolute left-1/2 max-sm:bottom-2 max-sm:top-auto sm:top-3 md:top-6 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--color-bg)]/85 px-3 md:px-4 py-1 md:py-1.5 text-[10px] md:text-[11px] uppercase tracking-[0.15em] text-[var(--color-accent)]/70 shadow-sm">
            Chạm ô tủ để chỉnh
          </p>
        )}
        {/* Giá + nút Đặt hàng — nổi góc trên 3D viewport, không nền bar. */}
        {showOrderButton && (
          <OrderBar
            values={values}
            price={price}
            cutlist={cutlist}
            fittings={build.fittings ?? []}
            presetMeta={presetMeta}
          />
        )}
        {/* Thanh chọn kiểu/màu + placeholder Chia/Gộp — neo sát cạnh dưới 3D
            viewport (ngoài Canvas). CellBar tự quản lý tab Kiểu/Màu nội bộ. */}
        {!isShot && cellPopup && cellsParam && (
          <CellBar
            cellsParam={cellsParam}
            cellColorsParam={colorsParam}
            row={cellPopup.row}
            col={cellPopup.col}
            currentType={popupCurrentType}
            currentColor={popupCurrentColor}
            tab={cellTab}
            onTabChange={setCellTab}
            onPickType={(v) => {
              setCell(cellsParam.id, cellPopup.row, cellPopup.col, v);
              setCellPopup(null);
            }}
            onPickColor={(v) => {
              if (colorsParam) {
                setCell(colorsParam.id, cellPopup.row, cellPopup.col, v);
                setCellPopup(null);
              }
            }}
            onClose={() => setCellPopup(null)}
          />
        )}
        <Canvas
          shadows={SHADOW_CONFIG}
          onPointerMissed={() => setCellPopup(null)}
          camera={
            isShot
              ? computeScreenshotCamera(
                  Number(values.width ?? 1200),
                  Number(values.height ?? 1800),
                  Number(values.depth ?? 350),
                  screenshotAngle,
                )
              : { position: [3000, 1900, 3800], fov: 35, near: 100, far: 30000 }
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
          dpr={isShot ? 2 : undefined}
        >
          {/* Screenshot mode: bg trắng + Ground studio trắng → bóng đổ clean trên
              sàn trắng, không lơ lửng. Interactive: bg xám + Ground default. */}
          <color attach="background" args={[isShot ? '#ffffff' : '#eeeeee']} />
          {isShot ? <ScreenshotLighting /> : <SceneLighting />}
          {isShot ? <Ground variant="studio" /> : <Ground />}
          {!isShot && <Wall parts={build.parts} />}
          {/* Pre-compute assemblies: gom door+handle / drawer+sides+handle thành 1 group.
              Mỗi assembly có 1 transform DUY NHẤT → tay nắm "dính" vào cánh, không thể desync. */}
          {(() => {
            const partById = new Map(build.parts.map((p) => [p.id, p]));
            const usedPartIds = new Set<string>();
            const usedFittingIds = new Set<string>();
            const assemblies: Array<{ key: string; config: AssemblyConfig; openProgress: number }> = [];

            // Iterate parts → khi gặp 1 door/drawer panel → build assembly cho cell đó.
            for (const part of build.parts) {
              if (usedPartIds.has(part.id)) continue;
              const m = part.id.match(/^(door|drawer)-r(\d+)-c(\d+)(?:-([ab]))?$/);
              if (!m) continue;
              const [, kind, rStr, cStr, leaf] = m;
              const row = Number(rStr);
              const col = Number(cStr);
              const partAnim = computePartAnimation(part, build.fittings);
              if (!partAnim) continue;

              const pivotPos: [number, number, number] = partAnim.kind === 'door'
                ? [part.position[0] + (partAnim.hingeOffsetX ?? 0), part.position[1], part.position[2]]
                : [part.position[0], part.position[1], part.position[2]];

              const asmParts: Part[] = [part];
              const asmFittings: Fitting[] = [];
              usedPartIds.add(part.id);

              if (kind === 'drawer') {
                // Drawer assembly: 5 tấm cùng cell.
                for (const sub of ['L', 'R', 'Bk', 'Bot']) {
                  const sp = partById.get(`drawer${sub}-r${row}-c${col}`);
                  if (sp) { asmParts.push(sp); usedPartIds.add(sp.id); }
                }
              }

              // Handle strips matching this assembly:
              //   door single → hstrip-d-r{r}-c{c}
              //   door leaf-a → hstrip-da-r{r}-c{c}
              //   door leaf-b → hstrip-db-r{r}-c{c}
              //   drawer     → hstrip-d-r{r}-c{c}
              const stripPrefix = leaf
                ? `hstrip-d${leaf}-r${row}-c${col}`
                : `hstrip-d-r${row}-c${col}`;
              for (const f of build.fittings ?? []) {
                if (f.id.startsWith(stripPrefix + '-')) {
                  asmFittings.push(f);
                  usedFittingIds.add(f.id);
                }
              }

              const open = cellPopup && cellTab === 'type'
                && row === cellPopup.row && col === cellPopup.col
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
                    fittingsForHingeDetect={build.fittings}
                  />
                ))}
                {restFittings.map((fitting) => (
                  <FittingMesh key={fitting.id} fitting={fitting} />
                ))}
              </>
            );
          })()}
          {!isShot && <Dimensions parts={build.parts} />}
          {/* Lớp hitbox vô hình + popup chọn kiểu/màu — direct manipulation. */}
          {!isShot && (
            <CellHitboxes
              boxes={cellHitBoxes}
              onPick={(row, col) => {
                setCellPopup({ row, col });
                setCellTab('type');
              }}
            />
          )}
          {/* Ô đang chọn — tô đỏ nhẹ trên 3D (popup neo cố định ở góc). */}
          {!isShot && popupBox && <CellHighlight box={popupBox} />}
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
  // Square crop 1:1 → cả vertical & horizontal FOV bằng nhau (FOV vertical = 25°).
  // d sao cho max(w, h) ≤ FILL * 2 * d * tan(FOV_half).
  const FRAME_FILL = 0.85;
  const FOV = 25;
  const fovHalfRad = (FOV / 2) * (Math.PI / 180);
  const maxDim = Math.max(width, height);
  const d = maxDim / FRAME_FILL / 2 / Math.tan(fovHalfRad);
  // Camera Y: cố định OFFSET trên cabinet center (không scale theo h) → tilt
  // angle invariant qua mọi cabinet → composition cân đối.
  const camY = height / 2 + 300;
  const positions: Record<typeof angle, [number, number, number]> = {
    'iso-front-right': [d * 0.65, camY, d * 0.75],
    'front': [0, height / 2, d],
    'iso-front-left': [-d * 0.65, camY, d * 0.75],
  };
  return { position: positions[angle], fov: FOV, near: 100, far: 30000 };
}

/** 3-point studio lighting cho screenshot mode — key + fill + rim. */
function ScreenshotLighting() {
  return (
    <>
      <ambientLight intensity={0.45} />
      {/* Key light: top-right, mạnh, cast shadow */}
      <directionalLight
        position={[5000, 6000, 3000]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-3000}
        shadow-camera-right={3000}
        shadow-camera-top={3000}
        shadow-camera-bottom={-1000}
        shadow-camera-near={1000}
        shadow-camera-far={15000}
        shadow-bias={-0.0003}
      />
      {/* Fill light: từ trái, dịu, không shadow */}
      <directionalLight position={[-3500, 3500, 2500]} intensity={0.7} />
      {/* Rim light: phía sau, tách subject khỏi background */}
      <directionalLight position={[0, 3000, -3500]} intensity={0.5} />
    </>
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

  // Danh sách nhiều lựa chọn (vd "Vật liệu khung" 23 vật liệu) → mobile bọc
  // trong hộp cao giới hạn + cuộn nội bộ, để panel không phải scroll dài.
  // Desktop (sidebar rộng) giữ nguyên wrap thường.
  const manyOpts = (param.options?.length ?? 0) > 6;

  return (
    <div>
      <label className="mb-3 block text-sm font-medium text-[var(--color-accent)] font-viet">
        {param.label}
      </label>
      <div
        className={`flex flex-wrap gap-2${
          manyOpts
            ? ' max-md:max-h-[164px] max-md:shrink-0 max-md:overflow-y-auto max-md:p-1'
            : ''
        }`}
      >
        {param.options?.map((opt) => {
          // Quy ước: value dạng "catalog/id" → là vật liệu → hiện ô màu.
          const isSwatch = opt.value.includes('/');
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(param.id, opt.value)}
              className={`flex items-center gap-2 rounded-full border px-4 md:px-3.5 py-2 text-xs transition max-md:min-h-[40px] ${
                active
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                  : 'border-[var(--color-accent)]/30 bg-transparent text-[var(--color-accent)] hover:bg-[var(--color-accent-bg)]'
              }`}
            >
              {isSwatch && (
                <span
                  className="h-4 w-4 rounded-full border border-black/10 shadow-sm"
                  style={swatchStyle(opt.value)}
                />
              )}
              {opt.label}
            </button>
          );
        })}
      </div>
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
              style={{ backgroundColor: bg, opacity: isBanned ? 0.45 : 1 }}
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
      <label className="mb-3 block text-sm font-medium text-[var(--color-accent)] font-viet">{param.label}</label>
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
                  style={{ backgroundColor: bg }}
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

/** Bảng giá: tổng nổi bật + phân tích từng dòng. */
function PricePanel({ price }: { price: PriceBreakdown }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]/60">Giá</h2>
      <div className="rounded-lg bg-[var(--color-ink)] p-4 text-white">
        <p className="text-xs text-[var(--color-accent)]/60">Giá bán tạm tính</p>
        <p className="text-2xl font-semibold tabular-nums">{formatPrice(price.total)}</p>
      </div>
      <dl className="mt-2 flex flex-col gap-1 text-xs text-[var(--color-accent)]/70">
        {price.lines.map((line) => (
          <div key={line.label} className="flex justify-between gap-2">
            <dt>
              {line.label} <span className="text-[var(--color-accent)]/60">· {line.detail}</span>
            </dt>
            <dd className="tabular-nums">{formatPrice(line.amount)}</dd>
          </div>
        ))}
        <div className="mt-1 flex justify-between border-t border-[var(--color-accent)]/20 pt-1">
          <dt>Hệ số lãi</dt>
          <dd className="tabular-nums">×{price.margin}</dd>
        </div>
        {price.laborPerOrder > 0 && (
          <div className="flex justify-between">
            <dt>Công mỗi đơn</dt>
            <dd className="tabular-nums">+{formatPrice(price.laborPerOrder)}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

/** Bảng cắt cho xưởng — cột "Vật liệu" phân biệt tấm theo vật liệu; KHÔNG có cột dán cạnh. */
function CutlistPanel({
  cutlist,
  materialLabels,
}: {
  cutlist: Cutlist;
  materialLabels: Record<string, string>;
}) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]/60">
        Bảng cắt cho xưởng
      </h2>
      <p className="mb-2 text-xs text-[var(--color-accent)]/70">
        {cutlist.totalPanels} tấm · {cutlist.totalAreaM2.toFixed(2)} m² ·{' '}
        {cutlist.totalWeightKg.toFixed(1)} kg · không dán cạnh
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[var(--color-accent)]/60">
            <th className="py-1 font-medium">Tấm</th>
            <th className="py-1 font-medium">Vật liệu</th>
            <th className="py-1 text-right font-medium">SL</th>
            <th className="py-1 text-right font-medium">Dài</th>
            <th className="py-1 text-right font-medium">Rộng</th>
            <th className="py-1 text-right font-medium">Dày</th>
            <th className="py-1 text-right font-medium">Cân</th>
          </tr>
        </thead>
        <tbody>
          {cutlist.panels.map((row) => (
            <Fragment
              key={`${row.label}-${row.length_mm}x${row.width_mm}x${row.thickness_mm}-${row.material}-${row.notes ?? ''}`}
            >
              <tr className="border-t border-[var(--color-accent)]/10">
                <td className="py-1">{row.label}</td>
                <td className="py-1">
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="h-3 w-3 shrink-0 rounded-sm border border-black/15"
                      style={swatchStyle(row.material)}
                    />
                    <span className="text-[var(--color-accent)]/70">
                      {materialLabels[row.material] ?? row.material}
                    </span>
                  </span>
                </td>
                <td className="py-1 text-right tabular-nums">{row.qty}</td>
                <td className="py-1 text-right tabular-nums">{Math.round(row.length_mm)}</td>
                <td className="py-1 text-right tabular-nums">{Math.round(row.width_mm)}</td>
                <td className="py-1 text-right tabular-nums">{row.thickness_mm}</td>
                <td className="py-1 text-right tabular-nums text-[var(--color-accent)]/70">
                  {row.weight_kg.toFixed(1)} kg
                </td>
              </tr>
              {row.notes && (
                <tr>
                  <td colSpan={7} className="pb-1 pl-3 text-[11px] italic text-[var(--color-accent)]/60">
                    ↳ {row.notes}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
      {cutlist.hardware.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-xs text-[var(--color-accent)]/80">
          {cutlist.hardware.map((hw) => (
            <li key={hw.label}>
              <div className="flex justify-between gap-2">
                <span>{hw.label}</span>
                <span className="tabular-nums">
                  ×{hw.qty}
                  <span className="ml-2 text-[var(--color-accent)]/60">· {hw.weight_kg.toFixed(2)} kg</span>
                </span>
              </div>
              {hw.notes && <p className="text-[11px] italic text-[var(--color-accent)]/60">↳ {hw.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
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
        console.log('[KÊ admin] Preset draft saved to localStorage:', draft);
        alert(
          'Phase A: Đã lưu draft vào localStorage. Phase C sẽ wire tới maume API ' +
            'để push lên Cloudflare KV và sync với ke.maume.asia.',
        );
      }
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (err) {
      console.error('[KÊ admin] Save preset error:', err);
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

// =============================================================================
// OrderBar + OrderDialog — Session 7. Khách hàng end-user click "Đặt hàng"
// → modal form (tên/sđt/email/địa chỉ/ghi chú) → POST /api/order → Apps Script
// → Google Sheet KÊ Orders + email notify maume.decor@gmail.com.
// =============================================================================
/**
 * Giá + nút "Đặt hàng" nổi TRỰC TIẾP trên 3D viewport — KHÔNG nền bar:
 * giá ở góc trên-trái (chữ + text-shadow để rõ trên mọi nền), nút Đặt hàng
 * góc trên-phải. Hiện trên CẢ mobile lẫn desktop — sidebar không còn giá/nút.
 * Tái dùng nguyên <OrderDialog>.
 */
function OrderBar({
  values,
  price,
  cutlist,
  fittings,
  presetMeta,
}: {
  values: ParamValues;
  price: PriceBreakdown;
  cutlist: Cutlist;
  fittings: Fitting[];
  presetMeta?: { slug?: string; name?: string };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Giá — góc trên-trái. Mobile: smaller, không chiếm vùng mode toggle. */}
      <div className="pointer-events-none absolute left-3 top-3 md:left-6 md:top-6 z-20 leading-tight [text-shadow:0_2px_8px_rgba(253,251,247,0.95)]">
        <p className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]/70 font-medium mb-1 md:mb-1.5">
          Giá tham khảo
        </p>
        <p className="text-base md:text-3xl lg:text-4xl display-italic text-accent tabular-nums leading-none">
          {formatPrice(price.total)}
        </p>
      </div>
      {/* Nút Đặt hàng — mobile compact, desktop pill lớn. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute right-3 top-3 md:right-6 md:top-6 z-20 rounded-full bg-[var(--color-accent)] px-4 md:px-6 py-2 md:py-3 text-[11px] md:text-sm font-medium tracking-wide text-white shadow-md transition-all hover:bg-[var(--color-accent-hover)]"
      >
        Đặt hàng
      </button>
      {open && (
        <OrderDialog
          values={values}
          price={price}
          cutlist={cutlist}
          fittings={fittings}
          presetMeta={presetMeta}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function OrderDialog({
  values,
  price,
  cutlist,
  fittings,
  presetMeta,
  onClose,
}: {
  values: ParamValues;
  price: PriceBreakdown;
  cutlist: Cutlist;
  fittings: Fitting[];
  presetMeta?: { slug?: string; name?: string };
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    note: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setErrorMsg('Vui lòng nhập tên và số điện thoại');
      setStatus('error');
      return;
    }
    setStatus('sending');
    setErrorMsg(null);
    try {
      // Gửi FULL data cho xưởng: price breakdown đầy đủ + cutlist full rows +
      // BOM (fittings). Apps Script tách thành 3 columns JSON riêng trong Sheet.
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact: form,
          preset: { slug: presetMeta?.slug, name: presetMeta?.name },
          values,
          price,                // full PriceBreakdown { total, lines: [...] }
          cutlist,              // full Cutlist { totalPanels, totalAreaM2, totalWeightKg, rows: [...] }
          bom: fittings,        // Bill of Materials = fittings array (chân tủ, etc.)
        }),
      });
      const data = (await res.json()) as { success?: boolean; orderId?: number; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gửi đơn thất bại');
      }
      setStatus('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setErrorMsg(message);
      setStatus('error');
    }
  }

  // Portal: render ở document.body để tránh bị containing block của aside (có
  // transform: translateY(...) cho mobile drawer) clip vị trí fixed-inset-0.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start md:items-center justify-center bg-black/40 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-bg)] rounded-lg max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {status === 'success' ? (
          <div className="p-6 text-center">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-xl font-bold mb-2">Đã gửi đơn!</h2>
            <p className="text-sm text-[var(--color-accent)]/80 mb-4">
              Maumè đã nhận đơn của bạn. Chúng tôi sẽ liên hệ qua số điện thoại{' '}
              <strong>{form.phone}</strong> trong vòng 24h để xác nhận.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[var(--color-accent)] text-white text-sm rounded hover:bg-[var(--color-accent-hover)]"
            >
              Đóng
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Đặt hàng tủ kệ</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng"
                className="text-[var(--color-accent)]/60 hover:text-[var(--color-accent)] text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="bg-[var(--color-surface-2)] p-3 rounded text-xs mb-4 space-y-1">
              <p>
                <strong>Mẫu:</strong> {presetMeta?.name || 'Tủ tự thiết kế'}
              </p>
              <p>
                <strong>Kích thước:</strong> {values.width as number} ×{' '}
                {values.height as number} × {values.depth as number} mm
              </p>
              <p>
                <strong>Cấu trúc:</strong> {values.columns as number} cột ×{' '}
                {values.rows as number} tầng
              </p>
              <p>
                <strong>Giá tham khảo:</strong>{' '}
                <span className="font-bold">{formatPrice(price.total)}</span>
              </p>
            </div>
            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="block text-xs uppercase tracking-wide text-[var(--color-accent)]/70 mb-1">
                  Họ tên <span className="text-[var(--color-accent)]">*</span>
                </span>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-3 md:py-2 border border-[var(--color-accent)]/30 rounded focus:outline-none focus:border-[var(--color-accent)]"
                  placeholder="Nguyễn Văn A"
                />
              </label>
              <label className="block">
                <span className="block text-xs uppercase tracking-wide text-[var(--color-accent)]/70 mb-1">
                  Số điện thoại <span className="text-[var(--color-accent)]">*</span>
                </span>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-3 md:py-2 border border-[var(--color-accent)]/30 rounded focus:outline-none focus:border-[var(--color-accent)]"
                  placeholder="09xx xxx xxx"
                />
              </label>
              <label className="block">
                <span className="block text-xs uppercase tracking-wide text-[var(--color-accent)]/70 mb-1">
                  Email
                </span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-3 md:py-2 border border-[var(--color-accent)]/30 rounded focus:outline-none focus:border-[var(--color-accent)]"
                  placeholder="ban@example.com"
                />
              </label>
              <label className="block">
                <span className="block text-xs uppercase tracking-wide text-[var(--color-accent)]/70 mb-1">
                  Địa chỉ giao hàng
                </span>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-3 md:py-2 border border-[var(--color-accent)]/30 rounded focus:outline-none focus:border-[var(--color-accent)]"
                  placeholder="Số nhà, đường, quận, TP"
                />
              </label>
              <label className="block">
                <span className="block text-xs uppercase tracking-wide text-[var(--color-accent)]/70 mb-1">
                  Ghi chú
                </span>
                <textarea
                  rows={3}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="w-full px-3 py-3 md:py-2 border border-[var(--color-accent)]/30 rounded focus:outline-none focus:border-[var(--color-accent)]"
                  placeholder="Deadline, yêu cầu đặc biệt..."
                />
              </label>
            </div>
            {errorMsg && (
              <p className="mt-3 text-xs text-[var(--color-accent)] bg-[var(--color-accent-bg)] border border-[var(--color-accent)]/40 px-3 py-2 rounded">
                {errorMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={status === 'sending'}
              className="mt-5 w-full px-4 py-3 text-sm font-medium text-white rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors"
            >
              {status === 'sending' ? 'Đang gửi…' : 'Gửi đơn'}
            </button>
            <p className="mt-2 text-[11px] text-[var(--color-accent)]/60">
              Bằng cách gửi, bạn đồng ý maumè liên hệ qua SĐT để xác nhận đơn.
            </p>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
