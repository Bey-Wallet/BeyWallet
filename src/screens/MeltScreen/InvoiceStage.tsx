import React, { useState, useMemo, useRef, useEffect } from "react";
import { YStack, XStack, Text, H1, Input, Button, Avatar } from "tamagui";
import { Clipboard as ClipboardIcon, ScanLine, AlertCircle, ChevronDown, Sprout, ArrowUpDown, X, Zap } from "@tamagui/lucide-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Spinner } from "~/components/UI/Spinner";
import { useWalletStore } from "~/store/walletStore";
import { useSettingsStore } from "~/store/settingsStore";
import { useQuery } from "@tanstack/react-query";
import { bitcoinService } from "~/services/bitcoinService";
import { currencyService, CurrencyCode, SUPPORTED_CURRENCIES } from "~/services/currencyService";
import { MintSelectorSheet } from "~/components/HomeMintSelector";
import { AppBottomSheetRef } from "~/components/UI/AppBottomSheet";
import { useRouter } from "expo-router";
import { detectLightningInputType } from "~/services/lnurlService";
import { NumericKeypad } from "~/components/UI/NumericKeypad";
import { DestinationInputRow } from "~/components/UI/DestinationInputRow";
import { MintBalanceRow } from "~/components/UI/MintBalanceRow";
import { BouncyAmount } from "~/components/UI/BouncyAmount";

interface InvoiceStageProps {
  amount: string;
  setAmount: (val: string) => void;
  invoice: string;
  setInvoice: (val: string) => void;
  onContinue: () => void;
  balance: number;
  isLoading?: boolean;
  error?: string | null;
}

export function InvoiceStage({
  amount,
  setAmount,
  invoice,
  setInvoice,
  onContinue,
  balance,
  isLoading,
  error,
}: InvoiceStageProps) {
  const [isPasting, setIsPasting] = useState(false);
  const { activeMintUrl, mints, refreshMintList, isInitializing, isRefreshing, scannerResult, setScannerResult } = useWalletStore();
  const { primaryCurrency, secondaryCurrency, showBitcoinSymbol } = useSettingsStore();
  const [inputMode, setInputMode] = useState<'SATS' | 'FIAT'>(primaryCurrency);
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const router = useRouter();

  const isLoadingMint = isInitializing || isRefreshing;

  // Check if we just returned from the scanner
  useEffect(() => {
    if (scannerResult) {
      let cleaned = scannerResult.trim();
      if (cleaned.toLowerCase().startsWith("lightning:")) {
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
  });

  const currencySymbol = useMemo(() => {
    return SUPPORTED_CURRENCIES.find(c => c.code === secondaryCurrency)?.symbol || '$';
  }, [secondaryCurrency]);

  const activeMint = useMemo(() => {
    if (!activeMintUrl) return null;
    const normalizeUrl = (url: string) => url.replace(/\/$/, "");
    return mints.find(m => normalizeUrl(m.mintUrl) === normalizeUrl(activeMintUrl));
  }, [mints, activeMintUrl]);

  const displayName = useMemo(() => {
    if (!activeMintUrl) return "Select Mint";
    if (activeMint?.nickname) return activeMint.nickname;
    if (activeMint?.name) return activeMint.name;
    return activeMintUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }, [activeMint, activeMintUrl]);

  const isValidInvoice = useMemo(() => {
    if (!invoice.trim()) return false;
    const lower = invoice.trim().toLowerCase();
    return (
      lower.startsWith("lnbc") ||
      lower.startsWith("lntb") ||
      lower.startsWith("lnurl") ||
      lower.includes("@")
    );
  }, [invoice]);

  const isBolt11 = useMemo(() => {
    return detectLightningInputType(invoice) === 'bolt11';
  }, [invoice]);

  const parsedAmountSats = parseInt(amount, 10) || 0;
  const isOverBalance = parsedAmountSats > balance;
  const isValidAmount = parsedAmountSats > 0 && !isOverBalance && isValidInvoice;

  const conversionValue = useMemo(() => {
    if (!btcData?.price) return '0';
    if (inputMode === 'SATS') {
      const sats = Number(amount) || 0;
      return currencyService.formatValue(
        currencyService.convertSatsToCurrency(sats, btcData.price),
        secondaryCurrency as CurrencyCode
      );
    } else {
      const sats = Number(amount) || 0;
      return currencyService.formatSats(sats);
    }
  }, [amount, btcData?.price, inputMode, secondaryCurrency]);

  const [localInputValue, setLocalInputValue] = useState(amount);

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
        if (cleaned.toLowerCase().startsWith("lightning:")) {
          cleaned = cleaned.slice(10);
        }
        setInvoice(cleaned);
      }
    } catch (e) {
      console.warn("[MeltScreen] Clipboard read failed:", e);
    } finally {
      setIsPasting(false);
    }
  };

  const handleOpenScanner = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(modals)/scanner',
      params: { returnTo: '/(modals)/melt' }
    });
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInvoice("");
    setAmount("0");
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
          bg="$gray3"
          rounded="$6"
          p="$4"
          py="$6"
          items="center"
          gap="$3"
          borderWidth={0}
        >
          {/* Amount Display Section */}
          <YStack items="center" justify="center" py="$0" gap="$2" width="100%">
            {error || isOverBalance ? (
              <Text color="$red10" fontSize="$3" fontWeight="600" textAlign="center">
                {error || "Exceeds available balance"}
              </Text>
            ) : (
              <Text color="$gray10" fontSize="$3" fontWeight="500">
                {isBolt11 ? "Lightning Invoice Amount" : "How much to pay?"}
              </Text>
            )}

                        <BouncyAmount
                            value={formattedDisplayValue}
                            fontSize={dynamicFontSize}
                            prefix={inputMode === 'SATS' ? (showBitcoinSymbol ? '₿' : '') : currencySymbol}
                            suffix={inputMode === 'SATS' && !showBitcoinSymbol ? ' SATS' : ''}
                        />

            <Button
              size="$3"
              rounded="$10"
              bg="$gray5"
              pressStyle={{ scale: 0.96, bg: "$gray5" }}
              onPress={toggleMode}
              disabled={isBolt11}
              opacity={isBolt11 ? 0.6 : 1}
              iconAfter={<ArrowUpDown size={14} color="$accent10" strokeWidth={2.5} />}
            >
              {conversionValue}
            </Button>
          </YStack>
        </YStack>
        {/* Invoice / LN Address Input Row */}
        <DestinationInputRow
            value={invoice}
            onChangeText={setInvoice}
            placeholder="lnbc... or lightning address"
            onPaste={handlePaste}
            onScan={handleOpenScanner}
            defaultIcon={<Zap size="$1.5" color="$accent10" />}
            isPasting={isPasting}
            isError={invoice.trim().length > 0 && !isValidInvoice}
            multiline={true}
        />
      </YStack>

      <NumericKeypad
        showAmountDisplay={false}
        value={localInputValue}
        onValueChange={onKeypadChange}
        onConfirm={onContinue}
        confirmLabel={isLoading ? "Processing..." : "Continue"}
        confirmDisabled={!isValidAmount || isLoading}
        confirmIcon={isLoading ? <Spinner size="small" /> : undefined}
      />

      <MintSelectorSheet ref={sheetRef} />
    </YStack>
  );
}
