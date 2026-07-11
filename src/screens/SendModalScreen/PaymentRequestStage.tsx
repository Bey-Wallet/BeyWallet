/**
 * PaymentRequestStage
 *
 * Shown when the user scans a NUT-18 `creqA...` payment request QR code.
 * Displays a review card with the requested amount, memo, and mint, then
 * on confirm:
 *   1. Creates P2PK-locked ecash locked to the requester's Nostr pubkey
 *   2. Publishes the token via Nostr DM to the requester
 *   3. Saves a history entry (type: 'send', metadata.transport: 'nostr')
 *   4. Transitions the parent to the 'success' stage
 */

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
} from 'tamagui';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Zap,
  ShieldCheck,
  FileText,
  Sprout,
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

  const dynamicFontSize = useMemo(() => {
    const len = formattedSatsString.length + 1;
    if (len <= 6) return 44;
    if (len <= 8) return 38;
    if (len <= 10) return 32;
    if (len <= 13) return 26;
    return 20;
  }, [formattedSatsString]);

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
    <YStack flex={1} justify="space-between">
      <YStack gap="$4" width="100%">
        {/* Hero Card Box Container matching ConfirmStage */}
        <YStack
          width="100%"
          bg="$gray2"
          rounded="$5"
          p="$4"
          items="center"
          gap="$3"
          borderWidth={0}
        >
          {/* Amount Display Section */}
          <YStack items="center" justify="center" py="$4" gap="$1" width="100%">
            <Text color="$gray10" fontSize="$3" fontWeight="500">
              Payment Request Amount
            </Text>

            <H1
              fontSize={dynamicFontSize}
              fontVariant={['tabular-nums']}
              fontWeight="700"
              letterSpacing={-1}
              py="$2"
              color="$color"
              text="center"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ maxWidth: '100%', overflow: 'hidden' }}
            >
              {showBitcoinSymbol ? `₿${formattedSatsString}` : `${formattedSatsString} SATS`}
            </H1>

            <Text fontSize="$3" fontWeight="600" color="$accent10">
              ≈ {currencySymbol}{fiatValue} {secondaryCurrency}
            </Text>
          </YStack>
        </YStack>

        {/* Detailed Breakdown Card matching ConfirmStage */}
        <YStack bg="$gray2" rounded="$5" overflow="hidden" separator={<Separator borderColor="$borderColor" opacity={0.4} />}>
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
          {!!request.description && (
            <DetailItem
              label="Memo"
              value={request.description}
            />
          )}
          <DetailItem
            label="Your Balance"
            value={currencyService.formatSats(balance)}
            valueColor={isEnough ? "$green11" : "$red10"}
            icon={<ShieldCheck size={16} color={isEnough ? "$green11" : "$red10"} />}
          />
        </YStack>

        {/* Compatibility Alert */}
        {!isCompatible && (
          <XStack bg="$red3" p="$3" rounded="$4" gap="$2" items="flex-start" width="100%">
            <AlertCircle size={18} color="$red10" style={{ marginTop: 2 }} />
            <YStack flex={1}>
              <Text color="$red10" fontWeight="700">Mint Not Compatible</Text>
              <Text color="$red10" fontSize="$3" mt="$1">
                This request requires one of these mints:
                {'\n'}{request.mints.map(m => m.replace(/^https?:\/\//, '')).join(', ')}
              </Text>
            </YStack>
          </XStack>
        )}

        {/* Local Error */}
        {localError && (
          <XStack bg="$red3" p="$3" rounded="$4" gap="$2" items="center" width="100%">
            <AlertCircle size={18} color="$red10" />
            <Text color="$red10" fontSize="$3" flex={1}>{localError}</Text>
          </XStack>
        )}
      </YStack>

      {/* Action Buttons matching ConfirmStage */}
      <YStack gap="$3" pb="$2">
        <Button
          theme="accent"
          size="$5"
          height={55}
          rounded="$4"
          fontWeight="800"
          disabled={!isCompatible || !isEnough || isSending || !request.nostrTarget}
          onPress={handlePay}
          icon={isSending ? <TamaguiSpinner size="small" color="$color" /> : undefined}
          opacity={(!isCompatible || !isEnough) ? 0.5 : 1}
        >
          {isSending ? 'Sending…' : `Pay ${currencyService.formatSats(amountSats)} via Nostr`}
        </Button>
        <Button
          bg="$gray3"
          color="$color"
          size="$5"
          height={55}
          rounded="$4"
          fontWeight="800"
          disabled={isSending}
          onPress={onCancel}
        >
          Cancel
        </Button>
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
