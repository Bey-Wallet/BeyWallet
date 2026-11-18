import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { reloadAppAsync } from 'expo';
import { AlertCircle, CheckCircle2, FileCheck2 } from '@tamagui/lucide-icons';
import { ScrollView, XStack, YStack } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '~/shared/ui/AppButton';
import { AppText } from '~/shared/ui/AppText';
import { Spinner } from '~/shared/ui/Spinner';
import { useFileRestoreStore } from '~/state/fileRestoreStore';
import { fileRestoreService } from '~/services/wallet/fileRestoreService';

/** Standalone restore flow: centered, scrollable status and safe-area action footer. */
export function FileRestoreGate() {
  const { phase, mode, error, preview } = useFileRestoreStore();
  const insets = useSafeAreaInsets();
  const [reloadError, setReloadError] = useState(false);
  const automaticRestart = useRef(false);
  const restarting = useRef(false);
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => back.remove();
  }, []);
  const restart = useCallback(async () => {
    if (restarting.current) return;
    restarting.current = true;
    setReloadError(false);
    try {
      await reloadAppAsync();
    } catch {
      setReloadError(true);
    } finally {
      restarting.current = false;
    }
  }, []);
  useEffect(() => {
    if (phase !== 'restart') {
      automaticRestart.current = false;
      return;
    }
    if (error || automaticRestart.current) return;
    automaticRestart.current = true;
    void restart();
  }, [phase, error, restart]);

  const busy =
    ['checking', 'preparing', 'installing'].includes(phase) ||
    (phase === 'restart' && !error && !reloadError);
  const ready = phase === 'ready';
  const success = phase === 'success';
  const title = busy
    ? phase === 'preparing'
      ? 'Preparing backup…'
      : phase === 'installing'
        ? 'Restoring wallet…'
        : 'Opening wallet…'
    : success
      ? 'Backup restored'
      : ready
        ? mode === 'merge'
          ? 'Merge backup'
          : mode === 'replace'
            ? 'Replace wallet'
            : 'Restore backup'
        : 'Restore needs attention';
  const description =
    ready && mode === 'replace'
      ? 'Back up your current wallet. Balances won’t be combined.'
      : !busy && !ready && !success
        ? (error ?? 'Could not open your wallet. Try again.')
        : null;

  return (
    <YStack flex={1} bg="$background" pt={Math.max(insets.top, 16)}>
      <ScrollView
        flex={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <YStack
          testID="file-restore-status"
          flex={1}
          minHeight={280}
          justify="center"
          items="center"
          px="$4"
          py="$6"
          gap="$5"
        >
          <YStack width="100%" maxWidth={400} items="center" gap="$4">
            {busy ? (
              <Spinner size="large" />
            ) : (
              <YStack
                width={72}
                height={72}
                rounded="$6"
                bg="$gray2"
                items="center"
                justify="center"
                accessible={false}
              >
                {success ? (
                  <CheckCircle2 size={36} color="$green10" />
                ) : ready ? (
                  <FileCheck2 size={32} color="$color" />
                ) : (
                  <AlertCircle size={32} color="$red10" />
                )}
              </YStack>
            )}
            <YStack width="100%" items="center" gap="$3">
              <AppText
                variant="title2"
                textAlign="center"
                accessibilityRole="header"
                accessibilityLiveRegion="polite"
              >
                {title}
              </AppText>
              {description && (
                <AppText variant="body2" tone="secondary" textAlign="center">
                  {description}
                </AppText>
              )}
            </YStack>
          </YStack>
          {ready && preview && (
            <YStack testID="file-restore-preview" width="100%" maxWidth={400} gap="$4">
              <YStack items="center" gap="$2">
                <AppText variant="label2" tone="secondary">
                  {mode === 'merge' ? 'Balance after merge' : 'Available balance'}
                </AppText>
                <AppText variant="amountSmall" textAlign="center">
                  {`${preview.balance.toLocaleString('en-US')} sat`}
                </AppText>
                {preview.pendingBalance > 0 && (
                  <AppText variant="body2" tone="secondary" textAlign="center">
                    {`${preview.pendingBalance.toLocaleString('en-US')} sat pending or reserved`}
                  </AppText>
                )}
              </YStack>
              <YStack gap="$2">
                <AppText
                  variant="label2"
                  tone="secondary"
                >{`Mints (${preview.mints.length})`}</AppText>
                <YStack bg="$gray2" rounded="$6" overflow="hidden">
                  {preview.mints.length === 0 ? (
                    <AppText variant="body2" tone="secondary" p="$4">
                      No mints
                    </AppText>
                  ) : (
                    preview.mints.map((mint, index) => (
                      <YStack key={mint.mintUrl}>
                        {index > 0 && <YStack height={2} width="100%" bg="$background" />}
                        <XStack minHeight={56} px="$4" py="$3" gap="$3" items="center">
                          <YStack flex={1} minWidth={0} gap="$1">
                            <AppText variant="label1" numberOfLines={1}>
                              {mint.name}
                            </AppText>
                            <AppText variant="body3" tone="secondary" numberOfLines={1}>
                              {mint.mintUrl}
                            </AppText>
                          </YStack>
                          <AppText variant="label1">{`${mint.balance.toLocaleString('en-US')} sat`}</AppText>
                        </XStack>
                      </YStack>
                    ))
                  )}
                </YStack>
              </YStack>
            </YStack>
          )}
          {reloadError && (
            <AppText variant="body2" tone="secondary" textAlign="center">
              Close and reopen the app if it cannot open automatically.
            </AppText>
          )}
        </YStack>
      </ScrollView>
      {!busy && (
        <YStack
          testID="file-restore-actions"
          px="$4"
          pt="$3"
          pb={Math.max(insets.bottom, 16)}
          gap="$3"
          bg="$background"
        >
          {ready ? (
            <>
              <AppButton
                haptic
                size="large"
                fullWidth
                variant={mode === 'replace' ? 'warning' : 'default'}
                onPress={() => void fileRestoreService.finish()}
              >
                {mode === 'replace'
                  ? 'Replace wallet'
                  : mode === 'merge'
                    ? 'Merge backup'
                    : 'Restore wallet'}
              </AppButton>
              <AppButton
                size="large"
                fullWidth
                emphasis="secondary"
                onPress={() => void fileRestoreService.cancel()}
              >
                Cancel restore
              </AppButton>
            </>
          ) : success ? (
            <AppButton
              size="large"
              fullWidth
              onPress={() =>
                useFileRestoreStore.setState({
                  phase: 'idle',
                  mode: null,
                  error: null,
                  preview: null,
                })
              }
            >
              Open wallet
            </AppButton>
          ) : (
            <AppButton size="large" fullWidth onPress={() => void restart()}>
              {phase === 'error' ? 'Retry recovery' : 'Try opening wallet again'}
            </AppButton>
          )}
        </YStack>
      )}
    </YStack>
  );
}
