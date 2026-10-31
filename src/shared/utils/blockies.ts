import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

type BlockiesColors = { color: string; bgColor: string; spotColor: string };

// A deterministic hash stream for artwork, never a source of wallet keys or secrets.
function seededRandom(seed: string) {
  let bytes = sha256(utf8ToBytes(`bey-blockies-v2:${seed}`));
  let offset = 0;
  return () => {
    if (offset === bytes.length) {
      bytes = sha256(bytes);
      offset = 0;
    }
    const value = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset);
    offset += 4;
    return value / 0x100000000;
  };
}

export function generateBlockies(
  seed: string,
  size: number,
  overrides: Partial<BlockiesColors> = {},
) {
  const random = seededRandom(seed);
  const hue = Math.floor(random() * 360);
  const color = `hsl(${hue}, ${55 + Math.floor(random() * 40)}%, ${35 + Math.floor(random() * 20)}%)`;
  const bgColor = `hsl(${Math.floor(random() * 360)}, ${10 + Math.floor(random() * 20)}%, ${89 + Math.floor(random() * 7)}%)`;
  const spotHue = (hue + 60 + Math.floor(random() * 241)) % 360;
  const spotColor = `hsl(${spotHue}, ${55 + Math.floor(random() * 40)}%, ${35 + Math.floor(random() * 25)}%)`;
  const pixels: number[] = new Array(size * size);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < Math.ceil(size / 2); col++) {
      // Leave background cells visible, with occasional contrasting accent cells.
      const value = random();
      const pixel = value < 0.43 ? 0 : value < 0.86 ? 1 : 2;
      pixels[row * size + col] = pixel;
      pixels[row * size + size - 1 - col] = pixel;
    }
  }
  return {
    pixels,
    color: overrides.color ?? color,
    bgColor: overrides.bgColor ?? bgColor,
    spotColor: overrides.spotColor ?? spotColor,
  };
}
