import React from 'react';
import { KeyboardAvoidingView, Modal, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';
import { ArrowLeft, X } from '@tamagui/lucide-icons';
import { appSpacing } from '~/shared/theme/appearance';
import { HeaderIconButton } from './HeaderIconButton';

interface AppFullScreenModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  onBack?: () => void;
  canDismiss?: boolean;
  closeLabel?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

/** Native modal presentation; each flow continues to own its operation and dismissal guards. */
export function AppFullScreenModal({
  visible,
  title,
  onClose,
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
      animationType="slide"
      onRequestClose={() => {
        if (canDismiss) onClose();
      }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <YStack flex={1} bg="$background" pt={insets.top + appSpacing.gap} pb={insets.bottom}>
          <XStack px="$4" py="$2" items="center" gap="$3">
            <HeaderIconButton
              accessibilityLabel={onBack ? 'Back' : closeLabel}
              icon={onBack ? ArrowLeft : X}
              disabled={!canDismiss}
              onPress={() => {
                if (canDismiss) (onBack ?? onClose)();
              }}
            />
            <Text
              accessibilityRole="header"
              flex={1}
              textAlign="center"
              fontFamily="$heading"
              fontSize="$6"
              fontWeight="500"
              color="$color"
            >
              {title}
            </Text>
            {headerRight ?? <View width={40} />}
          </XStack>
          {children}
        </YStack>
      </KeyboardAvoidingView>
    </Modal>
  );
}
