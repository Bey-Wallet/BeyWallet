import com.reactnativehce.Diagnostics;
import com.reactnativehce.services.CardService;
import com.reactnativehce.managers.PrefManager;
import java.util.Arrays;

public class HceDiscoveryTest {
  static void check(boolean value, String label) { if (!value) throw new AssertionError(label); }
  static byte[] send(CardService service, byte... command) {
    return service.processCommandApdu(command, null);
  }
  static void ok(byte[] response) {
    check(response[response.length - 2] == (byte)0x90 && response[response.length - 1] == 0, "Success status");
  }
  public static void main(String[] args) {
    CardService service = new CardService();
    service.onCreate();
    Diagnostics.clear();
    Diagnostics.record(Diagnostics.Event.REQUEST_READY);
    Diagnostics.record(Diagnostics.Event.ADVERTISING_ON);
    byte[] aid = {0,(byte)0xA4,4,0,7,(byte)0xD2,0x76,0,0,(byte)0x85,1,1,0};
    ok(service.processCommandApdu(aid, null));
    ok(send(service, (byte)0, (byte)0xA4, (byte)0, (byte)0x0C, (byte)2, (byte)0xE1, (byte)3));
    byte[] cc = send(service, (byte)0, (byte)0xB0, (byte)0, (byte)0, (byte)15);
    ok(cc);
    check(cc.length == 17 && cc[9] == (byte)0xE1 && cc[10] == 4, "CC advertises NDEF file");
    ok(send(service, (byte)0, (byte)0xA4, (byte)0, (byte)0x0C, (byte)2, (byte)0xE1, (byte)4));
    byte[] length = send(service, (byte)0, (byte)0xB0, (byte)0, (byte)0, (byte)2);
    ok(length);
    int nlen = ((length[0] & 255) << 8) | (length[1] & 255);
    byte[] message = send(service, (byte)0, (byte)0xB0, (byte)0, (byte)2, (byte)nlen);
    ok(message);
    check(message.length == nlen + 2, "Entire message read");
    check(new String(Arrays.copyOf(message, nlen)).equals("cashuB_SYNTHETIC_BEARER_SECRET"), "Synthetic fixture read");
    // Exercise failed durable write, malformed input, deactivation, and application rejection.
    send(service, (byte)0, (byte)0xD6, (byte)0, (byte)0, (byte)3, (byte)0, (byte)1, (byte)42);
    send(service, (byte)0);
    service.onDeactivated(0);
    aid[11] = 9;
    service.processCommandApdu(aid, null);
    PrefManager.INSTANCE.enabled = false;
    service.processCommandApdu(aid, null);
    String report = Diagnostics.report();
    for (String expected : new String[] {"ACTIVATED", "SELECT_APPLICATION", "SELECT_CC", "SELECT_NDEF",
      "READ offset=0 length=2 status=36864", "READ offset=2", "WRITE offset=0 length=3",
      "WRITE_REJECTED", "MALFORMED", "DEACTIVATED", "APPLICATION_REJECTED", "DISABLED"}) {
      check(report.contains(expected), "Missing diagnostic: " + expected);
    }
    check(!report.contains("cashuB") && !report.contains("SYNTHETIC") && !report.contains("identifier"), "No bearer or request data");
    for (int i = 0; i < 300; i++) Diagnostics.record(Diagnostics.Event.READ, i, 1, 0x9000, Diagnostics.Failure.NONE);
    report = Diagnostics.report();
    check(report.split("\n").length == 257 && report.contains("offset=44 ") && !report.contains("offset=43 "), "Latest 256 events");
    Diagnostics.clear();
    Diagnostics.record(Diagnostics.Event.REQUEST_READY);
    check(Diagnostics.report().split("\n").length == 2 && !Diagnostics.report().contains("READ offset"), "New session reset");
    Diagnostics.configure(false);
    Diagnostics.record(Diagnostics.Event.ACTIVATED);
    check(Diagnostics.report().equals("NFC diagnostics v2 enabled=false\n"), "Release diagnostics disabled");
    System.out.println("HCE discovery, failure categories, privacy, buffer limit, reset and release gating passed");
  }
}
