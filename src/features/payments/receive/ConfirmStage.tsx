import { interactionCopy } from '~/services/feedback/interactionCopy';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { FirstUseGuidance } from '~/shared/ui/FirstUseGuidance';

import { AppButton } from '~/shared/ui/AppButton';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import React from 'react';
import { Text } from 'tamagui';
import { RefreshCw } from '@tamagui/lucide-icons';

import * as Haptics from 'expo-haptics';

import { useAppToast } from '~/shared/hooks/useAppToast';
import { useWalletStore } from '~/state/walletStore';
import { mintManager, proofService } from '~/services/wallet';
import { useSettingsStore } from '~/state/settingsStore';

interface TokenInfo {
  mint: string;
  memo?: string;
  amount: number;
  proofCount: number;
  preview?: {
    name?: string;
    description?: string;
  };
  p2pkNpub?: string;
}

interface ConfirmStageProps {
  token: string;
  tokenInfo: TokenInfo;
  isLoading?: boolean;
  onConfirm: () => void;
  onReceiveLater: () => void;
  onBack: () => void;
  offline?: boolean;
  navigationAction?: 'back' | 'close';
}

export function ConfirmStage({
  token,
  tokenInfo,
  isLoading,
  onConfirm,
  onReceiveLater,
  onBack,
  offline = false,
  navigationAction = 'back',
}: ConfirmStageProps) {
  const { mints } = useWalletStore();
  const npub = useSettingsStore((state) => state.npub);
  const toast = useAppToast();
  const [isSavingLater, setIsSavingLater] = React.useState(false);
  const [estimatedFee, setEstimatedFee] = React.useState(0);

  // ── Proof state verification (NUT-07) ────────────────────────────
  type ProofStatus = 'checking' | 'valid' | 'spent' | 'pending' | 'unknown';
  const [proofStatus, setProofStatus] = React.useState<ProofStatus>('checking');
  const [statusRefresh, setStatusRefresh] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    if (offline) {
      setProofStatus('unknown');
      return;
    }
    setProofStatus('checking');
    (async () => {
      try {
        const states = await proofService.checkProofStates(token);
        if (cancelled) return;
        if (!states || states.length === 0) {
          setProofStatus('unknown');
          return;
        }
        setProofStatus(
          states.some((state) => state.state === 'SPENT')
            ? 'spent'
            : states.some((state) => state.state === 'PENDING')
              ? 'pending'
              : states.every((state) => state.state === 'UNSPENT')
                ? 'valid'
                : 'unknown',
        );
      } catch {
        if (!cancelled) setProofStatus('unknown');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, statusRefresh, offline]);
  // ─────────────────────────────────────────────────────────────────

  const [expiresAt, setExpiresAt] = React.useState<number | undefined>(undefined);
  const [timeLeftStr, setTimeLeftStr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { decodeToken } = require('~/services/wallet/tokenUtils');
        const decoded = decodeToken(token);
        const secrets = (decoded.proofs || []).map((p: any) => p.secret);
        if (secrets.length > 0) {
          const { expiryService } = require('~/services/wallet/expiryService');
          const expiryInfo = await expiryService.getExpiryBySecrets(secrets);
          if (!cancelled && expiryInfo) {
            setExpiresAt(expiryInfo.expiresAt);
          }
        }
      } catch (e) {
        console.warn('[ConfirmStage] Failed to check local token expiry:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  React.useEffect(() => {
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

  // Fetch fee for this mint
  React.useEffect(() => {
    if (offline) {
      setEstimatedFee(0);
      return;
    }
    if (tokenInfo.mint) {
      mintManager
        .getFeePpk(tokenInfo.mint)
        .then((feePpk) => {
          const fee = feePpk > 0 ? Math.ceil((tokenInfo.proofCount * feePpk) / 1000) : 0;
          setEstimatedFee(fee);
        })
        .catch(() => setEstimatedFee(0));
    }
  }, [tokenInfo.mint, tokenInfo.proofCount, offline]);

  // Check if mint is trusted
  const normalizeUrl = (url: string) => url.replace(/\/$/, '').toLowerCase();
  const isMintTrusted = mints.some(
    (m) => normalizeUrl(m.mintUrl) === normalizeUrl(tokenInfo.mint) && m.trusted,
  );

  // Get mint display name
  const getMintDisplayName = (url: string) => {
    if (tokenInfo.preview?.name) return tokenInfo.preview.name;
    const storedMint = mints.find((m) => normalizeUrl(m.mintUrl) === normalizeUrl(url));
    if (storedMint?.name) return storedMint.name;
    try {
      return new URL(url).hostname;
    } catch {
      return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    }
  };

  const handleCopy = async (text: string, label: string) => {
    if (!(await copyWithFeedback(text, toast))) return;
    toast.showFeedback(interactionCopy.copiedToClipboard);
    Haptics.selectionAsync();
  };

  return (
    <>
      <PaymentFlowHeader
        title="Confirm receive"
        navigationAction={navigationAction}
        onBack={onBack}
        disabled={isLoading || isSavingLater}
      />
      <PaymentStageLayout
        disabled={isLoading || isSavingLater}
        hero={<PaymentAmount amount={tokenInfo.amount} size="prominent" label="You're receiving" />}
        footer={
          <AppButton
            variant="branded"
            emphasis="primary"
            size="large"
            loading={isLoading || isSavingLater}
            loadingText={offline ? 'Saving ecash…' : 'Receiving ecash…'}
            disabled={
              isLoading ||
              isSavingLater ||
              (!offline && (proofStatus === 'checking' || proofStatus === 'spent'))
            }
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              if (offline) {
                if (isSavingLater) return;
                setIsSavingLater(true);
                Promise.resolve(onReceiveLater()).finally(() => setIsSavingLater(false));
              } else onConfirm();
            }}
          >
            {offline
              ? 'Save & claim later'
              : isLoading
                ? 'Receiving...'
                : proofStatus === 'spent'
                  ? 'Already spent'
                  : isMintTrusted
                    ? 'Receive'
                    : 'Trust & Receive'}
          </AppButton>
        }
      >
        {offline && <FirstUseGuidance topic="offlineTokens" />}
        {!offline && (
          <AppButton
            variant="default"
            emphasis="text-only"
            flex={1}
            size="small"
            loading={isSavingLater}
            disabled={isLoading || isSavingLater}
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setIsSavingLater(true);
              try {
                await onReceiveLater();
              } finally {
                setIsSavingLater(false);
              }
            }}
          >
            {isSavingLater ? 'Saving...' : 'Claim Later'}
          </AppButton>
        )}
        {offline && (
          <Text color="$gray10" fontSize="$3" textAlign="center">
            You’re offline. Save this token on your device and claim it from History when you’re
            online. Your balance won’t change until the mint confirms the claim.
          </Text>
        )}
        <ListTable compact>
          {tokenInfo.memo?.trim() && (
            <ListTableRow
              label="Note"
              value={tokenInfo.memo}
              isCopyable
              copyValue={tokenInfo.memo}
              multiline
            />
          )}
          <ListTableRow label="Mint" value={getMintDisplayName(tokenInfo.mint)} />
          <ListTableRow
            label="Status"
            value={
              offline
                ? 'Unverified · offline'
                : proofStatus === 'checking'
                  ? 'Checking…'
                  : proofStatus === 'valid'
                    ? 'Unspent'
                    : proofStatus === 'spent'
                      ? 'Already spent'
                      : proofStatus === 'pending'
                        ? 'Pending'
                        : 'Unverified'
            }
            valueColor={proofStatus === 'spent' ? '$red10' : undefined}
            rightContent={
              <AppIconButton
                variant="default"
                emphasis="tertiary"
                size="xxsmall"
                accessibilityLabel="Refresh status"
                disabled={offline || isLoading || isSavingLater || proofStatus === 'checking'}
                loading={!offline && proofStatus === 'checking'}
                icon={<RefreshCw size={16} color="$gray10" />}
                onPress={() => {
                  if (offline || isLoading || isSavingLater || proofStatus === 'checking') return;
                  setProofStatus('checking');
                  setStatusRefresh((value) => value + 1);
                }}
              />
            }
          />
          {!offline && estimatedFee > 0 && (
            <ListTableRow label="Estimated fee" value={`${estimatedFee} sat`} />
          )}
          {tokenInfo.p2pkNpub && (
            <ListTableRow
              label="Locked To"
              value={
                tokenInfo.p2pkNpub === npub
                  ? 'You (Safe)'
                  : `${tokenInfo.p2pkNpub.substring(0, 10)}...${tokenInfo.p2pkNpub.substring(tokenInfo.p2pkNpub.length - 6)}`
              }
              isCopyable={tokenInfo.p2pkNpub !== npub}
              onCopy={() => handleCopy(tokenInfo.p2pkNpub!, 'NPUB')}
            />
          )}
          {expiresAt && <ListTableRow label="Expiry" value={timeLeftStr || 'Checking...'} />}
        </ListTable>
        {!isMintTrusted && (
          <Text color="$orange10" fontSize="$2" textAlign="center">
            {offline
              ? 'Saving does not add or trust this mint. Review it when claiming online.'
              : 'Receiving will add and trust this mint.'}
          </Text>
        )}
      </PaymentStageLayout>
    </>
  );
}
