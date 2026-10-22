import React, {
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
  useEffect,
  useState,
} from 'react';
import { StyleSheet, BackHandler, Platform } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetBackdropProps,
  BottomSheetModal,
} from '@gorhom/bottom-sheet';
import { useTheme } from 'tamagui';
import * as Haptics from 'expo-haptics';
import { appRadii } from '~/shared/theme/appearance';

interface AppBottomSheetProps {
  children: React.ReactNode;
  snapPoints?: (string | number)[];
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  enablePanDownToClose?: boolean;
  canDismiss?: boolean;
  backgroundColor?: string;
  bottomInset?: number;
  containerComponent?: React.ComponentType<React.PropsWithChildren>;
}

export interface AppBottomSheetRef {
  present: () => void;
  dismiss: () => void;
}

const AppBottomSheet = forwardRef<AppBottomSheetRef, AppBottomSheetProps>(
  (
    {
      children,
      snapPoints,
      onClose,
      onOpenChange,
      enablePanDownToClose = true,
      canDismiss = true,
      backgroundColor,
      bottomInset = 0,
      containerComponent,
    },
    ref,
  ) => {
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const theme = useTheme();
    const [isOpen, setIsOpen] = useState(false);

    const handleSheetChanges = useCallback(
      (index: number) => {
        if (index === -1 && !canDismiss) {
          bottomSheetRef.current?.present();
          return;
        }
        setIsOpen(index >= 0);
        onOpenChange?.(index >= 0);
        if (index === -1) {
          onClose?.();
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      },
      [onClose, onOpenChange, canDismiss],
    );

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior={enablePanDownToClose && canDismiss ? 'close' : 'none'}
          opacity={1}
          style={{ backgroundColor: theme.overlayLight.val }}
        />
      ),
      [enablePanDownToClose, canDismiss, theme.overlayLight.val],
    );

    useImperativeHandle(ref, () => ({
      present: () => {
        bottomSheetRef.current?.present();
      },
      dismiss: () => {
        if (canDismiss) bottomSheetRef.current?.dismiss();
      },
    }));

    // Handle Android back button
    useEffect(() => {
      if (!isOpen) return;

      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (canDismiss) bottomSheetRef.current?.dismiss();
        return true;
      });

      return () => backHandler.remove();
    }, [isOpen, canDismiss]);

    const enableDynamicSizing = !snapPoints;

    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        enablePanDownToClose={enablePanDownToClose && canDismiss}
        enableDynamicSizing={enableDynamicSizing}
        snapPoints={snapPoints}
        bottomInset={bottomInset}
        containerComponent={containerComponent}
        backdropComponent={renderBackdrop}
        stackBehavior="push"
        // Keyboard: sheet expands to fill space above keyboard (works with dynamic sizing)
        keyboardBehavior="fillParent"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        handleIndicatorStyle={{
          backgroundColor: theme.color8.val,
          width: 36,
          height: 4,
        }}
        backgroundStyle={{
          backgroundColor: backgroundColor
            ? theme[backgroundColor.replace('$', '') as keyof typeof theme]?.val || backgroundColor
            : theme.sheetBackground.val,
          borderRadius: appRadii.sheet,
        }}
        onChange={handleSheetChanges}
        animationConfigs={{
          duration: 250,
        }}
        containerStyle={{ zIndex: 1000 }}
      >
        {enableDynamicSizing ? (
          <BottomSheetView style={styles.contentContainer}>{children}</BottomSheetView>
        ) : (
          children
        )}
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  contentContainer: {
    // Extra bottom padding so content clears the home indicator
    paddingBottom: Platform.OS === 'ios' ? 8 : 16,
  },
});

export default AppBottomSheet;
