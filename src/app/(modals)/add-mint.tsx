import React, { useState, useCallback, useEffect } from 'react';
import { Button, Input, Text, YStack, XStack, Spinner, Paragraph, View, useTheme, ScrollView, Image } from 'tamagui';
import { Check, AlertCircle, Sprout, ShieldCheck, ShieldOff, Scan } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { useWalletStore } from '~/store/walletStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastController } from '@tamagui/toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';

type Stage = 'input' | 'preview' | 'loading';

interface MintPreviewInfo {
    name?: string;
    description?: string;
    mintUrl: string;
    icon?: string;
}

// Fastest fetching: pure HTTP request to /v1/info
async function fetchMintPreview(mintUrl: string): Promise<MintPreviewInfo> {
    const normalized = mintUrl.replace(/\/$/, '');
    const url = `${normalized}/v1/info`;

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
            icon: data.icon_url || data.picture || data.icon || undefined,
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
    // Auto adding https even when user forgets
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        return 'https://' + trimmed;
    }
    return trimmed.replace(/\/$/, '');
}

export default function AddMintScreen() {
    const theme = useTheme();
    const router = useRouter();
    const [stage, setStage] = useState<Stage>('input');
    const [rawUrl, setRawUrl] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isExistingUntrusted, setIsExistingUntrusted] = useState(false);

    const { addMint, refreshMintList, mints, scannerResult, setScannerResult } = useWalletStore();
    const insets = useSafeAreaInsets();
    const toast = useToastController();
    const queryClient = useQueryClient();

    const {
        data: previewInfo,
        isLoading: isPreviewLoading,
        error: previewError,
    } = useQuery({
        queryKey: ['mint-preview', previewUrl],
        queryFn: () => fetchMintPreview(previewUrl!),
        enabled: !!previewUrl,
        staleTime: 5 * 60 * 1000,
        retry: 1,
    });

    useEffect(() => {
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

    const resetState = useCallback(() => {
        setStage('input');
        setRawUrl('');
        setError(null);
        setPreviewUrl(null);
        setIsExistingUntrusted(false);
    }, []);

    const triggerPreview = useCallback((url: string) => {
        const normalized = normalizeUrl(url);
        if (!normalized) {
            setError('Please enter a mint URL');
            return;
        }
        setError(null);
        const existing = mints.find(m => m.mintUrl.replace(/\/$/, '') === normalized);
        setIsExistingUntrusted(!!(existing && !existing.trusted));
        setPreviewUrl(normalized);
    }, [mints]);

    useEffect(() => {
        if (scannerResult) {
            setRawUrl(scannerResult);
            setScannerResult(null);
            triggerPreview(scannerResult);
        }
    }, [scannerResult, triggerPreview, setScannerResult]);

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
            router.back();
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
            router.back();
        } catch (err: any) {
            setError(err.message || 'Failed to trust mint');
            setStage('preview');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            toast.show('Error', { message: err.message || 'Failed to add mint', duration: 3000 });
        }
    };

    const renderInputStage = () => (
        <YStack gap="$4" py="$4">
            <Paragraph fontSize="$3" color="$gray10">
                Enter the URL of the mint you want to add.
            </Paragraph>

            <YStack gap="$2">
                <XStack gap="$2" items="center">
                    <Input
                        flex={1}
                        placeholder="mint.example.com"
                        value={rawUrl}
                        onChangeText={setRawUrl}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        returnKeyType="done"
                        onSubmitEditing={handleFetchMintInfo}
                        size="$5"
                        borderWidth={1}
                        borderColor={error ? '$red10' : '$borderColor'}
                    />
                    <Button 
                        size="$5"
                        width="$5"
                        icon={<Scan size={20} color="$color" />} 
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push({ pathname: '/(modals)/scanner', params: { returnTo: '/(modals)/add-mint' } });
                        }}
                    />
                </XStack>
                {error && (
                    <XStack gap="$2" items="center" mt="$1">
                        <AlertCircle size={14} color="$red10" />
                        <Text color="$red10" fontSize="$2">{error}</Text>
                    </XStack>
                )}
            </YStack>

            <YStack mt="$4" gap="$3">
                <Button size="$5" themeInverse onPress={handleFetchMintInfo} icon={<Sprout size={18} />}>
                    Fetch Mint
                </Button>
                <Button size="$5" theme="red" onPress={handleTrustImmediately} chromeless>
                    DANGER: Trust Without Preview
                </Button>
            </YStack>
        </YStack>
    );

    const renderPreviewStage = () => (
        <YStack gap="$4" py="$4">
            <YStack gap="$3" bg="$gray2" p="$4" rounded="$5" >
                <XStack gap="$4" items="center">
                    <View
                        bg={previewInfo?.icon ? 'transparent' : '$green4'}
                        p={previewInfo?.icon ? '$0' : '$2'}
                        rounded="$3"
                        overflow="hidden"
                        width={48}
                        height={48}
                        items="center"
                        justify="center"
                    >
                        {previewInfo?.icon ? (
                            <Image
                                source={{ uri: previewInfo.icon }}
                                width={48}
                                height={48}
                                resizeMode="cover"
                            />
                        ) : (
                            <Sprout size={28} color="$green10" />
                        )}
                    </View>
                    <YStack flex={1}>
                        <Text fontWeight="700" fontSize="$5">{previewInfo?.name}</Text>
                        <Text fontSize="$2" color="$gray10" numberOfLines={1}>
                            {previewInfo?.mintUrl}
                        </Text>
                    </YStack>
                </XStack>

                {previewInfo?.description && (
                    <Text color="$gray10" fontSize="$3" mt="$1">{previewInfo.description}</Text>
                )}

                {isExistingUntrusted && (
                    <XStack p="$3" bg="$orange2" rounded="$3" gap="$2" items="center" mt="$2">
                        <AlertCircle size={16} color="$orange10" />
                        <Text fontSize="$3" color="$orange10" fontWeight="600">This mint is currently untrusted.</Text>
                    </XStack>
                )}
            </YStack>

            {error && (
                <XStack gap="$2" items="center">
                    <AlertCircle size={14} color="$red10" />
                    <Text color="$red10" fontSize="$2">{error}</Text>
                </XStack>
            )}

            <YStack mt="$4" gap="$3" flex={1}>
                {/* The Trust Modal component built in */}
                <YStack p="$4" bg="$gray2" rounded="$4" mb="$2">
                    <XStack gap="$2" items="center" mb="$2">
                        <ShieldCheck size={20} color="$green10" />
                        <Text fontWeight="bold" fontSize="$4">Trust this Mint?</Text>
                    </XStack>
                    <Text color="$gray10" fontSize="$3">
                        By trusting this mint, you allow it to hold your ecash balances. Only trust mints operated by entities you know.
                    </Text>
                </YStack>

                <Button
                    size="$5" themeInverse
                    onPress={handleTrustMint}
                    icon={<Check size={20} />}
                >
                    {isExistingUntrusted ? 'Trust this Mint' : 'Confirm & Trust Mint'}
                </Button>
                <Button
                    size="$5" theme="gray"
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStage('input'); setPreviewUrl(null); }}
                >
                    Cancel
                </Button>
            </YStack>
        </YStack>
    );

    const renderLoadingStage = () => (
        <YStack gap="$4" items="center" py="$10" flex={1} justify="center">
            <Spinner size="large" color="$accent9" />
            <Text color="$gray10" mt="$4" fontSize="$4">
                {isPreviewLoading ? 'Fetching mint details…' : 'Adding mint to wallet…'}
            </Text>
        </YStack>
    );

    return (
        <YStack flex={1} bg="$background">
            <Stack.Screen options={{ headerTitle: 'Add New Mint' }} />
            <ScrollView
                contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
                keyboardShouldPersistTaps="handled"
            >
                {stage === 'input' && renderInputStage()}
                {stage === 'preview' && renderPreviewStage()}
                {stage === 'loading' && renderLoadingStage()}
            </ScrollView>
        </YStack>
    );
}
