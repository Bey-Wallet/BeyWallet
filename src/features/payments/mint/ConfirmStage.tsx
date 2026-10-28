import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { PaymentMintRow } from '~/shared/ui/PaymentMintRow';
import { AppButton } from '~/shared/ui/AppButton';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import React from 'react';
import { useWalletStore } from '~/state/walletStore';
import * as Haptics from 'expo-haptics';

interface ConfirmStageProps {
  onMintChange?: (url: string) => void;
  amount: string;
  mintUrl: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

export function ConfirmStage({
  amount,
  mintUrl,
  isLoading,
  onConfirm,
  onMintChange,
  onBack,
}: ConfirmStageProps) {
  const { mints } = useWalletStore();
  const activeMint = mints.find(
    (mint) => mint.mintUrl.replace(/\/$/, '') === mintUrl.replace(/\/$/, ''),
  );
  const mintDisplayName =
    activeMint?.nickname ||
    activeMint?.name ||
    (mintUrl ? mintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'Selected Mint');
  return (
    <>
      <PaymentFlowHeader title="Confirm top-up" onBack={onBack} disabled={isLoading} />
      <PaymentStageLayout
        inset={false}
        disabled={isLoading}
        hero={
          <PaymentAmount
            amount={parseInt(amount, 10) || 0}
            label="You're adding"
            size="prominent"
            testID="mint-confirm"
          />
        }
        footer={
          <AppButton
            variant="default"
            emphasis="primary"
            size="large"
            loading={isLoading}
            loadingText="Creating Lightning invoice…"
            fullWidth
            disabled={isLoading}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onConfirm();
            }}
          >
            Create invoice
          </AppButton>
        }
      >
        <ListTable compact>
          {onMintChange ? (
            <PaymentMintRow
              method="mint-lightning"
              mintUrl={mintUrl}
              onSelect={onMintChange}
              disabled={isLoading}
            />
          ) : (
            <ListTableRow label="Mint" value={mintDisplayName} />
          )}
          <ListTableRow label="Method" value="Lightning" />
          <ListTableRow label="Lightning fee" value="Set by paying wallet" />
        </ListTable>
      </PaymentStageLayout>
    </>
  );
}
