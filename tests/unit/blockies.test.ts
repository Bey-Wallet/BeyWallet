import { generateBlockies } from '~/shared/utils/blockies';

describe('Blockies artwork', () => {
  it('keeps artwork deterministic, including empty and Unicode seeds', () => {
    for (const seed of ['', 'npub1example', 'Bey 🐝']) {
      expect(generateBlockies(seed, 10)).toEqual(generateBlockies(seed, 10));
    }
  });

  it('distinguishes seeds that collided in the previous 32-bit string hash', () => {
    expect(generateBlockies('Aa', 10)).not.toEqual(generateBlockies('BB', 10));
  });

  it.each([1, 7, 8, 10, 12])('mirrors a %i-cell grid without missing cells', (size) => {
    const { pixels } = generateBlockies('symmetry', size);
    expect(pixels).toHaveLength(size * size);
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        expect([0, 1, 2]).toContain(pixels[row * size + col]);
        expect(pixels[row * size + col]).toBe(pixels[row * size + size - 1 - col]);
      }
    }
  });

  it('uses background, foreground and accent cells without repeating every 32 pixels', () => {
    const { pixels } = generateBlockies('npub1example', 12);
    expect(new Set(pixels)).toEqual(new Set([0, 1, 2]));
    expect(pixels.slice(0, 32)).not.toEqual(pixels.slice(32, 64));
  });

  it('supports independent color overrides without changing the pattern or other colors', () => {
    const original = generateBlockies('custom', 10);
    for (const key of ['color', 'bgColor', 'spotColor'] as const) {
      expect(generateBlockies('custom', 10, { [key]: '#123456' })).toEqual({
        ...original,
        [key]: '#123456',
      });
    }
  });

  it('keeps the palette consistent at different avatar resolutions', () => {
    const { pixels: small, ...smallColors } = generateBlockies('same-person', 8);
    const { pixels: large, ...largeColors } = generateBlockies('same-person', 12);
    expect(smallColors).toEqual(largeColors);
    expect(small).toHaveLength(64);
    expect(large).toHaveLength(144);
  });

  it('distributes identities across the hue wheel with distinct palettes and patterns', () => {
    const hueGroups = new Set<number>();
    const artworks = new Set<string>();
    for (let index = 0; index < 100; index++) {
      const artwork = generateBlockies(`person-${index}`, 10);
      const hue = Number(artwork.color.match(/^hsl\((\d+),/)![1]);
      hueGroups.add(Math.floor(hue / 30));
      artworks.add(JSON.stringify(artwork));
    }
    expect(hueGroups.size).toBe(12);
    expect(artworks.size).toBe(100);
  });
});
