import QRCode from 'qrcode';
import { Buffer } from 'buffer';

export const MAX_STATIC_TOKEN_QR_BYTES = 800;
const MIN_STATIC_TOKEN_MODULE_SIZE = 2.5;

/** Display choice only: never rewrite the token or remove verification data to make it fit. */
export function canRenderStaticTokenQr(token: string, size: number): boolean {
  if (!token || !Number.isFinite(size) || size <= 0) return false;
  if (Buffer.byteLength(token, 'utf8') > MAX_STATIC_TOKEN_QR_BYTES) return false;
  try {
    const { modules } = QRCode.create(token, { errorCorrectionLevel: 'M' });
    return size / modules.size >= MIN_STATIC_TOKEN_MODULE_SIZE;
  } catch {
    return false;
  }
}
