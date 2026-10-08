/**
 * A minimal ZIP writer — STORED entries only, no compression.
 *
 * It exists for one archive, the Claude skill (a few hundred KB of text), so
 * the site build does not take a dependency for it. Storing instead of
 * deflating keeps the format to two record types and a CRC: the archive is
 * served gzip-compressed by the host anyway.
 *
 * Timestamps are pinned to 1980-01-01 (the format's epoch) so the same inputs
 * always produce the same bytes — the archive is a build output, and a
 * wall-clock date would make two identical builds differ.
 */

export interface ZipEntry {
  path: string;
  content: string | Uint8Array;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** DOS date for 1980-01-01, time 00:00 — see the module comment. */
const DOS_DATE = (0 << 9) | (1 << 5) | 1;
const DOS_TIME = 0;
/** Bit 11: names are UTF-8. */
const FLAG_UTF8 = 0x0800;

export function createZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.path);
    const data =
      typeof entry.content === 'string'
        ? encoder.encode(entry.content)
        : entry.content;
    const crc = crc32(data);

    const header = new DataView(new ArrayBuffer(30));
    header.setUint32(0, 0x04034b50, true);
    header.setUint16(4, 20, true); // version needed
    header.setUint16(6, FLAG_UTF8, true);
    header.setUint16(8, 0, true); // method: stored
    header.setUint16(10, DOS_TIME, true);
    header.setUint16(12, DOS_DATE, true);
    header.setUint32(14, crc, true);
    header.setUint32(18, data.length, true);
    header.setUint32(22, data.length, true);
    header.setUint16(26, name.length, true);
    header.setUint16(28, 0, true);
    local.push(new Uint8Array(header.buffer), name, data);

    const record = new DataView(new ArrayBuffer(46));
    record.setUint32(0, 0x02014b50, true);
    record.setUint16(4, 20, true); // version made by
    record.setUint16(6, 20, true); // version needed
    record.setUint16(8, FLAG_UTF8, true);
    record.setUint16(10, 0, true);
    record.setUint16(12, DOS_TIME, true);
    record.setUint16(14, DOS_DATE, true);
    record.setUint32(16, crc, true);
    record.setUint32(20, data.length, true);
    record.setUint32(24, data.length, true);
    record.setUint16(28, name.length, true);
    // extra, comment, disk, internal attrs: 0
    record.setUint32(38, 0, true); // external attrs
    record.setUint32(42, offset, true);
    central.push(new Uint8Array(record.buffer), name);

    offset += 30 + name.length + data.length;
  }

  const centralSize = central.reduce((n, part) => n + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const parts = [...local, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
