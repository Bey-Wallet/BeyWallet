import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { Button, Input, Text, YStack, XStack, Paragraph, useTheme } from 'tamagui';
import { Edit3, Check, X } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import AppBottomSheet, { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { useWalletStore } from '~/state/walletStore';
import { useToastController } from '@tamagui/toast';
import { BottomSheetTextInput, BottomSheetScrollView } from '@gorhom/bottom-sheet';

export interface EditNicknameModalRef {
  present: (mintUrl: string, currentNickname?: string) => void;
  dismiss: () => void;
}

const EditNicknameModal = forwardRef<EditNicknameModalRef>((_, ref) => {
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const theme = useTheme();
  const [nickname, setNickname] = useState('');
  const [mintUrl, setMintUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { setMintNickname } = useWalletStore();
  const toast = useToastController();

  useImperativeHandle(ref, () => ({
    present: (url: string, current?: string) => {
      setMintUrl(url);
      setNickname(current || '');
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const handleSave = async () => {
    if (!mintUrl) return;

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await setMintNickname(mintUrl, nickname.trim());
      toast.show('Nickname Updated', {
        duration: 2000,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sheetRef.current?.dismiss();
    } catch (err: any) {
      toast.show('Error', {
        message: err.message || 'Failed to update nickname',
        duration: 3000,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppBottomSheet ref={sheetRef}>
      <BottomSheetScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <XStack justify="center">
          <Paragraph fontSize="$6" color="$accent5" fontWeight="bold">
            Set Nickname
          </Paragraph>
        </XStack>

        <YStack gap="$2.5">
          <Text color="$gray10" fontSize="$2" px="$2">
            Friendly name for this mint
          </Text>
          <BottomSheetTextInput
            placeholder="e.g. My Favorite Mint"
            value={nickname}
            onChangeText={setNickname}
            style={{
              backgroundColor: theme.color2.val,
              color: theme.color.val,
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: theme.borderColor.val,
              fontSize: 16,
              height: 56,
            }}
            placeholderTextColor={theme.gray10.val}
          />
        </YStack>

        <XStack gap="$3" mt="$2">
          <Button
            flex={1}
            size="$4"
            theme="gray"
            onPress={() => sheetRef.current?.dismiss()}
            icon={<X size={18} />}
          >
            Cancel
          </Button>
          <Button
            flex={1}
            size="$4"
            themeInverse
            onPress={handleSave}
            disabled={isLoading}
            icon={isLoading ? undefined : <Check size={18} />}
          >
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </XStack>
      </BottomSheetScrollView>
    </AppBottomSheet>
  );
});

EditNicknameModal.displayName = 'EditNicknameModal';

export default EditNicknameModal;
