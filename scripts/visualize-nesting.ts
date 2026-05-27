// One-shot: generate HTML visualizing nesting layout cho preset wide.
// Output: /Users/hsonvu/CLAUDE/wide-nesting.html → http://localhost:8765/wide-nesting.html
import fs from 'fs';
import tuKe from '../products/tu-ke/dna';
import { nestBoards } from '../src/lib/nesting';
import { PRESETS } from '../products/tu-ke/presets';

const wide = PRESETS.find((p) => p.slug === 'wide')!;
const vals: any = { ...wide.values, color: 'mfc_melamine/ml_xanh_navy_edge_den' };
const build = tuKe.build(vals);

const boards = [
  { id: 'mfc-18', label: 'MFC 18mm', materialId: 'mfc_melamine' as const, lengthMm: 2440, widthMm: 1220, thicknessMm: 18 },
  { id: 'mfc-9', label: 'MFC 9mm', materialId: 'mfc_melamine' as const, lengthMm: 2440, widthMm: 1220, thicknessMm: 9 },
];
const KERF = 3;
const result = nestBoards(build.parts, boards, KERF);

const palette = ['#FFB347', '#77DD77', '#AEC6CF', '#FF6961', '#CFCFC4', '#B19CD9', '#FFD96A', '#F49AC2', '#84B6F4', '#FAA0A0', '#C4A484', '#9FE2BF'];
const colorByLabel = new Map<string, string>();
let cIdx = 0;
const colorFor = (lbl: string) => {
  if (!colorByLabel.has(lbl)) colorByLabel.set(lbl, palette[cIdx++ % palette.length]);
  return colorByLabel.get(lbl)!;
};

const labels = [...new Set(build.parts.map((p) => p.label))];

let html = `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8"><title>Nesting — KÊ. Wide</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 24px; background: #f5f5f5; margin: 0; color: #222; }
  h1 { margin: 0 0 8px; font-size: 22px; }
  .meta { color: #555; margin-bottom: 20px; font-size: 14px; line-height: 1.6; }
  .legend { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 24px; background: white; padding: 12px 16px; border-radius: 8px; }
  .legend-item { display: flex; align-items: center; gap: 6px; font-size: 13px; }
  .legend-color { width: 16px; height: 16px; border: 1px solid #333; border-radius: 2px; }
  .sheet { background: white; border-radius: 8px; padding: 20px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .sheet-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px; flex-wrap: wrap; gap: 8px; }
  .sheet-title { font-weight: 700; font-size: 17px; }
  .sheet-stats { color: #666; font-size: 14px; }
  svg { width: 100%; max-width: 100%; display: block; background: #fdfdfd; border: 2px solid #333; border-radius: 4px; }
  text { font-family: -apple-system, sans-serif; fill: #111; pointer-events: none; font-weight: 500; }
  rect.part { stroke: #222; stroke-width: 3; }
  .unplaced { background: #fee; border: 2px solid #c33; padding: 16px; border-radius: 8px; color: #800; font-size: 14px; }
  .axis-label { font-size: 28px; fill: #555; }
</style></head><body>
<h1>Nesting mô phỏng — Preset KÊ. Wide</h1>
<div class="meta">
  <strong>Kích thước tủ:</strong> ${vals.width}×${vals.height}×${vals.depth} mm · <strong>Cột × Tầng:</strong> ${vals.columns}×${vals.rows}<br>
  <strong>Vật liệu:</strong> ${vals.color}<br>
  <strong>Tổng parts:</strong> ${build.parts.length} tấm · <strong>Sheets cần:</strong> ${result.boards.length} ván cốt (1220×2440mm) · <strong>Util TB:</strong> ${(result.avgUtilization * 100).toFixed(1)}% · <strong>Unplaced:</strong> ${result.unplaced.length}<br>
  <strong>Kerf:</strong> ${KERF}mm (mạch cưa giữa các tấm) · <strong>Algorithm:</strong> Guillotine FFD (First-Fit Decreasing by max dimension)
</div>
<div class="legend">
${labels.map((l) => `  <div class="legend-item"><div class="legend-color" style="background:${colorFor(l)}"></div>${l}</div>`).join('\n')}
</div>
`;

for (const board of result.boards) {
  const totalArea = board.boardLength * board.boardWidth;
  const usedArea = board.placements.reduce((s, p) => s + p.partLength * p.partWidth, 0);
  html += `
<div class="sheet">
  <div class="sheet-header">
    <div class="sheet-title">${board.boardId} — Ván cốt ${board.boardLength}×${board.boardWidth}×${board.thicknessMm}mm</div>
    <div class="sheet-stats">${board.placements.length} tấm · ${(usedArea / 1_000_000).toFixed(2)} m² dùng / ${(totalArea / 1_000_000).toFixed(2)} m² ván · util <strong>${(board.utilization * 100).toFixed(1)}%</strong></div>
  </div>
  <svg viewBox="-50 -50 ${board.boardLength + 100} ${board.boardWidth + 100}" preserveAspectRatio="xMidYMid meet">
    <!-- Board border -->
    <rect x="0" y="0" width="${board.boardLength}" height="${board.boardWidth}" fill="white" stroke="#222" stroke-width="6"/>
    <!-- Axis labels -->
    <text class="axis-label" x="${board.boardLength / 2}" y="-15" text-anchor="middle">${board.boardLength}mm →</text>
    <text class="axis-label" x="-25" y="${board.boardWidth / 2}" text-anchor="middle" transform="rotate(-90 -25 ${board.boardWidth / 2})">${board.boardWidth}mm ↑</text>
`;
  for (const p of board.placements) {
    // Nesting coords: bottom-left origin. SVG: top-left origin. Flip Y.
    const w = p.rotated ? p.partWidth : p.partLength;
    const h = p.rotated ? p.partLength : p.partWidth;
    const svgX = p.x;
    const svgY = board.boardWidth - p.y - h;
    const cx = svgX + w / 2;
    const cy = svgY + h / 2;
    // Font size dynamic so labels are readable but fit small parts
    const fs = Math.min(w, h) / 6;
    html += `    <rect class="part" x="${svgX}" y="${svgY}" width="${w}" height="${h}" fill="${colorFor(p.partLabel)}" fill-opacity="0.7"/>
    <text x="${cx}" y="${cy - fs}" text-anchor="middle" font-size="${fs}">${p.partLabel}${p.rotated ? ' ↻' : ''}</text>
    <text x="${cx}" y="${cy + fs}" text-anchor="middle" font-size="${fs * 0.85}" fill="#444">${p.partLength}×${p.partWidth}mm</text>
`;
  }
  html += `  </svg>
</div>
`;
}

if (result.unplaced.length > 0) {
  html += `<div class="unplaced"><strong>⚠ Unplaced (${result.unplaced.length}):</strong><br>${result.unplaced.map((p) => `${p.label} (${p.length_mm}×${p.width_mm}×${p.thickness_mm}mm)`).join(' · ')}</div>\n`;
}

html += `</body></html>`;

const outPath = '/Users/hsonvu/CLAUDE/wide-nesting.html';
fs.writeFileSync(outPath, html);
console.log(`✓ Generated ${outPath} (${(html.length / 1024).toFixed(1)} KB)`);
console.log(`✓ Open: http://localhost:8765/wide-nesting.html`);
console.log(`\nSummary:`);
console.log(`  Parts: ${build.parts.length} | Sheets: ${result.boards.length} | Util TB: ${(result.avgUtilization * 100).toFixed(1)}% | Unplaced: ${result.unplaced.length}`);
for (const b of result.boards) {
  console.log(`  ${b.boardId}: ${b.placements.length} parts · util ${(b.utilization * 100).toFixed(1)}%`);
}
