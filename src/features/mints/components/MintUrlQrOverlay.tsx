import React from 'react';
import { Modal } from 'react-native';
import { ScrollView, Text, YStack } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { AppButton } from '~/shared/ui/AppButton';

export function MintUrlQrOverlay({
  url,
  visible,
  onClose,
}: {
  url: string;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <YStack
        flex={1}
        bg="$background"
        pt={insets.top + 16}
        pb={insets.bottom + 16}
        accessibilityViewIsModal
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <YStack items="center" justify="center" p="$4" gap="$4">
            <Text fontSize={20} fontWeight="600">
              Mint URL
            </Text>
            <YStack p="$4" bg="white" rounded="$6">
              <QRCode value={url} size={240} color="black" backgroundColor="white" />
            </YStack>
            <Text selectable textAlign="center">
              {url}
            </Text>
            <AppButton variant="default" emphasis="secondary" size="medium" onPress={onClose}>
              Close QR
            </AppButton>
          </YStack>
        </ScrollView>
      </YStack>
    </Modal>
  );
}
