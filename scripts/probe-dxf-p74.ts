// =============================================================================
// probe-dxf-p74 — Xuất ZIP DXF mẫu cho founder nghiệm thu hệ connector 2-in-1.
// Chạy: pnpm tsx scripts/probe-dxf-p74.ts <preset.json | demo-split> <outDir>
//
// Mimick ĐÚNG pipeline route maume /api/admin/ke-dxf (P73 resolver {...v} +
// isBlocksValue passthrough; catalog KV → priceConfig → build → cutlist →
// nestBoards → board FRONT/BACK DXF + edge-holes.csv + legacy per-part DXF).
// Catalog đọc từ /tmp/p74-dxf/catalog.json (pull KV production trước khi chạy).
// In summary machining per part + layer breakdown để soi nhanh không cần CAD.
// =============================================================================

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import tuKe from '../products/tu-ke/dna';
import {
  encodeBlocks,
  encodeCellGrid,
  isBlocksValue,
  reconcileCellGrid,
} from '../src/configurator/cellgrid';
import { buildCutlist } from '../src/configurator/cutlist';
import type { ParamValues, Part, ProductDNA } from '../src/configurator/types';
import {
  generateBoardBackDXF,
  generateBoardFrontDXF,
  generateEdgeHolesCSV,
  generateNestingDXF,
  generatePartDXF,
} from '../src/lib/dxf/generator';
import { createZip } from '../src/lib/dxf/zip';
import { nestBoards } from '../src/lib/nesting';
import type { ProductionCatalog } from '../src/lib/production-catalog';
import { catalogToPriceConfig, mergeCatalog } from '../src/lib/production-catalog';

// Copy semantics route ke-dxf (P73) — seed {...v} + blocks passthrough.
function resolveFullValues(dna: ProductDNA, override: Record<string, number | string>): ParamValues {
  let v: ParamValues = {};
  for (const p of dna.parameters) v[p.id] = p.default;
  v = { ...v, ...override };
  if (dna.normalizeValues) v = dna.normalizeValues(v);
  const controls = dna.resolveControls?.(v) ?? dna.parameters;
  const resolved: ParamValues = { ...v };
  for (const c of controls) {
    if (c.type === 'cellgrid') {
      const raw = String(v[c.id] ?? c.default);
      resolved[c.id] = isBlocksValue(raw)
        ? raw
        : encodeCellGrid(
            reconcileCellGrid(
              raw,
              c.gridRows ?? 0,
              c.gridCols ?? 0,
              c.options?.[0]?.value ?? '',
              c.disabledByRow,
              c.disabledByCol,
              c.cellFallbackMap,
            ),
          );
    } else {
      resolved[c.id] = v[c.id] ?? c.default;
    }
  }
  return resolved;
}

/** Mẫu tự tạo đủ đường code: cánh + V-split (vách phụ đứng) + H-split (vách phụ ngang). */
function demoSplitValues(): Record<string, number | string> {
  return {
    width: 900,
    height: 800,
    depth: 400,
    columns: 2,
    rows: 2,
    widthMode: 'even',
    heightMode: 'even',
    handleType: 'bar',
    cells: encodeBlocks([
      { r: 0, c: 0, rs: 1, cs: 1, t: 'door' },
      { r: 0, c: 1, rs: 1, cs: 1, t: 'open-back>open-back' }, // V-split → vách phụ ĐỨNG
      { r: 1, c: 0, rs: 1, cs: 1, t: 'open-back^open-back' }, // H-split → vách phụ NGANG
      { r: 1, c: 1, rs: 1, cs: 1, t: 'open-back' },
    ]),
  };
}

function main(): void {
  const [, , src, outDir] = process.argv;
  if (!src || !outDir) {
    console.error('Cách dùng: pnpm tsx scripts/probe-dxf-p74.ts <preset.json | demo-split> <outDir>');
    process.exit(1);
  }

  let slug: string;
  let values: Record<string, number | string>;
  if (src === 'demo-split') {
    slug = 'demo-split';
    values = demoSplitValues();
  } else {
    const preset = JSON.parse(readFileSync(src, 'utf8')) as {
      slug?: string;
      name?: string;
      values: Record<string, number | string>;
    };
    slug = preset.slug ?? 'preset';
    values = preset.values;
  }

  const catalogRaw = JSON.parse(
    readFileSync('/tmp/p74-dxf/catalog.json', 'utf8'),
  ) as Partial<ProductionCatalog>;
  const catalog = mergeCatalog(catalogRaw);
  const priceConfig = catalogToPriceConfig(catalog);

  const resolvedValues = resolveFullValues(tuKe, values);
  const build = tuKe.build(resolvedValues, { priceConfig });
  const cutlist = buildCutlist(build, priceConfig);
  const parts = cutlist.parts ?? build.parts;
  const nesting = nestBoards(parts, catalog.boards, catalog.kerfMm);

  const partLookup = new Map<string, Part>();
  for (const p of parts) partLookup.set(p.id, p);

  const files: Record<string, string> = {};
  nesting.boards.forEach((board, i) => {
    const base = `board-${i + 1}-${board.materialId}-${board.thicknessMm}mm`;
    files[`${base}-FRONT.dxf`] = generateBoardFrontDXF(board, partLookup);
    files[`${base}-BACK.dxf`] = generateBoardBackDXF(board, partLookup);
  });
  files['edge-holes.csv'] = generateEdgeHolesCSV(nesting.boards, partLookup);
  for (const p of parts) files[`legacy/parts/${p.id}.dxf`] = generatePartDXF(p);
  nesting.boards.forEach((board, i) => {
    files[`legacy/nesting/board-${i + 1}-${board.materialId}-${board.thicknessMm}-OUTLINE.dxf`] =
      generateNestingDXF(board);
  });

  mkdirSync(outDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    const p = join(outDir, name);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  const zipPath = join(outDir, `ke-${slug}-P74.zip`);
  writeFileSync(zipPath, createZip(files));

  // ===== Summary soi nhanh =====
  console.log(`\n===== ${slug} — ${parts.length} tấm, ${nesting.boards.length} khổ ván =====`);
  console.log(`ZIP: ${zipPath}`);
  const byPurpose: Record<string, number> = {};
  for (const p of parts) {
    for (const m of p.machining ?? []) {
      const key = `${m.op}:${m.purpose}`;
      byPurpose[key] = (byPurpose[key] ?? 0) + 1;
    }
  }
  console.log('Machining toàn tủ:', JSON.stringify(byPurpose));
  console.log('BOM:', build.hardware.map((h) => `${h.id}×${h.qty}`).join(' · '));

  // Vách đứng: liệt kê op trên MẶT (phải sạch với tủ mở; chỉ hinge/slide khi có cánh/ngăn kéo)
  for (const p of parts.filter((x) => x.label === 'Vách đứng' || x.label === 'Vách phụ')) {
    const face = (p.machining ?? []).filter((m) => m.op !== 'edge_drill');
    const edge = (p.machining ?? []).filter((m) => m.op === 'edge_drill');
    const facePurposes = [...new Set(face.map((m) => `${m.op}:${m.purpose}`))].join(',') || 'SẠCH';
    console.log(`  ${p.id}: mặt=[${facePurposes}] (${face.length} op) cạnh=${edge.length} chốt`);
  }
  // Layer breakdown board FRONT/BACK đầu tiên
  for (const fname of Object.keys(files).filter((f) => f.endsWith('.dxf') && f.startsWith('board-1-'))) {
    const lines = files[fname].split('\n');
    const layers: Record<string, number> = {};
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i] === '8') layers[lines[i + 1]] = (layers[lines[i + 1]] ?? 0) + 1;
    }
    console.log(`Layer ${fname}:`, JSON.stringify(layers));
  }
  const csvLines = files['edge-holes.csv'].split('\n').filter(Boolean);
  console.log(`edge-holes.csv: ${csvLines.length - 1} dòng. 3 dòng đầu:`);
  for (const l of csvLines.slice(0, 4)) console.log('  ' + l);
}

main();
