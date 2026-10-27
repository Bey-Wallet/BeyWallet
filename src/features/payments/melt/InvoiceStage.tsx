import { useCurrencyInput } from '~/shared/hooks/useCurrencyInput';
import { AppPressable } from '~/shared/ui/AppPressable';
import { AppButton } from '~/shared/ui/AppButton';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { XStack, YStack, Text } from 'tamagui';
import { ArrowUpDown, Zap } from '@tamagui/lucide-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/api/bitcoinService';
import {
  currencyService,
  CurrencyCode,
  SUPPORTED_CURRENCIES,
} from '~/services/wallet/currencyService';
import { MintSelectorSheet } from '~/shared/ui/HomeMintSelector';
import { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { useRouter } from 'expo-router';
import { detectLightningInputType } from '~/services/api/lnurlService';
import { NumericKeypad } from '~/shared/ui/NumericKeypad';
import { DestinationInputRow } from '~/shared/ui/DestinationInputRow';
import { MintBalanceRow } from '~/shared/ui/MintBalanceRow';
import { BouncyAmount } from '~/shared/ui/BouncyAmount';

interface InvoiceStageProps {
  mintUrl?: string | null;
  onMintChange?: (url: string) => void;
  amount: string;
  setAmount: (val: string) => void;
  invoice: string;
  setInvoice: (val: string) => void;
  onContinue: () => void;
  balance: number;
  isLoading?: boolean;
  disabled?: boolean;
  error?: string | null;
  amountPresets?: readonly number[];
}

export function InvoiceStage({
  mintUrl,
  onMintChange,
  amount,
  setAmount,
  invoice,
  setInvoice,
  onContinue,
  balance,
  isLoading,
  disabled,
  error,
  amountPresets,
}: InvoiceStageProps) {
  const [isPasting, setIsPasting] = useState(false);
  const {
    activeMintUrl: globalMintUrl,
    mints,
    refreshMintList,
    isInitializing,
    isRefreshing,
    scannerResult,
    setScannerResult,
  } = useWalletStore();
  const activeMintUrl = mintUrl === undefined ? globalMintUrl : mintUrl;
  const { primaryCurrency, secondaryCurrency, showBitcoinSymbol } = useSettingsStore();
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const router = useRouter();

  const isLoadingMint = isInitializing || isRefreshing;

  // Check if we just returned from the scanner
  useEffect(() => {
    if (scannerResult) {
      let cleaned = scannerResult.trim();
      if (cleaned.toLowerCase().startsWith('lightning:')) {
        cleaned = cleaned.slice(10);
      }
      setInvoice(cleaned);
      setScannerResult(null);
    }
  }, [scannerResult, setInvoice, setScannerResult]);

  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
    enabled: secondaryCurrency !== 'NONE',
  });
  const { fiatEnabled, inputMode, setInputMode, localInputValue, setLocalInputValue } =
    useCurrencyInput(primaryCurrency, secondaryCurrency, amount, btcData?.price);

  const currencySymbol = useMemo(() => {
    return SUPPORTED_CURRENCIES.find((c) => c.code === secondaryCurrency)?.symbol || '$';
  }, [secondaryCurrency]);

  const activeMint = useMemo(() => {
    if (!activeMintUrl) return null;
    const normalizeUrl = (url: string) => url.replace(/\/$/, '');
    return mints.find((m) => normalizeUrl(m.mintUrl) === normalizeUrl(activeMintUrl));
  }, [mints, activeMintUrl]);

  const displayName = useMemo(() => {
    if (!activeMintUrl) return 'Select Mint';
    if (activeMint?.nickname) return activeMint.nickname;
    if (activeMint?.name) return activeMint.name;
    return activeMintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }, [activeMint, activeMintUrl]);

  const isValidInvoice = useMemo(() => {
    if (!invoice.trim()) return false;
    return detectLightningInputType(invoice) !== 'unknown';
  }, [invoice]);

  const isBolt11 = useMemo(() => {
    return detectLightningInputType(invoice) === 'bolt11';
  }, [invoice]);

  const parsedAmountSats = parseInt(amount, 10) || 0;
  const isOverBalance = parsedAmountSats > balance;
  const isValidAmount = parsedAmountSats > 0 && !isOverBalance && isValidInvoice;

  const conversionValue = useMemo(() => {
    if (secondaryCurrency === 'NONE') return '';

    if (!btcData?.price) return '0';
    if (inputMode === 'SATS') {
      const sats = Number(amount) || 0;
      return currencyService.formatValue(
        currencyService.convertSatsToCurrency(sats, btcData.price),
        secondaryCurrency as CurrencyCode,
      );
    } else {
      const sats = Number(amount) || 0;
      return currencyService.formatSats(sats);
    }
  }, [amount, btcData?.price, inputMode, secondaryCurrency]);

  useEffect(() => {
    if (inputMode === 'SATS') {
      setLocalInputValue(amount);
    } else if (btcData?.price) {
      const sats = Number(amount) || 0;
      const fiat = currencyService.convertSatsToCurrency(sats, btcData.price);
      setLocalInputValue(fiat > 0 ? fiat.toFixed(2) : '0');
    }
  }, [amount, inputMode, btcData?.price]);

  const onKeypadChange = (rawVal: string) => {
    if (!fiatEnabled && !/^\d*$/.test(rawVal)) return;
    if (isBolt11) return; // Keypad is locked for bolt11 invoice

    let val = rawVal;

    if (val === '.') {
      val = '0.';
    }

    if (inputMode === 'SATS') {
      val = val.replace(/\./g, '');
    } else {
      const parts = val.split('.');
      if (parts.length > 2) {
        val = parts[0] + '.' + parts.slice(1).join('');
      }
      if (parts.length === 2 && parts[1].length > 2) {
        val = parts[0] + '.' + parts[1].slice(0, 2);
      }
    }

    if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
      val = val.replace(/^0+/, '');
      if (val === '') val = '0';
    }

    const maxLen = 11;
    if (val.length > maxLen) {
      val = val.slice(0, maxLen);
    }

    setLocalInputValue(val);

    if (inputMode === 'SATS') {
      setAmount(val);
    } else {
      if (btcData?.price) {
        const sats = currencyService.convertCurrencyToSats(Number(val) || 0, btcData.price);
        setAmount(String(sats));
      }
    }
  };

  const toggleMode = () => {
    if (isBolt11) return; // Cannot toggle or edit amount for bolt11
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (inputMode === 'SATS') {
      if (btcData?.price) {
        const sats = Number(amount) || 0;
        const fiat = currencyService.convertSatsToCurrency(sats, btcData.price);
        setLocalInputValue(fiat > 0 ? fiat.toFixed(2) : '0');
      }
      setInputMode('FIAT');
    } else {
      setLocalInputValue(amount);
      setInputMode('SATS');
    }
  };

  const handleMax = () => {
    if (isBolt11) return; // Max button does nothing for bolt11
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const maxSats = balance.toString();
    setAmount(maxSats);
    if (inputMode === 'SATS') {
      setLocalInputValue(maxSats);
    } else if (btcData?.price) {
      const fiat = currencyService.convertSatsToCurrency(balance, btcData.price);
      setLocalInputValue(fiat.toFixed(2));
    }
  };

  const handlePaste = async () => {
    setIsPasting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        let cleaned = text.trim();
        if (cleaned.toLowerCase().startsWith('lightning:')) {
          cleaned = cleaned.slice(10);
        }
        setInvoice(cleaned);
      }
    } catch (e) {
      console.warn('[MeltScreen] Clipboard read failed:', e);
    } finally {
      setIsPasting(false);
    }
  };

  const handleOpenScanner = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(modals)/scanner',
      params: { returnTo: '/(modals)/melt' },
    });
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInvoice('');
    setAmount('0');
  };

  const formattedDisplayValue = useMemo(() => {
    if (!localInputValue || localInputValue === '0') return '0';
    if (inputMode === 'SATS') {
      const num = Number(localInputValue);
      if (!isNaN(num)) {
        return num.toLocaleString('en-US');
      }
    } else {
      const parts = localInputValue.split('.');
      const integerPart = Number(parts[0]);
      if (!isNaN(integerPart)) {
        const formattedInt = integerPart.toLocaleString('en-US');
        return parts.length > 1 ? `${formattedInt}.${parts[1]}` : formattedInt;
      }
    }
    return localInputValue;
  }, [localInputValue, inputMode]);

  const dynamicFontSize = useMemo(() => {
    const len = formattedDisplayValue.length;
    if (len <= 6) return 44;
    if (len <= 8) return 38;
    if (len <= 10) return 32;
    if (len <= 13) return 26;
    return 20;
  }, [formattedDisplayValue]);

  return (
    <YStack flex={1} justify="space-between">
      <YStack items="center" gap="$1.5" width="100%">
        {/* Mint Selector & Balance Row */}
        <MintBalanceRow
          activeMint={activeMint}
          activeMintUrl={activeMintUrl || undefined}
          displayName={displayName}
          balance={balance}
          isLoadingMint={isLoadingMint}
          isSelector={true}
          onPress={() => {
            refreshMintList();
            sheetRef.current?.present();
          }}
          showMax={!isBolt11}
          onMaxPress={handleMax}
          maxDisabled={balance === 0}
        />

        {/* Card Box Container */}
        <YStack
          width="100%"
          bg="$gray2"
          rounded="$6"
          p="$4"
          py="$6"
          items="center"
          gap="$3"
          borderWidth={0}
        >
          {isBolt11 ? (
            <YStack gap="$2" items="center">
              <Text color="$color" fontSize="$5" fontWeight="500">
                Lightning invoice
              </Text>
              <Text color={error ? '$red10' : '$gray10'} fontSize="$3" textAlign="center">
                {error || 'The amount is set by the invoice.'}
              </Text>
            </YStack>
          ) : (
            <YStack items="center" justify="center" py="$0" gap="$2" width="100%">
              {error || isOverBalance ? (
                <Text color="$red10" fontSize="$3" fontWeight="600" textAlign="center">
                  {error || 'Exceeds available balance'}
                </Text>
              ) : (
                <Text color="$gray10" fontSize="$3" fontWeight="500">
                  {isBolt11 ? 'Lightning Invoice Amount' : 'How much to pay?'}
                </Text>
              )}

              <BouncyAmount
                value={formattedDisplayValue}
                fontSize={dynamicFontSize}
                prefix={inputMode === 'SATS' ? (showBitcoinSymbol ? '₿' : '') : currencySymbol}
                suffix={inputMode === 'SATS' && !showBitcoinSymbol ? ' sat' : ''}
              />

              {fiatEnabled && (
                <AppPressable
                  px={12}
                  py={4}
                  rounded="$10"
                  bg="$gray5"
                  pressStyle={{ scale: 0.96, bg: '$gray5' }}
                  onPress={toggleMode}
                  disabled={isBolt11}
                  opacity={isBolt11 ? 0.6 : 1}
                  minHeight={36}
                  flexDirection="row"
                  items="center"
                  justify="center"
                  gap={8}
                >
                  <Text color="$color" fontSize="$3" fontWeight="600">
                    {conversionValue}
                  </Text>
                  <ArrowUpDown size={14} color="$accent10" strokeWidth={2.5} />
                </AppPressable>
              )}
            </YStack>
          )}
        </YStack>
        {/* Invoice / LN Address Input Row */}
        <DestinationInputRow
          value={invoice}
          onChangeText={setInvoice}
          placeholder="Lightning address, LNURL or invoice"
          onPaste={handlePaste}
          onScan={handleOpenScanner}
          defaultIcon={<Zap size="$1.5" color="$accent10" />}
          isPasting={isPasting}
          isError={invoice.trim().length > 0 && !isValidInvoice}
          multiline={true}
        />
        {!isBolt11 && amountPresets && (
          <XStack width="100%" gap="$1.5">
            {amountPresets.map((sats) => (
              <AppPressable
                key={sats}
                accessibilityRole="button"
                accessibilityLabel={`${sats.toLocaleString('en-US')} sat`}
                flex={1}
                minHeight={48}
                rounded="$6"
                bg="$gray2"
                items="center"
                justify="center"
                disabled={disabled || isLoading}
                pressStyle={{ bg: '$gray3' }}
                onPress={() => {
                  setAmount(String(sats));
                  setLocalInputValue(
                    inputMode === 'SATS'
                      ? String(sats)
                      : btcData?.price
                        ? currencyService.convertSatsToCurrency(sats, btcData.price).toFixed(2)
                        : '0',
                  );
                }}
              >
                <Text fontSize={14} color="$color" fontWeight="500">{`${sats / 1000}k sat`}</Text>
              </AppPressable>
            ))}
          </XStack>
        )}
      </YStack>

      {isBolt11 ? (
        <AppButton
          size="large"
          fullWidth
          onPress={onContinue}
          loading={isLoading}
          loadingText="Preparing Lightning payment…"
          disabled={!isValidInvoice || !activeMintUrl || disabled || isLoading}
        >
          Review invoice
        </AppButton>
      ) : (
        <NumericKeypad
          allowDecimal={fiatEnabled}
          showAmountDisplay={false}
          value={localInputValue}
          onValueChange={onKeypadChange}
          onConfirm={onContinue}
          confirmLabel="Continue"
          isLoading={isLoading}
          loadingText="Preparing Lightning payment…"
          confirmDisabled={!isValidAmount || disabled || isLoading}
          confirmIcon={undefined}
        />
      )}

      <MintSelectorSheet
        method="melt-lightning"
        ref={sheetRef}
        activeMintUrl={activeMintUrl || undefined}
        onSelect={onMintChange}
        changeGlobalActiveMint={false}
        showAllOption={false}
        trustedOnly
      />
    </YStack>
  );
}
