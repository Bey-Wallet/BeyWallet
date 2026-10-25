import React from 'react';
import { AppFullScreenModal } from '~/shared/ui/AppFullScreenModal';
import { SupporterContent } from './SupporterContent';

export function SupporterModal({
  visible,
  animationType,
  onClose,
  onDoNotShowAgain,
}: {
  visible: boolean;
  animationType: 'none' | 'slide';
  onClose: () => void;
  onDoNotShowAgain: () => void;
}) {
  return (
    <AppFullScreenModal
      visible={visible}
      title="Support Bey"
      closeLabel="Close supporter preview"
      animationType={animationType}
      onClose={onClose}
    >
      {visible && <SupporterContent onClose={onClose} onDoNotShowAgain={onDoNotShowAgain} />}
    </AppFullScreenModal>
  );
}
