"""Extend Bey's existing outlines with four currency glyphs; never change old glyphs.

Run with fonttools, skia-pathops and pillow in an isolated tooling environment.
Default output is a reviewable candidate and PNG under .tmp/currency-glyphs.
Pass --apply to update the font assets after reviewing the candidate.
"""

import argparse
import hashlib
import json
from pathlib import Path

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import Glyph
from fontTools.ttLib.removeOverlaps import removeOverlaps
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'src/assets/fonts'
REVIEW = ROOT / '.tmp/currency-glyphs'
WEIGHTS = ['Regular', 'Medium', 'SemiBold', 'Bold']
SYMBOLS = {0x20A6: ('beyNaira', 'N'), 0x0E3F: ('beyBaht', 'B'),
           0x20B1: ('beyPeso', 'P'), 0x20AB: ('beyDong', 'đ')}


def rectangle(pen, left, bottom, right, top):
    # Clockwise contours match TrueType's outer outline winding.
    pen.moveTo((round(left), round(bottom)))
    pen.lineTo((round(left), round(top)))
    pen.lineTo((round(right), round(top)))
    pen.lineTo((round(right), round(bottom)))
    pen.closePath()


def outline(font, name):
    recording = DecomposingRecordingPen(font.getGlyphSet())
    font.getGlyphSet()[name].draw(recording)
    return recording.value


def extend(source, destination):
    font = TTFont(source, recalcTimestamp=False)
    cmap = font.getBestCmap()
    order = font.getGlyphOrder()
    original_names = [name for name in order if name not in {item[0] for item in SYMBOLS.values()}]
    offsets = font['loca'].locations
    raw_glyf = font.reader['glyf']
    original_bytes = {name: raw_glyf[offsets[index]:offsets[index + 1]]
                      for index, name in enumerate(order) if name in original_names}
    originals = {name: outline(font, name) for name in original_names}
    metrics = {name: font['hmtx'][name] for name in original_names}
    previous_cmap = {point: name for point, name in cmap.items() if point not in SYMBOLS}
    old_shapes = {
        str(point): hashlib.sha256(original_bytes[name].rstrip(b'\0')).hexdigest()
        for point, name in cmap.items() if point in map(ord, '$€£¥₿₹₽₩₺￥')
    }
    vertical = (font['hhea'].ascent, font['hhea'].descent, font['hhea'].lineGap,
                font['OS/2'].sTypoAscender, font['OS/2'].sTypoDescender,
                font['OS/2'].sTypoLineGap)
    cap = font['OS/2'].sCapHeight
    underline = font['glyf'][cmap[ord('_')]]
    thickness = round((underline.yMax - underline.yMin) * 0.68)

    for point, (name, letter) in SYMBOLS.items():
        base_name = cmap[ord(letter)]
        base = font['glyf'][base_name]
        advance = font['hmtx'][base_name][0]
        recording = DecomposingRecordingPen(font.getGlyphSet())
        font.getGlyphSet()[base_name].draw(recording)
        pen = TTGlyphPen(None)
        recording.replay(pen)
        left, right = max(24, base.xMin - 34), base.xMax + 34
        if point == 0x20A6:
            for position in (0.43, 0.57):
                middle = round(cap * position)
                rectangle(pen, left, middle - thickness / 2, right, middle + thickness / 2)
        elif point == 0x0E3F:
            middle = round(base.xMin + (base.xMax - base.xMin) * 0.40)
            rectangle(pen, middle - thickness / 2, -60, middle + thickness / 2, cap + 60)
        elif point == 0x20B1:
            for position in (0.66, 0.80):
                middle = round(cap * position)
                rectangle(pen, left, middle - thickness / 2, right, middle + thickness / 2)
        else:
            rectangle(pen, base.xMin, underline.yMin, base.xMax, underline.yMax)

        glyph = pen.glyph()
        font['glyf'][name] = glyph
        if name not in order:
            order.append(name)
        font.setGlyphOrder(order)
        glyph.recalcBounds(font['glyf'])
        font['hmtx'][name] = (max(advance, glyph.xMax + 48), glyph.xMin)
        for table in font['cmap'].tables:
            if table.isUnicode() and table.format in (4, 12, 13):
                table.cmap[point] = name

    # Merge intersections only in the four new outlines. Existing approved glyphs
    # (including the custom Bitcoin and revision-5 rupee) are never processed.
    removeOverlaps(font, glyphNames=[item[0] for item in SYMBOLS.values()], removeHinting=True)
    font['maxp'].recalc(font)
    for name, raw in original_bytes.items():
        font['glyf'][name] = Glyph(data=raw)
    # Keep the approved outline encoding as well as its geometry. Recalculating
    # bounds would unnecessarily re-encode old outlines and their hint programs.
    font.recalcBBoxes = False
    font['OS/2'].ulUnicodeRange1 |= 1 << 24  # Thai currency sign
    font['OS/2'].ulUnicodeRange2 |= 1 << 1   # Currency Symbols
    destination.parent.mkdir(parents=True, exist_ok=True)
    font.save(destination)

    saved = TTFont(destination, recalcTimestamp=False, checkChecksums=2)
    for name in original_names:
        assert outline(saved, name) == originals[name], f'Changed approved outline: {name}'
        assert saved['hmtx'][name] == metrics[name], f'Changed approved metrics: {name}'
    for point, name in previous_cmap.items():
        assert saved.getBestCmap()[point] == name, f'Changed character mapping: {point}'
    assert vertical == (saved['hhea'].ascent, saved['hhea'].descent, saved['hhea'].lineGap,
                        saved['OS/2'].sTypoAscender, saved['OS/2'].sTypoDescender,
                        saved['OS/2'].sTypoLineGap), 'Changed line metrics'
    for point, digest in old_shapes.items():
        name = saved.getBestCmap()[int(point)]
        index = saved.getGlyphID(name)
        locations = saved['loca'].locations
        raw = saved.reader['glyf'][locations[index]:locations[index + 1]]
        assert hashlib.sha256(raw.rstrip(b'\0')).hexdigest() == digest, 'Changed approved currency glyph bytes'
    return {
        'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
        'preservedGlyphs': len(original_names),
        'approvedCurrencyGlyphs': old_shapes,
    }


def preview(directory):
    image = Image.new('RGB', (1240, 1040), 'white')
    draw = ImageDraw.Draw(image)
    for index, weight in enumerate(WEIGHTS):
        path = str(directory / f'BeyFunnelDisplay-{weight}.ttf')
        small = ImageFont.truetype(path, 24)
        large = ImageFont.truetype(path, 88)
        row = 35 + index * 250
        draw.text((40, row), weight, fill='black', font=small)
        draw.text((40, row + 45), '₦    ฿    ₱    ₫', fill='black', font=large)
        draw.text((40, row + 170), '₦0.01     ฿0.01     ₱0.01     0,01 ₫     ₿ ₹ ₽ ₩ ₺ ¥ ￥', fill='black', font=small)
    target = REVIEW / 'currency-glyphs.png'
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    output = ASSETS if args.apply else REVIEW
    manifest = {}
    for weight in WEIGHTS:
        filename = f'BeyFunnelDisplay-{weight}.ttf'
        manifest[weight] = extend(ASSETS / filename, output / filename)
    REVIEW.mkdir(parents=True, exist_ok=True)
    (REVIEW / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    preview(output)
    print(json.dumps(manifest, indent=2))


if __name__ == '__main__':
    main()
