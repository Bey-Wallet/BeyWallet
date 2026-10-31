import React, { useCallback, useRef, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Theme, XStack, YStack } from 'tamagui';
import * as Haptics from 'expo-haptics';
import { AmountStage } from '~/features/payments/mint/AmountStage';
import { useFlowMint } from '~/shared/hooks/useFlowMint';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsBusy } from '~/features/settings/hooks/useSettingsBusy';
import { PosHeader } from './PosHeader';
import { AppBottomSheetThemeProvider } from '~/shared/ui/AppBottomSheet';
import { ListTableVariantProvider } from '~/shared/ui/ListTable';
import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { PaymentStatusIcon } from '~/shared/ui/PaymentStatusIcon';
import { AppButton } from '~/shared/ui/AppButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import { RequestEcashStage } from './RequestEcashStage';
import { MerchantLightningStage } from './MerchantLightningStage';

type Sale = { amount: number; mintUrl: string; note: string };
type Method = 'ecash' | 'lightning';

function MerchantCheckout({
  sale,
  onNext,
  onClose,
}: {
  sale: Sale;
  onNext: () => void;
  onClose: () => void;
}) {
  const [method, setMethod] = useState<Method>('ecash');
  const [lightningOpened, setLightningOpened] = useState(false);
  const [completed, setCompleted] = useState(false);
  const settled = useRef(false);
  const [ecashBusy, setEcashBusy] = useState(false);
  const [lightningBusy, setLightningBusy] = useState(false);
  const busy = ecashBusy || lightningBusy;
  useSettingsBusy(busy);
  const received = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    setCompleted(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void useWalletStore.getState().refreshBalance();
  }, []);
  return (
    <>
      <PosHeader onBack={onClose} disabled={busy} />
      {completed ? (
        <PaymentStageLayout
          inset={false}
          hero={
            <>
              <YStack bg="$buttonDefaultPrimary" rounded={999} p="$4" mb="$3">
                <PaymentStatusIcon status="success" />
              </YStack>
              <Text
                fontFamily="$display"
                fontSize={32}
                lineHeight={38}
                fontWeight="600"
                color="$color"
                textAlign="center"
              >
                Payment received
              </Text>
              <PaymentAmount amount={sale.amount} size="prominent" compact />
            </>
          }
          footer={
            <YStack rounded={999} overflow="hidden">
              <AppButton fullWidth size="large" disabled={busy} onPress={onNext}>
                Next sale
              </AppButton>
            </YStack>
          }
        />
      ) : (
        <>
          <XStack gap="$1" p="$1" mb="$2" rounded={999} bg="$buttonDefaultSecondary">
            {(['ecash', 'lightning'] as const).map((value) => (
              <AppPressable
                key={value}
                flex={1}
                minHeight={48}
                rounded={999}
                items="center"
                justify="center"
                bg={method === value ? '$buttonDefaultPrimary' : 'transparent'}
                pressStyle={{ bg: '$buttonDefaultSecondaryPress' }}
                accessibilityRole="tab"
                disabled={busy}
                accessibilityLabel={value === 'ecash' ? 'Ecash' : 'Lightning'}
                accessibilityState={{ selected: method === value }}
                onPress={() => {
                  if (busy) return;
                  setMethod(value);
                  if (value === 'lightning') setLightningOpened(true);
                }}
              >
                <Text fontFamily="$body" fontSize={16} fontWeight="600" color="$color">
                  {value === 'ecash' ? 'Ecash' : 'Lightning'}
                </Text>
              </AppPressable>
            ))}
          </XStack>
        </>
      )}
      {/* Keep both receivers mounted: a payment to the previously displayed method still belongs to this sale. */}
      <YStack flex={1} display={!completed && method === 'ecash' ? 'flex' : 'none'}>
        <RequestEcashStage
          merchant={{
            ...sale,
            active: !completed && method === 'ecash',
            onReceived: received,
            onBusyChange: setEcashBusy,
            completed,
          }}
        />
      </YStack>
      {lightningOpened && (
        <YStack flex={1} display={!completed && method === 'lightning' ? 'flex' : 'none'}>
          <MerchantLightningStage
            {...sale}
            onReceived={received}
            onBusyChange={setLightningBusy}
            onClose={onClose}
            listening={!completed}
          />
        </YStack>
      )}
    </>
  );
}

export function MerchantReceiveScreen() {
  return (
    <Theme name="light_pos">
      <AppBottomSheetThemeProvider value="light_pos">
        <ListTableVariantProvider value="outlined">
          <MerchantReceiveContent />
        </ListTableVariantProvider>
      </AppBottomSheetThemeProvider>
    </Theme>
  );
}

function MerchantReceiveContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mintUrl, setMintUrl } = useFlowMint();
  const mints = useWalletStore((state) => state.mints);
  const [amount, setAmount] = useState('0');
  const [note, setNote] = useState('');
  const [sale, setSale] = useState<Sale | null>(null);
  const [error, setError] = useState<string | null>(null);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const charge = () => {
    const value = Number(amount);
    if (!Number.isSafeInteger(value) || value <= 0) {
      setError('Enter an amount to continue.');
      return;
    }
    if (!mintUrl || !mints.some((mint) => mint.mintUrl === mintUrl && mint.trusted)) {
      setError('Select a trusted mint to receive this payment.');
      return;
    }
    setError(null);
    setSale({ amount: value, mintUrl, note: note.trim() });
  };
  return (
    <YStack flex={1} bg="$background" px="$4" pt={insets.top} pb={Math.max(insets.bottom, 16)}>
      <Stack.Screen
        options={{ headerShown: false, statusBarStyle: 'dark', title: 'Point of sale' }}
      />
      {sale ? (
        <MerchantCheckout
          sale={sale}
          onClose={close}
          onNext={() => {
            setSale(null);
            setAmount('0');
            setNote('');
            setError(null);
          }}
        />
      ) : (
        <>
          <PosHeader onBack={close} />
          {error && (
            <Text fontFamily="$body" fontSize={12} color="$red10" accessibilityRole="alert">
              {error}
            </Text>
          )}
          <AmountStage
            appearance="pos"
            mintUrl={mintUrl}
            onMintChange={setMintUrl}
            amount={amount}
            setAmount={setAmount}
            onContinue={charge}
            confirmLabel="Charge"
            note={note}
            onNoteChange={setNote}
          />
        </>
      )}
    </YStack>
  );
}
