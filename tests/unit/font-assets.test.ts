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

it.each(Object.entries(manifest.fonts))(
  'bundles %s with currency coverage and default tnum/zero/ss01/ss02 lookups',
  (filename, expected) => {
    const font = readFileSync(path.join(process.cwd(), 'src/assets/fonts', filename));
    expect(font.readUInt16BE(tableOffset(font, 'OS/2') + 4)).toBe(expected.weight);
    for (const symbol of '$€£¥₿₹₽₩₺￥₦฿₱₫') {
      expect({ symbol, covered: glyphIndex(font, symbol.codePointAt(0)!) !== 0 }).toEqual({
        symbol,
        covered: true,
      });
    }
    const gsub = tableOffset(font, 'GSUB');
    const list = gsub + font.readUInt16BE(gsub + 6);
    const features = new Map<string, number[]>();
    for (let i = 0; i < font.readUInt16BE(list); i++) {
      const record = list + 2 + i * 6;
      const table = list + font.readUInt16BE(record + 4);
      features.set(
        font.toString('ascii', record, record + 4),
        Array.from({ length: font.readUInt16BE(table + 2) }, (_, j) =>
          font.readUInt16BE(table + 4 + j * 2),
        ),
      );
    }
    const defaults = features.get('ccmp');
    expect(defaults).toEqual(expected.defaultLookups);
    for (const feature of ['tnum', 'zero', 'ss01', 'ss02']) {
      expect(features.get(feature)?.length).toBeGreaterThan(0);
      expect(defaults).toEqual(expect.arrayContaining(features.get(feature)!));
    }
    expect(createHash('sha256').update(font).digest('hex')).toBe(expected.sha256);
  },
);

it('registers exactly the six Inter faces for native embedding and runtime loading', () => {
  expect(
    readdirSync('src/assets/fonts')
      .filter((name) => /\.(ttf|otf)$/.test(name))
      .sort(),
  ).toEqual(Object.keys(manifest.fonts).sort());
  const app = JSON.parse(readFileSync('app.json', 'utf8'));
  const embedded = app.expo.plugins.find((plugin: unknown[]) => plugin[0] === 'expo-font')[1].fonts;
  expect(embedded.map((name: string) => path.basename(name)).sort()).toEqual(
    Object.keys(manifest.fonts).sort(),
  );
  const runtime = readFileSync('src/shared/layout/RootLayout.tsx', 'utf8');
  for (const name of Object.keys(manifest.fonts)) expect(runtime).toContain(name);
  expect(runtime).not.toMatch(/BeyFunnel|Mono\.otf/);
});
