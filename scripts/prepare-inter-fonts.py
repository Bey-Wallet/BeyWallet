"""Prepare default-optical-size Inter with the approved character features.

python scripts/prepare-inter-fonts.py --source <Inter-4.1.zip>
Requires FontTools (the existing font preparation tool). No glyph outlines are redrawn.
"""

import argparse
import hashlib
import json
import io
from pathlib import Path
from zipfile import ZipFile
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'src/assets/fonts'
SOURCE_HASH = '9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e'
WEIGHTS = {'Regular': 400, 'Medium': 500, 'SemiBold': 600}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    args = parser.parse_args()
    if hashlib.sha256(args.source.read_bytes()).hexdigest() != SOURCE_HASH:
        raise ValueError('Expected the approved upstream Inter-4.1.zip')
    manifest = {
        'source': 'Inter 4.1 / extras/ttf / Inter',
        'sourceUrl': 'https://github.com/rsms/inter/releases/tag/v4.1',
        'sourceSha256': SOURCE_HASH,
        'features': ['ss02 without zero', 'cv01'],
        'numeralMode': 'proportional',
        'opticalSize': 14,
        'fonts': {},
    }
    ASSETS.mkdir(parents=True, exist_ok=True)
    with ZipFile(args.source) as archive:
        for style, weight in WEIGHTS.items():
            filename = f'Inter-{style}.ttf'
            original = archive.read(f'extras/ttf/{filename}')
            font = TTFont(io.BytesIO(original), recalcTimestamp=False)
            features = {r.FeatureTag: r.Feature for r in font['GSUB'].table.FeatureList.FeatureRecord}
            lookups = font['GSUB'].table.LookupList.Lookup
            for index in features['ss02'].LookupListIndex:
                for table in lookups[index].SubTable:
                    table.mapping = {
                        source: target for source, target in table.mapping.items()
                        if 'zero' not in source.lower() and 'zero' not in target.lower()
                    }
            enabled = sorted({
                index for tag in ['ss02', 'cv01']
                for index in features[tag].LookupListIndex
            })
            defaults = features['ccmp']
            defaults.LookupListIndex = sorted(set(defaults.LookupListIndex) | set(enabled))
            defaults.LookupCount = len(defaults.LookupListIndex)
            def apply_features(glyph_names):
                result = list(glyph_names)
                for index in enabled:
                    assert lookups[index].LookupType == 1
                    for table in lookups[index].SubTable:
                        result = [table.mapping.get(name, name) for name in result]
                return result
            cmap = font.getBestCmap()
            digits = apply_features([cmap[ord(char)] for char in '0123456789'])
            advances = [font['hmtx'][name][0] for name in digits]
            assert len(set(advances)) > 1, 'The current preview must use proportional numerals'
            assert 'slash' not in digits[0] and 'dot' not in digits[0]
            sample = apply_features([cmap[ord(char)] for char in 'Il01!?,.:;ß'])
            assert apply_features(sample) == sample, 'Feature application must be idempotent'
            runtime_family = f'Inter{style}'
            for record in list(font['name'].names):
                if record.nameID in (1, 2, 3, 4, 6, 16, 17):
                    font['name'].removeNames(record.nameID, record.platformID, record.platEncID, record.langID)
            for name_id, value in {
                1: runtime_family, 2: 'Regular', 3: f'Bey Inter 4.1 {runtime_family}',
                4: f'Bey Inter {style}', 6: runtime_family,
                16: 'Bey Inter', 17: style,
            }.items():
                font['name'].setName(value, name_id, 3, 1, 0x409)
                font['name'].setName(value, name_id, 1, 0, 0)
            output = io.BytesIO()
            font.save(output)
            data = output.getvalue()
            (ASSETS / filename).write_bytes(data)
            manifest['fonts'][filename] = {
                'runtimeFamily': runtime_family,
                'weight': weight,
                'sourceSha256': hashlib.sha256(original).hexdigest(),
                'sha256': hashlib.sha256(data).hexdigest(),
                'defaultLookups': defaults.LookupListIndex,
                'digitGlyphs': digits,
                'disambiguationGlyphs': dict(zip('Il01!?,.:;ß', sample)),
                'digitAdvances': advances,
            }
        license_data = archive.read('LICENSE.txt')
        (ASSETS / 'Inter-OFL.txt').write_bytes(license_data)
        manifest['licenseSha256'] = hashlib.sha256(license_data).hexdigest()
    (ASSETS / 'inter-manifest.json').write_text(
        json.dumps(manifest, indent=2) + '\n', encoding='utf-8',
    )
    print('Prepared 3 Inter faces: opsz 14, proportional figures, ss02 without zero, cv01')


if __name__ == '__main__':
    main()
