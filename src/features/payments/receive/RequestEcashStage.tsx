import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentStatusRow } from '~/shared/ui/PaymentStatusRow';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import { PaymentQRFrame } from '~/shared/ui/PaymentQRFrame';
import { useFlowMint } from '~/shared/hooks/useFlowMint';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { PaymentMintRow } from '~/shared/ui/PaymentMintRow';
import { PaymentNote } from '~/shared/ui/PaymentNote';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';

import { AppButton } from '~/shared/ui/AppButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import React, { useState, useCallback, useRef } from 'react';
import { Buffer } from 'buffer';
import { YStack, XStack, Text, Separator } from 'tamagui';
import { QrCode, AlertCircle, ArrowUpDown } from '@tamagui/lucide-icons';
import { Spinner } from '~/shared/ui/Spinner';
import { NumericKeypad } from '~/shared/ui/NumericKeypad';
import { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { MintSelectorSheet } from '~/shared/ui/HomeMintSelector';
import Blockies from '~/shared/ui/Blockies';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import { useToastController } from '@tamagui/toast';
import QRCode from '~/shared/ui/PaymentQRCode';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';
import { useNostrRequestStore } from '~/state/nostrRequestStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/api/bitcoinService';
import {
  currencyService,
  CurrencyCode,
  SUPPORTED_CURRENCIES,
} from '~/services/wallet/currencyService';
import { PaymentRequest, PaymentRequestTransportType } from '@cashu/cashu-ts';
import { decode as nip19Decode, nprofileEncode } from 'nostr-tools/nip19';
import { ResultStage } from '~/features/payments/send/ResultStage';
import { MintBalanceRow } from '~/shared/ui/MintBalanceRow';
import { BouncyAmount } from '~/shared/ui/BouncyAmount';

/** Simple unique ID — avoids a uuid dependency */
const makeRequestId = () =>
  `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// ─── Types ───────────────────────────────────────────────────────────────────

type RequestStep = 'amount' | 'confirm' | 'result' | 'success';

interface RequestEcashStageProps {
  onClose?: () => void;
  initialRequestId?: string;
  targetNpub?: string;
  targetUsername?: string;
}

// ─── Detail Row ───────────────────────────────────────────────────────────────

function DetailItem({
  label,
  value,
  isCopyable,
  onCopy,
  onShare,
}: {
  label: string;
  value: string;
  isCopyable?: boolean;
  onCopy?: () => void;
  onShare?: () => void;
}) {
  return (
    <ListTableRow
      label={label}
      value={value}
      isCopyable={isCopyable}
      onCopy={onCopy}
      rightContent={
        onShare ? (
          <AppButton size="small" emphasis="text-only" onPress={onShare}>
            Share
          </AppButton>
        ) : undefined
      }
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RequestEcashStage({
  onClose,
  initialRequestId,
  targetNpub,
  targetUsername,
}: RequestEcashStageProps) {
  const [step, setStep] = useState<RequestStep>('amount');
  const [amount, setAmount] = useState('0');
  const [localInputValue, setLocalInputValue] = useState('0');
  const [inputMode, setInputMode] = useState<'SATS' | 'FIAT'>(
    () => useSettingsStore.getState().primaryCurrency,
  );
  const [note, setNote] = useState('');

  // NUT-18 payment request
  const [creqString, setCreqString] = useState<string | null>(null);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedLink, setPublishedLink] = useState<string | null>(null);

  const sheetRef = useRef<AppBottomSheetRef>(null);
  const generationLock = useRef(false);
  const toast = useToastController();

  const { mints, refreshMintList, isInitializing, isRefreshing } = useWalletStore();
  const { mintUrl: activeMintUrl, setMintUrl: setActiveMint, balance } = useFlowMint();
  const { secondaryCurrency, npub, primaryCurrency, showBitcoinSymbol } = useSettingsStore();
  const { addRequest, loadPendingRequests } = useNostrRequestStore();

  // ── Restore from History (initialRequestId) ───────────────────────────────
  React.useEffect(() => {
    if (initialRequestId) {
      // Wait for store to be loaded just in case
      loadPendingRequests().then(() => {
        const req = useNostrRequestStore.getState().requests.find((r) => r.id === initialRequestId);
        if (req) {
          console.log('[RequestEcashStage] Restored request from history:', initialRequestId);
          setAmount(req.amount.toString());
          setLocalInputValue(req.amount.toString());
          setCreqString(req.creqString);
          setCurrentRequestId(req.id);
          if (req.mintUrl !== activeMintUrl) {
            setActiveMint(req.mintUrl);
          }
          if (req.description) {
            setNote(req.description);
          }
          setStep('result');
        }
      });
    }
  }, [initialRequestId]);

  const activeMint = React.useMemo(() => {
    if (!activeMintUrl) return null;
    const normalizeUrl = (url: string) => url.replace(/\/$/, '');
    return mints.find((m) => normalizeUrl(m.mintUrl) === normalizeUrl(activeMintUrl));
  }, [mints, activeMintUrl]);

  const displayName = React.useMemo(() => {
    if (!activeMintUrl) return 'Select Mint';
    if (activeMint?.nickname) return activeMint.nickname;
    if (activeMint?.name) return activeMint.name;
    return activeMintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }, [activeMint, activeMintUrl]);

  const isLoadingMint = isInitializing || isRefreshing;

  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
  });

  const currencySymbol =
    SUPPORTED_CURRENCIES.find((c) => c.code === secondaryCurrency)?.symbol || '$';
  const amtNum = parseInt(amount, 10) || 0;
  const isValidAmount = amtNum > 0 && !!activeMintUrl;

  // ── Conversion labels ─────────────────────────────────────────────────────
  const conversionLabel = React.useMemo(() => {
    if (!btcData?.price) return '~';
    if (inputMode === 'SATS') {
      const val = currencyService.convertSatsToCurrency(amtNum, btcData.price);
      return `${currencySymbol}${val.toFixed(2)}`;
    }
    return currencyService.formatSats(amtNum);
  }, [amtNum, btcData?.price, inputMode, currencySymbol]);

  const conversionValue = React.useMemo(() => {
    if (!btcData?.price) return '0';
    if (inputMode === 'SATS') {
      const sats = Number(amount) || 0;
      return currencyService.formatValue(
        currencyService.convertSatsToCurrency(sats, btcData.price),
        secondaryCurrency as CurrencyCode,
      );
    } else {
      return currencyService.formatSats(Number(amount) || 0);
    }
  }, [amount, btcData?.price, inputMode, secondaryCurrency]);

  const fiatValueLabel = React.useMemo(() => {
    if (!btcData?.price || !amtNum) return '—';
    const val = currencyService.convertSatsToCurrency(amtNum, btcData.price);
    return `${currencySymbol}${val.toFixed(2)}`;
  }, [amtNum, btcData?.price, currencySymbol]);

  const formattedDisplayValue = React.useMemo(() => {
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

  const dynamicFontSize = React.useMemo(() => {
    const len = formattedDisplayValue.length;
    if (len <= 6) return 44;
    if (len <= 8) return 38;
    if (len <= 10) return 32;
    if (len <= 13) return 26;
    return 20;
  }, [formattedDisplayValue]);

  const formatNpub = (str: string | null) => {
    if (!str) return '';
    if (str.length < 20) return str;
    return `${str.slice(0, 10)}...${str.slice(-6)}`;
  };

  // ── Keypad ────────────────────────────────────────────────────────────────
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
    } else if (btcData?.price) {
      const sats = currencyService.convertCurrencyToSats(Number(val) || 0, btcData.price);
      setAmount(String(sats));
    }
  };

  const toggleMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (inputMode === 'SATS') {
      if (btcData?.price) {
        const fiat = currencyService.convertSatsToCurrency(Number(amount) || 0, btcData.price);
        setLocalInputValue(fiat > 0 ? fiat.toFixed(2) : '0');
      }
      setInputMode('FIAT');
    } else {
      setLocalInputValue(amount);
      setInputMode('SATS');
    }
  };

  const handleMax = () => {
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

  // ── Mint selection ────────────────────────────────────────────────────────
  const handleSelectMint = (mintUrl: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveMint(mintUrl);
    sheetRef.current?.dismiss();
  };

  // ── Generate NUT-18 Cashu Payment Request ─────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (
      generationLock.current ||
      isGenerating ||
      currentRequestId ||
      !isValidAmount ||
      !activeMintUrl
    )
      return;
    generationLock.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsGenerating(true);
    setGenerateError(null);

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
            // HACK: NUT-18 spec says target should be a hex pubkey.
            // However, cashu.me has a bug where it unconditionally calls `nip19.decode(target)`
            // and expects a `ProfilePointer` (which means it expects an `nprofile1...` string).
            // Furthermore, if we omit relays, it decodes to `[]`, which breaks cashu.me's relay fallback.
            // If we pass all 12 relays, the QR code becomes too dense to scan.
            // We pass exactly ONE highly reliable relay to satisfy both constraints.
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
        amtNum,
        'sat',
        [activeMintUrl],
        note.trim() || undefined,
      );

      const encoded = pr.toEncodedRequest();

      if (!npub) throw new Error('Wallet identity is unavailable.');
      await addRequest({
        id: reqId,
        mintUrl: activeMintUrl,
        amount: amtNum,
        unit: 'sat',
        creqString: encoded,
        nostrPubkey: npub,
        recipient: targetNpub,
        description: note.trim() || undefined,
      });
      savedRequestId = reqId;
      setCurrentRequestId(reqId);
      setCreqString(encoded);

      if (targetNpub) {
        const { nostrService } = await import('~/services/wallet/nostrService');
        await nostrService.sendRequest(targetNpub, encoded, reqId, amtNum);
        const { usePeopleStore } = await import('~/state/peopleStore');
        const recipientLabel = targetUsername?.trim() || '';
        usePeopleStore.getState().savePerson({
          npub: targetNpub,
          username: recipientLabel.toLowerCase().endsWith('@bey.cash')
            ? recipientLabel.replace(/@bey\.cash$/i, '')
            : null,
          displayName: recipientLabel.includes('@') ? null : recipientLabel || null,
          nip05: recipientLabel.includes('@') ? recipientLabel : null,
        });
        console.log(`[RequestEcashStage] Sent request to ${targetNpub}`);
      }

      // ── Persist request to local DB so E-Cash screen shows it ──────────
      setCurrentRequestId(reqId);

      setCreqString(encoded);
      setStep('result');
    } catch (err: any) {
      if (savedRequestId) setStep('result');
      console.error('[RequestEcashStage] PaymentRequest generation failed:', err);
      setGenerateError(err?.message || 'Failed to generate request');
      toast.show('Request failed: ' + (err?.message || 'Failed to generate request'), {
        kind: 'error',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      generationLock.current = false;
      setIsGenerating(false);
    }
  }, [
    amtNum,
    isValidAmount,
    activeMintUrl,
    note,
    npub,
    addRequest,
    targetNpub,
    targetUsername,
    isGenerating,
    currentRequestId,
    toast,
  ]);

  // ── Copy / Share ──────────────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    if (!creqString) return;
    await Clipboard.setStringAsync(creqString);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    toast.show('Payment request copied to clipboard', { kind: 'success' });
    setTimeout(() => setCopied(false), 2000);
  }, [creqString]);

  const handleShare = useCallback(async () => {
    if (!creqString) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Wallets like Minibits accept "cashu:" prefix for payment requests too
    await Share.share({ message: creqString });
  }, [creqString]);

  const handleReset = () => {
    setStep('amount');
    setCurrentRequestId(null);
    setCreqString(null);
    setGenerateError(null);
    setCopied(false);
    setPublishedLink(null);
  };

  const handlePublish = useCallback(async () => {
    if (!creqString) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPublishing(true);
    try {
      // 1. Generate 32 bytes random secret_key
      const secretKeyBytes = global.crypto.getRandomValues(new Uint8Array(32));
      const secretKeyHex = Buffer.from(secretKeyBytes).toString('hex');

      // 2. Build Nostr event with the JSON payload including creq and note
      const { buildEcashNostrEvent } = require('~/shared/utils/ecashSharing');
      const payload = JSON.stringify({ creq: creqString, note: note.trim() });
      const { event } = buildEcashNostrEvent(payload, secretKeyHex);

      // 3. Publish to relays
      const { SimplePool } = require('nostr-tools');
      const { RELAYS } = require('~/services/wallet/nostrService');
      const pool = new SimplePool();
      await Promise.any(pool.publish(RELAYS, event));
      pool.close(RELAYS);

      // 4. Construct share link
      const websiteUrl = 'https://bey.cash/r/';
      const shareLink = `${websiteUrl}#${secretKeyHex}`;
      setPublishedLink(shareLink);

      toast.show('Request published on bey.cash', { kind: 'success' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      console.error('[RequestEcashStage] Failed to publish request:', err);
      toast.show('Publish Failed: ' + (err?.message || 'Could not publish to relays'), {
        kind: 'error',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsPublishing(false);
    }
  }, [creqString, note, toast]);

  // ── Real-Time Nostr Listener ──────────────────────────────────────────────
  React.useEffect(() => {
    if (!currentRequestId) return;
    const check = () => {
      const request = useNostrRequestStore
        .getState()
        .requests.find((r) => r.id === currentRequestId);
      if (request?.state === 'received') setStep('success');
    };
    check();
    return useNostrRequestStore.subscribe(check);
  }, [currentRequestId]);

  const handleCheckStatus = useCallback(async () => {
    setIsChecking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Force nostrService to reconnect and fetch recent events
      const { nostrService } = require('~/services/wallet/nostrService');
      nostrService.refresh();

      const { requestLifecycleService } = await import('~/services/wallet/requestLifecycleService');
      await requestLifecycleService.reconcile();
      await loadPendingRequests();
      const request = useNostrRequestStore
        .getState()
        .requests.find((r) => r.id === currentRequestId);
      if (request?.state === 'received') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep('success');
      } else {
        toast.show(
          request?.state === 'cancelled'
            ? 'Request cancelled.'
            : request?.state === 'expired'
              ? 'Request expired.'
              : 'No payment received yet.',
          { kind: 'info' },
        );
      }
    } catch (e) {
      console.warn('[RequestEcashStage] check status error:', e);
      toast.show('Unable to check payment. Please try again.', { kind: 'error' });
    } finally {
      setIsChecking(false);
    }
  }, [currentRequestId, loadPendingRequests, toast]);

  // ────────────────────────────────────────────────────────────────────────
  // AMOUNT STAGE
  // ────────────────────────────────────────────────────────────────────────
  // AMOUNT STAGE
  // ────────────────────────────────────────────────────────────────────────
  const header = (
    <PaymentFlowHeader
      title={
        step === 'confirm'
          ? 'Confirm request'
          : step === 'result'
            ? 'Request payment'
            : step === 'success'
              ? 'Payment received'
              : 'Request ecash'
      }
      onBack={step === 'confirm' ? () => setStep('amount') : onClose}
      disabled={isGenerating || isPublishing}
    />
  );
  if (step === 'confirm') {
    return (
      <>
        {header}
        <PaymentStageLayout
          disabled={isGenerating}
          hero={<PaymentAmount amount={amtNum} label="You're requesting" />}
          footer={
            <AppButton
              size="large"
              fullWidth
              disabled={!activeMintUrl || !isValidAmount || isGenerating}
              loading={isGenerating}
              loadingText="Creating request…"
              onPress={handleGenerate}
            >
              Create request
            </AppButton>
          }
        >
          <ListTable>
            <PaymentMintRow
              mintUrl={activeMintUrl || ''}
              onSelect={setActiveMint}
              disabled={isGenerating}
            />
            {targetNpub && <ListTableRow label="From" value={targetUsername || targetNpub} />}
            <PaymentNote value={note} onChange={setNote} disabled={isGenerating} />
          </ListTable>
          {generateError && (
            <Text color="$red10" p="$3">
              {generateError}
            </Text>
          )}
        </PaymentStageLayout>
      </>
    );
  }

  if (step === 'amount') {
    return (
      <YStack flex={1} px="$4" justify="space-between" bg="$background">
        {header}
        <YStack gap="$1.5" pointerEvents={isGenerating ? 'none' : 'auto'}>
          {generateError && (
            <Text color="$red10" accessibilityRole="alert">
              {generateError}
            </Text>
          )}
          {/* Mint Selector Row */}
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

          {/* Card Box Container matching Send stages */}
          <YStack
            width="100%"
            bg="$gray3"
            rounded="$6"
            p="$4"
            py="$5"
            items="center"
            gap="$3"
            borderWidth={0}
          >
            {/* Amount Display Section */}
            <YStack items="center" justify="center" py="$3" gap="$2" width="100%">
              {generateError ? (
                <YStack items="center" gap="$2" px="$4">
                  <AlertCircle size={28} color="$red10" />
                  <Text color="$red10" fontSize="$3" fontWeight="600" textAlign="center">
                    {generateError}
                  </Text>
                </YStack>
              ) : !activeMintUrl ? (
                <YStack items="center" gap="$2" px="$4">
                  <AlertCircle size={28} color="$orange10" />
                  <Text color="$orange10" fontSize="$3" fontWeight="600" textAlign="center">
                    Select a mint to generate a request
                  </Text>
                </YStack>
              ) : !npub ? (
                <YStack items="center" gap="$2" px="$4">
                  <AlertCircle size={28} color="$red10" />
                  <Text color="$red10" fontSize="$3" fontWeight="600" textAlign="center">
                    Nostr profile required to receive directly.
                  </Text>
                </YStack>
              ) : (
                <>
                  {targetNpub ? (
                    <XStack items="center" gap="$2" justify="center" flexWrap="wrap">
                      <Text color="$gray10" fontSize="$3" fontWeight="500">
                        Requesting from
                      </Text>
                      <XStack bg="$gray4" px="$2.5" py="$1" rounded="$10" items="center" gap="$1.5">
                        <Blockies
                          seed={targetNpub}
                          size={4}
                          scale={2}
                          style={{ borderRadius: 10 }}
                        />
                        <Text fontSize="$2" fontWeight="700" color="$gray12">
                          {targetUsername || formatNpub(targetNpub)}
                        </Text>
                      </XStack>
                    </XStack>
                  ) : (
                    <Text color="$gray10" fontSize="$3" fontWeight="500">
                      How much to request?
                    </Text>
                  )}

                  <BouncyAmount
                    value={formattedDisplayValue}
                    fontSize={dynamicFontSize}
                    prefix={inputMode === 'SATS' ? (showBitcoinSymbol ? '₿' : '') : currencySymbol}
                    suffix={inputMode === 'SATS' && !showBitcoinSymbol ? ' SATS' : ''}
                  />
                  <AppPressable
                    px={12}
                    py={4}
                    rounded="$10"
                    bg="$gray5"
                    pressStyle={{ scale: 0.96, bg: '$gray5' }}
                    onPress={toggleMode}
                    minHeight={36}
                    flexDirection="row"
                    items="center"
                    justify="center"
                    gap={8}
                  >
                    <Text color="$color" fontSize="$3" fontWeight="600">
                      {conversionValue}
                    </Text>
                    <ArrowUpDown size={14} color="$accent10" strokeWidth={2.5} />
                  </AppPressable>
                </>
              )}
            </YStack>

            {/* Standalone Note Card outside the amount card */}
          </YStack>
        </YStack>

        {/* ── Keypad ───────────────────────────────────────────────── */}

        <NumericKeypad
          showAmountDisplay={false}
          value={localInputValue}
          onValueChange={onKeypadChange}
          onConfirm={() => setStep('confirm')}
          confirmLabel="Continue"
          loadingText="Creating payment request…"
          confirmDisabled={!isValidAmount || isGenerating || !npub}
          confirmIcon={isGenerating ? <Spinner size="small" /> : <QrCode size={20} />}
          isLoading={isGenerating}
        />

        {/* ── Mint bottom sheet ─────────────────────────────────────── */}
        <MintSelectorSheet
          ref={sheetRef}
          activeMintUrl={activeMintUrl || undefined}
          onSelect={setActiveMint}
          showAllOption={false}
          changeGlobalActiveMint={false}
          trustedOnly
        />
      </YStack>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // SUCCESS STAGE
  // ────────────────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <>
        {header}
        <ResultStage
          status="success"
          amount={amtNum.toString()}
          mintUrl={activeMintUrl!}
          title="Request claimed"
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
            <Text fontSize={14} fontWeight="500" color="$gray10">
              Request payment
            </Text>
            <PaymentQRFrame accessibilityLabel="Payment request QR code">
              {(size) =>
                creqString ? (
                  <QRCode value={creqString} size={size} backgroundColor="white" color="black" />
                ) : (
                  <YStack width={size} height={size} items="center" justify="center">
                    <Spinner size="large" />
                  </YStack>
                )
              }
            </PaymentQRFrame>
            <PaymentAmount amount={amtNum} compact />
          </>
        }
        footer={
          <AppButton size="large" fullWidth onPress={handleShare}>
            Share request
          </AppButton>
        }
      >
        {generateError && (
          <Text accessibilityRole="alert" color="$buttonWarningSecondaryText">
            {generateError} Your request is saved. Retry sending from its conversation.
          </Text>
        )}
        <ListTable
          gap="$0"
          bg="$gray2"
          rounded="$6"
          overflow="hidden"
          separator={<Separator borderColor="$borderColor" opacity={0.5} />}
        >
          <DetailItem label="Mint" value={displayName} />
          <PaymentStatusRow
            value="Awaiting payment"
            onRefresh={handleCheckStatus}
            checking={isChecking}
          />
          {note ? <DetailItem label="Note" value={note} /> : null}
          {targetNpub ? (
            <DetailItem
              label="Sent To"
              value={targetUsername || `${targetNpub.slice(0, 10)}...${targetNpub.slice(-6)}`}
            />
          ) : null}
          {publishedLink ? (
            <DetailItem
              label="Web Link"
              value={`${publishedLink.slice(0, 14)}…${publishedLink.slice(-6)}`}
              isCopyable
              onCopy={() => {
                Clipboard.setStringAsync(publishedLink);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                toast.show('Web request link copied to clipboard', { kind: 'success' });
              }}
              onShare={() => Share.share({ message: publishedLink })}
            />
          ) : null}
          <DetailItem
            label="Request"
            value={creqString ? `${creqString.slice(0, 14)}…${creqString.slice(-6)}` : '—'}
            isCopyable={!!creqString}
            onCopy={handleCopy}
            onShare={handleShare}
          />
        </ListTable>
        {!publishedLink && (
          <AppButton
            emphasis="text-only"
            loading={isPublishing}
            disabled={isPublishing}
            onPress={handlePublish}
          >
            Publish on bey.cash
          </AppButton>
        )}
        <XStack justify="center" gap="$3">
          <AppButton size="small" emphasis="text-only" onPress={handleReset}>
            New request
          </AppButton>
        </XStack>
      </PaymentStageLayout>
    </>
  );
}
