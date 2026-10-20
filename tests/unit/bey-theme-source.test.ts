import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { androidColorToRgba, beyColors, type BeyThemeMode } from '~/shared/theme/bey/colors';
import { beyTypography, getBeyTypographyProps } from '~/shared/theme/bey/typography';

const fixture = (name: string) =>
  fs.readFileSync(path.join(__dirname, '../fixtures/tonkeeper-theme', name), 'utf8');
const capitalize = (value: string) => value[0].toUpperCase() + value.slice(1);

it('uses valid web OpenType features and font faces rather than native-only CSS variants', () => {
  expect(getBeyTypographyProps('body1', true)).toMatchObject({
    fontFamily: '$beyBody',
    fontVariant: [],
    style: {
      fontFamily: 'TTFirsNeueNormal',
      fontFeatureSettings: "'ss07' 1, 'ss09' 1, 'ss17' 1, 'ss18' 1",
      fontSynthesis: 'none',
    },
  });
  expect(getBeyTypographyProps('h1', true).style?.fontFamily).toBe('TTFirsNeueDemiBold');
  expect(getBeyTypographyProps('label1', true).style?.fontFamily).toBe('TTFirsNeueMedium');
  expect(getBeyTypographyProps('mono', true).style?.fontFamily).toBe('BeyRobotoMono');
  expect(getBeyTypographyProps('body1', true, ['tabular-nums'])).toMatchObject({
    fontVariant: ['tabular-nums'],
    style: { fontFeatureSettings: 'normal' },
  });
  expect(getBeyTypographyProps('body1', false).fontVariant).toEqual(
    beyTypography.body1.fontVariant,
  );
});

it.each(['dark', 'light'] as BeyThemeMode[])(
  'preserves every role from the pinned %s source',
  (mode) => {
    const source = fixture(`${mode}.kt`);
    const expected: Record<string, string> = {};
    for (const section of source.matchAll(/(\w+)\s*=\s*\w+ColorScheme\(([\s\S]*?)\n\s*\)/g)) {
      const [, group, body] = section;
      for (const color of body.matchAll(/(\w+)\s*=\s*Color\(0x([A-F\d]{8})\)/g)) {
        let role = color[1];
        if (group.startsWith('button')) role = role.replace(/^primary/, '');
        else role = capitalize(role);
        role = `${group}${role}`.replace(/Disable$/, 'Disabled');
        const argb = color[2];
        expected[role] = argb.startsWith('FF')
          ? `#${argb.slice(2)}`
          : `#${argb.slice(2)}${argb.slice(0, 2)}`;
      }
    }
    expect(Object.keys(expected).length).toBeGreaterThan(50);
    expect(beyColors[mode]).toEqual(expected);
  },
);

it.each([
  ['#14FFFFFF', '#FFFFFF14'],
  ['#B80F0F0F', '#0F0F0FB8'],
  ['#F5000000', '#000000F5'],
  ['#1F818C99', '#818C991F'],
  ['#D9D9D9', '#D9D9D9'],
])('converts Android alpha ordering without changing opacity: %s', (source, expected) => {
  expect(androidColorToRgba(source)).toBe(expected);
});
it.each(['red', '#12345', '#GG000000'])('rejects malformed source colors: %s', (value) => {
  expect(() => androidColorToRgba(value)).toThrow('Invalid source color');
});

it('matches every named typography role, its tracking, line metrics, and stylistic sets', () => {
  const source = fixture('UIKitTypography.kt');
  const styles = [...source.matchAll(/(\w+)\s*=\s*TextStyle\(([\s\S]*?)\n\s*\)/g)];
  expect(styles.map((match) => match[1]).sort()).toEqual(Object.keys(beyTypography).sort());
  for (const [, name, body] of styles) {
    const metrics = beyTypography[name as keyof typeof beyTypography];
    const size = Number(body.match(/fontSize = (\d+)\.sp/)![1]);
    const weight = body.match(/fontWeight = FontWeight\.(\w+)/)![1];
    expect(metrics.fontSize).toBe(size);
    expect(metrics.fontWeight).toBe({ Normal: '400', Medium: '500', Bold: '700' }[weight]);
    const lineHeight = body.match(/lineHeight = (\d+)\.sp/);
    expect('lineHeight' in metrics ? metrics.lineHeight : undefined).toBe(
      lineHeight ? Number(lineHeight[1]) : undefined,
    );
    const spacing = body.match(/letterSpacing = ([\d.]+)\.(em|sp)/);
    const expectedSpacing = spacing
      ? Number(spacing[1]) * (spacing[2] === 'em' ? size : 1)
      : undefined;
    expect('letterSpacing' in metrics ? metrics.letterSpacing : undefined).toBe(expectedSpacing);
    const headingFeatures = ['stylistic-nine', 'stylistic-seventeen', 'stylistic-eighteen'];
    expect(metrics.fontVariant).toEqual(
      body.includes('TEXT_FONT_FEATURE_SETTINGS')
        ? ['stylistic-seven', ...headingFeatures]
        : body.includes('NUM_AND_HEADING_FONT_FEATURE_SETTINGS')
          ? headingFeatures
          : [],
    );
  }
});

it('ships the exact pinned fonts, reusing the three existing TT Firs Neue assets', () => {
  const hashes = {
    'tt_firs_neue_normal.ttf': '1d76d479a014b84752f5f1696addb3fd73e8a071',
    'tt_firs_neue_medium.ttf': '28ed596201e78072ff9c68f713d6fd517ce07f73',
    'tt_firs_neue_demi_bold.ttf': '67df2e47a5ad31f4de1ebb86f3e5be6001852f4a',
    'roboto_mono.ttf': 'b158a334eb372a9ab2ecd4f2566e60d561e71a9f',
  };
  for (const [name, expected] of Object.entries(hashes)) {
    const data = fs.readFileSync(path.join(__dirname, '../../src/assets/fonts', name));
    expect(createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex')).toBe(
      expected,
    );
  }
});
