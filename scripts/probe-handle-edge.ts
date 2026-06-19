// PROBE — tay nắm có "nhảy" khi đổi màu cạnh không? Build mỗi preset ở cạnh GỐC
// và cạnh ĐỔI (black↔white), so loại tay nắm. tsx scripts/probe-handle-edge.ts
import fs from 'node:fs';
import path from 'node:path';
import tuKe from '../products/tu-ke/dna';
import type { ParamValues, BuildResult } from '../src/configurator/types';

const DIR = '/tmp/ke-pricing/presets';

/** Đọc loại tay nắm từ build: ưu tiên fitting kind, fallback hardware id. */
function handleKindOf(b: BuildResult): string {
  const f = b.fittings ?? [];
  if (f.some((x) => x.kind === 'handle-bar')) return 'bar';
  if (f.some((x) => x.kind === 'handle-strip')) return 'strip';
  const hw = b.hardware ?? [];
  if (hw.some((h) => h.id === 'handle_bar')) return 'bar';
  if (hw.some((h) => h.id === 'handle_strip_black')) return 'strip';
  if (hw.some((h) => h.id === 'handle')) return 'round';
  return '(không tay nắm)';
}

const pad = (s: string, n: number) => s.padEnd(n);
console.log('\n  Preset                          handleType   cạnh GỐC→nắm   cạnh ĐỔI→nắm   NHẢY?');
console.log('  ' + '─'.repeat(86));
for (const file of fs.readdirSync(DIR).sort()) {
  if (!file.endsWith('.json')) continue;
  const preset = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
  const base = preset.values as ParamValues;
  const ht = String(base.handleType ?? '<none>');
  const origEdge = String(base.edgeBanding ?? 'same');
  const flipEdge = origEdge === 'black' ? 'white' : 'black'; // đổi sang loại khác
  const norm = (v: ParamValues) => (tuKe.normalizeValues ? tuKe.normalizeValues({ ...v }) : v);
  const hBase = handleKindOf(tuKe.build(norm({ ...base, edgeBanding: origEdge })));
  const hFlip = handleKindOf(tuKe.build(norm({ ...base, edgeBanding: flipEdge })));
  const jump = hBase !== hFlip ? '⚠️ CÓ' : 'không';
  console.log(`  ${pad(preset.slug.slice(0, 30), 31)} ${pad(ht, 12)} ${pad(`${origEdge}→${hBase}`, 14)} ${pad(`${flipEdge}→${hFlip}`, 14)} ${jump}`);
}
console.log('');
