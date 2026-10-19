import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import { useFlowMint } from '~/shared/hooks/useFlowMint';
import { PaymentMintRow } from '~/shared/ui/PaymentMintRow';
import { supportsPaymentMethod } from '~/services/wallet/paymentMintPolicy';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { PaymentReceipt } from '~/shared/ui/PaymentReceipt';
import { PendingOnchainLayout } from '~/features/history/components/PendingOnchainLayout';
import { onchainMeltOutcome } from '~/features/history/transactionPresentation';
import { usePendingOperationToast } from '~/shared/ui/OperationFeedback';
import { AppButton } from '~/shared/ui/AppButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { YStack, XStack, Text, Separator, View, YGroup } from 'tamagui';
import { AlertCircle, Landmark, ArrowUpDown, ShieldCheck, Bitcoin } from '@tamagui/lucide-icons';
import * as Clipboard from 'expo-clipboard';
import { networkService } from '~/services/platform/networkService';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useWalletStore } from '~/state/walletStore';
import { quotesService, initService } from '~/services/wallet';
import { useToastController } from '@tamagui/toast';

import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/api/bitcoinService';
import {
  currencyService,
  CurrencyCode,
  SUPPORTED_CURRENCIES,
} from '~/services/wallet/currencyService';
import { useSettingsStore } from '~/state/settingsStore';
import { NumericKeypad } from '~/shared/ui/NumericKeypad';
import { MintSelectorSheet } from '~/shared/ui/HomeMintSelector';
import { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { DestinationInputRow } from '~/shared/ui/DestinationInputRow';
import { MintBalanceRow } from '~/shared/ui/MintBalanceRow';
import { BouncyAmount } from '~/shared/ui/BouncyAmount';
import { MeltQuoteState } from '@cashu/cashu-ts';

export function OnchainMeltFlow() {
  const router = useRouter();
  const [eventTime, setEventTime] = useState<number>();
  const toast = useToastController();

  const { mintUrl: activeMintUrl, setMintUrl, balance } = useFlowMint();
  const quoteGeneration = useRef(0);
  const paymentLock = useRef(false);
  const refreshReviewMint = useRef<string | null>(null);
  const refreshBalance = useWalletStore((s) => s.refreshBalance);
  const scannerResult = useWalletStore((s) => s.scannerResult);
  const setScannerResult = useWalletStore((s) => s.setScannerResult);
  const { mints, refreshMintList, isInitializing, isRefreshing } = useWalletStore();
  const { primaryCurrency, secondaryCurrency, showBitcoinSymbol } = useSettingsStore();

  const sheetRef = useRef<AppBottomSheetRef>(null);

  const [step, setStep] = useState<
    'input' | 'confirm' | 'paying' | 'pending' | 'success' | 'error'
  >('input');
  usePendingOperationToast({ active: step === 'paying', title: 'Sending on-chain payment…' });
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('0');
  const [inputMode, setInputMode] = useState<'SATS' | 'FIAT'>(primaryCurrency);
  const [localInputValue, setLocalInputValue] = useState('0');
  const [isPasting, setIsPasting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [supportsOnchain, setSupportsOnchain] = useState<boolean | null>(null);
  const [isCheckingSupport, setIsCheckingSupport] = useState(false);

  // Quote details
  const [meltQuote, setMeltQuote] = useState<any>(null);
  const [selectedFeeIndex, setSelectedFeeIndex] = useState<number>(0);

  const isLoadingMint = isInitializing || isRefreshing;

  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
  });

  const currencySymbol = useMemo(() => {
    return SUPPORTED_CURRENCIES.find((c) => c.code === secondaryCurrency)?.symbol || '$';
  }, [secondaryCurrency]);

  const activeMint = useMemo(() => {
    if (!activeMintUrl) return null;
    return mints.find((m) => m.mintUrl.replace(/\/$/, '') === activeMintUrl.replace(/\/$/, ''));
  }, [mints, activeMintUrl]);

  const mintDisplayName = useMemo(() => {
    if (!activeMintUrl) return 'Selected Mint';
    if (activeMint?.nickname) return activeMint.nickname;
    if (activeMint?.name) return activeMint.name;
    return activeMintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }, [activeMint, activeMintUrl]);

  useEffect(() => {
    let cancelled = false;
    setIsCheckingSupport(true);
    setSupportsOnchain(null);
    if (activeMintUrl)
      fetch(activeMintUrl.replace(/\/$/, '') + '/v1/info')
        .then((r) => r.json())
        .then((info) => {
          if (!cancelled) setSupportsOnchain(supportsPaymentMethod(info, 'melt-onchain'));
        })
        .catch(() => {
          if (!cancelled) setSupportsOnchain(false);
        })
        .finally(() => {
          if (!cancelled) setIsCheckingSupport(false);
        });
    return () => {
      cancelled = true;
      ++quoteGeneration.current;
    };
  }, [activeMintUrl]);

  // Value derived for the non-active mode
  const conversionValue = useMemo(() => {
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

  const handlePreset = (presetSats: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAmount(presetSats);
    if (inputMode === 'SATS') {
      setLocalInputValue(presetSats);
    } else if (btcData?.price) {
      const fiat = currencyService.convertSatsToCurrency(Number(presetSats), btcData.price);
      setLocalInputValue(fiat > 0 ? fiat.toFixed(2) : '0');
    }
  };

  const handleMax = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const balString = String(balance);
    setAmount(balString);
    if (inputMode === 'SATS') {
      setLocalInputValue(balString);
    } else if (btcData?.price) {
      const fiat = currencyService.convertSatsToCurrency(balance, btcData.price);
      setLocalInputValue(fiat > 0 ? fiat.toFixed(2) : '0');
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

  // Dynamic font size based on string length to scale seamlessly
  const dynamicFontSize = useMemo(() => {
    const len = formattedDisplayValue.length;
    if (len <= 6) return 44;
    if (len <= 8) return 38;
    if (len <= 10) return 32;
    if (len <= 13) return 26;
    return 20;
  }, [formattedDisplayValue]);

  // Watch for scanned QR codes
  useEffect(() => {
    if (scannerResult) {
      let cleaned = scannerResult.trim();
      if (cleaned.toLowerCase().startsWith('bitcoin:')) {
        const parsed = cleaned.replace(/^bitcoin:/i, '');
        const addressPart = parsed.split('?')[0];
        setAddress(addressPart);

        const amountMatch = parsed.match(/amount=([0-9.]+)/i);
        if (amountMatch && amountMatch[1]) {
          const btc = parseFloat(amountMatch[1]);
          const sats = Math.round(btc * 100000000);
          setAmount(sats.toString());
        }
      } else {
        setAddress(cleaned);
      }
      setScannerResult(null);
    }
  }, [scannerResult, setScannerResult]);

  // Handle pasting from clipboard
  const handlePaste = async () => {
    setIsPasting(true);
    try {
      let text = await Clipboard.getStringAsync();
      text = text.trim();
      if (text.toLowerCase().startsWith('bitcoin:')) {
        const parsed = text.replace(/^bitcoin:/i, '');
        const addressPart = parsed.split('?')[0];
        setAddress(addressPart);

        const amountMatch = parsed.match(/amount=([0-9.]+)/i);
        if (amountMatch && amountMatch[1]) {
          const btc = parseFloat(amountMatch[1]);
          const sats = Math.round(btc * 100000000);
          setAmount(sats.toString());
        }
      } else {
        setAddress(text);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toast.show('Address pasted from clipboard', { kind: 'info' });
    } catch (e) {
      console.warn('[OnchainMeltFlow] Clipboard read failed:', e);
    } finally {
      setIsPasting(false);
    }
  };

  // Automatically clean and parse pasted Bitcoin URIs
  const handleAddressChange = (text: string) => {
    let cleaned = text.trim();
    if (cleaned.toLowerCase().startsWith('bitcoin:')) {
      const parsed = cleaned.replace(/^bitcoin:/i, '');
      cleaned = parsed.split('?')[0];

      const amountMatch = parsed.match(/amount=([0-9.]+)/i);
      if (amountMatch && amountMatch[1]) {
        const btc = parseFloat(amountMatch[1]);
        const sats = Math.round(btc * 100000000);
        setAmount(sats.toString());
      }
    }
    setAddress(cleaned);
  };

  // Address verification helper
  const isValidAddress = useMemo(() => {
    const cleaned = address.trim();
    if (!cleaned) return false;
    const regex = /^(1|3|bc1|tb1|bcrt1|m|n|2)[a-zA-Z0-9]{25,95}$/i;
    return regex.test(cleaned);
  }, [address]);

  const amountSats = parseInt(amount, 10) || 0;
  const isOverBalance = amountSats > balance;
  const canContinue =
    isValidAddress && amountSats > 0 && !isOverBalance && supportsOnchain === true;

  // Handle quote creation
  const handleGetQuote = async (selectedMint = activeMintUrl, reviewing = false) => {
    const generation = ++quoteGeneration.current;
    if (!selectedMint || (!reviewing && !canContinue)) return;

    const offline = await networkService.isOffline();
    if (offline) {
      setErrorMsg('You are offline. Please check your internet connection.');
      return;
    }

    setErrorMsg(null);
    setStep('paying');

    try {
      const quote = await quotesService.createOnchainMeltQuote(
        selectedMint,
        address.trim(),
        amountSats,
      );
      if (generation !== quoteGeneration.current) return;
      setMeltQuote(quote);
      if (quote.fee_options?.length) {
        setSelectedFeeIndex(quote.fee_options[0].fee_index);
      }
      setStep('confirm');
    } catch (err: any) {
      if (generation !== quoteGeneration.current) return;
      console.error('[OnchainMeltFlow] Melt quote failed:', err);
      setErrorMsg(err.message || 'Failed to estimate transaction fees');
      setStep('input');
    }
  };

  useEffect(() => {
    if (activeMintUrl && refreshReviewMint.current === activeMintUrl) {
      refreshReviewMint.current = null;
      void handleGetQuote(activeMintUrl, true);
    }
  }, [activeMintUrl]);

  // Confirm and melt payments
  const handlePayMelt = async () => {
    if (!activeMintUrl || !meltQuote || paymentLock.current) return;
    const selectedOption =
      meltQuote.fee_options?.find((o: any) => o.fee_index === selectedFeeIndex) ||
      meltQuote.fee_options?.[0];
    if (meltQuote.amount + (selectedOption?.fee_reserve ?? meltQuote.fee_reserve ?? 0) > balance) {
      setErrorMsg('Insufficient balance including the maximum fee');
      return;
    }
    if (meltQuote.expiry && meltQuote.expiry <= Date.now() / 1000) {
      setErrorMsg('Quote expired. Review a new quote.');
      return;
    }
    paymentLock.current = true;

    const offline = await networkService.isOffline();
    if (offline) {
      setErrorMsg('You are offline. Please check your internet connection.');
      paymentLock.current = false;
      return;
    }

    setErrorMsg(null);
    setStep('paying');

    try {
      const response = await quotesService.payOnchainMeltQuote(
        activeMintUrl,
        meltQuote,
        selectedFeeIndex,
      );
      // Log outgoing transaction in history
      try {
        const repo = initService.getRepo();
        const selectedOption =
          meltQuote.fee_options?.find((o: any) => o.fee_index === selectedFeeIndex) ||
          meltQuote.fee_options?.[0];
        const selectedFeeReserve = selectedOption
          ? selectedOption.fee_reserve
          : (meltQuote.fee_reserve ?? 0);

        const changeOutputsSerialized =
          response.changeOutputs?.map((h: any) => ({
            secret: Array.from(h.secret)
              .map((b: any) => b.toString(16).padStart(2, '0'))
              .join(''),
            blindingFactor: h.blindingFactor.toString(),
            blindedMessage: h.blindedMessage,
          })) ?? [];

        await repo.historyRepository.addHistoryEntry({
          mintUrl: activeMintUrl,
          unit: 'sat',
          createdAt: Date.now(),
          type: 'melt',
          amount: amountSats,
          quoteId: meltQuote.quote,
          state: MeltQuoteState.PENDING,
          metadata: {
            via: 'onchain',
            address: address.trim(),
            feeReserve: selectedFeeReserve,
            inputs: response.selectedInputs?.map((p: any) => ({
              secret: p.secret,
              amount: p.amount,
              id: p.id,
              C: p.C,
            })),
            changeOutputs: changeOutputsSerialized,
          },
        });
      } catch (histErr) {
        console.warn('[OnchainMeltFlow] History injection failed (non-fatal):', histErr);
      }

      // Reconcile change and input proof states through the existing wallet boundary
      // before presenting a terminal receipt. A POST acknowledgement can still be pending.
      await refreshOnchainPayment().catch(() => setStep('pending'));
      refreshBalance();
    } catch (err: any) {
      console.error('[OnchainMeltFlow] Payment execution failed:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMsg(err.message || 'Failed to send payment');
      setStep('error');
    }
  };

  const refreshOnchainPayment = async () => {
    if (!activeMintUrl || !meltQuote) return;
    await useWalletStore.getState().autoCheckPendingOnchainQuotes();
    const history = await initService
      .getRepo()
      .historyRepository.getMeltHistoryEntry(activeMintUrl, meltQuote.quote);
    const outcome = onchainMeltOutcome(history?.state);
    if (outcome === 'paid') {
      setEventTime((time) => time ?? Date.now());
      setStep('success');
    } else if (outcome === 'failed') {
      setErrorMsg('The mint did not complete this on-chain payment.');
      setStep('error');
    } else {
      setStep('pending');
    }
  };

  // Render loading/processing state
  if (step === 'paying') {
    return (
      <YStack flex={1} justify="center" items="center" gap="$4" bg="$background" p="$6">
        <Landmark size={48} color="$accent10" />
        <Text color="$gray10" fontSize="$4" fontWeight="600">
          On-chain payment
        </Text>
        <Text fontSize="$7" fontWeight="700">
          {Number(amount).toLocaleString()}
          <Text fontSize="$4">{' sats'}</Text>
        </Text>
        <Text color="$gray10" textAlign="center">
          {address}
        </Text>
      </YStack>
    );
  }

  // Render error state
  if (step === 'error')
    return (
      <PaymentReceipt
        status="error"
        inset={false}
        title="Payment not completed"
        amount={amountSats}
        mintUrl={activeMintUrl || undefined}
        completed={false}
        error={errorMsg}
        actionLabel="Try again"
        actionEmphasis="primary"
        onClose={() => setStep('input')}
      />
    );

  if (step === 'pending')
    return (
      <PendingOnchainLayout
        direction="withdrawal"
        amount={amountSats}
        address={address}
        mint={mintDisplayName}
        onRefresh={refreshOnchainPayment}
        onClose={() => router.back()}
        inset={false}
      />
    );

  // Render success state
  if (step === 'success')
    return (
      <PaymentReceipt
        inset={false}
        title="Payment sent"
        amount={amountSats}
        mintUrl={activeMintUrl || undefined}
        time={eventTime}
        completed
        onClose={() => router.back()}
      >
        <ListTableRow label="Method" value="Bitcoin on-chain" />
        <ListTableRow label="Destination" value={address} isCopyable copyValue={address} />
      </PaymentReceipt>
    );

  // Render confirmation state
  if (step === 'confirm' && meltQuote) {
    const selectedOption =
      meltQuote.fee_options?.find((o: any) => o.fee_index === selectedFeeIndex) ||
      meltQuote.fee_options?.[0];
    const selectedFeeReserve = selectedOption
      ? selectedOption.fee_reserve
      : (meltQuote.fee_reserve ?? 0);
    const total = meltQuote.amount + selectedFeeReserve;
    const shortAddress = `${address.substring(0, 10)}...${address.substring(address.length - 8)}`;

    const fiatAmount = btcData?.price
      ? currencyService.convertSatsToCurrency(meltQuote.amount, btcData.price)
      : 0;
    const formattedFiat = btcData?.price
      ? currencyService.formatValue(fiatAmount, secondaryCurrency as CurrencyCode)
      : '—';

    const totalFiat = btcData?.price
      ? currencyService.convertSatsToCurrency(total, btcData.price)
      : 0;
    const formattedTotalFiat = btcData?.price
      ? currencyService.formatValue(totalFiat, secondaryCurrency as CurrencyCode)
      : '—';

    const dynamicFontSize = meltQuote.amount.toString().length > 6 ? 32 : 40;

    return (
      <>
        <PaymentFlowHeader title="Confirm payment" onBack={() => setStep('input')} />
        <PaymentStageLayout
          inset={false}
          hero={<PaymentAmount amount={meltQuote.amount} label="You're paying" />}
          footer={
            <AppButton
              size="large"
              fullWidth
              disabled={total > balance || paymentLock.current}
              onPress={handlePayMelt}
            >
              Confirm &amp; send
            </AppButton>
          }
        >
          {/* Fee Option Selection Selector */}
          {meltQuote.fee_options && meltQuote.fee_options.length > 0 && (
            <YStack gap="$2">
              <Text fontSize="$3" color="$gray10" fontWeight="700" px="$1">
                Choose confirmation speed
              </Text>
              <YStack gap="$2">
                {meltQuote.fee_options.map((option: any) => {
                  const isSelected = option.fee_index === selectedFeeIndex;
                  return (
                    <XStack
                      key={option.fee_index}
                      borderWidth={2}
                      borderColor={isSelected ? '$accent10' : '$gray5'}
                      p="$3"
                      rounded="$6"
                      justify="space-between"
                      items="center"
                      onPress={() => setSelectedFeeIndex(option.fee_index)}
                      pressStyle={{ opacity: 0.85 }}
                    >
                      <YStack>
                        <Text fontWeight="700" fontSize="$4" color="$color">
                          {option.estimated_blocks}{' '}
                          {option.estimated_blocks === 1 ? 'block' : 'blocks'}
                        </Text>
                        <Text fontSize="$2" color="$gray10">
                          Estimated confirmation
                        </Text>
                      </YStack>
                      <XStack gap="$3" items="center">
                        <YStack items="flex-end">
                          <Text fontWeight="700" fontSize="$4" color="$color">
                            {option.fee_reserve} sats
                          </Text>
                          <Text fontSize="$2" color="$gray10">
                            fee reserve
                          </Text>
                        </YStack>
                        <View
                          width={22}
                          height={22}
                          rounded="$11"
                          borderWidth={2}
                          borderColor={isSelected ? '$accent10' : '$gray8'}
                          items="center"
                          justify="center"
                        >
                          {isSelected && (
                            <View width={10} height={10} rounded="$6" bg="$accent10" />
                          )}
                        </View>
                      </XStack>
                    </XStack>
                  );
                })}
              </YStack>
            </YStack>
          )}

          {/* Details List */}
          <ListTable compact bg="$gray2" rounded="$6" overflow="hidden" mb="$3">
            <YGroup separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
              <PaymentMintRow
                mintUrl={activeMintUrl || ''}
                method="melt-onchain"
                onSelect={(url) => {
                  if (url === activeMintUrl) return;
                  refreshReviewMint.current = url;
                  setMintUrl(url);
                  setMeltQuote(null);
                }}
              />
              <DetailItem
                label="Destination"
                value={shortAddress}
                icon={<Landmark size={16} color="$yellow10" />}
              />
              <DetailItem
                label="Maximum network fee"
                value={`${selectedFeeReserve} sats`}
                valueColor="$orange10"
                icon={<ShieldCheck size={16} color="$orange10" />}
              />
              <DetailItem
                label="Maximum total"
                value={`${total.toLocaleString()} sats (≈ ${formattedTotalFiat})`}
                valueColor="$accent10"
                icon={<ShieldCheck size={16} color="$accent10" />}
              />
            </YGroup>
          </ListTable>
          {errorMsg && (
            <Text color="$red10" p="$3">
              {errorMsg}
            </Text>
          )}
        </PaymentStageLayout>
      </>
    );
  }

  // Render input form state (AmountStage look-alike with address field)
  return (
    <YStack flex={1} justify="space-between" bg="$background">
      <YStack items="center" gap="$1.5" width="100%">
        {/* Mint Selector & Balance Row */}
        <MintBalanceRow
          activeMint={activeMint}
          activeMintUrl={activeMintUrl || undefined}
          displayName={mintDisplayName}
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

        {/* Card Box Container (Amount Display) */}
        <YStack width="100%" bg="$gray3" rounded="$6" p="$4" py="$5" items="center" gap="$3">
          <YStack items="center" justify="center" py="$4" gap="$2" width="100%">
            <Text color="$gray10" fontSize="$3" fontWeight="500">
              Enter Amount
            </Text>

            <BouncyAmount
              value={formattedDisplayValue}
              fontSize={dynamicFontSize}
              prefix={inputMode === 'SATS' ? (showBitcoinSymbol ? '₿' : '') : currencySymbol}
              suffix={inputMode === 'SATS' && !showBitcoinSymbol ? ' sats' : ''}
            />

            <AppPressable
              px={12}
              py={4}
              rounded="$10"
              bg="$gray4"
              pressStyle={{ scale: 0.96, bg: '$gray5' }}
              onPress={toggleMode}
              minHeight={36}
              flexDirection="row"
              items="center"
              justify="center"
              gap={8}
            >
              <Text fontSize="$3" fontWeight="600" color="$accent10">
                {conversionValue}
              </Text>
              <ArrowUpDown size={14} color="$accent10" strokeWidth={2.5} />
            </AppPressable>
          </YStack>
        </YStack>

        {/* Destination Address Row (moved below Amount Card) */}
        <DestinationInputRow
          value={address}
          onChangeText={handleAddressChange}
          placeholder="Enter target BTC address..."
          onPaste={handlePaste}
          onScan={() => {
            router.push({
              pathname: '/(modals)/scanner',
              params: { returnTo: '/(modals)/melt' },
            });
          }}
          defaultIcon={<Bitcoin size="$1.5" strokeWidth={2.5} color="$accent5" />}
          isPasting={isPasting}
          isError={address.trim().length > 0 && !isValidAddress}
        />

        {/* Warnings and Alerts */}
        <YStack width="100%" gap="$2" mt="$1">
          {isOverBalance && (
            <XStack bg="$red3" p="$3" rounded="$4" items="center" gap="$2" width="100%">
              <AlertCircle size={20} color="$red10" />
              <Text flex={1} fontSize="$3" color="$red10" fontWeight="600">
                Insufficient balance in selected mint.
              </Text>
            </XStack>
          )}

          {supportsOnchain === false && (
            <XStack bg="$red3" p="$3" rounded="$4" items="center" gap="$2" width="100%">
              <AlertCircle size={20} color="$red10" />
              <Text flex={1} fontSize="$3" color="$red10" fontWeight="600">
                This mint does not support on-chain cash withdrawal (NUT-30).
              </Text>
            </XStack>
          )}

          {errorMsg && (
            <XStack bg="$red3" p="$3" rounded="$4" items="center" gap="$2" width="100%">
              <AlertCircle size={20} color="$red10" />
              <Text flex={1} fontSize="$3" color="$red10">
                {errorMsg}
              </Text>
            </XStack>
          )}
        </YStack>
      </YStack>
      <NumericKeypad
        showAmountDisplay={false}
        value={localInputValue}
        onValueChange={onKeypadChange}
        onConfirm={() => void handleGetQuote()}
        confirmLabel="Continue"
        confirmDisabled={!canContinue}
      />

      <MintSelectorSheet
        ref={sheetRef}
        activeMintUrl={activeMintUrl || undefined}
        onSelect={setMintUrl}
        changeGlobalActiveMint={false}
        showAllOption={false}
        trustedOnly
        method="melt-onchain"
      />
    </YStack>
  );
}

function DetailItem({
  label,
  value,
  icon,
  valueColor,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  valueColor?: string;
}) {
  return <ListTableRow label={label} value={value} valueColor={valueColor} />;
}
