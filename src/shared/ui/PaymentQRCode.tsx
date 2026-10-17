import React from 'react';
import { useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

/** Keep QR quiet zones visible on narrow devices. The encoded value stays complete. */
export default function PaymentQRCode(props: React.ComponentProps<typeof QRCode>) {
  const { width } = useWindowDimensions();
  return <QRCode {...props} size={Math.min(props.size ?? 320, Math.max(120, width - 96))} />;
}
