import { useCurrencyInput } from '~/shared/hooks/useCurrencyInput';
import { interactionCopy } from '~/services/feedback/interactionCopy';
import { AppPressable } from '~/shared/ui/AppPressable';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { YStack, Text } from 'tamagui';
import { ArrowUpDown, KeyRound } from '@tamagui/lucide-icons';

import { NumericKeypad } from '~/shared/ui/NumericKeypad';
import { Spinner } from '~/shared/ui/Spinner';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/api/bitcoinService';
import {
  currencyService,
  CurrencyCode,
  SUPPORTED_CURRENCIES,
} from '~/services/wallet/currencyService';
import { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { MintSelectorSheet } from '~/shared/ui/HomeMintSelector';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { MintBalanceRow } from '~/shared/ui/MintBalanceRow';
import { BouncyAmount } from '~/shared/ui/BouncyAmount';
import { DestinationInputRow } from '~/shared/ui/DestinationInputRow';
import { normalizeP2PKRecipient } from '~/services/wallet/p2pkRecipient';

interface P2PKAmountStageProps {
  mintUrl?: string | null;
  onMintChange?: (url: string) => void;
  amount: string;
  setAmount: (val: string) => void;
  receiverPubkey: string;
  setReceiverPubkey: (val: string) => void;
  onContinue: () => void;
  balance: number;
  isLoading?: boolean;
  error?: string | null;
  isOffline?: boolean;
}

export function P2PKAmountStage({
  mintUrl,
  onMintChange,
  amount,
  setAmount,
  receiverPubkey,
  setReceiverPubkey,
  onContinue,
  balance,
  isLoading,
  error,
  isOffline,
}: P2PKAmountStageProps) {
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

  // Check if we just returned from the scanner via store
  useEffect(() => {
    if (scannerResult) {
      const token = scannerResult.trim();
      setReceiverPubkey(token);
      setScannerResult(null);
    }
  }, [scannerResult, setReceiverPubkey, setScannerResult]);

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

  const parsedAmountSats = parseInt(amount, 10) || 0;
  const isOverBalance = parsedAmountSats > balance;

  const isInvalidPubkey = useMemo(() => {
    const val = receiverPubkey.trim();
    if (!val) return false;
    try {
      normalizeP2PKRecipient(val);
      return false;
    } catch {
      return true;
    }
  }, [receiverPubkey]);

  const isValidAmount =
    parsedAmountSats > 0 && !isOverBalance && receiverPubkey.trim().length > 0 && !isInvalidPubkey;

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
    }
  }, [amount, inputMode]);

  const onKeypadChange = (rawVal: string) => {
    if (!fiatEnabled && !/^\d*$/.test(rawVal)) return;
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

  const handleOpenScanner = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(modals)/scanner',
      params: { returnTo: '/(modals)/send' },
    });
  };

  const [pasteError, setPasteError] = useState<string | null>(null);
  const handlePaste = async () => {
    setPasteError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setReceiverPubkey(text.trim());
      }
    } catch (e) {
      setPasteError(interactionCopy.clipboardReadFailed.title);
    }
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
          showMax={true}
          onMaxPress={handleMax}
          maxDisabled={balance === 0}
        />

        {/* Card Box Container */}
        <YStack
          width="100%"
          bg="$gray2"
          rounded="$6"
          p="$4"
          py="$5"
          items="center"
          gap="$3"
          borderWidth={0}
        >
          {/* Amount Display Section */}
          <YStack items="center" justify="center" py="$3" gap="$2" width="100%">
            {error || pasteError || isOverBalance ? (
              <Text color="$red10" fontSize="$3" fontWeight="600" text="center">
                {error || pasteError || 'Exceeds available balance'}
              </Text>
            ) : (
              <Text color="$gray10" fontSize="$3" fontWeight="500">
                How much to send?
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
        </YStack>

        {/* NPUB / Pubkey Input Row */}
        <DestinationInputRow
          value={receiverPubkey}
          onChangeText={setReceiverPubkey}
          placeholder="Hex public key, npub, or nprofile"
          onPaste={handlePaste}
          onScan={handleOpenScanner}
          defaultIcon={<KeyRound size="$1.5" color="$accent5" strokeWidth={2.5} />}
          isError={isInvalidPubkey}
        />
      </YStack>

      <NumericKeypad
        allowDecimal={fiatEnabled}
        showAmountDisplay={false}
        value={localInputValue}
        onValueChange={onKeypadChange}
        onConfirm={onContinue}
        confirmLabel={isLoading ? 'Processing...' : 'Continue'}
        confirmDisabled={!isValidAmount || isLoading}
        confirmIcon={isLoading ? <Spinner size="small" /> : undefined}
      />

      <MintSelectorSheet
        method="p2pk"
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
