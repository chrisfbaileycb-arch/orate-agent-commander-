import type { GeneratedFile } from "./types";

/** ---------- Minimal ZIP (STORE, no compression) packer ---------- */

let CRC_TABLE: Uint32Array | null = null;

function crcTable(): Uint32Array {
  if (CRC_TABLE) return CRC_TABLE;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  CRC_TABLE = table;
  return table;
}

function crc32(data: Uint8Array): number {
  const table = crcTable();
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = table[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function encodeUTF8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

interface ZipEntry {
  nameBytes: Uint8Array;
  data: Uint8Array;
  crc: number;
  offset: number;
}

/** Build a ZIP blob from generated files. Uses STORE (no compression) for determinism. */
export function buildZip(files: GeneratedFile[]): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const entries: ZipEntry[] = [];
  let offset = 0;

  const push = (arr: Uint8Array) => {
    chunks.push(arr);
    offset += arr.length;
  };

  const u16 = (v: number): Uint8Array => new Uint8Array([v & 0xff, (v >>> 8) & 0xff]);
  const u32 = (v: number): Uint8Array =>
    new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]);

  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const data = encodeUTF8(file.contents);
    const crc = crc32(data);
    const entryOffset = offset;

    // Local file header: signature, version, flags, method(0=store), time, date, crc, sizes, name
    push(u32(0x04034b50));
    push(u16(20)); // version needed
    push(u16(0x0800)); // flags: UTF-8 names
    push(u16(0)); // method: store
    push(u16(0)); // mod time
    push(u16(0x2100)); // mod date (2016-01-01, deterministic)
    push(u32(crc));
    push(u32(data.length));
    push(u32(data.length));
    push(u16(nameBytes.length));
    push(u16(0)); // extra len
    push(nameBytes);
    push(data);

    entries.push({ nameBytes, data, crc, offset: entryOffset });
  }

  const centralStart = offset;
  for (const e of entries) {
    push(u32(0x02014b50));
    push(u16(20)); // version made by
    push(u16(20)); // version needed
    push(u16(0x0800));
    push(u16(0));
    push(u16(0));
    push(u16(0x2100));
    push(u32(e.crc));
    push(u32(e.data.length));
    push(u32(e.data.length));
    push(u16(e.nameBytes.length));
    push(u16(0)); // extra
    push(u16(0)); // comment
    push(u16(0)); // disk number
    push(u16(0)); // internal attrs
    push(u32(0)); // external attrs
    push(u32(e.offset));
    push(e.nameBytes);
  }

  const centralSize = offset - centralStart;
  push(u32(0x06054b50));
  push(u16(0));
  push(u16(0));
  push(u16(entries.length));
  push(u16(entries.length));
  push(u32(centralSize));
  push(u32(centralStart));
  push(u16(0));

  return new Blob(chunks as BlobPart[], { type: "application/zip" });
}

export function downloadZip(files: GeneratedFile[], appName: string): void {
  const blob = buildZip(files);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${appName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "orator-forge"}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
