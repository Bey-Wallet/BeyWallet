import React from 'react';
import { RefreshControl } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ChevronRight, Plus } from '@tamagui/lucide-icons';
import { ScrollView, Separator, XStack, YStack } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppButton } from '~/shared/ui/AppButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import { AppText } from '~/shared/ui/AppText';
import { MintImage } from '~/shared/ui/RemoteImage';
import { Spinner } from '~/shared/ui/Spinner';
import { paymentAmounts } from '~/shared/ui/PaymentAmount';
import { useMintInfo } from '~/shared/hooks/useMintInfo';
import { useOfflineStatus } from '~/shared/hooks/useOfflineStatus';
import { bitcoinService } from '~/services/api/bitcoinService';
import type { MintInfo } from '~/services/wallet';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';
import { appSpacing } from '~/shared/theme/appearance';

const metadataText = (value: unknown) => (typeof value === 'string' ? value : undefined);

function MintRow({
  mint,
  amount,
  onPress,
}: {
  mint: MintInfo;
  amount: string;
  onPress: () => void;
}) {
  const offline = useOfflineStatus();
  const { data: info, isFetching, error } = useMintInfo(mint.mintUrl, { enabled: !offline });
  let hostname = mint.mintUrl;
  try {
    hostname = new URL(mint.mintUrl).hostname;
  } catch {
    /* Keep legacy URLs readable. */
  }
  const name = mint.nickname || mint.name || metadataText(info?.name) || hostname;
  const status = offline
    ? 'Device offline'
    : isFetching
      ? 'Checking…'
      : error
        ? 'Unreachable'
        : info
          ? 'Online'
          : 'Status unavailable';
  return (
    <AppPressable
      minHeight={76}
      p="$3"
      flexDirection="row"
      items="center"
      gap="$3"
      accessibilityLabel={`Manage ${name}, ${amount}${mint.trusted ? '' : ', not trusted'}`}
      pressStyle={{ bg: '$gray3' }}
      onPress={onPress}
    >
      <MintImage
        mintUrl={mint.mintUrl}
        src={
          mint.icon ||
          metadataText(info?.icon_url) ||
          metadataText(info?.picture) ||
          metadataText(info?.icon)
        }
        width={40}
        height={40}
        rounded="$6"
        flexShrink={0}
      />
      <YStack flex={1} minWidth={0} gap="$1">
        <AppText variant="label1" numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="body3" tone="secondary" numberOfLines={1}>
          {hostname}
        </AppText>
        <AppText variant="body3" tone={!offline && error ? 'error' : 'secondary'}>
          {status}
          {!mint.trusted ? ' · Not trusted' : ''}
        </AppText>
      </YStack>
      <AppText
        variant="label1"
        textAlign="right"
        flexShrink={1}
        maxWidth="45%"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {amount}
      </AppText>
      <ChevronRight size={20} color="$gray10" />
    </AppPressable>
  );
}

/** Home and Settings share this management destination; adding is a separate task. */
export default function MintsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { mints, balances, isInitializing, isRefreshing, refreshMintList, refreshBalance } =
    useWalletStore();
  const { primaryCurrency, secondaryCurrency, showBitcoinSymbol, hideBalance } = useSettingsStore();
  const { data: price } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
    enabled: secondaryCurrency !== 'NONE',
  });
  return (
    <YStack flex={1} bg="$background">
      <Stack.Screen options={{ title: 'Mints' }} />
      <ScrollView
        flex={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: appSpacing.page }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={async () => {
              await refreshMintList();
              await Promise.all([
                refreshBalance(),
                queryClient.invalidateQueries({ queryKey: ['mint-metadata'] }),
              ]);
            }}
          />
        }
      >
        <YStack gap={appSpacing.page}>
          <AppText tone="secondary">
            Each mint holds a separate balance. Tap a mint to manage it.
          </AppText>
          {isInitializing && !mints.length ? (
            <Spinner size="large" />
          ) : !mints.length ? (
            <YStack bg="$gray2" rounded="$6" p="$4" gap="$2">
              <AppText variant="label1">No mints yet</AppText>
              <AppText tone="secondary">Add a mint to start sending and receiving ecash.</AppText>
            </YStack>
          ) : (
            <YStack bg="$gray2" rounded="$6" overflow="hidden">
              {mints.map((mint, index) => {
                const values = paymentAmounts(
                  balances[mint.mintUrl] ?? 0,
                  primaryCurrency,
                  secondaryCurrency,
                  showBitcoinSymbol,
                  price?.price,
                );
                return (
                  <React.Fragment key={mint.mintUrl}>
                    {index > 0 && <Separator height={2} borderWidth={0} bg="$background" />}
                    <MintRow
                      mint={mint}
                      amount={hideBalance ? '****' : (values.primary ?? values.secondary ?? '')}
                      onPress={() =>
                        router.push({
                          pathname: '/(modals)/mint-details',
                          params: { mintUrl: mint.mintUrl },
                        })
                      }
                    />
                  </React.Fragment>
                );
              })}
            </YStack>
          )}
        </YStack>
      </ScrollView>
      <YStack px={appSpacing.page} pt={appSpacing.gap} pb={insets.bottom + appSpacing.page}>
        <AppButton
          size="large"
          emphasis="primary"
          icon={Plus}
          onPress={() => router.push('/(modals)/add-mint')}
        >
          Add mint
        </AppButton>
      </YStack>
    </YStack>
  );
}
