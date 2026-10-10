import React, { useEffect, useRef, useState, useCallback } from 'react';
import { YStack, Text, Button, Spinner } from 'tamagui';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useWalletStore } from '~/state/walletStore';
import {
  nfcService,
  decodePaymentNdef,
  assertSameNfcPaymentRequest,
  type NfcPaymentSession,
} from '~/services/platform/nfcService';
import { parsePaymentInput } from '~/shared/utils/paymentInputParser';
import {
  parsePaymentRequest,
  type ParsedPaymentRequest,
} from '~/services/wallet/paymentRequestModel';
import { PaymentRequestStage } from '~/features/payments/send/PaymentRequestStage';
import { LightningPayment, type LightningPaymentState } from '~/services/wallet/lightningPayment';
import { walletService } from '~/services/wallet';
import { Flex } from '~/shared/ui/Flex';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type State = 'idle' | 'reading' | 'claiming' | 'paying' | 'success' | 'pending' | 'error';

export default function NFCReceiveScreen() {
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('Hold the phones together to read a payment request.');
  const [request, setRequest] = useState<ParsedPaymentRequest | null>(null);
  const [lightningPreview, setLightningPreview] = useState<Awaited<
    ReturnType<LightningPayment['preview']>
  > | null>(null);
  const [enabled, setEnabled] = useState(false);
  const sessionRef = useRef<NfcPaymentSession | null>(null);
  const lightningRef = useRef<LightningPayment | null>(null);
  const requestRef = useRef<ParsedPaymentRequest | null>(null);
  const busy = useRef(false);
  const active = useRef(false);
  const readRef = useRef<() => Promise<void>>(async () => {});
  const activeMintUrl = useWalletStore((store) => store.activeMintUrl);
  const refreshBalance = useWalletStore((store) => store.refreshBalance);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const close = async () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    await session?.close();
  };

  const refreshWallet = () => {
    queryClient.invalidateQueries({ queryKey: ['history'] });
    queryClient.invalidateQueries({ queryKey: ['balance'] });
    refreshBalance();
  };

  useFocusEffect(
    useCallback(() => {
      active.current = true;
      void (async () => {
        try {
          if (!(await nfcService.init())) throw new Error('NFC is not supported on this device');
          const isEnabled = await nfcService.isEnabled();
          if (!active.current) return;
          setEnabled(isEnabled);
          if (isEnabled) await readRef.current();
        } catch {
          if (active.current) {
            setState('error');
            setMessage('NFC is unavailable. Enable NFC and try again.');
          }
        }
      })();
      return () => {
        active.current = false;
        void close();
        void lightningRef.current?.dispose().catch(() => {});
      };
    }, []),
  );

  const read = async () => {
    if (!active.current || busy.current || requestRef.current || lightningRef.current) return;
    busy.current = true;
    setState('reading');
    try {
      await close();
      if (!active.current) return;
      const session = nfcService.openPaymentSession();
      sessionRef.current = session;
      const tag = await session.read();
      if (!active.current) return;
      const input = parsePaymentInput(decodePaymentNdef(tag));
      if (!input.matched || !input.ok)
        throw new Error(input.matched ? input.reason : 'Unsupported NFC payment');
      const payment = input.value.primary;
      if (payment.type === 'cashu_token') {
        setState('claiming');
        await close();
        await walletService.receive(payment.value);
        if (!active.current) return;
        refreshWallet();
        setMessage('Token received into your wallet.');
        setState('success');
      } else if (payment.type === 'cashu_request') {
        const parsed = parsePaymentRequest(payment.value, 'nfc');
        if (parsed.delivery === 'nip17') await close();
        requestRef.current = parsed;
        setRequest(parsed);
        setState('paying');
      } else if (payment.type === 'lightning_invoice') {
        await close();
        if (!activeMintUrl) throw new Error('Select a funded mint before paying');
        const lightning = new LightningPayment(activeMintUrl, payment.value);
        lightningRef.current = lightning;
        const preview = await lightning.preview();
        if (!active.current) return;
        setLightningPreview(preview);
        setState('paying');
        const result = await lightning.pay();
        if (active.current) showLightningResult(result);
      } else {
        throw new Error('This NFC payment method is not supported');
      }
    } catch (error: any) {
      await close();
      if (active.current) {
        setState('error');
        setMessage(error.message || 'NFC read failed');
      }
    } finally {
      busy.current = false;
    }
  };
  useEffect(() => {
    readRef.current = read;
  });

  const writeExistingPayment = async (token: string) => {
    const expected = requestRef.current;
    if (!expected || !active.current) throw new Error('NFC session closed');
    try {
      if (!sessionRef.current) {
        const session = nfcService.openPaymentSession();
        sessionRef.current = session;
        const tag = await session.read();
        assertSameNfcPaymentRequest(tag, expected.raw);
      }
      await sessionRef.current!.write(token);
      // Retain reader mode while Numo redeems; closing here allows Android to dispatch
      // the still-present HCE tag again. Success, cancellation, and blur close it.
    } catch (error) {
      await close();
      throw error;
    }
  };

  const showLightningResult = (result: LightningPaymentState) => {
    refreshWallet();
    setState(result === 'paid' ? 'success' : 'pending');
    setMessage(
      result === 'paid'
        ? 'Lightning payment confirmed.'
        : result === 'pending'
          ? 'Payment pending. Do not pay again.'
          : 'Receipt unresolved. Do not pay again.',
    );
  };

  const cancel = async () => {
    await close();
    await lightningRef.current?.dispose().catch(() => {});
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  return (
    <Flex fill bg="$background" pb={insets.bottom || 16}>
      <Stack.Screen options={{ title: 'NFC Receive / Tap to Pay', headerTitleAlign: 'center' }} />
      {request ? (
        <PaymentRequestStage
          key={request.raw}
          request={request}
          autoPay
          writeNfc={writeExistingPayment}
          onCancel={cancel}
          onError={(error) => {
            setMessage(error);
            setState('error');
          }}
          onSuccess={() => {
            void close();
            requestRef.current = null;
            setRequest(null);
            refreshWallet();
            setState('success');
            setMessage('Recipient claimed the payment. Check Numo for its settlement record.');
          }}
        />
      ) : (
        <YStack flex={1} px="$4" justify="center" gap="$4">
          {['reading', 'claiming', 'paying'].includes(state) && <Spinner size="large" />}
          <Text fontSize="$6" fontWeight="700">
            {state === 'success'
              ? 'Confirmed'
              : state === 'pending'
                ? 'Awaiting settlement'
                : 'Tap to receive / pay'}
          </Text>
          <Text>
            {state === 'reading'
              ? 'Keep the phones together. A cold launch may require another tap.'
              : message}
          </Text>
          {lightningPreview && (
            <YStack gap="$3">
              <Text>Amount: {lightningPreview.amount} sats</Text>
              <Text>Fee reserve: {lightningPreview.fee_reserve} sats</Text>
              <Text>
                Total reserved: {lightningPreview.amount + lightningPreview.fee_reserve} sats
              </Text>
            </YStack>
          )}
          {state === 'pending' && (
            <Button
              onPress={async () => {
                const result = await lightningRef.current?.refresh();
                if (result) showLightningResult(result);
              }}
            >
              Refresh status
            </Button>
          )}
          {!request && !lightningRef.current && state !== 'success' && (
            <Button
              disabled={state === 'reading' || state === 'claiming'}
              onPress={enabled ? read : () => nfcService.goToNfcSetting()}
            >
              {enabled ? 'Read NFC' : 'Enable NFC'}
            </Button>
          )}
          <Button onPress={cancel} disabled={state === 'paying' || state === 'claiming'}>
            Close
          </Button>
        </YStack>
      )}
    </Flex>
  );
}
