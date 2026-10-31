import fs from 'fs';
import os from 'os';
import path from 'path';
import { XML } from '@expo/config-plugins';
const parseStringPromise = XML.parseXMLAsync;
const plugin = require('../../plugins/withAppShortcuts');
const root = path.resolve(__dirname, '../..');
it('registers shortcuts on the launcher activity once across repeated prebuilds', () => {
  const main: any = { $: { 'android:name': '.MainActivity' } };
  const manifest: any = { manifest: { application: [{ activity: [main] }] } };
  plugin.applyManifest(manifest);
  plugin.applyManifest(manifest);
  expect(main['meta-data']).toHaveLength(1);
  const activity = manifest.manifest.application[0].activity;
  expect(activity).toHaveLength(2);
  expect(activity[1].$).toMatchObject({ 'android:taskAffinity': '', 'android:noHistory': 'true' });
});
it('generates valid resources and safe task forwarding reproducibly', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'bey-shortcuts-'));
  try {
    plugin.writeShortcutFiles(temporary, 'com.thehussein01.Bey');
    const files = [
      'res/xml/bey_shortcuts.xml',
      'res/values/bey_shortcuts.xml',
      'res/drawable/ic_shortcut_scan.xml',
      'res/drawable/ic_shortcut_receive.xml',
      'java/com/thehussein01/Bey/ShortcutActivity.kt',
    ];
    for (const file of files) {
      const generated = fs.readFileSync(path.join(temporary, 'android/app/src/main', file), 'utf8');
      plugin.writeShortcutFiles(temporary, 'com.thehussein01.Bey');
      expect(generated).toBe(
        fs.readFileSync(path.join(temporary, 'android/app/src/main', file), 'utf8'),
      );
      if (file.endsWith('.xml')) await parseStringPromise(generated);
      else {
        expect(generated).toContain('Intent.FLAG_ACTIVITY_SINGLE_TOP');
        expect(generated).not.toContain('Intent.FLAG_ACTIVITY_CLEAR_TASK');
        expect(generated).toContain('uri.query == null && uri.fragment == null');
      }
    }
    const shortcuts: any = await parseStringPromise(
      fs.readFileSync(
        path.join(temporary, 'android/app/src/main/res/xml/bey_shortcuts.xml'),
        'utf8',
      ),
    );
    expect(
      shortcuts.shortcuts.shortcut.map((entry: any) => entry.intent[0].$['android:data']),
    ).toEqual(['bey-wallet:///shortcut/scan', 'bey-wallet:///shortcut/receive']);
    const nativeManifest = path.join(root, 'android/app/src/main/AndroidManifest.xml');
    if (fs.existsSync(nativeManifest)) {
      const manifest: any = await parseStringPromise(fs.readFileSync(nativeManifest, 'utf8'));
      const main = manifest.manifest.application[0].activity.find(
        (entry: any) => entry.$['android:name'] === '.MainActivity',
      );
      expect(
        main['meta-data'].some((entry: any) => entry.$['android:name'] === 'android.app.shortcuts'),
      ).toBe(true);
    }
  } finally {
    // Only the exact temporary directory created above is removed.
    if (
      !path.resolve(temporary).startsWith(`${path.resolve(os.tmpdir())}${path.sep}`) ||
      !path.basename(temporary).startsWith('bey-shortcuts-')
    )
      throw new Error('Unexpected test directory');
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
