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
  static void rejected(byte[] response) {
    check(response.length == 2 && response[0] == (byte)0x6A, "Rejected command status");
  }
  public static void main(String[] args) {
    CardService service = new CardService();
    service.onCreate();
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
    rejected(send(service, (byte)0, (byte)0xD6, (byte)0, (byte)0, (byte)3, (byte)0, (byte)1, (byte)42));
    rejected(send(service, (byte)0));
    service.onDeactivated(0);
    rejected(send(service, (byte)0, (byte)0xB0, (byte)0, (byte)0, (byte)2));
    aid[11] = 9;
    rejected(service.processCommandApdu(aid, null));
    PrefManager.INSTANCE.enabled = false;
    rejected(service.processCommandApdu(aid, null));
    System.out.println("HCE discovery, failed writes, malformed commands, deactivation and application rejection passed");
  }
}
