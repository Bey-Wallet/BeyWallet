import fs from 'fs';
import path from 'path';

jest.mock('@expo/config-plugins', () => ({
  withAndroidManifest: (config: any, action: (value: any) => any) => {
    config.manifestAction = action;
    return config;
  },
  withMainActivity: (config: any, action: (value: any) => any) => {
    config.activityAction = action;
    return config;
  },
  withDangerousMod: (config: any) => config,
}));

const plugin = require('../../plugins/withHce');
const registered = plugin({});

it('registers NDEF Text and payment URIs independently and survives repeated prebuilds', async () => {
  const activity: any = { $: { 'android:name': '.MainActivity' } };
  const config = {
    modResults: { manifest: { application: [{ activity: [activity] }] } },
  };
  await registered.manifestAction(config);
  await registered.manifestAction(config);
  const filters = activity['intent-filter'];
  expect(filters).toHaveLength(5);
  expect(filters.map((item: any) => item.data[0].$)).toEqual([
    { 'android:mimeType': 'text/plain' },
    { 'android:scheme': 'cashu' },
    { 'android:scheme': 'lightning' },
    { 'android:scheme': 'creq' },
    { 'android:scheme': 'bitcoin' },
  ]);
  expect(
    filters.every(
      (item: any) => item.action[0].$['android:name'] === 'android.nfc.action.NDEF_DISCOVERED',
    ),
  ).toBe(true);
});

it('routes both cold and warm NDEF launches to the reader without putting the payload in a URL', () => {
  const config = {
    modResults: {
      language: 'kt',
      contents:
        'package example\nclass MainActivity : ReactActivity() {\n  override fun onCreate(savedInstanceState: Bundle?) {\n    super.onCreate(null)\n  }\n}',
    },
  };
  registered.activityAction(config);
  const source = config.modResults.contents;
  expect(source).toContain('routeNfcIntent(intent)\n    super.onCreate(null)');
  expect(source).toContain('routeNfcIntent(intent)\n    super.onNewIntent(intent)');
  expect(source).toContain('incoming?.action == NfcAdapter.ACTION_NDEF_DISCOVERED');
  expect(source).toContain('Uri.parse("bey-wallet:///(modals)/nfc-receive")');
  expect(source).toContain(
    'incoming.getStringExtra("bey.nfc.launchId") ?: UUID.randomUUID().toString()',
  );
  expect(source).toContain('incoming.putExtra("bey.nfc.launchId", launchId)');
  expect(source).toContain('appendQueryParameter("launchId", launchId)');
  expect(registered.activityAction(config).modResults.contents).toBe(source);
});

it('keeps the checked-in Android project registered for Text records and NFC reader launches', () => {
  const root = path.resolve(__dirname, '../..');
  const manifest = fs.readFileSync(
    path.join(root, 'android/app/src/main/AndroidManifest.xml'),
    'utf8',
  );
  expect(manifest).toMatch(/NDEF_DISCOVERED[^]*?android:mimeType="text\/plain"/);
  const activity = fs.readFileSync(
    path.join(root, 'android/app/src/main/java/com/thehussein01/Bey/MainActivity.kt'),
    'utf8',
  );
  expect(activity).toContain('routeNfcIntent(intent)\n    super.onCreate(null)');
  expect(activity).toContain('routeNfcIntent(intent)\n    super.onNewIntent(intent)');
  expect(activity).toContain(
    'incoming.getStringExtra("bey.nfc.launchId") ?: UUID.randomUUID().toString()',
  );
});

it('upgrades the legacy constant NFC intent without duplicating activity methods', () => {
  const withHce = require('../../plugins/withHce');
  const registered = withHce({});
  const config = {
    modResults: {
      language: 'kt',
      contents: `package example
class MainActivity : ReactActivity() {
  private fun routeNfcIntent(incoming: Intent?) {
    if (incoming?.action == NfcAdapter.ACTION_NDEF_DISCOVERED) {
      incoming.data = Uri.parse("bey-wallet:///(modals)/nfc-receive")
    }
  }
  override fun onCreate(savedInstanceState: Bundle?) {
    routeNfcIntent(intent)
    super.onCreate(null)
  }
}`,
    },
  };
  const source = registered.activityAction(config).modResults.contents;
  expect(source).toContain('appendQueryParameter("launchId", launchId)');
  expect(source.match(/private fun routeNfcIntent/g)).toHaveLength(1);
  expect(registered.activityAction(config).modResults.contents).toBe(source);
});
