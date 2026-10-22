import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import { PaymentQRFrame } from '~/shared/ui/PaymentQRFrame';
import { PaymentStatusIcon } from '~/shared/ui/PaymentStatusIcon';
import { PaymentStatusRow } from '~/shared/ui/PaymentStatusRow';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import { AppButton } from '~/shared/ui/AppButton';
import React, { useEffect, useState, useRef } from 'react';
import { YStack, XStack, Text, Separator, useTheme, YGroup } from 'tamagui';
import { Copy, Share2, Check, Gauge, Nfc, Globe, X } from '@tamagui/lucide-icons';
import { Buffer } from 'buffer';
import * as Haptics from 'expo-haptics';
import QRCode from '~/shared/ui/PaymentQRCode';
import * as Clipboard from 'expo-clipboard';
import { Share as RNShare } from 'react-native';
import { useToastController } from '@tamagui/toast';
import * as Linking from 'expo-linking';

import { Spinner } from '~/shared/ui/Spinner';

import { UR, UREncoder } from '@gandlaf21/bc-ur';
import { useSettingsStore } from '~/state/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/api/bitcoinService';
import { currencyService, CurrencyCode } from '~/services/wallet/currencyService';
import { cleanToken, decodeToken, encodeTokenV4, encodeTokenV3 } from '~/services/wallet';
import { nip19 } from 'nostr-tools';
import { nfcFlow } from '~/features/nfc/nfcFlow';
import { useAuthStore } from '~/state/authStore';
import { BadgeStatus } from '~/shared/ui/StatusBadge';
import AppBottomSheet, { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';

export interface PendingTokenLayoutProps {
  navigationAction?: 'back' | 'close';
  token: string;
  amount: number | string;
  fee?: number;
  mintUrl?: string;
  onReclaim?: () => void | Promise<void>;
  isReclaiming?: boolean;
  lockedToNpub?: string | null;
  hideDetails?: boolean;
  hideActions?: boolean;
  onClaim?: () => void | Promise<void>;
  isClaiming?: boolean;
  offline?: boolean;
  operationId?: string;
  expiresAt?: number;
  reclaimAt?: number;
  /** Controls the status badge color in the header. Defaults to 'pending'. */
  headerStatus?: BadgeStatus;
  /** Refreshes the status row using the owning payment flow. */
  onCheckStatus?: () => void | Promise<void>;
  /** Shows a spinner while a status check is in flight. */
  isCheckingStatus?: boolean;
  customHeaderRight?: () => React.ReactNode;
  extraDetails?: React.ReactNode;
}

export function PendingTokenLayout({
  navigationAction = 'back',
  token,
  amount,
  fee = 0,
  mintUrl,
  onReclaim,
  isReclaiming = false,
  lockedToNpub,
  hideDetails = false,
  hideActions = false,
  onClaim,
  isClaiming = false,
  offline = false,
  operationId,
  expiresAt,
  reclaimAt,
  headerStatus = 'pending',
  onCheckStatus,
  isCheckingStatus = false,
  customHeaderRight,
  extraDetails,
}: PendingTokenLayoutProps) {
  const toast = useToastController();
  const { primaryCurrency, secondaryCurrency, npub } = useSettingsStore();
  const theme = useTheme();
  const { setLockDisabled } = useAuthStore();

  const [copied, setCopied] = useState(false);
  const [currentToken, setCurrentToken] = useState<string>(token || '');
  const [qrCodeFragment, setQrCodeFragment] = useState<string>(token || '');
  const [showAnimatedQR, setShowAnimatedQR] = useState(true);
  const [fragmentLength, setFragmentLength] = useState(150);
  const [intervalMs, setIntervalMs] = useState(150);
  const encoderRef = useRef<UREncoder | null>(null);
  const shareSheetRef = useRef<AppBottomSheetRef>(null);
  const pendingNfc = useRef(false);
  const [tokenVersion, setTokenVersion] = useState<'V3' | 'V4'>(
    token?.startsWith('cashuB') ? 'V4' : 'V3',
  );

  const [timeLeftStr, setTimeLeftStr] = useState<string | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setTimeLeftStr(null);
      return;
    }

    const updateTime = () => {
      const diff = expiresAt - Date.now();
      if (diff <= 0) {
        setTimeLeftStr('Expired');
      } else {
        const hours = Math.floor(diff / (60 * 60 * 1000));
        const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
        const secs = Math.floor((diff % (60 * 1000)) / 1000);

        if (hours > 0) {
          setTimeLeftStr(`${hours}h ${mins}m left`);
        } else if (mins > 0) {
          setTimeLeftStr(`${mins}m ${secs}s left`);
        } else {
          setTimeLeftStr(`${secs}s left`);
        }
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const [parsedNpub, setParsedNpub] = useState<string | null>(lockedToNpub || null);

  const MAX_STATIC_QR_LENGTH = 1000;

  const handleNfcShare = () => {
    if (!currentToken) return;
    nfcFlow.openSend({
      token: currentToken,
      amount: Number(amount),
      mintUrl: mintUrl || '',
      operationId,
      fees: fee,
    });
  };

  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
  });

  const fiatValue = React.useMemo(() => {
    if (!btcData?.price) return '...';
    return currencyService.formatValue(
      currencyService.convertSatsToCurrency(Number(amount), btcData.price),
      secondaryCurrency as CurrencyCode,
    );
  }, [amount, btcData?.price, secondaryCurrency]);

  useEffect(() => {
    if (token && token !== currentToken) {
      setCurrentToken(token);
    }
  }, [token]);

  useEffect(() => {
    if (!currentToken || currentToken.startsWith('http')) return;

    try {
      const clean = cleanToken(currentToken);
      const decoded = decodeToken(clean) as any;

      let proofs: any[] = [];
      if (decoded.token && decoded.token.length > 0) proofs = decoded.token[0].proofs;
      else if (decoded.proofs) proofs = decoded.proofs;

      if (!lockedToNpub && proofs.length > 0) {
        const firstSecret = proofs[0]?.secret;
        if (typeof firstSecret === 'string' && firstSecret.startsWith('["P2PK"')) {
          try {
            const parsed = JSON.parse(firstSecret);
            const hexPubkey = parsed[1]?.data;
            if (hexPubkey) setParsedNpub(nip19.npubEncode(hexPubkey));
          } catch (e) {}
        }
      }
    } catch (e) {
      console.error('[PendingTokenLayout] Failed to decode token:', e);
    }
  }, [currentToken, lockedToNpub]);

  useEffect(() => {
    if (!currentToken) return;

    try {
      if (currentToken.startsWith('http')) {
        setQrCodeFragment(currentToken);
        return;
      }

      const clean = cleanToken(currentToken);

      if (showAnimatedQR) {
        const ur = UR.fromBuffer(Buffer.from(clean));
        encoderRef.current = new UREncoder(ur, fragmentLength, 0);
        setQrCodeFragment(encoderRef.current.nextPart());
      } else {
        setQrCodeFragment(clean);
      }
    } catch (e) {
      console.error('[PendingTokenLayout] Failed to setup QR:', e);
      setQrCodeFragment(currentToken);
    }
  }, [currentToken, fragmentLength, showAnimatedQR]);

  useEffect(() => {
    if (!showAnimatedQR || !encoderRef.current) return;
    const interval = setInterval(() => {
      setQrCodeFragment(encoderRef.current!.nextPart());
    }, intervalMs);
    return () => clearInterval(interval);
  }, [showAnimatedQR, intervalMs]);

  const handleCopy = async () => {
    if (currentToken) {
      await Clipboard.setStringAsync(currentToken);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCopied(true);
      toast.show('Token copied to clipboard', { kind: 'success' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (!currentToken) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      setLockDisabled(true);

      const shareMessage = currentToken.startsWith('http')
        ? `Claim my ecash send of ${amount} sat:\n\n${currentToken}`
        : `Claim my ecash send of ${amount} sat:\n\n${Linking.createURL('/(modals)/receive', { queryParams: { scannedToken: currentToken } })}`;

      await RNShare.share({
        message: shareMessage,
        title: 'Share Token',
      });
    } catch (error) {
      handleCopy();
    } finally {
      setTimeout(() => setLockDisabled(false), 1000);
    }
  };

  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublishToWeb = async () => {
    if (!currentToken || currentToken.startsWith('http')) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPublishing(true);
    try {
      const secretKeyBytes = global.crypto.getRandomValues(new Uint8Array(32));
      const secretKeyHex = Buffer.from(secretKeyBytes).toString('hex');

      const { buildEcashNostrEvent } = require('~/shared/utils/ecashSharing');
      const { event } = buildEcashNostrEvent(cleanToken(currentToken), secretKeyHex);

      const { SimplePool } = require('nostr-tools');
      const { getNostrRelays } =
        require('~/state/nostrRelayStore') as typeof import('~/state/nostrRelayStore');
      const pool = new SimplePool();
      const relays = getNostrRelays();
      await Promise.any(pool.publish(relays, event));
      pool.close(relays);

      const websiteUrl = 'https://bey.cash/c/';
      const shareLink = `${websiteUrl}#${secretKeyHex}`;

      setCurrentToken(shareLink);
      toast.show('Token published on bey.cash', { kind: 'success' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      console.error('[PendingTokenLayout] Publish to web failed:', e);
      toast.show('Publish Failed: ' + (e?.message || 'Could not publish to Nostr relays'), {
        kind: 'error',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleToggleVersion = () => {
    if (!currentToken) return;
    try {
      const decoded = decodeToken(currentToken);
      if (tokenVersion === 'V3') {
        const encodedV4 = encodeTokenV4(decoded);
        setCurrentToken(encodedV4);
        setTokenVersion('V4');
        toast.show('Switched to V4 (compact CBOR)', { kind: 'info' });
      } else {
        const encodedV3 = encodeTokenV3(decoded);
        setCurrentToken(encodedV3);
        setTokenVersion('V3');
        toast.show('Switched to V3 (standard JSON)', { kind: 'info' });
      }
    } catch (e) {
      console.error('[PendingTokenLayout] Failed to toggle version:', e);
      toast.show('Cannot convert this token format', { kind: 'error' });
    }
  };

  const displayFee = Number.isFinite(fee) ? fee : 0;

  const displayNpub = lockedToNpub || parsedNpub;

  const pendingTitle =
    headerStatus === 'success'
      ? 'Ecash claimed'
      : headerStatus === 'failed'
        ? 'Payment failed'
        : onClaim
          ? 'Receive ecash'
          : 'Pending ecash';
  return (
    <>
      <PaymentFlowHeader
        title={pendingTitle}
        navigationAction={navigationAction}
        headerRight={customHeaderRight || (() => null)}
      />
      <PaymentStageLayout
        variant="qr"
        hero={
          <>
            {headerStatus !== 'pending' && (
              <PaymentStatusIcon
                status={
                  headerStatus === 'success'
                    ? 'success'
                    : headerStatus === 'failed'
                      ? 'error'
                      : 'pending'
                }
              />
            )}
            <PaymentQRFrame accessibilityLabel="Ecash QR code">
              {(size) =>
                qrCodeFragment ? (
                  qrCodeFragment.length > MAX_STATIC_QR_LENGTH ? (
                    <YStack width={size} height={size} items="center" justify="center" gap="$3">
                      <Gauge size={40} color="$orange10" />
                      <Text color="$gray10" textAlign="center">
                        Token too large. Enable animated QR or use V4 encoding.
                      </Text>
                    </YStack>
                  ) : (
                    <QRCode
                      value={qrCodeFragment}
                      size={size}
                      backgroundColor="white"
                      color="black"
                    />
                  )
                ) : (
                  <YStack width={size} height={size} items="center" justify="center">
                    <Spinner size="large" />
                  </YStack>
                )
              }
            </PaymentQRFrame>
            <PaymentAmount amount={Number(amount)} compact />
          </>
        }
        footer={
          !hideActions && onClaim ? (
            <AppButton
              variant="branded"
              emphasis="primary"
              size="large"
              fullWidth
              loading={isClaiming}
              onPress={onClaim}
              disabled={isClaiming || offline}
            >
              {offline ? 'Claim when online' : 'Claim now'}
            </AppButton>
          ) : (
            <AppButton
              variant="branded"
              emphasis="primary"
              size="large"
              fullWidth
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                shareSheetRef.current?.present();
              }}
            >
              Send
            </AppButton>
          )
        }
      >
        {(!hideDetails || currentToken.startsWith('http')) && (
          <ListTable compact>
            <PaymentStatusRow
              value={
                headerStatus === 'success'
                  ? 'Claimed'
                  : headerStatus === 'failed'
                    ? 'Failed'
                    : onClaim
                      ? 'Unclaimed'
                      : 'Awaiting recipient'
              }
              onRefresh={onCheckStatus}
              checking={isCheckingStatus}
              disabled={isClaiming || isReclaiming}
              valueColor={headerStatus === 'failed' ? '$red10' : undefined}
            />
            {!currentToken.startsWith('http') && (
              <ListTableRow
                label="Token"
                value={
                  currentToken.length > 24
                    ? currentToken.slice(0, 12) + '…' + currentToken.slice(-8)
                    : currentToken
                }
                isCopyable
                copyValue={currentToken}
                onCopy={handleCopy}
              />
            )}
            <YGroup separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
              {currentToken.startsWith('http') && (
                <DetailRowItem
                  label="Web Link"
                  value={`${currentToken.slice(0, 20)}…${currentToken.slice(-8)}`}
                  isCopyable
                  onCopy={async () => {
                    await Clipboard.setStringAsync(currentToken);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    toast.show('Web share link copied', { kind: 'success' });
                  }}
                />
              )}
              {!hideDetails && (
                <>
                  {displayFee > 0 && <DetailRowItem label="Mint Fee" value={`${displayFee} sat`} />}
                  {!!reclaimAt && (
                    <DetailRowItem
                      label="Reclaim eligible"
                      value={new Date(reclaimAt).toLocaleString()}
                    />
                  )}
                  {!!expiresAt && (
                    <DetailRowItem label="Expiry" value={timeLeftStr || 'Checking...'} />
                  )}
                  {displayNpub && (
                    <DetailRowItem
                      label="Locked To"
                      value={
                        displayNpub === npub
                          ? 'You (Safe)'
                          : `${displayNpub.substring(0, 10)}...${displayNpub.substring(displayNpub.length - 6)}`
                      }
                      isCopyable={displayNpub !== npub}
                      onCopy={async () => {
                        await Clipboard.setStringAsync(displayNpub);
                        Haptics.selectionAsync();
                        toast.show('NPUB copied', { kind: 'success' });
                      }}
                    />
                  )}
                  <DetailRowItem
                    label="Mint"
                    value={mintUrl ? mintUrl.replace(/^https?:\/\//, '').split('/')[0] : 'Unknown'}
                  />
                </>
              )}
            </YGroup>
            {extraDetails}
          </ListTable>
        )}
        {onReclaim && !onClaim && (
          <AppButton
            variant="warning"
            emphasis="text-only"
            loading={isReclaiming}
            onPress={onReclaim}
            disabled={isReclaiming || (reclaimAt != null && Date.now() < reclaimAt)}
          >
            Reclaim token
          </AppButton>
        )}
      </PaymentStageLayout>
      <AppBottomSheet
        ref={shareSheetRef}
        backgroundColor="$sheetBackground"
        onClose={() => {
          if (pendingNfc.current) {
            pendingNfc.current = false;
            handleNfcShare();
          }
        }}
      >
        <YStack flex={1} px="$4" gap="$4">
          <XStack items="center" justify="space-between" width="100%" pt="$2">
            <HeaderIconButton
              accessibilityLabel="Close"
              icon={X}
              onPress={() => shareSheetRef.current?.dismiss()}
            />
            <Text flex={1} textAlign="center" fontSize="$6" fontWeight="600" color="$color">
              Share / Send
            </Text>
            <XStack width={36} />
          </XStack>

          <YStack gap="$1" pb="$4">
            {/* System Share */}
            <XStack
              py="$3.5"
              px="$2"
              items="center"
              gap="$4"
              pressStyle={{ opacity: 0.6 }}
              onPress={() => {
                shareSheetRef.current?.dismiss();
                handleShare();
              }}
            >
              <Share2 size={24} color="$color" />
              <Text fontWeight="800" fontSize={17} color="$color" flex={1}>
                Share via App
              </Text>
            </XStack>

            {/* NFC Send */}
            <XStack
              py="$3.5"
              px="$2"
              items="center"
              gap="$4"
              pressStyle={{ opacity: 0.6 }}
              onPress={() => {
                pendingNfc.current = true;
                shareSheetRef.current?.dismiss();
              }}
            >
              <Nfc size={24} color="$color" />
              <Text fontWeight="800" fontSize={17} color="$color" flex={1}>
                NFC Send
              </Text>
            </XStack>

            {/* Publish Web */}
            <XStack
              py="$3.5"
              px="$2"
              items="center"
              gap="$4"
              pressStyle={{ opacity: 0.6 }}
              disabled={isPublishing}
              onPress={() => {
                shareSheetRef.current?.dismiss();
                if (currentToken.startsWith('http')) {
                  Clipboard.setStringAsync(currentToken);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  toast.show('Web share link copied', { kind: 'success' });
                } else {
                  handlePublishToWeb();
                }
              }}
            >
              {isPublishing ? (
                <Spinner size="small" />
              ) : (
                <Globe size={24} color={currentToken.startsWith('http') ? '$green10' : '$color'} />
              )}
              <Text
                fontWeight="800"
                fontSize={17}
                color={currentToken.startsWith('http') ? '$green10' : '$color'}
                flex={1}
              >
                {currentToken.startsWith('http') ? 'Copy Web Link' : 'Publish Web'}
              </Text>
            </XStack>

            {/* Copy Token */}
            <XStack
              py="$3.5"
              px="$2"
              items="center"
              gap="$4"
              pressStyle={{ opacity: 0.6 }}
              onPress={() => {
                shareSheetRef.current?.dismiss();
                handleCopy();
              }}
            >
              {copied ? <Check size={24} color="$green10" /> : <Copy size={24} color="$color" />}
              <Text fontWeight="800" fontSize={17} color={copied ? '$green10' : '$color'} flex={1}>
                {copied ? 'Copied!' : 'Copy Token'}
              </Text>
            </XStack>
          </YStack>
        </YStack>
      </AppBottomSheet>
    </>
  );
}

function DetailRowItem({
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
