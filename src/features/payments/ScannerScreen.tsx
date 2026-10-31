import { pickQrImage } from '~/services/platform/qrImageService';
import { interactionCopy } from '~/services/feedback/interactionCopy';
import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import { Spinner } from '~/shared/ui/Spinner';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { usePendingOperationToast } from '~/shared/ui/OperationFeedback';
import { AppButton } from '~/shared/ui/AppButton';
import React, { useState, useRef } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { URDecoder } from '@gandlaf21/bc-ur';
import { YStack, XStack, Text, ZStack, Theme } from 'tamagui';
import { X, Zap, ZapOff, Image } from '@tamagui/lucide-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { appColors, appTypography } from '~/shared/theme/appearance';
import { useAuthStore } from '~/state/authStore';
import { useWalletStore } from '~/state/walletStore';
import { useP2PKScanStore } from '~/state/p2pkScanStore';
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
  const [viewport, setViewport] = useState({ width: window.width, height: window.height });
  const router = useRouter();
  const params = useLocalSearchParams();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const importingRef = useRef(false);
  const resolvingRef = useRef(false);
  const toast = useAppToast();
  usePendingOperationToast({
    active: isResolving,
    title: 'Reading QR code…',
  });
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [progress, setProgress] = useState(0);
  const [isUR, setIsUR] = useState(false);
  const decoderRef = useRef<URDecoder>(new URDecoder());
  const progressPercent = Math.round(Math.max(0, Math.min(1, progress || 0)) * 100);

  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const requestCamera = async () => {
    const auth = useAuthStore.getState();
    const previous = auth.isLockDisabled;
    auth.setLockDisabled(true);
    setIsRequestingCamera(true);
    try {
      await requestPermission();
    } catch {
      setImageError('Could not open the camera. You can choose an image instead.');
    } finally {
      auth.setLockDisabled(previous);
      setIsRequestingCamera(false);
    }
  };

  const handleBarcodeScanned = async (
    result: Pick<BarcodeScanningResult, 'data'>,
    fromImage = false,
  ) => {
    if (scanned || resolvingRef.current || (importingRef.current && !fromImage)) return;

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

            await onSuccess(decodedStr);
          } else {
            // Reset if failed
            decoderRef.current = new URDecoder();
            setProgress(0);
          }
        }
        if (fromImage && !decoderRef.current.isComplete()) {
          throw new Error(
            'This is one frame of an animated QR. Scan the animated code with the camera.',
          );
        }
      } catch (e) {
        decoderRef.current = new URDecoder();
        setProgress(0);
        setIsUR(false);
        if (fromImage)
          throw new Error(
            'This image contains an incomplete or unreadable animated QR. Scan the animated code with the camera.',
          );
      }
    } else {
      // Static QR
      await onSuccess(data);
    }
  };

  const onSuccess = async (data: string) => {
    if (resolvingRef.current) return;
    resolvingRef.current = true;
    setIsResolving(true);
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
      toast.showFeedback(interactionCopy.couldNotReadThisQRCodeScan);
      setScanned(false);
    } finally {
      resolvingRef.current = false;
      setIsResolving(false);
    }
  };

  const importImage = async () => {
    if (importingRef.current || resolvingRef.current || scanned || isRequestingCamera) return;
    importingRef.current = true;
    setIsImporting(true);
    setFlash('off');
    setImageError(null);
    decoderRef.current = new URDecoder();
    setIsUR(false);
    setProgress(0);
    try {
      const data = await pickQrImage();
      if (data) await handleBarcodeScanned({ data }, true);
    } catch (error) {
      setImageError(
        error instanceof Error ? error.message : 'Could not read this image. Please try another.',
      );
    } finally {
      importingRef.current = false;
      setIsImporting(false);
    }
  };

  const imageButton = (
    <AppButton
      icon={Image}
      emphasis="secondary"
      size="medium"
      loading={isImporting && !isResolving}
      loadingText="Reading image"
      disabled={isResolving || scanned || isRequestingCamera}
      onPress={importImage}
    >
      Choose image
    </AppButton>
  );
  const imageFeedback = imageError ? (
    <Text fontSize={12} color="$gray10" textAlign="center" accessibilityLiveRegion="polite">
      {imageError}
    </Text>
  ) : null;

  if (!permission?.granted) {
    return (
      <Theme name="dark">
        <SafeAreaView style={{ flex: 1, backgroundColor: appColors.dark.canvas }}>
          <YStack flex={1} p="$4" gap="$4">
            <HeaderIconButton
              accessibilityLabel="Close scanner"
              icon={X}
              onPress={() => router.back()}
            />
            <YStack flex={1} justify="center" gap="$4" width="100%" maxWidth={420} self="center">
              <Text color="$color" fontSize="$6" fontWeight="600" textAlign="center">
                Scan a QR code
              </Text>
              <Text color="$gray10" textAlign="center">
                Allow camera access to scan, or choose an image.
              </Text>
              <AppButton
                size="medium"
                onPress={requestCamera}
                loading={isRequestingCamera}
                disabled={isImporting}
              >
                Allow camera
              </AppButton>
              {imageButton}
              {imageFeedback}
            </YStack>
          </YStack>
        </SafeAreaView>
      </Theme>
    );
  }

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
    ? 'Reading QR code'
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
          onBarcodeScanned={
            scanned || isImporting || isResolving
              ? undefined
              : (result) => {
                  void handleBarcodeScanned(result);
                }
          }
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
              <YStack width={48} items="center">
                <HeaderIconButton
                  accessibilityLabel={flash === 'on' ? 'Turn flashlight off' : 'Turn flashlight on'}
                  accessibilityState={{ selected: flash === 'on' }}
                  icon={flash === 'on' ? Zap : ZapOff}
                  onPress={() => setFlash((value) => (value === 'on' ? 'off' : 'on'))}
                />
              </YStack>
            </XStack>

            <YStack gap="$3" width="100%" maxWidth={420} self="center">
              <XStack
                items="center"
                justify="center"
                gap="$3"
                accessible
                accessibilityLabel={statusTitle}
                accessibilityLiveRegion="polite"
                accessibilityValue={
                  isUR && !isResolving ? { min: 0, max: 100, now: progressPercent } : undefined
                }
              >
                {isResolving || isUR ? (
                  <>
                    <Spinner size={20} color="$iconPrimary" />
                    {isUR && !isResolving && (
                      <Text {...appTypography.label2} color="$color">
                        {progressPercent}%
                      </Text>
                    )}
                  </>
                ) : (
                  <Text {...appTypography.label2} color="$color">
                    {statusTitle}
                  </Text>
                )}
              </XStack>
              {imageFeedback}
              {imageButton}
              {scanned && !isResolving && (
                <AppButton
                  variant="default"
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
