import { hapticService } from '~/services/platform/hapticService';
import { useConnectedMintSheet } from './hooks/useConnectedMintSheet';
import React, { useEffect, useRef, useState } from 'react';
import { RefreshControl } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Check, ChevronRight, ListChecks, Plus, Trash2 } from '@tamagui/lucide-icons';
import { ScrollView, Separator, XStack, YStack } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppButton } from '~/shared/ui/AppButton';
import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
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
import AppBottomSheet, { type AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { BUICheckboxVisual } from '~/shared/ui/BUI/BUISelectionControl';
import { useSettingsBusy } from '~/features/settings/hooks/useSettingsBusy';
import {
  inspectConnectedMints,
  mintRemovalMessages,
  removeConnectedMints,
} from '~/services/wallet/connectedMintRemoval';

const metadataText = (value: unknown) => (typeof value === 'string' ? value : undefined);

function MintRow({
  mint,
  amount,
  onPress,
  selecting = false,
  checked = false,
  blocked,
  disabled = false,
}: {
  mint: MintInfo;
  amount: string;
  onPress: () => void;
  selecting?: boolean;
  checked?: boolean;
  blocked?: string;
  disabled?: boolean;
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
      accessibilityRole={selecting ? 'checkbox' : 'button'}
      accessibilityState={{
        checked: selecting ? checked : undefined,
        disabled: disabled || (selecting && !!blocked),
      }}
      accessibilityLabel={
        selecting
          ? `${name}, ${blocked || (checked ? 'selected' : 'not selected')}`
          : `Manage ${name}, ${amount}${mint.trusted ? '' : ', not trusted'}`
      }
      disabled={disabled || (selecting && !!blocked)}
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
          {blocked || status}
          {!blocked && !mint.trusted ? ' · Not trusted' : ''}
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
      {selecting ? (
        <BUICheckboxVisual checked={checked} disabled={disabled || !!blocked} />
      ) : (
        <ChevronRight size={20} color="$gray10" />
      )}
    </AppPressable>
  );
}

/** Home and Settings share this management destination; adding is a separate task. */
export default function MintsScreen() {
  const { openMint, mintSheet } = useConnectedMintSheet();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { mints, balances, isInitializing, isRefreshing, refreshMintList, refreshBalance } =
    useWalletStore();
  const { primaryCurrency, secondaryCurrency, showBitcoinSymbol, hideBalance } = useSettingsStore();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const removing = useRef(false);
  const closeAfterRemoval = useRef(false);
  const sheet = useRef<AppBottomSheetRef>(null);
  useSettingsBusy(busy);
  const eligibility = useQuery({
    queryKey: ['mint-removal', mints.map((mint) => mint.mintUrl), balances],
    queryFn: () => inspectConnectedMints(mints.map((mint) => mint.mintUrl)),
    enabled: selecting && mints.length > 0,
    staleTime: 0,
  });
  const removable = mints
    .filter((mint) => eligibility.data?.[mint.mintUrl] === null)
    .map((mint) => mint.mintUrl);
  const selectedUrls = selected.filter((url) => removable.includes(url));
  const selectedMints = mints.filter((mint) => selectedUrls.includes(mint.mintUrl));
  useEffect(() => {
    if (!busy && closeAfterRemoval.current) {
      closeAfterRemoval.current = false;
      sheet.current?.dismiss();
    }
  }, [busy]);
  const toggle = (url: string) => {
    if (busy || !removable.includes(url)) return;
    hapticService.selection();
    setSelected((current) =>
      current.includes(url) ? current.filter((item) => item !== url) : [...current, url],
    );
  };
  const removeSelected = async () => {
    if (removing.current || !selectedUrls.length) return;
    removing.current = true;
    setBusy(true);
    setMessage('');
    try {
      const result = await removeConnectedMints(selectedUrls);
      await refreshMintList();
      await refreshBalance();
      await queryClient.invalidateQueries({ queryKey: ['mint-removal'] });
      void useWalletStore.getState().syncMintsToNostr();
      const kept = Object.keys(result.blocked).length;
      if (kept) hapticService.review();
      else if (result.removed.length) hapticService.completion();
      setMessage(
        kept
          ? `${result.removed.length} removed. ${kept} kept because wallet state changed.`
          : `${result.removed.length} ${result.removed.length === 1 ? 'mint' : 'mints'} removed.`,
      );
      setSelected([]);
      setSelecting(false);
      closeAfterRemoval.current = true;
    } catch {
      setMessage('Could not remove these mints. Check wallet activity and try again.');
    } finally {
      removing.current = false;
      setBusy(false);
    }
  };
  const { data: price } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
    enabled: secondaryCurrency !== 'NONE',
  });
  return (
    <YStack flex={1} bg="$background">
      <Stack.Screen
        options={{
          title: 'Mints',
          headerRight: () =>
            mints.length ? (
              <HeaderIconButton
                icon={selecting ? Check : ListChecks}
                accessibilityLabel={selecting ? 'Finish selecting mints' : 'Select mints'}
                accessibilityState={{ selected: selecting }}
                disabled={busy}
                onPress={() => {
                  setSelecting(!selecting);
                  setSelected([]);
                  setMessage('');
                }}
              />
            ) : null,
        }}
      />
      <ScrollView
        flex={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: appSpacing.page }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            enabled={!busy}
            onRefresh={async () => {
              await refreshMintList();
              await Promise.all([
                refreshBalance(),
                queryClient.invalidateQueries({ queryKey: ['mint-metadata'] }),
                ...(selecting ? [eligibility.refetch()] : []),
              ]);
            }}
          />
        }
      >
        <YStack gap={appSpacing.page}>
          <AppText tone="secondary">
            {selecting
              ? 'Only empty mints without pending activity can be removed.'
              : 'Each mint holds a separate balance. Tap a mint to manage it.'}
          </AppText>
          {selecting && (
            <XStack items="center" justify="space-between">
              <AppText tone="secondary">{selectedUrls.length} selected</AppText>
              <AppButton
                emphasis="text"
                size="small"
                disabled={busy || !removable.length}
                onPress={() => {
                  if (busy || !removable.length) return;
                  hapticService.selection();
                  setSelected(selectedUrls.length === removable.length ? [] : removable);
                }}
              >
                {removable.length > 0 && selectedUrls.length === removable.length
                  ? 'Clear selection'
                  : 'Select all'}
              </AppButton>
            </XStack>
          )}
          {!!message && (
            <AppText tone="secondary" accessibilityRole="alert">
              {message}
            </AppText>
          )}
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
                      selecting={selecting}
                      checked={selectedUrls.includes(mint.mintUrl)}
                      disabled={busy}
                      blocked={
                        selecting && !removable.includes(mint.mintUrl)
                          ? eligibility.data?.[mint.mintUrl]
                            ? mintRemovalMessages[eligibility.data[mint.mintUrl]!]
                            : eligibility.isError
                              ? 'Could not verify wallet state'
                              : 'Checking wallet state…'
                          : undefined
                      }
                      onPress={() => {
                        if (selecting) toggle(mint.mintUrl);
                        else openMint(mint.mintUrl);
                      }}
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
          variant={selecting ? 'critical' : 'default'}
          icon={selecting ? Trash2 : Plus}
          disabled={selecting && (busy || selectedUrls.length === 0)}
          onPress={() => {
            if (selecting) sheet.current?.present();
            else router.push('/(modals)/add-mint');
          }}
        >
          {selecting ? `Remove selected (${selectedUrls.length})` : 'Add mint'}
        </AppButton>
      </YStack>
      {mintSheet}
      <AppBottomSheet ref={sheet} title="Remove selected mints?" canDismiss={!busy}>
        <YStack gap="$4">
          <AppText tone="secondary">
            Disconnect these mints? Your transaction history and recovery records are kept.
          </AppText>
          <YStack bg="$gray2" rounded="$6" overflow="hidden">
            {selectedMints.map((mint, index) => (
              <React.Fragment key={mint.mintUrl}>
                {index > 0 && <Separator height={2} borderWidth={0} bg="$background" />}
                <YStack p="$3">
                  <AppText variant="label1">{mint.nickname || mint.name || mint.mintUrl}</AppText>
                </YStack>
              </React.Fragment>
            ))}
          </YStack>
          {!!message && (
            <AppText tone="secondary" accessibilityRole="alert">
              {message}
            </AppText>
          )}
          <AppButton
            variant="critical"
            size="large"
            loading={busy}
            loadingText="Removing mints…"
            disabled={!selectedUrls.length}
            onPress={() => void removeSelected()}
          >
            Confirm removal
          </AppButton>
        </YStack>
      </AppBottomSheet>
    </YStack>
  );
}
