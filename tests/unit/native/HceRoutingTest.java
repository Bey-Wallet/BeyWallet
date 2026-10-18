package com.reactnativehce;

import android.content.pm.PackageManager;
import android.nfc.cardemulation.CardEmulation;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.reactnativehce.managers.PrefManager;
import com.reactnativehce.services.CardService;

/** Reproduces the observed shared NDEF AID with no foreground preferred service. */
public class HceRoutingTest {
  static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
  static class Result implements Promise {
    Object value; String error;
    public void resolve(Object value) { this.value = value; }
    public void reject(String code, String message) { error = code; }
  }
  static void start(HceModule module) {
    Result result = new Result(); module.setEnabled(true, result);
    check(Boolean.TRUE.equals(result.value) && result.error == null, "Advertising enabled");
  }
  public static void main(String[] args) {
    ReactApplicationContext context = new ReactApplicationContext();
    HceModule module = new HceModule(context);
    // Several services advertise D2760000850101. Enabling a component alone leaves
    // no selected recipient and the production CardService never sees an APDU.
    start(module);
    check(CardEmulation.preferred != null, "Shared NDEF AID needs a foreground preferred service");
    check(CardEmulation.preferred.name.equals(CardService.class.getName()), "Bey must own foreground routing");
    check(PackageManager.enabled && PrefManager.INSTANCE.enabled, "Advertising remains enabled");
    CardService service = new CardService(); service.onCreate();
    byte[] aid = {0,(byte)0xA4,4,0,7,(byte)0xD2,0x76,0,0,(byte)0x85,1,1,0};
    byte[] response = service.processCommandApdu(aid, null);
    check(response[0] == (byte)0x90, "Routed application selection succeeds");
    module.setEnabled(false, new Result());
    check(CardEmulation.preferred == null && !PackageManager.enabled, "Stopping releases preference and component");
    start(module);
    context.pause();
    check(CardEmulation.preferred == null, "Pausing must release foreground preference");
    Result paused = new Result(); module.setEnabled(true, paused);
    check(paused.error != null && !PackageManager.enabled, "A paused activity cannot claim routing");
    context.activity.resumed = true;
    start(module);
    context.listener.onHostDestroy();
    check(CardEmulation.preferred == null, "Destroying the host releases preference");
    start(module);
    module.setEnabled(false, new Result());
    CardEmulation.allowed = false;
    Result rejected = new Result(); module.setEnabled(true, rejected);
    check(rejected.error != null && !PackageManager.enabled && !PrefManager.INSTANCE.enabled,
      "Rejected preference must not report ready or leave advertising enabled");
    CardEmulation.allowed = true;
    context.activity = null;
    Result missing = new Result(); module.setEnabled(true, missing);
    check(missing.error != null && !PackageManager.enabled, "No foreground activity cannot advertise");
    check(CardEmulation.defaultWallet.equals("existing_wallet"), "Default wallet is unchanged");
    System.out.println("HCE shared-AID routing, pause/stop cleanup, rejected preference and missing activity passed");
  }
}
