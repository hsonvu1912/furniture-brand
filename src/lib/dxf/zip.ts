// =============================================================================
// Minimal ZIP writer — STORE method (no compression). Cloudflare Workers-safe:
// chỉ dùng Uint8Array, DataView, TextEncoder; KHÔNG cần Node Buffer/fs/zlib.
// Format ZIP có 3 phần: Local File Headers + File data + Central Directory +
// End-of-Central-Directory record. STORE method (0) chỉ cần CRC-32 (no deflate).
// =============================================================================

// Precomputed CRC-32 table (IEEE 802.3 polynomial 0xEDB88320).
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[i] = c >>> 0;
}

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** DOS time format: HHHHHMMMMMMSSSSS (seconds/2). */
function dosTime(d: Date): number {
  return ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() / 2) & 0x1f);
}
function dosDate(d: Date): number {
  return (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0xf) << 5) | (d.getDate() & 0x1f);
}

/**
 * Tạo file ZIP STORE từ map `{filename: bytes}`. Filenames có thể có path
 * separator (vd `parts/bottom.dxf`) — writer giữ nguyên.
 * Returns Uint8Array với raw ZIP bytes.
 */
export function createZip(files: Record<string, Uint8Array | string>): Uint8Array {
  const encoder = new TextEncoder();
  const now = new Date();
  const time = dosTime(now);
  const date = dosDate(now);

  // Step 1: prepare each file entry
  interface Entry {
    name: Uint8Array;
    data: Uint8Array;
    crc: number;
    size: number;
    offset: number;
  }
  const entries: Entry[] = [];
  let offset = 0;
  const parts: Uint8Array[] = [];

  for (const [filename, content] of Object.entries(files)) {
    const data = typeof content === 'string' ? encoder.encode(content) : content;
    const name = encoder.encode(filename);
    const crc = crc32(data);
    const size = data.length;

    // Local File Header (30 bytes + name)
    const lfh = new Uint8Array(30 + name.length);
    const lfhView = new DataView(lfh.buffer);
    lfhView.setUint32(0, 0x04034b50, true); // signature
    lfhView.setUint16(4, 20, true); // version needed
    lfhView.setUint16(6, 0, true); // flags
    lfhView.setUint16(8, 0, true); // compression: STORE
    lfhView.setUint16(10, time, true);
    lfhView.setUint16(12, date, true);
    lfhView.setUint32(14, crc, true);
    lfhView.setUint32(18, size, true); // compressed size
    lfhView.setUint32(22, size, true); // uncompressed size
    lfhView.setUint16(26, name.length, true);
    lfhView.setUint16(28, 0, true); // extra field length
    lfh.set(name, 30);

    parts.push(lfh, data);
    entries.push({ name, data, crc, size, offset });
    offset += lfh.length + data.length;
  }

  // Step 2: Central Directory
  const cdStart = offset;
  for (const e of entries) {
    const cdh = new Uint8Array(46 + e.name.length);
    const v = new DataView(cdh.buffer);
    v.setUint32(0, 0x02014b50, true); // CD signature
    v.setUint16(4, 20, true); // version made by
    v.setUint16(6, 20, true); // version needed
    v.setUint16(8, 0, true); // flags
    v.setUint16(10, 0, true); // compression STORE
    v.setUint16(12, time, true);
    v.setUint16(14, date, true);
    v.setUint32(16, e.crc, true);
    v.setUint32(20, e.size, true);
    v.setUint32(24, e.size, true);
    v.setUint16(28, e.name.length, true);
    v.setUint16(30, 0, true); // extra
    v.setUint16(32, 0, true); // comment
    v.setUint16(34, 0, true); // disk number
    v.setUint16(36, 0, true); // internal attr
    v.setUint32(38, 0, true); // external attr
    v.setUint32(42, e.offset, true); // local header offset
    cdh.set(e.name, 46);
    parts.push(cdh);
    offset += cdh.length;
  }
  const cdSize = offset - cdStart;

  // Step 3: End of Central Directory
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true); // disk number
  ev.setUint16(6, 0, true); // disk where CD starts
  ev.setUint16(8, entries.length, true); // CD entries on this disk
  ev.setUint16(10, entries.length, true); // total CD entries
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdStart, true);
  ev.setUint16(20, 0, true); // comment length
  parts.push(eocd);

  // Concat all
  const totalSize = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const p of parts) {
    result.set(p, pos);
    pos += p.length;
  }
  return result;
}
