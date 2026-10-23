import React, { memo, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { UR, UREncoder } from '@gandlaf21/bc-ur';
import { Buffer } from 'buffer';
import { Text, YStack } from 'tamagui';
import PaymentQRCode from './PaymentQRCode';
import { Spinner } from './Spinner';

const FRAME_INTERVAL_MS = 100;
const FRAGMENT_LENGTH = 150;

/** Keep frame updates local so payment controls and navigation do not rerender at QR speed. */
export const AnimatedTokenQRCode = memo(function AnimatedTokenQRCode({
  token,
  size,
}: {
  token: string;
  size: number;
}) {
  const focused = useIsFocused();
  const [appState, setAppState] = useState(AppState.currentState);
  const [frame, setFrame] = useState<{ token: string; value: string | null } | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!token) {
      setFrame(null);
      return;
    }
    let timer: ReturnType<typeof setInterval> | undefined;
    try {
      // Preserve the existing UR bytes envelope and the complete encoded token.
      const encoder = new UREncoder(UR.fromBuffer(Buffer.from(token)), FRAGMENT_LENGTH, 0);
      const advance = () => {
        try {
          // UR is case-insensitive. Uppercase lets QR use its more compact alphanumeric mode.
          setFrame({ token, value: encoder.nextPart().toUpperCase() });
          return true;
        } catch {
          clearInterval(timer);
          setFrame({ token, value: null });
          return false;
        }
      };
      if (!advance()) return;
      if (focused && (appState === 'active' || appState === null) && encoder.fragmentsLength > 1) {
        timer = setInterval(advance, FRAME_INTERVAL_MS);
      }
    } catch {
      setFrame({ token, value: null });
    }
    return () => clearInterval(timer);
  }, [token, focused, appState]);

  // Never show a previous token's frame while a new token is being initialized.
  if (!frame || frame.token !== token) {
    return (
      <YStack width={size} height={size} items="center" justify="center">
        <Spinner size="large" />
      </YStack>
    );
  }
  if (!frame.value) {
    return (
      <YStack width={size} height={size} items="center" justify="center">
        <Text color="$gray10">QR unavailable. Copy or share the token instead.</Text>
      </YStack>
    );
  }
  return <PaymentQRCode value={frame.value} size={size} backgroundColor="white" color="black" />;
});
