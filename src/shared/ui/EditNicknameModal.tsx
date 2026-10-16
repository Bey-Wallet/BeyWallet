import { AppButton } from '~/shared/ui/AppButton';
import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { Input, Text, YStack, XStack, Paragraph, useTheme } from 'tamagui';
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
      toast.show(err.message || 'Failed to update nickname', { duration: 3000, kind: 'error' });
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
              fontVariant: ['tabular-nums'],
              height: 56,
            }}
            placeholderTextColor={theme.gray10.val}
          />
        </YStack>

        <XStack gap="$3" mt="$2">
          <AppButton
            variant="default"
            emphasis="secondary"
            size="medium"
            icon={<X size={18} />}
            flex={1}
            onPress={() => sheetRef.current?.dismiss()}
          >
            Cancel
          </AppButton>
          <AppButton
            variant="branded"
            emphasis="primary"
            size="medium"
            loading={isLoading}
            icon={isLoading ? undefined : <Check size={18} />}
            flex={1}
            onPress={handleSave}
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save'}
          </AppButton>
        </XStack>
      </BottomSheetScrollView>
    </AppBottomSheet>
  );
});

EditNicknameModal.displayName = 'EditNicknameModal';

export default EditNicknameModal;
