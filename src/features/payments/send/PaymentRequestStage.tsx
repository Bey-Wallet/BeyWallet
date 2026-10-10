import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  YStack,
  XStack,
  Text,
  Button,
  Separator,
  View,
  Spinner as TamaguiSpinner,
  Avatar,
  H1,
  ScrollView,
} from 'tamagui';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Zap,
  ShieldCheck,
  FileText,
  Sprout,
  Landmark,
} from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/api/bitcoinService';
import { currencyService, SUPPORTED_CURRENCIES } from '~/services/wallet/currencyService';
import {
  isPaymentMintAllowed,
  type ParsedPaymentRequest,
} from '~/services/wallet/paymentRequestModel';
import {
  PaymentRequestPayment,
  previewPaymentRequest,
  type PaymentRequestCost,
} from '~/services/wallet/paymentRequestPayment';
import { PaymentStatusOverlay, type PaymentStatusState } from '~/shared/ui/PaymentStatusOverlay';
import Blockies from '~/shared/ui/Blockies';
import { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { MintSelectorSheet } from '~/shared/ui/HomeMintSelector';
import { MintBalanceRow } from '~/shared/ui/MintBalanceRow';

// ─── Types ────────────────────────────────────────────────────────────────────

export type { ParsedPaymentRequest } from '~/services/wallet/paymentRequestModel';

interface PaymentRequestStageProps {
  request: ParsedPaymentRequest;
  inboxItemId?: string;
  onSuccess: (amount: number, operationId: string, encodedToken: string) => void;
  onError: (msg: string) => void;
  onCancel: () => void;
  writeNfc?: (token: string) => Promise<void>;
  autoPay?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PaymentRequestStage({
  request,
  inboxItemId,
  onSuccess,
  onError,
  onCancel,
  writeNfc,
  autoPay = false,
}: PaymentRequestStageProps) {
  const [isSending, setIsSending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [overlayState, setOverlayState] = useState<PaymentStatusState | null>(null);
  const [selectedMintUrl, setSelectedMintUrl] = useState<string | null>(null);
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const paymentRef = useRef<PaymentRequestPayment | null>(null);
  const actionLock = useRef(false);
  const automaticPaymentStarted = useRef(false);
  const [cost, setCost] = useState<PaymentRequestCost | null>(null);
  const [receipt, setReceipt] = useState<'awaiting' | 'unconfirmed' | null>(null);
  const [hasOperation, setHasOperation] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const {
    balance: storeBalance,
    activeMintUrl,
    mints,
    balances,
    refreshMintList,
  } = useWalletStore();
  const { secondaryCurrency, showBitcoinSymbol } = useSettingsStore();

  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
  });

  const currencySymbol = useMemo(() => {
    return SUPPORTED_CURRENCIES.find((c) => c.code === secondaryCurrency)?.symbol || '$';
  }, [secondaryCurrency]);

  // ── Mint compatibility ───────────────────────────────────────────────────
  const matchedMint = useMemo(() => {
    if (paymentRef.current) return paymentRef.current.cost.mintUrl;
    if (selectedMintUrl) return selectedMintUrl;
    const candidates = mints.filter((mint) => isPaymentMintAllowed(request, mint.mintUrl));
    const funded = candidates.filter((mint) => (balances[mint.mintUrl] ?? 0) >= request.amount);
    return (
      funded.find((mint) => mint.mintUrl === activeMintUrl)?.mintUrl ||
      funded[0]?.mintUrl ||
      candidates[0]?.mintUrl ||
      null
    );
  }, [selectedMintUrl, activeMintUrl, mints, request, balances, hasOperation]);

  useEffect(() => {
    if (paymentRef.current) return;
    let cancelled = false;
    setCost(null);
    setLocalError(null);
    if (matchedMint) {
      previewPaymentRequest(request, matchedMint)
        .then((preview) => {
          if (!cancelled) setCost(preview);
        })
        .catch((error) => {
          if (!cancelled) setLocalError(error.message);
        });
    } else {
      setLocalError('No compatible funded mint is available');
    }
    return () => {
      cancelled = true;
    };
  }, [matchedMint, request]);

  const activeMintInfo = useMemo(() => {
    if (!matchedMint) return null;
    return mints.find(
      (m) =>
        m.mintUrl.replace(/\/$/, '').toLowerCase() === matchedMint.replace(/\/$/, '').toLowerCase(),
    );
  }, [matchedMint, mints]);

  const mintDisplayName = useMemo(() => {
    if (!matchedMint) return 'No Compatible Mint';
    if (activeMintInfo?.nickname) return activeMintInfo.nickname;
    if (activeMintInfo?.name) return activeMintInfo.name;
    return matchedMint.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }, [activeMintInfo, matchedMint]);

  const isCompatible = useMemo(() => {
    if (!matchedMint) return false;
    return isPaymentMintAllowed(request, matchedMint);
  }, [matchedMint, request]);

  const currentMintBalance = useMemo(() => {
    if (!matchedMint) return 0;
    return balances[matchedMint] ?? (matchedMint === activeMintUrl ? storeBalance : 0);
  }, [matchedMint, balances, activeMintUrl, storeBalance]);

  const amountSats = request.amount ?? 0;
  const isEnough = !!cost && currentMintBalance >= cost.totalDebit;

  const fiatValue = useMemo(() => {
    if (!btcData?.price || !amountSats) return '0.00';
    const val = currencyService.convertSatsToCurrency(amountSats, btcData.price);
    return val.toFixed(2);
  }, [btcData?.price, amountSats]);

  const formattedSatsString = useMemo(() => {
    return amountSats.toLocaleString('en-US');
  }, [amountSats]);

  // ── Send handler ─────────────────────────────────────────────────────────
  const handlePay = async () => {
    if (actionLock.current || (!paymentRef.current && (!isCompatible || !isEnough || !cost)))
      return;
    actionLock.current = true;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSending(true);
    setLocalError(null);
    setOverlayState('sending');

    try {
      paymentRef.current ??= new PaymentRequestPayment(request, cost!);
      await paymentRef.current.deliver(writeNfc);
      setOverlayState(null);
      setReceipt('awaiting');
    } catch (err: any) {
      const operationId = paymentRef.current?.operationId;
      const msg = operationId
        ? `${paymentRef.current?.failureMessage || 'Delivery unconfirmed.'} Existing operation ${operationId} is in History. Do not pay this request again.`
        : err?.message || 'Payment failed';
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setOverlayState(null);
      setLocalError(msg);
    } finally {
      setHasOperation(!!paymentRef.current?.operationId);
      setIsSending(false);
      actionLock.current = false;
    }
  };

  const refreshReceipt = async () => {
    if (actionLock.current || !paymentRef.current) return;
    actionLock.current = true;
    try {
      const payment = paymentRef.current;
      if (await payment.refresh()) {
        if (!mounted.current) return;
        if (inboxItemId) {
          const { useNostrInboxStore } = await import('~/state/nostrInboxStore');
          useNostrInboxStore.getState().markClaimed(inboxItemId);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSuccess(amountSats, payment.operationId!, payment.encoded!);
      }
    } catch {
      if (mounted.current)
        setLocalError(
          'Receipt check unavailable. The existing payment remains pending in History.',
        );
    } finally {
      actionLock.current = false;
    }
  };

  useEffect(() => {
    if (!autoPay || automaticPaymentStarted.current || !cost || !isCompatible || !isEnough) return;
    automaticPaymentStarted.current = true;
    void handlePay();
  }, [autoPay, cost, isCompatible, isEnough]);

  useEffect(() => {
    if (receipt !== 'awaiting') return;
    const poll = setInterval(() => {
      void refreshReceipt();
    }, 3000);
    const timeout = setTimeout(() => {
      setReceipt('unconfirmed');
    }, 60_000);
    return () => {
      clearInterval(poll);
      clearTimeout(timeout);
    };
  }, [receipt]);

  const truncateTarget = (s?: string) => {
    if (!s) return undefined;
    if (s.includes('@')) return s;
    if (s.length > 20) return `${s.slice(0, 10)}...${s.slice(-6)}`;
    return s;
  };

  return (
    <YStack flex={1} bg="$background">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 150 } as any}
        showsVerticalScrollIndicator={false}
      >
        <YStack gap="$4">
          {/* Mint Balance Row Selector */}

          {/* Middle Amount Display */}
          <YStack gap="$3" py="$6" items="center" justify="center">
            <Text fontSize={52} fontWeight="700" color="$accent3" lineHeight={54}>
              {showBitcoinSymbol ? `₿${formattedSatsString}` : `${formattedSatsString} SATS`}
            </Text>
            <Text color="$accent5" fontWeight="600" fontSize={16}>
              ≈ {currencySymbol}
              {fiatValue} {secondaryCurrency}
            </Text>
          </YStack>

          {/* Status Badge */}
          <XStack self="center" items="center" gap="$2" bg="$purple9" px="$4" py="$3" rounded="$10">
            <FileText size={16} color="white" />
            <Text fontSize="$3" fontWeight="700" color="white">
              {request.description || 'Requested'}
            </Text>
          </XStack>

          {/* Compatibility Alert */}
          {!isCompatible && (
            <YStack bg="$red3" p="$3" px="$4" rounded="$4" gap="$1.5">
              <XStack gap="$2" items="center">
                <AlertCircle size={18} color="$red10" />
                <Text color="$red10" fontSize="$3" fontWeight="700">
                  Mint Not Compatible
                </Text>
              </XStack>
              <Text color="$red10" fontSize="$2" fontWeight="500" lineHeight={18}>
                Requires one of:{' '}
                {request.mints.map((m) => m.replace(/^https?:\/\//, '')).join(', ')}
              </Text>
            </YStack>
          )}

          {/* Local Error */}
          {localError && (
            <YStack bg="$red3" p="$3" px="$4" rounded="$4" gap="$1.5">
              <XStack gap="$2" items="center">
                <AlertCircle size={18} color="$red10" />
                <Text color="$red10" fontSize="$3" fontWeight="700">
                  Error
                </Text>
              </XStack>
              <Text color="$red10" fontSize="$2" fontWeight="500" lineHeight={18}>
                {localError}
              </Text>
            </YStack>
          )}

          {/* Details List */}
          {(receipt || hasOperation) && (
            <YStack gap="$2" p="$4">
              <Text fontWeight="700">
                {receipt === 'awaiting' ? 'Awaiting recipient' : 'Receipt unconfirmed'}
              </Text>
              <Text>The payment remains pending in History. Do not pay this request again.</Text>
              <Button onPress={refreshReceipt}>Refresh status</Button>
            </YStack>
          )}
          <YStack bg="$gray2" rounded="$6" overflow="hidden" mb="$3">
            <View p="$3" px="$4">
              <Text fontSize="$3" fontWeight="700" color="$gray12">
                Details
              </Text>
            </View>
            <Separator borderColor="$borderColor" opacity={0.3} />
            <YStack separator={<Separator borderColor="$borderColor" opacity={0.4} />}>
              {cost && (
                <DetailItem
                  label="Total debit (including fees)"
                  value={`${cost.totalDebit} sats`}
                />
              )}
              {cost && <DetailItem label="Receiver input fee" value={`${cost.receiverFee} sats`} />}
              {cost && <DetailItem label="Wallet swap fee" value={`${cost.senderFee} sats`} />}
              <DetailItem
                label="Mint"
                value={mintDisplayName}
                onPress={() => {
                  refreshMintList();
                  sheetRef.current?.present();
                }}
                isClickable
                icon={
                  isCompatible ? (
                    <Avatar rounded="$3" size="$1.5">
                      <Avatar.Image src={activeMintInfo?.icon} />
                      <Avatar.Fallback bg="$green3" items="center" justify="center">
                        <Sprout size={12} color="$green10" />
                      </Avatar.Fallback>
                    </Avatar>
                  ) : (
                    <AlertCircle size={16} color="$red10" />
                  )
                }
                valueColor={isCompatible ? '$color' : '$red10'}
              />
              <DetailItem
                label="Method"
                value={request.nostrTarget ? 'Payment Request via Nostr' : 'Direct Cashu Request'}
                icon={<Zap size={16} color="$yellow10" />}
              />
              {request.nostrTarget && (
                <XStack justify="space-between" items="center" py="$3" px="$4">
                  <Text fontSize="$3" color="$gray10" fontWeight="600">
                    Recipient
                  </Text>
                  <XStack gap="$2" items="center">
                    <Blockies
                      seed={request.nostrTarget}
                      size={6}
                      scale={2}
                      style={{ borderRadius: 2 }}
                    />
                    <Text
                      fontSize="$3"
                      fontWeight="800"
                      color="$color"
                      numberOfLines={1}
                      style={{ maxWidth: 180 }}
                    >
                      {truncateTarget(request.nostrTarget)}
                    </Text>
                  </XStack>
                </XStack>
              )}
              <DetailItem
                label="Your Balance"
                value={currencyService.formatSats(currentMintBalance)}
                valueColor={isEnough ? '$green11' : '$red10'}
                icon={<ShieldCheck size={16} color={isEnough ? '$green11' : '$red10'} />}
              />
            </YStack>
          </YStack>
        </YStack>
      </ScrollView>

      {/* Bottom Fixed Action Buttons (Cancel on Left, Pay on Right) */}
      <YStack position="absolute" b="$4" l="$1" r="$1" bg="$background" gap="$3">
        <MintBalanceRow
          activeMint={activeMintInfo}
          activeMintUrl={matchedMint || undefined}
          displayName={mintDisplayName}
          balance={currentMintBalance}
          isSelector={true}
          onPress={() => {
            refreshMintList();
            sheetRef.current?.present();
          }}
        />

        <XStack gap="$3">
          <Button
            flex={1}
            bg="$gray3"
            color="$color"
            height={60}
            rounded="$6"
            disabled={isSending}
            fontWeight="700"
            fontSize="$5"
            onPress={onCancel}
          >
            Cancel
          </Button>
          {(!autoPay || hasOperation) && (
            <Button
              flex={1}
              theme="accent"
              height={60}
              rounded="$6"
              disabled={!!receipt || (!hasOperation && (!isCompatible || !isEnough)) || isSending}
              icon={isSending ? <TamaguiSpinner size="small" color="white" /> : undefined}
              fontWeight="700"
              fontSize="$5"
              onPress={handlePay}
            >
              {isSending ? 'Sending…' : hasOperation ? 'Retry delivery' : 'Pay'}
            </Button>
          )}
        </XStack>
      </YStack>

      <PaymentStatusOverlay
        visible={!!overlayState}
        state={overlayState || 'sending'}
        direction="send"
        amount={amountSats}
        recipient={truncateTarget(request.nostrTarget)}
        mintUrl={matchedMint || request.mints[0] || ''}
        errorMessage={localError || undefined}
        onDismiss={() => {
          setOverlayState(null);
        }}
        onRetry={() => {
          setOverlayState(null);
          setLocalError(null);
        }}
      />

      <MintSelectorSheet
        ref={sheetRef}
        onSelect={(mintUrl) => {
          if (paymentRef.current) return;
          setSelectedMintUrl(mintUrl);
        }}
        activeMintUrl={matchedMint || undefined}
        changeGlobalActiveMint={false}
      />
    </YStack>
  );
}

function DetailItem({
  label,
  value,
  icon,
  valueColor,
  onPress,
  isClickable,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  valueColor?: string;
  onPress?: () => void;
  isClickable?: boolean;
}) {
  return (
    <XStack
      justify="space-between"
      items="center"
      py="$3"
      px="$4"
      onPress={onPress}
      pressStyle={isClickable ? { opacity: 0.7 } : undefined}
    >
      <Text fontSize="$3" color="$gray10" fontWeight="600">
        {label}
      </Text>
      <XStack gap="$2" items="center">
        {icon}
        <Text
          fontSize="$3"
          fontWeight="800"
          color={valueColor || '$color'}
          numberOfLines={1}
          style={{ maxWidth: 220 }}
        >
          {value}
        </Text>
      </XStack>
    </XStack>
  );
}
