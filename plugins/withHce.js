const { withAndroidManifest, withDangerousMod, withMainActivity } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withHce = (config) => {
  // 1. Modify AndroidManifest.xml
  config = withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const application = androidManifest.manifest.application[0];

    // Add Service
    if (!application.service) {
      application.service = [];
    }

    const hceService = {
      $: {
        'android:name': 'com.reactnativehce.services.CardService',
        'android:exported': 'true',
        'android:enabled': 'false',
        'android:permission': 'android.permission.BIND_NFC_SERVICE',
      },
      'intent-filter': [
        {
          action: [{ $: { 'android:name': 'android.nfc.cardemulation.action.HOST_APDU_SERVICE' } }],
          category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
        },
      ],
      'meta-data': [
        {
          $: {
            'android:name': 'android.nfc.cardemulation.host_apdu_service',
            'android:resource': '@xml/aid_list',
          },
        },
      ],
    };

    // Check if already exists
    const exists = application.service.some(
      (s) => s['$']['android:name'] === 'com.reactnativehce.services.CardService',
    );
    if (!exists) {
      application.service.push(hceService);
    }

    // Add Permissions
    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }
    const permissions = ['android.permission.NFC'];
    permissions.forEach((p) => {
      if (
        !androidManifest.manifest['uses-permission'].some((up) => up['$']['android:name'] === p)
      ) {
        androidManifest.manifest['uses-permission'].push({ $: { 'android:name': p } });
      }
    });

    // Add Features
    if (!androidManifest.manifest['uses-feature']) {
      androidManifest.manifest['uses-feature'] = [];
    }
    const features = [
      { name: 'android.hardware.nfc.hce', required: 'false' },
      { name: 'android.hardware.nfc', required: 'false' },
    ];
    features.forEach((f) => {
      if (
        !androidManifest.manifest['uses-feature'].some((uf) => uf['$']['android:name'] === f.name)
      ) {
        androidManifest.manifest['uses-feature'].push({
          $: { 'android:name': f.name, 'android:required': f.required },
        });
      }
    });

    // NDEF Text records dispatch as text/plain, separately from URI records.
    const activity = application.activity.find(
      (item) => item.$['android:name'] === '.MainActivity',
    );
    if (!activity) throw new Error('Cannot register NFC: MainActivity is missing');
    const filters = (activity['intent-filter'] ??= []);
    const registrations = [
      { 'android:mimeType': 'text/plain' },
      ...['cashu', 'lightning', 'creq', 'bitcoin'].map((scheme) => ({ 'android:scheme': scheme })),
    ];
    for (const data of registrations) {
      const exists = filters.some(
        (filter) =>
          filter.action?.some(
            (action) => action.$['android:name'] === 'android.nfc.action.NDEF_DISCOVERED',
          ) &&
          filter.data?.some((item) =>
            Object.entries(data).every(([key, value]) => item.$[key] === value),
          ),
      );
      if (!exists) {
        filters.push({
          action: [{ $: { 'android:name': 'android.nfc.action.NDEF_DISCOVERED' } }],
          category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
          data: [{ $: data }],
        });
      }
    }

    return config;
  });

  // Open the reader screen rather than routing an NFC URI as a QR payment.
  // Do not forward bearer data in a URL; a cold launch may require another tap.
  config = withMainActivity(config, (config) => {
    if (config.modResults.language !== 'kt') throw new Error('NFC launch routing requires Kotlin');
    let source = config.modResults.contents;
    if (!source.includes('private fun routeNfcIntent(')) {
      for (const name of ['android.content.Intent', 'android.net.Uri', 'android.nfc.NfcAdapter']) {
        source = source.replace(/^(package .*\r?\n)/, `$1import ${name}\n`);
      }
      source = source.replace(
        '    super.onCreate(null)',
        '    routeNfcIntent(intent)\n    super.onCreate(null)',
      );
      if (!source.includes('    routeNfcIntent(intent)'))
        throw new Error('Cannot add NFC launch routing');
      if (source.includes('override fun onNewIntent(')) {
        throw new Error('MainActivity already owns onNewIntent; integrate NFC routing explicitly');
      }
      source = source.replace(
        'class MainActivity : ReactActivity() {',
        `class MainActivity : ReactActivity() {
  private fun routeNfcIntent(incoming: Intent?) {
    if (incoming?.action == NfcAdapter.ACTION_NDEF_DISCOVERED) {
      incoming.data = Uri.parse("bey-wallet:///(modals)/nfc-receive")
    }
  }

  override fun onNewIntent(intent: Intent) {
    routeNfcIntent(intent)
    super.onNewIntent(intent)
    setIntent(intent)
  }
`,
      );
    }
    config.modResults.contents = source;
    return config;
  });

  // 2. Add aid_list.xml
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const androidResXmlPath = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/res/xml',
      );

      if (!fs.existsSync(androidResXmlPath)) {
        fs.mkdirSync(androidResXmlPath, { recursive: true });
      }

      const aidListContent = `<host-apdu-service xmlns:android="http://schemas.android.com/apk/res/android"
                   android:description="@string/app_name"
                   android:requireDeviceUnlock="true">
  <aid-group android:category="other"
             android:description="@string/app_name">
    <aid-filter android:name="D2760000850101" />
  </aid-group>
</host-apdu-service>`;

      const destFile = path.join(androidResXmlPath, 'aid_list.xml');
      fs.writeFileSync(destFile, aidListContent);

      return config;
    },
  ]);

  return config;
};

module.exports = withHce;
