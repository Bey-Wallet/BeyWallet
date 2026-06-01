import React, { forwardRef } from 'react';
import { AppBottomSheetRef } from '~/components/UI/AppBottomSheet';
import { useSettingsStore } from '~/store/settingsStore';
import { MintSelectorSheet } from '~/components/HomeMintSelector';

export const MintModal = forwardRef<AppBottomSheetRef>((_, ref) => {
    const { setDefaultMintUrl } = useSettingsStore();

    return (
        <MintSelectorSheet ref={ref} onSelect={setDefaultMintUrl} />
    );
});

MintModal.displayName = 'MintModal';
