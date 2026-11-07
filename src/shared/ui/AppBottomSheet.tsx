import React, {
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
  useEffect,
  useLayoutEffect,
  useState,
  createContext,
  useContext,
  useMemo,
} from 'react';
import { StyleSheet, BackHandler, Keyboard, useWindowDimensions } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { Theme, YStack, useTheme, type ThemeName } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { appBorders, appMotion, appRadii, appSpacing } from '~/shared/theme/appearance';
import { BUIHeader } from './BUI/BUIHeader';

// Gorhom portals mount outside local screen contexts. Opt in only when a flow
// has its own palette; ordinary sheets retain their current container.
const BottomSheetThemeContext = createContext<ThemeName | null>(null);
export const AppBottomSheetThemeProvider = BottomSheetThemeContext.Provider;

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
  /** A Gorhom scrollable owns its content measurement instead of BottomSheetView. */
  scrollable?: boolean;
  maxDynamicContentSize?: number;
  /** Standard BUI sheet chrome; the host measures header, body and insets together. */
  title?: string;
  headerActions?: React.ReactNode;
  navigation?: 'back' | 'close';
  navigationLabel?: string;
  onNavigate?: () => void;
  titleLiveRegion?: 'none' | 'polite' | 'assertive';
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
      scrollable = false,
      maxDynamicContentSize,
      title,
      headerActions,
      navigation = 'close',
      navigationLabel,
      onNavigate,
      titleLiveRegion,
    },
    ref,
  ) => {
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const contentTheme = useContext(BottomSheetThemeContext);
    const themedContainer = useMemo(() => {
      if (!contentTheme) return containerComponent;
      return function SheetThemeContainer({ children }: React.PropsWithChildren) {
        return (
          <Theme name={contentTheme}>
            {containerComponent
              ? React.createElement(containerComponent, null, children)
              : children}
          </Theme>
        );
      };
    }, [contentTheme, containerComponent]);
    const [isOpen, setIsOpen] = useState(false);
    const canDismissRef = useRef(canDismiss);
    const dismissRequested = useRef(false);

    useLayoutEffect(() => {
      canDismissRef.current = canDismiss;
    }, [canDismiss]);

    const dismissSheet = useCallback(() => {
      if (!canDismissRef.current) return;
      Keyboard.dismiss();
      dismissRequested.current = true;
      bottomSheetRef.current?.dismiss();
    }, []);

    const handleSheetChanges = useCallback(
      (index: number) => {
        // Animation callbacks may come from a render that was still locked.
        // An approved close must finish without being presented again.
        if (index === -1 && !canDismissRef.current && !dismissRequested.current) {
          bottomSheetRef.current?.present();
          return;
        }
        setIsOpen(index >= 0);
        onOpenChange?.(index >= 0);
        if (index === -1) {
          Keyboard.dismiss();
          onClose?.();
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      },
      [onClose, onOpenChange],
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
        dismissRequested.current = false;
        bottomSheetRef.current?.present();
      },
      dismiss: dismissSheet,
    }));

    // Handle Android back button
    useEffect(() => {
      if (!isOpen) return;

      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        dismissSheet();
        return true;
      });

      return () => backHandler.remove();
    }, [isOpen, dismissSheet]);

    const enableDynamicSizing = !snapPoints;

    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        enablePanDownToClose={enablePanDownToClose && canDismiss}
        enableDynamicSizing={enableDynamicSizing}
        maxDynamicContentSize={maxDynamicContentSize ?? height - Math.max(insets.top, 24)}
        snapPoints={snapPoints}
        bottomInset={bottomInset}
        containerComponent={themedContainer}
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
            : theme.background.val,
          borderRadius: appRadii.sheet,
          borderTopWidth: appBorders.outline,
          borderTopColor: theme.borderColor.val,
        }}
        onChange={handleSheetChanges}
        animationConfigs={{
          duration: appMotion.duration.sheet,
        }}
        containerStyle={{ zIndex: 1000 }}
      >
        {title !== undefined && !scrollable ? (
          <BottomSheetScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + appSpacing.page }}
          >
            <YStack pl={insets.left} pr={insets.right}>
              <BUIHeader
                title={title}
                titleLiveRegion={titleLiveRegion}
                navigation={navigation}
                navigationLabel={navigationLabel}
                navigationDisabled={!canDismiss}
                onNavigate={canDismiss ? (onNavigate ?? dismissSheet) : undefined}
                actions={headerActions}
                divider
              />
            </YStack>
            <YStack
              pl={insets.left + appSpacing.page}
              pr={insets.right + appSpacing.page}
              pt={appSpacing.gap}
              gap={appSpacing.gap}
            >
              {children}
            </YStack>
          </BottomSheetScrollView>
        ) : enableDynamicSizing && !scrollable ? (
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
    paddingBottom: appSpacing.page,
  },
});

export default AppBottomSheet;
