"""Prepare Inter Text/Display with consistent defaults on native and web.

uv run --no-project --with fonttools==4.67.0 --with uharfbuzz==0.57.0 python scripts/prepare-inter-fonts.py
No runtime dependency is added. Source download is pinned and hash checked.
"""

import hashlib
import io
import json
from pathlib import Path
from urllib.request import urlopen

import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'src/assets/fonts'
CACHE = ROOT / '.tmp/inter-fonts'
SOURCE = 'https://raw.githubusercontent.com/rsms/inter/v4.1/docs/font-files/InterVariable.ttf'
SOURCE_HASH = '4989b125924991b90d05b2d16e0e388c48f7d5bb8b30539bbf9c755278d0ccaf'
FEATURES = {'tnum': 1, 'zero': 1, 'ss01': 1, 'ss02': 1}
WEIGHTS = {'Regular': 400, 'Medium': 500, 'SemiBold': 600}
SAMPLES = ['0123456789', 'Il1O0 3469', '$€£¥₿₹₽₩₺₦฿₱₫', 'Balance 10,346.90',
           'Illegal busineß βeta', 'éà ÎÏĪ ł ƚ', 'A -> B 12:34']


def serialize(font):
    output = io.BytesIO()
    font.save(output)
    return output.getvalue()


def shape(data, text, features=None):
    font = hb.Font(hb.Face(data))
    buffer = hb.Buffer()
    buffer.add_str(text)
    buffer.guess_segment_properties()
    hb.shape(font, buffer, features or {})
    return [(info.codepoint, pos.x_advance, pos.x_offset, pos.y_offset)
            for info, pos in zip(buffer.glyph_infos, buffer.glyph_positions)]


def prepare():
    CACHE.mkdir(parents=True, exist_ok=True)
    source_path = CACHE / 'InterVariable.ttf'
    if not source_path.exists():
        source_path.write_bytes(urlopen(SOURCE).read())
    source = source_path.read_bytes()
    assert hashlib.sha256(source).hexdigest() == SOURCE_HASH, 'Unexpected Inter source'
    manifest = {'source': SOURCE, 'sourceSha256': SOURCE_HASH, 'features': list(FEATURES), 'fonts': {}}
    for optical, size in [('Text', 14), ('Display', 32)]:
        for style, weight in WEIGHTS.items():
            font = instantiateVariableFont(TTFont(io.BytesIO(source), recalcTimestamp=False),
                                           {'opsz': size, 'wght': weight}, inplace=True)
            reference = serialize(font)
            # Activate the existing upstream lookups through default-on ccmp.
            # No outlines are redrawn. Lookup order follows the upstream GSUB order.
            records = font['GSUB'].table.FeatureList.FeatureRecord
            defaults = next(r.Feature for r in records if r.FeatureTag == 'ccmp')
            indexes = set(defaults.LookupListIndex)
            for record in records:
                if record.FeatureTag in FEATURES:
                    indexes.update(record.Feature.LookupListIndex)
            defaults.LookupListIndex = sorted(indexes)
            defaults.LookupCount = len(indexes)
            runtime = f'Inter{optical}{style}'
            names = font['name']
            # Distinguish the feature-default derivative from upstream Inter.
            for record in list(names.names):
                if record.nameID in (1, 2, 3, 4, 6, 16, 17):
                    names.names.remove(record)
            for name_id, value in {1: runtime, 2: 'Regular', 3: f'Bey Inter 4.1 {runtime}',
                                   4: f'Bey Inter {optical} {style}', 6: runtime,
                                   16: f'Bey Inter {optical}', 17: style}.items():
                names.setName(value, name_id, 3, 1, 0x409)
                names.setName(value, name_id, 1, 0, 0)
            result = serialize(font)
            for sample in SAMPLES:
                expected = shape(reference, sample, FEATURES)
                assert shape(result, sample) == expected, (runtime, sample, 'defaults differ')
                assert shape(result, sample, FEATURES) == expected, (runtime, sample, 'not idempotent')
            digits = shape(result, '0123456789')
            assert len({item[1] for item in digits}) == 1, 'Digits must be tabular'
            zero_id = digits[0][0]
            zero_name = font.getGlyphName(zero_id)
            assert 'slash' in zero_name.lower(), zero_name
            cmap = font.getBestCmap()
            # Inter has no full-width yen. Alias it to its own yen, preserving
            # wallet currency coverage without importing another typeface.
            for table in font['cmap'].tables:
                if table.isUnicode():
                    table.cmap[0xFFE5] = cmap[0x00A5]
            result = serialize(font)
            filename = f'Inter{optical}-{style}.ttf'
            (ASSETS / filename).write_bytes(result)
            manifest['fonts'][filename] = {'sha256': hashlib.sha256(result).hexdigest(),
                                          'weight': weight, 'opticalSize': size,
                                          'digitAdvance': digits[0][1], 'zeroGlyph': zero_name,
                                          'defaultLookups': sorted(indexes)}
            print(f'{filename}: opsz={size}, weight={weight}, zero={zero_name}')
    (ASSETS / 'inter-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    license_text = urlopen('https://raw.githubusercontent.com/rsms/inter/v4.1/LICENSE.txt').read()
    (ASSETS / 'Inter-OFL.txt').write_bytes(license_text)


if __name__ == '__main__':
    prepare()
