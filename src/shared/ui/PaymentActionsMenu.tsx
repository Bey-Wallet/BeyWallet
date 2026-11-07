import React from 'react';
import { useThemeName } from 'tamagui';
import { BUIActionMenu, type BUIActionMenuItem } from './BUI/BUIActionMenu';
import { BUIAppearanceProvider } from './BUI/useBUITheme';

export type PaymentMenuAction = BUIActionMenuItem & { onPress: () => void };

export function PaymentActionsMenu({
  actions,
  busy = false,
  label = 'Payment actions',
}: {
  actions: PaymentMenuAction[];
  busy?: boolean;
  label?: string;
}) {
  const appearance = useThemeName().startsWith('light') ? 'light' : 'dark';
  return (
    <BUIAppearanceProvider value={appearance}>
      <BUIActionMenu
        label={label}
        headerTrigger
        items={actions.map(({ onPress, ...item }) => ({
          ...item,
          disabled: busy || item.disabled,
        }))}
        onAction={(id) => {
          if (!busy) actions.find((action) => action.id === id && !action.disabled)?.onPress();
        }}
      />
    </BUIAppearanceProvider>
  );
}
