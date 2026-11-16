"""Prepare Bey's approved Allo Text/Display faces from the Allo 1.0 variable TTF.

uv run --no-project --with fonttools==4.67.0 --with uharfbuzz==0.57.0 python scripts/prepare-allo-fonts.py --source <AlloVariable.ttf> --license <OFL.txt>
No app dependency is added; the downloaded source folder is never modified.
"""

import argparse
import hashlib
import io
import json
from pathlib import Path

import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'src/assets/fonts'
SOURCE_HASH = 'bc26a56fd707fb463f99a51fba67bfb57ab66c341c710efb7419919de9b85330'
FEATURES = {'tnum': 1, 'cv01': 1, 'cv03': 1, 'cv04': 1}
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


def prepare(source_path, license_path):
    source = source_path.read_bytes()
    assert hashlib.sha256(source).hexdigest() == SOURCE_HASH, 'Unexpected Allo 1.0 source'
    manifest = {
        'source': 'Allo 1.0 / fonts/variable/AlloVariable.ttf',
        'sourceSha256': SOURCE_HASH,
        'roundness': 0,
        'features': list(FEATURES),
        'fonts': {},
    }
    for optical, size in [('Text', 14), ('Display', 32)]:
        for style, weight in WEIGHTS.items():
            font = instantiateVariableFont(TTFont(io.BytesIO(source), recalcTimestamp=False),
                                           {'opsz': size, 'wght': weight, 'ROND': 0}, inplace=True)
            reference = serialize(font)
            records = font['GSUB'].table.FeatureList.FeatureRecord
            defaults = next(r.Feature for r in records if r.FeatureTag == 'ccmp')
            indexes = set(defaults.LookupListIndex)
            for record in records:
                if record.FeatureTag in FEATURES:
                    indexes.update(record.Feature.LookupListIndex)
            defaults.LookupListIndex = sorted(indexes)
            defaults.LookupCount = len(indexes)
            runtime = f'Allo{optical}{style}'
            names = font['name']
            for record in list(names.names):
                if record.nameID in (1, 2, 3, 4, 6, 16, 17):
                    names.names.remove(record)
            for name_id, value in {1: runtime, 2: 'Regular', 3: f'Bey Allo 1.0 {runtime}',
                                   4: f'Bey Allo {optical} {style}', 6: runtime,
                                   16: f'Bey Allo {optical}', 17: style}.items():
                names.setName(value, name_id, 3, 1, 0x409)
                names.setName(value, name_id, 1, 0, 0)
            result = serialize(font)
            for sample in SAMPLES:
                expected = shape(reference, sample, FEATURES)
                assert shape(result, sample) == expected, (runtime, sample, 'defaults differ')
                assert shape(result, sample, FEATURES) == expected, (runtime, sample, 'not idempotent')
            digits = shape(result, '0123456789')
            assert len({item[1] for item in digits}) == 1, 'Digits must be tabular'
            zero_name = font.getGlyphName(digits[0][0])
            one_name = font.getGlyphName(digits[1][0])
            assert zero_name == 'zero.tf', zero_name
            assert one_name == 'one.foot.tf', one_name
            cmap = font.getBestCmap()
            for table in font['cmap'].tables:
                if table.isUnicode():
                    table.cmap[0xFFE5] = cmap[0x00A5]
            assert 'fvar' not in font, 'Runtime fonts must be static'
            result = serialize(font)
            filename = f'Allo{optical}-{style}.ttf'
            (ASSETS / filename).write_bytes(result)
            manifest['fonts'][filename] = {
                'sha256': hashlib.sha256(result).hexdigest(), 'weight': weight,
                'opticalSize': size, 'roundness': 0, 'digitAdvance': digits[0][1],
                'zeroGlyph': zero_name, 'oneGlyph': one_name, 'defaultLookups': sorted(indexes),
            }
            print(f'{filename}: opsz={size}, weight={weight}, ROND=0, tabular/footed-1 verified')
    (ASSETS / 'allo-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (ASSETS / 'Allo-OFL.txt').write_bytes(license_path.read_bytes())


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--license', type=Path, required=True)
    args = parser.parse_args()
    prepare(args.source, args.license)
