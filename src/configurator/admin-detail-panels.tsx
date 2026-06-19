// =============================================================================
// admin-detail-panels.tsx (P84) — PricePanel + CutlistPanel DÙNG CHO TỦ Y.
// Copy nguyên từ Configurator.tsx (x) để YConfigurator hiện chi tiết giá + bảng
// cắt cho admin, mà KHÔNG phải đụng/đụng-mirror Configurator.tsx (x bất biến).
// Pure render (không hook) — nhận price/cutlist đã tính sẵn từ YConfigurator.
// =============================================================================
import { Fragment, type CSSProperties } from 'react';
import { formatPrice, type PriceBreakdown } from './pricing';
import type { Cutlist } from './cutlist';
import { resolveMaterial } from './materials';

/** Ô màu nhỏ trong bảng cắt: ảnh vân nếu có, ngược lại nền hex (gradient nếu khác cạnh). */
function swatchStyle(material: string): CSSProperties {
  const m = resolveMaterial(material);
  if (m.textureUrl) {
    return { backgroundImage: `url(${m.textureUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  if (!m.edgeHex || m.edgeHex === m.hex) return { backgroundColor: m.hex };
  return { background: `linear-gradient(135deg, ${m.hex} 50%, ${m.edgeHex} 50%)` };
}

/** Bảng giá CHI TIẾT (chỉ admin) — KPI lãi gộp + đơn giá/m² + tách dòng vật liệu/
 *  phụ kiện/hao hụt/công. Nhóm dòng theo lineMargin (khung null / phụ kiện >1 /
 *  giá-vốn ===1). */
export function PricePanel({
  price,
  size,
}: {
  price: PriceBreakdown;
  size?: { w: number; h: number; d: number };
}) {
  const costTotal =
    price.lines.reduce((s, l) => s + l.amount, 0) + (price.laborPerOrder ?? 0);
  const grossProfit = price.total - costTotal;
  const grossPct = price.total > 0 ? (grossProfit / price.total) * 100 : 0;
  const frontAreaM2 = size ? (size.w * size.h) / 1_000_000 : 0;
  const pricePerM2Front = frontAreaM2 > 0 ? price.total / frontAreaM2 : null;
  const fmtM = (mm: number) => (mm / 1000).toFixed(2).replace('.', ',');
  const fmtM2 = (m2: number) => m2.toFixed(2).replace('.', ',');
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]/60">Giá</h2>
      <div className="rounded-lg bg-[var(--color-ink)] p-4 text-white">
        <p className="text-xs text-[var(--color-accent)]/60">Giá bán tạm tính</p>
        <p className="text-2xl font-semibold tabular-nums">{formatPrice(price.total)}</p>
        <dl className="mt-3 flex flex-col gap-1.5 border-t border-white/15 pt-2 text-xs">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[var(--color-accent)]/70">
              Lãi gộp <span className="text-[var(--color-accent)]/45">(chưa gồm vận chuyển)</span>
            </dt>
            <dd className="tabular-nums font-medium text-[var(--color-accent)]">
              {formatPrice(grossProfit)}{' '}
              <span className="text-[var(--color-accent)]/60">({grossPct.toFixed(0)}%)</span>
            </dd>
          </div>
          {pricePerM2Front != null && (
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-[var(--color-accent)]/70">Đơn giá / m² mặt đứng</dt>
              <dd className="tabular-nums font-medium">{formatPrice(pricePerM2Front)}</dd>
            </div>
          )}
        </dl>
        {pricePerM2Front != null && size && (
          <p className="mt-1.5 text-[10px] text-[var(--color-accent)]/45">
            Mặt đứng {fmtM(size.w)}m × {fmtM(size.h)}m = {fmtM2(frontAreaM2)} m²
          </p>
        )}
      </div>
      <dl className="mt-2 flex flex-col gap-1 text-xs text-[var(--color-accent)]/70">
        {price.lines.filter((l) => l.lineMargin == null).map((line, i) => (
          <div key={`pl-${i}`} className="flex justify-between gap-2">
            <dt>
              {line.label} <span className="text-[var(--color-accent)]/60">· {line.detail}</span>
            </dt>
            <dd className="tabular-nums">{formatPrice(line.amount)}</dd>
          </div>
        ))}
        <div className="mt-1 flex justify-between border-t border-[var(--color-accent)]/20 pt-1">
          <dt>Hệ số lãi (khung)</dt>
          <dd className="tabular-nums">×{price.margin}</dd>
        </div>
        {price.lines.some((l) => l.lineMargin != null && l.lineMargin > 1) && (
          <div className="flex justify-between text-[var(--color-accent)]/55">
            <dt>Phụ kiện (lãi)</dt>
            <dd className="tabular-nums">×{price.hardwareMargin ?? 1.2}</dd>
          </div>
        )}
        {price.lines.filter((l) => l.lineMargin != null && l.lineMargin > 1).map((line, i) => (
          <div key={`ph-${i}`} className="flex justify-between gap-2 pl-2">
            <dt>
              {line.label} <span className="text-[var(--color-accent)]/60">· {line.detail}</span>
            </dt>
            <dd className="tabular-nums">{formatPrice(line.amount)}</dd>
          </div>
        ))}
        {price.lines.filter((l) => l.lineMargin === 1).map((line, i) => (
          <div key={`pa-${i}`} className="flex justify-between gap-2">
            <dt>
              {line.label}{' '}
              <span className="text-[var(--color-accent)]/60">· {line.detail} · giá vốn, không tính lãi</span>
            </dt>
            <dd className="tabular-nums">+{formatPrice(line.amount)}</dd>
          </div>
        ))}
        {price.laborPerOrder > 0 && (
          <div className="flex justify-between">
            <dt>Công mỗi đơn</dt>
            <dd className="tabular-nums">+{formatPrice(price.laborPerOrder)}</dd>
          </div>
        )}
        <div className="mt-1 flex justify-between border-t border-[var(--color-accent)]/20 pt-1 text-[var(--color-accent)]/55">
          <dt>Tổng giá vốn</dt>
          <dd className="tabular-nums">{formatPrice(costTotal)}</dd>
        </div>
      </dl>
    </section>
  );
}

/** Bảng cắt cho xưởng — cột "Vật liệu" phân biệt tấm theo vật liệu; KHÔNG có cột dán cạnh. */
export function CutlistPanel({
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
