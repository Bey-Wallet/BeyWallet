import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Approved production files: lock the glyphs without retaining preview assets.
const approvedFontHashes = {
  Regular: 'f2e607f2bcb8cae25a5a6d404bcc53215506adff8b7da01ad04458c1b542696e',
  Medium: 'dcd39846547fdf7e19db865987d520ef589f591f54d281e4ef2a26b9b2b86ee4',
  SemiBold: '01b46e562208ee7c7d60779f7714ac753fc2567edbd6f61b8bd95245e1eb3132',
  Bold: '18f7100d66022eb8b1511bf1e86a1b2dd81a929b033054238990ebbc967c4bbe',
};

function tableOffset(font: Buffer, tag: string) {
  for (let i = 0; i < font.readUInt16BE(4); i++) {
    const entry = 12 + i * 16;
    if (font.toString('ascii', entry, entry + 4) === tag) return font.readUInt32BE(entry + 8);
  }
  throw new Error(`Missing font table: ${tag}`);
}

function hasGlyph(font: Buffer, codePoint: number) {
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
          return true;
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
        if ((!range || glyph !== 0) && ((glyph + delta) & 0xffff) !== 0) return true;
      }
    }
  }
  return false;
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
    for (const symbol of '$€£¥₿₹₽₩₺￥') {
      expect({ symbol, covered: hasGlyph(font, symbol.codePointAt(0)!) }).toEqual({
        symbol,
        covered: true,
      });
    }
    expect(createHash('sha256').update(font).digest('hex')).toBe(approvedFontHashes[name]);
  },
);
