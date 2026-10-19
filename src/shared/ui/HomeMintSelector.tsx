import { MintImage } from '~/shared/ui/RemoteImage';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppButton } from '~/shared/ui/AppButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import {
  ChevronDown,
  Sprout,
  Plus,
  ShieldCheck,
  ShieldOff,
  Edit3,
  Landmark,
  X,
} from '@tamagui/lucide-icons';
import { Text, YStack, XStack, View, Avatar, Square } from 'tamagui';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import * as Network from 'expo-network';
import { useWalletStore } from '~/state/walletStore';
import AppBottomSheet, { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import EditNicknameModal, { EditNicknameModalRef } from '~/shared/ui/EditNicknameModal';
import { Spinner } from '~/shared/ui/Spinner';
import { useRouter } from 'expo-router';
import { supportsPaymentMethod, type PaymentMintMethod } from '~/services/wallet/paymentMintPolicy';
import { mintManager } from '~/services/wallet/mintManager';

export interface MintSelectorSheetProps {
  onOpenChange?: (open: boolean) => void;
  onSelect?: (mintUrl: string) => void;
  activeMintUrl?: string;
  showAllOption?: boolean;
  changeGlobalActiveMint?: boolean;
  trustedOnly?: boolean;
  allowedMintUrls?: string[];
  method?: PaymentMintMethod;
}

export const MintSelectorSheet = React.forwardRef<AppBottomSheetRef, MintSelectorSheetProps>(
  (
    {
      onSelect,
      onOpenChange,
      activeMintUrl: propActiveMintUrl,
      showAllOption,
      changeGlobalActiveMint = true,
      trustedOnly = false,
      allowedMintUrls,
      method,
    },
    ref,
  ) => {
    const storeActiveMintUrl = useWalletStore((s) => s.activeMintUrl);
    const balances = useWalletStore((s) => s.balances);
    const storedMints = useWalletStore((s) => s.mints);
    const [compatibleUrls, setCompatibleUrls] = useState<string[]>([]);
    useEffect(() => {
      let cancelled = false;
      setCompatibleUrls([]);
      if (method)
        void Promise.all(
          storedMints
            .filter((m) => m.trusted)
            .map(async (m) => {
              try {
                return supportsPaymentMethod(await mintManager.getMintInfo(m.mintUrl), method)
                  ? m.mintUrl
                  : null;
              } catch {
                return null;
              }
            }),
        ).then((urls) => {
          if (!cancelled) setCompatibleUrls(urls.filter((u): u is string => u !== null));
        });
      return () => {
        cancelled = true;
      };
    }, [storedMints, method]);
    const mints = storedMints.filter(
      (m) =>
        (!trustedOnly || m.trusted) &&
        (!allowedMintUrls || allowedMintUrls.includes(m.mintUrl)) &&
        (!method || compatibleUrls.includes(m.mintUrl)),
    );
    const setActiveMint = useWalletStore((s) => s.setActiveMint);
    const router = useRouter();

    const activeMintUrl = propActiveMintUrl !== undefined ? propActiveMintUrl : storeActiveMintUrl;

    const handleSelectMint = useCallback(
      (mintUrl: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (mintUrl !== 'all' && changeGlobalActiveMint) {
          setActiveMint(mintUrl);
        }
        if (onSelect) {
          onSelect(mintUrl);
        }
        if (ref && 'current' in ref && ref.current) {
          (ref as React.RefObject<AppBottomSheetRef>).current?.dismiss();
        }
      },
      [setActiveMint, onSelect, ref, changeGlobalActiveMint],
    );

    const handleClose = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (ref && 'current' in ref && ref.current) {
        (ref as React.RefObject<AppBottomSheetRef>).current?.dismiss();
      }
    }, [ref]);

    const handleAddMint = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (ref && 'current' in ref && ref.current) {
        (ref as React.RefObject<AppBottomSheetRef>).current?.dismiss();
      }
      setTimeout(() => {
        router.push('/(modals)/add-mint');
      }, 100);
    }, [router, ref]);

    const editNicknameRef = useRef<EditNicknameModalRef>(null);

    const handleEditNickname = useCallback((mint: any) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      editNicknameRef.current?.present(mint.mintUrl, mint.nickname);
    }, []);

    const snapPoints = useMemo(() => {
      const itemCount = mints.length + (showAllOption ? 1 : 0);
      if (itemCount === 0) return ['32%'];
      if (itemCount === 1) return ['38%'];
      if (itemCount === 2) return ['48%'];
      if (itemCount === 3) return ['58%'];
      if (itemCount === 4) return ['68%'];
      return ['80%'];
    }, [mints.length, showAllOption]);

    return (
      <>
        <AppBottomSheet
          ref={ref}
          snapPoints={snapPoints}
          backgroundColor="$gray2"
          onOpenChange={onOpenChange}
        >
          <YStack p="$4" pt="$2" gap="$4" flex={1} width="100%" minW={0}>
            {/* Custom Header matching ActionSelectorSheet */}
            <XStack items="center" justify="space-between" width="100%" pb="$2" gap="$2" minW={0}>
              <XStack items="center" gap="$2" flex={1} minW={0}>
                <AppIconButton
                  variant="default"
                  emphasis="tertiary"
                  size="xsmall"
                  flexShrink={0}
                  shape="circular"
                  accessibilityLabel="Close"
                  icon={<X size={20} color="$color" strokeWidth={3} />}
                  onPress={handleClose}
                />
                <Text
                  fontSize="$6"
                  fontWeight="800"
                  color="$accent1"
                  flexShrink={1}
                  numberOfLines={2}
                >
                  Select Mint
                </Text>
              </XStack>
              <AppButton
                variant="branded"
                emphasis="primary"
                size="small"
                flexShrink={0}
                icon={<Plus size={20} color="$color" strokeWidth={3} />}
                onPress={handleAddMint}
              >
                Add
              </AppButton>
            </XStack>

            <BottomSheetScrollView
              showsVerticalScrollIndicator={false}
              style={{ flex: 1, width: '100%' }}
            >
              <YStack gap="$2" pb="$4" width="100%" minW={0}>
                {showAllOption && (
                  <XStack
                    key="all-mints"
                    width="100%"
                    minW={0}
                    justify="space-between"
                    items="center"
                    onPress={() => handleSelectMint('all')}
                    pressStyle={{ scale: 0.98, bg: '$gray4' }}
                    p="$3"
                    bg="$gray4"
                    borderWidth={1.5}
                    borderColor={activeMintUrl === 'all' ? '$accentColor' : 'transparent'}
                    rounded="$6"
                  >
                    <XStack gap="$3" items="center" flex={1} minW={0}>
                      <View
                        bg="$gray3"
                        p="$2.5"
                        rounded="$5"
                        overflow="hidden"
                        width={48}
                        height={48}
                        flexShrink={0}
                        items="center"
                        justify="center"
                      >
                        <Landmark size={20} color="$gray10" />
                      </View>
                      <YStack gap="$0.5" flex={1} minW={0}>
                        <Text fontWeight="700" fontSize="$5" color="$accent3" numberOfLines={1}>
                          All Mints
                        </Text>
                        <Text fontSize="$3" color="$gray10">
                          Show history from all mints
                        </Text>
                      </YStack>
                    </XStack>
                    <XStack items="center" justify="center" pl="$2" flexShrink={0}>
                      {activeMintUrl === 'all' ? (
                        <View
                          width={22}
                          height={22}
                          rounded={11}
                          borderWidth={2}
                          borderColor="$color"
                          items="center"
                          justify="center"
                        >
                          <View width={12} height={12} rounded={6} bg="$color" />
                        </View>
                      ) : (
                        <View
                          width={22}
                          height={22}
                          rounded={11}
                          borderWidth={1.5}
                          borderColor="$gray8"
                        />
                      )}
                    </XStack>
                  </XStack>
                )}

                {mints.length === 0 ? (
                  <YStack items="center" py="$6" gap="$2">
                    <Sprout size={40} color="$gray8" />
                    <Text color="$gray10">No mints added yet</Text>
                  </YStack>
                ) : (
                  mints.map((mint) => (
                    <XStack
                      key={mint.mintUrl}
                      width="100%"
                      minW={0}
                      justify="space-between"
                      items="center"
                      onPress={() => handleSelectMint(mint.mintUrl)}
                      pressStyle={{ scale: 0.98, bg: '$gray4' }}
                      p="$3"
                      bg="$gray4"
                      borderWidth={1.5}
                      borderColor={activeMintUrl === mint.mintUrl ? '$accentColor' : 'transparent'}
                      rounded="$6"
                    >
                      <XStack gap="$3" items="center" flex={1} minW={0}>
                        <View
                          bg={mint.trusted ? '$green3' : '$gray3'}
                          p="$0"
                          rounded="$5"
                          overflow="hidden"
                          width={48}
                          height={48}
                          flexShrink={0}
                          items="center"
                          justify="center"
                        >
                          <MintImage
                            mintUrl={mint.mintUrl}
                            source={{ uri: mint.icon }}
                            width={48}
                            height={48}
                            rounded="$5"
                            resizeMode="cover"
                            fallback={
                              mint.trusted ? (
                                <ShieldCheck size={20} color="$green10" />
                              ) : (
                                <ShieldOff size={20} color="$gray10" />
                              )
                            }
                          />
                        </View>
                        <YStack gap="$0.5" flex={1} minW={0}>
                          <XStack items="center" gap="$1.5" minW={0}>
                            <Text
                              fontWeight="700"
                              fontSize="$5"
                              color="$accent3"
                              numberOfLines={1}
                              flex={1}
                              minW={0}
                              flexShrink={1}
                            >
                              {mint.nickname ||
                                mint.name ||
                                mint.mintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                            </Text>
                            <AppIconButton
                              variant="default"
                              emphasis="tertiary"
                              size="xxsmall"
                              flexShrink={0}
                              shape="circular"
                              accessibilityLabel="Edit nickname"
                              icon={<Edit3 size={12} color="$gray10" />}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleEditNickname(mint);
                              }}
                            />
                          </XStack>
                          <Text fontWeight="600" fontSize="$4" numberOfLines={1} color="$accent6">
                            {balances[mint.mintUrl] !== undefined
                              ? `₿${balances[mint.mintUrl]}`
                              : '₿0'}
                          </Text>
                        </YStack>
                      </XStack>
                      <XStack items="center" justify="center" pl="$2" flexShrink={0}>
                        {activeMintUrl === mint.mintUrl ? (
                          <View
                            width={22}
                            height={22}
                            rounded={11}
                            borderWidth={2}
                            borderColor="$color"
                            items="center"
                            justify="center"
                          >
                            <View width={12} height={12} rounded={6} bg="$color" />
                          </View>
                        ) : (
                          <View
                            width={22}
                            height={22}
                            rounded={11}
                            borderWidth={1.5}
                            borderColor="$gray8"
                          />
                        )}
                      </XStack>
                    </XStack>
                  ))
                )}
              </YStack>
            </BottomSheetScrollView>
          </YStack>
        </AppBottomSheet>
        <EditNicknameModal ref={editNicknameRef} />
      </>
    );
  },
);

export default function HomeHeaderMintSelector() {
  const [expanded, setExpanded] = useState(false);
  const activeMintUrl = useWalletStore((s) => s.activeMintUrl);
  const mints = useWalletStore((s) => s.mints);
  const refreshMintList = useWalletStore((s) => s.refreshMintList);
  const isInitializing = useWalletStore((s) => s.isInitializing);
  const isRefreshing = useWalletStore((s) => s.isRefreshing);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const checkNetwork = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        setIsOffline(!state.isConnected || !state.isInternetReachable);
      } catch (e) {
        setIsOffline(false);
      }
    };
    checkNetwork();
    const interval = setInterval(checkNetwork, 4000);
    return () => clearInterval(interval);
  }, []);

  const isLoading = isInitializing || isRefreshing;
  const sheetRef = useRef<AppBottomSheetRef>(null);

  const normalizeUrl = (url: string) => url.replace(/\/$/, '');

  const activeMint = useMemo(() => {
    if (!activeMintUrl) return null;
    return mints.find((m) => normalizeUrl(m.mintUrl) === normalizeUrl(activeMintUrl));
  }, [mints, activeMintUrl]);

  const displayUrl = activeMintUrl
    ? activeMintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
    : 'Select Mint';

  const displayName = useMemo(() => {
    if (!activeMintUrl) return 'Select Mint';
    if (activeMint?.nickname) return activeMint.nickname;
    if (activeMint?.name) return activeMint.name;

    return displayUrl;
  }, [activeMint, activeMintUrl, displayUrl]);

  return (
    <>
      <AppPressable
        py={4}
        accessibilityState={{ expanded, busy: isLoading }}
        rounded="$4"
        bg={isOffline ? '$red10' : '$blue10'}
        px={isLoading ? '$3' : '$1.5'}
        borderWidth={0}
        disabled={isLoading}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
          refreshMintList();
          sheetRef.current?.present();
        }}
        maxW={170}
        minW={0}
        flexShrink={1}
        pressStyle={{ scale: 0.97, opacity: 0.95, bg: isOffline ? '$red11' : '$blue11' }}
        minHeight={36}
        flexDirection="row"
        items="center"
        justify="center"
        gap={8}
      >
        {isLoading ? (
          <Spinner size={14} color="white" />
        ) : (
          <Avatar rounded="$3" size="$2" flexShrink={0}>
            <MintImage
              mintUrl={activeMint?.mintUrl}
              width="100%"
              height="100%"
              src={activeMint?.icon}
            />
          </Avatar>
        )}

        <Text
          {...{
            fontSize: '$3',
            fontWeight: '700',
            flexShrink: 1,
            minWidth: 0,
            numberOfLines: 1,
            color: 'white',
          }}
        >
          {isLoading ? 'Loading...' : displayName}
        </Text>

        {isLoading ? undefined : (
          <Square
            size="$2"
            flexShrink={0}
            borderWidth={0.5}
            borderColor="rgba(255,255,255,0.2)"
            bg="rgba(255,255,255,0.15)"
            rounded="$3"
          >
            <ChevronDown size={16} strokeWidth={3} color="white" />
          </Square>
        )}
      </AppPressable>

      <MintSelectorSheet ref={sheetRef} onOpenChange={setExpanded} />
    </>
  );
}
