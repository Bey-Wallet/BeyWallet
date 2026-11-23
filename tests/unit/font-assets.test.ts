import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import manifest from '../../src/assets/fonts/inter-manifest.json';

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

function features(font: Buffer) {
  const gsub = tableOffset(font, 'GSUB');
  const list = gsub + font.readUInt16BE(gsub + 6);
  const result = new Map<string, number[]>();
  for (let i = 0; i < font.readUInt16BE(list); i++) {
    const record = list + 2 + i * 6;
    const feature = list + font.readUInt16BE(record + 4);
    result.set(
      font.toString('ascii', record, record + 4),
      Array.from({ length: font.readUInt16BE(feature + 2) }, (_, j) =>
        font.readUInt16BE(feature + 4 + j * 2),
      ),
    );
  }
  return result;
}

function coverageIndex(font: Buffer, start: number, glyph: number) {
  const count = font.readUInt16BE(start + 2);
  if (font.readUInt16BE(start) === 1)
    return Array.from({ length: count }, (_, i) => font.readUInt16BE(start + 4 + i * 2)).indexOf(
      glyph,
    );
  expect(font.readUInt16BE(start)).toBe(2);
  for (let i = 0; i < count; i++) {
    const range = start + 4 + i * 6;
    const first = font.readUInt16BE(range);
    if (glyph >= first && glyph <= font.readUInt16BE(range + 2))
      return font.readUInt16BE(range + 4) + glyph - first;
  }
  return -1;
}

function substitute(font: Buffer, glyph: number, indexes: number[]) {
  const gsub = tableOffset(font, 'GSUB');
  const list = gsub + font.readUInt16BE(gsub + 8);
  for (const index of [...new Set(indexes)].sort((a, b) => a - b)) {
    const lookup = list + font.readUInt16BE(list + 2 + index * 2);
    expect(font.readUInt16BE(lookup)).toBe(1);
    for (let i = 0; i < font.readUInt16BE(lookup + 4); i++) {
      const table = lookup + font.readUInt16BE(lookup + 6 + i * 2);
      const position = coverageIndex(font, table + font.readUInt16BE(table + 2), glyph);
      if (position < 0) continue;
      glyph =
        font.readUInt16BE(table) === 1
          ? (glyph + font.readInt16BE(table + 4)) & 0xffff
          : font.readUInt16BE(table + 6 + position * 2);
      break;
    }
  }
  return glyph;
}

it.each(Object.entries(manifest.fonts))(
  'prepares %s with the approved optical cut and feature defaults',
  (filename, expected) => {
    const font = readFileSync(path.join('src/assets/fonts', filename));
    expect(createHash('sha256').update(font).digest('hex')).toBe(expected.sha256);
    expect(font.readUInt16BE(tableOffset(font, 'OS/2') + 4)).toBe(expected.weight);
    expect(manifest.opticalSize).toBe(14);
    for (const symbol of '$€£¥₿₹₽₩₺₦฿₱₫złKč')
      expect(glyphIndex(font, symbol.codePointAt(0)!)).toBeGreaterThan(0);
    const selected = features(font);
    const enabled = ['ss02', 'tnum', 'cv02', 'cv03', 'cv04'].flatMap((tag) => selected.get(tag)!);
    expect(selected.get('ccmp')).toEqual(expected.defaultLookups);
    expect(selected.get('ccmp')).toEqual(expect.arrayContaining(enabled));
    for (const tag of ['zero', 'cv01', 'ss07'])
      for (const index of selected.get(tag)!) expect(selected.get('ccmp')).not.toContain(index);
    const original = (char: string) => glyphIndex(font, char.codePointAt(0)!);
    const apply = (char: string) => substitute(font, original(char), enabled);
    for (const char of 'Il') expect(apply(char)).not.toBe(original(char));
    const tabular = (char: string) => substitute(font, original(char), selected.get('tnum')!);
    for (const char of '01!?.,:;') expect(apply(char)).toBe(tabular(char));
    for (const char of '469') expect(apply(char)).not.toBe(tabular(char));
    const hmtx = tableOffset(font, 'hmtx');
    const metrics = font.readUInt16BE(tableOffset(font, 'hhea') + 34);
    expect(manifest.numeralMode).toBe('tabular');
    expect(new Set(expected.digitAdvances).size).toBe(1);
    for (const [index, char] of [...'0123456789'].entries()) {
      const glyph = apply(char);
      expect(font.readUInt16BE(hmtx + Math.min(glyph, metrics - 1) * 4)).toBe(
        expected.digitAdvances[index],
      );
      expect(substitute(font, glyph, enabled)).toBe(glyph);
    }
  },
);

it('bundles and registers exactly the three Inter faces with their license', () => {
  const filenames = Object.keys(manifest.fonts).sort();
  expect(
    readdirSync('src/assets/fonts')
      .filter((name) => /\.(ttf|otf)$/.test(name))
      .sort(),
  ).toEqual(filenames);
  const app = JSON.parse(readFileSync('app.json', 'utf8'));
  const embedded = app.expo.plugins.find((plugin: unknown[]) => plugin[0] === 'expo-font')[1].fonts;
  expect(embedded.map((name: string) => path.basename(name)).sort()).toEqual(filenames);
  const runtime = readFileSync('src/shared/layout/RootLayout.tsx', 'utf8');
  for (const [filename, expected] of Object.entries(manifest.fonts))
    expect(runtime).toContain(`${expected.runtimeFamily}: require('~/assets/fonts/${filename}')`);
  const license = readFileSync('src/assets/fonts/Inter-OFL.txt');
  expect(createHash('sha256').update(license).digest('hex')).toBe(manifest.licenseSha256);
  expect(license.toString()).toContain('The Inter Project Authors');
});
