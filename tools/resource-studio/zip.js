const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesOf(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (typeof value === "string") return textEncoder.encode(value);
  throw new TypeError("ZIP entries must be text, ArrayBuffer or Uint8Array data.");
}

function writeU16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeU32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

function readU16(view, offset) {
  return view.getUint16(offset, true);
}

function readU32(view, offset) {
  return view.getUint32(offset, true);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export async function createZip(entries) {
  const prepared = [];
  for (const entry of entries) {
    const bytes = entry.data instanceof Blob ? new Uint8Array(await entry.data.arrayBuffer()) : bytesOf(entry.data);
    prepared.push({ name: entry.name, nameBytes: textEncoder.encode(entry.name), bytes, crc: crc32(bytes) });
  }

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of prepared) {
    const local = new ArrayBuffer(30 + entry.nameBytes.length);
    const view = new DataView(local);
    writeU32(view, 0, 0x04034b50);
    writeU16(view, 4, 20);
    writeU16(view, 6, 0);
    writeU16(view, 8, 0);
    writeU16(view, 10, 0);
    writeU16(view, 12, 0);
    writeU32(view, 14, entry.crc);
    writeU32(view, 18, entry.bytes.length);
    writeU32(view, 22, entry.bytes.length);
    writeU16(view, 26, entry.nameBytes.length);
    writeU16(view, 28, 0);
    new Uint8Array(local, 30).set(entry.nameBytes);
    localParts.push(new Uint8Array(local), entry.bytes);

    const central = new ArrayBuffer(46 + entry.nameBytes.length);
    const centralView = new DataView(central);
    writeU32(centralView, 0, 0x02014b50);
    writeU16(centralView, 4, 20);
    writeU16(centralView, 6, 20);
    writeU16(centralView, 8, 0);
    writeU16(centralView, 10, 0);
    writeU16(centralView, 12, 0);
    writeU16(centralView, 14, 0);
    writeU32(centralView, 16, entry.crc);
    writeU32(centralView, 20, entry.bytes.length);
    writeU32(centralView, 24, entry.bytes.length);
    writeU16(centralView, 28, entry.nameBytes.length);
    writeU16(centralView, 30, 0);
    writeU16(centralView, 32, 0);
    writeU16(centralView, 34, 0);
    writeU16(centralView, 36, 0);
    writeU32(centralView, 38, 0);
    writeU32(centralView, 42, offset);
    new Uint8Array(central, 46).set(entry.nameBytes);
    centralParts.push(new Uint8Array(central));

    offset += 30 + entry.nameBytes.length + entry.bytes.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new ArrayBuffer(22);
  const endView = new DataView(end);
  writeU32(endView, 0, 0x06054b50);
  writeU16(endView, 4, 0);
  writeU16(endView, 6, 0);
  writeU16(endView, 8, prepared.length);
  writeU16(endView, 10, prepared.length);
  writeU32(endView, 12, centralSize);
  writeU32(endView, 16, centralOffset);
  writeU16(endView, 20, 0);

  return new Blob([...localParts, ...centralParts, new Uint8Array(end)], { type: "application/zip" });
}

function isSafeZipName(name) {
  return Boolean(name) && !name.startsWith("/") && !name.includes("\\") && !name.includes("..") && !/^[a-z]+:/i.test(name);
}

export async function readZip(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = new Map();
  let offset = 0;

  while (offset + 4 <= bytes.length) {
    const signature = readU32(view, offset);
    if (signature === 0x06054b50 || signature === 0x02014b50) break;
    if (signature !== 0x04034b50) throw new Error("This ZIP package has an unsupported structure.");
    const flags = readU16(view, offset + 6);
    const method = readU16(view, offset + 8);
    const compressedSize = readU32(view, offset + 18);
    const nameLength = readU16(view, offset + 26);
    const extraLength = readU16(view, offset + 28);
    if (flags !== 0 || method !== 0) throw new Error("This package uses compression or encryption that the Studio cannot import.");
    const nameStart = offset + 30;
    const name = textDecoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    if (!isSafeZipName(name)) throw new Error(`Unsafe path in import package: ${name}`);
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) throw new Error(`ZIP entry is truncated: ${name}`);
    files.set(name, bytes.slice(dataStart, dataEnd));
    offset = dataEnd;
  }

  if (!files.size) throw new Error("The ZIP package did not contain any files.");
  return files;
}

export function decodeText(bytes) {
  return textDecoder.decode(bytes);
}
