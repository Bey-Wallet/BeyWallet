import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Text, YStack, useTheme } from 'tamagui';
import AppBottomSheet, { type AppBottomSheetRef } from './AppBottomSheet';
import { AppButton } from './AppButton';

export interface InputSheetRef {
  present: (value: string) => void;
}

/** Edits a local draft; dismissing the sheet leaves the saved value intact. */
export const InputSheet = forwardRef<
  InputSheetRef,
  {
    title: string;
    placeholder?: string;
    maxLength?: number;
    onSave: (value: string) => void;
  }
>(({ title, placeholder, maxLength, onSave }, ref) => {
  const sheet = useRef<AppBottomSheetRef>(null);
  const [draft, setDraft] = useState('');
  const theme = useTheme();
  useImperativeHandle(ref, () => ({
    present: (value) => {
      setDraft(value);
      sheet.current?.present();
    },
  }));
  const save = () => {
    Keyboard.dismiss();
    sheet.current?.dismiss();
    onSave(draft.trim());
  };
  return (
    <AppBottomSheet ref={sheet} onClose={Keyboard.dismiss}>
      <YStack p="$4" gap="$4">
        <Text fontSize={20} fontWeight="600" color="$color">
          {title}
        </Text>
        <BottomSheetTextInput
          accessibilityLabel={title}
          placeholder={placeholder}
          placeholderTextColor={theme.gray10.val}
          value={draft}
          onChangeText={setDraft}
          maxLength={maxLength}
          returnKeyType="done"
          onSubmitEditing={save}
          style={{
            color: theme.color.val,
            backgroundColor: theme.gray3.val,
            borderRadius: 12,
            padding: 16,
            fontSize: 16,
            fontFamily: 'InterTextRegular',
          }}
        />
        <AppButton size="large" fullWidth onPress={save}>
          Done
        </AppButton>
      </YStack>
    </AppBottomSheet>
  );
});
InputSheet.displayName = 'InputSheet';
