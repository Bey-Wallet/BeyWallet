import { BUIHeader } from './BUI/BUIHeader';
import React from 'react';
import { KeyboardAvoidingView, Modal, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack } from 'tamagui';
import { appSpacing } from '~/shared/theme/appearance';

interface AppFullScreenModalProps {
  visible: boolean;
  animationType?: 'none' | 'slide' | 'fade';
  title: string;
  onClose: () => void;
  onDismiss?: () => void;
  onBack?: () => void;
  canDismiss?: boolean;
  closeLabel?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

/** Native modal presentation; each flow continues to own its operation and dismissal guards. */
export function AppFullScreenModal({
  visible,
  animationType = 'slide',
  title,
  onClose,
  onDismiss,
  onBack,
  canDismiss = true,
  closeLabel = 'Close',
  headerRight,
  children,
}: AppFullScreenModalProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      presentationStyle="fullScreen"
      animationType={animationType}
      onDismiss={onDismiss}
      onRequestClose={() => {
        if (canDismiss) onClose();
      }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <YStack flex={1} bg="$background" pt={insets.top + appSpacing.gap} pb={insets.bottom}>
          <BUIHeader
            title={title}
            navigation={onBack ? 'back' : 'close'}
            navigationLabel={onBack ? 'Back' : closeLabel}
            navigationDisabled={!canDismiss}
            onNavigate={() => {
              if (canDismiss) (onBack ?? onClose)();
            }}
            actions={headerRight}
          />
          {children}
        </YStack>
      </KeyboardAvoidingView>
    </Modal>
  );
}
