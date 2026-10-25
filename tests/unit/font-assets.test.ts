import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import approvedCurrencyGlyphs from '../fixtures/approved-currency-glyphs.json';

// Approved production files: lock the glyphs without retaining preview assets.
const approvedFontHashes = {
  Regular: 'a3e44caaead40019c5771b9c986f9d4b7999bf7cea74b72548c2237eb29a60d1',
  Medium: '668992f15b7af6eab354ae3d800f1135c0efbf1c3abd0fd95cc9ff16a82057f9',
  SemiBold: 'bccb9fb5dd42e61e532569ca43bdb83ab5893daa8354ec1b79a30a9b008687e0',
  Bold: 'af2a8e1f4c6f413ae8cc86c68d80e16a09a88f4044848260abb8cd5dc41c8390',
};

function tableOffset(font: Buffer, tag: string) {
  for (let i = 0; i < font.readUInt16BE(4); i++) {
    const entry = 12 + i * 16;
    if (font.toString('ascii', entry, entry + 4) === tag) return font.readUInt32BE(entry + 8);
  }
  throw new Error(`Missing font table: ${tag}`);
}

function glyphIndex(font: Buffer, codePoint: number) {
  const cmap = tableOffset(font, 'cmap');
  for (let i = 0; i < font.readUInt16BE(cmap + 2); i++) {
    const record = cmap + 4 + i * 8;
    const platform = font.readUInt16BE(record);
    const encoding = font.readUInt16BE(record + 2);
    if (platform !== 0 && !(platform === 3 && [1, 10].includes(encoding))) continue;
    const start = cmap + font.readUInt32BE(record + 4);
    const format = font.readUInt16BE(start);
    if (format === 12) {
      for (let group = 0; group < font.readUInt32BE(start + 12); group++) {
        const entry = start + 16 + group * 12;
        const first = font.readUInt32BE(entry);
        const last = font.readUInt32BE(entry + 4);
        if (
          codePoint >= first &&
          codePoint <= last &&
          font.readUInt32BE(entry + 8) + codePoint - first !== 0
        )
          return font.readUInt32BE(entry + 8) + codePoint - first;
      }
    } else if (format === 4 && codePoint <= 0xffff) {
      const count = font.readUInt16BE(start + 6) / 2;
      for (let segment = 0; segment < count; segment++) {
        const last = font.readUInt16BE(start + 14 + segment * 2);
        const first = font.readUInt16BE(start + 16 + count * 2 + segment * 2);
        if (codePoint < first || codePoint > last) continue;
        const delta = font.readInt16BE(start + 16 + count * 4 + segment * 2);
        const location = start + 16 + count * 6 + segment * 2;
        const range = font.readUInt16BE(location);
        const glyph = range
          ? font.readUInt16BE(location + range + (codePoint - first) * 2)
          : codePoint;
        if ((!range || glyph !== 0) && ((glyph + delta) & 0xffff) !== 0)
          return (glyph + delta) & 0xffff;
      }
    }
  }
  return 0;
}

it.each([
  ['Regular', 400],
  ['Medium', 500],
  ['SemiBold', 600],
  ['Bold', 700],
] as const)(
  'bundles approved Funnel Display %s weight %i with all currency symbols',
  (name, weight) => {
    const font = readFileSync(
      path.join(process.cwd(), 'src/assets/fonts', `BeyFunnelDisplay-${name}.ttf`),
    );
    expect(font.readUInt16BE(tableOffset(font, 'OS/2') + 4)).toBe(weight);
    for (const symbol of '$€£¥₿₹₽₩₺￥₦฿₱₫') {
      expect({ symbol, covered: glyphIndex(font, symbol.codePointAt(0)!) !== 0 }).toEqual({
        symbol,
        covered: true,
      });
    }
    const loca = tableOffset(font, 'loca');
    const glyf = tableOffset(font, 'glyf');
    const longOffsets = font.readInt16BE(tableOffset(font, 'head') + 50) === 1;
    const offset = (index: number) =>
      longOffsets ? font.readUInt32BE(loca + index * 4) : font.readUInt16BE(loca + index * 2) * 2;
    for (const [codePoint, expected] of Object.entries(approvedCurrencyGlyphs[name])) {
      const index = glyphIndex(font, Number(codePoint));
      const start = glyf + offset(index);
      let end = glyf + offset(index + 1);
      // Ignore alignment padding; pin the pre-existing approved outline bytes.
      while (end > start && font[end - 1] === 0) end--;
      expect(createHash('sha256').update(font.subarray(start, end)).digest('hex')).toBe(expected);
    }
    expect(createHash('sha256').update(font).digest('hex')).toBe(approvedFontHashes[name]);
  },
);
