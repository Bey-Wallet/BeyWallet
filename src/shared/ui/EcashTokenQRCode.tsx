import React, { memo, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { canRenderStaticTokenQr } from '~/shared/utils/tokenQr';
import { AnimatedTokenQRCode } from './AnimatedTokenQRCode';
import PaymentQRCode from './PaymentQRCode';

/** Automatically select one complete static code or the existing multipart animation. */
export const EcashTokenQRCode = memo(function EcashTokenQRCode({
  token,
  size,
}: {
  token: string;
  size: number;
}) {
  const { width } = useWindowDimensions();
  // Match PaymentQRCode's narrow-screen clamp when assessing module readability.
  const displayedSize = Math.min(size, Math.max(120, width - 96));
  const staticQr = useMemo(
    () => canRenderStaticTokenQr(token, displayedSize),
    [token, displayedSize],
  );
  if (staticQr)
    return (
      <PaymentQRCode value={token} size={size} ecl="M" backgroundColor="white" color="black" />
    );
  return <AnimatedTokenQRCode token={token} size={size} />;
});
