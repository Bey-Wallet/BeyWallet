import React, { useMemo, useState } from 'react';
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
import { useWalletStore } from '~/store/walletStore';
import { useSettingsStore } from '~/store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/bitcoinService';
import { currencyService, SUPPORTED_CURRENCIES } from '~/services/currencyService';
import { walletService } from '~/services/core';
import { sendNostrToken } from '~/services/core/nostrService';
import { decodeToken } from '~/services/core/tokenUtils';
import {
  PaymentStatusOverlay,
  type PaymentStatusState,
} from '~/components/PaymentStatusOverlay';
import { seedService } from '~/services/seedService';
import Blockies from '~/components/UI/Blockies';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedPaymentRequest {
  /** Raw creqA... string */
  raw: string;
  /** Request ID */
  id?: string;
  /** Amount in sats (may be undefined if open-ended) */
  amount?: number;
  /** Currency unit */
  unit?: string;
  /** Optional memo / description */
  description?: string;
  /** Accepted mint URLs */
  mints: string[];
  /** Nostr pubkey or npub the payment should be sent to */
  nostrTarget?: string;
}

interface PaymentRequestStageProps {
  request: ParsedPaymentRequest;
  inboxItemId?: string;
  onSuccess: (amount: number, operationId: string) => void;
  onError: (msg: string) => void;
  onCancel: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PaymentRequestStage({
  request,
  inboxItemId,
  onSuccess,
  onError,
  onCancel,
}: PaymentRequestStageProps) {
  const [isSending, setIsSending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [overlayState, setOverlayState] = useState<PaymentStatusState | null>(null);

  const { balance, activeMintUrl, mints } = useWalletStore();
  const { secondaryCurrency, showBitcoinSymbol } = useSettingsStore();

  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
  });

  const currencySymbol = useMemo(() => {
    return SUPPORTED_CURRENCIES.find(c => c.code === secondaryCurrency)?.symbol || '$';
  }, [secondaryCurrency]);

  // ── Mint compatibility ───────────────────────────────────────────────────
  const matchedMint = useMemo(() => {
    if (!activeMintUrl) return null;
    const normalize = (u: string) => u.replace(/\/$/, '').toLowerCase();
    const active = normalize(activeMintUrl);

    if (request.mints.some(m => normalize(m) === active)) {
      return activeMintUrl;
    }
    for (const reqMint of request.mints) {
      const found = mints.find(m => normalize(m.mintUrl) === normalize(reqMint));
      if (found) return found.mintUrl;
    }
    return null;
  }, [activeMintUrl, mints, request.mints]);

  const activeMintInfo = useMemo(() => {
    if (!matchedMint) return null;
    return mints.find(m => m.mintUrl.replace(/\/$/, '') === matchedMint.replace(/\/$/, ''));
  }, [matchedMint, mints]);

  const mintDisplayName = useMemo(() => {
    if (!matchedMint) return "No Compatible Mint";
    if (activeMintInfo?.nickname) return activeMintInfo.nickname;
    if (activeMintInfo?.name) return activeMintInfo.name;
    return matchedMint.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }, [activeMintInfo, matchedMint]);

  const isCompatible = !!matchedMint;
  const amountSats = request.amount ?? 0;
  const isEnough = amountSats > 0 && balance >= amountSats;

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
    if (!isCompatible || !isEnough || !request.nostrTarget) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSending(true);
    setLocalError(null);
    setOverlayState('sending');

    try {
      const mnemonic = await seedService.getMnemonic();
      if (!mnemonic) {
        throw new Error('Wallet seed not found. Please restore or create a wallet first.');
      }
      const keys = await seedService.getNostrKeys(mnemonic);
      const senderPrivkeyHex = keys.privkey;

      console.log(`[PaymentRequestStage] Sending ${amountSats} sats for payment request to ${request.nostrTarget}`);
      const { token: tokenString, id: operationId } = await walletService.send(
        matchedMint!,
        amountSats,
      );

      console.log(`[PaymentRequestStage] Publishing token via Nostr to ${request.nostrTarget}`);
      
      const decodedToken = decodeToken(tokenString);
      const proofs = decodedToken.proofs || [];

      const payloadObj = {
        id: request.id,
        mint: matchedMint,
        unit: request.unit || 'sat',
        proofs: proofs,
      };
      const payloadToEncrypt = JSON.stringify(payloadObj);

      const published = await sendNostrToken(payloadToEncrypt, request.nostrTarget, senderPrivkeyHex);

      if (!published) {
        throw new Error('Failed to publish payment to Nostr relays. The recipient may not receive it.');
      }

      console.log(`[PaymentRequestStage] ✅ Payment complete. OpId: ${operationId}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      if (inboxItemId) {
        import('~/store/nostrInboxStore').then(({ useNostrInboxStore }) => {
          useNostrInboxStore.getState().markClaimed(inboxItemId);
        });
      }

      setOverlayState(null);
      onSuccess(amountSats, operationId);
    } catch (err: any) {
      console.error('[PaymentRequestStage] Payment failed:', err);
      const msg = err?.message || 'Payment failed';
      setLocalError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setOverlayState('error');
    } finally {
      setIsSending(false);
    }
  };

  const truncateTarget = (s?: string) => {
    if (!s) return undefined;
    if (s.includes('@')) return s;
    if (s.length > 20) return `${s.slice(0, 10)}...${s.slice(-6)}`;
    return s;
  };

  return (
    <YStack flex={1} bg="$background">
      <ScrollView contentContainerStyle={{ paddingBottom: 150 } as any} showsVerticalScrollIndicator={false}>
        <YStack gap="$4">
          {/* Middle Amount Display */}
          <YStack gap="$3" py="$6" items="center" justify="center">
            <Text fontSize={52} fontFamily="$oswald" fontWeight="700" color="$accent3" lineHeight={54}>
              {showBitcoinSymbol ? `₿${formattedSatsString}` : `${formattedSatsString} SATS`}
            </Text>
            <Text color="$accent5" fontWeight="600" fontSize={16}>
              ≈ {currencySymbol}{fiatValue} {secondaryCurrency}
            </Text>
          </YStack>

          {/* Status Badge */}
          <XStack
            self="center"
            items="center"
            gap="$2"
            bg="$purple9"
            px="$4"
            py="$3"
            rounded="$10"
          >
            <FileText size={16} color="white" />
            <Text
              fontSize="$3"
              fontWeight="700"
              color="white"
            >
              {request.description || "Requested"}
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
                Requires one of: {request.mints.map(m => m.replace(/^https?:\/\//, '')).join(', ')}
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
          <YStack bg="$gray2" rounded="$5" overflow="hidden" mb="$3">
            <View p="$3" px="$4">
              <Text fontSize="$3" fontWeight="700" color="$gray12">Details</Text>
            </View>
            <Separator borderColor="$borderColor" opacity={0.3} />
            <YStack separator={<Separator borderColor="$borderColor" opacity={0.4} />}>
              <DetailItem
                label="Mint"
                value={mintDisplayName}
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
                valueColor={isCompatible ? "$color" : "$red10"}
              />
              <DetailItem
                label="Method"
                value="Payment Request via Nostr"
                icon={<Zap size={16} color="$yellow10" />}
              />
              {request.nostrTarget && (
                <XStack justify="space-between" items="center" py="$3" px="$4">
                  <Text fontSize="$3" color="$gray10" fontWeight="600">Recipient</Text>
                  <XStack gap="$2" items="center">
                    <Blockies seed={request.nostrTarget} size={6} scale={2} style={{ borderRadius: 2 }} />
                    <Text fontSize="$3" fontWeight="800" color="$color" numberOfLines={1} style={{ maxWidth: 180 }}>
                      {truncateTarget(request.nostrTarget)}
                    </Text>
                  </XStack>
                </XStack>
              )}
              <DetailItem
                label="Your Balance"
                value={currencyService.formatSats(balance)}
                valueColor={isEnough ? "$green11" : "$red10"}
                icon={<ShieldCheck size={16} color={isEnough ? "$green11" : "$red10"} />}
              />
            </YStack>
          </YStack>
        </YStack>
      </ScrollView>

      {/* Bottom Fixed Action Buttons (Cancel on Left, Pay on Right) */}
      <YStack position="absolute" b="$4" l="$1" r="$1" bg="$background" gap="$2">
        <XStack gap="$3">
          <Button
            flex={1}
            bg="$gray3"
            color="$color"
            height={50}
            rounded="$4"
            disabled={isSending}
            fontWeight="700"
            fontSize="$5"
            onPress={onCancel}
          >
            Cancel
          </Button>
          <Button
            flex={1}
          theme="accent"
            height={50}
            rounded="$4"
            disabled={!isCompatible || !isEnough || isSending || !request.nostrTarget}
            icon={isSending ? <TamaguiSpinner size="small" color="white" /> : undefined}
            fontWeight="700"
            fontSize="$5"
            onPress={handlePay}
          >
            {isSending ? 'Sending…' : 'Pay'}
          </Button>
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
          if (overlayState === 'success') {
            setOverlayState(null);
            onSuccess(amountSats, '');
          } else {
            setOverlayState(null);
          }
        }}
        onRetry={() => {
          setOverlayState(null);
          setLocalError(null);
        }}
      />

    </YStack>
  );
}

function DetailItem({ label, value, icon, valueColor }: { label: string, value: string, icon?: React.ReactNode, valueColor?: string }) {
  return (
    <XStack justify="space-between" items="center" py="$3" px="$4">
      <Text fontSize="$3" color="$gray10" fontWeight="600">{label}</Text>
      <XStack gap="$2" items="center">
        {icon}
        <Text fontSize="$3" fontWeight="800" color={valueColor || "$color"} numberOfLines={1} style={{ maxWidth: 220 }}>
          {value}
        </Text>
      </XStack>
    </XStack>
  );
}
