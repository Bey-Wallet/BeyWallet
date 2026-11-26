import React, { useState } from 'react';
import { Modal, Share } from 'react-native';
import { ScrollView, Text, XStack, YStack } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { AppButton } from '~/shared/ui/AppButton';
import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import { Check, Copy, Share2, X } from '~/shared/icons';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { interactionCopy } from '~/services/feedback/interactionCopy';

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
  const toast = useAppToast();
  const [copied, setCopied] = useState(false);
  const copyUrl = async () => {
    if (await copyWithFeedback(url, toast)) setCopied(true);
  };
  const shareUrl = async () => {
    try {
      await Share.share({ message: url });
    } catch {
      toast.showFeedback(interactionCopy.shareFailed);
    }
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      onShow={() => setCopied(false)}
    >
      <YStack
        flex={1}
        bg="$background"
        pt={insets.top + 16}
        pb={insets.bottom + 16}
        accessibilityViewIsModal
      >
        <XStack px="$4">
          <HeaderIconButton icon={X} accessibilityLabel="Close QR" onPress={onClose} />
        </XStack>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <YStack items="center" justify="center" p="$4" gap="$4">
            <Text fontSize={18} fontWeight="600">
              Mint URL
            </Text>
            <YStack p="$4" bg="white" rounded="$6">
              <QRCode value={url} size={240} color="black" backgroundColor="white" />
            </YStack>
            <Text selectable textAlign="center">
              {url}
            </Text>
            <XStack gap="$3" justify="center">
              <AppButton
                variant="default"
                emphasis="secondary"
                size="medium"
                icon={copied ? Check : Copy}
                onPress={() => void copyUrl()}
              >
                {copied ? 'Copied' : 'Copy'}
              </AppButton>
              <AppButton
                variant="default"
                emphasis="secondary"
                size="medium"
                icon={Share2}
                onPress={() => void shareUrl()}
              >
                Share
              </AppButton>
            </XStack>
          </YStack>
        </ScrollView>
      </YStack>
    </Modal>
  );
}
