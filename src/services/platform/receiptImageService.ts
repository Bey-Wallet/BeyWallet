import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useAuthStore } from '~/state/authStore';

export type ReceiptImageRenderer = {
  toDataURL: (callback: (base64: string) => void, options?: object) => void;
};

/** The renderer is an isolated public-summary SVG, never a capture of the wallet screen. */
export async function shareReceiptImage(
  renderer: ReceiptImageRenderer,
  size = { width: 1280, height: 1360 },
): Promise<void> {
  if (!(await Sharing.isAvailableAsync()) || !FileSystem.cacheDirectory)
    throw new Error('Image sharing is unavailable on this device.');
  const base64 = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Could not render the receipt image.')),
      10_000,
    );
    try {
      renderer.toDataURL((data) => {
        clearTimeout(timer);
        if (data) resolve(data);
        else reject(new Error('Could not render the receipt image.'));
      }, size);
    } catch {
      clearTimeout(timer);
      reject(new Error('Could not render the receipt image.'));
    }
  });
  const uri = `${FileSystem.cacheDirectory}bey-receipt-${Date.now()}.png`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  const auth = useAuthStore.getState();
  const previous = auth.isLockDisabled;
  auth.setLockDisabled(true);
  try {
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      UTI: 'public.png',
      dialogTitle: 'Share receipt image',
    });
  } finally {
    auth.setLockDisabled(previous);
  }
}
