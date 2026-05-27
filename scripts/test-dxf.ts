// =============================================================================
// test-dxf — CLI test cho DXF generator + ZIP writer (Phase 3 verify).
// Chạy: pnpm tsx scripts/test-dxf.ts
//
// Sinh DXF cho default tủ kệ → ghi ra /tmp/dxf-test/*.dxf để verify trong
// LibreCAD hoặc dxfviewer.com. Cũng tạo /tmp/dxf-test/output.zip để verify ZIP.
//
// Sau Phase 4 (nesting), script này sẽ extend để test nesting DXF nữa.
// =============================================================================

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import tuKe from '../products/tu-ke/dna';
import { buildCutlist } from '../src/configurator/cutlist';
import { generateNestingDXF, generatePartDXF } from '../src/lib/dxf/generator';
import { createZip } from '../src/lib/dxf/zip';
import { nestBoards } from '../src/lib/nesting';
import type { CatalogBoard } from '../src/lib/production-catalog';

// Sample boards giả lập admin đã nhập catalog (khổ chuẩn VN 1220×2440)
const SAMPLE_BOARDS: CatalogBoard[] = [
  { id: 'mdf-1220x2440-18', label: 'MDF 1220×2440 18mm', materialId: 'mdf_son', lengthMm: 2440, widthMm: 1220, thicknessMm: 18 },
  { id: 'mdf-1220x2440-9', label: 'MDF 1220×2440 9mm', materialId: 'mdf_son', lengthMm: 2440, widthMm: 1220, thicknessMm: 9 },
  { id: 'plywood-1220x2440-18', label: 'Plywood 1220×2440 18mm', materialId: 'plywood_veneer', lengthMm: 2440, widthMm: 1220, thicknessMm: 18 },
  { id: 'plywood-1220x2440-9', label: 'Plywood 1220×2440 9mm', materialId: 'plywood_veneer', lengthMm: 2440, widthMm: 1220, thicknessMm: 9 },
  { id: 'mela-1220x2440-18', label: 'Melamine 1220×2440 18mm', materialId: 'plywood_melamine', lengthMm: 2440, widthMm: 1220, thicknessMm: 18 },
  { id: 'mela-1220x2440-9', label: 'Melamine 1220×2440 9mm', materialId: 'plywood_melamine', lengthMm: 2440, widthMm: 1220, thicknessMm: 9 },
];
const KERF_MM = 3;

function defaults(): Record<string, number | string> {
  const v: Record<string, number | string> = {};
  for (const p of tuKe.parameters) v[p.id] = p.default;
  return v;
}

function main(): void {
  console.log('=== TEST DXF — Phase 3 ===\n');

  // Build default tủ kệ
  const values = defaults();
  const build = tuKe.build(values);
  const cutlist = buildCutlist(build);
  console.log(`Build: ${build.parts.length} parts, ${build.hardware.length} hardware`);
  console.log(`Cutlist: panels.length=${cutlist.panels.length}, parts.length=${cutlist.parts?.length ?? 0}`);

  // Check machining presence
  const partsWithMach = build.parts.filter((p) => (p.machining?.length ?? 0) > 0);
  console.log(`Parts with machining[]: ${partsWithMach.length} / ${build.parts.length}`);
  const machSample = partsWithMach[0];
  if (machSample) {
    console.log(`Sample: "${machSample.label}" ${machSample.id} — ${machSample.machining?.length} ops`);
    console.log(`  First op:`, JSON.stringify(machSample.machining?.[0]));
  }

  // Output dir
  const outDir = '/tmp/dxf-test';
  mkdirSync(outDir, { recursive: true });
  console.log(`\nWriting to ${outDir}/`);

  // Generate DXF per Part (sử dụng cutlist.parts? = raw Part[])
  const parts = cutlist.parts ?? build.parts;
  const files: Record<string, string> = {};
  for (const p of parts) {
    const dxf = generatePartDXF(p);
    const filename = `${p.id}.dxf`;
    writeFileSync(join(outDir, filename), dxf);
    files[`parts/${filename}`] = dxf;
  }
  console.log(`Wrote ${parts.length} DXF files`);

  // Sample inspection
  const bottom = parts.find((p) => p.id === 'bottom');
  if (bottom) {
    const dxf = generatePartDXF(bottom);
    const lines = dxf.split('\n');
    console.log(`\nSample DXF "bottom" — ${lines.length} lines, ${dxf.length} bytes`);
    const layerCounts: Record<string, number> = {};
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i] === '8' && lines[i + 1]) {
        layerCounts[lines[i + 1]] = (layerCounts[lines[i + 1]] ?? 0) + 1;
      }
    }
    console.log('Layer breakdown:', layerCounts);
  }

  const shelfMid = parts.find((p) => p.id.startsWith('shelf-'));
  if (shelfMid) {
    const dxf = generatePartDXF(shelfMid);
    const hasFlipText = dxf.includes('TAM 2 MAT');
    console.log(`Kệ giữa "${shelfMid.id}" — hasFlipText=${hasFlipText}`);
  }

  // === Nesting test ===
  console.log('\n=== Nesting test ===');
  const nesting = nestBoards(parts, SAMPLE_BOARDS, KERF_MM);
  console.log(`Nesting: ${nesting.boards.length} boards used, ${nesting.unplaced.length} unplaced`);
  console.log(`Avg utilization: ${(nesting.avgUtilization * 100).toFixed(1)}%`);
  for (const b of nesting.boards) {
    console.log(
      `  Board ${b.boardId} ${b.boardLength}×${b.boardWidth} ${b.materialId} ${b.thicknessMm}mm — ${b.placements.length} parts, ${(b.utilization * 100).toFixed(1)}%`,
    );
  }
  if (nesting.unplaced.length > 0) {
    console.log('Unplaced:');
    for (const u of nesting.unplaced) console.log(`  ${u.label} ${u.id} ${u.length_mm}×${u.width_mm}×${u.thickness_mm} ${u.material}`);
  }

  // Generate nesting DXF per board
  for (let i = 0; i < nesting.boards.length; i++) {
    const dxf = generateNestingDXF(nesting.boards[i]);
    const filename = `board-${i + 1}-${nesting.boards[i].materialId}-${nesting.boards[i].thicknessMm}.dxf`;
    writeFileSync(join(outDir, filename), dxf);
    files[`nesting/${filename}`] = dxf;
  }
  console.log(`Wrote ${nesting.boards.length} nesting DXF files`);

  // Tạo ZIP (gồm part DXFs + nesting DXFs)
  const zipBytes = createZip(files);
  const zipPath = join(outDir, 'output.zip');
  writeFileSync(zipPath, zipBytes);
  console.log(`\nZIP written: ${zipPath} (${zipBytes.length} bytes, ${Object.keys(files).length} files)`);

  // ZIP signature check
  const sig = zipBytes.slice(0, 4);
  const valid = sig[0] === 0x50 && sig[1] === 0x4b && sig[2] === 0x03 && sig[3] === 0x04;
  console.log(`ZIP signature PK\\x03\\x04: ${valid ? 'VALID' : 'INVALID'}`);

  console.log('\nVERIFY:');
  console.log('1. Mở /tmp/dxf-test/bottom.dxf trong LibreCAD hoặc dxfviewer.com');
  console.log('2. Kiểm: outline 1900×350 + lỗ chốt + vít hậu + lỗ chân Ø8 trên layer DRILL_BACK_FOOT');
  console.log('3. Mở /tmp/dxf-test/shelf-0.dxf — kệ giữa, kiểm DRILL_FRONT_* + DRILL_BACK_SHELFPIN');
  console.log('4. Unzip /tmp/dxf-test/output.zip → verify đủ file');
}

main();
