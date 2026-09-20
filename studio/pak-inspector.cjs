const fs = require('node:fs');
const crypto = require('node:crypto');
const MAX_FILE_BYTES = 512 * 1024 * 1024, MAX_INDEX_BYTES = 32 * 1024 * 1024;
const MAX_ENTRIES = 100000, FOOTER_BYTES = 221, MAGIC = 0x5a6f12e1;
function failure(message, code = 'PAK_INVALID') { return Object.assign(new Error(message), { code }); }
class Reader {
  constructor(bytes) { this.bytes = bytes; this.position = 0; }
  take(length) { if (!Number.isSafeInteger(length) || length < 0 || this.position + length > this.bytes.length) throw failure('The PAK index ends before its declared data.'); const value = this.bytes.subarray(this.position, this.position + length); this.position += length; return value; }
  u32() { return this.take(4).readUInt32LE(); }
  i32() { return this.take(4).readInt32LE(); }
  u64() { const value = this.take(8).readBigUInt64LE(); if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw failure('A PAK offset exceeds the supported range.'); return Number(value); }
  string() {
    const count = this.i32(); if (!count) return '';
    if (Math.abs(count) > 4097) throw failure('A PAK name exceeds the 4,096-character limit.');
    const wide = count < 0, bytes = this.take(Math.abs(count) * (wide ? 2 : 1));
    if (wide ? bytes.readUInt16LE(bytes.length - 2) !== 0 : bytes[bytes.length - 1] !== 0) throw failure('A PAK name is not terminated correctly.');
    const text = bytes.subarray(0, bytes.length - (wide ? 2 : 1)).toString(wide ? 'utf16le' : 'utf8');
    if (/[\u0000-\u001f\u007f]/.test(text) || text.includes('\ufffd')) throw failure('A PAK name contains invalid characters.');
    return text;
  }
}
function readInput(input) {
  if (Buffer.isBuffer(input)) { if (input.length > MAX_FILE_BYTES) throw failure('PAK inspection is limited to 512 MiB.', 'PAK_TOO_LARGE'); return input; }
  if (typeof input !== 'string') throw failure('Choose a local PAK file or provide its bytes.');
  const descriptor = fs.openSync(input, 'r');
  try {
    const info = fs.fstatSync(descriptor);
    if (!info.isFile()) throw failure('PAK inspection requires a regular file.');
    if (info.size > MAX_FILE_BYTES) throw failure('PAK inspection is limited to 512 MiB.', 'PAK_TOO_LARGE');
    const bytes = Buffer.alloc(info.size); let offset = 0;
    while (offset < bytes.length) { const read = fs.readSync(descriptor, bytes, offset, bytes.length - offset, offset); if (!read) throw failure('The PAK changed while it was being read.'); offset += read; }
    if (fs.fstatSync(descriptor).size !== info.size) throw failure('The PAK changed while it was being read.');
    return bytes;
  } finally { fs.closeSync(descriptor); }
}
function inspectPak(input) {
  const bytes = readInput(input), footerOffset = bytes.length - FOOTER_BYTES;
  if (footerOffset < 0 || bytes.readUInt32LE(footerOffset + 17) !== MAGIC) throw failure('This is not a supported Unreal PAK v11 file.', 'PAK_UNSUPPORTED');
  const footer = new Reader(bytes.subarray(footerOffset));
  const encryptionGuid = footer.take(16).toString('hex'), encrypted = footer.take(1)[0]; footer.u32();
  const version = footer.u32(); if (version !== 11) throw failure('This inspector supports PAK v11 only.', 'PAK_UNSUPPORTED');
  if (encrypted > 1) throw failure('The PAK encryption flag is invalid.');
  const offset = footer.u64(), size = footer.u64(), expectedHash = footer.take(20).toString('hex');
  const compressionMethods = Array.from({ length: 5 }, () => footer.take(32).toString('ascii').replace(/\0.*$/s, '')).filter(Boolean);
  if (compressionMethods.some(name => !/^[a-z0-9_-]{1,31}$/i.test(name))) throw failure('The PAK compression metadata is invalid.');
  const regions = [];
  function block(label, start, length, expected) {
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(length) || start < 0 || length < 4 || length > MAX_INDEX_BYTES || start + length > footerOffset) throw failure(`${label} points outside the supported index bounds.`);
    if (regions.some(region => start < region.end && start + length > region.start)) throw failure('PAK index regions overlap.');
    regions.push({ start, end: start + length });
    const data = bytes.subarray(start, start + length), sha1 = crypto.createHash('sha1').update(data).digest('hex');
    if (sha1 !== expected) throw failure(`${label} SHA-1 does not match. The file may be damaged.`, 'PAK_HASH_MISMATCH');
    return { data, info: { offset: start, size: length, sha1, hashMatches: true } };
  }
  if (encrypted) {
    if (offset + size > footerOffset || size < 4 || size > MAX_INDEX_BYTES) throw failure('The encrypted PAK index is outside supported bounds.');
    return { readOnly: true, format: 'Unreal PAK', version, bytes: bytes.length, encryptedIndex: true, encryptionGuid, compressionMethods, index: { offset, size, hashMatches: null }, paths: [], compatibilityVerified: false, warnings: ['The index is encrypted; no names or assets were decrypted.', 'A PAK version alone does not establish engine or keyboard compatibility.'] };
  }
  const primary = block('Primary index', offset, size, expectedHash), index = new Reader(primary.data);
  const mountPoint = index.string(), entryCount = index.u32();
  if (entryCount > MAX_ENTRIES) throw failure('The PAK contains too many index entries.', 'PAK_TOO_LARGE');
  const pathHashSeed = index.take(8).toString('hex');
  function secondary(label) {
    const present = index.u32(); if (present > 1) throw failure('A PAK secondary-index flag is invalid.');
    if (!present) return null;
    const position = index.u64(), length = index.u64(), hash = index.take(20).toString('hex');
    return block(label, position, length, hash);
  }
  const hashes = secondary('Path-hash index'), directory = secondary('Directory index');
  const encodedSize = index.u32(); index.take(encodedSize); const unencodedCount = index.u32();
  if (unencodedCount > entryCount) throw failure('The PAK entry counts are inconsistent.');
  const warnings = ['This inspection verifies index integrity, not publisher authenticity or executable safety.', 'Assets were not extracted or executed; native keyboard compatibility remains unverified.'];
  function checkEntry(reference) {
    if (reference === -2147483648) return;
    if (reference >= 0 ? reference >= encodedSize : -reference - 1 >= unencodedCount) throw failure('A file references an entry outside the PAK index.');
  }
  if (hashes) {
    const reader = new Reader(hashes.data), count = reader.u32(); if (count > entryCount) throw failure('The PAK path-hash count is inconsistent.');
    for (let i = 0; i < count; i++) { reader.take(8); checkEntry(reader.i32()); }
    // Unreal may append a pruned directory map. Its bounded, hashed bytes are
    // retained as metadata only; full path listing comes from the full index.
  }
  const paths = [], seen = new Set();
  if (directory) {
    const reader = new Reader(directory.data), count = reader.u32(); if (count > MAX_ENTRIES) throw failure('The PAK directory count is too large.');
    for (let i = 0; i < count; i++) {
      const name = reader.string(), files = reader.u32(); if (files > entryCount || paths.length + files > MAX_ENTRIES) throw failure('The PAK file count is inconsistent.');
      for (let j = 0; j < files; j++) {
        const file = reader.string(), reference = reader.i32(); checkEntry(reference); if (reference === -2147483648) continue;
        const full = name.replace(/^\//, '') + file;
        if (full.length > 4096 || seen.has(full)) throw failure('The PAK contains an oversized or duplicate file path.');
        seen.add(full); paths.push(full);
      }
    }
    if (paths.length > entryCount || reader.position !== directory.data.length) throw failure('The PAK directory index is inconsistent.');
  } else warnings.push('This archive has no full directory index; file names cannot be listed.');
  const unsafePaths = paths.filter(name => name.includes('\\') || /^[a-z]:|^\//i.test(name) || name.split('/').some(part => part === '..' || /[<>:"|?*]/.test(part) || /[. ]$/.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)));
  if (unsafePaths.length) warnings.push('Some indexed paths would be unsafe to extract. This tool never uses archive paths as local file paths.');
  const scanLimit = 16 * 1024 * 1024;
  const text = bytes.length <= scanLimit * 2 ? bytes.toString('latin1') : bytes.subarray(0, scanLimit).toString('latin1') + bytes.subarray(-scanLimit).toString('latin1');
  const engineAssociation = text.match(/"EngineAssociation"\s*:\s*"([0-9]+\.[0-9]+(?:\.[0-9]+)?)"/)?.[1] || null;
  const projectFiles = paths.filter(name => /\.uproject$/i.test(name));
  const entryPoints = paths.filter(name => /(?:M_EntryPoint|M_Koi|BP_KoiInteractionController)\.(?:uasset|umap)$/i.test(name));
  const shaderPlatforms = [...new Set(paths.flatMap(name => name.match(/(?:GLSL_ES3_1_ANDROID|GLSL_ES3_1|SF_VULKAN_ES31_ANDROID|SF_VULKAN_SM5|PCD3D_SM5|SF_METAL)[A-Z0-9_]*/g) || []))];
  const sparkModule = /"Modules"\s*:\s*\[[\s\S]{0,2048}?"Name"\s*:\s*"spark"/.test(text);
  return { readOnly: true, format: 'Unreal PAK', version, bytes: bytes.length, encryptedIndex: false, compressionMethods, mountPoint, entryCount, pathHashSeed, index: primary.info, pathHashIndex: hashes?.info || null, directoryIndex: directory?.info || null, paths, unsafePaths, clues: { engineAssociation, runtimeModules: sparkModule ? ['spark'] : [], projectFiles, entryPoints, shaderPlatforms, source: 'Indexed names and bounded literal metadata scan; clues are not compatibility proof.' }, compatibilityVerified: false, warnings };
}
module.exports = { inspectPak, MAX_FILE_BYTES, MAX_INDEX_BYTES };
