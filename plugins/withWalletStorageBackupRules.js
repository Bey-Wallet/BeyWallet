const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

// Keep key material and all SQLite files out of cloud and device-transfer backups.
// Explicit transfer exclusions also cover devices that ignore allowBackup=false.
const exclusions = `    <exclude domain="sharedpref" path="SecureStore" />
    <exclude domain="file" path="SQLite/" />
    <exclude domain="database" path="." />`;

module.exports = (config) => {
  config = withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (!application) throw new Error('Android application manifest is missing.');
    application.$['android:allowBackup'] = 'false';
    application.$['android:fullBackupContent'] = '@xml/bey_wallet_backup_rules';
    application.$['android:dataExtractionRules'] = '@xml/bey_wallet_data_extraction_rules';
    return mod;
  });
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const directory = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(
        path.join(directory, 'bey_wallet_backup_rules.xml'),
        `<?xml version="1.0" encoding="utf-8"?>\n<full-backup-content>\n${exclusions}\n</full-backup-content>\n`,
      );
      await fs.writeFile(
        path.join(directory, 'bey_wallet_data_extraction_rules.xml'),
        `<?xml version="1.0" encoding="utf-8"?>\n<data-extraction-rules>\n  <cloud-backup>\n${exclusions}\n  </cloud-backup>\n  <device-transfer>\n${exclusions}\n  </device-transfer>\n</data-extraction-rules>\n`,
      );
      return mod;
    },
  ]);
};
