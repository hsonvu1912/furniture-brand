// =============================================================================
// DXF generator — S10. Sinh file DXF R12 ASCII từ Part (đường bao + machining)
// hoặc từ NestedBoardLayout (sơ đồ nesting 1 khổ ván).
//
// Format DXF R12 (AutoCAD Release 12, 1992 — 40 năm precedent, mọi máy CNC gỗ
// đều mở được). Spec tối thiểu: SECTION HEADER (chỉ $ACADVER+$INSUNITS) +
// SECTION ENTITIES (LINE/CIRCLE/TEXT). Group codes: 0=type, 8=layer, 10/20=x/y,
// 11/21=x2/y2, 40=radius/height, 1=text content.
//
// Layers (xưởng CNC bật/tắt từng layer):
//   - OUTLINE — đường bao tấm (4 LINE)
//   - DRILL_FRONT_<PURPOSE> / DRILL_BACK_<PURPOSE> — lỗ khoan tròn
//   - POCKET_FRONT_<PURPOSE> / POCKET_BACK_<PURPOSE> — hốc (cup bản lề Ø35)
//   - TEXT_LABEL — nhãn tấm
//   - TEXT_FLIP_INSTRUCTION — chỉ xuất hiện nếu có lỗ side='back'
//   - NESTING_PART / NESTING_LABEL — chỉ trong file nesting
//
// CONVENTION FLIP cho side='back': khi xưởng lật tấm quanh trục dọc (length axis)
// 180°, mặt back lên trên. Một lỗ tại (x_mm, y_mm) trong frame physical sẽ xuất
// hiện tại (x_mm, width_mm - y_mm) khi nhìn từ mặt back. DXF generator vẽ
// DRILL_BACK_* layer tại toạ độ ĐÃ FLIP để xưởng khoan thẳng theo file.
// =============================================================================

import type { Machining, Part } from '@/configurator/types';
import type { NestedBoardLayout } from './types';

/** Chuẩn hoá số ra string với 2 chữ số thập phân — gọn DXF output. */
function fix(n: number): string {
  return n.toFixed(2);
}

/** Sanitize text content for DXF — escape ký tự đặc biệt. DXF R12 dùng ASCII;
 *  ký tự non-ASCII (tiếng Việt có dấu) cần encode hoặc remove. Chuyển về ASCII. */
function sanitizeText(s: string): string {
  // Remove Vietnamese diacritics (xưởng CNC viewer thường không support UTF-8 trong TEXT entity)
  const map: Record<string, string> = {
    à: 'a', á: 'a', ạ: 'a', ả: 'a', ã: 'a', â: 'a', ầ: 'a', ấ: 'a', ậ: 'a', ẩ: 'a', ẫ: 'a',
    ă: 'a', ằ: 'a', ắ: 'a', ặ: 'a', ẳ: 'a', ẵ: 'a',
    è: 'e', é: 'e', ẹ: 'e', ẻ: 'e', ẽ: 'e', ê: 'e', ề: 'e', ế: 'e', ệ: 'e', ể: 'e', ễ: 'e',
    ì: 'i', í: 'i', ị: 'i', ỉ: 'i', ĩ: 'i',
    ò: 'o', ó: 'o', ọ: 'o', ỏ: 'o', õ: 'o', ô: 'o', ồ: 'o', ố: 'o', ộ: 'o', ổ: 'o', ỗ: 'o',
    ơ: 'o', ờ: 'o', ớ: 'o', ợ: 'o', ở: 'o', ỡ: 'o',
    ù: 'u', ú: 'u', ụ: 'u', ủ: 'u', ũ: 'u', ư: 'u', ừ: 'u', ứ: 'u', ự: 'u', ử: 'u', ữ: 'u',
    ỳ: 'y', ý: 'y', ỵ: 'y', ỷ: 'y', ỹ: 'y',
    đ: 'd',
    À: 'A', Á: 'A', Ạ: 'A', Ả: 'A', Ã: 'A', Â: 'A', Ầ: 'A', Ấ: 'A', Ậ: 'A', Ẩ: 'A', Ẫ: 'A',
    Ă: 'A', Ằ: 'A', Ắ: 'A', Ặ: 'A', Ẳ: 'A', Ẵ: 'A',
    È: 'E', É: 'E', Ẹ: 'E', Ẻ: 'E', Ẽ: 'E', Ê: 'E', Ề: 'E', Ế: 'E', Ệ: 'E', Ể: 'E', Ễ: 'E',
    Ì: 'I', Í: 'I', Ị: 'I', Ỉ: 'I', Ĩ: 'I',
    Ò: 'O', Ó: 'O', Ọ: 'O', Ỏ: 'O', Õ: 'O', Ô: 'O', Ồ: 'O', Ố: 'O', Ộ: 'O', Ổ: 'O', Ỗ: 'O',
    Ơ: 'O', Ờ: 'O', Ớ: 'O', Ợ: 'O', Ở: 'O', Ỡ: 'O',
    Ù: 'U', Ú: 'U', Ụ: 'U', Ủ: 'U', Ũ: 'U', Ư: 'U', Ừ: 'U', Ứ: 'U', Ự: 'U', Ử: 'U', Ữ: 'U',
    Ỳ: 'Y', Ý: 'Y', Ỵ: 'Y', Ỷ: 'Y', Ỹ: 'Y',
    Đ: 'D',
  };
  return s
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/[^\x20-\x7E]/g, '?'); // fallback non-printable → '?'
}

function lineE(layer: string, x1: number, y1: number, x2: number, y2: number): string {
  return `0\nLINE\n8\n${layer}\n10\n${fix(x1)}\n20\n${fix(y1)}\n11\n${fix(x2)}\n21\n${fix(y2)}\n`;
}

function circleE(layer: string, cx: number, cy: number, r: number): string {
  return `0\nCIRCLE\n8\n${layer}\n10\n${fix(cx)}\n20\n${fix(cy)}\n40\n${fix(r)}\n`;
}

function textE(layer: string, x: number, y: number, height: number, content: string): string {
  return `0\nTEXT\n8\n${layer}\n10\n${fix(x)}\n20\n${fix(y)}\n40\n${fix(height)}\n1\n${sanitizeText(content)}\n`;
}

const DXF_HEADER =
  '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n' +
  '0\nSECTION\n2\nENTITIES\n';
const DXF_FOOTER = '0\nENDSEC\n0\nEOF\n';

function layerName(op: 'drill' | 'pocket', side: 'front' | 'back', purpose: Machining['purpose']): string {
  return `${op === 'drill' ? 'DRILL' : 'POCKET'}_${side.toUpperCase()}_${purpose.toUpperCase()}`;
}

/**
 * Sinh file DXF R12 cho 1 Part.
 * - OUTLINE: hình chữ nhật length_mm × width_mm (4 LINE)
 * - Machining: mỗi entry → CIRCLE layer tương ứng
 * - TEXT_LABEL: nhãn tấm phía trên outline
 * - TEXT_FLIP_INSTRUCTION: nếu có lỗ side='back'
 */
export function generatePartDXF(part: Part): string {
  const L = part.length_mm;
  const W = part.width_mm;
  const T = part.thickness_mm;
  let body = '';

  // Outline rectangle (4 LINE — universal DXF R12 readable)
  body += lineE('OUTLINE', 0, 0, L, 0);
  body += lineE('OUTLINE', L, 0, L, W);
  body += lineE('OUTLINE', L, W, 0, W);
  body += lineE('OUTLINE', 0, W, 0, 0);

  // Label phía trên outline (1 dòng tóm tắt)
  const label = `${part.label} ${part.id} ${L}x${W}x${T}mm`;
  body += textE('TEXT_LABEL', 5, W + 12, 10, label);

  // Machining: drill / pocket = CIRCLE; edge_drill skipped (B6 sẽ refactor).
  let hasBackSide = false;
  for (const m of part.machining ?? []) {
    if (m.op === 'edge_drill') continue; // skip — face DXF không vẽ edge holes; B6 ra file CSV riêng
    if (m.side === 'back') hasBackSide = true;
    // Side='back' → flip y theo trục length: y_draw = W - y_mm.
    // (Xưởng lật tấm quanh trục length → frame nhìn từ back có y đảo so với front.)
    const x = m.x_mm;
    const y = m.side === 'back' ? W - m.y_mm : m.y_mm;
    body += circleE(layerName(m.op, m.side, m.purpose), x, y, m.diameter_mm / 2);
  }

  // Flip instruction nếu tấm 2 mặt
  if (hasBackSide) {
    body += textE(
      'TEXT_FLIP_INSTRUCTION',
      5,
      W + 30,
      8,
      'TAM 2 MAT — LAT NGANG (xoay quanh truc doc 180 do). 1) Gia cong DRILL_FRONT_*  2) Lat tam  3) Gia cong DRILL_BACK_*',
    );
  }

  return DXF_HEADER + body + DXF_FOOTER;
}

/**
 * Sinh file DXF cho 1 board nesting layout (LEGACY — chỉ outline + label).
 * Vẽ đường bao board + mỗi placement = hình chữ nhật + nhãn part trong nó.
 * B6 NEW: dùng `generateBoardFrontDXF` / `generateBoardBackDXF` cho industry standard.
 */
export function generateNestingDXF(board: NestedBoardLayout): string {
  const BL = board.boardLength;
  const BW = board.boardWidth;
  let body = '';

  // Đường bao board
  body += lineE('OUTLINE', 0, 0, BL, 0);
  body += lineE('OUTLINE', BL, 0, BL, BW);
  body += lineE('OUTLINE', BL, BW, 0, BW);
  body += lineE('OUTLINE', 0, BW, 0, 0);

  // Label board phía trên
  const header = `Board ${board.boardId} ${BL}x${BW} ${board.materialId} ${board.thicknessMm}mm — utilization ${(board.utilization * 100).toFixed(1)}%`;
  body += textE('NESTING_LABEL', 5, BW + 15, 12, header);

  // Mỗi placement: hình chữ nhật + nhãn ở góc trái-dưới
  for (const p of board.placements) {
    const w = p.rotated ? p.partWidth : p.partLength;
    const h = p.rotated ? p.partLength : p.partWidth;
    body += lineE('NESTING_PART', p.x, p.y, p.x + w, p.y);
    body += lineE('NESTING_PART', p.x + w, p.y, p.x + w, p.y + h);
    body += lineE('NESTING_PART', p.x + w, p.y + h, p.x, p.y + h);
    body += lineE('NESTING_PART', p.x, p.y + h, p.x, p.y);
    const tag = `${p.partLabel} ${p.partId}${p.rotated ? ' (R)' : ''}`;
    body += textE('NESTING_LABEL', p.x + 3, p.y + 3, 6, tag);
  }

  return DXF_HEADER + body + DXF_FOOTER;
}

// =============================================================================
// B6 — Industry standard board DXF: FRONT/BACK separate + by-tool layers.
// Layer naming convention: `CUT_PATH`, `DRILL_<dia>MM`, `POCKET_<dia>MM`, `ENGRAVE`.
// CAM software (Cabinet Vision, Mozaik, Holzma post-processor) đổi mũi khoan
// auto theo layer → 1 setup chạy hết outline cắt + drill + pocket.
// =============================================================================

/** Convert đường kính → suffix layer name. 6.3 → "6_3" (DXF R12 không thích dot). */
function diaLayer(prefix: 'DRILL' | 'POCKET', dia: number): string {
  const s = Number(dia.toFixed(1))
    .toString()
    .replace('.', '_');
  return `${prefix}_${s}MM`;
}

/** Transform 1 point từ frame Part (x_mm, y_mm) sang frame Board. */
function partToBoardCoord(
  placement: { x: number; y: number; rotated: boolean },
  px: number,
  py: number,
): { x: number; y: number } {
  if (placement.rotated) {
    // 90° CCW: part X axis → board Y, part Y axis → board X
    return { x: placement.x + py, y: placement.y + px };
  }
  return { x: placement.x + px, y: placement.y + py };
}

/**
 * Sinh DXF MẶT TRƯỚC của board — outline tất cả tấm + lỗ side='front' transform
 * vào board coordinates. Layer naming by tool/Ø (DRILL_5MM, DRILL_8MM, ...) —
 * CAM software đổi mũi khoan tự động.
 *
 * @param board nesting result cho 1 board
 * @param partLookup map partId → Part (chứa machining)
 */
export function generateBoardFrontDXF(
  board: NestedBoardLayout,
  partLookup: Map<string, Part>,
): string {
  const BL = board.boardLength;
  const BW = board.boardWidth;
  let body = '';

  // Board outline (informational — không phải CUT_PATH chính)
  body += lineE('BOARD_OUTLINE', 0, 0, BL, 0);
  body += lineE('BOARD_OUTLINE', BL, 0, BL, BW);
  body += lineE('BOARD_OUTLINE', BL, BW, 0, BW);
  body += lineE('BOARD_OUTLINE', 0, BW, 0, 0);

  const header = `Board ${board.boardId} ${BL}x${BW}mm ${board.materialId} ${board.thicknessMm}mm — FRONT side — util ${(board.utilization * 100).toFixed(1)}%`;
  body += textE('ENGRAVE_LABEL', 5, BW + 15, 12, header);

  // Mỗi placement: CUT_PATH outline + machining lỗ side='front'
  for (const p of board.placements) {
    const w = p.rotated ? p.partWidth : p.partLength;
    const h = p.rotated ? p.partLength : p.partWidth;
    // CUT_PATH outline (cắt thực tế)
    body += lineE('CUT_PATH', p.x, p.y, p.x + w, p.y);
    body += lineE('CUT_PATH', p.x + w, p.y, p.x + w, p.y + h);
    body += lineE('CUT_PATH', p.x + w, p.y + h, p.x, p.y + h);
    body += lineE('CUT_PATH', p.x, p.y + h, p.x, p.y);
    // Engrave label trong tấm (in mờ — chỉ để thợ biết tấm nào)
    body += textE('ENGRAVE_LABEL', p.x + 3, p.y + 3, 6, `${p.partLabel} ${p.partId}${p.rotated ? '(R)' : ''}`);

    // Lỗ side='front' của Part transform vào board frame
    const part = partLookup.get(p.partId);
    if (!part?.machining) continue;
    for (const m of part.machining) {
      if (m.op === 'edge_drill') continue; // edge drilling ra CSV riêng
      if (m.side !== 'front') continue;
      const pos = partToBoardCoord(p, m.x_mm, m.y_mm);
      const layer = diaLayer(m.op === 'drill' ? 'DRILL' : 'POCKET', m.diameter_mm);
      body += circleE(layer, pos.x, pos.y, m.diameter_mm / 2);
    }
  }

  return DXF_HEADER + body + DXF_FOOTER;
}

/**
 * Sinh DXF MẶT SAU của board — chỉ lỗ side='back' của các tấm.
 * Toạ độ flip Y (board.boardWidth - y) — xưởng lật tổng board quanh trục dài
 * → operator nhìn DXF thấy đúng vị trí thực sau lật.
 */
export function generateBoardBackDXF(
  board: NestedBoardLayout,
  partLookup: Map<string, Part>,
): string {
  const BL = board.boardLength;
  const BW = board.boardWidth;
  let body = '';

  // Outline (cùng kích thước, view sau lật vẫn rectangle)
  body += lineE('BOARD_OUTLINE', 0, 0, BL, 0);
  body += lineE('BOARD_OUTLINE', BL, 0, BL, BW);
  body += lineE('BOARD_OUTLINE', BL, BW, 0, BW);
  body += lineE('BOARD_OUTLINE', 0, BW, 0, 0);

  body += textE('ENGRAVE_LABEL', 5, BW + 15, 12,
    `Board ${board.boardId} ${BL}x${BW}mm ${board.materialId} ${board.thicknessMm}mm — BACK side (lat tong board quanh truc dai)`,
  );

  // Mỗi placement: chỉ lỗ side='back' transform + flip y
  let hasBackOps = false;
  for (const p of board.placements) {
    // Vẽ outline tấm mờ (reference only — KHÔNG phải CUT_PATH, đã cắt từ FRONT)
    const w = p.rotated ? p.partWidth : p.partLength;
    const h = p.rotated ? p.partLength : p.partWidth;
    body += lineE('PART_REFERENCE', p.x, BW - p.y - h, p.x + w, BW - p.y - h);
    body += lineE('PART_REFERENCE', p.x + w, BW - p.y - h, p.x + w, BW - p.y);
    body += lineE('PART_REFERENCE', p.x + w, BW - p.y, p.x, BW - p.y);
    body += lineE('PART_REFERENCE', p.x, BW - p.y, p.x, BW - p.y - h);
    body += textE('ENGRAVE_LABEL', p.x + 3, BW - p.y - h + 3, 6, `${p.partLabel} ${p.partId}${p.rotated ? '(R)' : ''}`);

    const part = partLookup.get(p.partId);
    if (!part?.machining) continue;
    for (const m of part.machining) {
      if (m.op === 'edge_drill') continue;
      if (m.side !== 'back') continue;
      hasBackOps = true;
      // Transform to board frame (front view) then flip y for back view
      const pos = partToBoardCoord(p, m.x_mm, m.y_mm);
      const flippedY = BW - pos.y;
      const layer = diaLayer(m.op === 'drill' ? 'DRILL' : 'POCKET', m.diameter_mm);
      body += circleE(layer, pos.x, flippedY, m.diameter_mm / 2);
    }
  }

  if (!hasBackOps) {
    body += textE('ENGRAVE_LABEL', 5, BW / 2, 14,
      'KHONG CO MAY KHOAN MAT SAU — board nay khong can lat',
    );
  }

  return DXF_HEADER + body + DXF_FOOTER;
}

/**
 * Edge holes CSV — machine-readable format cho CNC 5-axis hoặc máy khoan ngang.
 * Mỗi row = 1 lỗ trên cạnh ván (confirmat pilot, dowel pilot, etc.).
 * Operator dùng jig fixture + CSV để khoan đúng vị trí.
 *
 * Header columns:
 *   board_id, part_id, part_label, edge, position_mm, diameter_mm, depth_mm, thickness_offset_mm
 *
 * `position_mm` đo từ đầu cạnh (gốc start theo length axis của ván).
 * `thickness_offset_mm` đo từ mặt 'front' (vắng → giữa cạnh = thickness/2).
 */
export function generateEdgeHolesCSV(
  boards: NestedBoardLayout[],
  partLookup: Map<string, Part>,
): string {
  const rows: string[] = [
    'board_id,part_id,part_label,edge,position_mm,diameter_mm,depth_mm,thickness_offset_mm,purpose',
  ];
  for (const board of boards) {
    for (const p of board.placements) {
      const part = partLookup.get(p.partId);
      if (!part?.machining) continue;
      for (const m of part.machining) {
        if (m.op !== 'edge_drill') continue;
        const offset = m.thicknessOffset_mm ?? part.thickness_mm / 2;
        rows.push(
          [
            board.boardId,
            p.partId,
            `"${p.partLabel}"`,
            m.edge,
            m.position_mm.toFixed(2),
            m.diameter_mm.toFixed(2),
            m.depth_mm.toFixed(2),
            offset.toFixed(2),
            m.purpose,
          ].join(','),
        );
      }
    }
  }
  return rows.join('\n') + '\n';
}
