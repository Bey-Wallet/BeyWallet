import { interactionCopy } from '~/services/feedback/interactionCopy';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { useRequestNfc, RequestNfcBadge } from './RequestNfcBadge';
import { RequestAmountEditor, RequestDetailsEditor } from './RequestDetailsEditor';
import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentStatusRow } from '~/shared/ui/PaymentStatusRow';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import { PaymentQRFrame } from '~/shared/ui/PaymentQRFrame';
import { useFlowMint } from '~/shared/hooks/useFlowMint';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';

import { AppButton } from '~/shared/ui/AppButton';
import React, { useState, useCallback, useRef, useSyncExternalStore, useMemo } from 'react';
import { YStack, Text } from 'tamagui';
import { Spinner } from '~/shared/ui/Spinner';
import * as Haptics from 'expo-haptics';
import { useFeedbackOwner } from '~/shared/hooks/useFeedbackOwner';

import { DeviceEventEmitter } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppToast } from '~/shared/hooks/useAppToast';
import QRCode from '~/shared/ui/PaymentQRCode';
import { useSettingsStore } from '~/state/settingsStore';
import { useNostrRequestStore, type NostrRequestState } from '~/state/nostrRequestStore';
import { useNostrInboxStore, type NostrInboxItem } from '~/state/nostrInboxStore';
import { matchReceiveRequest } from '~/services/wallet/requestReceiptMatching';
import { PaymentRequest, PaymentRequestTransportType } from '@cashu/cashu-ts';
import { decode as nip19Decode, nprofileEncode } from 'nostr-tools/nip19';
import { ResultStage } from '~/features/payments/send/ResultStage';
import {
  nfcReceiveCoordinator,
  nfcRequestAdvertisement,
} from '~/services/wallet/nfcReceiveCoordinator';

/** Simple unique ID — avoids a uuid dependency */
const makeRequestId = () =>
  `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// ─── Types ───────────────────────────────────────────────────────────────────

type RequestStep = 'result' | 'success';

type RequestDraft = { amount: number; mintUrl: string; note: string };

interface RequestEcashStageProps {
  onClose?: () => void;
  initialRequestId?: string;
  targetNpub?: string;
  targetUsername?: string;
}

// ─── Detail Row ───────────────────────────────────────────────────────────────

// ─── Main Component ───────────────────────────────────────────────────────────

export function RequestEcashStage({
  onClose,
  initialRequestId,
  targetNpub,
  targetUsername,
}: RequestEcashStageProps) {
  const [step, setStep] = useState<RequestStep>('result');
  const [restored, setRestored] = useState(!!initialRequestId);
  const [isRestoring, setIsRestoring] = useState(!!initialRequestId);
  const [amount, setAmount] = useState('0');
  const [note, setNote] = useState('');

  const [creqString, setCreqString] = useState<string | null>(null);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  useFeedbackOwner(currentRequestId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [requestState, setRequestState] = useState<NostrRequestState>('pending');
  const [incomingPayment, setIncomingPayment] = useState<NostrInboxItem>();
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const sessionRequestIds = useRef(new Set<string>());
  const generationLock = useRef(false);
  const failedDraft = useRef<Partial<RequestDraft>>({});
  const toast = useAppToast();
  const router = useRouter();
  const openedNfcReceipt = useRef<string | undefined>(undefined);

  const { mintUrl: activeMintUrl, setMintUrl: setActiveMint } = useFlowMint();
  const { npub } = useSettingsStore();
  const { addRequest, loadPendingRequests } = useNostrRequestStore();

  React.useEffect(() => {
    let disposed = false;
    if (initialRequestId) {
      setIsRestoring(true);
      loadPendingRequests()
        .then(() => {
          if (disposed) return;
          const req = useNostrRequestStore
            .getState()
            .requests.find((r) => r.id === initialRequestId);
          if (req) {
            setAmount(req.amount.toString());
            setCreqString(req.creqString);
            setCurrentRequestId(req.id);
            if (req.mintUrl !== activeMintUrl) {
              setActiveMint(req.mintUrl);
            }
            if (req.description) {
              setNote(req.description);
            }
            setStep(req.state === 'received' ? 'success' : 'result');
          } else setGenerateError('Request unavailable. Start a new request.');
        })
        .catch(() => {
          if (!disposed) setGenerateError('Unable to load this request.');
        })
        .finally(() => {
          if (!disposed) setIsRestoring(false);
        });
    }
    return () => {
      disposed = true;
    };
  }, [initialRequestId]);

  const amtNum = Number(amount);
  const nfcIncoming = useSyncExternalStore(
    nfcReceiveCoordinator.subscribe,
    nfcReceiveCoordinator.getSnapshot,
    nfcReceiveCoordinator.getSnapshot,
  );
  React.useEffect(() => {
    const { status, requestId, receiptId } = nfcIncoming;
    if (
      status !== 'idle' ||
      !receiptId ||
      !requestId ||
      openedNfcReceipt.current === receiptId ||
      (requestId !== currentRequestId && !sessionRequestIds.current.has(requestId))
    )
      return;
    openedNfcReceipt.current = receiptId;
    router.replace({ pathname: '/(modals)/txn-details', params: { id: receiptId } });
  }, [nfcIncoming, currentRequestId, router]);
  const nfcRequest = useMemo(() => {
    const request = useNostrRequestStore
      .getState()
      .requests.find((entry) => entry.id === currentRequestId);
    if (!request || targetNpub) return null;
    try {
      return nfcRequestAdvertisement(request) ?? null;
    } catch {
      return null;
    }
  }, [currentRequestId, creqString, requestState, targetNpub]);

  const handleGenerate = useCallback(
    async (changes: Partial<RequestDraft> = {}) => {
      const draft = { amount: amtNum, mintUrl: activeMintUrl || '', note, ...changes };
      if (
        generationLock.current ||
        isGenerating ||
        !Number.isSafeInteger(draft.amount) ||
        draft.amount <= 0 ||
        !draft.mintUrl ||
        !npub ||
        isSending
      )
        return;
      generationLock.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsGenerating(true);
      setGenerateError(null);
      failedDraft.current = changes;

      let savedRequestId: string | undefined;
      try {
        const reqId = makeRequestId();
        // NUT-18: PaymentRequest(transport, id, amount, unit, mints, description)
        let target = npub;
        if (npub && npub.startsWith('npub1')) {
          try {
            const decoded = nip19Decode(npub);
            if (decoded.type === 'npub') {
              const hexPubkey = decoded.data as string;
              // NUT-18 uses an nprofile with relay hints for its NIP-17 transport.
              target = nprofileEncode({ pubkey: hexPubkey, relays: ['wss://relay.damus.io'] });
            }
          } catch (e) {
            console.warn('[RequestEcashStage] Failed to decode npub', e);
          }
        }

        const transports =
          npub && target
            ? [
                {
                  type: PaymentRequestTransportType.NOSTR,
                  target: target,
                  tags: [['n', '17']],
                },
              ]
            : [];

        const pr = new PaymentRequest(
          transports,
          reqId,
          draft.amount,
          'sat',
          [draft.mintUrl],
          draft.note.trim() || undefined,
        );

        const encoded = pr.toEncodedRequest();

        if (!npub) throw new Error('Wallet identity is unavailable.');
        await addRequest({
          id: reqId,
          mintUrl: draft.mintUrl,
          amount: draft.amount,
          unit: 'sat',
          creqString: encoded,
          nostrPubkey: npub,
          recipient: targetNpub,
          description: draft.note.trim() || undefined,
        });
        sessionRequestIds.current.add(reqId);
        savedRequestId = reqId;
        setCurrentRequestId(reqId);
        setCreqString(encoded);

        setAmount(String(draft.amount));
        setActiveMint(draft.mintUrl);
        setNote(draft.note.trim());
        setRequestState('pending');
        setIncomingPayment(undefined);
        failedDraft.current = {};
        setStep('result');
      } catch (err: any) {
        if (savedRequestId) setStep('result');
        console.error('[RequestEcashStage] PaymentRequest generation failed:', err);
        setGenerateError(err?.message || 'Failed to generate request');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        generationLock.current = false;
        setIsGenerating(false);
      }
    },
    [
      amtNum,
      activeMintUrl,
      note,
      npub,
      addRequest,
      targetNpub,
      targetUsername,
      isGenerating,
      isSending,
      setActiveMint,
      toast,
    ],
  );

  const handleCopy = useCallback(async () => {
    if (!creqString) return;
    if (!(await copyWithFeedback(creqString, toast))) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.showFeedback(interactionCopy.paymentRequestCopiedToClipboard);
  }, [creqString]);

  const isRequestBusy =
    isGenerating ||
    isSending ||
    nfcIncoming.status === 'receiving' ||
    incomingPayment?.status === 'claiming';

  const handleReset = () => {
    if (isRequestBusy) return;
    setRestored(false);
    setIsRestoring(false);
    sessionRequestIds.current.clear();
    setStep('result');
    setAmount('0');
    setNote('');
    setCreqString(null);
    setCurrentRequestId(null);
    setRequestState('pending');
    setIncomingPayment(undefined);
    setGenerateError(null);
    failedDraft.current = {};
  };

  const handleSend = async () => {
    if (!targetNpub || !creqString || isSending || generationLock.current) return;
    setIsSending(true);
    try {
      const { nostrService } =
        require('~/services/wallet/nostrService') as typeof import('~/services/wallet/nostrService');
      await nostrService.sendRequest(targetNpub, creqString, currentRequestId!, amtNum);
      const { usePeopleStore } =
        require('~/state/peopleStore') as typeof import('~/state/peopleStore');
      const recipientLabel = targetUsername?.trim() || '';
      usePeopleStore.getState().savePerson({
        npub: targetNpub,
        username: recipientLabel.toLowerCase().endsWith('@bey.cash')
          ? recipientLabel.replace(/@bey\.cash$/i, '')
          : null,
        displayName: recipientLabel.includes('@') ? null : recipientLabel || null,
        nip05: recipientLabel.includes('@') ? recipientLabel : null,
      });
      toast.showFeedback(interactionCopy.requestSent);
      onClose?.();
    } catch {
      toast.showFeedback(interactionCopy.couldNotSendRequestPleaseTryAgain);
    } finally {
      setIsSending(false);
    }
  };

  React.useEffect(() => {
    if (!currentRequestId) return;
    const check = () => {
      const state = useNostrRequestStore.getState();
      const request =
        state.requests.find((r) => r.state === 'received' && sessionRequestIds.current.has(r.id)) ||
        state.requests.find((r) => r.id === currentRequestId);
      setRequestState(request?.state || 'pending');
      const pending = state.requests.filter((r) => r.state === 'pending');
      const payment = useNostrInboxStore
        .getState()
        .items.filter((item) => {
          if (item.status === 'dismissed') return false;
          const match = matchReceiveRequest(pending, item);
          return (
            !!match && (match.id === currentRequestId || sessionRequestIds.current.has(match.id))
          );
        })
        .sort((a, b) => b.receivedAt - a.receivedAt)[0];
      setIncomingPayment(payment);
      const respondingTo = payment && matchReceiveRequest(pending, payment);
      if (respondingTo && respondingTo.id !== currentRequestId && request?.state !== 'received') {
        setCurrentRequestId(respondingTo.id);
        setAmount(String(respondingTo.amount));
        setActiveMint(respondingTo.mintUrl);
        setNote(respondingTo.description || '');
        setCreqString(respondingTo.creqString);
      }
      const received =
        payment?.status === 'claimed' && payment.receiptVerified ? respondingTo : undefined;
      if (received || request?.state === 'received') {
        const settled = received || request!;
        setAmount(String(settled.amount));
        setActiveMint(settled.mintUrl);
        setStep('success');
      }
    };
    const stopRequests = useNostrRequestStore.subscribe(check);
    const stopInbox = useNostrInboxStore.subscribe(check);
    check();
    return () => {
      stopRequests();
      stopInbox();
    };
  }, [currentRequestId, setActiveMint]);

  const handleCheckStatus = useCallback(async () => {
    setIsChecking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Force nostrService to reconnect and fetch recent events
      const { nostrService } = require('~/services/wallet/nostrService');
      nostrService.refresh();

      if (incomingPayment) {
        const { nostrClaimService } =
          require('~/services/wallet/nostrClaimService') as typeof import('~/services/wallet/nostrClaimService');
        await nostrClaimService.enqueue(incomingPayment.id);
      }

      const { requestLifecycleService } =
        require('~/services/wallet/requestLifecycleService') as typeof import('~/services/wallet/requestLifecycleService');
      await requestLifecycleService.reconcile();
      await loadPendingRequests();
      const request = useNostrRequestStore
        .getState()
        .requests.find((r) => r.id === currentRequestId);
      if (request?.state === 'received') {
        setStep('success');
      } else {
        toast.show(
          request?.state === 'cancelled'
            ? 'Request cancelled'
            : request?.state === 'expired'
              ? 'Request expired'
              : incomingPayment?.status === 'contact_required'
                ? 'Review incoming payment'
                : incomingPayment
                  ? 'Payment needs review'
                  : 'Waiting for payment',
          { kind: 'info' },
        );
      }
    } catch (e) {
      console.warn('[RequestEcashStage] check status error:', e);
      toast.showFeedback(interactionCopy.unableToCheckPaymentPleaseTryAgain);
    } finally {
      setIsChecking(false);
    }
  }, [currentRequestId, incomingPayment, loadPendingRequests, toast]);

  const paymentStatus =
    requestState === 'cancelled'
      ? 'Cancelled'
      : requestState === 'expired'
        ? 'Expired'
        : incomingPayment?.failure?.code === 'wallet_locked'
          ? 'Unlock wallet'
          : incomingPayment?.status === 'contact_required'
            ? 'Approve sender'
            : incomingPayment?.status === 'approval_required'
              ? 'Approve mint'
              : incomingPayment?.status === 'failed'
                ? 'Needs review'
                : incomingPayment?.status === 'claiming'
                  ? 'Receiving…'
                  : incomingPayment
                    ? 'Payment arrived'
                    : 'Awaiting payment';
  const needsReview =
    incomingPayment &&
    ['contact_required', 'approval_required', 'failed'].includes(incomingPayment.status);

  const reviewingCurrentNfcRequest =
    nfcIncoming.status === 'review' && nfcIncoming.requestId === currentRequestId;
  const editDisabled =
    restored ||
    isGenerating ||
    isSending ||
    !!incomingPayment ||
    requestState !== 'pending' ||
    nfcIncoming.status === 'receiving' ||
    reviewingCurrentNfcRequest;
  useRequestNfc(
    step === 'result' && requestState === 'pending' && !isGenerating && !incomingPayment
      ? nfcRequest
      : null,
  );
  const header = (
    <PaymentFlowHeader
      navigationAction="close"
      title={step === 'success' ? 'Payment received' : 'Request ecash'}
      onBack={onClose}
      disabled={isGenerating || isSending}
    />
  );
  if (step === 'success') {
    return (
      <>
        {header}
        <ResultStage
          status="success"
          amount={amtNum.toString()}
          mintUrl={activeMintUrl!}
          title="Payment received"
          onClose={onClose || handleReset}
        />
      </>
    );
  }

  return (
    <>
      {header}
      <PaymentStageLayout
        variant="qr"
        hero={
          <>
            <PaymentQRFrame accessibilityLabel="Payment request QR code">
              {(size) =>
                creqString ? (
                  <QRCode value={creqString} size={size} backgroundColor="white" color="black" />
                ) : (
                  <YStack width={size} height={size} items="center" justify="center" p="$4">
                    {isGenerating || isRestoring ? (
                      <Spinner size="large" />
                    ) : (
                      <Text color="$gray10" textAlign="center">
                        {!npub
                          ? 'Wallet identity is unavailable.'
                          : !activeMintUrl
                            ? 'Select a mint to create a request.'
                            : 'Set an amount to show your request QR.'}
                      </Text>
                    )}
                  </YStack>
                )
              }
            </PaymentQRFrame>
            {creqString && !targetNpub && <RequestNfcBadge />}
          </>
        }
        footer={
          <AppButton
            size="large"
            fullWidth
            disabled={isRequestBusy}
            loading={isRequestBusy}
            loadingText={
              nfcIncoming.status === 'receiving' || incomingPayment?.status === 'claiming'
                ? 'Receiving payment'
                : undefined
            }
            onPress={handleReset}
          >
            New request
          </AppButton>
        }
      >
        {generateError && (
          <Text accessibilityRole="alert" color="$buttonWarningSecondaryText">
            {generateError}
          </Text>
        )}
        <ListTable compact>
          {creqString && (
            <PaymentStatusRow
              status={
                requestState === 'cancelled' || requestState === 'expired' ? 'cancelled' : 'pending'
              }
              value={
                nfcIncoming.status === 'receiving'
                  ? 'Receiving NFC payment…'
                  : reviewingCurrentNfcRequest
                    ? 'Review NFC payment'
                    : paymentStatus
              }
              onRefresh={handleCheckStatus}
              checking={isChecking}
            />
          )}
          <RequestAmountEditor
            amount={amtNum}
            disabled={editDisabled}
            onChange={(value) => {
              if (editDisabled || value === amtNum) return;
              if (activeMintUrl && npub) void handleGenerate({ amount: value });
              else setAmount(String(value));
            }}
          />
          <RequestDetailsEditor
            mintUrl={activeMintUrl || ''}
            note={note}
            disabled={editDisabled}
            onMintChange={(mintUrl) => {
              if (editDisabled || mintUrl === activeMintUrl) return;
              if (amtNum > 0) void handleGenerate({ mintUrl });
              else setActiveMint(mintUrl);
            }}
            onNoteChange={(value) => {
              if (editDisabled || value === note) return;
              if (amtNum > 0) void handleGenerate({ note: value });
              else setNote(value);
            }}
          />
          {targetNpub ? (
            <ListTableRow
              label="Recipient"
              value={targetUsername || `${targetNpub.slice(0, 10)}...${targetNpub.slice(-6)}`}
            />
          ) : null}
          <ListTableRow
            label="Request"
            value={creqString ? `${creqString.slice(0, 14)}…${creqString.slice(-6)}` : '—'}
            isCopyable={!!creqString}
            onCopy={handleCopy}
          />
        </ListTable>
        {needsReview && (
          <AppButton
            emphasis="secondary"
            onPress={() => DeviceEventEmitter.emit('nostr:openClaim', incomingPayment)}
          >
            Review payment
          </AppButton>
        )}
        {nfcIncoming.status === 'review' && (
          <YStack gap="$2">
            <Text accessibilityRole="alert" fontSize={13} color="$gray10">
              {nfcIncoming.message}
            </Text>
            {!reviewingCurrentNfcRequest && (
              <Text fontSize={13} color="$gray10">
                You can create a QR request. NFC is paused until the saved payment is resolved.
              </Text>
            )}
            <AppButton emphasis="secondary" onPress={() => void nfcReceiveCoordinator.retry()}>
              Review NFC payment
            </AppButton>
          </YStack>
        )}
        {!!generateError && !isGenerating && !restored && (
          <AppButton emphasis="secondary" onPress={() => handleGenerate(failedDraft.current)}>
            Retry
          </AppButton>
        )}
        {targetNpub && !!creqString && (
          <AppButton
            emphasis="text-only"
            loading={isSending}
            disabled={isSending || isGenerating}
            onPress={handleSend}
          >
            Send request
          </AppButton>
        )}
      </PaymentStageLayout>
    </>
  );
}
