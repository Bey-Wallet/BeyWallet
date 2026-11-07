import React from 'react';
import { BUIHeader } from '~/shared/ui/BUI/BUIHeader';

export function PosHeader({
  onBack,
  disabled,
  headerRight,
}: {
  onBack: () => void;
  disabled?: boolean;
  headerRight?: React.ReactNode;
}) {
  return (
    <BUIHeader
      title="Checkout"
      navigation="close"
      navigationLabel="Close point of sale"
      navigationDisabled={disabled}
      onNavigate={onBack}
      actions={headerRight}
      horizontalInset={0}
    />
  );
}
