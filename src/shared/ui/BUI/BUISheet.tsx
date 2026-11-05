import React, { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { Keyboard, TextInput, useWindowDimensions, type TextInputProps } from 'react-native';
import { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Theme, YStack } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBottomSheet, {
  AppBottomSheetThemeProvider,
  type AppBottomSheetRef,
} from '~/shared/ui/AppBottomSheet';
import { useBUIStore } from '~/state/buiStore';
import { BUIHeader } from './BUIHeader';
import { BUIInput, type BUIInputProps } from './BUIInput';
import { useBUITheme } from './useBUITheme';

export type BUISheetRef = AppBottomSheetRef;

export const BUISheet = forwardRef<
  BUISheetRef,
  {
    title: string;
    children: React.ReactNode;
    navigation?: 'back' | 'close';
    onBack?: () => void;
    onClose?: () => void;
    canDismiss?: boolean;
  }
>(function BUISheet(
  { title, children, navigation = 'close', onBack, onClose, canDismiss = true },
  ref,
) {
  const appearance = useBUIStore((state) => state.appearance);
  const c = useBUITheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const host = useRef<AppBottomSheetRef>(null);
  const themeName = appearance === 'light' ? 'light_bui' : 'dark_bui';
  useImperativeHandle(
    ref,
    () => ({
      present: () => {
        Keyboard.dismiss();
        host.current?.present();
      },
      dismiss: () => {
        if (canDismiss) {
          Keyboard.dismiss();
          host.current?.dismiss();
        }
      },
    }),
    [canDismiss],
  );
  const navigate = () => {
    if (!canDismiss) return;
    if (navigation === 'back' && onBack) onBack();
    else {
      Keyboard.dismiss();
      host.current?.dismiss();
    }
  };
  return (
    <Theme name={themeName}>
      <AppBottomSheetThemeProvider value={themeName}>
        <AppBottomSheet
          ref={host}
          backgroundColor={c.canvas}
          canDismiss={canDismiss}
          scrollable
          maxDynamicContentSize={height * 0.85}
          onClose={() => {
            Keyboard.dismiss();
            onClose?.();
          }}
        >
          <BottomSheetScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: Math.max(16, insets.bottom) }}
          >
            <Theme name={themeName}>
              <BUIHeader
                title={title}
                navigation={navigation}
                onNavigate={canDismiss ? navigate : undefined}
                divider
              />
              <YStack gap={16}>{children}</YStack>
            </Theme>
          </BottomSheetScrollView>
        </AppBottomSheet>
      </AppBottomSheetThemeProvider>
    </Theme>
  );
});

// Normalize Gorhom's optional Gesture Handler input ref to the native input contract.
const SheetNativeInput = forwardRef<TextInput, TextInputProps>(
  function SheetNativeInput(props, ref) {
    const attach = useCallback(
      (node: React.ComponentRef<typeof BottomSheetTextInput> | null) => {
        if (typeof ref === 'function') ref(node ?? null);
        else if (ref) ref.current = node ?? null;
      },
      [ref],
    );
    return <BottomSheetTextInput {...props} ref={attach} />;
  },
);

export const BUISheetInput = forwardRef<TextInput, Omit<BUIInputProps, 'inputComponent'>>(
  function BUISheetInput(props, ref) {
    return <BUIInput {...props} ref={ref} inputComponent={SheetNativeInput} />;
  },
);
