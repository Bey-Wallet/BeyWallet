import React, { useState, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Button, Input, Text, YStack, XStack, Spinner, Paragraph, View, useTheme } from 'tamagui';
import { Plus, Check, AlertCircle, Sprout, X } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import AppBottomSheet, { AppBottomSheetRef } from './UI/AppBottomSheet';
import { useWalletStore } from '../store/walletStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastController } from '@tamagui/toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BottomSheetTextInput, BottomSheetScrollView } from '@gorhom/bottom-sheet';

type Stage = 'input' | 'preview' | 'loading';

// ─── Mint info fetcher (direct HTTP, no DB write) ────────────────────────────

interface MintPreviewInfo {
  name?: string;
  description?: string;
  mintUrl: string;
}

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
    return {
      name: data.name || data.shortname || 'Unknown Mint',
      description: data.description || data.description_long || undefined,
      mintUrl: normalized,
    };
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

  const handleTrustImmediately = async () => {
    const url = normalizeUrl(rawUrl);
    if (!url) {
      setError('Please enter a mint URL');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setStage('loading');
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await addMint(url, { trusted: true });
      await refreshMintList();
      toast.show('Mint Added', { message: 'Mint added successfully', duration: 2000 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sheetRef.current?.dismiss();
      resetState();
    } catch (err: any) {
      setError(err.message || 'Failed to add mint');
      setStage('input');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.show('Error', { message: err.message || 'Failed to add mint', duration: 3000 });
    }
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

      <XStack gap="$3">
        <Button flex={1} size="$4" theme="gray" onPress={handleTrustImmediately}>
          <Text fontWeight="600">Trust Immediately</Text>
        </Button>
        <Button
          flex={1}
          size="$4"
          themeInverse
          onPress={handleFetchMintInfo}
          icon={<Sprout size={18} />}
        >
          <Text fontWeight="600" color="$color">Preview</Text>
        </Button>
      </XStack>
    </YStack>
  );

  const renderPreviewStage = () => (
    <YStack gap="$4">
      <XStack justify="center">
        <Paragraph fontSize="$6" color="$accent5" fontWeight="bold">
          Mint Preview
        </Paragraph>
      </XStack>

      <YStack gap="$3" bg="$color2" p="$4" rounded="$4">
        <XStack gap="$3" items="center">
          <View bg="$green4" p="$2" rounded="$10">
            <Sprout size={24} color="$green10" />
          </View>
          <YStack flex={1}>
            <Text fontWeight="700" fontSize="$5">
              {previewInfo?.name}
            </Text>
            <Text fontSize="$2" color="$gray10" numberOfLines={1}>
              {previewInfo?.mintUrl.replace('https://', '')}
            </Text>
          </YStack>
        </XStack>

        {previewInfo?.description && (
          <Text color="$gray11" fontSize="$3">
            {previewInfo.description}
          </Text>
        )}

        {isExistingUntrusted && (
          <XStack p="$2" bg="$orange2" rounded="$2" gap="$2" items="center">
            <AlertCircle size={14} color="$orange10" />
            <Text fontSize="$2" color="$orange10" fontWeight="600">
              This mint is currently untrusted.
            </Text>
          </XStack>
        )}
      </YStack>

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
          size="$4"
          theme="gray"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setStage('input');
            setPreviewUrl(null);
          }}
          icon={<X size={18} />}
        >
          <Text fontWeight="600">Cancel</Text>
        </Button>
        <Button
          flex={1}
          size="$4"
          themeInverse
          onPress={handleTrustMint}
          icon={<Check size={18} />}
        >
          <Text fontWeight="600" color="$color">
            {isExistingUntrusted ? 'Trust this Mint' : 'Trust Mint'}
          </Text>
        </Button>
      </XStack>
    </YStack>
  );

  const renderLoadingStage = () => (
    <YStack gap="$4" items="center" py="$6">
      <Spinner size="large" color="$accent9" />
      <Text color="$gray10">{isPreviewLoading ? 'Fetching mint info…' : 'Adding mint…'}</Text>
    </YStack>
  );

  return (
    <AppBottomSheet ref={sheetRef}>
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
