import { isSafeRelativePath, resourcePathKey } from "../../src/lib/resourceValidation.js";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const nameDecoder = new TextDecoder("utf-8", { fatal: true });
const MAX_ZIP_BYTES = 32 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 256;
const MAX_ZIP_ENTRY_BYTES = 20 * 1024 * 1024;
const MAX_ZIP_TOTAL_BYTES = 24 * 1024 * 1024;

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
  if (!Array.isArray(entries) || entries.length > MAX_ZIP_ENTRIES) {
    throw new Error(`ZIP packages may contain at most ${MAX_ZIP_ENTRIES} entries.`);
  }
  const prepared = [];
  const names = new Set();
  let totalBytes = 0;
  for (const entry of entries) {
    if (!entry || !isSafeZipName(entry.name)) {
      throw new Error(`Unsafe ZIP entry name: ${entry?.name || "(empty)"}`);
    }
    if (names.has(resourcePathKey(entry.name))) throw new Error("ZIP package contains a duplicate entry or path alias.");
    const bytes = entry.data instanceof Blob ? new Uint8Array(await entry.data.arrayBuffer()) : bytesOf(entry.data);
    if (bytes.length > MAX_ZIP_ENTRY_BYTES || totalBytes + bytes.length > MAX_ZIP_TOTAL_BYTES) {
      throw new Error("ZIP package contents exceed the safe export limit.");
    }
    names.add(resourcePathKey(entry.name));
    totalBytes += bytes.length;
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

  const result = new Blob([...localParts, ...centralParts, new Uint8Array(end)], { type: "application/zip" });
  if (result.size > MAX_ZIP_BYTES) throw new Error("The ZIP package is larger than 32 MB.");
  return result;
}

function isSafeZipName(name) {
  return isSafeRelativePath(name) && textEncoder.encode(name).length <= 255;
}

export async function readZip(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length > MAX_ZIP_BYTES) throw new Error("The ZIP package is larger than 32 MB.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = new Map();
  const names = new Set();
  const localEntries = [];
  let totalBytes = 0;
  let offset = 0;

  while (offset + 4 <= bytes.length) {
    const signature = readU32(view, offset);
    if (signature === 0x06054b50 || signature === 0x02014b50) break;
    if (localEntries.length >= MAX_ZIP_ENTRIES) throw new Error(`ZIP packages may contain at most ${MAX_ZIP_ENTRIES} entries.`);
    if (signature !== 0x04034b50) throw new Error("This ZIP package has an unsupported structure.");
    if (offset + 30 > bytes.length) throw new Error("ZIP local header is truncated.");
    const flags = readU16(view, offset + 6);
    const method = readU16(view, offset + 8);
    const expectedCrc = readU32(view, offset + 14);
    const compressedSize = readU32(view, offset + 18);
    const uncompressedSize = readU32(view, offset + 22);
    const nameLength = readU16(view, offset + 26);
    const extraLength = readU16(view, offset + 28);
    if (flags !== 0 || method !== 0) throw new Error("This package uses compression or encryption that the Studio cannot import.");
    const nameStart = offset + 30;
    if (nameStart + nameLength + extraLength > bytes.length) throw new Error("ZIP entry header is truncated.");
    const name = nameDecoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    if (!isSafeZipName(name)) throw new Error(`Unsafe path in import package: ${name}`);
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length || uncompressedSize !== compressedSize) throw new Error(`ZIP entry is truncated or inconsistent: ${name}`);
    if (compressedSize > MAX_ZIP_ENTRY_BYTES || totalBytes + compressedSize > MAX_ZIP_TOTAL_BYTES) throw new Error("ZIP package contents exceed the safe import limit.");
    if (names.has(resourcePathKey(name))) throw new Error("ZIP package contains a duplicate entry or path alias.");
    const data = bytes.slice(dataStart, dataEnd);
    if (crc32(data) !== expectedCrc) throw new Error(`ZIP entry checksum failed: ${name}`);
    files.set(name, data);
    names.add(resourcePathKey(name));
    localEntries.push({ name, offset, crc: expectedCrc, size: compressedSize });
    totalBytes += compressedSize;
    offset = dataEnd;
  }

  if (!files.size) throw new Error("The ZIP package did not contain any files.");

  const centralDirectoryOffset = offset;
  let endOffset = -1;
  for (let candidate = Math.max(centralDirectoryOffset, bytes.length - 65557); candidate + 22 <= bytes.length; candidate += 1) {
    if (readU32(view, candidate) === 0x06054b50) endOffset = candidate;
  }
  if (endOffset < 0) throw new Error("ZIP end record is missing or malformed.");
  const entryCount = readU16(view, endOffset + 10);
  const centralSize = readU32(view, endOffset + 12);
  const centralOffset = readU32(view, endOffset + 16);
  const commentLength = readU16(view, endOffset + 20);
  if (readU16(view, endOffset + 4) !== 0 || readU16(view, endOffset + 6) !== 0 || readU16(view, endOffset + 8) !== entryCount || entryCount !== localEntries.length || centralOffset !== centralDirectoryOffset || centralOffset + centralSize !== endOffset || endOffset + 22 + commentLength !== bytes.length) {
    throw new Error("ZIP central directory does not match the local entries.");
  }
  let centralCursor = centralOffset;
  for (const local of localEntries) {
    if (centralCursor + 46 > bytes.length || readU32(view, centralCursor) !== 0x02014b50) throw new Error("ZIP central directory entry is malformed.");
    const centralCrc = readU32(view, centralCursor + 16);
    const centralSizeValue = readU32(view, centralCursor + 24);
    const centralNameLength = readU16(view, centralCursor + 28);
    const centralExtraLength = readU16(view, centralCursor + 30);
    const centralCommentLength = readU16(view, centralCursor + 32);
    const localOffset = readU32(view, centralCursor + 42);
    if (centralCursor + 46 + centralNameLength + centralExtraLength + centralCommentLength > bytes.length) throw new Error("ZIP central directory entry is truncated.");
    const centralName = nameDecoder.decode(bytes.slice(centralCursor + 46, centralCursor + 46 + centralNameLength));
    const unixType = (readU32(view, centralCursor + 38) >>> 16) & 0xf000;
    if (readU16(view, centralCursor + 8) !== 0 || readU16(view, centralCursor + 10) !== 0 || readU16(view, centralCursor + 34) !== 0 || (unixType !== 0 && unixType !== 0x8000) || (readU32(view, centralCursor + 38) & 0x10) || readU32(view, centralCursor + 20) !== local.size || centralName !== local.name || centralCrc !== local.crc || centralSizeValue !== local.size || localOffset !== local.offset) throw new Error(`ZIP central directory verification failed: ${local.name}`);
    centralCursor += 46 + centralNameLength + centralExtraLength + centralCommentLength;
  }
  if (centralCursor !== centralOffset + centralSize) throw new Error("ZIP central directory size is inconsistent.");
  return files;
}

export function decodeText(bytes) {
  return textDecoder.decode(bytes);
}
