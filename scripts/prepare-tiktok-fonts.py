"""Prepare TikTok Sans v4.000 16pt static UI faces with tabular numerals.

python scripts/prepare-tiktok-fonts.py --source <TikTokSans-v4.000.zip>
Uses the existing FontTools installation. No outlines are redrawn.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
from zipfile import ZipFile
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'src/assets/fonts'
WEIGHTS = {'Regular': 400, 'Medium': 500, 'SemiBold': 600}
SOURCE_HASH = 'b238e0e794735142896025ea1f091a1a9ca49a9b26ca77ab5dc2ef5681b80243'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    args = parser.parse_args()
    source = args.source.read_bytes()
    if hashlib.sha256(source).hexdigest() != SOURCE_HASH:
        raise ValueError('Expected the official TikTokSans-v4.000.zip')
    manifest = {
        'sourceUrl': 'https://github.com/tiktok/TikTokSans/releases/tag/v4.000',
        'sourceSha256': hashlib.sha256(source).hexdigest(),
        'opticalSize': 16, 'features': ['tnum'], 'fonts': {},
    }
    with ZipFile(io.BytesIO(source)) as archive:
        for style, weight in WEIGHTS.items():
            original = archive.read(f'TikTokSans-v4.000/fonts/ttf/TikTokSans16pt-{style}.ttf')
            font = TTFont(io.BytesIO(original), recalcTimestamp=False)
            features = {record.FeatureTag: record.Feature for record in font['GSUB'].table.FeatureList.FeatureRecord}
            tabular = features['tnum'].LookupListIndex
            defaults = features['ccmp']
            defaults.LookupListIndex = sorted(set(defaults.LookupListIndex) | set(tabular))
            defaults.LookupCount = len(defaults.LookupListIndex)
            cmap = font.getBestCmap()
            digits = [cmap[ord(char)] for char in '0123456789']
            for index in tabular:
                lookup = font['GSUB'].table.LookupList.Lookup[index]
                assert lookup.LookupType == 1
                for table in lookup.SubTable:
                    digits = [table.mapping.get(name, name) for name in digits]
            advances = [font['hmtx'][name][0] for name in digits]
            assert len(set(advances)) == 1
            missing = [char for char in '$€£¥₿₹₽₩₺₦฿₱₫złKč' if ord(char) not in cmap]
            assert not missing, f'Missing currency glyphs: {missing}'
            family = f'TikTokSans{style}'
            internal_family = f'BeyTikTokSans{style}'
            for record in list(font['name'].names):
                if record.nameID in (1, 2, 3, 4, 6, 16, 17):
                    font['name'].removeNames(record.nameID, record.platformID, record.platEncID, record.langID)
            for name_id, value in {
                1: internal_family, 2: 'Regular', 3: f'Bey TikTok Sans 4.000 {style}',
                4: f'Bey TikTok Sans {style}', 6: internal_family,
                16: 'Bey TikTok Sans', 17: style,
            }.items():
                font['name'].setName(value, name_id, 3, 1, 0x409)
                font['name'].setName(value, name_id, 1, 0, 0)
            buffer = io.BytesIO()
            font.save(buffer)
            data = buffer.getvalue()
            filename = f'TikTokSans-{style}.ttf'
            (ASSETS / filename).write_bytes(data)
            manifest['fonts'][filename] = {
                'runtimeFamily': family, 'weight': weight,
                'sha256': hashlib.sha256(data).hexdigest(),
                'sourceSha256': hashlib.sha256(original).hexdigest(),
                'defaultLookups': defaults.LookupListIndex, 'digitAdvances': advances,
            }
        license_data = archive.read('TikTokSans-v4.000/OFL.txt')
        (ASSETS / 'TikTokSans-OFL.txt').write_bytes(license_data)
        manifest['licenseSha256'] = hashlib.sha256(license_data).hexdigest()
    (ASSETS / 'tiktok-sans-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print('Prepared TikTok Sans 400/500/600, 16pt optical cut, tabular digits, default character forms')


if __name__ == '__main__':
    main()
