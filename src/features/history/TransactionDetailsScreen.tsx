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
import { TransactionNoteRows } from './components/TransactionNoteRows';
import { getTransactionNotes } from './transactionNotes';
import { useWalletStore } from '~/state/walletStore';
import { reclaimPayment } from '~/services/wallet/reclaimPayment';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { AppButton } from '~/shared/ui/AppButton';
import { useOfflineStatus } from '~/shared/hooks/useOfflineStatus';
import { networkService } from '~/services/platform/networkService';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { YStack, XStack, Text, ScrollView, Separator, YGroup } from 'tamagui';
import { ArrowDownLeft, AlertCircle, Trash2 } from '@tamagui/lucide-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { UR, UREncoder } from '@gandlaf21/bc-ur';
import { Buffer } from 'buffer';
import { formatPaymentDateTime } from '~/shared/utils/time';
import {
  historyService,
  initService,
  proofService,
  cleanToken,
  decodeToken,
  encodeToken,
  encodePeanut,
  encodeTokenV4,
  encodeTokenV3,
  walletService,
  quotesService,
} from '~/services/wallet';
import { nip19 } from 'nostr-tools';
import { PendingTokenLayout } from '~/shared/ui/PendingTokenLayout';
import { PendingMintInvoiceLayout } from '~/features/history/components/PendingMintInvoiceLayout';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSettingsStore } from '~/state/settingsStore';
import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';
import { currencyService, CurrencyCode } from '~/services/wallet/currencyService';
import { bitcoinService } from '~/services/api/bitcoinService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spinner } from '~/shared/ui/Spinner';
import { useToastController } from '@tamagui/toast';
import { notificationService } from '~/services/platform/notificationService';
import { BadgeStatus } from '~/shared/ui/StatusBadge';
import AppBottomSheet, { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';

// Ensure Buffer is available globally
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

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
}

export function TransactionDetailsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToastController();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id?.toString();
  const { primaryCurrency, secondaryCurrency } = useSettingsStore();
  const deleteSheetRef = useRef<AppBottomSheetRef>(null);

  const handleDeleteTransaction = async () => {
    if (!entry) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      // Delete history entry
      await historyService.deleteHistoryEntries([String(entry.id)]);

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

      toast.show('Transaction details erased from device', { kind: 'success' });
      deleteSheetRef.current?.dismiss();

      // Go back
      router.back();
      queryClient.invalidateQueries({ queryKey: ['history'] });
    } catch (err: any) {
      console.error('[TransactionDetails] Failed to delete transaction:', err);
      toast.show('Failed to delete transaction', { kind: 'error' });
    }
  };

  const {
    data: entry,
    refetch,
    isRefetching,
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

  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
  });

  const displayedAmount = entry ? historyDisplayAmount(entry) : 0;
  const receivingFeeNotice = entry ? nfcReceivingFeeNotice(entry) : undefined;
  const fiatAmount = useMemo(() => {
    if (!btcData?.price || !entry?.amount) return 0;
    return currencyService.convertSatsToCurrency(displayedAmount, btcData.price);
  }, [displayedAmount, btcData?.price]);

  const formattedAmountTitle = useMemo(() => {
    if (!entry) return '';
    const amt = displayedAmount;
    if (primaryCurrency === 'SATS') {
      return currencyService.formatSats(Number(amt));
    } else {
      return currencyService.formatValue(fiatAmount, secondaryCurrency as CurrencyCode);
    }
  }, [entry, displayedAmount, primaryCurrency, fiatAmount, secondaryCurrency]);

  const [token, setToken] = useState('');
  const notes = useMemo(() => (entry ? getTransactionNotes(entry) : []), [entry]);
  useEffect(() => {
    setToken(entry ? getHistoryToken(entry) : '');
  }, [entry]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const isQuoteExpired = useMemo(() => {
    if (!mintQuote?.expiry) return false;
    return mintQuote.expiry < Date.now() / 1000;
  }, [mintQuote?.expiry]);

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
        // Mark in DB as failed if it is still UNPAID/pending in history
        const repo = initService.getRepo();
        if (
          repo?.historyRepository &&
          entry &&
          (entry.state === 'UNPAID' || entry.state === 'PAID')
        ) {
          (repo.historyRepository as any)
            .updateHistoryMintEntry(entry.mintUrl, (entry as any).quoteId, 'failed')
            .then(() => {
              console.log('[TransactionDetails] Marked expired quote as failed in database');
              refetch();
              refetchMintQuote();
              queryClient.invalidateQueries({ queryKey: ['history'] });
            })
            .catch((e) =>
              console.warn('[TransactionDetails] Failed to update expired quote in DB:', e),
            );
        } else {
          refetch();
          refetchMintQuote();
          queryClient.invalidateQueries({ queryKey: ['history'] });
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [mintQuote?.expiry, entry?.id, onchain]);
  const [isStatusExpanded, setIsStatusExpanded] = useState(false);
  const [isReclaiming, setIsReclaiming] = useState(false);
  const [isCheckingPaid, setIsCheckingPaid] = useState(false);

  const status = (entry?.state || 'completed').trim().toLowerCase();

  const isPendingMint = useMemo(() => {
    if (!entry) return false;
    const s = (entry.state || '').toUpperCase();
    return entry.type === 'mint' && (s === 'UNPAID' || s === 'PAID');
  }, [entry]);

  const isPendingSend = useMemo(() => {
    if (!entry) return false;
    const s = (entry.state || '').toUpperCase();
    return entry.type === 'send' && (s === 'PENDING' || s === 'UNCLAIMED');
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

  const handleReclaim = async () => {
    if (!entry || !token || isReclaiming) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsReclaiming(true);
    try {
      const result = await reclaimPayment(token.trim(), metadata);
      if (result === 'claimed') {
        await initService.getRepo().historyRepository.updateHistoryEntryState(entry.id, 'claimed');
        await handleRefresh();
        return;
      }
      toast.show('Funds reclaimed to your wallet', { kind: 'success' });

      // Update state in DB
      const repo = initService.getRepo();
      if (repo?.historyRepository) {
        await (repo.historyRepository as any).updateHistoryEntryState(
          entry.id,
          metadata?.reclaimAt ? 'refunded' : 'expired',
        );
      }

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

      // Refresh UI
      setTimeout(() => {
        handleRefresh();
      }, 500);
    } catch (err: any) {
      console.error('[TransactionDetails] Reclaim failed:', err);
      toast.show('Reclaim Failed: ' + err.message, { kind: 'error' });
    } finally {
      setIsReclaiming(false);
    }
  };

  // Check for saved invoice for pending mints
  const [savedInvoice, setSavedInvoice] = useState<string | null>(null);
  useEffect(() => {
    setSavedInvoice(null);
    if (onchain) return;
    if (isPendingMint) {
      if (!entry) return;
      try {
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
  }, [entry, isPendingMint, onchain]);

  // Animated QR states
  const [qrCodeFragment, setQrCodeFragment] = useState<string>('');
  // UR animated QR is opt-in — standard wallets (Minibits, cashu.me, Sovan) expect plain cashu: QR
  const [showAnimatedQR, setShowAnimatedQR] = useState(false);
  const [fragmentLength, setFragmentLength] = useState(150); // L=150, M=100, S=50
  const [intervalMs, setIntervalMs] = useState(140); // F=140, M=250, S=500
  const [tokenVersion, setTokenVersion] = useState<'V3' | 'V4'>('V4');
  const encoderRef = useRef<UREncoder | null>(null);

  // Initialize/Update token version when token changes
  useEffect(() => {
    if (token && typeof token === 'string') {
      setTokenVersion(token.startsWith('cashuB') ? 'V4' : 'V3');
    }
  }, [token]);

  const [lockedToNpub, setLockedToNpub] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    try {
      const clean = cleanToken(token);
      if (!clean || typeof clean !== 'string') {
        setShowAnimatedQR(false);
        setQrCodeFragment(typeof token === 'string' ? `cashu:${token}` : '');
        setLockedToNpub(null);
        return;
      }

      const decoded = decodeToken(clean);
      const proofs = decoded.proofs || [];

      // Check for P2PK pubkey in the first proof secret
      try {
        if (proofs.length > 0) {
          const firstSecret = proofs[0]?.secret;
          if (typeof firstSecret === 'string') {
            if (firstSecret.startsWith('["P2PK"')) {
              const parsed = JSON.parse(firstSecret);
              const hexPubkey = parsed[1]?.data;
              if (hexPubkey) {
                setLockedToNpub(nip19.npubEncode(hexPubkey));
              } else {
                setLockedToNpub(null);
              }
            } else {
              setLockedToNpub(null);
            }
          } else {
            setLockedToNpub(null);
          }
        }
      } catch (e) {
        console.warn('[TransactionDetails] Failed to parse P2PK secret:', e);
        setLockedToNpub(null);
      }

      if (showAnimatedQR) {
        // Only build UR encoder when animated mode is explicitly ON
        const { encode: cborEncode } = require('cbor-x');
        const cborBuffer = cborEncode(clean);
        const ur = new UR(Buffer.from(cborBuffer), 'cashu');
        encoderRef.current = new UREncoder(ur, fragmentLength, 0);
        setQrCodeFragment(encoderRef.current.nextPart());
      } else {
        // Static plain cashu: QR — compatible with Minibits, cashu.me, Sovan
        setQrCodeFragment(clean.startsWith('cashu:') ? clean : `cashu:${clean}`);
      }
    } catch (e) {
      console.error('[TransactionDetails] Failed to setup QR:', e);
      setShowAnimatedQR(false);
      setQrCodeFragment(typeof token === 'string' ? `cashu:${token}` : '');
    }
  }, [token, fragmentLength, showAnimatedQR]);

  useEffect(() => {
    if (!showAnimatedQR || !encoderRef.current) return;

    const interval = setInterval(() => {
      setQrCodeFragment(encoderRef.current!.nextPart());
    }, intervalMs);

    return () => clearInterval(interval);
  }, [showAnimatedQR, intervalMs]);

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
        if (via === 'ecash_create') return 'Created Ecash Token';
        return 'Sent Ecash';
      case 'receive':
        if (via === 'nostr') return 'Received via Nostr';
        if (via === 'qr' || via === 'scan') return 'Received via QR';
        if (via === 'nfc') return 'Received via NFC';
        return 'Received Ecash';
      case 'mint':
        if (via === 'onchain') return 'On-chain → Ecash';
        return 'Lightning → Ecash';
      case 'melt':
        if (via === 'onchain') return 'Ecash → On-chain';
        return 'Ecash → Lightning';
      default:
        return 'Transaction';
    }
  }, [entry?.type, entry?.metadata]);

  const handleCopyToken = async () => {
    if (token) {
      await Clipboard.setStringAsync(token);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show('Token copied to clipboard', { kind: 'success' });
    }
  };

  const handleCopyEmoji = async () => {
    if (token) {
      const peanut = encodePeanut(cleanToken(token));
      await Clipboard.setStringAsync(peanut);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toast.show('Peanut token copied to clipboard', { kind: 'success' });
    }
  };

  const handleToggleVersion = () => {
    if (!token) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const decoded = decodeToken(token);
      if (tokenVersion === 'V3') {
        const encodedV4 = encodeTokenV4(decoded);
        setToken(encodedV4);
        setTokenVersion('V4');
        toast.show('Switched to V4 (compact CBOR)', { kind: 'info' });
      } else {
        const encodedV3 = encodeTokenV3(decoded);
        setToken(encodedV3);
        setTokenVersion('V3');
        toast.show('Switched to V3 (standard JSON)', { kind: 'info' });
      }
    } catch (e) {
      console.error('[TransactionDetails] Failed to toggle version:', e);
      toast.show('Failed to switch token version', { kind: 'error' });
    }
  };

  const handleRefresh = async () => {
    if (!entry || isRefetching) return;

    if (onchain) {
      await useWalletStore.getState().autoCheckPendingOnchainQuotes();
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['history'] });
      return;
    }

    if (token && ['pending', 'unclaimed'].includes(status)) {
      try {
        const states = await proofService.checkProofStates(token);
        const proofCount = decodeToken(cleanToken(token)).proofs.length;
        let newState: string | undefined = getVerifiedTokenState(states, proofCount);
        if (!newState) throw new Error('Token status could not be verified');
        const isSpent = newState === 'claimed';

        // If pending and unspent but expired, trigger auto-sweep/refund
        if (!isSpent && expiresAt && Date.now() > expiresAt && newState !== 'claimed') {
          console.log('[TransactionDetails] Token expired and unspent on refresh. Sweeping...');
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
          if (newState === 'claimed' && entry.type === 'send' && entry.state !== 'claimed') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            toast.show('The recipient has claimed your ecash', { kind: 'success' });
            if (useSettingsStore.getState().notificationsEnabled) {
              notificationService.sendLocalNotification(
                'Claimed!',
                'The recipient has claimed your ecash',
                { transactionId: entry.id },
              );
            }
          }
        }
      } catch (err) {
        console.warn('[TransactionDetails] Failed to refresh proof states:', err);
      }
    }

    await refetch();
    queryClient.invalidateQueries({ queryKey: ['history'] });
  };

  const [isClaiming, setIsClaiming] = useState(false);
  const claimLock = useRef(false);
  const offline = useOfflineStatus();
  const mintFee =
    metadata?.via !== 'onchain' && Number.isFinite(metadata?.fee) ? Number(metadata.fee) : 0;

  const handleClaimNow = async () => {
    if (!token || claimLock.current) return;
    claimLock.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsClaiming(true);
    try {
      if (await networkService.isOffline()) return;
      await walletService.receive(token.trim());
      toast.show('Tokens added to wallet', { kind: 'success' });

      // Update state in DB
      const repo = initService.getRepo();
      if (repo?.historyRepository) {
        await (repo.historyRepository as any).updateHistoryEntryState(id!, 'claimed');
      }

      // Wait a bit for DB and then refresh UI
      setTimeout(() => {
        handleRefresh();
      }, 500);
    } catch (err: any) {
      console.error('[TransactionDetails] Claim failed:', err);
      toast.show('Claim Failed: ' + err.message, { kind: 'error' });
    } finally {
      claimLock.current = false;
      setIsClaiming(false);
    }
  };

  const changeSpeed = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (intervalMs === 250) setIntervalMs(500);
    else if (intervalMs === 500) setIntervalMs(140);
    else setIntervalMs(250);
  };

  const changeSize = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (fragmentLength === 100) setFragmentLength(50);
    else if (fragmentLength === 50) setFragmentLength(150);
    else setFragmentLength(100);
  };

  // Auto-refresh on mount and poll if pending — first check is immediate, then every 3s
  useEffect(() => {
    if (!entry || !initService.isInitialized()) return;

    const isPendingSend = entry.type === 'send' && (status === 'pending' || status === 'unclaimed');
    const isPendingMint =
      entry.type === 'mint' &&
      (status.toUpperCase() === 'UNPAID' || status.toUpperCase() === 'PAID');

    const isPendingOnchain = onchain && ['pending', 'unpaid', 'prepared'].includes(status);
    if (!isPendingSend && !isPendingMint && !isPendingOnchain) return;

    const poll = async () => {
      if (isPendingOnchain || isPendingSend) {
        await handleRefresh();
      } else if (isPendingMint) {
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
        }
      }
    };

    // Fire immediately
    poll();
    const interval = setInterval(poll, 3000);

    return () => clearInterval(interval);
  }, [entry?.id, entry?.state, status, token, onchain]);
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

  const speedLabel = intervalMs === 140 ? 'F' : intervalMs === 250 ? 'M' : 'S';
  const sizeLabel = fragmentLength === 150 ? 'L' : fragmentLength === 100 ? 'M' : 'S';

  const showInvoiceLayout = useMemo(() => {
    return (
      !!entry &&
      !isQuoteExpired &&
      historyPaymentLayout(entry, savedInvoice) === 'lightning-invoice'
    );
  }, [entry, savedInvoice, isQuoteExpired]);

  // Shared header amount title (primary + secondary)
  const headerPrimaryAmount =
    primaryCurrency === 'SATS'
      ? currencyService.formatSats(Number(entry?.amount || 0))
      : currencyService.formatValue(fiatAmount, secondaryCurrency as CurrencyCode);
  const headerSecondaryAmount =
    primaryCurrency === 'SATS'
      ? currencyService.formatValue(fiatAmount, secondaryCurrency as CurrencyCode)
      : currencyService.formatSats(Number(entry?.amount || 0));

  // Derive badge status from entry state
  const badgeStatus: BadgeStatus = (() => {
    const s = (status || '').toLowerCase();
    if (s === 'success' || s === 'claimed' || s === 'completed' || s === 'paid' || s === 'refunded')
      return 'success';
    if (s === 'pending' || s === 'unclaimed' || s === 'unpaid') return 'pending';
    if (s === 'failed' || s === 'error' || s === 'expired') return 'failed';
    return 'pending';
  })();

  const headerOptions = {
    title: title || 'Transaction',
    headerTitleAlign: 'center' as const,
    headerRight: () => (
      <HeaderIconButton
        accessibilityLabel="Delete transaction"
        icon={<Trash2 />}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          deleteSheetRef.current?.present();
        }}
      />
    ),
  };

  const makeHeaderOptions = () => headerOptions;
  const makeFinalizedHeaderOptions = () => headerOptions;

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

  if (!entry) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
        <YStack flex={1} bg="$background" items="center" justify="center" p="$4">
          <Spinner size="large" />
          <Text mt="$4" color="$gray10">
            Loading transaction details...
          </Text>
        </YStack>
      </SafeAreaView>
    );
  }

  const isOutgoing = entry.type === 'send' || entry.type === 'melt';
  const amountColor = isOutgoing ? '$red10' : '$green11';
  const amountSign = isOutgoing ? '-' : '+';
  const receiptStatus = paymentReceiptStatus(status);
  const statusLabel =
    receiptStatus === 'success'
      ? status === 'refunded'
        ? 'Reclaimed'
        : onchain && entry.type === 'melt'
          ? 'Payment sent'
          : 'Success'
      : receiptStatus === 'error'
        ? 'Failed'
        : receiptStatus === 'cancelled'
          ? status === 'expired'
            ? 'Expired'
            : 'Cancelled'
          : 'Pending';

  const paymentLayout = historyPaymentLayout(entry);
  const extraDetails = notes.length > 0 ? <TransactionNoteRows notes={notes} /> : undefined;
  if (paymentLayout === 'onchain-deposit' || paymentLayout === 'onchain-withdrawal') {
    const mints = useWalletStore.getState().mints;
    const mint = mints.find(
      (item) => item.mintUrl.replace(/\/$/, '') === entry.mintUrl.replace(/\/$/, ''),
    );
    return (
      <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
        <PendingOnchainLayout
          direction={paymentLayout === 'onchain-deposit' ? 'deposit' : 'withdrawal'}
          amount={entry.amount}
          address={metadata.address || (entry as any).paymentRequest || ''}
          mint={mint?.nickname || mint?.name || entry.mintUrl.replace(/^https?:\/\//, '')}
          onRefresh={handleRefresh}
          checking={isRefetching}
          onClose={() => router.back()}
          headerRight={headerOptions.headerRight}
          extraDetails={extraDetails}
        />
        {renderDeleteBottomSheet()}
      </SafeAreaView>
    );
  }

  if (showInvoiceLayout && savedInvoice) {
    return (
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
                toast.show('Deposit invoice marked as failed.', { kind: 'info' });
                await handleRefresh();
              }
            } catch (e) {
              console.warn('[TransactionDetails] Failed to cancel quote:', e);
            }
          }}
          onPaid={async () => {
            setIsCheckingPaid(true);
            try {
              await quotesService.redeemMintQuote(entry.mintUrl, (entry as any).quoteId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              toast.show('Ecash claimed successfully.', { kind: 'success' });
              await handleRefresh();
            } catch (err: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              toast.show('Invoice not paid yet. Try again shortly.', { kind: 'info' });
            } finally {
              setIsCheckingPaid(false);
            }
          }}
        />
        {renderDeleteBottomSheet()}
      </SafeAreaView>
    );
  }

  if (token && typeof token === 'string' && (status === 'pending' || status === 'unclaimed')) {
    return (
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
      </SafeAreaView>
    );
  }

  try {
    return (
      <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
        <Stack.Screen options={headerOptions} />
        <PaymentFlowHeader title="Transaction details" />
        <ScrollView
          flex={1}
          bg="$background"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24, paddingHorizontal: 16 } as any}
        >
          <YStack flex={1} bg="$background" gap="$6">
            <YStack flex={1} minHeight={280} gap="$3" py="$7" items="center" justify="center">
              <PaymentStatusIcon status={receiptStatus} />
              <Text fontSize={16} fontWeight="500" color="$color" textAlign="center">
                {statusLabel}
              </Text>
              <PaymentAmount amount={displayedAmount} size="prominent" compact />
              {receivingFeeNotice && (
                <XStack p="$2" bg="$gray3" rounded="$6">
                  <Text accessibilityRole="alert" fontSize={13} color="$gray10" textAlign="center">
                    {receivingFeeNotice}
                  </Text>
                </XStack>
              )}
            </YStack>

            {/* Details table */}
            <ListTable compact bg="$gray2" rounded="$6" overflow="hidden">
              <YGroup separator={<YStack height={2} width="100%" bg="$background" />}>
                <DetailItem label="Date" value={formatPaymentDateTime(entry.createdAt)} />
                {metadata?.reclaimAt && (
                  <DetailItem
                    label="Reclaim eligible"
                    value={formatPaymentDateTime(Number(metadata.reclaimAt))}
                  />
                )}
                <DetailItem
                  label="Mint"
                  value={(entry.mintUrl || 'Unknown').replace(/^https?:\/\//, '').split('/')[0]}
                />
                {mintFee > 0 && (
                  <DetailItem label="Fee" value={currencyService.formatSats(mintFee)} />
                )}
                {/* Via channel & contacts */}
                {(() => {
                  let meta = entry.metadata ?? {};
                  if (typeof meta === 'string') {
                    try {
                      meta = JSON.parse(meta);
                    } catch {
                      meta = {};
                    }
                  }
                  const via: string | undefined = (meta as any)?.via;
                  const nostrUsername: string | undefined = (meta as any)?.nostrUsername;
                  const nostrPubkey: string | undefined = (meta as any)?.nostrPubkey;
                  const sourceMintName: string | undefined = (meta as any)?.sourceMintName;
                  const targetMintName: string | undefined = (meta as any)?.targetMintName;

                  if (via === 'swap') {
                    return (
                      <>
                        <DetailItem label="Channel" value="Mint transfer" />
                        {sourceMintName && (
                          <DetailItem label="Source Mint" value={sourceMintName} />
                        )}
                        {targetMintName && (
                          <DetailItem label="Target Mint" value={targetMintName} />
                        )}
                      </>
                    );
                  }

                  if (!via) return null;
                  const viaLabel =
                    via === 'nostr'
                      ? 'Nostr'
                      : via === 'qr' || via === 'scan'
                        ? 'QR Scan'
                        : via === 'nfc'
                          ? 'NFC'
                          : via === 'ecash_create'
                            ? 'Ecash Token'
                            : via === 'paste'
                              ? 'Paste'
                              : via === 'lightning'
                                ? 'Lightning'
                                : via;
                  return (
                    <>
                      <DetailItem label="Channel" value={viaLabel} />
                      {via === 'nostr' && (nostrUsername || nostrPubkey) && (
                        <DetailItem
                          label={entry.type === 'send' ? 'Recipient' : 'Sender'}
                          value={
                            nostrUsername
                              ? `@${nostrUsername.replace('@bey.cash', '')}`
                              : nostrPubkey
                                ? `${nostrPubkey.slice(0, 12)}…${nostrPubkey.slice(-6)}`
                                : 'Unknown'
                          }
                          isCopyable={!!nostrPubkey}
                          onCopy={async () => {
                            if (nostrPubkey) {
                              await Clipboard.setStringAsync(nostrPubkey);
                              toast.show('Nostr pubkey copied', { kind: 'success' });
                            }
                          }}
                        />
                      )}
                    </>
                  );
                })()}
                {lockedToNpub && (
                  <DetailItem
                    label="Locked To"
                    value={
                      lockedToNpub === useSettingsStore.getState().npub
                        ? 'You (Safe)'
                        : `${lockedToNpub.substring(0, 10)}...${lockedToNpub.substring(lockedToNpub.length - 6)}`
                    }
                    isCopyable={lockedToNpub !== useSettingsStore.getState().npub}
                    onCopy={async () => {
                      await Clipboard.setStringAsync(lockedToNpub);
                      Haptics.selectionAsync();
                      toast.show('NPUB copied to clipboard', { kind: 'success' });
                    }}
                  />
                )}
                {/* On-chain Details */}
                {(() => {
                  let meta = entry.metadata ?? {};
                  if (typeof meta === 'string') {
                    try {
                      meta = JSON.parse(meta);
                    } catch {
                      meta = {};
                    }
                  }
                  const via = (meta as any)?.via;
                  if (!onchain) return null;

                  const btcAddress =
                    (meta as any)?.address ||
                    ('paymentRequest' in entry ? entry.paymentRequest : undefined);
                  const onchainFee = (meta as any)?.actualFee;

                  return (
                    <>
                      {btcAddress ? (
                        <DetailItem
                          label="BTC Address"
                          value={`${btcAddress.substring(0, 10)}...${btcAddress.substring(btcAddress.length - 8)}`}
                          isCopyable
                          onCopy={async () => {
                            await Clipboard.setStringAsync(btcAddress);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            toast.show('BTC Address copied', { kind: 'success' });
                          }}
                        />
                      ) : null}
                      {entry.type === 'melt' && onchainFee !== undefined ? (
                        <DetailItem
                          label="Network Fee"
                          value={currencyService.formatSats(onchainFee)}
                        />
                      ) : null}
                    </>
                  );
                })()}
                {/* Invoice for mint txns */}
                {!onchain && savedInvoice && (
                  <DetailItem
                    label="Invoice"
                    value={`${savedInvoice.substring(0, 10)}...${savedInvoice.substring(savedInvoice.length - 10)}`}
                    isCopyable
                    onCopy={async () => {
                      await Clipboard.setStringAsync(savedInvoice);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      toast.show('Invoice copied', { kind: 'success' });
                    }}
                  />
                )}
                {/* Token for send/receive txns */}
                {token && (entry.type === 'send' || entry.type === 'receive') && (
                  <DetailItem
                    label="Token"
                    value={
                      token
                        ? `${token.substring(0, 10)}...${token.substring(token.length - 6)}`
                        : 'Unavailable'
                    }
                    isCopyable={!!token}
                    onCopy={handleCopyToken}
                  />
                )}
              </YGroup>
              {extraDetails}
            </ListTable>

            {/* Pending actions */}
            {token &&
              typeof token === 'string' &&
              (status === 'pending' || status === 'unclaimed') && (
                <YStack gap="$3">
                  {entry.type === 'send' ? (
                    <PendingTokenLayout
                      token={token}
                      operationId={entry.operationId}
                      amount={entry.amount}
                      fee={mintFee}
                      mintUrl={entry.mintUrl}
                      lockedToNpub={lockedToNpub}
                      hideDetails={true}
                      onReclaim={handleReclaim}
                      isReclaiming={isReclaiming}
                      expiresAt={expiresAt}
                    />
                  ) : entry.type === 'receive' && status === 'unclaimed' ? (
                    <AppButton
                      variant="branded"
                      emphasis="primary"
                      size="large"
                      loading={isClaiming}
                      icon={<ArrowDownLeft size={20} color="white" />}
                      onPress={handleClaimNow}
                      disabled={isClaiming}
                    >
                      CLAIM NOW
                    </AppButton>
                  ) : null}
                </YStack>
              )}
          </YStack>
        </ScrollView>
        <YStack px="$4" pt="$3" pb="$4" bg="$background">
          <AppButton
            variant="default"
            emphasis="secondary"
            size="large"
            fullWidth
            onPress={() => router.back()}
          >
            Done
          </AppButton>
        </YStack>
        {renderDeleteBottomSheet()}
      </SafeAreaView>
    );
  } catch (e: any) {
    console.error('[TransactionDetails] Error during render:', e);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '$background' }}>
        <YStack flex={1} items="center" justify="center" p="$6" gap="$4">
          <AlertCircle size={48} color="$red10" />
          <Text fontSize="$6" fontWeight="800">
            Render Error
          </Text>
          <Text color="$gray10" text="center">
            {e.message}
          </Text>
          <AppButton
            variant="default"
            emphasis="secondary"
            size="medium"
            mt="$4"
            onPress={() => router.back()}
          >
            Go Back
          </AppButton>
        </YStack>
      </SafeAreaView>
    );
  }
}

function DetailItem({
  label,
  value,
  isCopyable,
  onCopy,
}: {
  label: string;
  value: string;
  isCopyable?: boolean;
  onCopy?: () => void;
}) {
  return <ListTableRow label={label} value={value} isCopyable={isCopyable} onCopy={onCopy} />;
}
