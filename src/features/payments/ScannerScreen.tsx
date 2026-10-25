import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import { Spinner } from '~/shared/ui/Spinner';
import { useToastController } from '@tamagui/toast';
import { usePendingOperationToast } from '~/shared/ui/OperationFeedback';
import { AppButton } from '~/shared/ui/AppButton';
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, useWindowDimensions, Animated } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { URDecoder } from '@gandlaf21/bc-ur';
import { YStack, XStack, Text, View, ZStack, Theme } from 'tamagui';
import { X, Zap, ZapOff, ScanLine } from '@tamagui/lucide-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { appColors, appTypography } from '~/shared/theme/appearance';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';
import { useAuthStore } from '~/state/authStore';
import { useWalletStore } from '~/state/walletStore';
import { useP2PKScanStore } from '~/state/p2pkScanStore';
import * as Clipboard from 'expo-clipboard';
import { Clipboard as ClipboardIcon } from '@tamagui/lucide-icons';
import { nip19 } from 'nostr-tools';
import { Buffer } from 'buffer';
import { resolveUniversalInput } from '~/shared/utils/universalInputResolver';
import { handleUniversalRedirect } from '~/shared/utils/universalRedirect';

async function tryResolveContact(
  data: string,
): Promise<{ npub: string; username?: string } | null> {
  let raw = data.trim();

  // 1. Strip protocol prefixes
  if (raw.toLowerCase().startsWith('web+nostr:')) raw = raw.substring(10);
  else if (raw.toLowerCase().startsWith('nostr://')) raw = raw.substring(8);
  else if (raw.toLowerCase().startsWith('nostr:')) raw = raw.substring(6);

  if (raw.startsWith('@')) raw = raw.substring(1);

  // 2. Check if URL containing npub or nprofile or username
  if (raw.toLowerCase().startsWith('http://') || raw.toLowerCase().startsWith('https://')) {
    try {
      const urlObj = new URL(raw);
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);
      const lastSegment = pathSegments[pathSegments.length - 1];
      if (lastSegment) {
        if (
          lastSegment.toLowerCase().startsWith('npub1') ||
          lastSegment.toLowerCase().startsWith('nprofile1')
        ) {
          raw = lastSegment;
        } else if (
          urlObj.hostname === 'bey.cash' &&
          (pathSegments[0] === 'u' || pathSegments[0] === 'user')
        ) {
          raw = lastSegment;
        }
      }
    } catch {}
  }

  const lower = raw.toLowerCase();

  // 3. Check npub
  if (lower.startsWith('npub1')) {
    try {
      const decoded = nip19.decode(lower);
      if (decoded.type === 'npub') {
        const hex = decoded.data as string;
        let username: string | undefined = undefined;
        try {
          const res = await fetch(`https://bey.cash/.well-known/nostr.json?_t=${Date.now()}`);
          if (res.ok) {
            const directory = await res.json();
            if (directory?.names) {
              const found = Object.keys(directory.names).find(
                (name) => directory.names[name].toLowerCase() === hex.toLowerCase(),
              );
              if (found) username = found;
            }
          }
        } catch {}
        return { npub: lower, username };
      }
    } catch {}
  }

  // 4. Check nprofile
  if (lower.startsWith('nprofile1')) {
    try {
      const decoded = nip19.decode(lower);
      if (decoded.type === 'nprofile') {
        const data = decoded.data as { pubkey: string };
        const npub = nip19.npubEncode(data.pubkey);
        let username: string | undefined = undefined;
        try {
          const res = await fetch(`https://bey.cash/.well-known/nostr.json?_t=${Date.now()}`);
          if (res.ok) {
            const directory = await res.json();
            if (directory?.names) {
              const found = Object.keys(directory.names).find(
                (name) => directory.names[name].toLowerCase() === data.pubkey.toLowerCase(),
              );
              if (found) username = found;
            }
          }
        } catch {}
        return { npub, username };
      }
    } catch {}
  }

  // 5. Check 64-char hex pubkey
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    try {
      const npub = nip19.npubEncode(raw.toLowerCase());
      let username: string | undefined = undefined;
      try {
        const res = await fetch(`https://bey.cash/.well-known/nostr.json?_t=${Date.now()}`);
        if (res.ok) {
          const directory = await res.json();
          if (directory?.names) {
            const found = Object.keys(directory.names).find(
              (name) => directory.names[name].toLowerCase() === raw.toLowerCase(),
            );
            if (found) username = found;
          }
        }
      } catch {}
      return { npub, username };
    } catch {}
  }

  // 6. Check Username / NIP-05 address
  let uname = raw;
  let domain = 'bey.cash';
  if (raw.includes('@')) {
    const parts = raw.split('@');
    if (parts.length === 2 && parts[0] && parts[1]) {
      uname = parts[0];
      domain = parts[1];
    }
  }

  // Attempt NIP-05 fetch for bey.cash or other domains
  if (/^[a-zA-Z0-9._-]+$/.test(uname) && /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
    try {
      const res = await fetch(
        `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(uname.toLowerCase())}&_t=${Date.now()}`,
      );
      if (res.ok) {
        const data = await res.json();
        const hex = data?.names?.[uname.toLowerCase()];
        if (hex) {
          const npub = nip19.npubEncode(hex);
          return { npub, username: domain === 'bey.cash' ? uname : `${uname}@${domain}` };
        }
      }
    } catch {}
  }

  return null;
}

export default function ScannerScreen() {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [viewport, setViewport] = useState({ width: window.width, height: window.height });
  const router = useRouter();
  const params = useLocalSearchParams();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionOrigin, setResolutionOrigin] = useState<'scan' | 'paste'>('scan');
  const toast = useToastController();
  usePendingOperationToast({
    active: isResolving && resolutionOrigin === 'scan',
    title: 'Reading QR code…',
  });
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [progress, setProgress] = useState(0);
  const [isUR, setIsUR] = useState(false);
  const decoderRef = useRef<URDecoder>(new URDecoder());
  const progressWidth = useRef(new Animated.Value(0)).current;
  const progressPercent = Math.round(Math.max(0, Math.min(1, progress || 0)) * 100);

  useEffect(() => {
    const animation = Animated.timing(progressWidth, {
      toValue: progressPercent,
      duration: reducedMotion ? 0 : 180,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [progressPercent, progressWidth, reducedMotion]);

  const { setLockDisabled } = useAuthStore();

  useEffect(() => {
    if (!permission) {
      // Prevent auto-lock from triggering when the native permission
      // prompt pushes the app into the background state.
      setLockDisabled(true);
      requestPermission().finally(() => {
        // Short delay to allow AppState to settle back to 'active'
        setTimeout(() => setLockDisabled(false), 1000);
      });
    }
  }, [permission]);

  if (!permission) {
    return (
      <YStack flex={1} bg="black" items="center" justify="center">
        <Spinner size="large" color="white" />
      </YStack>
    );
  }

  if (!permission.granted) {
    return (
      <YStack flex={1} bg="black" items="center" justify="center" p="$4" gap="$4">
        <Text color="white" fontSize="$6" fontWeight="600" style={{ textAlign: 'center' }}>
          Camera Permission Required
        </Text>
        <Text color="$gray10" style={{ textAlign: 'center' }}>
          We need your permission to show the camera to scan QR codes.
        </Text>
        <AppButton variant="branded" emphasis="primary" size="medium" onPress={requestPermission}>
          Grant Permission
        </AppButton>
        <AppButton
          variant="default"
          emphasis="secondary"
          size="medium"
          onPress={() => router.back()}
        >
          Cancel
        </AppButton>
      </YStack>
    );
  }

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (scanned) return;

    const data = result.data.trim();

    // Handle UR (Multipart QR)
    if (data.toLowerCase().startsWith('ur:')) {
      setIsUR(true);
      try {
        const prevCount = decoderRef.current.receivedPartIndexes?.length || 0;
        decoderRef.current.receivePart(data);
        const newCount = decoderRef.current.receivedPartIndexes?.length || 0;

        // Subtle haptic tick when a new unique fragment is captured
        if (newCount > prevCount) {
          Haptics.selectionAsync();
        }

        const p = decoderRef.current.estimatedPercentComplete();
        setProgress(p);

        if (decoderRef.current.isComplete()) {
          if (decoderRef.current.isSuccess()) {
            const ur = decoderRef.current.resultUR();
            // Robust string conversion for decoded UR payload
            let decodedStr = '';
            try {
              const decoded = ur.decodeCBOR();
              if (typeof decoded === 'string') {
                decodedStr = decoded;
              } else if (Buffer.isBuffer(decoded)) {
                decodedStr = decoded.toString('utf8');
              } else if ((decoded as any) instanceof Uint8Array || Array.isArray(decoded)) {
                decodedStr = Buffer.from(decoded as any).toString('utf8');
              } else {
                decodedStr = String(decoded);
              }
            } catch (e) {
              // Fallback: the sender may have passed a raw string Buffer instead of CBOR
              if (ur.cbor) {
                decodedStr = ur.cbor.toString('utf8');
              }
            }

            onSuccess(decodedStr);
          } else {
            // Reset if failed
            decoderRef.current = new URDecoder();
            setProgress(0);
          }
        }
      } catch (e) {
        console.error('UR Decoding error:', e);
        decoderRef.current = new URDecoder();
        setProgress(0);
      }
    } else {
      // Static QR
      onSuccess(data);
    }
  };

  const onSuccess = async (data: string, origin: 'scan' | 'paste' = 'scan') => {
    if (isResolving) return;
    setIsResolving(true);
    setResolutionOrigin(origin);
    try {
      setScanned(true);

      const trimmed = data.trim();
      if (!trimmed) return;

      // A public-key scan belongs only to its key editor, not another open payment screen.
      if (typeof params.p2pkScanId === 'string') {
        useP2PKScanStore.getState().setResult({ id: params.p2pkScanId, value: trimmed });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
        return;
      }

      // If explicitly asked to return to a path (e.g. from P2PK Send flow)
      if (params.returnTo) {
        console.log('[Scanner] returnTo detected:', params.returnTo);

        if (params.returnTo === '/receive' || params.returnTo === '/(modals)/receive') {
          // The home scan action historically treated every result as an ecash token. Resolve the
          // input first so unified payment URIs and payment requests reach their payment flow.
          const result = await resolveUniversalInput(trimmed);
          const redirected = handleUniversalRedirect(result, {
            router,
            replace: true,
          });

          if (redirected) {
            return;
          }

          // Preserve the existing receive fallback for inputs the universal resolver does not own.
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          const normalized = trimmed.toLowerCase().startsWith('cashu:')
            ? trimmed.substring(6)
            : trimmed;
          router.replace({
            pathname: '/(modals)/receive',
            params: { scannedToken: normalized },
          });
          return;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        console.log('[Scanner] Returning result to store for:', params.returnTo);
        useWalletStore.getState().setScannerResult(trimmed);
        router.back();
        return;
      }

      // Use Universal Resolver for robust format detection & redirection
      const result = await resolveUniversalInput(trimmed);
      console.log('[Scanner] Resolved universal input type:', result.type);

      const redirected = handleUniversalRedirect(result, {
        router,
        replace: true,
      });

      if (!redirected) {
        // Fallback: Set result in store and go back
        console.log('[Scanner] Fallback: returning data to previous screen...');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        useWalletStore.getState().setScannerResult(trimmed);
        router.back();
      }
    } catch (error: any) {
      toast.show('Unable to read QR code: ' + (error?.message || 'Please try again.'), {
        kind: 'error',
      });
      setScanned(false);
    } finally {
      setIsResolving(false);
    }
  };

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      onSuccess(text, 'paste');
    }
  };

  const compact = viewport.height < 600;
  const availableHeight = viewport.height - insets.top - insets.bottom;
  const scanSize = Math.min(viewport.width * 0.72, 320, availableHeight * (compact ? 0.34 : 0.44));
  const left = (viewport.width - scanSize) / 2;
  const top = Math.max(insets.top + 64, (viewport.height - scanSize) / 2 - (compact ? 48 : 64));
  const right = left + scanSize;
  const bottom = top + scanSize;
  const radius = 16;
  const corner = 32;
  const cutout = [
    'M',
    left + radius,
    top,
    'H',
    right - radius,
    'Q',
    right,
    top,
    right,
    top + radius,
    'V',
    bottom - radius,
    'Q',
    right,
    bottom,
    right - radius,
    bottom,
    'H',
    left + radius,
    'Q',
    left,
    bottom,
    left,
    bottom - radius,
    'V',
    top + radius,
    'Q',
    left,
    top,
    left + radius,
    top,
    'Z',
  ].join(' ');
  const corners = [
    'M',
    left,
    top + corner,
    'V',
    top + radius,
    'Q',
    left,
    top,
    left + radius,
    top,
    'H',
    left + corner,
    'M',
    right - corner,
    top,
    'H',
    right - radius,
    'Q',
    right,
    top,
    right,
    top + radius,
    'V',
    top + corner,
    'M',
    right,
    bottom - corner,
    'V',
    bottom - radius,
    'Q',
    right,
    bottom,
    right - radius,
    bottom,
    'H',
    right - corner,
    'M',
    left + corner,
    bottom,
    'H',
    left + radius,
    'Q',
    left,
    bottom,
    left,
    bottom - radius,
    'V',
    bottom - corner,
  ].join(' ');
  const statusTitle = isResolving
    ? resolutionOrigin === 'paste'
      ? 'Reading clipboard'
      : 'Reading QR code'
    : isUR
      ? 'Reading animated QR'
      : 'Align QR inside the corners';

  return (
    <Theme name="dark">
      <ZStack
        flex={1}
        bg="$background"
        onLayout={({ nativeEvent: { layout } }) =>
          setViewport({ width: layout.width, height: layout.height })
        }
      >
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={flash === 'on'}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />

        <Svg
          width={viewport.width}
          height={viewport.height}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Path
            testID="scanner-outside-mask"
            d={'M 0 0 H ' + viewport.width + ' V ' + viewport.height + ' H 0 Z ' + cutout}
            fill={appColors.dark.overlayStrong}
            fillRule="evenodd"
          />
          <Path
            testID="scanner-corners"
            d={corners}
            fill="none"
            stroke={appColors.dark.accent}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </Svg>

        <SafeAreaView style={{ flex: 1 }}>
          <YStack flex={1} justify="space-between" p="$4">
            <XStack items="center" gap="$2">
              <YStack width={48} items="center">
                <HeaderIconButton
                  accessibilityLabel="Close scanner"
                  icon={X}
                  onPress={() => router.back()}
                />
              </YStack>
              <Text
                {...appTypography.title3}
                fontWeight="500"
                color="$color"
                flex={1}
                textAlign="center"
              >
                Scan QR code
              </Text>
              <View width={48} />
            </XStack>

            <YStack gap="$3" width="100%" maxWidth={420} self="center">
              <YStack bg="$buttonDefaultSecondary" rounded="$6" p="$3" gap="$2">
                <XStack items="center" gap="$3">
                  {isResolving || isUR ? (
                    <Spinner size={20} color="$iconPrimary" />
                  ) : (
                    <ScanLine size={20} color="$iconSecondary" />
                  )}
                  <YStack flex={1} accessibilityLiveRegion="polite">
                    <Text {...appTypography.label2} color="$color">
                      {statusTitle}
                    </Text>
                  </YStack>
                  {isUR && !isResolving && (
                    <Text {...appTypography.label2} color="$gray10">
                      {progressPercent}%
                    </Text>
                  )}
                </XStack>
                {isUR && !isResolving && (
                  <View
                    height={4}
                    bg="$gray3"
                    rounded={2}
                    overflow="hidden"
                    accessible
                    accessibilityRole="progressbar"
                    accessibilityLabel="Animated QR scan progress"
                    accessibilityValue={{ min: 0, max: 100, now: progressPercent }}
                  >
                    <Animated.View
                      style={{
                        height: '100%',
                        backgroundColor: appColors.dark.accent,
                        borderRadius: 2,
                        width: progressWidth.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                        }),
                      }}
                    />
                  </View>
                )}
              </YStack>

              <XStack gap="$3">
                <AppButton
                  variant="default"
                  emphasis="secondary"
                  size="medium"
                  flex={1}
                  icon={ClipboardIcon}
                  loading={isResolving && resolutionOrigin === 'paste'}
                  loadingText="Reading clipboard"
                  disabled={isResolving}
                  onPress={handlePaste}
                >
                  Paste
                </AppButton>
                <AppButton
                  variant="default"
                  emphasis="secondary"
                  size="medium"
                  flex={1}
                  icon={flash === 'on' ? Zap : ZapOff}
                  accessibilityLabel={flash === 'on' ? 'Turn flashlight off' : 'Turn flashlight on'}
                  accessibilityState={{ selected: flash === 'on' }}
                  onPress={() => setFlash((f) => (f === 'on' ? 'off' : 'on'))}
                >
                  {flash === 'on' ? 'Light on' : 'Flashlight'}
                </AppButton>
              </XStack>
              {scanned && !isResolving && (
                <AppButton
                  variant="branded"
                  emphasis="primary"
                  size="medium"
                  onPress={() => setScanned(false)}
                >
                  Scan again
                </AppButton>
              )}
            </YStack>
          </YStack>
        </SafeAreaView>
      </ZStack>
    </Theme>
  );
}
