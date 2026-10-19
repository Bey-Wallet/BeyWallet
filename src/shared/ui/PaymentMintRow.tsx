import React, { useRef } from 'react';
import { ChevronDown } from '@tamagui/lucide-icons';
import { ListTableRow } from '~/shared/ui/ListTable';
import { MintSelectorSheet } from '~/shared/ui/HomeMintSelector';
import type { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { useWalletStore } from '~/state/walletStore';
import type { PaymentMintMethod } from '~/services/wallet/paymentMintPolicy';

export function PaymentMintRow({
  mintUrl,
  onSelect,
  disabled,
  label = 'Mint',
  allowedMintUrls,
  method,
}: {
  mintUrl: string;
  onSelect: (url: string) => void;
  disabled?: boolean;
  label?: string;
  allowedMintUrls?: string[];
  method?: PaymentMintMethod;
}) {
  const sheet = useRef<AppBottomSheetRef>(null);
  const mints = useWalletStore((s) => s.mints);
  const mint = mints.find((m) => m.mintUrl === mintUrl);
  return (
    <>
      <ListTableRow
        label={label}
        value={mint?.nickname || mint?.name || mintUrl.replace(/^https?:\/\//, '')}
        disabled={disabled}
        onPress={() => sheet.current?.present()}
        rightContent={<ChevronDown size={16} color="$gray10" />}
      />
      <MintSelectorSheet
        ref={sheet}
        activeMintUrl={mintUrl}
        onSelect={(url) => {
          if (!disabled) onSelect(url);
        }}
        showAllOption={false}
        changeGlobalActiveMint={false}
        trustedOnly
        allowedMintUrls={allowedMintUrls}
        method={method}
      />
    </>
  );
}
