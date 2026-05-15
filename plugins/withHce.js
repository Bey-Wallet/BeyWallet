const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
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
      '$': {
        'android:name': 'com.reactnativehce.services.CardService',
        'android:exported': 'true',
        'android:enabled': 'false',
        'android:permission': 'android.permission.BIND_NFC_SERVICE'
      },
      'intent-filter': [
        {
          'action': [{ '$': { 'android:name': 'android.nfc.cardemulation.action.HOST_APDU_SERVICE' } }],
          'category': [{ '$': { 'android:name': 'android.intent.category.DEFAULT' } }]
        }
      ],
      'meta-data': [
        {
          '$': {
            'android:name': 'android.nfc.cardemulation.host_apdu_service',
            'android:resource': '@xml/aid_list'
          }
        }
      ]
    };
    
    // Check if already exists
    const exists = application.service.some(s => s['$']['android:name'] === 'com.reactnativehce.services.CardService');
    if (!exists) {
      application.service.push(hceService);
    }
    
    // Add Permissions
    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }
    const permissions = [
      'android.permission.NFC'
    ];
    permissions.forEach(p => {
      if (!androidManifest.manifest['uses-permission'].some(up => up['$']['android:name'] === p)) {
        androidManifest.manifest['uses-permission'].push({ '$': { 'android:name': p } });
      }
    });
    
    // Add Features
    if (!androidManifest.manifest['uses-feature']) {
      androidManifest.manifest['uses-feature'] = [];
    }
    const features = [
      { name: 'android.hardware.nfc.hce', required: 'false' },
      { name: 'android.hardware.nfc', required: 'false' }
    ];
    features.forEach(f => {
      if (!androidManifest.manifest['uses-feature'].some(uf => uf['$']['android:name'] === f.name)) {
        androidManifest.manifest['uses-feature'].push({ '$': { 'android:name': f.name, 'android:required': f.required } });
      }
    });

    return config;
  });

  // 2. Add aid_list.xml
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const androidResXmlPath = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/res/xml'
      );

      if (!fs.existsSync(androidResXmlPath)) {
        fs.mkdirSync(androidResXmlPath, { recursive: true });
      }

      const aidListContent = `<host-apdu-service xmlns:android="http://schemas.android.com/apk/res/android"
                   android:description="@string/app_name"
                   android:requireDeviceUnlock="false">
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
