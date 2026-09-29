import React, { useState, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Button, Image, Text, YStack, XStack, Spinner, Paragraph, View, useTheme } from 'tamagui';
import {
  Check,
  AlertCircle,
  Sprout,
  X,
  ShieldAlert,
  LockKeyhole,
  Cpu,
  Zap,
  KeyRound,
  Mail,
} from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import AppBottomSheet, { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { useWalletStore } from '~/state/walletStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastController } from '@tamagui/toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BottomSheetTextInput, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { parseMintPreview, type MintPreviewInfo } from '~/shared/utils/mintPreview';

type Stage = 'input' | 'preview' | 'loading';

// ─── Mint info fetcher (direct HTTP, no DB write) ────────────────────────────

/**
 * Fetches mint info directly from the mint's /v1/info endpoint.
 * This is fast because it skips the Coco SDK's addMint() DB write.
 */
async function fetchMintPreview(mintUrl: string): Promise<MintPreviewInfo> {
  const normalized = mintUrl.replace(/\/$/, '');
  const url = `${normalized}/v1/info`;

  // AbortSignal.timeout() is not available in Hermes — use manual controller
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Mint returned ${res.status}`);
    const data = await res.json();
    return parseMintPreview(normalized, data);
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') throw new Error('Request timed out — check the mint URL');
    throw err;
  }
}

function normalizeUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return 'https://' + trimmed;
  }
  return trimmed.replace(/\/$/, '');
}

function MintInfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <XStack gap="$3" py="$2.5" items="flex-start">
      <View mt={2}>{icon}</View>
      <YStack flex={1} gap="$0.5" style={{ minWidth: 0 }}>
        <Text fontSize="$2" color="$gray10" fontWeight="600">
          {label}
        </Text>
        <Text fontSize="$3" color="$color" fontWeight="700" selectable>
          {value}
        </Text>
      </YStack>
    </XStack>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface AddMintModalRef {
  present: (url?: string) => void;
  dismiss: () => void;
}

const AddMintModal = forwardRef<AddMintModalRef>((_, ref) => {
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const theme = useTheme();
  const [stage, setStage] = useState<Stage>('input');
  const [rawUrl, setRawUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isExistingUntrusted, setIsExistingUntrusted] = useState(false);
  const [previewIconFailed, setPreviewIconFailed] = useState(false);

  const { addMint, refreshMintList, mints } = useWalletStore();
  const insets = useSafeAreaInsets();
  const toast = useToastController();
  const queryClient = useQueryClient();

  // ── TanStack Query: mint preview ─────────────────────────────────────────
  // Only fires when previewUrl is set (user tapped "Preview" or URL was injected).
  // Results are cached by URL — re-opening for the same mint is instant.
  const {
    data: previewInfo,
    isLoading: isPreviewLoading,
    error: previewError,
  } = useQuery({
    queryKey: ['mint-preview', previewUrl],
    queryFn: () => fetchMintPreview(previewUrl!),
    enabled: !!previewUrl,
    staleTime: 5 * 60 * 1000, // cached 5 min
    retry: 1,
  });

  // Sync stage with query state
  React.useEffect(() => {
    if (!previewUrl) return;
    if (isPreviewLoading) {
      setStage('loading');
    } else if (previewError) {
      setError((previewError as Error).message || 'Failed to fetch mint info');
      setStage('input');
      setPreviewUrl(null);
    } else if (previewInfo) {
      setStage('preview');
    }
  }, [isPreviewLoading, previewError, previewInfo, previewUrl]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const resetState = useCallback(() => {
    setStage('input');
    setRawUrl('');
    setError(null);
    setPreviewUrl(null);
    setIsExistingUntrusted(false);
    setPreviewIconFailed(false);
  }, []);

  const triggerPreview = useCallback(
    (url: string) => {
      const normalized = normalizeUrl(url);
      if (!normalized) {
        setError('Please enter a mint URL');
        return;
      }
      setError(null);
      // Check if already in mints list as untrusted
      const existing = mints.find((m) => m.mintUrl.replace(/\/$/, '') === normalized);
      setIsExistingUntrusted(!!(existing && !existing.trusted));
      setPreviewUrl(normalized);
    },
    [mints],
  );

  // ── Imperative handle ────────────────────────────────────────────────────

  useImperativeHandle(ref, () => ({
    present: (url?: string) => {
      resetState();
      if (url) {
        const normalized = normalizeUrl(url);
        setRawUrl(normalized);
        // Pre-fetch immediately (will be cached for later)
        queryClient.prefetchQuery({
          queryKey: ['mint-preview', normalized],
          queryFn: () => fetchMintPreview(normalized),
          staleTime: 5 * 60 * 1000,
        });
        setTimeout(() => triggerPreview(normalized), 50);
      }
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleFetchMintInfo = () => {
    if (!rawUrl.trim()) {
      setError('Please enter a mint URL');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    triggerPreview(rawUrl);
  };

  const handleTrustMint = async () => {
    if (!previewInfo) return;
    setStage('loading');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await addMint(previewInfo.mintUrl, { trusted: true });
      await refreshMintList();
      toast.show('Mint Added', { message: `${previewInfo.name} is now trusted`, duration: 3000 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sheetRef.current?.dismiss();
      resetState();
    } catch (err: any) {
      setError(err.message || 'Failed to trust mint');
      setStage('preview');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.show('Error', { message: err.message || 'Failed to add mint', duration: 3000 });
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const renderInputStage = () => (
    <YStack gap="$4">
      <XStack justify="center" mb="$2">
        <Paragraph fontSize="$6" color="$accent5" fontWeight="bold">
          Add Mint
        </Paragraph>
      </XStack>

      <YStack gap="$2">
        <BottomSheetTextInput
          placeholder="https://mint.example.com"
          value={rawUrl}
          onChangeText={setRawUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="done"
          onSubmitEditing={handleFetchMintInfo}
          style={{
            backgroundColor: theme.color2.val,
            color: theme.color.val,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: error ? theme.red10.val : theme.borderColor.val,
            fontSize: 16,
            height: 56,
          }}
          placeholderTextColor={theme.gray10.val}
        />
        {error && (
          <XStack gap="$2" items="center" mt="$1">
            <AlertCircle size={14} color="$red10" />
            <Text color="$red10" fontSize="$2">
              {error}
            </Text>
          </XStack>
        )}
      </YStack>

      <Button size="$5" themeInverse onPress={handleFetchMintInfo} icon={<ShieldAlert size={18} />}>
        <Text fontWeight="700" color="$color">
          Review Mint
        </Text>
      </Button>
    </YStack>
  );

  const renderPreviewStage = () => {
    if (!previewInfo) return null;
    const publicKey = previewInfo.publicKey
      ? previewInfo.publicKey.length > 28
        ? `${previewInfo.publicKey.slice(0, 14)}…${previewInfo.publicKey.slice(-10)}`
        : previewInfo.publicKey
      : undefined;
    const limits = [
      previewInfo.mintingLimits ? `Deposit ${previewInfo.mintingLimits}` : undefined,
      previewInfo.paymentLimits ? `Pay ${previewInfo.paymentLimits}` : undefined,
    ]
      .filter(Boolean)
      .join(' · ');

    return (
      <YStack gap="$4">
        <XStack justify="center">
          <Paragraph fontSize="$6" color="$color" fontWeight="bold">
            Review Mint
          </Paragraph>
        </XStack>

        <YStack items="center" gap="$2">
          <View
            width={76}
            height={76}
            rounded="$5"
            overflow="hidden"
            bg="$gray4"
            items="center"
            justify="center"
            borderWidth={1}
            borderColor="$borderColor"
          >
            {previewInfo.icon && !previewIconFailed ? (
              <Image
                source={{ uri: previewInfo.icon }}
                width={76}
                height={76}
                onError={() => setPreviewIconFailed(true)}
              />
            ) : (
              <Sprout size={38} color="$gray10" />
            )}
          </View>
          <Text fontWeight="900" fontSize="$6" color="$color" textAlign="center">
            {previewInfo.name}
          </Text>
          <XStack items="center" gap="$1.5">
            <LockKeyhole size={13} color={previewInfo.isSecure ? '$green10' : '$red10'} />
            <Text
              fontSize="$2"
              color={previewInfo.isSecure ? '$green10' : '$red10'}
              fontWeight="700"
            >
              {previewInfo.isSecure ? 'HTTPS' : 'Unencrypted HTTP'} · {previewInfo.hostname}
            </Text>
          </XStack>
        </YStack>

        {previewInfo.description ? (
          <Text color="$gray11" fontSize="$3" lineHeight={20} textAlign="center">
            {previewInfo.description}
          </Text>
        ) : null}

        <XStack p="$3" bg="$orange2" rounded="$4" gap="$2.5" items="flex-start">
          <ShieldAlert size={19} color="$orange10" />
          <YStack flex={1} gap="$1">
            <Text fontSize="$3" color="$orange10" fontWeight="800">
              This mint will hold your funds
            </Text>
            <Text fontSize="$2" color="$orange10" lineHeight={17}>
              A mint can lose funds, stop operating, or refuse redemption. Only add it if you trust
              its operator, and keep balances small.
            </Text>
          </YStack>
        </XStack>

        {isExistingUntrusted ? (
          <XStack p="$2.5" bg="$yellow2" rounded="$3" gap="$2" items="center">
            <AlertCircle size={15} color="$yellow10" />
            <Text fontSize="$2" color="$yellow10" fontWeight="700" flex={1}>
              This mint is connected but is not currently trusted.
            </Text>
          </XStack>
        ) : null}

        <YStack bg="$color2" px="$3" rounded="$4">
          <MintInfoRow
            icon={<LockKeyhole size={17} color="$gray10" />}
            label="Exact mint URL"
            value={previewInfo.mintUrl}
          />
          <MintInfoRow
            icon={<Zap size={17} color="$gray10" />}
            label="Payment methods"
            value={
              previewInfo.paymentMethods.length > 0
                ? previewInfo.paymentMethods.join(' · ')
                : 'Not advertised'
            }
          />
          {limits ? (
            <MintInfoRow
              icon={<Cpu size={17} color="$gray10" />}
              label="Advertised limits"
              value={limits}
            />
          ) : null}
          <MintInfoRow
            icon={<Cpu size={17} color="$gray10" />}
            label="Software and Cashu support"
            value={`${previewInfo.version || 'Version not provided'} · ${previewInfo.supportedNuts} NUTs`}
          />
          {publicKey ? (
            <MintInfoRow
              icon={<KeyRound size={17} color="$gray10" />}
              label="Operator public key"
              value={publicKey}
            />
          ) : null}
          {previewInfo.contact ? (
            <MintInfoRow
              icon={<Mail size={17} color="$gray10" />}
              label="Operator contact"
              value={previewInfo.contact}
            />
          ) : null}
        </YStack>

        {previewInfo.motd ? (
          <YStack bg="$blue2" rounded="$4" p="$3" gap="$1">
            <Text color="$blue10" fontWeight="800" fontSize="$3">
              Operator announcement
            </Text>
            <Text color="$blue10" fontSize="$2" lineHeight={18}>
              {previewInfo.motd}
            </Text>
          </YStack>
        ) : null}

        <Text fontSize="$1" color="$gray9" textAlign="center">
          Profile and capability details are self-reported by the mint.
        </Text>

        {error && (
          <XStack gap="$2" items="center">
            <AlertCircle size={14} color="$red10" />
            <Text color="$red10" fontSize="$2">
              {error}
            </Text>
          </XStack>
        )}

        <XStack gap="$3">
          <Button
            flex={1}
            size="$5"
            theme="gray"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setStage('input');
              setPreviewUrl(null);
            }}
            icon={<X size={18} />}
          >
            Back
          </Button>
          <Button
            flex={1.4}
            size="$5"
            themeInverse
            onPress={handleTrustMint}
            icon={<Check size={18} />}
          >
            <Text fontWeight="700" color="$color">
              Trust & Add Mint
            </Text>
          </Button>
        </XStack>
      </YStack>
    );
  };

  const renderLoadingStage = () => (
    <YStack gap="$4" items="center" py="$6">
      <Spinner size="large" color="$accent9" />
      <Text color="$gray10">{isPreviewLoading ? 'Fetching mint info…' : 'Adding mint…'}</Text>
    </YStack>
  );

  return (
    <AppBottomSheet ref={sheetRef} snapPoints={['90%']} bottomInset={insets.bottom}>
      <BottomSheetScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {stage === 'input' && renderInputStage()}
        {stage === 'preview' && renderPreviewStage()}
        {stage === 'loading' && renderLoadingStage()}
      </BottomSheetScrollView>
    </AppBottomSheet>
  );
});

AddMintModal.displayName = 'AddMintModal';

export default AddMintModal;
