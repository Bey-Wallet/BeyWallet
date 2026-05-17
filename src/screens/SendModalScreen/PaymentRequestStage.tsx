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
} from 'tamagui';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Zap,
  ShieldCheck,
  FileText,
  ArrowRight,
} from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { ScrollView } from 'react-native';
import { useWalletStore } from '~/store/walletStore';
import { useSettingsStore } from '~/store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/bitcoinService';
import { currencyService, SUPPORTED_CURRENCIES } from '~/services/currencyService';
import { walletService } from '~/services/core';
import { sendNostrToken } from '~/services/core/nostrService';
import {
  PaymentStatusOverlay,
  type PaymentStatusState,
} from '~/components/PaymentStatusOverlay';
import { seedService } from '~/services/seedService';

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
  onSuccess: (amount: number, operationId: string) => void;
  onError: (msg: string) => void;
  onCancel: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PaymentRequestStage({
  request,
  onSuccess,
  onError,
  onCancel,
}: PaymentRequestStageProps) {
  const [isSending, setIsSending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [overlayState, setOverlayState] = useState<PaymentStatusState | null>(null);

  const { balance, activeMintUrl, mints } = useWalletStore();
  const { secondaryCurrency, nsec } = useSettingsStore();

  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
  });

  // ── Mint compatibility ───────────────────────────────────────────────────
  const matchedMint = useMemo(() => {
    if (!activeMintUrl) return null;
    const normalize = (u: string) => u.replace(/\/$/, '').toLowerCase();
    const active = normalize(activeMintUrl);

    // Check if active mint is acceptable
    if (request.mints.some(m => normalize(m) === active)) {
      return activeMintUrl;
    }
    // Fallback: check all added mints
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

  const isCompatible = !!matchedMint;
  const amountSats = request.amount ?? 0;
  const isEnough = amountSats > 0 && balance >= amountSats;
  const fiatValue = useMemo(() => {
    if (!btcData?.price || !amountSats) return '—';
    const cur = SUPPORTED_CURRENCIES.find(c => c.code === secondaryCurrency);
    const symbol = cur?.symbol ?? '$';
    const val = currencyService.convertSatsToCurrency(amountSats, btcData.price);
    return `${symbol}${val.toFixed(2)}`;
  }, [btcData?.price, amountSats, secondaryCurrency]);

  // ── Send handler ─────────────────────────────────────────────────────────
  const handlePay = async () => {
    if (!isCompatible || !isEnough || !request.nostrTarget) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSending(true);
    setLocalError(null);
    setOverlayState('sending');

    try {
      // 1. Get sender's Nostr private key from seed
      const mnemonic = await seedService.getMnemonic();
      if (!mnemonic) {
        throw new Error('Wallet seed not found. Please restore or create a wallet first.');
      }
      const keys = await seedService.getNostrKeys(mnemonic);
      const senderPrivkeyHex = keys.privkey;

      // 2. Create P2PK-locked token for the requester
      console.log(`[PaymentRequestStage] Sending ${amountSats} sats P2PK to ${request.nostrTarget}`);
      const { encoded, token, id: operationId } = await walletService.sendP2PK(
        matchedMint!,
        amountSats,
        request.nostrTarget, // npub or hex — sendP2PK handles conversion
      );

      // 3. Publish the token to the recipient via Nostr DM
      console.log(`[PaymentRequestStage] Publishing token via Nostr to ${request.nostrTarget}`);
      
      let payloadToEncrypt = encoded;
      if (request.id) {
          const payloadObj = {
              id: request.id,
              mint: matchedMint,
              proofs: token.proofs
          };
          payloadToEncrypt = JSON.stringify(payloadObj);
      }

      const published = await sendNostrToken(payloadToEncrypt, request.nostrTarget, senderPrivkeyHex);

      if (!published) {
        throw new Error('Failed to publish payment to Nostr relays. The recipient may not receive it.');
      }

      console.log(`[PaymentRequestStage] ✅ Payment complete. OpId: ${operationId}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    <>
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        <YStack flex={1} gap="$4" pb="$8">
          {/* ── Header ──────────────────────────────────────────────────── */}
          <YStack items="center" gap="$2" py="$4">
            <View
              width={64}
              height={64}
              rounded="$8"
              bg={isCompatible ? '$orange2' : '$red2'}
              items="center"
              justify="center"
            >
              <Zap size={32} color={isCompatible ? '$orange10' : '$red10'} />
            </View>
            <Text fontSize="$7" fontWeight="900" letterSpacing={-0.5}>
              Payment Request
            </Text>
            <Text fontSize="$3" color="$gray10">
              Review and confirm the payment below
            </Text>
          </YStack>

          {/* ── Details Card ────────────────────────────────────────────── */}
          <YStack rounded="$5" bg="$gray2" overflow="hidden" mx="$0">
            {/* Amount */}
            <XStack justify="space-between" items="center" px="$4" py="$3">
              <Text color="$gray10" fontWeight="600">Amount</Text>
              <YStack items="flex-end">
                <Text fontWeight="900" fontSize="$7" color="$orange10">
                  ₿{amountSats.toLocaleString()}
                </Text>
                <Text fontSize="$3" color="$gray10">{fiatValue}</Text>
              </YStack>
            </XStack>

            <Separator borderColor="$borderColor" opacity={0.5} />

            {/* Mint */}
            <XStack justify="space-between" items="center" px="$4" py="$3">
              <XStack gap="$2" items="center">
                <Building2 size={16} color="$gray10" />
                <Text color="$gray10" fontWeight="600">Mint</Text>
              </XStack>
              {isCompatible ? (
                <XStack gap="$2" items="center">
                  {activeMintInfo?.icon && (
                    <Avatar rounded="$3" size="$1.5">
                      <Avatar.Image src={activeMintInfo.icon} />
                      <Avatar.Fallback bg="$gray5" />
                    </Avatar>
                  )}
                  <Text fontWeight="700" numberOfLines={1} style={{ maxWidth: 160 }}>
                    {activeMintInfo?.nickname || activeMintInfo?.name ||
                      matchedMint!.replace(/^https?:\/\//, '').substring(0, 20)}
                  </Text>
                  <CheckCircle2 size={16} color="$green10" />
                </XStack>
              ) : (
                <XStack gap="$1" items="center">
                  <AlertCircle size={16} color="$red10" />
                  <Text color="$red10" fontWeight="600">No compatible mint</Text>
                </XStack>
              )}
            </XStack>

            <Separator borderColor="$borderColor" opacity={0.5} />

            {/* Transport */}
            <XStack justify="space-between" items="center" px="$4" py="$3">
              <XStack gap="$2" items="center">
                <Zap size={16} color="$gray10" />
                <Text color="$gray10" fontWeight="600">Via</Text>
              </XStack>
              <XStack bg="$orange2" px="$2" py="$1" rounded="$2" gap="$1" items="center">
                <Zap size={12} color="$orange10" />
                <Text color="$orange10" fontSize="$2" fontWeight="800">NOSTR</Text>
              </XStack>
            </XStack>

            {/* Description */}
            {!!request.description && (
              <>
                <Separator borderColor="$borderColor" opacity={0.5} />
                <XStack justify="space-between" items="flex-start" px="$4" py="$3" gap="$2">
                  <XStack gap="$2" items="center">
                    <FileText size={16} color="$gray10" />
                    <Text color="$gray10" fontWeight="600">Memo</Text>
                  </XStack>
                  <Text fontWeight="600" style={{ maxWidth: 180, textAlign: 'right' }}>
                    {request.description}
                  </Text>
                </XStack>
              </>
            )}

            {/* Balance check */}
            <Separator borderColor="$borderColor" opacity={0.5} />
            <XStack justify="space-between" items="center" px="$4" py="$3">
              <XStack gap="$2" items="center">
                <ShieldCheck size={16} color="$gray10" />
                <Text color="$gray10" fontWeight="600">Your Balance</Text>
              </XStack>
              <Text
                fontWeight="700"
                color={isEnough ? '$green10' : '$red10'}
              >
                ₿{balance.toLocaleString()} sats
                {!isEnough && amountSats > 0 && (
                  <Text fontSize="$2" color="$red10"> (insufficient)</Text>
                )}
              </Text>
            </XStack>
          </YStack>

          {/* ── Compatibility Warning ───────────────────────────────────── */}
          {!isCompatible && (
            <XStack bg="$red2" p="$3" rounded="$4" gap="$2" items="flex-start">
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

          {/* ── Local Error ─────────────────────────────────────────────── */}
          {localError && (
            <XStack bg="$red2" p="$3" rounded="$4" gap="$2" items="center">
              <AlertCircle size={18} color="$red10" />
              <Text color="$red10" fontSize="$3" flex={1}>{localError}</Text>
            </XStack>
          )}

          {/* ── Actions ─────────────────────────────────────────────────── */}
          <YStack gap="$3" pt="$2">
            <Button
              theme="accent"
              size="$5"
              fontWeight="800"
              disabled={!isCompatible || !isEnough || isSending || !request.nostrTarget}
              onPress={handlePay}
              icon={isSending ? <TamaguiSpinner size="small" /> : <ArrowRight size={20} />}
              opacity={(!isCompatible || !isEnough) ? 0.5 : 1}
            >
              {isSending ? 'Sending…' : `Pay ₿${amountSats.toLocaleString()} via Nostr`}
            </Button>
            <Button
              chromeless
              size="$4"
              onPress={onCancel}
              disabled={isSending}
            >
              Cancel
            </Button>
          </YStack>
        </YStack>
      </ScrollView>

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
    </>
  );
}
