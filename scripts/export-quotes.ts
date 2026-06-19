// =============================================================================
// export-quotes.ts — xuất JSON BÁO GIÁ + CUTLIST cho N preset trải đều mức giá.
// Chạy đúng chuỗi server-side của /collection/[slug]:
//   normalizeValues → build → computePrice → buildCutlist
// Nạp bảng giá PRODUCTION thật (catalog:production dump từ KV) → giá khớp web.
// Dữ liệu vào: /tmp/ke-export/{catalog.json, presets/*.json} (đã dump bằng wrangler).
// Dữ liệu ra : ~/Downloads/KE-baogia/  (5 file chi tiết + 1 tổng hợp + 1 gộp).
// =============================================================================
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import tuKe from '../products/tu-ke/dna';
import { buildCutlist } from '../src/configurator/cutlist';
import { computePrice, formatPrice } from '../src/configurator/pricing';
import { mergeCatalog, catalogToPriceConfig } from '../src/lib/production-catalog';

const DIR = '/tmp/ke-export';
const OUT = join(homedir(), 'Downloads', 'KE-baogia');

// --- Bảng giá production thật (merge default cho field khuyết) ---
const catalogRaw = JSON.parse(readFileSync(join(DIR, 'catalog.json'), 'utf8'));
const catalog = mergeCatalog(catalogRaw);
const priceConfig = catalogToPriceConfig(catalog);

interface Row {
  slug: string;
  name: string;
  category: string;
  values: Record<string, unknown>;
  total: number;
  price: ReturnType<typeof computePrice>;
  cutlist: ReturnType<typeof buildCutlist>;
  build: ReturnType<typeof tuKe.build>;
}

// --- Tính giá + cutlist cho TẤT CẢ preset ---
const rows: Row[] = [];
for (const f of readdirSync(join(DIR, 'presets')).filter((x) => x.endsWith('.json'))) {
  const preset = JSON.parse(readFileSync(join(DIR, 'presets', f), 'utf8'));
  try {
    const values = tuKe.normalizeValues ? tuKe.normalizeValues(preset.values) : preset.values;
    const build = tuKe.build(values);
    const price = computePrice(build, priceConfig);
    const cutlist = buildCutlist(build, priceConfig);
    rows.push({
      slug: preset.slug,
      name: preset.name,
      category: preset.category,
      values: preset.values,
      total: price.total,
      price,
      cutlist,
      build,
    });
  } catch (e) {
    console.error('  ✗ FAIL', preset.slug, (e as Error).message);
  }
}
rows.sort((a, b) => a.total - b.total);

console.log(`\n=== ${rows.length} PRESET (sắp theo giá) ===`);
rows.forEach((r, i) =>
  console.log(`${String(i + 1).padStart(2)}. ${formatPrice(r.total).padStart(14)}  ${r.slug}`),
);

// --- Chọn 5 cái trải đều: rẻ nhất · 25% · giữa · 75% · đắt nhất ---
const n = rows.length;
const wantIdx = [0, Math.round(0.25 * (n - 1)), Math.round(0.5 * (n - 1)), Math.round(0.75 * (n - 1)), n - 1];
const idx = [...new Set(wantIdx)]; // khử trùng nếu N nhỏ
const picked = idx.map((i) => rows[i]);

// --- Định dạng JSON thân thiện tiếng Việt ---
function toOutput(r: Row) {
  const v = r.values as Record<string, number | string>;
  const p = r.price;
  const c = r.cutlist;
  const b = r.build as { size?: unknown; counts?: unknown };
  // p.margin là HỆ SỐ nhân (×~1.6), KHÔNG phải tiền. total = (chi phí) × margin (+ laborPerOrder).
  const labor = (p.laborCost ?? 0) + (p.laborPerOrder ?? 0);
  const tongChiPhi = p.materialCost + p.hardwareCost + labor;
  const loiNhuan = p.total - tongChiPhi; // = tổng − chi phí (khớp 2 chiều)
  return {
    preset: {
      slug: r.slug,
      ten: r.name,
      danhMuc: r.category,
      kichThuoc_mm: { rong: v.width, cao: v.height, sau: v.depth },
      soCot: v.columns,
      soTang: v.rows,
      mauVan: v.color,
      danCanh: v.edgeBanding,
      tayNam: v.handleType,
      thongSoBuild: { size: b.size, counts: b.counts },
    },
    baoGia: {
      tongCong_VND: p.total,
      tongCong_chu: formatPrice(p.total),
      chiPhiVatLieu_daGomHaoHut_VND: p.materialCost,
      chiPhiPhuKien_VND: p.hardwareCost,
      tienCongCatVan_VND: labor,
      tongChiPhiTruocLoiNhuan_VND: tongChiPhi,
      heSoLoiNhuan: p.margin, // hệ số NHÂN (×), không phải tiền
      loiNhuan_VND: loiNhuan, // = tổng cộng − tổng chi phí
      chiTietDong: p.lines.map((l) => ({
        hangMuc: l.label,
        dienGiai: l.detail,
        thanhTien_VND: l.amount,
      })),
      nesting: p.nestingCost ?? null,
    },
    cutlist: {
      tongSoTam: c.totalPanels,
      tongDienTich_m2: +c.totalAreaM2.toFixed(3),
      tongCanNang_kg: +c.totalWeightKg.toFixed(2),
      tongMetDanCanh: c.totalEdgeBandingM != null ? +c.totalEdgeBandingM.toFixed(2) : undefined,
      tamVan: c.panels.map((row) => ({
        ten: row.label,
        soLuong: row.qty,
        dai_mm: row.length_mm,
        rong_mm: row.width_mm,
        day_mm: row.thickness_mm,
        vatLieu: row.material,
        vanGo: row.grain,
        canNang_kg: +row.weight_kg.toFixed(2),
        ghiChu: row.notes,
      })),
      phuKien: c.hardware.map((h) => ({
        ten: h.label,
        soLuong: h.qty,
        canNang_kg: +h.weight_kg.toFixed(2),
        ghiChu: h.notes,
      })),
    },
  };
}

// --- Ghi file ---
mkdirSync(OUT, { recursive: true });
const details = picked.map(toOutput);
picked.forEach((r, i) => {
  const file = join(OUT, `${String(i + 1).padStart(2, '0')}-${r.slug}.json`);
  writeFileSync(file, JSON.stringify(details[i], null, 2), 'utf8');
});
// gộp 5 cái + tổng hợp toàn bộ
writeFileSync(join(OUT, '00-tong-hop.json'), JSON.stringify({
  taoLuc: new Date().toISOString().slice(0, 19).replace('T', ' '),
  bangGia: 'catalog:production (KV) merge default',
  tatCaPreset: rows.map((r) => ({ slug: r.slug, ten: r.name, gia_VND: r.total, gia_chu: formatPrice(r.total) })),
  daChon5: picked.map((r, i) => ({ thuTu: i + 1, slug: r.slug, gia_VND: r.total, gia_chu: formatPrice(r.total) })),
}, null, 2), 'utf8');
writeFileSync(join(OUT, '5-preset-day-du.json'), JSON.stringify(details, null, 2), 'utf8');

console.log(`\n=== ĐÃ CHỌN 5 (trải đều giá) ===`);
picked.forEach((r, i) => console.log(`  ${i + 1}. ${formatPrice(r.total).padStart(14)}  ${r.name}  (${r.slug})`));
console.log(`\n✓ Xuất ${picked.length} file chi tiết + tổng hợp + gộp vào:\n  ${OUT}`);
