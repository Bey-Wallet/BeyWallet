import React, { useEffect, useRef, useState } from 'react';
import { AppState, Keyboard } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Landmark } from '~/shared/icons';
import { XStack, YStack, useTheme } from 'tamagui';
import { BUISheet, type BUISheetRef } from '~/shared/ui/BUI/BUISheet';
import { useBUIOverlayAppearance } from '~/shared/ui/BUI/useBUITheme';
import { AppButton } from '~/shared/ui/AppButton';
import { AppText } from '~/shared/ui/AppText';
import { MintImage } from '~/shared/ui/RemoteImage';
import { paymentAmounts } from '~/shared/ui/PaymentAmount';
import { useMintInfo } from '~/shared/hooks/useMintInfo';
import { useOfflineStatus } from '~/shared/hooks/useOfflineStatus';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { mintUrlKey } from '~/shared/utils/mintUrl';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';
import { useAuthStore } from '~/state/authStore';
import { bitcoinService } from '~/services/api/bitcoinService';
import { hapticService } from '~/services/platform/hapticService';
import {
  inspectConnectedMints,
  mintRemovalMessages,
  removeConnectedMints,
} from '~/services/wallet/connectedMintRemoval';
import { useSettingsBusy } from '~/features/settings/hooks/useSettingsBusy';
import { ConnectedMintSheetView } from './ConnectedMintSheetView';
import { MintUrlQrOverlay } from './MintUrlQrOverlay';
import { mintPreviewMethods } from './MintPreviewMethods';

const text = (value: unknown) => (typeof value === 'string' ? value : undefined);

/** Only connected mint entry points mount the live controller. */
export function ConnectedMintSheet({
  mintUrl,
  onClose,
}: {
  mintUrl: string | null;
  onClose: () => void;
}) {
  return mintUrl ? (
    <ConnectedMintSheetContent key={mintUrlKey(mintUrl)} mintUrl={mintUrl} onClose={onClose} />
  ) : null;
}

function ConnectedMintSheetContent({ mintUrl, onClose }: { mintUrl: string; onClose: () => void }) {
  const router = useRouter();
  const theme = useTheme();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const appearance = useBUIOverlayAppearance();
  const focused = useIsFocused();
  const wallet = useWalletStore();
  const settings = useSettingsStore();
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const deviceOffline = useOfflineStatus();
  const mint = wallet.mints.find((item) => mintUrlKey(item.mintUrl) === mintUrlKey(mintUrl));
  const url = mint?.mintUrl ?? mintUrl;
  const balance = wallet.balances[url] ?? 0;
  const sheet = useRef<BUISheetRef>(null);
  const pendingNavigation = useRef<(() => void) | undefined>(undefined);
  const presented = useRef(false);
  const interrupted = useRef(false);
  const removing = useRef(false);
  const finishClose = useRef(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [reviewRemoval, setReviewRemoval] = useState(false);
  const [reviewFunds, setReviewFunds] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [error, setError] = useState('');
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useSettingsBusy(busy);
  const canShow =
    focused &&
    foreground &&
    settings.initialized &&
    !!mint &&
    (!settings.biometricEnabled || authenticated);
  const infoQuery = useMintInfo(url, {
    priority: 'interactive',
    enabled: canShow && !deviceOffline,
    refetchOnMount: 'always',
  });
  const info = infoQuery.data ?? {};
  const removal = useQuery({
    queryKey: ['mint-removal', [url], balance],
    queryFn: () => inspectConnectedMints([url]),
    enabled: canShow,
    staleTime: 0,
  });
  const { data: price } = useQuery({
    queryKey: ['bitcoinPrice', settings.secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(settings.secondaryCurrency),
    staleTime: 30000,
    enabled: canShow && !deviceOffline && settings.secondaryCurrency !== 'NONE',
  });
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        interrupted.current = true;
        pendingNavigation.current = undefined;
      }
      setForeground(state === 'active');
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!canShow || interrupted.current) {
      interrupted.current = true;
      pendingNavigation.current = undefined;
      sheet.current?.dismiss();
      if (!busy) onClose();
    } else if (finishClose.current && !busy) {
      sheet.current?.dismiss();
    } else if (!presented.current) {
      presented.current = true;
      sheet.current?.present();
    }
  }, [canShow, busy, onClose]);
  const leave = (navigate: () => void) => {
    if (busy || !canShow) return;
    pendingNavigation.current = navigate;
    sheet.current?.dismiss();
  };
  const closed = () => {
    if (busy) return;
    const navigate = pendingNavigation.current;
    pendingNavigation.current = undefined;
    onClose();
    const current = useSettingsStore.getState();
    if (
      focused &&
      !interrupted.current &&
      AppState.currentState === 'active' &&
      current.initialized &&
      (!current.biometricEnabled || useAuthStore.getState().isAuthenticated)
    )
      navigate?.();
  };
  const copyUrl = async () => {
    if (!(await copyWithFeedback(url, toast))) return;
    setCopied(true);
    hapticService.acknowledge();
  };
  const remove = async () => {
    if (removing.current || !canShow || useWalletStore.getState().isRestoring) return;
    removing.current = true;
    setBusy(true);
    setError('');
    try {
      const currentBlock = (await inspectConnectedMints([url]))[url];
      if (currentBlock === 'funds') {
        if (!reviewFunds) {
          setReviewFunds(true);
          setError('This mint now has funds. Review the warning before confirming again.');
          void removal.refetch();
          return;
        }
        const unresolved = (await inspectConnectedMints([url], { allowFunds: true }))[url];
        if (unresolved !== null) {
          setError(mintRemovalMessages[unresolved ?? 'unknown']);
          return;
        }
        // Explicitly confirmed destructive removal uses the same operation as Mint Details.
        await wallet.removeMint(url);
        if (
          useWalletStore
            .getState()
            .mints.some((item) => mintUrlKey(item.mintUrl) === mintUrlKey(url))
        )
          throw new Error('Mint was not removed');
      } else if (currentBlock !== null) {
        setError(mintRemovalMessages[currentBlock ?? 'unknown']);
        void removal.refetch();
        return;
      } else {
        // Empty removal still rechecks persisted state inside its existing transaction.
        const result = await removeConnectedMints([url]);
        if (!result.removed.includes(url)) {
          setError(mintRemovalMessages[result.blocked[url] ?? 'unknown']);
          void removal.refetch();
          return;
        }
      }
      await Promise.allSettled([
        wallet.refreshMintList(),
        wallet.refreshBalance(),
        queryClient.invalidateQueries({ queryKey: ['mint-removal'] }),
      ]);
      void useWalletStore
        .getState()
        .syncMintsToNostr()
        .catch(() => {});
      hapticService.completion();
      finishClose.current = true;
    } catch {
      setError('Could not remove this mint. Check wallet activity and try again.');
    } finally {
      removing.current = false;
      setBusy(false);
    }
  };
  const connection = deviceOffline
    ? 'Device offline'
    : infoQuery.isFetching
      ? 'Checking…'
      : infoQuery.error
        ? 'Offline'
        : infoQuery.data
          ? 'Online'
          : 'Unavailable';
  const name = mint?.nickname || mint?.name || text(info.name) || url.replace(/^https?:\/\//, '');
  const saveName = async () => {
    if (removing.current || !canShow) return;
    removing.current = true;
    setBusy(true);
    setError('');
    const nickname = draftName.trim();
    try {
      useWalletStore.setState({ error: null });
      await wallet.setMintNickname(url, nickname);
      const state = useWalletStore.getState();
      const saved = state.mints.find((item) => mintUrlKey(item.mintUrl) === mintUrlKey(url));
      if (state.error || !saved || (saved.nickname || '') !== nickname)
        throw new Error('Name was not saved');
      setEditingName(false);
      Keyboard.dismiss();
      hapticService.selection();
    } catch {
      setError('Could not save mint name. Please try again.');
    } finally {
      removing.current = false;
      setBusy(false);
    }
  };
  const icon = mint?.icon || text(info.icon_url) || text(info.picture) || text(info.icon);
  const methods = mintPreviewMethods(info).filter((method) => !method.disabled);
  const units =
    [
      ...new Set([
        ...(Array.isArray(info.units)
          ? info.units.filter((unit: unknown) => typeof unit === 'string')
          : []),
        ...methods.flatMap((method) => (method.unit ? [method.unit] : [])),
      ]),
    ].join(', ') || 'Not provided';
  const labels: Record<string, string> = {
    bolt11: 'Lightning',
    bolt12: 'BOLT 12',
    onchain: 'On-chain',
  };
  const payments =
    [...new Set(methods.map((method) => labels[method.method] ?? method.method))].join(', ') ||
    'Not advertised';
  const values = paymentAmounts(
    balance,
    settings.primaryCurrency,
    settings.secondaryCurrency,
    settings.showBitcoinSymbol,
    price?.price,
  );
  const primary = values.primary ?? values.secondary ?? '';
  const satsUnit = primary.endsWith(' sat');
  const hidden = settings.hideBalance || !canShow;
  const blocked = balance > 0 ? 'funds' : removal.data?.[url];
  const removeDisabled =
    (blocked !== null && blocked !== 'funds') || removal.isFetching || busy || wallet.isRestoring;
  const removeHint =
    blocked === 'funds'
      ? 'Review removal and balance warning'
      : blocked
        ? mintRemovalMessages[blocked]
        : removeDisabled
          ? 'Checking wallet activity'
          : 'Review removal';
  return (
    <>
      <BUISheet
        ref={sheet}
        appearance={appearance}
        title={reviewRemoval ? 'Remove mint?' : name}
        showHeader={reviewRemoval}
        canDismiss={!busy || !canShow}
        onClose={closed}
      >
        {canShow &&
          (reviewRemoval ? (
            <YStack gap="$4">
              <XStack bg="$gray2" rounded="$6" p="$3" gap="$3" items="center">
                <MintImage mintUrl={url} src={icon} width={48} height={48} rounded="$4" />
                <YStack flex={1} minWidth={0} gap="$1">
                  <AppText variant="label1">{name}</AppText>
                  <AppText variant="body3" tone="secondary">
                    {url}
                  </AppText>
                </YStack>
              </XStack>
              <AppText tone="secondary">
                This removes the mint from your wallet. Your transaction history is kept.
              </AppText>
              {(reviewFunds || blocked === 'funds') && (
                <YStack bg="$gray2" rounded="$6" p="$3" gap="$2" accessibilityRole="alert">
                  <AppText variant="label1" tone="warning">
                    This mint still has funds
                  </AppText>
                  {balance > 0 && (
                    <AppText tone="secondary">
                      Balance: {hidden ? '****' : `${balance.toLocaleString()} sat`}
                    </AppText>
                  )}
                  <AppText tone="secondary">
                    Transfer or withdraw first. Removing this mint deletes its local proofs and
                    related data without moving your funds. Recovery is not guaranteed.
                  </AppText>
                </YStack>
              )}
              {!!error && (
                <AppText tone="error" accessibilityRole="alert">
                  {error}
                </AppText>
              )}
              <YStack gap="$2">
                <AppButton
                  haptic
                  variant="critical"
                  emphasis="primary"
                  size="large"
                  loading={busy}
                  loadingText="Removing mint…"
                  disabled={removeDisabled}
                  onPress={() => void remove()}
                >
                  Remove mint
                </AppButton>
                <AppButton
                  emphasis="secondary"
                  size="large"
                  disabled={busy}
                  onPress={() => {
                    setReviewRemoval(false);
                    setReviewFunds(false);
                    setError('');
                  }}
                >
                  Cancel
                </AppButton>
              </YStack>
            </YStack>
          ) : (
            <ConnectedMintSheetView
              name={name}
              url={url}
              icon={
                <MintImage
                  mintUrl={url}
                  src={icon}
                  width={72}
                  height={72}
                  rounded="$6"
                  fallback={<Landmark size={32} color="$color" />}
                />
              }
              amount={hidden ? '****' : satsUnit ? primary.slice(0, -4) : primary}
              unit={!hidden && satsUnit ? 'sat' : undefined}
              secondary={hidden || values.primary === null ? null : values.secondary}
              connection={connection}
              offline={deviceOffline || !!infoQuery.error}
              checking={infoQuery.isFetching}
              refreshDisabled={deviceOffline}
              units={units}
              payments={payments}
              copied={copied}
              busy={busy}
              removeDisabled={removeDisabled}
              removeHint={removeHint}
              transferDisabled={
                !mint?.trusted || balance <= 0 || wallet.isRestoring || deviceOffline
              }
              recoverDisabled={wallet.isRestoring}
              onClose={() => sheet.current?.dismiss()}
              onCopy={() => void copyUrl()}
              onRemove={() => {
                if (removeDisabled) return;
                setEditingName(false);
                setReviewRemoval(true);
                setReviewFunds(blocked === 'funds');
                setError('');
              }}
              onRefresh={() => void infoQuery.refetch({ cancelRefetch: false })}
              onTransfer={() =>
                leave(() =>
                  router.push({ pathname: '/(modals)/swap', params: { sourceMintUrl: url } }),
                )
              }
              onRecover={() =>
                leave(() => router.push({ pathname: '/recover-funds', params: { mintUrl: url } }))
              }
              onQr={() => {
                Keyboard.dismiss();
                setShowQr(true);
              }}
              onRename={() => {
                if (editingName || busy) return;
                setDraftName(name);
                setEditingName(true);
                setReviewRemoval(false);
                setError('');
              }}
              renameEditor={
                editingName
                  ? {
                      input: (
                        <BottomSheetTextInput
                          accessibilityLabel="Mint name"
                          value={draftName}
                          onChangeText={setDraftName}
                          autoFocus
                          selectTextOnFocus
                          editable={!busy}
                          returnKeyType="done"
                          autoCapitalize="sentences"
                          onSubmitEditing={() => void saveName()}
                          style={{
                            fontFamily: 'InterSemiBold',
                            fontSize: 18,
                            lineHeight: 25,
                            letterSpacing: 0,
                            color: String(theme.color.val),
                            backgroundColor: String(theme.gray2.val),
                            textAlign: 'center',
                            height: 32,
                            paddingVertical: 0,
                            paddingHorizontal: 8,
                            borderRadius: 6,
                          }}
                        />
                      ),
                      onSave: () => void saveName(),
                      onCancel: () => {
                        setEditingName(false);
                        Keyboard.dismiss();
                        setError('');
                      },
                    }
                  : undefined
              }
              onDetails={() =>
                leave(() =>
                  router.push({ pathname: '/(modals)/mint-details', params: { mintUrl: url } }),
                )
              }
            >
              {!!error && (
                <AppText tone="error" accessibilityRole="alert">
                  {error}
                </AppText>
              )}
            </ConnectedMintSheetView>
          ))}
      </BUISheet>
      <MintUrlQrOverlay url={url} visible={showQr && canShow} onClose={() => setShowQr(false)} />
    </>
  );
}
