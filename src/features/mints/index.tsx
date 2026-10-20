import { MintImage } from '~/shared/ui/RemoteImage';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppButton } from '~/shared/ui/AppButton';
import React, { useEffect, useState, useMemo } from 'react';
import { YStack, XStack, Text, H2, H3, H4, Separator, ScrollView, View, Card } from 'tamagui';
import { Spinner } from '~/shared/ui/Spinner';
import {
  Link,
  Mail,
  Globe,
  Info,
  Copy,
  Check,
  ChevronLeft,
  Sprout,
  Share2,
  MessageSquare,
  ShieldCheck,
  Cpu,
  Plus,
  ShieldOff,
  QrCode,
} from '@tamagui/lucide-icons';
import { useRouter, Stack } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { mintRecommendationService } from '~/services/api/mintRecommendationService';
import { useToastController } from '@tamagui/toast';
import { useQuery } from '@tanstack/react-query';
import { useWalletStore } from '~/state/walletStore';
import AppBottomSheet, { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { usePreventRemove } from '@react-navigation/native';
import AddMintModal, { AddMintModalRef } from '~/shared/ui/AddMintModal';
import EditNicknameModal, { EditNicknameModalRef } from '~/shared/ui/EditNicknameModal';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import * as Sharing from 'expo-sharing';
import { Share as RNShare, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MintPreviewHealth, MintReliabilityRow } from './components/MintPreviewHealth';
import { MintPreviewMethods, mintPreviewMethods } from './components/MintPreviewMethods';
import { MintUrlQrOverlay } from './components/MintUrlQrOverlay';
import { mintHealthService, mintHealthUrl } from '~/services/api/mintHealthService';

interface MintProfileScreenProps {
  url: string;
}

export function MintProfileScreen({ url }: MintProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const [showQr, setShowQr] = useState(false);
  const router = useRouter();
  const toast = useToastController();
  const { addMint, mints } = useWalletStore();

  const addMintRef = React.useRef<AddMintModalRef>(null);
  const connectionSheetRef = React.useRef<AppBottomSheetRef>(null);
  const connectionLock = React.useRef(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  usePreventRemove(isConnecting, () => {});

  const normalizeUrl = (url: string) => url.replace(/\/$/, '');
  const walletMint = mints.find((m) => normalizeUrl(m.mintUrl) === normalizeUrl(url));
  const isAlreadyAdded = !!walletMint;
  const isTrusted = walletMint?.trusted ?? false;
  useEffect(() => {
    if (isAlreadyAdded && !isConnecting && !connectionError) {
      connectionSheetRef.current?.dismiss();
      router.replace({ pathname: '/(modals)/mint-details', params: { mintUrl: url } });
    }
  }, [isAlreadyAdded, isConnecting, connectionError, router, url]);
  const validUrl = useMemo(() => {
    try {
      mintHealthUrl(url);
      return true;
    } catch {
      return false;
    }
  }, [url]);

  const { removeMint } = useWalletStore();
  const editNicknameRef = React.useRef<EditNicknameModalRef>(null);

  const handleAction = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isAlreadyAdded) {
      setConnectionError(null);
      connectionSheetRef.current?.present();
    } else if (!isTrusted) {
      addMintRef.current?.present(url);
    }
  };

  const handleConfirmConnection = async () => {
    if (connectionLock.current) return;
    connectionLock.current = true;
    setIsConnecting(true);
    setConnectionError(null);
    try {
      useWalletStore.setState({ error: null });
      // Keep the SDK's mint and keyset validation behind explicit consent.
      await addMint(url, { trusted: true });
      const state = useWalletStore.getState();
      if (state.error) throw new Error(state.error);
      if (
        !state.mints.some(
          (mint) => normalizeUrl(mint.mintUrl) === normalizeUrl(url) && mint.trusted,
        )
      ) {
        throw new Error('Could not connect to this mint. Please try again.');
      }
      toast.show('Mint connected', { kind: 'success' });
    } catch (error) {
      setConnectionError(
        error instanceof Error ? error.message : 'Could not connect to this mint.',
      );
    } finally {
      connectionLock.current = false;
      setIsConnecting(false);
    }
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await RNShare.share({ message: url });
    } catch (error) {
      handleCopy(url, 'URL');
    }
  };

  const safeGoBack = React.useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [router]);

  const handleDelete = () => {
    Alert.alert('Remove Mint', 'Are you sure you want to remove this mint from your wallet?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          try {
            safeGoBack();
            await removeMint(url);
            toast.show('Mint removed', { kind: 'success' });
          } catch (e: any) {
            toast.show(e.message || 'Failed to remove mint.', { kind: 'error' });
          }
        },
      },
    ]);
  };

  const {
    data: fetchedInfo,
    isLoading,
    error: fetchError,
    isFetching: isCheckingConnection,
    dataUpdatedAt: connectionCheckedAt,
    errorUpdatedAt: connectionErrorAt,
    refetch: recheckConnection,
  } = useQuery({
    queryKey: ['mint-metadata', url],
    queryFn: async ({ signal }) => {
      if (!isAlreadyAdded) return mintHealthService.mintInfo(url, signal);
      const metadata = await mintRecommendationService.fetchMintMetadata(url);
      return metadata;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    networkMode: 'always',
    retry: isAlreadyAdded ? 2 : false,
    refetchOnMount: isAlreadyAdded ? true : 'always',
    enabled: validUrl,
  });
  const info = fetchedInfo || {};

  // Auditor queries
  const { data: auditorMint } = useQuery({
    queryKey: ['auditor-mint', url],
    queryFn: async () => {
      try {
        const response = await fetch(
          `https://api.audit.8333.space/mints/url?url=${encodeURIComponent(url || '')}`,
        );
        if (response.ok) {
          return await response.json();
        }
      } catch (e) {
        console.error('Error fetching auditor mint info:', e);
      }
      return null;
    },
    enabled: isAlreadyAdded && !!url,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const { data: auditorSwaps = [] } = useQuery({
    queryKey: ['auditor-swaps', auditorMint?.id],
    queryFn: async () => {
      if (!auditorMint?.id) return [];
      try {
        const response = await fetch(
          `https://api.audit.8333.space/swaps/mint/${auditorMint.id}?skip=0&limit=30`,
        );
        if (response.ok) {
          return await response.json();
        }
      } catch (e) {
        console.error('Error fetching auditor swaps:', e);
      }
      return [];
    },
    enabled: isAlreadyAdded && !!auditorMint?.id,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const { successRate, averageTime, riskLabel, uptimeColor, sortedSwaps } = useMemo(() => {
    if (!auditorMint || !auditorSwaps || auditorSwaps.length === 0) {
      return {
        successRate: null,
        averageTime: null,
        riskLabel: 'Not Audited',
        uptimeColor: '$gray10',
        sortedSwaps: [],
      };
    }

    const successfulSwaps = auditorSwaps.filter((s: any) => s.state === 'OK');
    const rate = Math.round((successfulSwaps.length / auditorSwaps.length) * 100);

    const successfulSwapsWithTime = successfulSwaps.filter((s: any) => s.time_taken);
    const avgTime =
      successfulSwapsWithTime.length > 0
        ? successfulSwapsWithTime.reduce((sum: number, s: any) => sum + s.time_taken, 0) /
          successfulSwapsWithTime.length
        : null;

    let risk = 'Low Risk';
    let color = '$green10';
    if (rate >= 99.0) {
      risk = 'Low Risk';
      color = '$green10';
    } else if (rate >= 95.0) {
      risk = 'Medium Risk';
      color = '$orange10';
    } else {
      risk = 'High Risk';
      color = '$red10';
    }

    const sorted = [...auditorSwaps].sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    return {
      successRate: rate,
      averageTime: avgTime,
      riskLabel: risk,
      uptimeColor: color,
      sortedSwaps: sorted,
    };
  }, [auditorMint, auditorSwaps]);

  const uptimeBars = useMemo(() => {
    const totalBars = 30;
    const bars: React.ReactNode[] = [];

    // If not audited, show all neutral gray bars
    if (!auditorMint || sortedSwaps.length === 0) {
      return Array.from({ length: totalBars }).map((_, idx) => (
        <View key={idx} flex={1} height={12} bg="$gray5" rounded={2} opacity={0.4} />
      ));
    }

    // Pad with placeholders on the left if we have fewer than 30 swaps
    const paddingCount = Math.max(0, totalBars - sortedSwaps.length);
    for (let i = 0; i < paddingCount; i++) {
      bars.push(
        <View key={`pad-${i}`} flex={1} height={12} bg="$gray5" rounded={2} opacity={0.4} />,
      );
    }

    // Add real swap bars (Green for OK, Red for any error status)
    sortedSwaps.forEach((swap: any) => {
      const isOk = swap.state === 'OK';
      const barColor = isOk ? '$green9' : '$red9';

      bars.push(
        <View
          key={`swap-${swap.id}`}
          flex={1}
          height={12}
          bg={barColor}
          rounded={2}
          opacity={0.85}
        />,
      );
    });

    return bars;
  }, [auditorMint, sortedSwaps]);

  const handleCopy = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.show(`${label} copied to clipboard`, { kind: 'success' });
  };

  if (isLoading || (isAlreadyAdded && !isConnecting && !connectionError)) {
    return (
      <YStack flex={1} items="center" justify="center" bg="$background">
        <Spinner size="large" color="$accentColor" />
        <Text mt="$4" color="$gray10">
          Fetching mint details...
        </Text>
      </YStack>
    );
  }

  if (!validUrl || (isAlreadyAdded && (fetchError || !fetchedInfo))) {
    return (
      <YStack flex={1} items="center" justify="center" bg="$background" p="$4" gap="$4">
        <Text color="$red10">Failed to fetch mint information.</Text>
        <AppButton
          variant="default"
          emphasis="secondary"
          size="medium"
          onPress={() => void recheckConnection()}
        >
          Try again
        </AppButton>
        <AppButton variant="default" emphasis="tertiary" size="medium" onPress={safeGoBack}>
          Go Back
        </AppButton>
      </YStack>
    );
  }

  const name =
    walletMint?.nickname ||
    info.name ||
    (() => {
      try {
        return new URL(url).hostname;
      } catch (e) {
        return url;
      }
    })();
  const description = info.description || info.description_long;
  const motd = info.motd;
  const version = info.version;
  const nuts = info.nuts || {};
  const previewTableProps = isAlreadyAdded
    ? {}
    : {
        compact: true,
        bg: '$gray3',
        separator: <YStack height={2} width="100%" bg="$background" />,
      };
  const previewUnits = [
    ...new Set([
      ...(Array.isArray(info.units)
        ? info.units.filter((unit: unknown) => typeof unit === 'string')
        : []),
      ...mintPreviewMethods(info).flatMap((method) => (method.unit ? [method.unit] : [])),
    ]),
  ];

  // Safely extract icon from store or the fetched v1/info metadata
  const iconToUse = walletMint?.icon || info.icon_url || info.picture || info.icon;

  const hostname = (() => {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return url;
    }
  })();

  return (
    <YStack flex={1} bg="$background">
      <Stack.Screen
        options={{
          title: name,
          gestureEnabled: !isConnecting,
          headerRight: isAlreadyAdded
            ? () => (
                <AppIconButton
                  variant="default"
                  emphasis="tertiary"
                  size="xsmall"

                  shape="circular"
                  accessibilityLabel="Copy"
                  icon={<Share2 size={20} color="$color" />}
                  onPress={() => handleCopy(url, 'Mint URL')}
                />
              )
            : undefined,
        }}
      />

      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        <YStack px="$4" pb="$10" gap="$6">
          {/* Header Section */}
          <YStack gap="$3">
            <XStack flexDirection={isAlreadyAdded ? 'column' : 'row'} items="center" gap="$3">
              <View
                width={isAlreadyAdded ? 100 : 64}
                height={isAlreadyAdded ? 100 : 64}
                flexShrink={0}
                rounded={isAlreadyAdded ? '$5' : '$6'}
                bg="$gray3"
                items="center"
                justify="center"
                overflow="hidden"
                borderWidth={1}
                borderColor="$color5"
              >
                <MintImage
                  mintUrl={url}
                  source={{
                    uri: iconToUse,
                    width: isAlreadyAdded ? 100 : 64,
                    height: isAlreadyAdded ? 100 : 64,
                  }}
                  fallback={<Sprout size={isAlreadyAdded ? 60 : 32} color="$accentColor" />}
                />
              </View>
              <YStack
                flex={isAlreadyAdded ? undefined : 1}
                minWidth={0}
                gap="$2"
                items={isAlreadyAdded ? 'center' : 'stretch'}
              >
                <XStack items="center" gap="$2">
                  <H2
                    letterSpacing={-1}
                    text={isAlreadyAdded ? 'center' : 'left'}
                    flexShrink={1}
                    fontSize={isAlreadyAdded ? undefined : 24}
                    lineHeight={isAlreadyAdded ? undefined : 30}
                  >
                    {name}
                  </H2>
                  {isTrusted ? (
                    <ShieldCheck size={24} color="$green10" />
                  ) : isAlreadyAdded ? (
                    <ShieldOff size={24} color="$orange10" />
                  ) : null}
                </XStack>
                <XStack
                  bg={isAlreadyAdded ? '$gray3' : 'transparent'}
                  px={isAlreadyAdded ? '$3' : 0}
                  py={isAlreadyAdded ? '$1' : 0}
                  rounded={100}
                  items="center"
                  gap="$2"
                  maxWidth="100%"
                  onPress={() => handleCopy(url, 'URL')}
                >
                  <Globe size={14} color="$gray10" />
                  <Text color="$gray10" fontSize="$3" flexShrink={1}>
                    {isAlreadyAdded ? hostname : url}
                  </Text>
                </XStack>
              </YStack>
            </XStack>
            {!isAlreadyAdded && (
              <MintReliabilityRow
                key={`score-${url}`}
                url={url}
                connection={isCheckingConnection ? 'checking' : fetchError ? 'offline' : 'online'}
                onRecheck={() => {
                  void recheckConnection({ cancelRefetch: false });
                }}
              />
            )}
            {!isAlreadyAdded && (
              <XStack gap="$3" items="center">
                <AppButton
                  variant="default"
                  emphasis="secondary"
                  size="small"
                  icon={Share2}
                  onPress={handleShare}
                >
                  Share
                </AppButton>
                <AppButton
                  variant="default"
                  emphasis="secondary"
                  size="small"
                  icon={QrCode}
                  onPress={() => setShowQr(true)}
                >
                  Show QR
                </AppButton>
              </XStack>
            )}
          </YStack>

          {/* Description */}
          {description &&
            (isAlreadyAdded ? (
              <YStack gap="$2">
                <H4 color="$gray10" fontSize="$4">
                  About
                </H4>
                <Text lineHeight={22} color="$color">
                  {description}
                </Text>
              </YStack>
            ) : (
              <YStack gap="$2">
                <Text color="$gray10" fontSize="$3">
                  About
                </Text>
                <Text lineHeight={22}>{description}</Text>
              </YStack>
            ))}
          {/* MOTD */}
          {motd &&
            (isAlreadyAdded ? (
              <View>
                <XStack gap="$3">
                  <MessageSquare color="$color" size={20} />
                  <YStack flex={1}>
                    <Text fontWeight="bold" color="$color">
                      Message of the Day
                    </Text>
                    <Text color="$color" mt="$1">
                      {motd}
                    </Text>
                  </YStack>
                </XStack>
              </View>
            ) : (
              <ListTable {...previewTableProps}>
                <YStack px="$4" py="$3" gap="$2">
                  <Text color="$gray10" fontSize="$3">
                    Message from the mint
                  </Text>
                  <Text lineHeight={22}>{motd}</Text>
                </YStack>
              </ListTable>
            ))}

          {/* General Metadata lists */}
          <YStack gap="$3">
            <H4 color="$gray10" fontSize="$4">
              Mint Details
            </H4>
            <ListTable {...previewTableProps}>
              <ListTableRow label="URL" value={hostname} isCopyable copyValue={url} />
              {version && <ListTableRow label="Version" value={version} />}
              <ListTableRow
                label={isAlreadyAdded ? 'Supported NUTs' : 'Advertised NUTs'}
                value={Object.keys(nuts).length}
                rightContent={
                  <XStack gap="$1" items="center">
                    <Text fontSize="$4" fontWeight="600" color="$color">
                      {Object.keys(nuts).length}
                    </Text>
                    <View bg="$gray4" px="$2" py="$1" rounded="$2">
                      <Text fontSize="$2" fontWeight="800">
                        NUTs
                      </Text>
                    </View>
                  </XStack>
                }
              />
              {isAlreadyAdded ? (
                <ListTableRow
                  label="Currencies"
                  rightContent={
                    <XStack gap="$1" items="center">
                      <View bg="$gray4" px="$2" py="$1" rounded="$2">
                        <Text fontSize="$2" fontWeight="800">
                          SAT
                        </Text>
                      </View>
                      {nuts['14']?.supported && (
                        <View bg="$gray4" px="$2" py="$1" rounded="$2">
                          <Text fontSize="$2" fontWeight="800">
                            USD
                          </Text>
                        </View>
                      )}
                    </XStack>
                  }
                />
              ) : (
                <ListTableRow label="Units" value={previewUnits.join(', ') || 'Not provided'} />
              )}
              {!isAlreadyAdded && info.pubkey && (
                <ListTableRow label="Public key" value={info.pubkey} isCopyable />
              )}
              {!isAlreadyAdded && info.tos_url && (
                <ListTableRow label="Terms of service" value={info.tos_url} isCopyable />
              )}
            </ListTable>
          </YStack>

          {!isAlreadyAdded && <MintPreviewMethods info={info} />}

          {/* Audit Info Section */}
          {isAlreadyAdded ? (
            <YStack gap="$3">
              <H4 color="$gray10" fontSize="$4">
                Audit Information
              </H4>
              <ListTable {...previewTableProps}>
                <YStack py="$3" px="$4" gap="$2">
                  <XStack justify="space-between" items="center">
                    <Text fontSize="$4" color="$gray10" fontWeight="600">
                      Uptime
                    </Text>
                    <Text fontSize="$4" fontWeight="700" color={uptimeColor}>
                      {successRate !== null ? `${successRate}% (${riskLabel})` : 'Not Audited'}
                    </Text>
                  </XStack>
                  <XStack gap="$1" items="center" width="100%" pt="$1">
                    {uptimeBars}
                  </XStack>
                </YStack>
                <ListTableRow
                  label="Success Rate"
                  value={successRate !== null ? `${successRate}%` : 'Not Audited'}
                />
                {averageTime !== null && (
                  <ListTableRow
                    label="Avg Response Time"
                    value={`${(averageTime / 1000).toFixed(2)}s`}
                  />
                )}
                {auditorMint && auditorMint.balance !== undefined && (
                  <ListTableRow label="Auditor Balance" value={`${auditorMint.balance} sat`} />
                )}
                {auditorMint && auditorMint.sum_donations !== undefined && (
                  <ListTableRow
                    label="Auditor Donations"
                    value={`${auditorMint.sum_donations} sat`}
                  />
                )}
              </ListTable>
            </YStack>
          ) : (
            <MintPreviewHealth
              key={url}
              url={url}
              connection={isCheckingConnection ? 'checking' : fetchError ? 'offline' : 'online'}
              connectionCheckedAt={Math.max(connectionCheckedAt, connectionErrorAt)}
              onRecheck={() => {
                void recheckConnection();
              }}
            />
          )}

          {/* Actions List */}
          {isAlreadyAdded && (
            <YStack gap="$3">
              <H4 color="$gray10" fontSize="$4">
                Actions
              </H4>
              <ListTable {...previewTableProps}>
                {isAlreadyAdded && (
                  <ListTableRow
                    label="Edit Name"
                    icon={Info}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      editNicknameRef.current?.present(url, walletMint?.nickname || info.name);
                    }}
                  />
                )}
                <ListTableRow
                  label="Copy URL"
                  icon={Copy}
                  onPress={() => handleCopy(url, 'Mint URL')}
                />
                <ListTableRow label="Share Mint" icon={Share2} onPress={handleShare} />
                {isAlreadyAdded && (
                  <ListTableRow
                    label="Delete from Wallet"
                    iconColor="$red10"
                    labelColor="$red10"
                    onPress={handleDelete}
                  />
                )}
              </ListTable>
            </YStack>
          )}

          {/* Contact (if available) */}
          {info.contact && info.contact.length > 0 && (
            <YStack gap="$3">
              <H4 color="$gray10" fontSize="$4">
                Contact & Support
              </H4>
              <ListTable {...previewTableProps}>
                {info.contact.map((c: any, i: number) => {
                  const method = Array.isArray(c) ? c[0] : c.method || 'Contact';
                  const contactInfo = Array.isArray(c) ? c[1] : c.info || '';
                  if (!contactInfo) return null;
                  return (
                    <ListTableRow
                      key={i}
                      label={method.charAt(0).toUpperCase() + method.slice(1)}
                      value={contactInfo}
                      isCopyable
                    />
                  );
                })}
              </ListTable>
            </YStack>
          )}
        </YStack>
      </ScrollView>

      <YStack
        p="$4"
        pb={insets.bottom || '$4'}
        bg="$background"
        borderTopWidth={1}
        borderTopColor="$gray4"
      >
        <AppButton
          variant="default"
          emphasis="primary"
          size="medium"
          icon={
            isTrusted ? (
              <Check size={18} />
            ) : isAlreadyAdded ? (
              <Check size={18} />
            ) : (
              <Plus size={18} />
            )
          }
          disabled={isTrusted || isConnecting}
          onPress={handleAction}
        >
          {isTrusted ? 'Mint Trusted' : isAlreadyAdded ? 'Trust this Mint' : 'Connect'}
        </AppButton>
      </YStack>

      <AppBottomSheet ref={connectionSheetRef} snapPoints={['60%']} canDismiss={!isConnecting}>
        <BottomSheetScrollView
          contentContainerStyle={{ padding: 24, paddingBottom: Math.max(insets.bottom, 24) }}
        >
          <YStack gap="$5">
            <Text fontSize="$6" fontWeight="600" textAlign="center">
              Connect to mint
            </Text>
            <YStack items="center" gap="$2">
              <View width={64} height={64} rounded="$6" overflow="hidden" bg="$gray3">
                <MintImage mintUrl={url} source={{ uri: iconToUse, width: 64, height: 64 }} />
              </View>
              <Text fontSize="$5" fontWeight="600" textAlign="center">
                {name}
              </Text>
              <Text color="$gray10" textAlign="center" selectable>
                {url}
              </Text>
            </YStack>
            <Text color="$gray10" fontSize="$4">
              This mint holds the bitcoin backing your ecash. You depend on its operator to redeem
              it. Bey Wallet does not operate this mint and is not responsible for losses caused by
              it. Only connect if you trust the operator.
            </Text>
            {connectionError && (
              <Text color="$red10" accessibilityRole="alert">
                {connectionError}
              </Text>
            )}
            <AppButton
              variant="default"
              emphasis="primary"
              size="medium"
              loading={isConnecting}
              loadingText="Connecting to mint…"
              disabled={isConnecting}
              onPress={handleConfirmConnection}
            >
              Confirm
            </AppButton>
          </YStack>
        </BottomSheetScrollView>
      </AppBottomSheet>
      <AddMintModal ref={addMintRef} />
      <EditNicknameModal ref={editNicknameRef} />
      {!isAlreadyAdded && (
        <MintUrlQrOverlay url={url} visible={showQr} onClose={() => setShowQr(false)} />
      )}
    </YStack>
  );
}
