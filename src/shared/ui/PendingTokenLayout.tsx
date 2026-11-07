import { interactionCopy } from '~/services/feedback/interactionCopy';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { formatPaymentDateTime } from '~/shared/utils/time';
import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import { PaymentQRFrame } from '~/shared/ui/PaymentQRFrame';
import { PaymentStatusIcon } from '~/shared/ui/PaymentStatusIcon';
import { PaymentStatusRow } from '~/shared/ui/PaymentStatusRow';
import { BUIList as ListTable, BUIListItem as ListTableRow } from '~/shared/ui/BUI/BUIList';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { AppButton } from '~/shared/ui/AppButton';
import React, { useEffect, useState, useRef } from 'react';
import { YStack, useThemeName } from 'tamagui';
import { Copy, Share2, Check, Nfc, Send, RefreshCw, Undo2, Info } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { EcashTokenQRCode } from '~/shared/ui/EcashTokenQRCode';

import { Share as RNShare } from 'react-native';
import { useAppToast } from '~/shared/hooks/useAppToast';

import { useSettingsStore } from '~/state/settingsStore';
import { cleanToken, decodeToken } from '~/services/wallet';
import { nip19 } from 'nostr-tools';
import { nfcFlow } from '~/features/nfc/nfcFlow';
import { useAuthStore } from '~/state/authStore';
import { BadgeStatus } from '~/shared/ui/StatusBadge';
import { BUISheet, type BUISheetRef } from '~/shared/ui/BUI/BUISheet';
import { PaymentActionsMenu, type PaymentMenuAction } from '~/shared/ui/PaymentActionsMenu';
import { TokenNostrSheet } from '~/features/payments/send/TokenNostrSheet';

export type PendingPaymentAction = PaymentMenuAction;

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
  menuActions?: PendingPaymentAction[];
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
  menuActions = [],
  extraDetails,
}: PendingTokenLayoutProps) {
  const toast = useAppToast();
  const npub = useSettingsStore((state) => state.npub);
  const { setLockDisabled } = useAuthStore();

  const [copied, setCopied] = useState(false);
  const currentToken = token || '';
  const appearance = useThemeName().startsWith('light') ? 'light' : 'dark';
  const nostrSheet = useRef<BUISheetRef>(null);
  const detailsSheet = useRef<BUISheetRef>(null);
  const [delivering, setDelivering] = useState(false);
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
          : 'Share ecash';
  const busy = isClaiming || isReclaiming || delivering;
  const actions: PendingPaymentAction[] = [
    ...(!hideActions
      ? [
          {
            id: 'share',
            title: 'Share via app',
            icon: <Share2 size={20} color="$color" />,
            onPress: () => void handleShare(),
          },
          {
            id: 'nfc',
            title: 'Send via NFC',
            icon: <Nfc size={20} color="$color" />,
            onPress: handleNfcShare,
          },
          {
            id: 'nostr',
            title: 'Send via Nostr',
            icon: <Send size={20} color="$color" />,
            disabled: offline,
            onPress: () => nostrSheet.current?.present(),
          },
        ]
      : []),
    ...(onClaim && !hideActions
      ? [{ id: 'claim', title: 'Claim now', disabled: offline, onPress: () => void onClaim() }]
      : []),
    ...(onReclaim && !onClaim && !hideActions
      ? [
          {
            id: 'reclaim',
            title: 'Reclaim token',
            icon: <Undo2 size={20} color="$color" />,
            disabled: offline || (reclaimAt != null && Date.now() < reclaimAt),
            onPress: () => void onReclaim(),
          },
        ]
      : []),
    ...(onCheckStatus
      ? [
          {
            id: 'refresh',
            title: 'Refresh status',
            icon: <RefreshCw size={20} color="$color" />,
            disabled: offline || isCheckingStatus,
            onPress: () => void onCheckStatus(),
          },
        ]
      : []),
    ...(!hideDetails
      ? [
          {
            id: 'details',
            title: 'Payment details',
            icon: <Info size={20} color="$color" />,
            onPress: () => detailsSheet.current?.present(),
          },
        ]
      : []),
    ...menuActions,
  ];
  const details = (
    <ListTable compact variant="filled">
      <PaymentStatusRow
        status={
          headerStatus === 'failed' ? 'error' : headerStatus === 'success' ? 'success' : 'pending'
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
        disabled={offline || busy}
      />
      <ListTableRow
        label="Token"
        value={
          currentToken.length > 24
            ? `${currentToken.slice(0, 12)}…${currentToken.slice(-8)}`
            : currentToken
        }
      />
      {displayFee > 0 && <ListTableRow label="Mint fee" value={`${displayFee} sat`} />}
      {!!reclaimAt && (
        <ListTableRow label="Reclaim eligible" value={formatPaymentDateTime(reclaimAt)} />
      )}
      {!!expiresAt && <ListTableRow label="Expiry" value={timeLeftStr || 'Checking…'} />}
      {displayNpub && (
        <ListTableRow
          label="Locked to"
          value={
            displayNpub === npub ? 'You' : `${displayNpub.slice(0, 10)}…${displayNpub.slice(-6)}`
          }
        />
      )}
      <ListTableRow
        label="Mint"
        value={mintUrl ? mintUrl.replace(/^https?:\/\//, '').split('/')[0] : 'Unknown'}
      />
    </ListTable>
  );
  return (
    <>
      <PaymentFlowHeader
        title={pendingTitle}
        navigationAction={navigationAction}
        disabled={busy}
        headerRight={() => <PaymentActionsMenu actions={actions} busy={busy} />}
      />
      <PaymentStageLayout
        variant="qr"
        hero={
          <>
            {headerStatus !== 'pending' && (
              <PaymentStatusIcon status={headerStatus === 'success' ? 'success' : 'error'} />
            )}
            <PaymentQRFrame accessibilityLabel="Ecash QR code">
              {(size) => <EcashTokenQRCode token={cleanToken(currentToken)} size={size} />}
            </PaymentQRFrame>
            <PaymentAmount
              amount={Number(amount)}
              size={headerStatus === 'pending' ? 'standard' : 'prominent'}
              compact
            />
          </>
        }
        footer={
          <AppButton
            variant="default"
            emphasis="secondary"
            size="large"
            fullWidth
            icon={copied ? Check : Copy}
            disabled={busy || !currentToken}
            onPress={handleCopy}
          >
            {copied ? 'Copied' : 'Copy'}
          </AppButton>
        }
      >
        {!hideDetails && details}
      </PaymentStageLayout>
      <BUISheet
        ref={detailsSheet}
        title="Payment details"
        appearance={appearance}
        canDismiss={!busy}
      >
        <YStack px={16} gap={12}>
          {details}
          {extraDetails}
        </YStack>
      </BUISheet>
      <TokenNostrSheet
        ref={nostrSheet}
        token={currentToken}
        disabled={offline || isClaiming || isReclaiming}
        appearance={appearance}
        onBusyChange={setDelivering}
      />
    </>
  );
}
