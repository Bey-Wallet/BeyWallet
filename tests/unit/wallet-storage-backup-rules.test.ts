import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let mockManifest: any;
let mockWriteResources: (mod: any) => Promise<any>;
jest.mock('@expo/config-plugins', () => ({
  withAndroidManifest: (config: any, callback: any) => {
    callback({ modResults: mockManifest });
    return config;
  },
  withDangerousMod: (config: any, [, callback]: any) => {
    mockWriteResources = callback;
    return config;
  },
}));

it('excludes wallet databases and SecureStore from cloud and device-transfer backups', async () => {
  mockManifest = { manifest: { application: [{ $: { 'android:allowBackup': 'true' } }] } };
  require('../../plugins/withWalletStorageBackupRules')({});
  expect(mockManifest.manifest.application[0].$).toMatchObject({
    'android:allowBackup': 'false',
    'android:fullBackupContent': '@xml/bey_wallet_backup_rules',
    'android:dataExtractionRules': '@xml/bey_wallet_data_extraction_rules',
  });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bey-wallet-backup-rules-'));
  try {
    await mockWriteResources({ modRequest: { platformProjectRoot: directory } });
    const oldRules = fs.readFileSync(
      path.join(directory, 'app/src/main/res/xml/bey_wallet_backup_rules.xml'),
      'utf8',
    );
    const newRules = fs.readFileSync(
      path.join(directory, 'app/src/main/res/xml/bey_wallet_data_extraction_rules.xml'),
      'utf8',
    );
    for (const content of [
      oldRules,
      ...newRules.matchAll(/<(?:cloud-backup|device-transfer)>([\s\S]*?)<\//g),
    ].map((item) => (typeof item === 'string' ? item : item[1]))) {
      expect(content).toContain('<exclude domain="sharedpref" path="SecureStore" />');
      expect(content).toContain('<exclude domain="file" path="SQLite/" />');
      expect(content).toContain('<exclude domain="database" path="." />');
    }
    expect(newRules).toContain('<cloud-backup>');
    expect(newRules).toContain('<device-transfer>');
  } finally {
    const resolved = path.resolve(directory);
    if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep + 'bey-wallet-backup-rules-'))
      throw new Error('Unexpected temporary test directory.');
    fs.rmSync(resolved, { recursive: true });
  }
});
