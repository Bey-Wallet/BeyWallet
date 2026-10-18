import com.reactnativehce.apps.nfc.Type4File;
import java.util.Arrays;

public class Type4FileTest {
  static int commits;
  static byte[] last;
  static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
  static byte[] command(int instruction, int offset, byte... data) {
    byte[] result = new byte[5 + data.length];
    result[1] = (byte)instruction; result[2] = (byte)(offset >> 8); result[3] = (byte)offset;
    result[4] = (byte)data.length; System.arraycopy(data, 0, result, 5, data.length);
    return result;
  }
  static byte[] select(int id) { return new byte[] {0,(byte)0xA4,0,0x0C,2,(byte)0xE1,(byte)id}; }
  static void ok(byte[] response) { check(response[response.length-2] == (byte)0x90, "Expected success"); }
  static void error(byte[] response) { check(response.length == 2 && response[0] != (byte)0x90, "Expected error"); }
  public static void main(String[] args) {
    byte[] advertised = new byte[302]; advertised[0]=1; advertised[1]=44;
    Arrays.fill(advertised, 2, advertised.length, (byte)7);
    Type4File file = new Type4File(advertised, true, message -> {
      // The Android adapter uses NdefMessage for complete NDEF validation.
      if (message.length != 3 || message[0] != 1) return false;
      commits++; last = message; return true;
    });
    error(file.process(new byte[] {0}));
    error(file.process(new byte[] {0,(byte)0xB0,0,0,1}));
    ok(file.process(select(4)));
    check(file.process(new byte[] {0,(byte)0xB0,0,0,0}).length == 258, "Le=0 must read 256 bytes");
    check(file.process(new byte[] {0,(byte)0xB0,0,0,2}).length == 4, "Short read");
    error(file.process(new byte[] {0,(byte)0xB0,0x7F,(byte)255,1}));
    ok(file.process(select(3)));
    check(file.process(new byte[] {0,(byte)0xB0,0,0,0}).length == 17, "CC read is bounded");
    error(file.process(command(0xD6, 0, (byte)0, (byte)0)));
    error(file.process(select(9)));
    error(file.process(new byte[] {0,(byte)0xB0,0,0,2}));
    ok(file.process(select(4)));
    error(file.process(new byte[] {0,(byte)0xD6,0,0,3,0}));
    error(file.process(command(0xD6, 0x7FFE, (byte)1, (byte)2)));
    ok(file.process(command(0xD6, 0, (byte)0, (byte)0)));
    ok(file.process(command(0xD6, 2, (byte)1)));
    check(commits == 0, "Incomplete writes do not complete");
    ok(file.process(command(0xD6, 0, (byte)0, (byte)3)));
    check(commits == 0, "Missing fragments do not complete");
    ok(file.process(command(0xD6, 3, (byte)2, (byte)3)));
    check(commits == 1 && Arrays.equals(last, new byte[]{1,2,3}), "Complete fragments commit once");
    error(file.process(command(0xD6, 3, (byte)2, (byte)3)));
    check(commits == 1, "Duplicate fragment does not commit again");
    check(Arrays.equals(Arrays.copyOf(file.process(new byte[] {0,(byte)0xB0,0,0,2}),2), new byte[]{1,44}), "Outgoing request is unchanged");
    error(file.process(command(0xD6, 0, (byte)0x7F, (byte)255)));
    file.reset(); ok(file.process(select(4)));
    error(file.process(command(0xD6, 0, (byte)0, (byte)3, (byte)9, (byte)2, (byte)3)));
    check(commits == 1, "Malformed NDEF is not acknowledged");
    Type4File readOnly = new Type4File(advertised, false, message -> {throw new AssertionError("Read-only commit");});
    ok(readOnly.process(select(4)));
    error(readOnly.process(command(0xD6, 0, (byte)0, (byte)0)));
    Type4File storageFailure = new Type4File(advertised, true, message -> false);
    ok(storageFailure.process(select(4)));
    error(storageFailure.process(command(0xD6, 0, (byte)0, (byte)3, (byte)1, (byte)2, (byte)3)));
    System.out.println("Type4File: 256-byte/short reads, bounds, fragments, malformed writes, read-only tags and failed storage passed");
  }
}
