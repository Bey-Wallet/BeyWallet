import React, { useCallback, useRef, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, XStack, YStack } from 'tamagui';
import * as Haptics from 'expo-haptics';
import { AmountStage } from '~/features/payments/mint/AmountStage';
import { useFlowMint } from '~/shared/hooks/useFlowMint';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsBusy } from '~/features/settings/hooks/useSettingsBusy';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
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
      <PaymentFlowHeader
        title="Point of sale"
        navigationAction="close"
        onBack={onClose}
        disabled={busy}
      />
      {completed ? (
        <PaymentStageLayout
          inset={false}
          hero={
            <>
              <PaymentStatusIcon status="success" />
              <Text fontFamily="$body" fontSize={16} fontWeight="500" color="$color">
                Payment received
              </Text>
              <PaymentAmount amount={sale.amount} size="prominent" compact />
            </>
          }
          footer={
            <AppButton fullWidth size="large" disabled={busy} onPress={onNext}>
              Next sale
            </AppButton>
          }
        />
      ) : (
        <>
          <XStack gap="$2" pb="$3">
            {(['ecash', 'lightning'] as const).map((value) => (
              <AppPressable
                key={value}
                flex={1}
                minHeight={48}
                rounded="$6"
                items="center"
                justify="center"
                bg={method === value ? '$buttonDefaultSecondary' : '$background'}
                disabled={busy}
                accessibilityLabel={value === 'ecash' ? 'Ecash' : 'Lightning'}
                accessibilityState={{ selected: method === value }}
                onPress={() => {
                  if (busy) return;
                  setMethod(value);
                  if (value === 'lightning') setLightningOpened(true);
                }}
              >
                <Text
                  fontFamily="$body"
                  fontSize={14}
                  fontWeight="500"
                  color={method === value ? '$color' : '$gray10'}
                >
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
    <YStack flex={1} bg="$background" px="$4" pb={Math.max(insets.bottom, 16)}>
      <Stack.Screen options={{ headerShown: true, title: 'Point of sale' }} />
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
          <PaymentFlowHeader title="Point of sale" navigationAction="close" onBack={close} />
          {error && (
            <Text fontFamily="$body" fontSize={12} color="$red10" accessibilityRole="alert">
              {error}
            </Text>
          )}
          <AmountStage
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
