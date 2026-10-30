import { interactionCopy } from '~/services/feedback/interactionCopy';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import { PaymentStatusIcon, paymentReceiptStatus } from '~/shared/ui/PaymentStatusIcon';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import { getHistoryToken, getVerifiedTokenState } from '~/features/history/historyToken';
import {
  historyPaymentLayout,
  isOnchainHistory,
  historyDisplayAmount,
  nfcReceivingFeeNotice,
} from '~/features/history/transactionPresentation';
import { PendingOnchainLayout } from '~/features/history/components/PendingOnchainLayout';
import { OnchainTransactionRows } from './components/OnchainTransactionRows';
import { TransactionNoteRows } from './components/TransactionNoteRows';
import { TransferHistoryReceipt } from './components/TransferHistoryReceipt';
import { checkHistoryStatus } from './checkHistoryStatus';
import { getTransactionNotes } from './transactionNotes';
import { useWalletStore } from '~/state/walletStore';
import { reclaimPayment } from '~/services/wallet/reclaimPayment';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { AppButton } from '~/shared/ui/AppButton';
import { useOfflineStatus } from '~/shared/hooks/useOfflineStatus';
import { networkService } from '~/services/platform/networkService';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { YStack, XStack, Text } from 'tamagui';
import { Trash2 } from '@tamagui/lucide-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { formatPaymentDateTime } from '~/shared/utils/time';
import { onchainNetwork, onchainNetworkDisplay } from '~/shared/utils/onchain';
import {
  historyService,
  initService,
  proofService,
  cleanToken,
  decodeToken,
  walletService,
  quotesService,
} from '~/services/wallet';
import { nip19 } from 'nostr-tools';
import { PendingTokenLayout } from '~/shared/ui/PendingTokenLayout';
import { PendingMintInvoiceLayout } from '~/features/history/components/PendingMintInvoiceLayout';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSettingsBusy } from '~/features/settings/hooks/useSettingsBusy';
import { useFeedbackOwner } from '~/shared/hooks/useFeedbackOwner';
import { useSettingsStore } from '~/state/settingsStore';
import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';
import { currencyService, CurrencyCode } from '~/services/wallet/currencyService';
import { bitcoinService } from '~/services/api/bitcoinService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spinner } from '~/shared/ui/Spinner';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { TransactionReceiptSheet } from './components/TransactionReceiptSheet';
import { ReceiptExtraDetails } from './components/ReceiptExtraDetails';
import {
  buildReceiptDetails,
  needsFullScreenReceipt,
  type ReceiptSnapshot,
} from './receiptDetails';
import {
  readLightningRecipient,
  readLightningReceiptSnapshot,
  removeLightningRecipient,
} from '~/services/wallet/lightningReceiptContext';
import AppBottomSheet, { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

interface HistoryEntry {
  id: string;
  type: 'send' | 'receive' | 'mint' | 'melt';
  amount: number;
  unit: string;
  mintUrl: string;
  state?: string;
  createdAt: number;
  metadata?: any;
  token?: any;
  operationId?: string;
  quoteId?: string;
  paymentRequest?: string;
}

export function TransactionDetailsScreen() {
  return (
    <BottomSheetModalProvider>
      <TransactionDetailsContent />
    </BottomSheetModalProvider>
  );
}

function TransactionDetailsContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id?.toString();
  const { primaryCurrency, secondaryCurrency, npub } = useSettingsStore();
  const deleteSheetRef = useRef<AppBottomSheetRef>(null);

  const handleDeleteTransaction = async () => {
    if (!entry) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      // Delete history entry
      await historyService.deleteHistoryEntries([String(entry.id)]);
      removeLightningRecipient(npub, entry.mintUrl, entry.quoteId);

      // If it has proofs (tokens), delete them too if it's pending/expired
      if (token) {
        try {
          const repo = initService.getRepo();
          const clean = cleanToken(token);
          const decoded = decodeToken(clean);
          const secrets = decoded.proofs.map((p: any) => p.secret);
          if (secrets.length > 0) {
            console.log('[TransactionDetails] Deleting associated proofs from DB:', secrets.length);
            await repo.proofRepository.deleteProofs(entry.mintUrl, secrets);
          }
        } catch (e) {
          console.warn('[TransactionDetails] Failed to delete proofs during delete txn:', e);
        }
      }

      toast.showFeedback(interactionCopy.transactionDetailsErasedFromDevice);
      deleteSheetRef.current?.dismiss();

      // Go back
      router.back();
      queryClient.invalidateQueries({ queryKey: ['history'] });
    } catch (err: any) {
      console.error('[TransactionDetails] Failed to delete transaction:', err);
      toast.showFeedback(interactionCopy.failedToDeleteTransaction);
    }
  };

  const {
    data: entry,
    refetch,
    isRefetching,
    isPending: entryLoading,
  } = useQuery({
    queryKey: ['transaction', id],
    queryFn: async () => {
      if (!id) return null;
      // 1. Try to load from historyRepository by ID (autoincrement ID)
      try {
        const repo = initService.getRepo();
        if (repo?.historyRepository) {
          const dbEntry = await (repo.historyRepository as any).getHistoryEntryById(id);
          if (dbEntry) {
            return dbEntry as HistoryEntry;
          }
        }
      } catch (err) {
        console.warn('[TransactionDetails] Failed to load by ID from historyRepository:', err);
      }

      // 2. If it's a quoteId, try to find by quoteId or matching ID in repository entries
      try {
        const repo = initService.getRepo();
        if (repo?.historyRepository && typeof id === 'string') {
          const history = await (repo.historyRepository as any).getPaginatedHistoryEntries(200, 0);
          const dbEntry = history.find((e: any) => e.id === id || e.quoteId === id);
          if (dbEntry) {
            return dbEntry as HistoryEntry;
          }
        }
      } catch (err) {
        console.warn('[TransactionDetails] Failed to load by quoteId from historyRepository:', err);
      }

      // 3. Fallback to core historyService
      console.log('[TransactionDetails] Falling back to core historyService search for id:', id);
      const history = await historyService.getHistory(200, 0);
      return (history.find((e: any) => e.id === id) as HistoryEntry) || null;
    },
    enabled: !!id,
  });

  // Fetch corresponding mint quote from DB to get the actual expiry
  const onchain = !!entry && isOnchainHistory(entry);
  useFeedbackOwner(
    [entry?.quoteId, entry?.operationId, entry?.id].filter((value): value is string => !!value),
  );
  const { data: mintQuote, refetch: refetchMintQuote } = useQuery({
    queryKey: ['mintQuote', entry?.mintUrl, (entry as any)?.quoteId],
    queryFn: async () => {
      if (!entry || onchain || entry.type !== 'mint' || !(entry as any).quoteId) return null;
      try {
        const repo = initService.getRepo();
        if (repo?.mintQuoteRepository) {
          const quote = await repo.mintQuoteRepository.getMintQuote(
            entry.mintUrl,
            (entry as any).quoteId,
          );
          return quote;
        }
      } catch (err) {
        console.warn('[TransactionDetails] Failed to load mint quote from repository:', err);
      }
      return null;
    },
    enabled: !!entry && !onchain && entry.type === 'mint' && !!(entry as any).quoteId,
  });

  const { data: receiptSnapshot, isPending: receiptSnapshotLoading } = useQuery<ReceiptSnapshot>({
    queryKey: ['receiptSnapshot', entry?.id, entry?.state, entry?.mintUrl, entry?.quoteId, npub],
    enabled: !!entry,
    queryFn: async () => {
      if (!entry) return {};
      const recipient = readLightningRecipient(
        useSettingsStore.getState().npub,
        entry.mintUrl,
        entry.quoteId,
      );
      if (onchain || !entry.quoteId) return { recipient };
      return readLightningReceiptSnapshot(
        npub,
        entry.mintUrl,
        entry.quoteId,
        entry.type === 'mint',
      );
    },
  });

  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
    enabled: secondaryCurrency !== 'NONE',
  });

  const displayedAmount = entry ? historyDisplayAmount(entry) : 0;
  const receivingFeeNotice = entry ? nfcReceivingFeeNotice(entry) : undefined;
  const fiatAmount = useMemo(() => {
    if (secondaryCurrency === 'NONE') return 0;

    if (!btcData?.price || !entry?.amount) return 0;
    return currencyService.convertSatsToCurrency(displayedAmount, btcData.price);
  }, [displayedAmount, btcData?.price, secondaryCurrency]);

  const [token, setToken] = useState('');
  const notes = useMemo(() => (entry ? getTransactionNotes(entry) : []), [entry]);
  useEffect(() => {
    setToken(entry ? getHistoryToken(entry) : '');
  }, [entry]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const isQuoteExpired = useMemo(() => {
    if (!mintQuote?.expiry) return false;
    return timeLeft === 0 || mintQuote.expiry <= Date.now() / 1000;
  }, [mintQuote?.expiry, timeLeft]);

  useEffect(() => {
    if (onchain || !mintQuote?.expiry) {
      setTimeLeft(null);
      return;
    }

    const calculateTimeLeft = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = mintQuote.expiry - now;
      return remaining > 0 ? remaining : 0;
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        // Expiry is display information, not evidence that a payment failed.
        // In particular, a paid invoice can still be awaiting ecash issuance.
        void refetch();
        void refetchMintQuote();
        void queryClient.invalidateQueries({ queryKey: ['history'] });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [mintQuote?.expiry, entry?.id, onchain]);
  const [isReclaiming, setIsReclaiming] = useState(false);
  const [reclaimOutcome, setReclaimOutcome] = useState<'reclaimed' | 'claimed'>();
  useEffect(() => setReclaimOutcome(undefined), [id]);
  const [isClaiming, setIsClaiming] = useState(false);
  const claimLock = useRef(false);
  const reclaimLock = useRef(false);
  const refreshLock = useRef(false);
  const mintQuoteLock = useRef(false);
  const refreshRevision = useRef(0);
  const [isCheckingPaid, setIsCheckingPaid] = useState(false);
  const [latestCheck, setLatestCheck] = useState<{
    id: string;
    state?: string;
    message: string;
  } | null>(null);
  useSettingsBusy(isReclaiming || isClaiming || isCheckingPaid);

  const status = (entry?.state || 'completed').trim().toLowerCase();

  const isPendingMint = useMemo(() => {
    if (!entry) return false;
    const s = (entry.state || '').toUpperCase();
    return entry.type === 'mint' && (s === 'UNPAID' || s === 'PAID');
  }, [entry]);

  const metadata = useMemo(() => {
    if (!entry?.metadata) return {};
    if (typeof entry.metadata === 'string') {
      try {
        return JSON.parse(entry.metadata);
      } catch (e) {
        return {};
      }
    }
    return entry.metadata;
  }, [entry?.metadata]);

  const expiresAt = metadata?.expiresAt ? Number(metadata.expiresAt) : undefined;
  const { data: transferRecord, isPending: transferLoading } = useQuery({
    queryKey: ['mintTransfer', metadata?.transferId],
    enabled: !!metadata?.transferId,
    queryFn: async () => {
      const { getMintTransferService } = await import('~/services/wallet/mintTransferService');
      return getMintTransferService().refresh(metadata.transferId);
    },
  });

  const handleReclaim = async () => {
    if (!entry || !token || reclaimLock.current || claimLock.current) return;
    reclaimLock.current = true;
    refreshRevision.current++;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsReclaiming(true);
    try {
      const result = await reclaimPayment(token.trim(), metadata);
      const repo = initService.getRepo();
      const nextState =
        result === 'claimed' ? 'claimed' : metadata?.reclaimAt ? 'refunded' : 'expired';
      await repo.historyRepository.updateHistoryEntryState(entry.id, nextState);
      setReclaimOutcome(result);
      // The mint operation and local write have finished. Update this screen without another
      // proof-state round-trip, which would mistake our own redemption for a recipient claim.
      await queryClient.cancelQueries({ queryKey: ['transaction', id], exact: true });
      queryClient.setQueryData<HistoryEntry>(['transaction', id], (cached) =>
        cached ? { ...cached, state: nextState } : cached,
      );
      void queryClient.invalidateQueries({ queryKey: ['history'] });
      void useWalletStore.getState().refreshBalance();
      if (result === 'claimed') return;

      // Delete local inflight proofs if any
      try {
        const clean = cleanToken(token);
        const decoded = decodeToken(clean);
        const secrets = decoded.proofs.map((p: any) => p.secret);
        if (secrets.length > 0) {
          await repo.proofRepository.deleteProofs(entry.mintUrl, secrets);
        }
      } catch (e) {
        console.warn('[TransactionDetails] Failed to delete inflight proofs during reclaim:', e);
      }
    } catch (err: any) {
      console.error('[TransactionDetails] Reclaim failed:', err);
      toast.showFeedback(interactionCopy.couldNotConfirmReclaimCheckHistoryBefore);
    } finally {
      refreshRevision.current++;
      reclaimLock.current = false;
      setIsReclaiming(false);
    }
  };

  // Check for saved invoice for pending mints
  const [savedInvoice, setSavedInvoice] = useState<string | null>(null);
  useEffect(() => {
    setSavedInvoice(null);
    if (onchain) return;
    if (entry?.type === 'mint' || entry?.type === 'melt') {
      if (!entry) return;
      try {
        if (receiptSnapshot?.request) {
          setSavedInvoice(receiptSnapshot.request);
          return;
        }
        if ((entry as any).paymentRequest) {
          setSavedInvoice((entry as any).paymentRequest);
          return;
        }
        const cached = sqliteStorage.getItem('mint_invoices');
        if (cached) {
          const invoices = JSON.parse(cached);
          const data = invoices[entry.id];
          if (data && data.expiry > Date.now()) {
            setSavedInvoice(data.pr);
          }
        }
      } catch (e) {
        console.error('[TransactionDetails] Failed to read saved invoice:', e);
      }
    }
  }, [entry, isPendingMint, onchain, receiptSnapshot?.request]);

  const [lockedToNpub, setLockedToNpub] = useState<string | null>(null);
  useEffect(() => {
    setLockedToNpub(null);
    if (!token) return;
    try {
      const secret = decodeToken(cleanToken(token)).proofs[0]?.secret;
      if (typeof secret !== 'string' || !secret.startsWith('["P2PK"')) return;
      const pubkey = JSON.parse(secret)[1]?.data;
      if (pubkey) setLockedToNpub(nip19.npubEncode(pubkey));
    } catch {
      /* Malformed history must not expose raw proof data in diagnostics. */
    }
  }, [token]);

  const title = useMemo(() => {
    const type = entry?.type;
    const meta = entry?.metadata ?? {};
    const via =
      typeof meta === 'string'
        ? (() => {
            try {
              return JSON.parse(meta).via;
            } catch {
              return undefined;
            }
          })()
        : meta?.via;

    if (!type || typeof type !== 'string') return 'Transaction';
    switch (type.toLowerCase()) {
      case 'send':
        if (via === 'nostr') return 'Sent via Nostr';
        if (via === 'ecash_create') return 'Ecash';
        return 'Ecash payment';
      case 'receive':
        if (via === 'nostr') return 'Received via Nostr';
        if (via === 'qr' || via === 'scan') return 'Received via QR';
        if (via === 'nfc') return 'Received via NFC';
        return 'Ecash received';
      case 'mint':
        if (via === 'onchain') return 'Bitcoin received';
        return 'Lightning received';
      case 'melt':
        if (via === 'onchain') return 'Bitcoin payment';
        return 'Lightning payment';
      default:
        return 'Transaction';
    }
  }, [entry?.type, entry?.metadata]);

  const handleRefresh = async () => {
    if (!entry || isRefetching || reclaimLock.current || claimLock.current || refreshLock.current)
      return;
    refreshLock.current = true;
    const revision = refreshRevision.current;
    let sweeping = false;
    try {
      if (onchain) {
        await useWalletStore.getState().autoCheckPendingOnchainQuotes();
        await refetch();
        queryClient.invalidateQueries({ queryKey: ['history'] });
        return;
      }

      if (token && ['pending', 'unclaimed'].includes(status)) {
        try {
          const states = await proofService.checkProofStates(token);
          if (reclaimLock.current || claimLock.current || revision !== refreshRevision.current)
            return;
          const proofCount = decodeToken(cleanToken(token)).proofs.length;
          let newState: string | undefined = getVerifiedTokenState(states, proofCount);
          if (!newState) throw new Error('Token status could not be verified');
          const isSpent = newState === 'claimed';

          // If pending and unspent but expired, trigger auto-sweep/refund
          if (!isSpent && expiresAt && Date.now() > expiresAt && newState !== 'claimed') {
            console.log('[TransactionDetails] Token expired and unspent on refresh. Sweeping...');
            reclaimLock.current = true;
            sweeping = true;
            setIsReclaiming(true);
            await walletService.receive(token.trim());
            newState = 'expired';
            try {
              const clean = cleanToken(token);
              const decoded = decodeToken(clean);
              const secrets = decoded.proofs.map((p: any) => p.secret);
              if (secrets.length > 0) {
                const repo = initService.getRepo();
                await repo.proofRepository.deleteProofs(entry.mintUrl, secrets);
              }
            } catch (e) {}
          }

          if (entry && newState !== entry.state) {
            const repo = initService.getRepo();
            if (repo?.historyRepository) {
              await (repo.historyRepository as any).updateHistoryEntryState(entry.id, newState);
            }
            // Refresh updates the visible receipt; it is not a fresh arrival.
          }
        } catch (err) {
          console.warn('[TransactionDetails] Failed to refresh proof states:', err);
        }
      }

      if (revision !== refreshRevision.current) return;
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['history'] });
    } finally {
      refreshLock.current = false;
      if (sweeping) {
        reclaimLock.current = false;
        setIsReclaiming(false);
      }
    }
  };

  const offline = useOfflineStatus();
  const handleCollectMint = async () => {
    if (
      !entry?.quoteId ||
      offline ||
      claimLock.current ||
      refreshLock.current ||
      mintQuoteLock.current
    )
      return;
    claimLock.current = true;
    mintQuoteLock.current = true;
    setIsCheckingPaid(true);
    try {
      if (await networkService.isOffline()) return;
      await quotesService.redeemMintQuote(entry.mintUrl, entry.quoteId);
      await refetch();
      await refetchMintQuote();
      void queryClient.invalidateQueries({ queryKey: ['history'] });
    } catch {
      toast.showFeedback(interactionCopy.couldNotConfirmReceiptCheckHistoryBefore);
    } finally {
      claimLock.current = false;
      mintQuoteLock.current = false;
      setIsCheckingPaid(false);
    }
  };
  const handleCheckReceipt = async () => {
    if (!entry || offline || refreshLock.current || claimLock.current || reclaimLock.current)
      return;
    refreshLock.current = true;
    setIsCheckingPaid(true);
    try {
      const message = await checkHistoryStatus(entry);
      setLatestCheck({ id: entry.id, state: entry.state, message: `Latest check: ${message}.` });
      await refetch();
      void queryClient.invalidateQueries({ queryKey: ['history'] });
    } catch {
      setLatestCheck({
        id: entry.id,
        state: entry.state,
        message:
          'Could not verify the outcome. Reconnect and check again before retrying this payment.',
      });
    } finally {
      refreshLock.current = false;
      setIsCheckingPaid(false);
    }
  };
  const mintFee =
    metadata?.via !== 'onchain' && Number.isFinite(metadata?.fee) ? Number(metadata.fee) : 0;

  const handleClaimNow = async () => {
    if (!entry || !token || claimLock.current || reclaimLock.current) return;
    claimLock.current = true;
    refreshRevision.current++;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsClaiming(true);
    try {
      if (await networkService.isOffline()) return;
      await walletService.receive(token.trim());
      const repo = initService.getRepo();
      await repo.historyRepository.updateHistoryEntryState(entry.id, 'claimed');
      await queryClient.cancelQueries({ queryKey: ['transaction', id], exact: true });
      queryClient.setQueryData<HistoryEntry>(['transaction', id], (cached) =>
        cached ? { ...cached, state: 'claimed' } : cached,
      );
      void queryClient.invalidateQueries({ queryKey: ['history'] });
      void useWalletStore.getState().refreshBalance();
    } catch (err: any) {
      console.error('[TransactionDetails] Claim failed:', err);
      toast.showFeedback(interactionCopy.couldNotConfirmReceiptCheckHistoryBefore);
    } finally {
      refreshRevision.current++;
      claimLock.current = false;
      setIsClaiming(false);
    }
  };

  // Auto-refresh on mount and poll if pending — first check is immediate, then every 3s
  useEffect(() => {
    if (!entry || !initService.isInitialized() || reclaimLock.current || claimLock.current) return;

    const isPendingSend = entry.type === 'send' && (status === 'pending' || status === 'unclaimed');
    const isPendingMint =
      entry.type === 'mint' &&
      (status.toUpperCase() === 'UNPAID' || status.toUpperCase() === 'PAID');

    const isPendingOnchain = onchain && ['pending', 'unpaid', 'prepared'].includes(status);
    if (!isPendingSend && !isPendingMint && !isPendingOnchain) return;

    const poll = async () => {
      if (claimLock.current || reclaimLock.current || refreshLock.current || mintQuoteLock.current)
        return;
      if (isPendingOnchain || isPendingSend) {
        await handleRefresh();
      } else if (isPendingMint) {
        mintQuoteLock.current = true;
        try {
          const qId = (entry as any).quoteId || '';
          if (qId && entry.mintUrl) {
            await quotesService.redeemMintQuote(entry.mintUrl, qId);
            console.log('[TransactionDetails] Background redeem success for mint quote:', qId);
            queryClient.invalidateQueries({ queryKey: ['history'] });
            refetch();
          }
        } catch (e) {
          // Not paid yet — normal in background polling
        } finally {
          mintQuoteLock.current = false;
        }
      }
    };

    // Fire immediately
    poll();
    const interval = setInterval(poll, 3000);

    return () => clearInterval(interval);
  }, [entry?.id, entry?.state, status, token, onchain, isReclaiming, isClaiming]);
  // Status text formatting
  const formattedStatus = useMemo(() => {
    if (!status || typeof status !== 'string') return 'Unknown';
    try {
      return status
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    } catch (e) {
      return String(status);
    }
  }, [status]);

  const showInvoiceLayout = useMemo(() => {
    return (
      !!entry &&
      !isQuoteExpired &&
      historyPaymentLayout(entry, savedInvoice) === 'lightning-invoice'
    );
  }, [entry, savedInvoice, isQuoteExpired]);

  const headerOptions = {
    title: title || 'Transaction',
    headerTitleAlign: 'center' as const,
    headerRight: () => (
      <HeaderIconButton
        accessibilityLabel="Delete transaction"
        icon={<Trash2 />}
        disabled={isReclaiming || isClaiming || isCheckingPaid}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          deleteSheetRef.current?.present();
        }}
      />
    ),
  };

  const makeHeaderOptions = () => headerOptions;

  const renderDeleteBottomSheet = () => (
    <AppBottomSheet ref={deleteSheetRef} snapPoints={['35%']}>
      <YStack p="$4" gap="$4" flex={1} items="center" justify="center">
        <Trash2 size={40} color="$red10" />
        <YStack items="center" gap="$1">
          <Text fontSize="$6" fontWeight="800" color="$color" textAlign="center">
            Delete Transaction?
          </Text>
          <Text color="$gray10" fontSize="$3" textAlign="center" px="$4">
            This will erase the transaction history and all its details from this device.
          </Text>
        </YStack>

        <XStack gap="$3" width="100%" mt="$2">
          <AppButton
            variant="default"
            emphasis="secondary"
            size="medium"
            flex={1}
            onPress={() => deleteSheetRef.current?.dismiss()}
          >
            Cancel
          </AppButton>
          <AppButton
            variant="critical"
            emphasis="primary"
            size="medium"
            flex={1}
            onPress={handleDeleteTransaction}
          >
            Delete
          </AppButton>
        </XStack>
      </YStack>
    </AppBottomSheet>
  );

  const renderSheet = (content: React.ReactNode, expanded = false) => (
    <TransactionReceiptSheet
      active={!!entry && needsFullScreenReceipt(entry, transferRecord?.state)}
      ready={
        entry
          ? !receiptSnapshotLoading && !(metadata.transferId && transferLoading)
          : entryLoading === false || !id
      }
      expanded={expanded}
      busy={isReclaiming || isClaiming || isCheckingPaid}
    >
      {content}
    </TransactionReceiptSheet>
  );

  if (!entry) {
    return renderSheet(
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
        <PaymentFlowHeader title="Transaction" />
        <YStack flex={1} bg="$background" items="center" justify="center" p="$4">
          {!!id && entryLoading !== false && <Spinner size="large" />}
          <Text mt="$4" color="$gray10">
            {entryLoading === false || !id
              ? 'This transaction is unavailable. Close this receipt to return to History.'
              : 'Loading transaction details…'}
          </Text>
        </YStack>
      </SafeAreaView>,
      false,
    );
  }

  if (metadata.transferId && transferLoading) {
    return renderSheet(
      <YStack gap="$3" py="$3">
        <PaymentFlowHeader title="Transfer" />
        <Spinner size="large" />
        <Text color="$gray10" textAlign="center">
          Loading Transfer details…
        </Text>
      </YStack>,
    );
  }

  if (metadata.transferId && !['completed', 'failed'].includes(transferRecord?.state || '')) {
    return renderSheet(
      <>
        <TransferHistoryReceipt
          extraDetails={
            <ReceiptExtraDetails fields={buildReceiptDetails(entry, receiptSnapshot).extra} />
          }
          id={metadata.transferId}
          amount={entry.amount}
          sourceMintUrl={entry.mintUrl}
          targetMintUrl={metadata.targetMintUrl}
          onClose={() => router.back()}
          headerRight={headerOptions.headerRight}
        />
        {renderDeleteBottomSheet()}
      </>,
      true,
    );
  }

  const isOutgoing = entry.type === 'send' || entry.type === 'melt';
  const receiptStatus = paymentReceiptStatus(
    entry.type === 'mint' && status === 'paid'
      ? 'pending'
      : entry.state || (entry.type === 'receive' ? 'completed' : 'unknown'),
  );
  const paymentLayout = historyPaymentLayout(entry);
  const receiptData = buildReceiptDetails(entry, {
    ...receiptSnapshot,
    request: receiptSnapshot?.request || savedInvoice || undefined,
  });
  const extraDetails = (
    <YStack gap="$2">
      {(notes.length > 0 || receiptData.description) && (
        <ListTable variant="outlined">
          {receiptData.description && (
            <ListTableRow label="Description" value={receiptData.description} multiline />
          )}
          <TransactionNoteRows notes={notes} />
        </ListTable>
      )}
      <ReceiptExtraDetails fields={receiptData.extra} />
    </YStack>
  );
  if (paymentLayout === 'onchain-deposit' || paymentLayout === 'onchain-withdrawal') {
    const mints = useWalletStore.getState().mints;
    const mint = mints.find(
      (item) => item.mintUrl.replace(/\/$/, '') === entry.mintUrl.replace(/\/$/, ''),
    );
    return renderSheet(
      <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
        <PendingOnchainLayout
          direction={paymentLayout === 'onchain-deposit' ? 'deposit' : 'withdrawal'}
          amount={entry.amount}
          address={metadata.address || (entry as any).paymentRequest || ''}
          mint={mint?.nickname || mint?.name || entry.mintUrl.replace(/^https?:\/\//, '')}
          onRefresh={handleRefresh}
          checking={isRefetching}
          offline={offline}
          onClose={() => router.back()}
          headerRight={headerOptions.headerRight}
          extraDetails={extraDetails}
          transactionDetails={
            <OnchainTransactionRows
              direction={paymentLayout === 'onchain-deposit' ? 'deposit' : 'withdrawal'}
              address={metadata.address || (entry as any).paymentRequest || ''}
              mintUrl={entry.mintUrl}
              quoteId={(entry as any).quoteId}
              pending
            />
          }
        />
        {renderDeleteBottomSheet()}
      </SafeAreaView>,
      true,
    );
  }

  if (showInvoiceLayout && savedInvoice) {
    return renderSheet(
      <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
        <Stack.Screen options={makeHeaderOptions()} />
        <PendingMintInvoiceLayout
          savedInvoice={savedInvoice}
          timeLeft={timeLeft}
          entry={entry as any}
          formattedStatus={formattedStatus}
          primaryCurrency={primaryCurrency}
          secondaryCurrency={secondaryCurrency}
          fiatAmount={fiatAmount}
          isCheckingPaid={isCheckingPaid}
          offline={offline}
          extraDetails={extraDetails}
          onCancel={async () => {
            try {
              const repo = initService.getRepo();
              if (repo?.historyRepository) {
                await (repo.historyRepository as any).updateHistoryMintEntry(
                  entry.mintUrl,
                  (entry as any).quoteId,
                  'failed',
                );
                toast.showFeedback(interactionCopy.depositRemovedFromPending);
                await handleRefresh();
              }
            } catch (e) {
              console.warn('[TransactionDetails] Failed to cancel quote:', e);
            }
          }}
          onPaid={handleCollectMint}
        />
        {renderDeleteBottomSheet()}
      </SafeAreaView>,
      true,
    );
  }

  if (token && typeof token === 'string' && (status === 'pending' || status === 'unclaimed')) {
    return renderSheet(
      <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
        <Stack.Screen options={makeHeaderOptions()} />
        <PendingTokenLayout
          token={token}
          operationId={entry.type === 'send' ? entry.operationId : undefined}
          amount={entry.amount}
          fee={mintFee}
          mintUrl={entry.mintUrl}
          lockedToNpub={lockedToNpub}
          onClaim={entry.type === 'receive' ? handleClaimNow : undefined}
          isClaiming={isClaiming}
          offline={offline}
          onReclaim={entry.type === 'send' ? handleReclaim : undefined}
          isReclaiming={isReclaiming}
          expiresAt={expiresAt}
          reclaimAt={metadata?.reclaimAt ? Number(metadata.reclaimAt) : undefined}
          onCheckStatus={handleRefresh}
          isCheckingStatus={isRefetching}
          customHeaderRight={headerOptions.headerRight}
          extraDetails={extraDetails}
        />
        {renderDeleteBottomSheet()}
      </SafeAreaView>,
      true,
    );
  }

  const detail = transferRecord
    ? buildReceiptDetails({ ...entry, state: transferRecord.state }, receiptSnapshot)
    : receiptData;
  const mint = useWalletStore
    .getState()
    .mints?.find((item) => item.mintUrl.replace(/\/$/, '') === entry.mintUrl.replace(/\/$/, ''));
  const fee = transferRecord ? transferRecord.feePaid : onchain ? metadata.actualFee : metadata.fee;
  return renderSheet(
    <YStack gap="$4" pb="$3">
      <PaymentFlowHeader
        title={detail.method === 'Transfer' ? 'Transfer' : title || 'Transaction'}
        headerRight={headerOptions.headerRight}
      />
      <YStack items="center" gap="$3" py="$4">
        <PaymentStatusIcon
          status={
            transferRecord
              ? transferRecord.state === 'completed'
                ? 'success'
                : 'error'
              : reclaimOutcome === 'reclaimed'
                ? 'success'
                : receiptStatus
          }
        />
        <PaymentAmount amount={displayedAmount} size="prominent" compact />
      </YStack>
      {receivingFeeNotice && (
        <Text color="$gray10" fontSize={12} accessibilityRole="alert">
          {receivingFeeNotice}
        </Text>
      )}
      {receiptStatus === 'pending' &&
        latestCheck?.id === entry.id &&
        latestCheck.state === entry.state && (
          <Text fontFamily="$body" fontSize={12} color="$gray10" accessibilityLiveRegion="polite">
            {latestCheck.message}
          </Text>
        )}
      <ListTable variant="outlined">
        <ListTableRow
          label="Status"
          value={reclaimOutcome === 'reclaimed' ? 'Reclaimed' : detail.status}
        />
        <ListTableRow label="Date" value={formatPaymentDateTime(entry.createdAt)} />
        {Number.isFinite(fee) && fee >= 0 && (
          <ListTableRow label="Fee" value={currencyService.formatSats(fee)} />
        )}
        <ListTableRow
          label={metadata.transferId ? 'From mint' : 'Mint'}
          value={
            mint?.nickname ||
            mint?.name ||
            entry.mintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
          }
        />
        {metadata.targetMintUrl && (
          <ListTableRow
            label="To mint"
            value={
              useWalletStore
                .getState()
                .mints?.find((item) => item.mintUrl === metadata.targetMintUrl)?.nickname ||
              useWalletStore
                .getState()
                .mints?.find((item) => item.mintUrl === metadata.targetMintUrl)?.name ||
              metadata.targetMintUrl.replace(/^https?:\/\//, '')
            }
          />
        )}
        {detail.recipient && (
          <ListTableRow
            label={isOutgoing ? 'Recipient' : 'Sender'}
            value={detail.recipient}
            isCopyable
            copyValue={detail.recipient}
          />
        )}
        {detail.description && (
          <ListTableRow label="Description" value={detail.description} multiline />
        )}
        {notes
          .filter((note) => note.value !== detail.description)
          .map((note, index) => (
            <ListTableRow key={index} label={note.label} value={note.value} multiline />
          ))}
        {detail.address && (
          <ListTableRow
            label="Network"
            value={onchainNetworkDisplay(onchainNetwork(detail.address))}
          />
        )}
        {detail.address && (
          <ListTableRow
            label="Address"
            value={detail.address}
            isCopyable
            copyValue={detail.address}
            multiline
          />
        )}
        {onchain && (
          <OnchainTransactionRows
            direction={entry.type === 'melt' ? 'withdrawal' : 'deposit'}
            address={detail.address || ''}
            mintUrl={entry.mintUrl}
            quoteId={entry.quoteId}
          />
        )}
        {lockedToNpub && (
          <ListTableRow
            label="Locked to"
            value={lockedToNpub === useSettingsStore.getState().npub ? 'You' : lockedToNpub}
            multiline
            isCopyable
            copyValue={lockedToNpub}
          />
        )}
        {metadata.reclaimAt && (
          <ListTableRow
            label="Reclaim eligible"
            value={formatPaymentDateTime(Number(metadata.reclaimAt))}
          />
        )}
      </ListTable>
      <ReceiptExtraDetails fields={detail.extra} />
      {token && ['send', 'receive'].includes(entry.type) && receiptStatus === 'success' && (
        <AppButton
          emphasis="secondary"
          onPress={async () => {
            if (await copyWithFeedback(token, toast))
              toast.showFeedback(interactionCopy.ecashCopied);
          }}
        >
          Copy original token
        </AppButton>
      )}
      {receiptStatus === 'pending' && (
        <AppButton
          emphasis="secondary"
          loading={isCheckingPaid || isRefetching}
          disabled={offline || isCheckingPaid || isRefetching}
          onPress={
            entry.type === 'mint' && status === 'paid' && entry.quoteId
              ? handleCollectMint
              : handleCheckReceipt
          }
        >
          {entry.type === 'mint' && status === 'paid' && entry.quoteId
            ? 'Collect ecash'
            : 'Check status'}
        </AppButton>
      )}
      {renderDeleteBottomSheet()}
    </YStack>,
  );
}
