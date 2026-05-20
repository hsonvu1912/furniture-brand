'use client';
// =============================================================
// CONFIGURATOR — khung dùng chung cho MỌI sản phẩm.
// Nhận 1 ProductDNA → render: bảng điều khiển (slider/nút) + 3D + giá + bảng cắt.
// Núm điều khiển: dna.resolveControls(values) nếu DNA có (núm động), không thì dna.parameters.
// Engine — chỉ mở rộng khi founder duyệt; thêm sản phẩm = thêm products/<slug>/dna.ts.
// =============================================================
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type {} from '@react-three/fiber';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { PCFShadowMap } from 'three';
import { Dimensions, FittingMesh, Ground, PartMesh, SceneLighting, Wall } from './renderer';
import { resolveMaterial } from './materials';
import { computePrice, formatPrice, type PriceBreakdown } from './pricing';
import { buildCutlist, type Cutlist } from './cutlist';
import { encodeCellGrid, parseCellGrid, reconcileCellGrid } from './cellgrid';
import {
  encodeSubCells,
  parseSubCells,
  type SubEntry,
} from './subgrid';
import type { ParamValues, Parameter, ProductDNA } from './types';

// three 0.184 bỏ PCFSoftShadowMap → truyền object để R3F set thẳng PCFShadowMap.
const SHADOW_CONFIG = { enabled: true, type: PCFShadowMap };

/** Giá trị khởi tạo: lấy default của từng Parameter. */
function initialValues(parameters: Parameter[]): ParamValues {
  const values: ParamValues = {};
  for (const p of parameters) values[p.id] = p.default;
  return values;
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
    // Bỏ qua param 'subgrid' — carrier qua pipeline, không hiển thị trực tiếp.
    if (param.cellVariant === 'subgrid') continue;
    const last = sections[sections.length - 1];
    if (param.group && last && last.group === param.group) {
      last.items.push(param);
    } else {
      sections.push({ group: param.group, items: [param] });
    }
  }
  return sections;
}

/** Hộp cảnh báo (hổ phách) — hiện các câu do dna.getWarnings trả về. */
function WarningBox({ warnings }: { warnings: string[] }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
      <p className="mb-0.5 font-semibold">Cảnh báo kích thước</p>
      {warnings.map((w, i) => (
        <p key={i} className={i > 0 ? 'mt-1' : undefined}>
          {w}
        </p>
      ))}
    </div>
  );
}

/** Thanh chỉ bước wizard: "Bước X/N · Tên" + dải đoạn bấm được để nhảy thẳng tới 1 bước. */
function StepIndicator({
  steps,
  current,
  onJump,
}: {
  steps: { id: string; label: string }[];
  current: number;
  onJump: (index: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Bước {current + 1}/{steps.length}
        </span>
        <span className="text-sm font-medium">{steps[current].label}</span>
      </div>
      <div className="flex gap-1.5">
        {steps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onJump(i)}
            aria-label={`Bước ${i + 1}: ${s.label}`}
            aria-current={i === current ? 'step' : undefined}
            className={`h-1.5 flex-1 rounded-full transition ${
              i === current
                ? 'bg-neutral-900'
                : i < current
                  ? 'bg-neutral-400'
                  : 'bg-neutral-200 hover:bg-neutral-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/** Hàng nút điều hướng wizard: làm lại bước hiện tại · lùi 1 bước · tới 1 bước. */
function StepNav({
  isFirst,
  isLast,
  onReset,
  onPrev,
  onNext,
}: {
  isFirst: boolean;
  isLast: boolean;
  onReset: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onReset}
        className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-600 transition hover:bg-neutral-100"
      >
        Làm lại bước này
      </button>
      <div className="ml-auto flex gap-2">
        {!isFirst && (
          <button
            type="button"
            onClick={onPrev}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            ← Bước trước
          </button>
        )}
        {!isLast && (
          <button
            type="button"
            onClick={onNext}
            className="rounded-md bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-700"
          >
            Bước sau →
          </button>
        )}
      </div>
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
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium">{param.label}</label>
        <span className="flex items-baseline gap-1">
          <input
            type="text"
            inputMode="numeric"
            aria-label={`${param.label} — nhập số`}
            className="w-16 rounded border border-neutral-300 px-1.5 py-0.5 text-right text-sm tabular-nums focus:border-neutral-900 focus:outline-none"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
          {param.unit && <span className="text-xs text-neutral-400">{param.unit}</span>}
        </span>
      </div>
      <input
        type="range"
        className="w-full accent-neutral-800"
        min={min}
        max={max}
        step={step}
        value={num}
        onChange={(e) => onChange(param.id, Number(e.target.value))}
      />
      <p className="mt-0.5 text-[11px] tabular-nums text-neutral-400">
        Nhỏ nhất {min} — lớn nhất {max}
        {param.unit ? ` ${param.unit}` : ''}
      </p>
    </div>
  );
}

export function Configurator({ dna }: { dna: ProductDNA }) {
  const [values, setValues] = useState<ParamValues>(() => {
    const init = initialValues(dna.parameters);
    return dna.normalizeValues ? dna.normalizeValues(init) : init;
  });

  // Wizard: DNA khai báo `steps` → hiện từng bước; không → vẽ phẳng toàn bộ núm.
  const steps = dna.steps;
  const wizard = !!steps && steps.length > 0;
  const [stepIndex, setStepIndex] = useState(0);

  // Danh sách núm: động (resolveControls) nếu DNA có, tĩnh nếu không.
  const controls = useMemo(
    () => dna.resolveControls?.(values) ?? dna.parameters,
    [dna, values],
  );
  // Gom núm cùng group vào 1 khung. Wizard → chỉ núm của bước đang xem (núm chưa gắn
  // step coi như thuộc bước đầu — phòng hờ cho sản phẩm khai báo thiếu).
  const sections = useMemo(() => {
    const visible =
      wizard && steps
        ? controls.filter((c) => (c.stepId ?? steps[0].id) === steps[stepIndex].id)
        : controls;
    return groupControls(visible);
  }, [controls, wizard, steps, stepIndex]);
  // INTENT values — cellgrid CHỈ pad size, KHÔNG áp disabled rules. Để UI lưới hiển
  // thị đúng cái user đã chọn, KỂ CẢ khi kích thước hiện tại không cho phép. Khi user
  // kéo kích thước về lại trị hợp lệ, ô tự "hiện lại" loại cũ (vd ngăn kéo) — vì
  // values.cells lưu trữ ý định gốc, KHÔNG bị ghi đè bởi reconcile.
  const intentValues = useMemo(() => {
    const full: ParamValues = {};
    for (const control of controls) {
      if (control.type === 'cellgrid' && control.cellVariant !== 'subgrid') {
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
        // 'subgrid' carrier + non-cellgrid: passthrough raw.
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
      if (control.type === 'cellgrid' && control.cellVariant !== 'subgrid') {
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
        // 'subgrid' carrier + non-cellgrid: passthrough raw (subCells map đã reconcile
        // ở DNA normalizeValues — không cần reconcile lại ở Configurator).
        full[control.id] = values[control.id] ?? control.default;
      }
    }
    return full;
  }, [controls, values]);

  // resolvedValues → build() → giá + bảng cắt. Mỗi bước chỉ tính lại khi input đổi.
  const build = useMemo(() => dna.build(resolvedValues), [dna, resolvedValues]);
  const price = useMemo(() => computePrice(build, dna.priceConfig), [build, dna.priceConfig]);
  const cutlist = useMemo(() => buildCutlist(build), [build]);
  // Cảnh báo (vd tổng kích thước vượt giới hạn) — DNA tự tính, Configurator chỉ hiện.
  const warnings = useMemo(() => dna.getWarnings?.(resolvedValues) ?? [], [dna, resolvedValues]);
  // Map "catalog/id" → tên vật liệu (vd "mdf_son/nau" → "MDF Nâu") cho cột Vật liệu bảng cắt.
  const materialLabels = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of dna.parameters) for (const o of p.options ?? []) m[o.value] = o.label;
    return m;
  }, [dna]);

  // setParam — single key OR batch object (cho transactional changes vd split cell:
  // cells + subCells phải đổi cùng 1 commit để normalize thấy state nhất quán).
  const setParam = (id: string, value: number | string) =>
    setValues((prev) => {
      const next = { ...prev, [id]: value };
      return dna.normalizeValues ? dna.normalizeValues(next) : next;
    });
  const setParamBatch = (updates: Record<string, number | string>) =>
    setValues((prev) => {
      const next = { ...prev, ...updates };
      return dna.normalizeValues ? dna.normalizeValues(next) : next;
    });

  // "Làm lại bước này": đưa mọi núm của bước đang xem về giá trị mặc định.
  const resetStep = () => {
    if (!wizard || !steps) return;
    const activeStepId = steps[stepIndex].id;
    setValues((prev) => {
      const next = { ...prev };
      for (const c of controls) {
        if ((c.stepId ?? steps[0].id) === activeStepId) next[c.id] = c.default;
      }
      return dna.normalizeValues ? dna.normalizeValues(next) : next;
    });
  };

  return (
    <div className="flex h-full w-full">
      <aside className="flex h-full w-[380px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-neutral-200 bg-white p-5 text-neutral-800">
        <header>
          <h1 className="text-lg font-semibold">{dna.name}</h1>
          <p className="text-xs text-neutral-400">
            {wizard
              ? 'Làm theo từng bước — mô hình 3D và giá cập nhật ngay.'
              : 'Kéo thanh trượt — 3D, giá và bảng cắt cập nhật ngay.'}
          </p>
        </header>

        {wizard && steps && (
          <StepIndicator steps={steps} current={stepIndex} onJump={setStepIndex} />
        )}

        {warnings.length > 0 && <WarningBox warnings={warnings} />}

        <section className="flex flex-col gap-4">
          {sections.map((section) => {
            if (!section.group) {
              const param = section.items[0];
              return (
                <ParamControl
                  key={param.id}
                  param={param}
                  value={intentValues[param.id]}
                  onChange={setParam}
                  onChangeMulti={setParamBatch}
                  allValues={intentValues}
                />
              );
            }
            return (
              <div
                key={section.group}
                className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-3"
              >
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  {section.group}
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

        {wizard && steps && (
          <StepNav
            isFirst={stepIndex === 0}
            isLast={stepIndex === steps.length - 1}
            onReset={resetStep}
            onPrev={() => setStepIndex((i) => Math.max(0, i - 1))}
            onNext={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
          />
        )}

        <PricePanel price={price} />
        <CutlistPanel cutlist={cutlist} materialLabels={materialLabels} />
      </aside>

      <div className="relative flex-1">
        <Canvas
          shadows={SHADOW_CONFIG}
          camera={{ position: [3000, 1900, 3800], fov: 35, near: 100, far: 30000 }}
        >
          <color attach="background" args={['#eeeeee']} />
          <SceneLighting />
          <Ground />
          <Wall parts={build.parts} />
          <group>
            {build.parts.map((part) => (
              <PartMesh key={part.id} part={part} />
            ))}
          </group>
          {build.fittings?.map((fitting) => (
            <FittingMesh key={fitting.id} fitting={fitting} />
          ))}
          <Dimensions parts={build.parts} />
          <OrbitControls
            target={[0, 900, 0]}
            enableDamping
            maxPolarAngle={Math.PI / 2.05}
            minDistance={1500}
            maxDistance={12000}
          />
        </Canvas>
      </div>
    </div>
  );
}

/** 1 núm: 'number' → thanh trượt, 'option' → hàng nút (kèm ô màu nếu là vật liệu). */
function ParamControl({
  param,
  value,
  onChange,
  onChangeMulti,
  allValues,
}: {
  param: Parameter;
  value: number | string;
  onChange: (id: string, value: number | string) => void;
  // Batch update (multiple params atomically) — cho transactional UI như split cell.
  onChangeMulti?: (updates: Record<string, number | string>) => void;
  allValues?: ParamValues;
}) {
  if (param.type === 'number') {
    return <NumberControl param={param} value={value} onChange={onChange} />;
  }

  if (param.type === 'cellgrid') {
    return (
      <CellGridControl
        param={param}
        value={value}
        onChange={onChange}
        onChangeMulti={onChangeMulti}
        allValues={allValues}
      />
    );
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{param.label}</label>
      <div className="flex flex-wrap gap-2">
        {param.options?.map((opt) => {
          // Quy ước: value dạng "catalog/id" → là vật liệu → hiện ô màu.
          const isSwatch = opt.value.includes('/');
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(param.id, opt.value)}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition ${
                active
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              {isSwatch && (
                <span
                  className="h-3.5 w-3.5 rounded-full border border-black/15"
                  style={{ backgroundColor: resolveMaterial(opt.value).hex }}
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

/** Menu nhỏ bật ngay tại ô để chọn (loại HOẶC màu) — mục bị cấm hiển thị mờ. */
function CellMenu({
  opts,
  current,
  banned,
  bgOf,
  isColor,
  flipLeft,
  onPick,
  extraActions,
}: {
  opts: { value: string; label: string }[];
  current: string;
  banned: string[];
  bgOf: (value: string) => string;
  isColor: boolean;
  flipLeft: boolean;
  onPick: (value: string) => void;
  // Hành động phụ (vd "Chia ngang" / "Gộp lại") hiển thị bên dưới danh sách options.
  extraActions?: React.ReactNode;
}) {
  return (
    <div
      className={`absolute top-full z-50 mt-1 max-h-80 w-48 overflow-y-auto overflow-x-hidden rounded-lg border border-neutral-300 bg-white shadow-lg ${
        flipLeft ? 'right-0' : 'left-0'
      }`}
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
            className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs transition ${
              isBanned
                ? 'cursor-not-allowed text-neutral-300'
                : isCurrent
                  ? 'bg-neutral-100 font-medium text-neutral-900'
                  : 'text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            <span
              className="relative inline-block h-5 w-7 shrink-0 rounded-sm border border-neutral-300"
              style={{ backgroundColor: bg, opacity: isBanned ? 0.45 : 1 }}
            >
              {!isColor && !isBanned && <CellSymbol type={o.value} stroke={pickContrast(bg)} />}
            </span>
            <span className="flex-1">{o.label}</span>
          </button>
        );
      })}
      {extraActions}
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
  onChangeMulti,
  allValues,
}: {
  param: Parameter;
  value: number | string;
  onChange: (id: string, value: number | string) => void;
  onChangeMulti?: (updates: Record<string, number | string>) => void;
  allValues?: ParamValues;
}) {
  // open: { r, c, sub? } — sub là chỉ số sub-cell đang mở menu (undefined = menu cell cha).
  const [open, setOpen] = useState<{ r: number; c: number; sub?: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const rows = param.gridRows ?? 0;
  const cols = param.gridCols ?? 0;
  const opts = param.options ?? [];
  const tint = param.tint ?? '#e7e5df';
  const isColor = param.cellVariant === 'color';
  const grid = parseCellGrid(String(value));

  // Sub-cells lookup: param 'cells' có subGridSourceId → đọc subCells từ allValues.
  const SPLIT_VAL = param.subContainerValue ?? 'split';
  const subSourceId = param.subGridSourceId;
  const subRaw = subSourceId ? String(allValues?.[subSourceId] ?? '') : '';
  const subMap = subSourceId ? parseSubCells(subRaw) : new Map();

  // Màu nền 1 ô: lưới màu → màu đã chọn (opt[0] "Theo khung" = tint); lưới loại → sơn/trắng/split-stripe.
  const bgOf = (v: string): string => {
    if (isColor) return v === opts[0]?.value ? tint : resolveMaterial(v).hex;
    if (v === SPLIT_VAL) return tint; // split: dùng tint (nét chia sub là độ tương phản)
    return v === 'open-nobk' ? '#ffffff' : tint;
  };

  // Kích thước ô = kích thước thật (mm) → đơn vị fr của CSS Grid.
  const colSizes = param.colSizes?.length ? param.colSizes : Array.from({ length: cols }, () => 1);
  const rowSizes = param.rowSizes?.length ? param.rowSizes : Array.from({ length: rows }, () => 1);
  const sumW = colSizes.reduce((s, w) => s + w, 0) || 1;
  const sumH = rowSizes.reduce((s, h) => s + h, 0) || 1;
  const scale = Math.min(GRID_MAX_W / sumW, GRID_MAX_H / sumH);

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

  function setCellValue(r: number, c: number, next: string) {
    const g = grid.map((row) => [...row]);
    if (!g[r]) g[r] = [];
    g[r][c] = next;
    onChange(param.id, encodeCellGrid(g));
  }

  function setSubEntry(r: number, c: number, entry: SubEntry | null) {
    if (!subSourceId) return;
    const m = new Map(subMap);
    const k = `${r}_${c}`;
    if (entry === null) m.delete(k);
    else m.set(k, entry);
    onChange(subSourceId, encodeSubCells(m));
  }

  // Helper: gộp cells + subCells encoded mới để 1 lần setParamBatch.
  function buildCellsSubCellsUpdate(
    rChange: number, cChange: number, nextCellValue: string,
    subUpdate: { entry: SubEntry | null },
  ): Record<string, string> {
    const g = grid.map((row) => [...row]);
    if (!g[rChange]) g[rChange] = [];
    g[rChange][cChange] = nextCellValue;
    const m = new Map(subMap);
    const k = `${rChange}_${cChange}`;
    if (subUpdate.entry === null) m.delete(k);
    else m.set(k, subUpdate.entry);
    const out: Record<string, string> = { [param.id]: encodeCellGrid(g) };
    if (subSourceId) out[subSourceId] = encodeSubCells(m);
    return out;
  }

  // Tạo entry sub đều khi user chia: N=2 mặc định, chia đều span − (N-1)*18mm.
  // parentKind = loại HIỆN TẠI của ô (open-back hoặc open-nobk) — lưu để build biết
  // có vẽ hậu chung hay không, và để merge restore đúng loại gốc.
  function splitCell(r: number, c: number, dir: 'H' | 'V') {
    const currentVal = grid[r]?.[c] ?? 'open-back';
    const parentKind = currentVal === 'open-back' || currentVal === 'open-nobk'
      ? currentVal
      : 'open-back';
    const N = 2;
    const span = dir === 'H' ? colSizes[c] : rowSizes[r];
    const T_VACH = 18;
    const slotSize = Math.max(150, Math.floor((span - (N - 1) * T_VACH) / N));
    const entry: SubEntry = {
      dir,
      parentKind,
      sizes: Array.from({ length: N }, () => slotSize),
      cells: Array.from({ length: N }, () => 'open-back'),
    };
    if (onChangeMulti) {
      onChangeMulti(buildCellsSubCellsUpdate(r, c, SPLIT_VAL, { entry }));
    } else {
      // Fallback (không recommended — race condition khả thi).
      setSubEntry(r, c, entry);
      setCellValue(r, c, SPLIT_VAL);
    }
    setOpen(null);
  }

  function mergeCell(r: number, c: number) {
    const entry = subMap.get(`${r}_${c}`);
    const restored = entry?.parentKind ?? opts[0]?.value ?? 'open-back';
    if (onChangeMulti) {
      onChangeMulti(buildCellsSubCellsUpdate(r, c, restored, { entry: null }));
    } else {
      setSubEntry(r, c, null);
      setCellValue(r, c, restored);
    }
    setOpen(null);
  }

  function setSubCellType(r: number, c: number, slotIdx: number, slotType: string) {
    const entry = subMap.get(`${r}_${c}`);
    if (!entry) return;
    const next = [...entry.cells];
    next[slotIdx] = slotType;
    setSubEntry(r, c, { ...entry, cells: next });
    setOpen(null);
  }

  function changeSubN(r: number, c: number, delta: number) {
    const entry = subMap.get(`${r}_${c}`);
    if (!entry) return;
    const newN = Math.max(2, entry.cells.length + delta);
    if (newN === entry.cells.length) return;
    const span = entry.dir === 'H' ? colSizes[c] : rowSizes[r];
    const T_VACH = 18;
    const slotSize = Math.max(150, Math.floor((span - (newN - 1) * T_VACH) / newN));
    const sizes = Array.from({ length: newN }, () => slotSize);
    const cells = Array.from({ length: newN }, (_, i) => entry.cells[i] ?? 'open-back');
    setSubEntry(r, c, { ...entry, sizes, cells }); // parentKind giữ qua spread
  }

  // 1 ô (r, c) của lưới chính.
  const renderCell = (r: number, c: number, idx: number) => {
    const v = grid[r]?.[c] ?? opts[0]?.value ?? '';
    const banned = [
      ...(param.disabledByRow?.[r] ?? []),
      ...(param.disabledByCol?.[c] ?? []),
    ];
    const isMenuOpen = open?.r === r && open?.c === c;
    const locked = param.lockedCells?.[r]?.[c] ?? false;
    const isSplit = v === SPLIT_VAL && !isColor;
    const subEntry = isSplit ? subMap.get(`${r}_${c}`) : undefined;
    const bg = locked ? '#ffffff' : bgOf(v);
    const symbol = param.cellSymbolByPosition?.[r]?.[c] ?? v;
    return (
      <div key={idx} className="relative">
        {isSplit && subEntry ? (
          <SubGridRender
            entry={subEntry}
            isColor={isColor}
            tint={tint}
            openSub={isMenuOpen ? open.sub : undefined}
            onClickSub={(sub) =>
              setOpen(isMenuOpen && open.sub === sub ? null : { r, c, sub })
            }
            onClickContainer={() => setOpen(isMenuOpen && open.sub === undefined ? null : { r, c })}
          />
        ) : (
          <button
            type="button"
            disabled={locked}
            onClick={() => !locked && setOpen(isMenuOpen ? null : { r, c })}
            aria-label={
              `Cột ${c + 1}, tầng ${r + 1}` + (locked ? ' — khoá (ô mở không hậu)' : '')
            }
            className={`relative block h-full w-full p-0 transition ${
              locked
                ? 'cursor-not-allowed'
                : isMenuOpen
                  ? 'outline outline-2 outline-neutral-900'
                  : 'hover:brightness-95'
            }`}
            style={{ backgroundColor: bg }}
          >
            {!isColor && !locked && (
              <CellSymbol type={symbol} stroke={pickContrast(bg)} />
            )}
          </button>
        )}
        {isMenuOpen && !locked && open.sub === undefined && (
          <CellMenu
            opts={opts}
            current={v}
            banned={banned}
            bgOf={bgOf}
            isColor={isColor}
            flipLeft={c >= cols - 2}
            onPick={(next) => {
              if (next === SPLIT_VAL) return; // không pick split trực tiếp
              if (v === SPLIT_VAL) mergeCell(r, c); // đổi từ split sang loại khác → cũng cần merge
              setCellValue(r, c, next);
              setOpen(null);
            }}
            extraActions={
              !isColor && param.subGridAllowed
                ? buildSubActions({
                    current: v,
                    splitVal: SPLIT_VAL,
                    onSplitH: () => splitCell(r, c, 'H'),
                    onSplitV: () => splitCell(r, c, 'V'),
                    onMerge: () => mergeCell(r, c),
                    entry: subEntry,
                    onAdd: () => changeSubN(r, c, 1),
                    onRemove: () => changeSubN(r, c, -1),
                  })
                : undefined
            }
          />
        )}
        {isMenuOpen && !locked && open.sub !== undefined && subEntry && (
          <CellMenu
            opts={subOptsForParent(opts, subEntry, r, c)}
            current={subEntry.cells[open.sub]}
            banned={[]}
            bgOf={bgOf}
            isColor={false}
            flipLeft={c >= cols - 2}
            onPick={(next) => setSubCellType(r, c, open.sub!, next)}
          />
        )}
      </div>
    );
  };

  return (
    <div ref={rootRef} className="rounded-lg border border-neutral-200 p-3">
      <label className="mb-1 block text-sm font-medium">{param.label}</label>
      <div className="flex justify-center rounded-md bg-neutral-100 p-2">
        <div
          className="grid gap-[3px]"
          style={{
            gridTemplateColumns: colSizes.map((w) => `${w}fr`).join(' '),
            gridTemplateRows: [...rowSizes].reverse().map((h) => `${h}fr`).join(' '),
            width: sumW * scale,
            height: sumH * scale,
            padding: 3,
            backgroundColor: darken(tint, 0.55),
          }}
        >
          {Array.from({ length: rows * cols }, (_, idx) => {
            const r = rows - 1 - Math.floor(idx / cols);
            const c = idx % cols;
            return renderCell(r, c, idx);
          })}
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-neutral-400">
        Bấm 1 ô để chọn — ô đúng tỉ lệ và màu như mặt đứng tủ.
      </p>
    </div>
  );
}

/** Vẽ mini sub-grid trong 1 ô cha (value = SPLIT). Mỗi sub-cell click → menu. */
function SubGridRender({
  entry,
  isColor,
  tint,
  openSub,
  onClickSub,
  onClickContainer,
}: {
  entry: SubEntry;
  isColor: boolean;
  tint: string;
  openSub: number | undefined;
  onClickSub: (sub: number) => void;
  onClickContainer: () => void;
}) {
  const isH = entry.dir === 'H';
  const N = entry.cells.length;
  return (
    <div
      className="relative grid gap-[2px] p-[2px] h-full w-full cursor-default"
      style={{
        gridTemplateColumns: isH ? entry.sizes.map((s) => `${s}fr`).join(' ') : '1fr',
        gridTemplateRows: isH ? '1fr' : [...entry.sizes].reverse().map((s) => `${s}fr`).join(' '),
        backgroundColor: darken(tint, 0.7),
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onClickContainer();
      }}
    >
      {Array.from({ length: N }, (_, i) => {
        // Đảo index nếu V (gridTemplateRows đã reverse): UI top = slot lớn nhất.
        const slot = isH ? i : N - 1 - i;
        const v = entry.cells[slot];
        const bg = v === 'open-nobk' ? '#ffffff' : tint;
        const focused = openSub === slot;
        return (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClickSub(slot);
            }}
            className={`relative block h-full w-full p-0 transition ${
              focused ? 'outline outline-2 outline-neutral-900' : 'hover:brightness-95'
            }`}
            style={{ backgroundColor: bg }}
            aria-label={`Sub-cell ${slot + 1}`}
          >
            {!isColor && <CellSymbol type={v} stroke={pickContrast(bg)} />}
          </button>
        );
      })}
    </div>
  );
}

/** Build danh sách extra actions cho CellMenu khi ô có subGridAllowed. */
function buildSubActions({
  current,
  splitVal,
  onSplitH,
  onSplitV,
  onMerge,
  entry,
  onAdd,
  onRemove,
}: {
  current: string;
  splitVal: string;
  onSplitH: () => void;
  onSplitV: () => void;
  onMerge: () => void;
  entry: SubEntry | undefined;
  onAdd: () => void;
  onRemove: () => void;
}): React.ReactNode {
  // Chỉ cho phép chia ô mở (open-back / open-nobk).
  const canSplit = current === 'open-back' || current === 'open-nobk';
  if (current === splitVal && entry) {
    return (
      <div className="flex flex-col gap-1 border-t border-neutral-200 p-1.5">
        <p className="text-[11px] font-medium text-neutral-500">
          Sub-grid {entry.dir === 'H' ? 'ngang' : 'dọc'} · {entry.cells.length} ô
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onAdd}
            className="flex-1 rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100"
          >
            + 1 ô
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="flex-1 rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100"
            disabled={entry.cells.length <= 2}
          >
            − 1 ô
          </button>
        </div>
        <button
          type="button"
          onClick={onMerge}
          className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
        >
          Gộp ô lại
        </button>
      </div>
    );
  }
  if (!canSplit) return undefined;
  return (
    <div className="flex flex-col gap-1 border-t border-neutral-200 p-1.5">
      <p className="text-[11px] font-medium text-neutral-500">Chia ô</p>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={onSplitH}
          className="flex-1 rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100"
        >
          Chia ngang
        </button>
        <button
          type="button"
          onClick={onSplitV}
          className="flex-1 rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100"
        >
          Chia dọc
        </button>
      </div>
    </div>
  );
}

/** Options cho menu sub-cell — tùy loại cha. */
function subOptsForParent(
  parentOpts: { value: string; label: string }[],
  entry: SubEntry,
  _r: number,
  _c: number,
): { value: string; label: string }[] {
  let out = parentOpts.filter((o) => o.value !== 'split');
  // Cha open-nobk không có hậu chung → drawer không thể bắt ray vững → ẨN HẲN
  // option drawer (tránh UX confusing: user chọn drawer rồi auto fallback thành door).
  if (entry.parentKind === 'open-nobk') {
    out = out.filter((o) => o.value !== 'drawer');
  }
  return out;
}

/** Bảng giá: tổng nổi bật + phân tích từng dòng. */
function PricePanel({ price }: { price: PriceBreakdown }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Giá</h2>
      <div className="rounded-lg bg-neutral-900 p-4 text-white">
        <p className="text-xs text-neutral-400">Giá bán tạm tính</p>
        <p className="text-2xl font-semibold tabular-nums">{formatPrice(price.total)}</p>
      </div>
      <dl className="mt-2 flex flex-col gap-1 text-xs text-neutral-500">
        {price.lines.map((line) => (
          <div key={line.label} className="flex justify-between gap-2">
            <dt>
              {line.label} <span className="text-neutral-400">· {line.detail}</span>
            </dt>
            <dd className="tabular-nums">{formatPrice(line.amount)}</dd>
          </div>
        ))}
        <div className="mt-1 flex justify-between border-t border-neutral-200 pt-1">
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
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Bảng cắt cho xưởng
      </h2>
      <p className="mb-2 text-xs text-neutral-500">
        {cutlist.totalPanels} tấm · {cutlist.totalAreaM2.toFixed(2)} m² ·{' '}
        {cutlist.totalWeightKg.toFixed(1)} kg · không dán cạnh
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-neutral-400">
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
              <tr className="border-t border-neutral-100">
                <td className="py-1">{row.label}</td>
                <td className="py-1">
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="h-3 w-3 shrink-0 rounded-sm border border-black/15"
                      style={{ backgroundColor: resolveMaterial(row.material).hex }}
                    />
                    <span className="text-neutral-500">
                      {materialLabels[row.material] ?? row.material}
                    </span>
                  </span>
                </td>
                <td className="py-1 text-right tabular-nums">{row.qty}</td>
                <td className="py-1 text-right tabular-nums">{Math.round(row.length_mm)}</td>
                <td className="py-1 text-right tabular-nums">{Math.round(row.width_mm)}</td>
                <td className="py-1 text-right tabular-nums">{row.thickness_mm}</td>
                <td className="py-1 text-right tabular-nums text-neutral-500">
                  {row.weight_kg.toFixed(1)} kg
                </td>
              </tr>
              {row.notes && (
                <tr>
                  <td colSpan={7} className="pb-1 pl-3 text-[11px] italic text-neutral-400">
                    ↳ {row.notes}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
      {cutlist.hardware.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-xs text-neutral-600">
          {cutlist.hardware.map((hw) => (
            <li key={hw.label}>
              <div className="flex justify-between gap-2">
                <span>{hw.label}</span>
                <span className="tabular-nums">
                  ×{hw.qty}
                  <span className="ml-2 text-neutral-400">· {hw.weight_kg.toFixed(2)} kg</span>
                </span>
              </div>
              {hw.notes && <p className="text-[11px] italic text-neutral-400">↳ {hw.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
