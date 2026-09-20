import React, { forwardRef } from 'react';
import { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { useSettingsStore } from '~/state/settingsStore';
import { MintSelectorSheet } from '~/shared/ui/HomeMintSelector';

export const MintModal = forwardRef<AppBottomSheetRef>((_, ref) => {
  const { setDefaultMintUrl } = useSettingsStore();

  return <MintSelectorSheet ref={ref} onSelect={setDefaultMintUrl} />;
});

MintModal.displayName = 'MintModal';
