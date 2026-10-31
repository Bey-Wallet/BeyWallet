import * as DocumentPicker from 'expo-document-picker';
import { scanFromURLAsync } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuthStore } from '~/state/authStore';

export const QR_IMAGE_READ_TIMEOUT_MS = 15_000;

async function decodeImage(uri: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      scanFromURLAsync(uri, ['qr']).catch(() => {
        throw new Error('Could not read this image. Try a clearer image with the full QR visible.');
      }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(
            new Error('Reading this image timed out. Try again or scan the QR with the camera.'),
          );
        }, QR_IMAGE_READ_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

/** Decode the selected local image. Payment routing and confirmation stay with the scanner. */
export async function pickQrImage(): Promise<string | null> {
  const auth = useAuthStore.getState();
  const previous = auth.isLockDisabled;
  auth.setLockDisabled(true);
  let cachedUri: string | undefined;
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      multiple: false,
      copyToCacheDirectory: true,
    }).catch(() => {
      throw new Error('Could not open this image. Please choose another.');
    });
    if (result.canceled) return null;
    const uri = result.assets[0]?.uri;
    if (!uri) throw new Error('Could not open this image. Please choose another.');
    if (
      FileSystem.cacheDirectory &&
      uri.startsWith(FileSystem.cacheDirectory) &&
      uri !== FileSystem.cacheDirectory
    )
      cachedUri = uri;
    const codes = await decodeImage(uri);
    const values = [
      ...new Set(
        codes.map((code) => code.data?.trim()).filter((value): value is string => !!value),
      ),
    ];
    if (!values.length)
      throw new Error('No QR code found. Try a clearer image with the full QR visible.');
    if (values.length > 1)
      throw new Error(
        'More than one QR code found. Choose an image with just the QR you want to use.',
      );
    return values[0];
  } finally {
    auth.setLockDisabled(previous);
    // Only delete the picker-owned cache copy, never the original selected image.
    if (cachedUri) void FileSystem.deleteAsync(cachedUri, { idempotent: true }).catch(() => {});
  }
}
