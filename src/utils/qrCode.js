// Task 23 (Phase 5 digital business card): a small, dependency-free QR Code encoder (ISO/IEC 18004) for the card's share link.
// Scope on purpose: BYTE mode (UTF-8), error-correction level M, versions 1-10 (up to 213 bytes - a card URL is ~70), automatic
// mask selection by the standard penalty rules. Returns a boolean module matrix; `qrSvgPath` turns it into one SVG path.
// Verified against an independent reference encoder (module-for-module, see qrCode.test.js) - no runtime dependency is added.

// [version]: { ec: EC codewords per block, groups: [[blocks, data codewords per block], ...] }  (level M)
const M_BLOCKS = {
  1: { ec: 10, groups: [[1, 16]] },
  2: { ec: 16, groups: [[1, 28]] },
  3: { ec: 26, groups: [[1, 44]] },
  4: { ec: 18, groups: [[2, 32]] },
  5: { ec: 24, groups: [[2, 43]] },
  6: { ec: 16, groups: [[4, 27]] },
  7: { ec: 18, groups: [[4, 31]] },
  8: { ec: 22, groups: [[2, 38], [2, 39]] },
  9: { ec: 22, groups: [[3, 36], [2, 37]] },
  10: { ec: 26, groups: [[4, 43], [1, 44]] },
};
const ALIGNMENT = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };
const REMAINDER_BITS = { 1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7, 7: 0, 8: 0, 9: 0, 10: 0 };
export const MAX_VERSION = 10;

const dataCapacity = (v) => M_BLOCKS[v].groups.reduce((s, [b, d]) => s + b * d, 0);

// ---- GF(256) Reed-Solomon (primitive polynomial 0x11D)
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function rsGenerator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) { next[j] ^= poly[j]; next[j + 1] ^= gfMul(poly[j], EXP[i]); }
    poly = next;
  }
  return poly;
}

export function rsRemainder(data, degree) {
  const gen = rsGenerator(degree);
  const res = new Array(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ res.shift();
    res.push(0);
    for (let i = 0; i < degree; i++) res[i] ^= gfMul(gen[i + 1], factor);
  }
  return res;
}

// ---- BCH-coded format / version information
export function formatBits(mask) { // EC level M = 00
  const data = (0b00 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}
export function versionBits(version) {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >> 11) * 0x1f25);
  return (version << 12) | rem;
}

function utf8Bytes(text) { return Array.from(new TextEncoder().encode(String(text))); }

function chooseVersion(byteLength) {
  for (let v = 1; v <= MAX_VERSION; v++) {
    const countBits = v < 10 ? 8 : 16;
    if (4 + countBits + byteLength * 8 <= dataCapacity(v) * 8) return v;
  }
  return null;
}

function encodeData(bytes, version) {
  const bits = [];
  const put = (value, length) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const capacityBits = dataCapacity(version) * 8;
  put(0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8) bits.push(0);
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) codewords.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0; codewords.length < dataCapacity(version); pad++) codewords.push(pad % 2 === 0 ? 0xec : 0x11);
  return codewords;
}

function interleave(data, version) {
  const { ec, groups } = M_BLOCKS[version];
  const blocks = [];
  let offset = 0;
  for (const [count, size] of groups) for (let i = 0; i < count; i++) { const d = data.slice(offset, offset + size); offset += size; blocks.push({ d, e: rsRemainder(d, ec) }); }
  const out = [];
  const maxData = Math.max(...blocks.map((b) => b.d.length));
  for (let i = 0; i < maxData; i++) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
  for (let i = 0; i < ec; i++) for (const b of blocks) out.push(b.e[i]);
  return out;
}

function baseMatrix(version) {
  const size = version * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (r, c, dark) => { m[r][c] = dark; fn[r][c] = true; };
  const finder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const rr = r0 + r, cc = c0 + c;
      if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
      const inRing = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6);
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      set(rr, cc, inRing || inCore);
    }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
  for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const pos = ALIGNMENT[version];
  for (const r of pos) for (const c of pos) {
    const nearFinder = (r < 9 && c < 9) || (r < 9 && c > size - 10) || (r > size - 10 && c < 9);
    if (nearFinder) continue; // the three corners carry finders; centres on the timing row/column are real alignment patterns
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
  }
  // reserve format areas (+ the always-dark module)
  for (let i = 0; i < 9; i++) { if (!fn[8][i]) set(8, i, false); if (!fn[i][8]) set(i, 8, false); }
  for (let i = 0; i < 8; i++) { set(8, size - 1 - i, false); set(size - 1 - i, 8, false); }
  set(size - 8, 8, true);
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >> i) & 1) === 1;
      const a = Math.floor(i / 3), b = (i % 3) + size - 11;
      set(a, b, dark); set(b, a, dark);
    }
  }
  return { size, m, fn };
}

function placeData(m, fn, size, codewords, remainderBits) {
  const bits = [];
  for (const cw of codewords) for (let i = 7; i >= 0; i--) bits.push((cw >>> i) & 1);
  for (let i = 0; i < remainderBits; i++) bits.push(0);
  let k = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let n = 0; n < size; n++) {
      const row = upward ? size - 1 - n : n;
      for (let j = 0; j < 2; j++) {
        const col = right - j;
        if (fn[row][col]) continue;
        m[row][col] = k < bits.length ? bits[k] === 1 : false;
        k++;
      }
    }
    upward = !upward;
  }
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyMask(m, fn, size, mask) {
  const out = m.map((row) => row.slice());
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!fn[r][c] && MASKS[mask](r, c)) out[r][c] = !out[r][c];
  return out;
}

function drawFormat(m, size, mask) {
  const bits = formatBits(mask);
  const bit = (i) => ((bits >> i) & 1) === 1;
  // m[row][col]; bit 0 = least significant (ISO/IEC 18004 figure 25)
  for (let i = 0; i <= 5; i++) m[i][8] = bit(i);
  m[7][8] = bit(6); m[8][8] = bit(7); m[8][7] = bit(8);
  for (let i = 9; i < 15; i++) m[8][14 - i] = bit(i);
  for (let i = 0; i < 8; i++) m[8][size - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) m[size - 15 + i][8] = bit(i);
  m[size - 8][8] = true;
}

export function penalty(m) {
  const size = m.length;
  let score = 0;
  const lines = [];
  for (let i = 0; i < size; i++) { lines.push(m[i]); lines.push(m.map((row) => row[i])); }
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && line[i] === line[i - 1]) run++;
      else { if (run >= 5) score += run - 2; run = 1; }
    }
    for (let i = 0; i + 10 < size + 1; i++) {
      const s = line.slice(i, i + 11).map((x) => (x ? 1 : 0)).join('');
      if (s === '10111010000' || s === '00001011101') score += 40;
    }
  }
  for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) {
    const v = m[r][c];
    if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
  }
  const dark = m.reduce((s, row) => s + row.filter(Boolean).length, 0);
  score += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
  return score;
}

// Encodes `text` (UTF-8). Returns { version, mask, size, modules } or throws for text longer than version 10 allows.
export function encodeQr(text, { mask: forcedMask = null } = {}) {
  const bytes = utf8Bytes(text);
  const version = chooseVersion(bytes.length);
  if (!version) throw new Error('QR_TEXT_TOO_LONG');
  const codewords = interleave(encodeData(bytes, version), version);
  const { size, m, fn } = baseMatrix(version);
  placeData(m, fn, size, codewords, REMAINDER_BITS[version]);
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    if (forcedMask !== null && mask !== forcedMask) continue;
    const candidate = applyMask(m, fn, size, mask);
    drawFormat(candidate, size, mask);
    const score = forcedMask !== null ? 0 : penalty(candidate);
    if (!best || score < best.score) best = { score, mask, modules: candidate };
  }
  return { version, mask: best.mask, size, modules: best.modules };
}

// One SVG path ("M x y h1 v1 h-1 z" per dark module) in module units, offset by a quiet zone of `margin` modules.
export function qrSvgPath(modules, margin = 4) {
  let d = '';
  modules.forEach((row, r) => row.forEach((dark, c) => { if (dark) d += `M${c + margin} ${r + margin}h1v1h-1z`; }));
  return d;
}
