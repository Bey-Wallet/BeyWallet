const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const output = path.resolve('.tmp/hce-tests');
fs.mkdirSync(output, { recursive: true });
// Android/lifecycle adapters for JVM tests. Production service, application selection,
// file transport and diagnostics are compiled unchanged; no Android SDK is needed.
const stubs = {
  'android/app/Activity.java': `package android.app;
    public class Activity { public boolean resumed = true; public boolean isResumed() { return resumed; } }`,
  'android/content/ComponentName.java': `package android.content;
    public class ComponentName {
      public final String name;
      public ComponentName(Context context, Class<?> type) { name = type.getName(); }
    }`,
  'android/content/pm/PackageManager.java': `package android.content.pm;
    public class PackageManager {
      public static final int COMPONENT_ENABLED_STATE_ENABLED=1, COMPONENT_ENABLED_STATE_DISABLED=2, DONT_KILL_APP=1;
      public static boolean enabled;
      public void setComponentEnabledSetting(android.content.ComponentName component, int state, int flags) { enabled = state == 1; }
    }`,
  'android/nfc/NfcAdapter.java': `package android.nfc;
    public class NfcAdapter { public static NfcAdapter getDefaultAdapter(android.content.Context context) { return new NfcAdapter(); } }`,
  'android/nfc/cardemulation/CardEmulation.java': `package android.nfc.cardemulation;
    public class CardEmulation {
      public static android.content.ComponentName preferred;
      public static boolean allowed = true;
      public static final String defaultWallet = "existing_wallet";
      public static CardEmulation getInstance(android.nfc.NfcAdapter adapter) { return new CardEmulation(); }
      public boolean setPreferredService(android.app.Activity activity, android.content.ComponentName component) {
        if (!activity.isResumed() || !allowed) return false;
        preferred = component; return true;
      }
      public boolean unsetPreferredService(android.app.Activity activity) { preferred = null; return true; }
    }`,
  'android/os/Build.java': `package android.os;
    public class Build { public static final String MODEL="test"; public static class VERSION { public static final String RELEASE="16"; } }`,
  'androidx/annotation/NonNull.java': 'package androidx.annotation; public @interface NonNull {}',
  'com/facebook/react/bridge/ReactMethod.java':
    'package com.facebook.react.bridge; public @interface ReactMethod {}',
  'com/facebook/react/bridge/Promise.java': `package com.facebook.react.bridge;
    public interface Promise { void resolve(Object value); void reject(String code, String message); }`,
  'com/facebook/react/bridge/LifecycleEventListener.java': `package com.facebook.react.bridge;
    public interface LifecycleEventListener { void onHostResume(); void onHostPause(); void onHostDestroy(); }`,
  'com/facebook/react/bridge/UiThreadUtil.java': `package com.facebook.react.bridge;
    public class UiThreadUtil { public static void runOnUiThread(Runnable work) { work.run(); } }`,
  'com/facebook/react/bridge/ReactApplicationContext.java': `package com.facebook.react.bridge;
    public class ReactApplicationContext extends android.content.Context {
      public android.app.Activity activity = new android.app.Activity();
      public LifecycleEventListener listener;
      public android.app.Activity getCurrentActivity() { return activity; }
      public void addLifecycleEventListener(LifecycleEventListener listener) { this.listener = listener; }
      public void pause() { activity.resumed = false; if (listener != null) listener.onHostPause(); }
    }`,
  'com/facebook/react/bridge/ReactContextBaseJavaModule.java': `package com.facebook.react.bridge;
    public class ReactContextBaseJavaModule {
      private final ReactApplicationContext context;
      public ReactContextBaseJavaModule(ReactApplicationContext context) { this.context = context; }
      public android.app.Activity getCurrentActivity() { return context.getCurrentActivity(); }
      public String getName() { return ""; }
      public java.util.Map<String,Object> getConstants() { return null; }
    }`,
  'com/facebook/react/bridge/ReadableMap.java': `package com.facebook.react.bridge;
    public interface ReadableMap { String getString(String key); boolean getBoolean(String key); }`,
  'com/facebook/react/bridge/WritableMap.java': `package com.facebook.react.bridge;
    public class WritableMap {
      public void putString(String key, String value) {} public void putDouble(String key, double value) {}
      public void putBoolean(String key, boolean value) {}
    }`,
  'com/facebook/react/bridge/Arguments.java': `package com.facebook.react.bridge;
    public class Arguments { public static WritableMap createMap() { return new WritableMap(); } }`,
  'org/json/JSONObject.java': `package org.json;
    public class JSONObject { public String getString(String key) { return ""; } public double getDouble(String key) { return 0; } }`,
  'com/reactnativehce/managers/EventManager.java': `package com.reactnativehce.managers;
    public class EventManager {
      public static final String EVENT_STATE="hceState";
      public static EventManager getInstance(android.content.Context context) { return new EventManager(); }
      public void addListener(String name) {} public void clear() {}
    }`,
  'android/content/Context.java': `package android.content;
    public class Context {
      public Context getApplicationContext() { return this; }
      public android.content.pm.ApplicationInfo getApplicationInfo() { return new android.content.pm.ApplicationInfo(); }
      public android.content.pm.PackageManager getPackageManager() { return new android.content.pm.PackageManager(); }
    }`,
  'android/content/pm/ApplicationInfo.java': `package android.content.pm;
    public class ApplicationInfo { public static final int FLAG_DEBUGGABLE = 2; public int flags = 2; }`,
  'android/os/Bundle.java': 'package android.os; public class Bundle {}',
  'android/util/Log.java': 'package android.util; public class Log {}',
  'android/nfc/cardemulation/HostApduService.java': `package android.nfc.cardemulation;
    public abstract class HostApduService extends android.content.Context {
      public void onCreate() {} public void onDestroy() {}
      public abstract byte[] processCommandApdu(byte[] command, android.os.Bundle extras);
      public abstract void onDeactivated(int reason);
    }`,
  'com/reactnativehce/managers/PrefManager.java': `package com.reactnativehce.managers;
    public class PrefManager {
      public static final PrefManager INSTANCE = new PrefManager();
      public boolean enabled = true;
      public static PrefManager getInstance(android.content.Context context) { return INSTANCE; }
      public boolean getEnabled() { return enabled; }
      public boolean exists() { return false; }
      public void setEnabled(boolean value) { enabled = value; }
      public void setType(String value) {} public void setContent(String value) {}
      public void setWritable(boolean value) {} public void setRequestId(String value) {}
      public org.json.JSONObject getPending() { return null; }
      public boolean acknowledgePending(String id) { return false; }
      public String getRequestId() { return "synthetic-request-identifier"; }
      public String getContent() { return "cashuB_SYNTHETIC_BEARER_SECRET"; }
      public String getType() { return "text"; }
      public boolean getWritable() { return true; }
      public boolean savePending(String request, String content) { return false; }
    }`,
  'com/reactnativehce/managers/HceViewModel.java': `package com.reactnativehce.managers;
    public class HceViewModel {
      public static final String HCE_STATE_CONNECTED="connected", HCE_STATE_DISCONNECTED="disconnected",
        HCE_STATE_READ="read", HCE_STATE_WRITE_FULL="writeFull", HCE_STATE_ENABLED="enabled",
        HCE_STATE_DISABLED="disabled", HCE_STATE_WRITE_PARTIAL="partial", HCE_STATE_UPDATE_APPLICATION="update";
      public static HceViewModel getInstance(android.content.Context context) { return new HceViewModel(); }
      public HceViewModel getLastState() { return this; } public void setValue(String state) {} public void postValue(String state) {}
    }`,
  'com/reactnativehce/apps/nfc/NdefEntity.java': `package com.reactnativehce.apps.nfc;
    public class NdefEntity {
      private final String content;
      public NdefEntity(String type, String content) { this.content = content; }
      public byte[] getNdefContent() {
        byte[] body = content.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] file = new byte[body.length + 2]; file[1] = (byte)body.length;
        System.arraycopy(body, 0, file, 2, body.length); return file;
      }
      public String getContent() { return content; }
      public static NdefEntity fromBytes(byte[] bytes) { return new NdefEntity("text", new String(bytes)); }
    }`,
};
const stubPaths = Object.entries(stubs).map(([name, source]) => {
  const target = path.join(output, 'stubs', name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source);
  return target;
});
const nativeRoot = 'node_modules/react-native-hce/android/src/main/java/com/reactnativehce/';
const executable = (name) =>
  process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, 'bin', name + (process.platform === 'win32' ? '.exe' : ''))
    : name;
for (const [name, args] of [
  [
    'javac',
    [
      '-d',
      output,
      ...stubPaths,
      ...[
        'Diagnostics.java',
        'HceModule.java',
        'IHCEApplication.java',
        'utils/BinaryUtils.java',
        'utils/ApduHelper.java',
        'services/CardService.java',
        'apps/nfc/NFCTagType4.java',
        'apps/nfc/Type4File.java',
      ].map((file) => nativeRoot + file),
      'tests/unit/native/Type4FileTest.java',
      'tests/unit/native/HceDiscoveryTest.java',
      'tests/unit/native/HceRoutingTest.java',
    ],
  ],
  ['java', ['-cp', output, 'Type4FileTest']],
  ['java', ['-cp', output, 'HceDiscoveryTest']],
  ['java', ['-cp', output, 'com.reactnativehce.HceRoutingTest']],
]) {
  const result = spawnSync(executable(name), args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
