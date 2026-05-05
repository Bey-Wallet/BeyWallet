import React, { useCallback, useRef, forwardRef, useImperativeHandle, useEffect, useState } from "react";
import { StyleSheet, BackHandler, Platform } from "react-native";
import {
    BottomSheetBackdrop,
    BottomSheetView,
    BottomSheetBackdropProps,
    BottomSheetModal,
} from "@gorhom/bottom-sheet";
import { useTheme } from "tamagui";
import * as Haptics from "expo-haptics";

interface AppBottomSheetProps {
    children: React.ReactNode;
    snapPoints?: (string | number)[];
    onClose?: () => void;
    enablePanDownToClose?: boolean;
}

export interface AppBottomSheetRef {
    present: () => void;
    dismiss: () => void;
}

const AppBottomSheet = forwardRef<AppBottomSheetRef, AppBottomSheetProps>(
    ({ children, snapPoints, onClose, enablePanDownToClose = true }, ref) => {
        const bottomSheetRef = useRef<BottomSheetModal>(null);
        const theme = useTheme();
        const [isOpen, setIsOpen] = useState(false);

        const handleSheetChanges = useCallback((index: number) => {
            setIsOpen(index >= 0);
            if (index === -1) {
                onClose?.();
            } else {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        }, [onClose]);

        const renderBackdrop = useCallback(
            (props: BottomSheetBackdropProps) => (
                <BottomSheetBackdrop
                    {...props}
                    disappearsOnIndex={-1}
                    appearsOnIndex={0}
                    pressBehavior={enablePanDownToClose ? "close" : "none"}
                    opacity={0.4}
                />
            ),
            [enablePanDownToClose]
        );

        useImperativeHandle(ref, () => ({
            present: () => {
                bottomSheetRef.current?.present();
            },
            dismiss: () => {
                bottomSheetRef.current?.dismiss();
            },
        }));

        // Handle Android back button
        useEffect(() => {
            if (!isOpen) return;

            const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
                bottomSheetRef.current?.dismiss();
                return true;
            });

            return () => backHandler.remove();
        }, [isOpen]);

        const enableDynamicSizing = !snapPoints;

        return (
            <BottomSheetModal
                ref={bottomSheetRef}
                enablePanDownToClose={enablePanDownToClose}
                enableDynamicSizing={enableDynamicSizing}
                snapPoints={snapPoints}
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
                    backgroundColor: theme.color2.val,
                    borderRadius: 20,

                }}
                onChange={handleSheetChanges}
                animationConfigs={{
                    duration: 250,
                }}
                containerStyle={{ zIndex: 1000 }}
            >
                {enableDynamicSizing ? (
                    <BottomSheetView style={styles.contentContainer}>
                        {children}
                    </BottomSheetView>
                ) : (
                    children
                )}
            </BottomSheetModal>
        );
    }
);

const styles = StyleSheet.create({
    contentContainer: {
        // Extra bottom padding so content clears the home indicator
        paddingBottom: Platform.OS === 'ios' ? 8 : 16,
    },
});

export default AppBottomSheet;
