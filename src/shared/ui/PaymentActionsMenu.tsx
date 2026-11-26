import React, { useState } from 'react';
import { TechnicalDetailsMenuContext } from './TechnicalDetailsMenuContext';
import { useThemeName } from 'tamagui';
import { BUIActionMenu, type BUIActionMenuItem } from './BUI/BUIActionMenu';
import { BUIAppearanceProvider } from './BUI/useBUITheme';

export type PaymentMenuAction = BUIActionMenuItem & { onPress: () => void };

export function PaymentActionsMenu({
  actions,
  busy = false,
  label = 'Payment actions',
  technicalDetails,
}: {
  actions: PaymentMenuAction[];
  busy?: boolean;
  label?: string;
  technicalDetails?: React.ReactNode;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const menuActions = technicalDetails
    ? [
        ...actions,
        {
          id: 'technical-details',
          title: 'Technical details',
          onPress: () => setDetailsOpen(true),
        },
      ]
    : actions;
  const appearance = useThemeName().startsWith('light') ? 'light' : 'dark';
  if (!menuActions.length) return null;
  return (
    <BUIAppearanceProvider value={appearance}>
      <BUIActionMenu
        label={label}
        headerTrigger
        items={menuActions.map(({ onPress, ...item }) => ({
          ...item,
          disabled: busy || item.disabled,
        }))}
        onAction={(id) => {
          if (!busy) menuActions.find((action) => action.id === id && !action.disabled)?.onPress();
        }}
      />
      <TechnicalDetailsMenuContext.Provider
        value={{ open: detailsOpen, close: () => setDetailsOpen(false) }}
      >
        {technicalDetails}
      </TechnicalDetailsMenuContext.Provider>
    </BUIAppearanceProvider>
  );
}
