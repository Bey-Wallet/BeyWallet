const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function applyManifest(manifest) {
  const application = manifest.manifest.application[0];
  const main = application.activity.find((activity) =>
    activity.$['android:name'].endsWith('MainActivity'),
  );
  if (!main) throw new Error('App shortcuts require MainActivity');
  main['meta-data'] ??= [];
  if (!main['meta-data'].some((item) => item.$['android:name'] === 'android.app.shortcuts')) {
    main['meta-data'].push({
      $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/bey_shortcuts' },
    });
  }
  if (
    !application.activity.some((activity) =>
      activity.$['android:name'].endsWith('ShortcutActivity'),
    )
  ) {
    application.activity.push({
      $: {
        'android:name': '.ShortcutActivity',
        'android:exported': 'true',
        'android:theme': '@android:style/Theme.NoDisplay',
        'android:taskAffinity': '',
        'android:excludeFromRecents': 'true',
        'android:noHistory': 'true',
      },
    });
  }
  return manifest;
}

function writeShortcutFiles(projectRoot, packageName) {
  if (!/^[a-zA-Z_]\w*(\.[a-zA-Z_]\w*)+$/.test(packageName))
    throw new Error('Invalid Android package');
  const main = path.join(projectRoot, 'android/app/src/main');
  const files = {
    'res/xml/bey_shortcuts.xml': `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <shortcut android:shortcutId="scan" android:enabled="true" android:icon="@drawable/ic_shortcut_scan" android:shortcutShortLabel="@string/shortcut_scan">
    <intent android:action="android.intent.action.VIEW" android:targetPackage="${packageName}" android:targetClass="${packageName}.ShortcutActivity" android:data="bey-wallet:///shortcut/scan" />
  </shortcut>
  <shortcut android:shortcutId="receive" android:enabled="true" android:icon="@drawable/ic_shortcut_receive" android:shortcutShortLabel="@string/shortcut_receive">
    <intent android:action="android.intent.action.VIEW" android:targetPackage="${packageName}" android:targetClass="${packageName}.ShortcutActivity" android:data="bey-wallet:///shortcut/receive" />
  </shortcut>
</shortcuts>
`,
    'res/values/bey_shortcuts.xml': `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="shortcut_scan">Scan</string>
  <string name="shortcut_receive">Receive</string>
</resources>
`,
    'res/drawable/ic_shortcut_scan.xml': `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="#000000" android:pathData="M12,0a12,12 0,1 0,0 24a12,12 0,1 0,0 -24Z" />
  <group android:scaleX="0.75" android:scaleY="0.75" android:translateX="3" android:translateY="3">
  <path android:fillColor="@android:color/transparent" android:strokeColor="#FFFFFF" android:strokeWidth="2" android:strokeLineCap="round" android:strokeLineJoin="round" android:pathData="M8,3H3V8M16,3H21V8M21,16V21H16M8,21H3V16M7,7H10V10H7ZM14,7H17V10H14ZM7,14H10V17H7ZM14,14H17V17H14Z" />
  </group>
</vector>
`,
    'res/drawable/ic_shortcut_receive.xml': `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="#000000" android:pathData="M12,0a12,12 0,1 0,0 24a12,12 0,1 0,0 -24Z" />
  <group android:scaleX="0.75" android:scaleY="0.75" android:translateX="3" android:translateY="3">
  <path android:fillColor="@android:color/transparent" android:strokeColor="#FFFFFF" android:strokeWidth="2" android:strokeLineCap="round" android:strokeLineJoin="round" android:pathData="M12,3V15M7,10L12,15L17,10M4,16V21H20V16" />
  </group>
</vector>
`,
    [`java/${packageName.replaceAll('.', '/')}/ShortcutActivity.kt`]: `package ${packageName}

import android.app.Activity
import android.content.Intent
import android.os.Bundle

/** Keep launcher shortcut CLEAR_TASK flags out of the wallet's existing task. */
class ShortcutActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val uri = intent?.data
    if (uri?.scheme == "bey-wallet" && uri.host.isNullOrEmpty() &&
        uri.query == null && uri.fragment == null &&
        (uri.path == "/shortcut/scan" || uri.path == "/shortcut/receive")) {
      startActivity(Intent(this, MainActivity::class.java).apply {
        action = Intent.ACTION_VIEW
        data = uri
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
      })
    }
    finish()
  }
}
`,
  };
  for (const [relative, contents] of Object.entries(files)) {
    const destination = path.join(main, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, contents);
  }
}

module.exports = function withAppShortcuts(config) {
  config = withAndroidManifest(config, (mod) => {
    applyManifest(mod.modResults);
    return mod;
  });
  return withDangerousMod(config, [
    'android',
    (mod) => {
      writeShortcutFiles(mod.modRequest.projectRoot, mod.android.package);
      return mod;
    },
  ]);
};
module.exports.applyManifest = applyManifest;
module.exports.writeShortcutFiles = writeShortcutFiles;
