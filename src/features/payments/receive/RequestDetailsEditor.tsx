import React, { useRef, useState } from 'react';
import { Text, XStack, YStack, Separator } from 'tamagui';
import { ChevronDown, Pencil, ArrowUpDown } from '@tamagui/lucide-icons';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBottomSheet, { type AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { InputSheet, type InputSheetRef } from '~/shared/ui/InputSheet';
import { AppPressable } from '~/shared/ui/AppPressable';
import { AppButton } from '~/shared/ui/AppButton';
import { paymentAmounts } from '~/shared/ui/PaymentAmount';
import { PaymentMintRow } from '~/shared/ui/PaymentMintRow';
import { ListTableRow } from '~/shared/ui/ListTable';
import { NumericKeypad } from '~/shared/ui/NumericKeypad';
import { useSettingsStore } from '~/state/settingsStore';
import { bitcoinService } from '~/services/api/bitcoinService';
import { currencyService, SUPPORTED_CURRENCIES } from '~/services/wallet/currencyService';

export function RequestAmountEditor({
  amount,
  disabled,
  onChange,
}: {
  amount: number;
  disabled?: boolean;
  onChange: (amount: number) => void;
}) {
  const sheet = useRef<AppBottomSheetRef>(null);
  const insets = useSafeAreaInsets();
  const { primaryCurrency, secondaryCurrency, showBitcoinSymbol } = useSettingsStore();
  const fiatEnabled = secondaryCurrency !== 'NONE';
  const [mode, setMode] = useState<'SATS' | 'FIAT'>('SATS');
  const [draft, setDraft] = useState('0');
  const [draftSats, setDraftSats] = useState(0);
  const { data } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    enabled: fiatEnabled,
    staleTime: 30000,
  });
  const price = data?.price;
  const hasPrice = fiatEnabled && !!price && Number.isFinite(price) && price > 0;
  const displayAmount = paymentAmounts(
    amount,
    fiatEnabled ? primaryCurrency : 'SATS',
    secondaryCurrency,
    showBitcoinSymbol,
    price,
  ).primary;
  const sats = draftSats;
  const valid = Number.isSafeInteger(sats) && sats > 0 && (mode === 'SATS' || hasPrice);
  const open = () => {
    if (disabled) return;
    const nextMode = primaryCurrency === 'FIAT' && hasPrice ? 'FIAT' : 'SATS';
    setMode(nextMode);
    setDraftSats(amount);
    setDraft(
      nextMode === 'SATS'
        ? String(amount)
        : currencyService.convertSatsToCurrency(amount, price!).toFixed(2),
    );
    sheet.current?.present();
  };
  const toggleMode = () => {
    if (!hasPrice || !Number.isSafeInteger(sats) || sats < 0) return;
    setDraft(
      mode === 'SATS'
        ? currencyService.convertSatsToCurrency(sats, price!).toFixed(2)
        : String(sats),
    );
    setMode(mode === 'SATS' ? 'FIAT' : 'SATS');
  };
  const symbol = SUPPORTED_CURRENCIES.find((c) => c.code === secondaryCurrency)?.symbol || '';
  const equivalent = paymentAmounts(
    sats,
    mode,
    secondaryCurrency,
    showBitcoinSymbol,
    hasPrice ? price : undefined,
  ).secondary;
  const save = () => {
    if (!valid || disabled) return;
    sheet.current?.dismiss();
    onChange(sats);
  };
  return (
    <>
      <ListTableRow
        label="Amount"
        value={amount > 0 ? (displayAmount ?? '—') : 'Set amount'}
        disabled={disabled}
        onPress={open}
        rightContent={!disabled ? <Pencil size={16} color="$gray10" /> : undefined}
      />
      <AppBottomSheet ref={sheet} bottomInset={insets.bottom}>
        <YStack px="$4" pt="$3" pb="$4" gap="$3">
          <Text fontSize="$4" text="center" fontWeight="500" color="$color">
            Request amount
          </Text>
          <Text
            textAlign="center"
            fontSize={40}
            fontWeight="500"
            color="$color"
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {mode === 'FIAT' ? symbol : showBitcoinSymbol ? '₿' : ''}
            {draft}
            {mode === 'SATS' && !showBitcoinSymbol ? ' SATS' : ''}
          </Text>
          {fiatEnabled && (
            <AppPressable
              accessibilityLabel="Switch amount currency"
              onPress={toggleMode}
              disabled={!hasPrice}
              items="center"
              minHeight={40}
              justify="center"
            >
              <XStack gap="$2" items="center">
                <Text color="$gray10">
                  {equivalent ? `≈ ${equivalent}` : 'Conversion unavailable'}
                </Text>
                {hasPrice && <ArrowUpDown size={16} color="$gray10" />}
              </XStack>
            </AppPressable>
          )}
          <NumericKeypad
            showAmountDisplay={false}
            showConfirmButton={false}
            value={draft}
            onValueChange={(value) => {
              if (value.length > 11 || !/^\d*(\.\d{0,2})?$/.test(value)) return;
              if (mode === 'SATS' && value.includes('.')) return;
              setDraft(value || '0');
              setDraftSats(
                mode === 'SATS'
                  ? Number(value)
                  : hasPrice
                    ? currencyService.convertCurrencyToSats(Number(value), price!)
                    : NaN,
              );
            }}
            onConfirm={save}
            confirmLabel="Done"
            confirmDisabled={!valid}
          />
          <AppButton size="large" fullWidth disabled={!valid || disabled} onPress={save}>
            Done
          </AppButton>
        </YStack>
      </AppBottomSheet>
    </>
  );
}

export function RequestDetailsEditor({
  mintUrl,
  note,
  disabled,
  onMintChange,
  onNoteChange,
}: {
  mintUrl: string;
  note: string;
  disabled?: boolean;
  onMintChange: (url: string) => void;
  onNoteChange: (note: string) => void;
}) {
  const noteSheet = useRef<InputSheetRef>(null);
  return (
    <>
      <PaymentMintRow mintUrl={mintUrl} onSelect={onMintChange} disabled={disabled} />
      <Separator borderColor="$borderColor" opacity={0.5} />
      <ListTableRow
        label={note ? 'Note' : 'Add note'}
        value={note || undefined}
        disabled={disabled}
        onPress={() => {
          if (!disabled) noteSheet.current?.present(note);
        }}
        rightContent={disabled ? undefined : <ChevronDown size={16} color="$gray10" />}
      />
      <InputSheet
        ref={noteSheet}
        title="Note"
        placeholder="Add a note (optional)"
        maxLength={80}
        onSave={onNoteChange}
      />
    </>
  );
}
