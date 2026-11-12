import React, { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { Keyboard, TextInput, useWindowDimensions, type TextInputProps } from 'react-native';
import { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Theme, YStack } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { appSpacing } from '~/shared/theme/appearance';
import AppBottomSheet, {
  AppBottomSheetThemeProvider,
  type AppBottomSheetRef,
} from '~/shared/ui/AppBottomSheet';
import type { BUIAppearance } from '~/state/buiStore';
import { BUIHeader } from './BUIHeader';
import { BUIInput, type BUIInputProps } from './BUIInput';
import { BUIAppearanceProvider, useBUIOverlayAppearance, useBUITheme } from './useBUITheme';

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
    appearance?: BUIAppearance;
    showHeader?: boolean;
    headerVariant?: 'centered' | 'simple' | 'modal';
    scrollContent?: boolean;
    maxDynamicContentSize?: number;
    actions?: React.ReactNode;
  }
>(function BUISheet(
  {
    title,
    children,
    navigation = 'close',
    onBack,
    onClose,
    canDismiss = true,
    appearance: appearanceOverride,
    showHeader = true,
    headerVariant,
    scrollContent = true,
    maxDynamicContentSize,
    actions,
  },
  ref,
) {
  const inheritedAppearance = useBUIOverlayAppearance();
  const appearance = appearanceOverride ?? inheritedAppearance;
  const c = useBUITheme(appearance);
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
  const content = (
    <>
      {showHeader && (
        <YStack pl={insets.left} pr={insets.right}>
          <BUIHeader
            variant={headerVariant}
            title={title}
            actions={actions}
            navigation={navigation}
            onNavigate={canDismiss ? navigate : undefined}
            navigationDisabled={!canDismiss}
            divider
          />
        </YStack>
      )}
      {scrollContent ? (
        <YStack
          pl={insets.left + appSpacing.page}
          pr={insets.right + appSpacing.page}
          pt={appSpacing.gap}
          gap={appSpacing.gap}
        >
          {children}
        </YStack>
      ) : (
        children
      )}
    </>
  );
  return (
    <BUIAppearanceProvider value={appearance}>
      <Theme name={themeName}>
        <AppBottomSheetThemeProvider value={themeName}>
          <AppBottomSheet
            ref={host}
            backgroundColor={c.canvas}
            canDismiss={canDismiss}
            scrollable
            maxDynamicContentSize={maxDynamicContentSize ?? height - Math.max(insets.top, 24)}
            onClose={() => {
              Keyboard.dismiss();
              onClose?.();
            }}
          >
            {scrollContent ? (
              <BottomSheetScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: insets.bottom + appSpacing.page }}
              >
                <Theme name={themeName}>{content}</Theme>
              </BottomSheetScrollView>
            ) : (
              content
            )}
          </AppBottomSheet>
        </AppBottomSheetThemeProvider>
      </Theme>
    </BUIAppearanceProvider>
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
