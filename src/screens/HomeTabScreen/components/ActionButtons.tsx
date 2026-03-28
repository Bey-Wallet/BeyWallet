import React, { useRef } from "react";
import { Button, XStack, YStack, Text, ListItem } from "tamagui";
import { Landmark, ArrowRight } from "@tamagui/lucide-icons";
import { useRouter } from "expo-router";
import * as Haptics from 'expo-haptics';
import SwapIcon from "~/components/icons/Swap";
import ArrowDownIcon from "~/components/icons/ArrowDown";
import SendIcon from "~/components/icons/Send";
import AppBottomSheet, { AppBottomSheetRef } from "~/components/UI/AppBottomSheet";

interface ActionConfig {
    icon: any;
    onPress: () => void;
    haptic?: Haptics.ImpactFeedbackStyle;
    bg?: string;
    iconSize?: number;
    theme?: any;
    themeInverse?: boolean;
}

interface SheetActionConfig {
    title: string;
    subTitle: string;
    path: string;
}

export default function ActionButtons() {
    const router = useRouter();
    const sheetRef = useRef<AppBottomSheetRef>(null);

    const handleActionPress = (action: ActionConfig) => {
        if (action.haptic) {
            Haptics.impactAsync(action.haptic);
        }
        action.onPress();
    };

    const handleOptionPress = (path: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        sheetRef.current?.dismiss();
        router.push(path as any);
    };

    const MAIN_ACTIONS: ActionConfig[] = [
        {
            icon: Landmark,
            onPress: () => sheetRef.current?.present(),
            haptic: Haptics.ImpactFeedbackStyle.Medium,
            bg: "$gray4",
            iconSize: 32,
        },
        {
            icon: SwapIcon,
            onPress: () => router.push("/swap"),
            haptic: Haptics.ImpactFeedbackStyle.Light,
            bg: "$gray4",
            iconSize: 32,
        },
        {
            icon: ArrowDownIcon,
            onPress: () => router.push("/receive"),
            haptic: Haptics.ImpactFeedbackStyle.Light,
            bg: "$gray4",
            iconSize: 36,
        },
        {
            icon: SendIcon,
            onPress: () => router.push("/send"),
            haptic: Haptics.ImpactFeedbackStyle.Medium,
            themeInverse: true,
            theme: "gray",
            iconSize: 32,
        },
    ];

    const SHEET_ACTIONS: SheetActionConfig[] = [
        {
            title: "Deposit or receive",
            subTitle: "Add funds to Mint.",
            path: "/mint",
        },
        {
            title: "Withdraw or send",
            subTitle: "Remove funds from Mint.",
            path: "/melt",
        },
    ];

    return (
        <>
            <XStack gap="$2" justify="space-between">
                {MAIN_ACTIONS.map((action, index) => {
                    const Icon = action.icon;
                    return (
                        <Button
                            key={index}
                            bg={action.bg}
                            theme={action.theme}
                            themeInverse={action.themeInverse}
                            flex={1}
                            size="$7"
                            rounded="$5"
                            icon={<Icon size={action.iconSize || 32} />}
                            onPress={() => handleActionPress(action)}
                        />
                    );
                })}
            </XStack>

            <AppBottomSheet ref={sheetRef}>
                <YStack p="$4" gap="$2">
                    <XStack justify="center">
                        <Text fontSize="$6" color="$accent5" fontWeight="bold" mb="$2" px="$2">
                            Select action
                        </Text>
                    </XStack>
                    {SHEET_ACTIONS.map((option, index) => (
                        <ListItem
                            key={index}
                            hoverTheme
                            pressTheme
                            title={option.title}
                            subTitle={option.subTitle}
                            size="$6"
                            iconAfter={<ArrowRight size={24} color="$color" />}
                            onPress={() => handleOptionPress(option.path)}
                            px="$4"
                            rounded="$5"
                            borderWidth={1}
                            borderColor="$color3"
                        />
                    ))}
                </YStack>
            </AppBottomSheet>
        </>
    );
}
