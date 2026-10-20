import { MintImage } from '~/shared/ui/RemoteImage';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppButton } from '~/shared/ui/AppButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import { Check, ChevronDown, Sprout, Plus, Landmark, X } from '@tamagui/lucide-icons';
import { Text, YStack, XStack, View, Avatar, Square } from 'tamagui';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import React, {
  useRef,
  useMemo,
  useCallback,
  useState,
  useEffect,
  useImperativeHandle,
} from 'react';
import * as Network from 'expo-network';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';
import AppBottomSheet, { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { Spinner } from '~/shared/ui/Spinner';
import { useRouter } from 'expo-router';
import { supportsPaymentMethod, type PaymentMintMethod } from '~/services/wallet/paymentMintPolicy';
import { mintManager } from '~/services/wallet/mintManager';
import { bitcoinService } from '~/services/api/bitcoinService';
import { currencyService, type CurrencyCode } from '~/services/wallet/currencyService';
import { mintUrlKey } from '~/shared/utils/mintUrl';

export interface MintSelectorSheetProps {
  onOpenChange?: (open: boolean) => void;
  onSelect?: (mintUrl: string) => void | Promise<void>;
  activeMintUrl?: string;
  showAllOption?: boolean;
  changeGlobalActiveMint?: boolean;
  trustedOnly?: boolean;
  allowedMintUrls?: string[];
  method?: PaymentMintMethod;
}

// Let the pending/check state paint before work or dismissal, without a fixed delay.
const afterPaint = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

interface MintChoice {
  url: string;
  name: string;
  icon?: string;
  balance: number;
}

const MintChoiceRow = React.memo(function MintChoiceRow({
  url,
  name,
  icon,
  balance,
  selected,
  pending,
  disabled,
  onSelect,
}: {
  url: string;
  name: string;
  icon?: string;
  balance: string;
  selected: boolean;
  pending: boolean;
  disabled: boolean;
  onSelect: (url: string) => void;
}) {
  return (
    <AppPressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${balance}`}
      accessibilityState={{ selected, busy: pending, disabled }}
      disabled={disabled}
      minHeight={76}
      px="$4"
      py="$3"
      flexDirection="row"
      items="center"
      gap="$3"
      pressStyle={{ bg: '$gray3' }}
      onPress={() => onSelect(url)}
    >
      {url === 'all' ? (
        <View width={48} height={48} rounded={10} bg="$gray4" items="center" justify="center">
          <Landmark size={22} color="$gray10" />
        </View>
      ) : (
        <MintImage
          mintUrl={url}
          src={icon}
          width={48}
          height={48}
          borderRadius={10}
          flexShrink={0}
          fallback={<Landmark size={22} color="$gray10" />}
        />
      )}
      <YStack flex={1} minWidth={0} gap="$1">
        <Text fontSize="$5" fontWeight="500" color="$color" numberOfLines={1}>
          {name}
        </Text>
        <Text fontSize="$3" color="$gray10" numberOfLines={1}>
          {balance}
        </Text>
      </YStack>
      <View width={24} height={24} items="center" justify="center" flexShrink={0}>
        {pending ? (
          <Spinner size={22} color="$buttonBrandedPrimary" />
        ) : selected ? (
          <Check size={22} color="$buttonBrandedPrimary" strokeWidth={3.5} />
        ) : null}
      </View>
    </AppPressable>
  );
});

export const MintSelectorSheet = React.forwardRef<AppBottomSheetRef, MintSelectorSheetProps>(
  function MintSelectorSheet(
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
  ) {
    const storeActiveMintUrl = useWalletStore((s) => s.activeMintUrl);
    const balances = useWalletStore((s) => s.balances);
    const storedMints = useWalletStore((s) => s.mints);
    const setActiveMint = useWalletStore((s) => s.setActiveMint);
    const primaryCurrency = useSettingsStore((s) => s.primaryCurrency);
    const secondaryCurrency = useSettingsStore((s) => s.secondaryCurrency);
    const showBitcoinSymbol = useSettingsStore((s) => s.showBitcoinSymbol);
    const hideBalance = useSettingsStore((s) => s.hideBalance);
    const sheetRef = useRef<AppBottomSheetRef>(null);
    const selectionLock = useRef(false);
    const mounted = useRef(true);
    const [switchingUrl, setSwitchingUrl] = useState<string | null>(null);
    const [completedUrl, setCompletedUrl] = useState<string | null>(null);
    const [selectionError, setSelectionError] = useState<string | null>(null);
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const activeMintUrl = propActiveMintUrl !== undefined ? propActiveMintUrl : storeActiveMintUrl;
    const locked = switchingUrl !== null || completedUrl !== null;

    useEffect(() => {
      mounted.current = true;
      return () => {
        mounted.current = false;
      };
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        present: () => {
          if (selectionLock.current) return;
          setSelectionError(null);
          setCompletedUrl(null);
          sheetRef.current?.present();
        },
        dismiss: () => {
          if (!selectionLock.current) sheetRef.current?.dismiss();
        },
      }),
      [],
    );

    const candidates = useMemo(
      () =>
        storedMints.filter(
          (mint) =>
            (!trustedOnly || mint.trusted) &&
            (!allowedMintUrls || allowedMintUrls.includes(mint.mintUrl)) &&
            (!method || mint.trusted),
        ),
      [storedMints, trustedOnly, allowedMintUrls, method],
    );
    const candidateUrls = useMemo(
      () => candidates.map((mint) => mint.mintUrl).sort(),
      [candidates],
    );
    const capabilities = useQuery({
      queryKey: ['mint-selector-capabilities', candidateUrls],
      // Registered SDK mints already contain validated metadata. Reading it must not
      // re-add every mint or make the selector wait for network refreshes.
      queryFn: () => mintManager.getAllMints(),
      enabled: !!method && candidates.length > 0,
      networkMode: 'always',
      staleTime: 5 * 60 * 1000,
      retry: false,
    });
    const mints = useMemo(
      () =>
        candidates.filter(
          (mint) =>
            !method ||
            supportsPaymentMethod(
              capabilities.data?.find((item) => item.mintUrl === mint.mintUrl)?.mintInfo,
              method,
            ),
        ),
      [candidates, method, capabilities.data],
    );
    const eligibleUrls = useRef(new Set<string>());
    eligibleUrls.current = new Set(mints.map((mint) => mint.mintUrl));

    const displayAsSats = primaryCurrency === 'SATS' || secondaryCurrency === 'NONE';
    const cachedPrice = useMemo(
      () =>
        displayAsSats ? undefined : (bitcoinService.getCachedPrice(secondaryCurrency) ?? undefined),
      [displayAsSats, secondaryCurrency],
    );
    const { data: btcData } = useQuery({
      queryKey: ['bitcoinPrice', secondaryCurrency],
      queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
      enabled: !displayAsSats,
      initialData: cachedPrice,
      initialDataUpdatedAt: cachedPrice ? cachedPrice.updatedAt * 1000 : undefined,
      staleTime: 30_000,
    });
    const formatBalance = useCallback(
      (balance: number) => {
        if (hideBalance) return '****';
        if (!displayAsSats && (balance === 0 || btcData?.price)) {
          const fiat =
            balance === 0 ? 0 : currencyService.convertSatsToCurrency(balance, btcData!.price);
          return currencyService.formatValue(fiat, secondaryCurrency as CurrencyCode);
        }
        return showBitcoinSymbol
          ? `₿${balance.toLocaleString()}`
          : `${balance.toLocaleString()} sat`;
      },
      [hideBalance, displayAsSats, btcData?.price, secondaryCurrency, showBitcoinSymbol],
    );
    const choices = useMemo<MintChoice[]>(() => {
      const rows = mints.map((mint) => ({
        url: mint.mintUrl,
        name:
          mint.nickname || mint.name || mint.mintUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''),
        icon: mint.icon,
        balance: balances[mint.mintUrl] ?? 0,
      }));
      return showAllOption
        ? [
            {
              url: 'all',
              name: 'All mints',
              balance: rows.reduce((sum, mint) => sum + mint.balance, 0),
            },
            ...rows,
          ]
        : rows;
    }, [mints, balances, showAllOption]);

    const handleSelectMint = useCallback(
      async (mintUrl: string) => {
        if (selectionLock.current) return;
        if (
          changeGlobalActiveMint &&
          !onSelect &&
          mintUrl !== 'all' &&
          mintUrlKey(useWalletStore.getState().activeMintUrl || '') === mintUrlKey(mintUrl)
        ) {
          sheetRef.current?.dismiss();
          return;
        }
        selectionLock.current = true;
        setSwitchingUrl(mintUrl);
        setCompletedUrl(null);
        setSelectionError(null);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
          await afterPaint();
          if (!mounted.current) return;
          if (mintUrl !== 'all' && !eligibleUrls.current.has(mintUrl)) {
            throw new Error('This mint is no longer available for this selection.');
          }
          if (mintUrl !== 'all' && changeGlobalActiveMint) {
            await setActiveMint(mintUrl);
            if (mintUrlKey(useWalletStore.getState().activeMintUrl || '') !== mintUrlKey(mintUrl)) {
              throw new Error('Could not switch mint. Please try again.');
            }
          }
          await onSelect?.(mintUrl);
          if (!mounted.current) return;
          setSwitchingUrl(null);
          setCompletedUrl(mintUrl);
          await afterPaint();
          if (mounted.current) sheetRef.current?.dismiss();
        } catch (error) {
          selectionLock.current = false;
          if (mounted.current) {
            setSwitchingUrl(null);
            setCompletedUrl(null);
            setSelectionError(
              error instanceof Error ? error.message : 'Could not select mint. Please try again.',
            );
          }
        }
      },
      [setActiveMint, onSelect, changeGlobalActiveMint],
    );

    const handleClose = useCallback(() => {
      if (!selectionLock.current) sheetRef.current?.dismiss();
    }, []);
    const handleOpenChange = useCallback(
      (open: boolean) => {
        if (!open) {
          selectionLock.current = false;
          setSwitchingUrl(null);
          setCompletedUrl(null);
        }
        onOpenChange?.(open);
      },
      [onOpenChange],
    );
    const handleAddMint = useCallback(() => {
      if (selectionLock.current) return;
      sheetRef.current?.dismiss();
      router.push('/(modals)/add-mint');
    }, [router]);
    const checkingMethods = !!method && candidates.length > 0 && capabilities.isPending;
    const snapPoints = useMemo(
      () => [
        Math.min(
          height * 0.85,
          Math.max(
            220,
            88 +
              Math.max(choices.length, checkingMethods ? candidates.length : 1) * 76 +
              Math.max(insets.bottom, 16),
          ),
        ),
      ],
      [height, choices.length, checkingMethods, candidates.length, insets.bottom],
    );
    const renderItem = useCallback(
      ({ item }: { item: MintChoice }) => (
        <MintChoiceRow
          url={item.url}
          name={item.name}
          icon={item.icon}
          balance={formatBalance(item.balance)}
          selected={mintUrlKey(completedUrl ?? activeMintUrl ?? '') === mintUrlKey(item.url)}
          pending={switchingUrl === item.url}
          disabled={locked}
          onSelect={handleSelectMint}
        />
      ),
      [formatBalance, completedUrl, activeMintUrl, switchingUrl, locked, handleSelectMint],
    );

    return (
      <AppBottomSheet
        ref={sheetRef}
        snapPoints={snapPoints}
        backgroundColor="$gray2"
        canDismiss={switchingUrl === null}
        onOpenChange={handleOpenChange}
      >
        <YStack flex={1} minWidth={0}>
          <XStack px="$4" py="$2" items="center" gap="$3">
            <AppIconButton
              variant="default"
              emphasis="tertiary"
              size="xsmall"
              shape="circular"
              accessibilityLabel="Close mint selector"
              disabled={locked}
              icon={X}
              onPress={handleClose}
            />
            <Text flex={1} textAlign="center" fontSize="$6" fontWeight="600" color="$color">
              Choose mint
            </Text>
            <AppIconButton
              variant="default"
              emphasis="tertiary"
              size="xsmall"
              shape="circular"
              accessibilityLabel="Add mint"
              disabled={locked}
              icon={Plus}
              onPress={handleAddMint}
            />
          </XStack>
          {selectionError && (
            <Text accessibilityRole="alert" color="$red11" fontSize="$3" px="$4" pb="$2">
              {selectionError}
            </Text>
          )}
          <BottomSheetFlatList
            style={{ flex: 1 }}
            data={choices}
            keyExtractor={(item: MintChoice) => item.url}
            renderItem={renderItem}
            extraData={`${switchingUrl}:${completedUrl}:${activeMintUrl}:${hideBalance}`}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={5}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
            ListEmptyComponent={
              <YStack px="$5" py="$6" gap="$3" items="center">
                {checkingMethods ? <Spinner size={22} /> : <Sprout size={32} color="$gray10" />}
                <Text textAlign="center" color="$gray10">
                  {checkingMethods
                    ? 'Checking available mints…'
                    : capabilities.isError && method
                      ? 'Could not check available mints.'
                      : storedMints.length
                        ? 'No mints match this selection.'
                        : 'No connected mints yet.'}
                </Text>
                {method && capabilities.isError && (
                  <AppButton
                    variant="default"
                    emphasis="secondary"
                    size="small"
                    onPress={() => void capabilities.refetch()}
                  >
                    Try again
                  </AppButton>
                )}
              </YStack>
            }
          />
        </YStack>
      </AppBottomSheet>
    );
  },
);

export default function HomeHeaderMintSelector() {
  const [expanded, setExpanded] = useState(false);
  const activeMintUrl = useWalletStore((s) => s.activeMintUrl);
  const mints = useWalletStore((s) => s.mints);
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

  const isLoading = (isInitializing || isRefreshing) && mints.length === 0;
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
        rounded="$5"
        bg={isOffline ? '$red10' : '$blue10'}
        px={isLoading ? '$3' : '$1.5'}
        borderWidth={0}
        disabled={isLoading}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
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
