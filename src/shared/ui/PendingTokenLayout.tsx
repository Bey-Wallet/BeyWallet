import { interactionCopy } from '~/services/feedback/interactionCopy';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { formatPaymentDateTime } from '~/shared/utils/time';
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
import { YStack, XStack, Text, YGroup } from 'tamagui';
import { Copy, Share2, Check, Nfc, X } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { AnimatedTokenQRCode } from '~/shared/ui/AnimatedTokenQRCode';

import { Share as RNShare } from 'react-native';
import { useAppToast } from '~/shared/hooks/useAppToast';

import { useSettingsStore } from '~/state/settingsStore';
import { cleanToken, decodeToken } from '~/services/wallet';
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
  const toast = useAppToast();
  const npub = useSettingsStore((state) => state.npub);
  const { setLockDisabled } = useAuthStore();

  const [copied, setCopied] = useState(false);
  const currentToken = token || '';
  const shareSheetRef = useRef<AppBottomSheetRef>(null);
  const pendingNfc = useRef(false);
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

  const handleCopy = async () => {
    if (currentToken) {
      if (!(await copyWithFeedback(currentToken, toast))) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCopied(true);
      toast.showFeedback(interactionCopy.ecashCopied);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (!currentToken) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      setLockDisabled(true);

      await RNShare.share({
        message: `cashu:${cleanToken(currentToken)}`,
        title: 'Share Token',
      });
    } catch (error) {
      toast.showFeedback(interactionCopy.shareFailed);
    } finally {
      setTimeout(() => setLockDisabled(false), 1000);
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
          : 'Ecash ready to share';
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
              {(size) => <AnimatedTokenQRCode token={cleanToken(currentToken)} size={size} />}
            </PaymentQRFrame>
            <PaymentAmount
              amount={Number(amount)}
              size={
                headerStatus === 'success' || headerStatus === 'failed' ? 'prominent' : 'standard'
              }
              compact
            />
          </>
        }
        footer={
          !hideActions && onClaim ? (
            <AppButton
              variant="default"
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
              variant="default"
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
        {!hideDetails && (
          <ListTable compact>
            <PaymentStatusRow
              status={
                headerStatus === 'failed'
                  ? 'error'
                  : headerStatus === 'success'
                    ? 'success'
                    : 'pending'
              }
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
            <YGroup separator={<YStack height={2} width="100%" bg="$background" />}>
              {!hideDetails && (
                <>
                  {displayFee > 0 && <DetailRowItem label="Mint Fee" value={`${displayFee} sat`} />}
                  {!!reclaimAt && (
                    <DetailRowItem
                      label="Reclaim eligible"
                      value={formatPaymentDateTime(reclaimAt)}
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
                        if (!(await copyWithFeedback(displayNpub, toast))) return;
                        Haptics.selectionAsync();
                        toast.showFeedback(interactionCopy.publicKeyCopied);
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
            emphasis="text"
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
