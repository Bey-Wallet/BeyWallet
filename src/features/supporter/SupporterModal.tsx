import React, { useRef } from 'react';
import { Platform } from 'react-native';
import { AppFullScreenModal } from '~/shared/ui/AppFullScreenModal';
import { SupporterContent } from './SupporterContent';

export function SupporterModal({
  visible,
  animationType,
  onClose,
  onPay,
  onDoNotShowAgain,
}: {
  visible: boolean;
  animationType: 'none' | 'slide';
  onClose: () => void;
  onPay: () => void;
  onDoNotShowAgain: () => void;
}) {
  const pendingPayment = useRef(false);
  const finishDismiss = () => {
    if (!pendingPayment.current) return;
    pendingPayment.current = false;
    onPay();
  };
  return (
    <AppFullScreenModal
      visible={visible}
      title="Support Bey"
      closeLabel="Close support"
      animationType={animationType}
      onClose={onClose}
      onDismiss={finishDismiss}
    >
      {visible && (
        <SupporterContent
          onPay={() => {
            pendingPayment.current = true;
            onClose();
            if (Platform.OS !== 'ios') finishDismiss();
          }}
          onDoNotShowAgain={onDoNotShowAgain}
        />
      )}
    </AppFullScreenModal>
  );
}
